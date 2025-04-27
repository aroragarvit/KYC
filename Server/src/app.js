const fastify = require("fastify")({ logger: true });
const path = require("path");
const Database = require("better-sqlite3");
const fastifyPlugin = require("fastify-plugin");

// Database plugin
const dbConnector = fastifyPlugin((fastify, options, done) => {
  try {
    const kycDb = new Database(path.join(__dirname, "../kyc_data.db"));

    // Make the database connection available
    fastify.decorate("kycDb", kycDb);

    fastify.addHook("onClose", (instance, done) => {

      if (instance.kycDb) {
        instance.kycDb.close();
      }
      done();
    });

    console.log("SQLite database connected successfully");
    console.log("KYC database connected successfully");
    done();
  } catch (err) {
    console.error("Error connecting to SQLite database:", err);
    done(err);
  }
});

// Register database connector
fastify.register(dbConnector);

// Register routes without prefixes
fastify.register(require("./routes/kyc_routes"));
fastify.register(require("./routes/messages"));
// Home route with API documentation
fastify.get("/", async (request, reply) => {
  return {
    message: "Server up and running",
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
