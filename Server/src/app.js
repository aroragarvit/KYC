const fastify = require("fastify")({ logger: true });
const path = require("path");
const Database = require("better-sqlite3");
const fastifyPlugin = require("fastify-plugin");

// Database plugin
const dbConnector = fastifyPlugin((fastify, options, done) => {
  try {
    const db = new Database(path.join(__dirname, "../company_docs.db"));

    // Make the database connection available
    fastify.decorate("db", db);

    fastify.addHook("onClose", (instance, done) => {
      if (instance.db) {
        instance.db.close();
      }
      done();
    });

    console.log("SQLite database connected successfully");
    done();
  } catch (err) {
    console.error("Error connecting to SQLite database:", err);
    done(err);
  }
});

fastify.register(dbConnector);

// Then register routes
fastify.register(require("./routes/documents"));
// Home route with API documentation
fastify.get("/", async (request, reply) => {
  return {
    message: "Document Reader API",
    endpoints: [
      {
        path: "/companies/:name/documents",
        method: "GET",
        description: "Get all documents for a company by company name",
        example: "/companies/Truffles/documents",
      },
      {
        path: "/documents/:id",
        method: "GET",
        description: "Get document information by ID",
        example: "/documents/1",
      },
      {
        path: "/documents/read?id=:documentId",
        method: "GET",
        description: "Read the content of a document by its ID",
        example: "/documents/read?id=1",
      },
      {
        path: "/documents/read?name=:documentName",
        method: "GET",
        description: "Read the content of a document by its name (legacy support)",
        example: "/documents/read?name=Director%20Appointment%20Truffles%20AI.docx",
      },
      {
        path: "/documents",
        method: "GET",
        description: "List all available documents",
      },
      {
        path: "/companies/:name/directors",
        method: "GET",
        description: "Get all directors for a company",
        example: "/companies/Truffles/directors",
      },
      {
        path: "/companies/:name/directors",
        method: "POST",
        description: "Save director information for a company",
        example: "/companies/Truffles/directors",
        body: {
          full_name: "John Doe",
          id_number: "S1234567D",
          id_type: "Passport",
          nationality: "Singapore",
          residential_address: "123 Main St, Singapore",
          telephone_number: "+65 1234 5678",
          email_address: "john.doe@example.com",
          full_name_source: "Document ID 1",
          id_number_source: "Document ID 2",
          id_type_source: "Document ID 2",
          nationality_source: "Document ID 1",
          residential_address_source: "Document ID 3",
          telephone_number_source: "Document ID 1",
          email_address_source: "Document ID 1",
          discrepancies: "None"
        }
      },
      {
        path: "/run-workflow",
        method: "POST",
        description: "Run the director extraction workflow for a company",
        example: "/run-workflow",
        body: {
          name: "Truffles"
        }
      }
    ],
  };
});

module.exports = fastify;
