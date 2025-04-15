const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

function initializeDatabase() {
  try {
    // Create the database
    const db = new Database(path.join(__dirname, "../../company_docs.db"));

    // Drop existing tables if they exist
    db.exec(`DROP TABLE IF EXISTS company_documents`);
    db.exec(`DROP TABLE IF EXISTS documents`);
    db.exec(`DROP TABLE IF EXISTS directors`);
    db.exec(`DROP TABLE IF EXISTS companies`);

    // Create tables with proper IDs
    db.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        kyc_status TEXT DEFAULT 'pending'
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        file_path TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS company_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        document_id INTEGER NOT NULL,
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
        UNIQUE(company_id, document_id)
      );
    `);

    // Create directors table for storing extracted information
    db.exec(`
      CREATE TABLE IF NOT EXISTS directors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        full_name TEXT, /* Stores primary value; actual values stored in full_name_values */
        id_number TEXT,
        id_type TEXT,
        nationality TEXT,
        residential_address TEXT,
        telephone_number TEXT,
        email_address TEXT,
        /* Source fields store JSON arrays that include document categorization */
        full_name_source TEXT, /* JSON array with documentId, documentName, value, documentCategory */
        id_number_source TEXT,
        id_type_source TEXT,
        nationality_source TEXT,
        residential_address_source TEXT,
        telephone_number_source TEXT,
        email_address_source TEXT,
        /* Fields to store array of all values */
        full_name_values TEXT, /* JSON array of all values found */
        id_number_values TEXT,
        id_type_values TEXT,
        nationality_values TEXT,
        residential_address_values TEXT,
        telephone_number_values TEXT,
        email_address_values TEXT,
        discrepancies TEXT,
        verification_Status TEXT DEFAULT 'pending', /* Can be: verified, notverified, pending */
        KYC_Status TEXT, /* Stores fields with discrepancies or incomplete fields as JSON */
        FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
        UNIQUE(company_id, full_name)
      );
    `);

    // Insert Truffles company
    const insertCompany = db.prepare(
      "INSERT INTO companies (name) VALUES (?) RETURNING id",
    );
    const trufflesCompanyId = insertCompany.get("Truffles").id;

    // Path to the Docs folder
    const docsDir = path.join(__dirname, "../../Docs");

    // Check if Docs directory exists
    if (!fs.existsSync(docsDir)) {
      console.error("Error: Docs folder not found at:", docsDir);
      return;
    }

    // UPDATED document names with correct "AI" instead of "AL"
    const documentNames = [
      "Director Appointment Truffles AI.docx",
      "Director Registry Truffles AI.docx",
      "John Doe Full.docx",
      "John Doe Passport Full.docx",
      "Proof of Address John Doe (3).docx",
      "Truffles AI Holdings Company Profile.docx",
      "Truffles AI Shareholder Registry.docx",
    ];

    // Let's also scan the directory to list all available .docx files
    console.log("\nScanning Docs folder for .docx files...");
    const filesInDocsFolder = fs.readdirSync(docsDir);
    const docxFilesFound = filesInDocsFolder.filter((file) =>
      file.toLowerCase().endsWith(".docx"),
    );

    console.log(`Found ${docxFilesFound.length} .docx files in Docs folder:`);
    docxFilesFound.forEach((file) => console.log(`- ${file}`));

    // Insert documents that exist and link to company
    const insertDocument = db.prepare(
      "INSERT INTO documents (name, file_path) VALUES (?, ?) RETURNING id",
    );
    const linkDocToCompany = db.prepare(
      "INSERT INTO company_documents (company_id, document_id) VALUES (?, ?)",
    );

    let foundDocs = 0;
    let missingDocs = [];

    documentNames.forEach((docName) => {
      const filePath = path.join(docsDir, docName);

      // Only add documents that exist
      if (fs.existsSync(filePath)) {
        // Insert document reference to database
        const documentId = insertDocument.get(docName, filePath).id;

        // Link document to Truffles company
        linkDocToCompany.run(trufflesCompanyId, documentId);
        console.log(
          `Added document to database: ${docName} (ID: ${documentId})`,
        );
        foundDocs++;
      } else {
        missingDocs.push(docName);
      }
    });

    console.log(`\nAdded ${foundDocs} documents to the database.`);

    if (missingDocs.length > 0) {
      console.log(
        `Warning: The following documents were not found in the Docs folder:`,
      );
      missingDocs.forEach((doc) => console.log(`- ${doc}`));
      console.log("\nPossible reasons:");
      console.log("1. File name mismatch (check capitalization and spaces)");
      console.log("2. Files are not in the expected Docs folder");
      console.log("3. Files do not exist");
    }

    // Also add any .docx files found in the folder but not in our list
    const extraDocxFiles = docxFilesFound.filter(
      (file) => !documentNames.includes(file),
    );

    if (extraDocxFiles.length > 0) {
      console.log(
        `\nAdding ${extraDocxFiles.length} additional .docx files found in the folder:`,
      );

      extraDocxFiles.forEach((docName) => {
        const filePath = path.join(docsDir, docName);

        // Insert document reference to database
        const documentId = insertDocument.get(docName, filePath).id;

        // Link document to Truffles company
        linkDocToCompany.run(trufflesCompanyId, documentId);
        console.log(`- Added: ${docName} (ID: ${documentId})`);
      });
    }

    console.log("\nAvailable API endpoints:");
    console.log(
      `- Get all documents: curl http://localhost:3000/companies/Truffles/documents`,
    );
    console.log(
      `- Read document content: curl http://localhost:3000/documents/read?id=DOCUMENT_ID`,
    );
    console.log(`\nExample to read a document:`);
    if (docxFilesFound.length > 0) {
      console.log(`curl "http://localhost:3000/documents/read?id=1"`);
    }

    db.close();
  } catch (err) {
    console.error("Database initialization error:", err);
  }
}

// Run migration when this script is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
