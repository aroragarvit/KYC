const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

function initializeKycDatabase() {
  try {
    // Create the database
    const db = new Database(path.join(__dirname, "../../kyc_data.db"));

    // Drop existing tables if they exist
    db.exec(`DROP TABLE IF EXISTS individuals`);
    db.exec(`DROP TABLE IF EXISTS companies`);
    db.exec(`DROP TABLE IF EXISTS document_sources`);

    // Create individuals table (with text fields for flexibility)
    db.exec(`
      CREATE TABLE IF NOT EXISTS individuals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        alternative_names TEXT, /* JSON array of alternative names */
        id_numbers TEXT, /* JSON object with sources */
        id_types TEXT, /* JSON object with sources */
        nationalities TEXT, /* JSON object with sources */
        addresses TEXT, /* JSON object with sources */
        emails TEXT, /* JSON object with sources */
        phones TEXT, /* JSON object with sources */
        roles TEXT, /* JSON object with roles and companies */
        shares_owned TEXT, /* JSON object with company and share info */
        price_per_share TEXT, /* JSON object with values and sources */
        discrepancies TEXT, /* JSON array of discrepancies */
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create companies table (with text fields for flexibility)
    db.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        registration_number TEXT, /* JSON object with values and sources */
        jurisdiction TEXT, /* JSON object with values and sources */
        address TEXT, /* JSON object with values and sources */
        corporate_roles TEXT, /* JSON object with roles */
        directors TEXT, /* JSON array of director references */
        shareholders TEXT, /* JSON array of shareholder references */
        ownership_information TEXT, /* JSON object with ownership details */
        price_per_share TEXT, /* JSON object with values and sources */
        discrepancies TEXT, /* JSON array of discrepancies */
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create document sources table
    db.exec(`
      CREATE TABLE IF NOT EXISTS document_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_name TEXT NOT NULL,
        document_type TEXT, /* Will be determined by AI analysis */
        file_path TEXT,
        content TEXT,
        extraction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("KYC database tables created successfully.");

    // Path to the Docs folder
    const docsDir = path.join(__dirname, "../../Docs");

    // Check if Docs directory exists
    if (!fs.existsSync(docsDir)) {
      console.error("Error: Docs folder not found at:", docsDir);
      return;
    }

    // Scan the directory to list all available files
    console.log("\nScanning Docs folder for files...");
    const filesInDocsFolder = fs.readdirSync(docsDir);
    
    // Insert document sources - initially with NULL document_type
    const insertDocument = db.prepare(
      "INSERT INTO document_sources (document_name, document_type, file_path) VALUES (?, NULL, ?) RETURNING id"
    );

    let addedDocs = 0;
    filesInDocsFolder.forEach((fileName) => {
      const filePath = path.join(docsDir, fileName);
      
      // Only add if it's a file
      if (fs.statSync(filePath).isFile()) {
        const documentId = insertDocument.get(fileName, filePath).id;
        console.log(`Added document to database: ${fileName} (ID: ${documentId})`);
        addedDocs++;
      }
    });

    console.log(`\nAdded ${addedDocs} documents to the KYC database.`);
    console.log("\nKYC database initialization complete.");
    db.close();

  } catch (err) {
    console.error("KYC Database initialization error:", err);
  }
}

// Run initialization when this script is executed directly
if (require.main === module) {
  initializeKycDatabase();
}

module.exports = { initializeKycDatabase };