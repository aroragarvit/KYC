const app = require("./src/app");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// Run the server
const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
