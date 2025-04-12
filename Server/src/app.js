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

// Register database connector first
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
    ],
  };
});

module.exports = fastify;
