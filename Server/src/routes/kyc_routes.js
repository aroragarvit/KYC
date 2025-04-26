const path = require("path");
const fs = require("fs").promises;
const { existsSync } = require("fs");
const mammoth = require("mammoth");

async function kycRoutes(fastify, options) {
  // Get all individuals // used in workflow only
  fastify.get("/kyc/individuals", async (request, reply) => {
    try {
      const { client_id } = request.query;
      
      let query = "SELECT * FROM individuals";
      let params = [];
      
      if (client_id) {
        query += " WHERE client_id = ?";
        params.push(client_id);
      }
      
      const individuals = fastify.kycDb.prepare(query).all(...params);

      // Process to convert JSON strings to objects
      const processedIndividuals = individuals.map((individual) => {
        return {
          ...individual,
          alternative_names: JSON.parse(individual.alternative_names || "[]"),
          id_numbers: JSON.parse(individual.id_numbers || "{}"),
          id_types: JSON.parse(individual.id_types || "{}"),
          nationalities: JSON.parse(individual.nationalities || "{}"),
          addresses: JSON.parse(individual.addresses || "{}"),
          emails: JSON.parse(individual.emails || "{}"),
          phones: JSON.parse(individual.phones || "{}"),
          roles: JSON.parse(individual.roles || "{}"),
          shares_owned: JSON.parse(individual.shares_owned || "{}"),
          price_per_share: JSON.parse(individual.price_per_share || "{}"),
          discrepancies: JSON.parse(individual.discrepancies || "[]"),
        };
      });

      return { individuals: processedIndividuals };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get specific individual by ID
  fastify.get("/kyc/individuals/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const { client_id } = request.query;

      let query = "SELECT * FROM individuals WHERE id = ?";
      let params = [id];
      
      if (client_id) {
        query += " AND client_id = ?";
        params.push(client_id);
      }

      const individual = fastify.kycDb.prepare(query).get(...params);

      if (!individual) {
        return reply.code(404).send({ error: "Individual not found" });
      }

      // Process to convert JSON strings to objects
      const processedIndividual = {
        ...individual,
        alternative_names: JSON.parse(individual.alternative_names || "[]"),
        id_numbers: JSON.parse(individual.id_numbers || "{}"),
        id_types: JSON.parse(individual.id_types || "{}"),
        nationalities: JSON.parse(individual.nationalities || "{}"),
        addresses: JSON.parse(individual.addresses || "{}"),
        emails: JSON.parse(individual.emails || "{}"),
        phones: JSON.parse(individual.phones || "{}"),
        roles: JSON.parse(individual.roles || "{}"),
        shares_owned: JSON.parse(individual.shares_owned || "{}"),
        price_per_share: JSON.parse(individual.price_per_share || "{}"),
        discrepancies: JSON.parse(individual.discrepancies || "[]"),
      };

      return { individual: processedIndividual };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Store individual data
  fastify.post("/kyc/individuals", async (request, reply) => {
    try {
      const individual = request.body;

      if (!individual.full_name) {
        return reply.code(400).send({ error: "Full name is required" });
      }

      if (!individual.client_id) {
        return reply.code(400).send({ error: "Client ID is required" });
      }

      // Check if individual already exists by exact name match and client_id
      const existingIndividual = fastify.kycDb
        .prepare("SELECT id FROM individuals WHERE full_name = ? AND client_id = ?")
        .get(individual.full_name, individual.client_id);

      // Convert objects to JSON strings
      const dataToStore = {
        client_id: individual.client_id,
        full_name: individual.full_name,
        alternative_names: JSON.stringify(individual.alternative_names || []),
        id_numbers: JSON.stringify(individual.id_numbers || {}),
        id_types: JSON.stringify(individual.id_types || {}),
        nationalities: JSON.stringify(individual.nationalities || {}),
        addresses: JSON.stringify(individual.addresses || {}),
        emails: JSON.stringify(individual.emails || {}),
        phones: JSON.stringify(individual.phones || {}),
        roles: JSON.stringify(individual.roles || {}),
        shares_owned: JSON.stringify(individual.shares_owned || {}),
        price_per_share: JSON.stringify(individual.price_per_share || {}),
        discrepancies: JSON.stringify(individual.discrepancies || []),
      };

      let result;

      if (existingIndividual) {
        // Update existing individual
        const updateStmt = fastify.kycDb.prepare(`
          UPDATE individuals SET
            alternative_names = ?,
            id_numbers = ?,
            id_types = ?,
            nationalities = ?,
            addresses = ?,
            emails = ?,
            phones = ?,
            roles = ?,
            shares_owned = ?,
            price_per_share = ?,
            discrepancies = ?
          WHERE id = ? AND client_id = ?
        `);

        updateStmt.run(
          dataToStore.alternative_names,
          dataToStore.id_numbers,
          dataToStore.id_types,
          dataToStore.nationalities,
          dataToStore.addresses,
          dataToStore.emails,
          dataToStore.phones,
          dataToStore.roles,
          dataToStore.shares_owned,
          dataToStore.price_per_share,
          dataToStore.discrepancies,
          existingIndividual.id,
          dataToStore.client_id,
        );

        result = { id: existingIndividual.id };
        return {
          message: "Individual updated successfully",
          id: result.id,
          client_id: dataToStore.client_id,
        };
      } else {
        // Insert new individual
        const insertStmt = fastify.kycDb.prepare(`
          INSERT INTO individuals (
            client_id, full_name, alternative_names, id_numbers, id_types,
            nationalities, addresses, emails, phones, roles,
            shares_owned, price_per_share, discrepancies
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `);

        result = insertStmt.get(
          dataToStore.client_id,
          dataToStore.full_name,
          dataToStore.alternative_names,
          dataToStore.id_numbers,
          dataToStore.id_types,
          dataToStore.nationalities,
          dataToStore.addresses,
          dataToStore.emails,
          dataToStore.phones,
          dataToStore.roles,
          dataToStore.shares_owned,
          dataToStore.price_per_share,
          dataToStore.discrepancies,
        );

        return {
          message: "Individual stored successfully",
          id: result.id,
          client_id: dataToStore.client_id,
        };
      }
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get all companies
  fastify.get("/kyc/companies", async (request, reply) => {
    try {
      const { client_id } = request.query;
      
      let query = "SELECT * FROM companies";
      let params = [];
      
      if (client_id) {
        query += " WHERE client_id = ?";
        params.push(client_id);
      }
      
      const companies = fastify.kycDb.prepare(query).all(...params);

      // Process to convert JSON strings to objects
      const processedCompanies = companies.map((company) => {
        return {
          ...company,
          registration_number: JSON.parse(company.registration_number || "{}"),
          jurisdiction: JSON.parse(company.jurisdiction || "{}"),
          address: JSON.parse(company.address || "{}"),
          directors: JSON.parse(company.directors || "[]"),
          shareholders: JSON.parse(company.shareholders || "[]"),
          company_activities: JSON.parse(company.company_activities || "{}"),
          shares_issued: JSON.parse(company.shares_issued || "{}"),
          price_per_share: JSON.parse(company.price_per_share || "{}"),
          discrepancies: JSON.parse(company.discrepancies || "[]"),
        };
      });

      return { companies: processedCompanies };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get specific company by ID
  fastify.get("/kyc/companies/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const { client_id } = request.query;

      let query = "SELECT * FROM companies WHERE id = ?";
      let params = [id];
      
      if (client_id) {
        query += " AND client_id = ?";
        params.push(client_id);
      }

      const company = fastify.kycDb.prepare(query).get(...params);

      if (!company) {
        return reply.code(404).send({ error: "Company not found" });
      }

      // Process to convert JSON strings to objects
      const processedCompany = {
        ...company,
        registration_number: JSON.parse(company.registration_number || "{}"),
        jurisdiction: JSON.parse(company.jurisdiction || "{}"),
        address: JSON.parse(company.address || "{}"),
        directors: JSON.parse(company.directors || "[]"),
        shareholders: JSON.parse(company.shareholders || "[]"),
        company_activities: JSON.parse(company.company_activities || "{}"),
        shares_issued: JSON.parse(company.shares_issued || "{}"),
        price_per_share: JSON.parse(company.price_per_share || "{}"),
        discrepancies: JSON.parse(company.discrepancies || "[]"),
      };

      return { company: processedCompany };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Store company data
  fastify.post("/kyc/companies", async (request, reply) => {
    try {
      const company = request.body;

      if (!company.company_name) {
        return reply.code(400).send({ error: "Company name is required" });
      }

      if (!company.client_id) {
        return reply.code(400).send({ error: "Client ID is required" });
      }

      // Check if company already exists by exact name match and client_id
      const existingCompany = fastify.kycDb
        .prepare("SELECT id FROM companies WHERE company_name = ? AND client_id = ?")
        .get(company.company_name, company.client_id);

      // Convert objects to JSON strings
      const dataToStore = {
        client_id: company.client_id,
        company_name: company.company_name,
        registration_number: JSON.stringify(company.registration_number || {}),
        jurisdiction: JSON.stringify(company.jurisdiction || {}),
        address: JSON.stringify(company.address || {}),
        directors: JSON.stringify(company.directors || []),
        shareholders: JSON.stringify(company.shareholders || []),
        company_activities: JSON.stringify(company.company_activities || {}),
        shares_issued: JSON.stringify(company.shares_issued || {}),
        price_per_share: JSON.stringify(company.price_per_share || {}),
        discrepancies: JSON.stringify(company.discrepancies || []),
      };

      let result;

      if (existingCompany) {
        // Update existing company
        const updateStmt = fastify.kycDb.prepare(`
          UPDATE companies SET
            registration_number = ?,
            jurisdiction = ?,
            address = ?,
            directors = ?,
            shareholders = ?,
            company_activities = ?,
            shares_issued = ?,
            price_per_share = ?,
            discrepancies = ?
          WHERE id = ? AND client_id = ?
        `);

        updateStmt.run(
          dataToStore.registration_number,
          dataToStore.jurisdiction,
          dataToStore.address,
          dataToStore.directors,
          dataToStore.shareholders,
          dataToStore.company_activities,
          dataToStore.shares_issued,
          dataToStore.price_per_share,
          dataToStore.discrepancies,
          existingCompany.id,
          dataToStore.client_id,
        );

        result = { id: existingCompany.id };
        return {
          message: "Company updated successfully",
          id: result.id,
          client_id: dataToStore.client_id,
        };
      } else {
        // Insert new company
        const insertStmt = fastify.kycDb.prepare(`
          INSERT INTO companies (
            client_id, company_name, registration_number, jurisdiction, address,
            directors, shareholders, company_activities, shares_issued,
            price_per_share, discrepancies
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `);

        result = insertStmt.get(
          dataToStore.client_id,
          dataToStore.company_name,
          dataToStore.registration_number,
          dataToStore.jurisdiction,
          dataToStore.address,
          dataToStore.directors,
          dataToStore.shareholders,
          dataToStore.company_activities,
          dataToStore.shares_issued,
          dataToStore.price_per_share,
          dataToStore.discrepancies,
        );

        return {
          message: "Company stored successfully",
          id: result.id,
          client_id: dataToStore.client_id,
        };
      }
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get document sources
  fastify.get("/kyc/documents", async (request, reply) => {
    try {
      const { client_id } = request.query;
      
      let query = "SELECT id, document_name, document_type, file_path, extraction_date, client_id FROM document_sources";
      let params = [];
      
      if (client_id) {
        query += " WHERE client_id = ?";
        params.push(client_id);
      }
      
      const documents = fastify.kycDb.prepare(query).all(...params);

      return { documents };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Read content from document by ID
  fastify.get("/kyc/documents/:id/content", async (request, reply) => {
    try {
      const { id } = request.params;

      const document = fastify.kycDb
        .prepare("SELECT * FROM document_sources WHERE id = ?")
        .get(id);

      if (!document) {
        return reply.code(404).send({ error: "Document not found" });
      }
      
      // Get client name for file path construction
      const client = fastify.kycDb
        .prepare("SELECT name FROM clients WHERE id = ?")
        .get(document.client_id);
      
      if (!client) {
        return reply.code(404).send({ error: "Client not found" });
      }

      // Check if content is already stored in the database
      if (document.content) {
        return {
          document: {
            id: document.id,
            name: document.document_name,
            type: document.document_type,
            client_id: document.client_id,
            client_name: client.name
          },
          content: document.content,
        };
      }

      // Content not stored, try to extract it
      try {
        let content = "";
        
        // The document should already be stored in the client's document folder
        // Verify the file exists
        if (!existsSync(document.file_path)) {
          // If not found at original path, try constructing the path
          const clientFolder = `${client.name}_${document.client_id}`;
          const fullFilePath = path.join(
            path.dirname(path.dirname(document.file_path)), // Go up to db/folders
            clientFolder,
            "documents",
            path.basename(document.file_path)
          );
          
          if (!existsSync(fullFilePath)) {
            return reply.code(404).send({ 
              error: "Document file not found", 
              file_path: document.file_path,
              attempted_path: fullFilePath
            });
          }
          
          // Update the file path in the database
          fastify.kycDb
            .prepare("UPDATE document_sources SET file_path = ? WHERE id = ?")
            .run(fullFilePath, id);
            
          document.file_path = fullFilePath;
        }

        if (document.file_path.toLowerCase().endsWith(".docx")) {
          // Extract content using mammoth
          const result = await mammoth.extractRawText({
            path: document.file_path,
          });
          content = result.value;
        } else if (document.file_path.toLowerCase().endsWith(".pdf")) {
          // For PDF extraction you would need a PDF library
          // This is a placeholder
          content = "PDF content extraction not implemented";
        } else {
          // Try to read as text
          content = await fs.readFile(document.file_path, "utf-8");
        }

        // Store the content in the database for future use
        fastify.kycDb
          .prepare("UPDATE document_sources SET content = ? WHERE id = ?")
          .run(content, id);

        return {
          document: {
            id: document.id,
            name: document.document_name,
            type: document.document_type,
            client_id: document.client_id,
            client_name: client.name
          },
          content,
        };
      } catch (readErr) {
        request.log.error(`Error reading document: ${readErr.message}`);
        return reply.code(500).send({
          error: "Failed to read document content",
          details: readErr.message,
        });
      }
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Endpoint to trigger document processing
  fastify.post("/kyc/process-documents", async (request, reply) => {
    try {
      const { client_id } = request.body;
      
      if (!client_id) {
        return reply.code(400).send({ error: "Client ID is required" });
      }
      
      // Verify client exists
      const client = fastify.kycDb
        .prepare("SELECT id, name FROM clients WHERE id = ?")
        .get(client_id);
        
      if (!client) {
        return reply.code(404).send({ error: "Client not found" });
      }
      
      // This would normally trigger an asynchronous workflow
      // For simplicity, we'll return a success message
      return {
        message: "Document processing initiated",
        status: "processing",
        client_id: client_id,
        client_name: client.name
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Generate summary report
  fastify.get("/kyc/summary", async (request, reply) => {
    try {
      const { client_id } = request.query;
      
      let individualsQuery = "SELECT COUNT(*) as count FROM individuals";
      let companiesQuery = "SELECT COUNT(*) as count FROM companies";
      let documentsQuery = "SELECT COUNT(*) as count FROM document_sources";
      let individualsDiscrepanciesQuery = "SELECT COUNT(*) as count FROM individuals WHERE discrepancies != '[]'";
      let companiesDiscrepanciesQuery = "SELECT COUNT(*) as count FROM companies WHERE discrepancies != '[]'";
      
      let params = [];
      
      if (client_id) {
        individualsQuery += " WHERE client_id = ?";
        companiesQuery += " WHERE client_id = ?";
        documentsQuery += " WHERE client_id = ?";
        individualsDiscrepanciesQuery += " AND client_id = ?";
        companiesDiscrepanciesQuery += " AND client_id = ?";
        params.push(client_id);
      }

      const individualsCount = fastify.kycDb
        .prepare(individualsQuery)
        .get(...params).count;

      const companiesCount = fastify.kycDb
        .prepare(companiesQuery)
        .get(...params).count;

      const documentsCount = fastify.kycDb
        .prepare(documentsQuery)
        .get(...params).count;

      // Get individuals with discrepancies
      const individualsWithDiscrepancies = fastify.kycDb
        .prepare(individualsDiscrepanciesQuery)
        .get(...params).count;

      // Get companies with discrepancies
      const companiesWithDiscrepancies = fastify.kycDb
        .prepare(companiesDiscrepanciesQuery)
        .get(...params).count;

      return {
        summary: {
          total_individuals: individualsCount,
          total_companies: companiesCount,
          total_documents: documentsCount,
          individuals_with_discrepancies: individualsWithDiscrepancies,
          companies_with_discrepancies: companiesWithDiscrepancies,
          client_id: client_id,
        },
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Update document type
  fastify.patch("/kyc/documents/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const { document_type } = request.body;

      if (!document_type) {
        return reply.code(400).send({ error: "Document type is required" });
      }

      const document = fastify.kycDb
        .prepare("SELECT * FROM document_sources WHERE id = ?")
        .get(id);

      if (!document) {
        return reply.code(404).send({ error: "Document not found" });
      }

      fastify.kycDb
        .prepare("UPDATE document_sources SET document_type = ? WHERE id = ?")
        .run(document_type, id);

      return {
        message: "Document type updated successfully",
        document: {
          id,
          document_name: document.document_name,
          document_type,
          client_id: document.client_id
        },
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get individual by name
  fastify.get("/kyc/individuals/by-name/:name", async (request, reply) => {
    try {
      const { name } = request.params;
      const { client_id } = request.query;

      let query = "SELECT * FROM individuals WHERE full_name = ?";
      let params = [name];
      
      if (client_id) {
        query += " AND client_id = ?";
        params.push(client_id);
      }

      const individual = fastify.kycDb
        .prepare(query)
        .get(...params);

      if (!individual) {
        return reply.code(404).send({ error: "Individual not found" });
      }

      // Process to convert JSON strings to objects
      const processedIndividual = {
        ...individual,
        alternative_names: JSON.parse(individual.alternative_names || "[]"),
        id_numbers: JSON.parse(individual.id_numbers || "{}"),
        id_types: JSON.parse(individual.id_types || "{}"),
        nationalities: JSON.parse(individual.nationalities || "{}"),
        addresses: JSON.parse(individual.addresses || "{}"),
        emails: JSON.parse(individual.emails || "{}"),
        phones: JSON.parse(individual.phones || "{}"),
        roles: JSON.parse(individual.roles || "{}"),
        shares_owned: JSON.parse(individual.shares_owned || "{}"),
        price_per_share: JSON.parse(individual.price_per_share || "{}"),
        discrepancies: JSON.parse(individual.discrepancies || "[]"),
      };

      return { individual: processedIndividual };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get company by name
  fastify.get("/kyc/companies/by-name/:name", async (request, reply) => {
    try {
      const { name } = request.params;
      const { client_id } = request.query;

      let query = "SELECT * FROM companies WHERE company_name = ?";
      let params = [name];
      
      if (client_id) {
        query += " AND client_id = ?";
        params.push(client_id);
      }

      const company = fastify.kycDb
        .prepare(query)
        .get(...params);

      if (!company) {
        return reply.code(404).send({ error: "Company not found" });
      }

      // Process to convert JSON strings to objects
      const processedCompany = {
        ...company,
        registration_number: JSON.parse(company.registration_number || "{}"),
        jurisdiction: JSON.parse(company.jurisdiction || "{}"),
        address: JSON.parse(company.address || "{}"),
        directors: JSON.parse(company.directors || "[]"),
        shareholders: JSON.parse(company.shareholders || "[]"),
        company_activities: JSON.parse(company.company_activities || "{}"),
        shares_issued: JSON.parse(company.shares_issued || "{}"),
        price_per_share: JSON.parse(company.price_per_share || "{}"),
        discrepancies: JSON.parse(company.discrepancies || "[]"),
      };

      return { company: processedCompany };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // ========== DIRECTORS API ROUTES ==========

  // Get all directors (optionally filtered by company)
  fastify.get("/kyc/directors", async (request, reply) => {
    try {
      const { company, client_id } = request.query;

      let query = "SELECT * FROM directors";
      let params = [];
      let conditions = [];

      if (company) {
        conditions.push("company_name = ?");
        params.push(company);
      }
      
      if (client_id) {
        conditions.push("client_id = ?");
        params.push(client_id);
      }
      
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      const directors = fastify.kycDb.prepare(query).all(...params);

      return { directors };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get a specific director by company name and director name
  fastify.get("/kyc/directors/:company/:director", async (request, reply) => {
    try {
      const { company, director } = request.params;
      const { client_id } = request.query;

      let query = "SELECT * FROM directors WHERE company_name = ? AND director_name = ?";
      let params = [company, director];
      
      if (client_id) {
        query += " AND client_id = ?";
        params.push(client_id);
      }

      const directorRecord = fastify.kycDb
        .prepare(query)
        .get(...params);

      if (!directorRecord) {
        return reply.code(404).send({ error: "Director not found" });
      }

      return { director: directorRecord };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get all directors for a specific company
  fastify.get("/kyc/companies/:company/directors", async (request, reply) => {
    try {
      const { company } = request.params;
      const { client_id } = request.query;

      // Check if company exists
      let companyQuery = "SELECT 1 FROM companies WHERE company_name = ?";
      let companyParams = [company];
      
      if (client_id) {
        companyQuery += " AND client_id = ?";
        companyParams.push(client_id);
      }
      
      const companyExists = fastify.kycDb
        .prepare(companyQuery)
        .get(...companyParams);

      if (!companyExists) {
        return reply.code(404).send({ error: "Company not found" });
      }

      let directorsQuery = "SELECT * FROM directors WHERE company_name = ?";
      let directorsParams = [company];
      
      if (client_id) {
        directorsQuery += " AND client_id = ?";
        directorsParams.push(client_id);
      }

      const directors = fastify.kycDb
        .prepare(directorsQuery)
        .all(...directorsParams);

      return { directors };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Add a director
  fastify.post("/kyc/directors", async (request, reply) => {
    try {
      const director = request.body;

      if (!director.company_name || !director.director_name) {
        return reply
          .code(400)
          .send({ error: "Company name and director name are required" });
      }
      
      if (!director.client_id) {
        return reply.code(400).send({ error: "Client ID is required" });
      }

      // Check if this director entry already exists
      const existingDirector = fastify.kycDb
        .prepare(
          "SELECT * FROM directors WHERE company_name = ? AND director_name = ? AND client_id = ?"
        )
        .get(director.company_name, director.director_name, director.client_id);

      if (existingDirector) {
        // Check if it's not verified - we don't update if it's already marked as not verified
        if (existingDirector.verification_status === "not_verified") {
          return reply.code(400).send({
            error: "Cannot update director",
            message:
              "This director entry has verification issues and cannot be updated",
          });
        }

        // Log that we're updating an existing entry
        request.log.info(
          `Updating existing director: ${director.director_name} for company ${director.company_name}, client ${director.client_id}`
        );

        // Existing entry found and can be updated, perform an update instead
        const updateStmt = fastify.kycDb.prepare(`
          UPDATE directors SET
            id_number = ?,
            id_number_source = ?,
            id_type = ?,
            id_type_source = ?,
            nationality = ?,
            nationality_source = ?,
            residential_address = ?,
            residential_address_source = ?,
            tel_number = ?,
            tel_number_source = ?,
            email_address = ?,
            email_address_source = ?,
            verification_status = ?,
            kyc_status = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE company_name = ? AND director_name = ? AND client_id = ?
        `);

        updateStmt.run(
          director.id_number || existingDirector.id_number,
          director.id_number_source || existingDirector.id_number_source,
          director.id_type || existingDirector.id_type,
          director.id_type_source || existingDirector.id_type_source,
          director.nationality || existingDirector.nationality,
          director.nationality_source || existingDirector.nationality_source,
          director.residential_address || existingDirector.residential_address,
          director.residential_address_source ||
            existingDirector.residential_address_source,
          director.tel_number || existingDirector.tel_number,
          director.tel_number_source || existingDirector.tel_number_source,
          director.email_address || existingDirector.email_address,
          director.email_address_source ||
            existingDirector.email_address_source,
          director.verification_status || existingDirector.verification_status,
          director.kyc_status || existingDirector.kyc_status,
          director.company_name,
          director.director_name,
          director.client_id
        );

        return {
          message: "Director updated successfully",
          company: director.company_name,
          director: director.director_name,
          client_id: director.client_id
        };
      } else {
        // Log that we're creating a new entry
        request.log.info(
          `Creating new director: ${director.director_name} for company ${director.company_name}, client ${director.client_id}`
        );

        // New director entry, perform insert
        const insertStmt = fastify.kycDb.prepare(`
          INSERT INTO directors (
            client_id, company_name, director_name,
            id_number, id_number_source,
            id_type, id_type_source,
            nationality, nationality_source,
            residential_address, residential_address_source,
            tel_number, tel_number_source,
            email_address, email_address_source,
            verification_status, kyc_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
          director.client_id,
          director.company_name,
          director.director_name,
          director.id_number || null,
          director.id_number_source || null,
          director.id_type || null,
          director.id_type_source || null,
          director.nationality || null,
          director.nationality_source || null,
          director.residential_address || null,
          director.residential_address_source || null,
          director.tel_number || null,
          director.tel_number_source || null,
          director.email_address || null,
          director.email_address_source || null,
          director.verification_status || "pending",
          director.kyc_status || null
        );

        return {
          message: "Director added successfully",
          company: director.company_name,
          director: director.director_name,
          client_id: director.client_id
        };
      }
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Update a director
  fastify.put("/kyc/directors/:company/:director", async (request, reply) => {
    try {
      const { company, director } = request.params;
      const { client_id } = request.query;
      const updates = request.body;
      
      if (!client_id) {
        return reply.code(400).send({ error: "Client ID is required" });
      }

      // Check if this director exists
      const existingDirector = fastify.kycDb
        .prepare(
          "SELECT * FROM directors WHERE company_name = ? AND director_name = ? AND client_id = ?"
        )
        .get(company, director, client_id);

      if (!existingDirector) {
        return reply.code(404).send({ error: "Director not found" });
      }

      // Check if it's already marked as not_verified
      if (existingDirector.verification_status === "not_verified") {
        return reply.code(400).send({
          error: "Cannot update director",
          message:
            "This director entry has verification issues and cannot be updated",
        });
      }

      // Update the director
      const updateStmt = fastify.kycDb.prepare(`
        UPDATE directors SET
          id_number = ?,
          id_type = ?,
          nationality = ?,
          residential_address = ?,
          tel_number = ?,
          email_address = ?,
          verification_status = ?,
          kyc_status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE company_name = ? AND director_name = ? AND client_id = ?
      `);

      updateStmt.run(
        updates.id_number !== undefined
          ? updates.id_number
          : existingDirector.id_number,
        updates.id_type !== undefined
          ? updates.id_type
          : existingDirector.id_type,
        updates.nationality !== undefined
          ? updates.nationality
          : existingDirector.nationality,
        updates.residential_address !== undefined
          ? updates.residential_address
          : existingDirector.residential_address,
        updates.tel_number !== undefined
          ? updates.tel_number
          : existingDirector.tel_number,
        updates.email_address !== undefined
          ? updates.email_address
          : existingDirector.email_address,
        updates.verification_status !== undefined
          ? updates.verification_status
          : existingDirector.verification_status,
        updates.kyc_status !== undefined
          ? updates.kyc_status
          : existingDirector.kyc_status,
        company,
        director,
        client_id
      );

      return {
        message: "Director updated successfully",
        company,
        director,
        client_id
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // ========== SHAREHOLDERS API ROUTES ==========

  // Get all shareholders (optionally filtered by company)
  fastify.get("/kyc/shareholders", async (request, reply) => {
    try {
      const { company, client_id } = request.query;

      let query = "SELECT * FROM shareholders";
      let params = [];
      let conditions = [];

      if (company) {
        conditions.push("company_name = ?");
        params.push(company);
      }
      
      if (client_id) {
        conditions.push("client_id = ?");
        params.push(client_id);
      }
      
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      const shareholders = fastify.kycDb.prepare(query).all(...params);

      return { shareholders };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get a specific shareholder by company name and shareholder name
  fastify.get(
    "/kyc/shareholders/:company/:shareholder",
    async (request, reply) => {
      try {
        const { company, shareholder } = request.params;
        const { client_id } = request.query;

        let query = "SELECT * FROM shareholders WHERE company_name = ? AND shareholder_name = ?";
        let params = [company, shareholder];
        
        if (client_id) {
          query += " AND client_id = ?";
          params.push(client_id);
        }

        const shareholderRecord = fastify.kycDb
          .prepare(query)
          .get(...params);

        if (!shareholderRecord) {
          return reply.code(404).send({ error: "Shareholder not found" });
        }

        return { shareholder: shareholderRecord };
      } catch (err) {
        request.log.error(err);
        reply.code(500).send({
          error: "Internal Server Error",
          message: err.message,
        });
      }
    },
  );

  // Get all shareholders for a specific company
  fastify.get(
    "/kyc/companies/:company/shareholders",
    async (request, reply) => {
      try {
        const { company } = request.params;
        const { client_id } = request.query;

        // Check if company exists
        let companyQuery = "SELECT 1 FROM companies WHERE company_name = ?";
        let companyParams = [company];
        
        if (client_id) {
          companyQuery += " AND client_id = ?";
          companyParams.push(client_id);
        }
        
        const companyExists = fastify.kycDb
          .prepare(companyQuery)
          .get(...companyParams);

        if (!companyExists) {
          return reply.code(404).send({ error: "Company not found" });
        }

        let shareholdersQuery = "SELECT * FROM shareholders WHERE company_name = ?";
        let shareholdersParams = [company];
        
        if (client_id) {
          shareholdersQuery += " AND client_id = ?";
          shareholdersParams.push(client_id);
        }

        const shareholders = fastify.kycDb
          .prepare(shareholdersQuery)
          .all(...shareholdersParams);

        return { shareholders };
      } catch (err) {
        request.log.error(err);
        reply.code(500).send({
          error: "Internal Server Error",
          message: err.message,
        });
      }
    },
  );

  fastify.get("/kyc/companies/id/:id/shareholders", async (request, reply) => {
    try {
      const { id } = request.params;
      const { client_id } = request.query;

      // Check if company exists by ID
      let companyQuery = "SELECT company_name FROM companies WHERE id = ?";
      let companyParams = [id];
      
      if (client_id) {
        companyQuery += " AND client_id = ?";
        companyParams.push(client_id);
      }
      
      const company = fastify.kycDb
        .prepare(companyQuery)
        .get(...companyParams);

      if (!company) {
        return reply.code(404).send({ error: "Company not found" });
      }

      // Get shareholders by company ID through company name
      let shareholdersQuery = "SELECT * FROM shareholders WHERE company_name = ?";
      let shareholdersParams = [company.company_name];
      
      if (client_id) {
        shareholdersQuery += " AND client_id = ?";
        shareholdersParams.push(client_id);
      }
      
      const shareholders = fastify.kycDb
        .prepare(shareholdersQuery)
        .all(...shareholdersParams);

      return { shareholders };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  fastify.get("/kyc/companies/id/:id/directors", async (request, reply) => {
    try {
      const { id } = request.params;
      const { client_id } = request.query;

      // Check if company exists by ID
      let companyQuery = "SELECT company_name FROM companies WHERE id = ?";
      let companyParams = [id];
      
      if (client_id) {
        companyQuery += " AND client_id = ?";
        companyParams.push(client_id);
      }
      
      const company = fastify.kycDb
        .prepare(companyQuery)
        .get(...companyParams);

      if (!company) {
        return reply.code(404).send({ error: "Company not found" });
      }

      // Get directors by company ID through company name
      let directorsQuery = "SELECT * FROM directors WHERE company_name = ?";
      let directorsParams = [company.company_name];
      
      if (client_id) {
        directorsQuery += " AND client_id = ?";
        directorsParams.push(client_id);
      }
      
      const directors = fastify.kycDb
        .prepare(directorsQuery)
        .all(...directorsParams);

      return { directors };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });
  
  // Add a shareholder
  fastify.post("/kyc/shareholders", async (request, reply) => {
    try {
      const shareholder = request.body;

      if (!shareholder.company_name || !shareholder.shareholder_name) {
        return reply
          .code(400)
          .send({ error: "Company name and shareholder name are required" });
      }
      
      if (!shareholder.client_id) {
        return reply.code(400).send({ error: "Client ID is required" });
      }

      // Check if this shareholder entry already exists
      const existingShareholder = fastify.kycDb
        .prepare(
          "SELECT * FROM shareholders WHERE company_name = ? AND shareholder_name = ? AND client_id = ?"
        )
        .get(shareholder.company_name, shareholder.shareholder_name, shareholder.client_id);

      if (existingShareholder) {
        // Check if it's not verified - we don't update if it's already marked as not verified
        if (existingShareholder.verification_status === "not_verified") {
          return reply.code(400).send({
            error: "Cannot update shareholder",
            message:
              "This shareholder entry has verification issues and cannot be updated",
          });
        }

        // Log that we're updating an existing entry
        request.log.info(
          `Updating existing shareholder: ${shareholder.shareholder_name} for company ${shareholder.company_name}, client ${shareholder.client_id}`
        );

        // Existing entry found and can be updated, perform an update instead
        const updateStmt = fastify.kycDb.prepare(`
          UPDATE shareholders SET
            shares_owned = ?,
            shares_owned_source = ?,
            price_per_share = ?,
            price_per_share_source = ?,
            id_number = ?,
            id_number_source = ?,
            id_type = ?,
            id_type_source = ?,
            nationality = ?,
            nationality_source = ?,
            address = ?,
            address_source = ?,
            tel_number = ?,
            tel_number_source = ?,
            email_address = ?,
            email_address_source = ?,
            verification_status = ?,
            kyc_status = ?,
            is_company = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE company_name = ? AND shareholder_name = ? AND client_id = ?
        `);

        updateStmt.run(
          shareholder.shares_owned || existingShareholder.shares_owned,
          shareholder.shares_owned_source ||
            existingShareholder.shares_owned_source,
          shareholder.price_per_share || existingShareholder.price_per_share,
          shareholder.price_per_share_source ||
            existingShareholder.price_per_share_source,
          shareholder.id_number || existingShareholder.id_number,
          shareholder.id_number_source || existingShareholder.id_number_source,
          shareholder.id_type || existingShareholder.id_type,
          shareholder.id_type_source || existingShareholder.id_type_source,
          shareholder.nationality || existingShareholder.nationality,
          shareholder.nationality_source ||
            existingShareholder.nationality_source,
          shareholder.address || existingShareholder.address,
          shareholder.address_source || existingShareholder.address_source,
          shareholder.tel_number || existingShareholder.tel_number,
          shareholder.tel_number_source ||
            existingShareholder.tel_number_source,
          shareholder.email_address || existingShareholder.email_address,
          shareholder.email_address_source ||
            existingShareholder.email_address_source,
          shareholder.verification_status ||
            existingShareholder.verification_status,
          shareholder.kyc_status || existingShareholder.kyc_status,
          shareholder.is_company !== undefined
            ? shareholder.is_company
            : existingShareholder.is_company,
          shareholder.company_name,
          shareholder.shareholder_name,
          shareholder.client_id
        );

        return {
          message: "Shareholder updated successfully",
          company: shareholder.company_name,
          shareholder: shareholder.shareholder_name,
          client_id: shareholder.client_id
        };
      } else {
        // Log that we're creating a new entry
        request.log.info(
          `Creating new shareholder: ${shareholder.shareholder_name} for company ${shareholder.company_name}, client ${shareholder.client_id}`
        );

        // New shareholder entry, perform insert
        const insertStmt = fastify.kycDb.prepare(`
          INSERT INTO shareholders (
            client_id, company_name, shareholder_name,
            shares_owned, shares_owned_source,
            price_per_share, price_per_share_source,
            id_number, id_number_source,
            id_type, id_type_source,
            nationality, nationality_source,
            address, address_source,
            tel_number, tel_number_source,
            email_address, email_address_source,
            verification_status, kyc_status, is_company
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
          shareholder.client_id,
          shareholder.company_name,
          shareholder.shareholder_name,
          shareholder.shares_owned || null,
          shareholder.shares_owned_source || null,
          shareholder.price_per_share || null,
          shareholder.price_per_share_source || null,
          shareholder.id_number || null,
          shareholder.id_number_source || null,
          shareholder.id_type || null,
          shareholder.id_type_source || null,
          shareholder.nationality || null,
          shareholder.nationality_source || null,
          shareholder.address || null,
          shareholder.address_source || null,
          shareholder.tel_number || null,
          shareholder.tel_number_source || null,
          shareholder.email_address || null,
          shareholder.email_address_source || null,
          shareholder.verification_status || "pending",
          shareholder.kyc_status || null,
          shareholder.is_company || 0
        );

        return {
          message: "Shareholder added successfully",
          company: shareholder.company_name,
          shareholder: shareholder.shareholder_name,
          client_id: shareholder.client_id
        };
      }
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Update a shareholder
  fastify.put(
    "/kyc/shareholders/:company/:shareholder",
    async (request, reply) => {
      try {
        const { company, shareholder } = request.params;
        const { client_id } = request.query;
        const updates = request.body;
        
        if (!client_id) {
          return reply.code(400).send({ error: "Client ID is required" });
        }

        // Check if this shareholder exists
        const existingShareholder = fastify.kycDb
          .prepare(
            "SELECT * FROM shareholders WHERE company_name = ? AND shareholder_name = ? AND client_id = ?"
          )
          .get(company, shareholder, client_id);

        if (!existingShareholder) {
          return reply.code(404).send({ error: "Shareholder not found" });
        }

        // Check if it's already marked as not_verified
        if (existingShareholder.verification_status === "not_verified") {
          return reply.code(400).send({
            error: "Cannot update shareholder",
            message:
              "This shareholder entry has verification issues and cannot be updated",
          });
        }

        // Update the shareholder
        const updateStmt = fastify.kycDb.prepare(`
        UPDATE shareholders SET
          shares_owned = ?,
          price_per_share = ?,
          id_number = ?,
          id_type = ?,
          nationality = ?,
          address = ?,
          tel_number = ?,
          email_address = ?,
          verification_status = ?,
          kyc_status = ?,
          is_company = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE company_name = ? AND shareholder_name = ? AND client_id = ?
      `);

        updateStmt.run(
          updates.shares_owned !== undefined
            ? updates.shares_owned
            : existingShareholder.shares_owned,
          updates.price_per_share !== undefined
            ? updates.price_per_share
            : existingShareholder.price_per_share,
          updates.id_number !== undefined
            ? updates.id_number
            : existingShareholder.id_number,
          updates.id_type !== undefined
            ? updates.id_type
            : existingShareholder.id_type,
          updates.nationality !== undefined
            ? updates.nationality
            : existingShareholder.nationality,
          updates.address !== undefined
            ? updates.address
            : existingShareholder.address,
          updates.tel_number !== undefined
            ? updates.tel_number
            : existingShareholder.tel_number,
          updates.email_address !== undefined
            ? updates.email_address
            : existingShareholder.email_address,
          updates.verification_status !== undefined
            ? updates.verification_status
            : existingShareholder.verification_status,
          updates.kyc_status !== undefined
            ? updates.kyc_status
            : existingShareholder.kyc_status,
          updates.is_company !== undefined
            ? updates.is_company
            : existingShareholder.is_company,
          company,
          shareholder,
          client_id
        );

        return {
          message: "Shareholder updated successfully",
          company,
          shareholder,
          client_id
        };
      } catch (err) {
        request.log.error(err);
        reply.code(500).send({
          error: "Internal Server Error",
          message: err.message,
        });
      }
    },
  );

  // ========== CLIENT API ROUTES ==========
  
  // Get all clients
  fastify.get("/kyc/clients", async (request, reply) => {
    try {
      const clients = fastify.kycDb
        .prepare("SELECT * FROM clients")
        .all();

      return { clients };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get client by ID
  fastify.get("/kyc/clients/:id", async (request, reply) => {
    try {
      const { id } = request.params;

      const client = fastify.kycDb
        .prepare("SELECT * FROM clients WHERE id = ?")
        .get(id);

      if (!client) {
        return reply.code(404).send({ error: "Client not found" });
      }

      return { client };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Create a new client
  fastify.post("/kyc/clients", async (request, reply) => {
    try {
      const { name } = request.body;

      if (!name) {
        return reply.code(400).send({ error: "Client name is required" });
      }

      // Check if client already exists
      const existingClient = fastify.kycDb
        .prepare("SELECT id FROM clients WHERE name = ?")
        .get(name);

      if (existingClient) {
        return reply.code(409).send({ 
          error: "Client already exists",
          client_id: existingClient.id
        });
      }

      // Insert new client
      const result = fastify.kycDb
        .prepare("INSERT INTO clients (name) VALUES (?) RETURNING id")
        .get(name);
        
      // Create client folder structure if it doesn't exist
      const clientFolder = `${name}_${result.id}`;
      const folderPath = path.join("db/folders", clientFolder, "documents");
      
      try {
        await fs.mkdir(folderPath, { recursive: true });
      } catch (mkdirError) {
        request.log.error(`Error creating directory: ${mkdirError.message}`);
        // Continue even if folder creation fails
      }

      return {
        message: "Client created successfully",
        client_id: result.id,
        client_name: name
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Update client
  fastify.put("/kyc/clients/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const { name } = request.body;

      if (!name) {
        return reply.code(400).send({ error: "Client name is required" });
      }

      // Check if client exists
      const existingClient = fastify.kycDb
        .prepare("SELECT name FROM clients WHERE id = ?")
        .get(id);

      if (!existingClient) {
        return reply.code(404).send({ error: "Client not found" });
      }

      // Check if name is already taken by another client
      const nameExists = fastify.kycDb
        .prepare("SELECT id FROM clients WHERE name = ? AND id != ?")
        .get(name, id);

      if (nameExists) {
        return reply.code(409).send({ error: "Client name already in use" });
      }
      
      // Rename client folder if it exists
      const oldFolderName = `${existingClient.name}_${id}`;
      const newFolderName = `${name}_${id}`;
      
      const oldFolderPath = path.join("db/folders", oldFolderName);
      const newFolderPath = path.join("db/folders", newFolderName);
      
      try {
        if (existsSync(oldFolderPath)) {
          await fs.rename(oldFolderPath, newFolderPath);
          
          // Update file paths in database
          fastify.kycDb.prepare(`
            UPDATE document_sources 
            SET file_path = REPLACE(file_path, ?, ?) 
            WHERE client_id = ?
          `).run(oldFolderPath, newFolderPath, id);
        }
      } catch (fsErr) {
        request.log.error(`Error renaming client folder: ${fsErr.message}`);
        // Continue even if folder renaming fails
      }

      // Update client
      fastify.kycDb
        .prepare("UPDATE clients SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(name, id);

      return {
        message: "Client updated successfully",
        client_id: parseInt(id),
        client_name: name
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Get client documents folder structure
  fastify.get("/kyc/clients/:id/documents/structure", async (request, reply) => {
    try {
      const { id } = request.params;
      
      // Check if client exists
      const client = fastify.kycDb
        .prepare("SELECT name FROM clients WHERE id = ?")
        .get(id);
        
      if (!client) {
        return reply.code(404).send({ error: "Client not found" });
      }
      
      // Construct client folder path
      const clientFolder = `${client.name}_${id}`;
      const folderPath = path.join("db/folders", clientFolder, "documents");
      
      try {
        // Try to get directory structure
        const files = await fs.readdir(folderPath);
        
        return {
          client_id: parseInt(id),
          client_name: client.name,
          folder_path: folderPath,
          files: files
        };
      } catch (dirErr) {
        if (dirErr.code === 'ENOENT') {
          // Directory doesn't exist yet
          return {
            client_id: parseInt(id),
            client_name: client.name,
            folder_path: folderPath,
            files: [],
            message: "Document folder not yet created for this client"
          };
        }
        throw dirErr;
      }
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });

  // Upload document for a client
  fastify.post("/kyc/clients/:id/documents", async (request, reply) => {
    try {
      const { id } = request.params;
      
      // Check if client exists
      const client = fastify.kycDb
        .prepare("SELECT name FROM clients WHERE id = ?")
        .get(id);
        
      if (!client) {
        return reply.code(404).send({ error: "Client not found" });
      }
      
      // Check if data is uploaded
      if (!request.isMultipart()) {
        return reply.code(400).send({ error: "File upload must be multipart/form-data" });
      }
      
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: "No file uploaded" });
      }
      
      // Ensure the document type is provided
      const documentType = data.fields.document_type?.value;
      if (!documentType) {
        return reply.code(400).send({ error: "Document type is required" });
      }
      
      // Create client folder structure if it doesn't exist
      const clientFolder = `${client.name}_${id}`;
      const folderPath = path.join("db/folders", clientFolder, "documents");
      
      try {
        await fs.mkdir(folderPath, { recursive: true });
      } catch (mkdirError) {
        request.log.error(`Error creating directory: ${mkdirError.message}`);
        return reply.code(500).send({
          error: "Failed to create document directory",
          details: mkdirError.message,
        });
      }
      
      // Save the file
      const fileName = `${Date.now()}_${data.filename}`;
      const filePath = path.join(folderPath, fileName);
      
      try {
        await fs.writeFile(filePath, await data.toBuffer());
      } catch (fileError) {
        request.log.error(`Error saving file: ${fileError.message}`);
        return reply.code(500).send({
          error: "Failed to save file",
          details: fileError.message,
        });
      }
      
      // Store document metadata in database
      const insertStmt = fastify.kycDb.prepare(`
        INSERT INTO document_sources (
          client_id, document_name, document_type, file_path, extraction_date
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        RETURNING id
      `);
      
      const result = insertStmt.get(
        id,
        data.filename,
        documentType,
        filePath
      );
      
      return {
        message: "Document uploaded successfully",
        document_id: result.id,
        client_id: parseInt(id),
        document_name: data.filename,
        document_type: documentType,
        file_path: filePath
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  });
}

module.exports = kycRoutes;