const path = require("path");
const fs = require("fs").promises;
const mammoth = require("mammoth");

async function documentRoutes(fastify, options) {
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
      const documents = fastify.db.prepare("SELECT id, name FROM documents").all();
      return { documents };
    } catch (err) {
      request.log.error(err);
      reply
        .code(500)
        .send({ error: "Internal Server Error", message: err.message });
    }
  });
}

module.exports = documentRoutes;
