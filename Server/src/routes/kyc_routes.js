const path = require("path");
const fs = require("fs").promises;
const mammoth = require("mammoth");

async function kycRoutes(fastify, options) {
  // Get all individuals
  fastify.get("/kyc/individuals", async (request, reply) => {
    try {
      const individuals = fastify.kycDb
        .prepare("SELECT * FROM individuals")
        .all();
      
      // Process to convert JSON strings to objects
      const processedIndividuals = individuals.map(individual => {
        return {
          ...individual,
          alternative_names: JSON.parse(individual.alternative_names || '[]'),
          id_numbers: JSON.parse(individual.id_numbers || '{}'),
          id_types: JSON.parse(individual.id_types || '{}'),
          nationalities: JSON.parse(individual.nationalities || '{}'),
          addresses: JSON.parse(individual.addresses || '{}'),
          emails: JSON.parse(individual.emails || '{}'),
          phones: JSON.parse(individual.phones || '{}'),
          roles: JSON.parse(individual.roles || '{}'),
          shares_owned: JSON.parse(individual.shares_owned || '{}'),
          price_per_share: JSON.parse(individual.price_per_share || '{}'),
          discrepancies: JSON.parse(individual.discrepancies || '[]')
        };
      });
      
      return { individuals: processedIndividuals };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
      });
    }
  });

  // Get specific individual by ID
  fastify.get("/kyc/individuals/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      
      const individual = fastify.kycDb
        .prepare("SELECT * FROM individuals WHERE id = ?")
        .get(id);
      
      if (!individual) {
        return reply.code(404).send({ error: "Individual not found" });
      }
      
      // Process to convert JSON strings to objects
      const processedIndividual = {
        ...individual,
        alternative_names: JSON.parse(individual.alternative_names || '[]'),
        id_numbers: JSON.parse(individual.id_numbers || '{}'),
        id_types: JSON.parse(individual.id_types || '{}'),
        nationalities: JSON.parse(individual.nationalities || '{}'),
        addresses: JSON.parse(individual.addresses || '{}'),
        emails: JSON.parse(individual.emails || '{}'),
        phones: JSON.parse(individual.phones || '{}'),
        roles: JSON.parse(individual.roles || '{}'),
        shares_owned: JSON.parse(individual.shares_owned || '{}'),
        price_per_share: JSON.parse(individual.price_per_share || '{}'),
        discrepancies: JSON.parse(individual.discrepancies || '[]')
      };
      
      return { individual: processedIndividual };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
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
      
      // Convert objects to JSON strings
      const dataToStore = {
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
        discrepancies: JSON.stringify(individual.discrepancies || [])
      };
      
      const stmt = fastify.kycDb.prepare(`
        INSERT INTO individuals (
          full_name, alternative_names, id_numbers, id_types, nationalities,
          addresses, emails, phones, roles, shares_owned, price_per_share, discrepancies
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `);
      
      const result = stmt.get(
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
        dataToStore.discrepancies
      );
      
      return {
        message: "Individual stored successfully",
        id: result.id
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
      });
    }
  });

  // Get all companies
  fastify.get("/kyc/companies", async (request, reply) => {
    try {
      const companies = fastify.kycDb
        .prepare("SELECT * FROM companies")
        .all();
      
      // Process to convert JSON strings to objects
      const processedCompanies = companies.map(company => {
        return {
          ...company,
          registration_number: JSON.parse(company.registration_number || '{}'),
          jurisdiction: JSON.parse(company.jurisdiction || '{}'),
          address: JSON.parse(company.address || '{}'),
          directors: JSON.parse(company.directors || '[]'),
          shareholders: JSON.parse(company.shareholders || '[]'),
          company_activities: JSON.parse(company.company_activities || '{}'),
          shares_issued: JSON.parse(company.shares_issued || '{}'),
          price_per_share: JSON.parse(company.price_per_share || '{}'),
          discrepancies: JSON.parse(company.discrepancies || '[]')
        };
      });
      
      return { companies: processedCompanies };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
      });
    }
  });

  // Get specific company by ID
  fastify.get("/kyc/companies/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      
      const company = fastify.kycDb
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(id);
      
      if (!company) {
        return reply.code(404).send({ error: "Company not found" });
      }
      
      // Process to convert JSON strings to objects
      const processedCompany = {
        ...company,
        registration_number: JSON.parse(company.registration_number || '{}'),
        jurisdiction: JSON.parse(company.jurisdiction || '{}'),
        address: JSON.parse(company.address || '{}'),
        directors: JSON.parse(company.directors || '[]'),
        shareholders: JSON.parse(company.shareholders || '[]'),
        company_activities: JSON.parse(company.company_activities || '{}'),
        shares_issued: JSON.parse(company.shares_issued || '{}'),
        price_per_share: JSON.parse(company.price_per_share || '{}'),
        discrepancies: JSON.parse(company.discrepancies || '[]')
      };
      
      return { company: processedCompany };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
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
      
      // Convert objects to JSON strings
      const dataToStore = {
        company_name: company.company_name,
        registration_number: JSON.stringify(company.registration_number || {}),
        jurisdiction: JSON.stringify(company.jurisdiction || {}),
        address: JSON.stringify(company.address || {}),
        directors: JSON.stringify(company.directors || []),
        shareholders: JSON.stringify(company.shareholders || []),
        company_activities: JSON.stringify(company.company_activities || {}),
        shares_issued: JSON.stringify(company.shares_issued || {}),
        price_per_share: JSON.stringify(company.price_per_share || {}),
        discrepancies: JSON.stringify(company.discrepancies || [])
      };
      
      const stmt = fastify.kycDb.prepare(`
        INSERT INTO companies (
          company_name, registration_number, jurisdiction, address,
          directors, shareholders, company_activities, shares_issued,
          price_per_share, discrepancies
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `);
      
      const result = stmt.get(
        dataToStore.company_name,
        dataToStore.registration_number,
        dataToStore.jurisdiction,
        dataToStore.address,
        dataToStore.directors,
        dataToStore.shareholders,
        dataToStore.company_activities,
        dataToStore.shares_issued,
        dataToStore.price_per_share,
        dataToStore.discrepancies
      );
      
      return {
        message: "Company stored successfully",
        id: result.id
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
      });
    }
  });

  // Get document sources
  fastify.get("/kyc/documents", async (request, reply) => {
    try {
      const documents = fastify.kycDb
        .prepare("SELECT id, document_name, document_type, file_path, extraction_date FROM document_sources")
        .all();
        
      return { documents };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
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
      
      // Check if content is already stored in the database
      if (document.content) {
        return {
          document: {
            id: document.id,
            name: document.document_name,
            type: document.document_type
          },
          content: document.content
        };
      }
      
      // Content not stored, try to extract it
      try {
        let content = "";
        
        if (document.file_path.toLowerCase().endsWith('.docx')) {
          // Extract content using mammoth
          const result = await mammoth.extractRawText({
            path: document.file_path
          });
          content = result.value;
        } else if (document.file_path.toLowerCase().endsWith('.pdf')) {
          // For PDF extraction you would need a PDF library
          // This is a placeholder
          content = "PDF content extraction not implemented";
        } else {
          // Try to read as text
          content = await fs.readFile(document.file_path, 'utf-8');
        }
        
        // Store the content in the database for future use
        fastify.kycDb
          .prepare("UPDATE document_sources SET content = ? WHERE id = ?")
          .run(content, id);
        
        return {
          document: {
            id: document.id,
            name: document.document_name,
            type: document.document_type
          },
          content
        };
      } catch (readErr) {
        request.log.error(`Error reading document: ${readErr.message}`);
        return reply.code(500).send({ 
          error: "Failed to read document content", 
          details: readErr.message 
        });
      }
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
      });
    }
  });

  // Endpoint to trigger document processing
  fastify.post("/kyc/process-documents", async (request, reply) => {
    try {
      // This would normally trigger an asynchronous workflow
      // For simplicity, we'll return a success message
      return {
        message: "Document processing initiated",
        status: "processing"
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
      });
    }
  });

  // Generate summary report
  fastify.get("/kyc/summary", async (request, reply) => {
    try {
      const individualsCount = fastify.kycDb
        .prepare("SELECT COUNT(*) as count FROM individuals")
        .get().count;
        
      const companiesCount = fastify.kycDb
        .prepare("SELECT COUNT(*) as count FROM companies")
        .get().count;
        
      const documentsCount = fastify.kycDb
        .prepare("SELECT COUNT(*) as count FROM document_sources")
        .get().count;
      
      // Get individuals with discrepancies
      const individualsWithDiscrepancies = fastify.kycDb
        .prepare("SELECT COUNT(*) as count FROM individuals WHERE discrepancies != '[]'")
        .get().count;
        
      // Get companies with discrepancies
      const companiesWithDiscrepancies = fastify.kycDb
        .prepare("SELECT COUNT(*) as count FROM companies WHERE discrepancies != '[]'")
        .get().count;
        
      return {
        summary: {
          total_individuals: individualsCount,
          total_companies: companiesCount,
          total_documents: documentsCount,
          individuals_with_discrepancies: individualsWithDiscrepancies,
          companies_with_discrepancies: companiesWithDiscrepancies
        }
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
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
          document_type
        }
      };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
      });
    }
  });

  // Get individual by name
  fastify.get("/kyc/individuals/by-name/:name", async (request, reply) => {
    try {
      const { name } = request.params;
      
      const individual = fastify.kycDb
        .prepare("SELECT * FROM individuals WHERE full_name = ?")
        .get(name);
      
      if (!individual) {
        return reply.code(404).send({ error: "Individual not found" });
      }
      
      // Process to convert JSON strings to objects
      const processedIndividual = {
        ...individual,
        alternative_names: JSON.parse(individual.alternative_names || '[]'),
        id_numbers: JSON.parse(individual.id_numbers || '{}'),
        id_types: JSON.parse(individual.id_types || '{}'),
        nationalities: JSON.parse(individual.nationalities || '{}'),
        addresses: JSON.parse(individual.addresses || '{}'),
        emails: JSON.parse(individual.emails || '{}'),
        phones: JSON.parse(individual.phones || '{}'),
        roles: JSON.parse(individual.roles || '{}'),
        shares_owned: JSON.parse(individual.shares_owned || '{}'),
        price_per_share: JSON.parse(individual.price_per_share || '{}'),
        discrepancies: JSON.parse(individual.discrepancies || '[]')
      };
      
      return { individual: processedIndividual };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
      });
    }
  });

  // Get company by name
  fastify.get("/kyc/companies/by-name/:name", async (request, reply) => {
    try {
      const { name } = request.params;
      
      const company = fastify.kycDb
        .prepare("SELECT * FROM companies WHERE company_name = ?")
        .get(name);
      
      if (!company) {
        return reply.code(404).send({ error: "Company not found" });
      }
      
      // Process to convert JSON strings to objects
      const processedCompany = {
        ...company,
        registration_number: JSON.parse(company.registration_number || '{}'),
        jurisdiction: JSON.parse(company.jurisdiction || '{}'),
        address: JSON.parse(company.address || '{}'),
        directors: JSON.parse(company.directors || '[]'),
        shareholders: JSON.parse(company.shareholders || '[]'),
        company_activities: JSON.parse(company.company_activities || '{}'),
        shares_issued: JSON.parse(company.shares_issued || '{}'),
        price_per_share: JSON.parse(company.price_per_share || '{}'),
        discrepancies: JSON.parse(company.discrepancies || '[]')
      };
      
      return { company: processedCompany };
    } catch (err) {
      request.log.error(err);
      reply.code(500).send({ 
        error: "Internal Server Error", 
        message: err.message 
      });
    }
  });
}

module.exports = kycRoutes;