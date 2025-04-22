const path = require("path");
const fs = require("fs").promises;
const mammoth = require("mammoth");

async function kycRoutes(fastify, options) {
  // Get all individuals // used in workflow only
  fastify.get("/kyc/individuals", async (request, reply) => {
    try {
      const individuals = fastify.kycDb
        .prepare("SELECT * FROM individuals")
        .all();

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

      const individual = fastify.kycDb
        .prepare("SELECT * FROM individuals WHERE id = ?")
        .get(id);

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

      // Check if individual already exists by exact name match
      const existingIndividual = fastify.kycDb
        .prepare("SELECT id FROM individuals WHERE full_name = ?")
        .get(individual.full_name);

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
          WHERE id = ?
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
        );

        result = { id: existingIndividual.id };
        return {
          message: "Individual updated successfully",
          id: result.id,
        };
      } else {
        // Insert new individual
        const insertStmt = fastify.kycDb.prepare(`
          INSERT INTO individuals (
            full_name, alternative_names, id_numbers, id_types,
            nationalities, addresses, emails, phones, roles,
            shares_owned, price_per_share, discrepancies
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `);

        result = insertStmt.get(
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
      const companies = fastify.kycDb.prepare("SELECT * FROM companies").all();

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

      const company = fastify.kycDb
        .prepare("SELECT * FROM companies WHERE id = ?")
        .get(id);

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

      // Check if company already exists by exact name match
      const existingCompany = fastify.kycDb
        .prepare("SELECT id FROM companies WHERE company_name = ?")
        .get(company.company_name);

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
          WHERE id = ?
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
        );

        result = { id: existingCompany.id };
        return {
          message: "Company updated successfully",
          id: result.id,
        };
      } else {
        // Insert new company
        const insertStmt = fastify.kycDb.prepare(`
          INSERT INTO companies (
            company_name, registration_number, jurisdiction, address,
            directors, shareholders, company_activities, shares_issued,
            price_per_share, discrepancies
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `);

        result = insertStmt.get(
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
      const documents = fastify.kycDb
        .prepare(
          "SELECT id, document_name, document_type, file_path, extraction_date FROM document_sources",
        )
        .all();

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

      // Check if content is already stored in the database
      if (document.content) {
        return {
          document: {
            id: document.id,
            name: document.document_name,
            type: document.document_type,
          },
          content: document.content,
        };
      }

      // Content not stored, try to extract it
      try {
        let content = "";

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
      // This would normally trigger an asynchronous workflow
      // For simplicity, we'll return a success message
      return {
        message: "Document processing initiated",
        status: "processing",
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
        .prepare(
          "SELECT COUNT(*) as count FROM individuals WHERE discrepancies != '[]'",
        )
        .get().count;

      // Get companies with discrepancies
      const companiesWithDiscrepancies = fastify.kycDb
        .prepare(
          "SELECT COUNT(*) as count FROM companies WHERE discrepancies != '[]'",
        )
        .get().count;

      return {
        summary: {
          total_individuals: individualsCount,
          total_companies: companiesCount,
          total_documents: documentsCount,
          individuals_with_discrepancies: individualsWithDiscrepancies,
          companies_with_discrepancies: companiesWithDiscrepancies,
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

      const individual = fastify.kycDb
        .prepare("SELECT * FROM individuals WHERE full_name = ?")
        .get(name);

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

      const company = fastify.kycDb
        .prepare("SELECT * FROM companies WHERE company_name = ?")
        .get(name);

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
      const { company } = request.query;

      let query = "SELECT * FROM directors";
      let params = [];

      if (company) {
        query += " WHERE company_name = ?";
        params.push(company);
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

      const directorRecord = fastify.kycDb
        .prepare(
          "SELECT * FROM directors WHERE company_name = ? AND director_name = ?",
        )
        .get(company, director);

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

      // Check if company exists
      const companyExists = fastify.kycDb
        .prepare("SELECT 1 FROM companies WHERE company_name = ?")
        .get(company);

      if (!companyExists) {
        return reply.code(404).send({ error: "Company not found" });
      }

      const directors = fastify.kycDb
        .prepare("SELECT * FROM directors WHERE company_name = ?")
        .all(company);

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

      // Check if this director entry already exists
      const existingDirector = fastify.kycDb
        .prepare(
          "SELECT * FROM directors WHERE company_name = ? AND director_name = ?",
        )
        .get(director.company_name, director.director_name);

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
          `Updating existing director: ${director.director_name} for company ${director.company_name}`,
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
          WHERE company_name = ? AND director_name = ?
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
        );

        return {
          message: "Director updated successfully",
          company: director.company_name,
          director: director.director_name,
        };
      } else {
        // Log that we're creating a new entry
        request.log.info(
          `Creating new director: ${director.director_name} for company ${director.company_name}`,
        );

        // New director entry, perform insert
        const insertStmt = fastify.kycDb.prepare(`
          INSERT INTO directors (
            company_name, director_name,
            id_number, id_number_source,
            id_type, id_type_source,
            nationality, nationality_source,
            residential_address, residential_address_source,
            tel_number, tel_number_source,
            email_address, email_address_source,
            verification_status, kyc_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
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
          director.kyc_status || null,
        );

        return {
          message: "Director added successfully",
          company: director.company_name,
          director: director.director_name,
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
      const updates = request.body;

      // Check if this director exists
      const existingDirector = fastify.kycDb
        .prepare(
          "SELECT * FROM directors WHERE company_name = ? AND director_name = ?",
        )
        .get(company, director);

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
        WHERE company_name = ? AND director_name = ?
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
      );

      return {
        message: "Director updated successfully",
        company,
        director,
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
      const { company } = request.query;

      let query = "SELECT * FROM shareholders";
      let params = [];

      if (company) {
        query += " WHERE company_name = ?";
        params.push(company);
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

        const shareholderRecord = fastify.kycDb
          .prepare(
            "SELECT * FROM shareholders WHERE company_name = ? AND shareholder_name = ?",
          )
          .get(company, shareholder);

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

        // Check if company exists
        const companyExists = fastify.kycDb
          .prepare("SELECT 1 FROM companies WHERE company_name = ?")
          .get(company);

        if (!companyExists) {
          return reply.code(404).send({ error: "Company not found" });
        }

        const shareholders = fastify.kycDb
          .prepare("SELECT * FROM shareholders WHERE company_name = ?")
          .all(company);

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

      // Check if company exists by ID
      const company = fastify.kycDb
        .prepare("SELECT company_name FROM companies WHERE id = ?")
        .get(id);

      if (!company) {
        return reply.code(404).send({ error: "Company not found" });
      }

      // Get shareholders by company ID through company name
      const shareholders = fastify.kycDb
        .prepare("SELECT * FROM shareholders WHERE company_name = ?")
        .all(company.company_name);

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

      // Check if company exists by ID
      const company = fastify.kycDb
        .prepare("SELECT company_name FROM companies WHERE id = ?")
        .get(id);

      if (!company) {
        return reply.code(404).send({ error: "Company not found" });
      }

      // Get directors by company ID through company name
      const directors = fastify.kycDb
        .prepare("SELECT * FROM directors WHERE company_name = ?")
        .all(company.company_name);

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

      // Check if this shareholder entry already exists
      const existingShareholder = fastify.kycDb
        .prepare(
          "SELECT * FROM shareholders WHERE company_name = ? AND shareholder_name = ?",
        )
        .get(shareholder.company_name, shareholder.shareholder_name);

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
          `Updating existing shareholder: ${shareholder.shareholder_name} for company ${shareholder.company_name}`,
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
          WHERE company_name = ? AND shareholder_name = ?
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
        );

        return {
          message: "Shareholder updated successfully",
          company: shareholder.company_name,
          shareholder: shareholder.shareholder_name,
        };
      } else {
        // Log that we're creating a new entry
        request.log.info(
          `Creating new shareholder: ${shareholder.shareholder_name} for company ${shareholder.company_name}`,
        );

        // New shareholder entry, perform insert
        const insertStmt = fastify.kycDb.prepare(`
          INSERT INTO shareholders (
            company_name, shareholder_name,
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
          shareholder.is_company || 0,
        );

        return {
          message: "Shareholder added successfully",
          company: shareholder.company_name,
          shareholder: shareholder.shareholder_name,
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
        const updates = request.body;

        // Check if this shareholder exists
        const existingShareholder = fastify.kycDb
          .prepare(
            "SELECT * FROM shareholders WHERE company_name = ? AND shareholder_name = ?",
          )
          .get(company, shareholder);

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
        WHERE company_name = ? AND shareholder_name = ?
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
        );

        return {
          message: "Shareholder updated successfully",
          company,
          shareholder,
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
}

module.exports = kycRoutes;
