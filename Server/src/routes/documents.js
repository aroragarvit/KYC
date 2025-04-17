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
        fastify.log.info({ id }, 'Document not found');
        return reply.code(404).send({ error: "Document not found", id });
      }

      return { document };
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: `/documents/${request.params.id}`,
        id: request.params.id,
        error: error.message,
        stack: error.stack,
      }, 'Failed to fetch document');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to fetch document details' });
    }
  });

  // Download document file
  fastify.get("/download", async (request, reply) => {
    try {
      const { path: filePath, filename } = request.query;
      
      if (!filePath) {
        fastify.log.info('File path is required');
        return reply.code(400).send({ error: "File path is required" });
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (err) {
        fastify.log.info({ filePath }, 'File not found');
        return reply.code(404).send({
          error: "File not found",
          details: `File does not exist at path: ${filePath}`,
        });
      }

      // Stream the file to the client
      const stream = fs.createReadStream(filePath);
      const downloadFilename = filename || path.basename(filePath);
      
      reply.header('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      reply.type(path.extname(filePath));
      reply.send(stream);
      
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: '/download',
        filePath: request.query.path,
        error: error.message,
        stack: error.stack,
      }, 'Failed to download file');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to download file' });
    }
  });

  // Read content of a document by document ID or name
  fastify.get("/documents/read", async (request, reply) => {
    try {
      const { id, name } = request.query;
      let document;

      if (!id && !name) {
        fastify.log.info('Document ID or name required');
        return reply.code(400).send({ error: "Document ID or name is required as a query parameter" });
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
        fastify.log.info({ id, name }, 'Document not found');
        return reply.code(404).send({ error: "Document not found", id, name });
      }

      // Check if file exists
      try {
        await fs.access(document.file_path);
      } catch (err) {
        fastify.log.info({ filePath: document.file_path }, 'Document file not found');
        return reply.code(404).send({
          error: "Document file not found",
          details: `File does not exist at path: ${document.file_path}`,
        });
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
          fastify.log.error({
            method: 'GET',
            path: '/documents/read',
            id, name,
            error: fallbackErr.message,
            stack: fallbackErr.stack,
          }, 'Failed to read document content');
          return reply.code(500).send({
            error: "Failed to read document content",
            details: fallbackErr.message,
          });
        }
      }
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: '/documents/read',
        id: request.query.id,
        name: request.query.name,
        error: error.message,
        stack: error.stack,
      }, 'Failed to read document');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to read document content' });
    }
  });

  // List all available documents
  fastify.get("/documents", async (request, reply) => {
    try {
      // Get all documents with their company information
      const documents = fastify.db
        .prepare(`
          SELECT d.id, d.name, d.file_path, c.id AS company_id, c.name AS company_name
          FROM documents d
          LEFT JOIN company_documents cd ON d.id = cd.document_id
          LEFT JOIN companies c ON cd.company_id = c.id
        `)
        .all();
      
      fastify.log.info({ count: documents.length }, 'Retrieved all documents');
      return { documents };
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: '/documents',
        error: error.message,
        stack: error.stack,
      }, 'Failed to fetch all documents');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to fetch documents list' });
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

  fastify.get("/companies/:id([0-9]+)/shareholders", async (request, reply) => {
    try {
      const { id } = request.params;
      const shareholders = fastify.db
        .prepare("SELECT * FROM shareholders WHERE company_id = ?")
        .all(id);
  
        return {company: shareholders.company_name, shareholders};
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });
  // Get all shareholders for a company by company name
  fastify.get("/companies/:name/shareholders", async (request, reply) => {
    try {
      const { name } = request.params;

      // Check if company exists
      const company = fastify.db
        .prepare("SELECT id, name FROM companies WHERE name = ?")
        .get(name);
      if (!company) {
        fastify.log.info({ name }, 'Company not found when fetching shareholders');
        return reply.code(404).send({ error: "Company not found" });
      }

      // Get all shareholders for the company
      const shareholders = fastify.db
        .prepare("SELECT * FROM shareholders WHERE company_id = ? ORDER BY id")
        .all(company.id);

      fastify.log.info({ 
        name, 
        company_id: company.id, 
        count: shareholders.length 
      }, 'Retrieved shareholders for company');
      
      return { company: company.name, shareholders };
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: `/companies/${request.params.name}/shareholders`,
        name: request.params.name,
        error: error.message,
        stack: error.stack,
      }, 'Failed to fetch company shareholders');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to fetch company shareholders' });
    }
  });

  // Add a new shareholder to a company
  fastify.post("/companies/:name/shareholders", {
    schema: {
      body: {
        type: 'object',
        properties: {
          shareholder_type: { type: 'string', enum: ['Individual', 'Corporate'] },
          origin: { type: 'string' },
          full_name: { type: 'string' },
          id_number: { type: 'string' },
          id_type: { type: 'string' },
          nationality: { type: 'string' },
          residential_address: { type: 'string' },
          company_name: { type: 'string' },
          registration_number: { type: 'string' },
          registered_address: { type: 'string' },
          signatory_name: { type: 'string' },
          signatory_email: { type: 'string' },
          telephone_number: { type: 'string' },
          email_address: { type: 'string' },
          number_of_shares: { type: 'integer' },
          price_per_share: { type: 'number' },
          percentage_ownership: { type: 'number' },
          beneficial_owners: { type: 'string' }
        }
      }
    },
    handler: async (request, reply) => {
      const { name } = request.params;
      try {
        // Get company ID or create if it doesn't exist
        let company = fastify.db
          .prepare("SELECT * FROM companies WHERE name = ?")
          .get(name);
        
        let companyId;
        if (!company) {
          // Create the company
          fastify.log.info({ name }, 'Creating new company during shareholder creation');
          const result = fastify.db
            .prepare("INSERT INTO companies (name) VALUES (?)")
            .run(name);
          companyId = result.lastInsertRowid;
        } else {
          companyId = company.id;
        }
        
        // Build INSERT query
        const fields = ['company_id'];
        const placeholders = ['?'];
        const values = [companyId];
        
        for (const [key, value] of Object.entries(request.body)) {
          if (value !== undefined) {
            fields.push(key);
            placeholders.push('?');
            values.push(value);
          }
        }
        
        const query = `
          INSERT INTO shareholders (${fields.join(', ')})
          VALUES (${placeholders.join(', ')})
        `;
        
        const result = fastify.db
          .prepare(query)
          .run(...values);
        
        // Fetch the created shareholder
        const shareholder = fastify.db
          .prepare("SELECT * FROM shareholders WHERE id = ?")
          .get(result.lastInsertRowid);
        
        fastify.log.info({ 
          company_name: name,
          company_id: companyId,
          shareholder_id: result.lastInsertRowid,
          shareholder_type: request.body.shareholder_type || 'Unknown'
        }, 'Created new shareholder');
        
        return reply.code(201).send({ shareholder });
      } catch (error) {
        fastify.log.error({
          method: 'POST',
          path: `/companies/${name}/shareholders`,
          name,
          body: request.body,
          error: error.message,
          stack: error.stack,
        }, 'Failed to create shareholder');
        return reply.code(500).send({ error: 'Server error', message: 'Failed to create shareholder' });
      }
    }
  });

  // Delete all shareholders for a company
  fastify.delete("/companies/:name/shareholders", async (request, reply) => {
    try {
      const { name } = request.params;
      
      // First, get the company ID
      const company = fastify.db
        .prepare("SELECT * FROM companies WHERE name = ?")
        .get(name);
      
      if (!company) {
        fastify.log.info({ name }, 'Company not found when deleting shareholders');
        return reply.code(404).send({ error: 'Company not found', name });
      }
      
      // Count shareholders before deletion
      const countResult = fastify.db
        .prepare("SELECT COUNT(*) as count FROM shareholders WHERE company_id = ?")
        .get(company.id);
      
      // Delete all shareholders for the company
      fastify.db
        .prepare("DELETE FROM shareholders WHERE company_id = ?")
        .run(company.id);
      
      fastify.log.info({ 
        company_name: name,
        company_id: company.id,
        deleted_count: countResult.count
      }, 'Deleted all shareholders for company');
      
      return { 
        message: `Successfully deleted ${countResult.count} shareholders for company ${name}`,
        count: countResult.count
      };
    } catch (error) {
      fastify.log.error({
        method: 'DELETE',
        path: `/companies/${request.params.name}/shareholders`,
        name: request.params.name,
        error: error.message,
        stack: error.stack,
      }, 'Failed to delete shareholders');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to delete shareholders' });
    }
  });

  // Get shareholder by ID
  fastify.get("/shareholders/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      
      const shareholder = fastify.db
        .prepare("SELECT * FROM shareholders WHERE id = ?")
        .get(id);
      
      if (!shareholder) {
        fastify.log.info({ id }, 'Shareholder not found');
        return reply.code(404).send({ error: 'Shareholder not found', id });
      }
      
      fastify.log.info({ id, type: shareholder.shareholder_type }, 'Retrieved shareholder');
      return { shareholder };
    } catch (error) {
      fastify.log.error({
        method: 'GET',
        path: `/shareholders/${request.params.id}`,
        id: request.params.id,
        error: error.message,
        stack: error.stack,
      }, 'Failed to fetch shareholder');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to fetch shareholder details' });
    }
  });

  // Update shareholder information
  fastify.patch("/shareholders/:id", {
    schema: {
      body: {
        type: 'object',
        properties: {
          shareholder_type: { type: 'string', enum: ['Individual', 'Corporate'] },
          origin: { type: 'string' },
          full_name: { type: 'string' },
          id_number: { type: 'string' },
          id_type: { type: 'string' },
          nationality: { type: 'string' },
          residential_address: { type: 'string' },
          company_name: { type: 'string' },
          registration_number: { type: 'string' },
          registered_address: { type: 'string' },
          signatory_name: { type: 'string' },
          signatory_email: { type: 'string' },
          telephone_number: { type: 'string' },
          email_address: { type: 'string' },
          number_of_shares: { type: 'integer' },
          price_per_share: { type: 'number' },
          percentage_ownership: { type: 'number' },
          beneficial_owners: { type: 'string' }
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params;
        
        // Check if shareholder exists
        const shareholder = fastify.db
          .prepare("SELECT * FROM shareholders WHERE id = ?")
          .get(id);
        
        if (!shareholder) {
          fastify.log.info({ id }, 'Shareholder not found during update');
          return reply.code(404).send({ error: 'Shareholder not found', id });
        }
        
        // Build SET clause and parameters for SQL
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(request.body)) {
          if (value !== undefined) {
            fields.push(`${key} = ?`);
            values.push(value);
          }
        }
        
        if (fields.length === 0) {
          fastify.log.info({ id }, 'No fields to update for shareholder');
          return reply.code(400).send({ error: 'No fields to update', id });
        }
        
        // Add ID as the last parameter
        values.push(id);
        
        const query = `
          UPDATE shareholders 
          SET ${fields.join(', ')}
          WHERE id = ?
        `;
        
        fastify.db.prepare(query).run(...values);
        
        // Fetch updated shareholder
        const updatedShareholder = fastify.db
          .prepare("SELECT * FROM shareholders WHERE id = ?")
          .get(id);
        
        fastify.log.info({ 
          id, 
          updated_fields: Object.keys(request.body),
          shareholder_type: updatedShareholder.shareholder_type
        }, 'Shareholder updated successfully');
        
        return { shareholder: updatedShareholder };
      } catch (error) {
        fastify.log.error({
          method: 'PATCH',
          path: `/shareholders/${request.params.id}`,
          id: request.params.id,
          body: request.body,
          error: error.message,
          stack: error.stack,
        }, 'Failed to update shareholder');
        return reply.code(500).send({ error: 'Server error', message: 'Failed to update shareholder' });
      }
    }
  });

  // Update shareholder verification status
  fastify.patch("/shareholders/:id/verification", {
    schema: {
      body: {
        type: 'object',
        required: ['verification_Status'],
        properties: {
          verification_Status: { 
            type: 'string', 
            enum: ['verified', 'notverified', 'pending', 'beneficial_ownership_incomplete'] 
          },
          KYC_Status: { type: 'string' }
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params;
        const { verification_Status, KYC_Status } = request.body;
        
        // Check if shareholder exists
        const shareholder = fastify.db
          .prepare("SELECT * FROM shareholders WHERE id = ?")
          .get(id);
        
        if (!shareholder) {
          fastify.log.info({ id }, 'Shareholder not found during verification update');
          return reply.code(404).send({ error: 'Shareholder not found', id });
        }
        
        // Update verification status
        fastify.db
          .prepare("UPDATE shareholders SET verification_Status = ?, KYC_Status = ? WHERE id = ?")
          .run(verification_Status, KYC_Status, id);
        
        // Fetch updated shareholder
        const updatedShareholder = fastify.db
          .prepare("SELECT * FROM shareholders WHERE id = ?")
          .get(id);
        
        fastify.log.info({ 
          id, 
          previous_status: shareholder.verification_Status,
          new_status: verification_Status,
          shareholder_type: shareholder.shareholder_type
        }, 'Shareholder verification status updated');
        
        return { shareholder: updatedShareholder };
      } catch (error) {
        fastify.log.error({
          method: 'PATCH',
          path: `/shareholders/${request.params.id}/verification`,
          id: request.params.id,
          body: request.body,
          error: error.message,
          stack: error.stack,
        }, 'Failed to update shareholder verification status');
        return reply.code(500).send({ error: 'Server error', message: 'Failed to update shareholder verification status' });
      }
    }
  });

  // Delete a shareholder
  fastify.delete("/shareholders/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      
      // Check if shareholder exists
      const shareholder = fastify.db
        .prepare("SELECT * FROM shareholders WHERE id = ?")
        .get(id);
      
      if (!shareholder) {
        fastify.log.info({ id }, 'Shareholder not found during deletion');
        return reply.code(404).send({ error: 'Shareholder not found', id });
      }
      
      // Delete shareholder
      fastify.db
        .prepare("DELETE FROM shareholders WHERE id = ?")
        .run(id);
      
      fastify.log.info({ 
        id, 
        company_id: shareholder.company_id,
        shareholder_type: shareholder.shareholder_type,
        name: shareholder.full_name || shareholder.company_name || 'Unknown'
      }, 'Shareholder deleted successfully');
      
      return { 
        message: 'Shareholder deleted successfully',
        id,
        company_id: shareholder.company_id
      };
    } catch (error) {
      fastify.log.error({
        method: 'DELETE',
        path: `/shareholders/${request.params.id}`,
        id: request.params.id,
        error: error.message,
        stack: error.stack,
      }, 'Failed to delete shareholder');
      return reply.code(500).send({ error: 'Server error', message: 'Failed to delete shareholder' });
    }
  });
}

module.exports = documentRoutes;