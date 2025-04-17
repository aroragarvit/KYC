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

// Register database connector
fastify.register(dbConnector);

// Register routes without prefixes
fastify.register(require("./routes/documents"));

// Home route with API documentation
fastify.get("/", async (request, reply) => {
  return {
    message: "Document Reader API",
    endpoints: [
      // Company endpoints
      {
        path: "/companies",
        method: "GET",
        description: "Get all companies",
      },
      {
        path: "/companies/:id",
        method: "GET",
        description: "Get company information by ID",
        example: "/companies/1",
      },
      {
        path: "/companies/:id/kyc-status",
        method: "PATCH",
        description: "Update company KYC status",
        example: "/companies/1/kyc-status",
      },
      
      // Document endpoints
      {
        path: "/companies/:name/documents",
        method: "GET",
        description: "Get all documents for a company by company name",
        example: "/companies/Truffles/documents",
      },
      {
        path: "/companies/:id/documents",
        method: "GET",
        description: "Get all documents for a company by company ID",
        example: "/companies/1/documents",
      },
      {
        path: "/documents/:id",
        method: "GET",
        description: "Get document information by ID",
        example: "/documents/1",
      },
      {
        path: "/documents/read",
        method: "GET",
        description: "Read the content of a document by its ID or name",
        example: "/documents/read?id=1",
      },
      {
        path: "/download",
        method: "GET",
        description: "Download a document file",
        example: "/download?path=/path/to/file&filename=document.docx",
      },
      {
        path: "/documents",
        method: "GET",
        description: "List all available documents",
      },
      
      // Director endpoints
      {
        path: "/companies/:name/directors",
        method: "GET",
        description: "Get all directors for a company by name",
        example: "/companies/Truffles/directors",
      },
      {
        path: "/companies/:id/directors",
        method: "GET",
        description: "Get all directors for a company by ID",
        example: "/companies/1/directors",
      },
      {
        path: "/companies/:name/directors",
        method: "POST",
        description: "Save director information for a company by name",
        example: "/companies/Truffles/directors",
      },
      {
        path: "/companies/:id/directors",
        method: "POST",
        description: "Save director information for a company by ID",
        example: "/companies/1/directors",
      },
      {
        path: "/directors/:id/verification",
        method: "PATCH",
        description: "Update director verification status",
        example: "/directors/1/verification",
      },
      
      // Shareholder endpoints
      {
        path: "/companies/:name/shareholders",
        method: "GET",
        description: "Get all shareholders for a company",
        example: "/companies/Truffles/shareholders",
      },
      {
        path: "/companies/:name/shareholders",
        method: "POST",
        description: "Add a new shareholder to a company",
        example: "/companies/Truffles/shareholders",
      },
      {
        path: "/companies/:name/shareholders",
        method: "DELETE",
        description: "Delete all shareholders for a company",
        example: "/companies/Truffles/shareholders",
      },
      {
        path: "/shareholders/:id",
        method: "GET",
        description: "Get shareholder information by ID",
        example: "/shareholders/1",
      },
      {
        path: "/shareholders/:id",
        method: "PATCH",
        description: "Update shareholder information",
        example: "/shareholders/1",
      },
      {
        path: "/shareholders/:id/verification",
        method: "PATCH",
        description: "Update shareholder verification status",
        example: "/shareholders/1/verification",
      },
      {
        path: "/shareholders/:id",
        method: "DELETE",
        description: "Delete a shareholder",
        example: "/shareholders/1",
      },
    ],
  };
});

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  // Log the error
  fastify.log.error({
    url: request.raw.url,
    method: request.raw.method,
    message: error.message,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode || 500
  }, "Request error");

  // Respond with appropriate error
  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal Server Error' : error.message,
    statusCode,
    // Only include stack trace in development
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// Set up a catch-all 404 route
fastify.setNotFoundHandler((request, reply) => {
  fastify.log.info({ url: request.raw.url }, "Route not found");
  reply.status(404).send({ error: 'Route not found', statusCode: 404 });
});

module.exports = fastify;
