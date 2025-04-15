const path = require("path");
const fs = require("fs").promises;
const mammoth = require("mammoth");

async function documentRoutes(fastify, options) {

  fastify.get("/companies", async (request, reply) => {
    try {
      const companies = fastify.db.prepare("SELECT id, name FROM companies").all();
      return { companies };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Get company by ID
  fastify.get("/companies/:id([0-9]+)", async (request, reply) => {
    try {
      const { id } = request.params;
      
      const company = fastify.db
        .prepare("SELECT id, name FROM companies WHERE id = ?")
        .get(id);
      
      if (!company) {
        reply.code(404).send({ error: "Company not found" });
        return;
      }

      return { company };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Update company KYC status by ID
  fastify.patch("/companies/:id([0-9]+)/kyc-status", async (request, reply) => {
    try {
      const { id } = request.params;
      const { kycStatus } = request.body;

      if (!kycStatus) {
        reply.code(400).send({ error: "KYC status is required" });
        return;
      }

      // Check if company exists
      const companyExists = fastify.db
        .prepare("SELECT 1 FROM companies WHERE id = ?")
        .get(id);
      
      if (!companyExists) {
        reply.code(404).send({ error: "Company not found" });
        return;
      }

      // Update KYC status
      fastify.db
        .prepare("UPDATE companies SET kycStatus = ? WHERE id = ?")
        .run(kycStatus, id);

      // Get updated company
      const company = fastify.db
        .prepare("SELECT id, name, kycStatus FROM companies WHERE id = ?")
        .get(id);

      return { 
        message: "Company KYC status updated successfully", 
        company 
      };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Get all documents for a company by company name
  fastify.get("/companies/:name/documents", async (request, reply) => {
    try {
      const { name } = request.params;

      // Check if company exists
      const company = fastify.db
        .prepare("SELECT id, name FROM companies WHERE name = ?")
        .get(name);
      if (!company) {
        reply.code(404).send({ error: "Company not found" });
        return;
      }

      // Get all documents for the company
      const documents = fastify.db
        .prepare(
          `
        SELECT d.id, d.name, d.file_path
        FROM documents d
        JOIN company_documents cd ON d.id = cd.document_id
        WHERE cd.company_id = ?
      `,
        )
        .all(company.id);

      return { company, documents };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Get all documents for a company by company ID
  fastify.get("/companies/:id([0-9]+)/documents", async (request, reply) => {
    try {
      const { id } = request.params;

      // Check if company exists
      const company = fastify.db
        .prepare("SELECT id, name FROM companies WHERE id = ?")
        .get(id);
      if (!company) {
        reply.code(404).send({ error: "Company not found" });
        return;
      }

      // Get all documents for the company
      const documents = fastify.db
        .prepare(
          `
        SELECT d.id, d.name, d.file_path
        FROM documents d
        JOIN company_documents cd ON d.id = cd.document_id
        WHERE cd.company_id = ?
      `,
        )
        .all(company.id);

      return { company, documents };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Get document by ID
  fastify.get("/documents/:id", async (request, reply) => {
    try {
      const { id } = request.params;

      // Get document info
      const document = fastify.db
        .prepare("SELECT id, name, file_path FROM documents WHERE id = ?")
        .get(id);
      
      if (!document) {
        reply.code(404).send({ error: "Document not found" });
        return;
      }

      return { document };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Download document file
  fastify.get("/download", async (request, reply) => {
    try {
      const { path: filePath, filename } = request.query;
      
      if (!filePath) {
        reply.code(400).send({ error: "File path is required" });
        return;
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (err) {
        reply.code(404).send({
          error: "File not found",
          details: `File does not exist at path: ${filePath}`,
        });
        return;
      }

      // Stream the file to the client
      const stream = fs.createReadStream(filePath);
      const downloadFilename = filename || path.basename(filePath);
      
      reply.header('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      reply.type(path.extname(filePath));
      reply.send(stream);
      
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Read content of a document by document ID
  fastify.get("/documents/read", async (request, reply) => {
    try {
      const { id, name } = request.query;
      let document;

      if (!id && !name) {
        reply
          .code(400)
          .send({ error: "Document ID or name is required as a query parameter" });
        return;
      }

      // Get document info by ID or name
      if (id) {
        document = fastify.db
          .prepare("SELECT * FROM documents WHERE id = ?")
          .get(id);
      } else {
        document = fastify.db
          .prepare("SELECT * FROM documents WHERE name = ?")
          .get(name);
      }

      if (!document) {
        reply.code(404).send({ error: "Document not found" });
        return;
      }

      // Check if file exists
      try {
        await fs.access(document.file_path);
      } catch (err) {
        reply.code(404).send({
          error: "Document file not found",
          details: `File does not exist at path: ${document.file_path}`,
        });
        return;
      }

      // Use mammoth to extract text from DOCX
      try {
        const result = await mammoth.extractRawText({
          path: document.file_path
        });
        
        return {
          document: {
            id: document.id,
            name: document.name,
          },
          content: result.value,
          messages: result.messages
        };
      } catch (err) {
        // Fallback to binary reading if mammoth fails
        try {
          // Read file as binary data
          const data = await fs.readFile(document.file_path);
          let content = "";
          
          // Convert buffer to string and extract readable text
          const fileStr = data.toString();
          // Find all sequences of printable ASCII characters
          const textMatches = fileStr.match(/[\x20-\x7E]{4,}/g) || [];
          content = textMatches.join(" ");
          
          return {
            document: {
              id: document.id,
              name: document.name,
            },
            content: content || "No readable text content found",
            note: "Content extracted using fallback method (mammoth failed)",
            error: err.message
          };
        } catch (fallbackErr) {
          reply.code(500).send({
            error: "Failed to read document content",
            details: fallbackErr.message,
          });
        }
      }
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // List all available documents
  fastify.get("/documents", async (request, reply) => {
    try {
      // Get all documents with their company information
      const documents = fastify.db.prepare(`
        SELECT d.id, d.name, d.file_path, c.id AS company_id, c.name AS company_name
        FROM documents d
        LEFT JOIN company_documents cd ON d.id = cd.document_id
        LEFT JOIN companies c ON cd.company_id = c.id
      `).all();
      
      return { documents };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Get all directors for a company by ID
  fastify.get("/companies/:id([0-9]+)/directors", async (request, reply) => {
    try {
      const { id } = request.params;

      // Check if company exists
      const company = fastify.db
        .prepare("SELECT id, name FROM companies WHERE id = ?")
        .get(id);
      if (!company) {
        reply.code(404).send({ error: "Company not found" });
        return;
      }

      // Get all directors for the company
      const directors = fastify.db
        .prepare("SELECT * FROM directors WHERE company_id = ?")
        .all(company.id);

      return { company, directors };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Get all directors for a company by name
  fastify.get("/companies/:name/directors", async (request, reply) => {
    try {
      const { name } = request.params;

      // Check if company exists
      const company = fastify.db
        .prepare("SELECT id, name FROM companies WHERE name = ?")
        .get(name);
      if (!company) {
        reply.code(404).send({ error: "Company not found" });
        return;
      }

      // Get all directors for the company
      const directors = fastify.db
        .prepare("SELECT * FROM directors WHERE company_id = ?")
        .all(company.id);

      return { company, directors };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Save director information
  fastify.post("/companies/:name/directors", async (request, reply) => {
    try {
      const { name } = request.params;
      const directorData = request.body;

      if (!directorData) {
        reply.code(400).send({ error: "Director data is required" });
        return;
      }

      // Check if company exists
      const company = fastify.db
        .prepare("SELECT id, name FROM companies WHERE name = ?")
        .get(name);
      if (!company) {
        reply.code(404).send({ error: "Company not found" });
        return;
      }

      // Insert or update director information
      const stmt = fastify.db.prepare(`
        INSERT INTO directors (
          company_id, full_name, id_number, id_type, nationality, 
          residential_address, telephone_number, email_address,
          full_name_source, id_number_source, id_type_source, nationality_source,
          residential_address_source, telephone_number_source, email_address_source,
          full_name_values, id_number_values, id_type_values, nationality_values,
          residential_address_values, telephone_number_values, email_address_values,
          discrepancies, verification_Status, KYC_Status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (company_id, full_name) 
        DO UPDATE SET 
          id_number = excluded.id_number,
          id_type = excluded.id_type,
          nationality = excluded.nationality,
          residential_address = excluded.residential_address,
          telephone_number = excluded.telephone_number,
          email_address = excluded.email_address,
          full_name_source = excluded.full_name_source,
          id_number_source = excluded.id_number_source,
          id_type_source = excluded.id_type_source,
          nationality_source = excluded.nationality_source,
          residential_address_source = excluded.residential_address_source,
          telephone_number_source = excluded.telephone_number_source,
          email_address_source = excluded.email_address_source,
          full_name_values = excluded.full_name_values,
          id_number_values = excluded.id_number_values,
          id_type_values = excluded.id_type_values,
          nationality_values = excluded.nationality_values,
          residential_address_values = excluded.residential_address_values,
          telephone_number_values = excluded.telephone_number_values,
          email_address_values = excluded.email_address_values,
          discrepancies = excluded.discrepancies,
          verification_Status = COALESCE(excluded.verification_Status, verification_Status),
          KYC_Status = COALESCE(excluded.KYC_Status, KYC_Status)
        RETURNING id
      `);

      const result = stmt.get(
        company.id,
        directorData.full_name,
        directorData.id_number,
        directorData.id_type,
        directorData.nationality,
        directorData.residential_address,
        directorData.telephone_number,
        directorData.email_address,
        directorData.full_name_source,
        directorData.id_number_source,
        directorData.id_type_source,
        directorData.nationality_source,
        directorData.residential_address_source,
        directorData.telephone_number_source,
        directorData.email_address_source,
        directorData.full_name_values || JSON.stringify([]),
        directorData.id_number_values || JSON.stringify([]),
        directorData.id_type_values || JSON.stringify([]),
        directorData.nationality_values || JSON.stringify([]),
        directorData.residential_address_values || JSON.stringify([]),
        directorData.telephone_number_values || JSON.stringify([]),
        directorData.email_address_values || JSON.stringify([]),
        directorData.discrepancies,
        directorData.verification_Status || 'pending',
        directorData.KYC_Status
      );

      const director = fastify.db
        .prepare("SELECT * FROM directors WHERE id = ?")
        .get(result.id);

      return { 
        message: "Director information saved successfully", 
        director 
      };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // New endpoint to update director verification status
  fastify.patch("/directors/:id/verification", async (request, reply) => {
    try {
      const { id } = request.params;
      const { verification_Status, KYC_Status } = request.body;
      
      if (!verification_Status) {
        reply.code(400).send({ error: "verification_Status is required" });
        return;
      }
      
      // Validate status value
      if (!['verified', 'notverified', 'pending'].includes(verification_Status)) {
        reply.code(400).send({ 
          error: "Invalid verification_Status", 
          message: "Status must be one of: verified, notverified, pending" 
        });
        return;
      }
      
      // Check if director exists
      const existingDirector = fastify.db
        .prepare("SELECT id FROM directors WHERE id = ?")
        .get(id);
        
      if (!existingDirector) {
        reply.code(404).send({ error: "Director not found" });
        return;
      }
      
      // Update director status
      const stmt = fastify.db.prepare(`
        UPDATE directors 
        SET verification_Status = ?, KYC_Status = ?
        WHERE id = ?
      `);
      
      stmt.run(
        verification_Status, 
        KYC_Status || null,
        id
      );
      
      // Get updated director
      const director = fastify.db
        .prepare("SELECT * FROM directors WHERE id = ?")
        .get(id);
      
      return {
        message: "Director verification status updated successfully",
        director
      };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });

  // Save director information by company ID
  fastify.post("/companies/:id([0-9]+)/directors", async (request, reply) => {
    try {
      const { id } = request.params;
      const directorData = request.body;

      if (!directorData) {
        reply.code(400).send({ error: "Director data is required" });
        return;
      }

      // Check if company exists
      const company = fastify.db
        .prepare("SELECT id, name FROM companies WHERE id = ?")
        .get(id);
      if (!company) {
        reply.code(404).send({ error: "Company not found" });
        return;
      }

      // Insert or update director information
      const stmt = fastify.db.prepare(`
        INSERT INTO directors (
          company_id, full_name, id_number, id_type, nationality, 
          residential_address, telephone_number, email_address,
          full_name_source, id_number_source, id_type_source, nationality_source,
          residential_address_source, telephone_number_source, email_address_source,
          full_name_values, id_number_values, id_type_values, nationality_values,
          residential_address_values, telephone_number_values, email_address_values,
          discrepancies
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (company_id, full_name) 
        DO UPDATE SET 
          id_number = excluded.id_number,
          id_type = excluded.id_type,
          nationality = excluded.nationality,
          residential_address = excluded.residential_address,
          telephone_number = excluded.telephone_number,
          email_address = excluded.email_address,
          full_name_source = excluded.full_name_source,
          id_number_source = excluded.id_number_source,
          id_type_source = excluded.id_type_source,
          nationality_source = excluded.nationality_source,
          residential_address_source = excluded.residential_address_source,
          telephone_number_source = excluded.telephone_number_source,
          email_address_source = excluded.email_address_source,
          full_name_values = excluded.full_name_values,
          id_number_values = excluded.id_number_values,
          id_type_values = excluded.id_type_values,
          nationality_values = excluded.nationality_values,
          residential_address_values = excluded.residential_address_values,
          telephone_number_values = excluded.telephone_number_values,
          email_address_values = excluded.email_address_values,
          discrepancies = excluded.discrepancies
        RETURNING id
      `);

      const result = stmt.get(
        company.id,
        directorData.full_name,
        directorData.id_number,
        directorData.id_type,
        directorData.nationality,
        directorData.residential_address,
        directorData.telephone_number,
        directorData.email_address,
        directorData.full_name_source,
        directorData.id_number_source,
        directorData.id_type_source,
        directorData.nationality_source,
        directorData.residential_address_source,
        directorData.telephone_number_source,
        directorData.email_address_source,
        directorData.full_name_values || JSON.stringify([]),
        directorData.id_number_values || JSON.stringify([]),
        directorData.id_type_values || JSON.stringify([]),
        directorData.nationality_values || JSON.stringify([]),
        directorData.residential_address_values || JSON.stringify([]),
        directorData.telephone_number_values || JSON.stringify([]),
        directorData.email_address_values || JSON.stringify([]),
        directorData.discrepancies
      );

      const director = fastify.db
        .prepare("SELECT * FROM directors WHERE id = ?")
        .get(result.id);

      return { 
        message: "Director information saved successfully", 
        director 
      };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });
}

module.exports = documentRoutes;