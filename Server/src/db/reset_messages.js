const Database = require("better-sqlite3");
const path = require("path");

function resetMessagesTable() {
  try {
    // Open the database
    const db = new Database(path.join(__dirname, "../../kyc_data.db"));

    // Drop and recreate messages table
    db.exec(`DROP TABLE IF EXISTS messages`);
    
    // Create messages table with created_at field
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

    console.log("Messages table reset successfully.");
    db.close();
  } catch (err) {
    console.error("Error resetting messages table:", err);
  }
}

// Run reset when this script is executed directly
if (require.main === module) {
  resetMessagesTable();
}

module.exports = { resetMessagesTable }; 