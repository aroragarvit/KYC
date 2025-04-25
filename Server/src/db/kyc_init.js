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
    db.exec(`DROP TABLE IF EXISTS directors`);
    db.exec(`DROP TABLE IF EXISTS shareholders`);
    db.exec(`DROP TABLE IF EXISTS clients`);
    db.exec(`DROP TABLE IF EXISTS messages`);

    // Create clients table
    db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create individuals table (with text fields for flexibility)
    db.exec(`
      CREATE TABLE IF NOT EXISTS individuals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );
    `);

    // Create companies table (with text fields for flexibility)
    db.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        company_name TEXT NOT NULL,
        registration_number TEXT, /* JSON object with values and sources */
        jurisdiction TEXT, /* JSON object with values and sources */
        address TEXT, /* JSON object with values and sources */
        directors TEXT, /* JSON array of director references */
        shareholders TEXT, /* JSON array of shareholder references */
        company_activities TEXT, /* JSON object with activities */
        shares_issued TEXT, /* JSON object with values and sources */
        price_per_share TEXT, /* JSON object with values and sources */
        discrepancies TEXT, /* JSON array of discrepancies */
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );
    `);

    // Create document sources table
    db.exec(`
      CREATE TABLE IF NOT EXISTS document_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        document_name TEXT NOT NULL,
        document_type TEXT, /* Will be determined by AI analysis */
        file_path TEXT,
        content TEXT,
        extraction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );
    `);

    // Create directors table with composite primary key
    db.exec(`
      CREATE TABLE IF NOT EXISTS directors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        company_name TEXT NOT NULL,
        director_name TEXT NOT NULL,
        id_number TEXT,
        id_number_source TEXT, /* JSON with document id, name, type */
        id_type TEXT,
        id_type_source TEXT, /* JSON with document id, name, type */
        nationality TEXT,
        nationality_source TEXT, /* JSON with document id, name, type */
        residential_address TEXT,
        residential_address_source TEXT, /* JSON with document id, name, type */
        tel_number TEXT,
        tel_number_source TEXT, /* JSON with document id, name, type */
        email_address TEXT,
        email_address_source TEXT, /* JSON with document id, name, type */
        verification_status TEXT DEFAULT 'pending',
        kyc_status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        UNIQUE(client_id, company_name, director_name)
      );
    `);

    // Create shareholders table with composite primary key
    db.exec(`
      CREATE TABLE IF NOT EXISTS shareholders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        company_name TEXT NOT NULL,
        shareholder_name TEXT NOT NULL,
        shares_owned TEXT,
        shares_owned_source TEXT, /* JSON with document id, name, type */
        price_per_share TEXT,
        price_per_share_source TEXT, /* JSON with document id, name, type */
        id_number TEXT,
        id_number_source TEXT, /* JSON with document id, name, type */
        id_type TEXT,
        id_type_source TEXT, /* JSON with document id, name, type */
        nationality TEXT,
        nationality_source TEXT, /* JSON with document id, name, type */
        address TEXT,
        address_source TEXT, /* JSON with document id, name, type */
        tel_number TEXT,
        tel_number_source TEXT, /* JSON with document id, name, type */
        email_address TEXT,
        email_address_source TEXT, /* JSON with document id, name, type */
        verification_status TEXT DEFAULT 'pending',
        kyc_status TEXT,
        is_company INTEGER DEFAULT 0, /* 0 for individual, 1 for company */
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        UNIQUE(client_id, company_name, shareholder_name)
      );
    `);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        message_type TEXT NOT NULL CHECK(message_type IN ('agent', 'user')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );
    `);

    // Create indexes for faster lookups
    db.exec(`
      CREATE INDEX idx_individuals_client_id ON individuals(client_id);
      CREATE INDEX idx_companies_client_id ON companies(client_id);
      CREATE INDEX idx_document_sources_client_id ON document_sources(client_id);
      CREATE INDEX idx_directors_client_id ON directors(client_id);
      CREATE INDEX idx_shareholders_client_id ON shareholders(client_id);
      
      CREATE INDEX idx_individuals_name_client ON individuals(full_name, client_id);
      CREATE INDEX idx_companies_name_client ON companies(company_name, client_id);
    `);

    console.log("KYC database tables created successfully.");

    // Path to the Docs folder
    const docsDir = path.join(__dirname, "../../Docs");

    // Check if Docs directory exists
    if (!fs.existsSync(docsDir)) {
      console.error("Error: Docs folder not found at:", docsDir);
      return;
    }

    // Create database folder structure
    const dbFoldersPath = path.join(__dirname, "../../db/folders");
    if (!fs.existsSync(dbFoldersPath)) {
      fs.mkdirSync(dbFoldersPath, { recursive: true });
    }

    // Scan the Docs directory to look for client folders
    console.log("\nScanning Docs folder for client folders...");
    const items = fs.readdirSync(docsDir);
    
    // Insert client statement
    const insertClient = db.prepare(
      "INSERT INTO clients (name) VALUES (?) RETURNING id"
    );
    
    // Insert document sources statement
    const insertDocument = db.prepare(
      "INSERT INTO document_sources (client_id, document_name, document_type, file_path) VALUES (?, ?, NULL, ?) RETURNING id"
    );

    let clientsAdded = 0;
    let totalDocumentsAdded = 0;

    // Process each item in the Docs directory
    for (const item of items) {
      const itemPath = path.join(docsDir, item);
      
      // Check if it's a directory (client folder)
      if (fs.statSync(itemPath).isDirectory()) {
        // Create a client entry
        const clientId = insertClient.get(item).id;
        clientsAdded++;
        console.log(`\nFound client folder: ${item} - Created client ID: ${clientId}`);
        
        // Create client folder in db/folders
        const clientFolderPath = path.join(dbFoldersPath, `${item}_${clientId}`);
        const documentsPath = path.join(clientFolderPath, "documents");
        
        if (!fs.existsSync(documentsPath)) {
          fs.mkdirSync(documentsPath, { recursive: true });
        }
        
        // Process files in this client folder
        const clientFiles = fs.readdirSync(itemPath);
        let documentsAdded = 0;
        
        for (const file of clientFiles) {
          const filePath = path.join(itemPath, file);
          
          // Skip if it's a directory
          if (!fs.statSync(filePath).isFile()) {
            continue;
          }
          
          // Copy file to client's documents folder
          const destPath = path.join(documentsPath, file);
          fs.copyFileSync(filePath, destPath);
          
          // Add to database
          const documentId = insertDocument.get(clientId, file, destPath).id;
          documentsAdded++;
          totalDocumentsAdded++;
          
          console.log(`  Added document: ${file} - ID: ${documentId}`);
        }
        
        console.log(`  Added ${documentsAdded} documents for client: ${item}`);
      } else {
        // Handle loose files at root level (create a default client if needed)
        const defaultClientName = "Default Client";
        let defaultClientId;
        
        // Check if default client exists
        const defaultClient = db.prepare("SELECT id FROM clients WHERE name = ?").get(defaultClientName);
        
        if (defaultClient) {
          defaultClientId = defaultClient.id;
        } else {
          defaultClientId = insertClient.get(defaultClientName).id;
          clientsAdded++;
          console.log(`\nCreated default client for loose files - ID: ${defaultClientId}`);
        }
        
        // Create default client folder
        const defaultClientFolder = path.join(dbFoldersPath, `${defaultClientName}_${defaultClientId}`);
        const defaultDocumentsPath = path.join(defaultClientFolder, "documents");
        
        if (!fs.existsSync(defaultDocumentsPath)) {
          fs.mkdirSync(defaultDocumentsPath, { recursive: true });
        }
        
        // Copy loose file to default client documents folder
        const destPath = path.join(defaultDocumentsPath, item);
        fs.copyFileSync(path.join(docsDir, item), destPath);
        
        // Add to database
        const documentId = insertDocument.get(defaultClientId, item, destPath).id;
        totalDocumentsAdded++;
        
        console.log(`Added loose document to default client: ${item} - ID: ${documentId}`);
      }
    }

    console.log(`\nSummary:`);
    console.log(`- Clients added: ${clientsAdded}`);
    console.log(`- Documents added: ${totalDocumentsAdded}`);
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