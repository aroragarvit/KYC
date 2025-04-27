# KYC Agent Server

A robust server implementation for Know Your Customer (KYC) processes, designed to extract, store, and retrieve company and individual information from KYC documents.

## Features

- Document management and analysis for KYC compliance
- Individual and company data extraction and storage
- Relationship tracking between directors and shareholders
- Discrepancy detection across multiple documents
- RESTful API for data retrieval and management
- Message-based client interaction

## System Requirements

- Node.js 14.x or higher
- npm 6.x or higher

## Installation

1. Clone the repository
2. Navigate to the Server directory:
   ```bash
   cd KYC_Agent/Server
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Database Initialization

The system uses SQLite for data storage. To initialize the database:

```bash
npm run init-kyc-db
```

This command runs the `src/db/kyc_init.js` script which:
1. Creates the database at `kyc_data.db`
2. Sets up all required tables (individuals, companies, document_sources, directors, shareholders, clients, messages)
3. Creates appropriate indexes for optimized queries
4. Scans the `Docs` directory for client folders and processes any documents found within

## Project Structure

```
Server/
├── Docs/                # Client documents for processing
│   ├── {ClientName1}/   # Documents for specific client
│   └── {ClientName2}/   # Documents for another client
├── db/                  # Database related files and folders
├── node_modules/        # Node.js dependencies
├── src/                 # Source code
│   ├── app.js           # Fastify application setup
│   ├── db/              # Database scripts
│   │   ├── kyc_init.js  # Database initialization script
│   │   └── reset_messages.js # Utility to reset message tables
│   └── routes/          # API routes
│       ├── kyc_routes.js # KYC data endpoints
│       └── messages.js   # Client messaging endpoints
├── .gitignore           # Git ignore rules
├── kyc_data.db          # SQLite database
├── package.json         # Dependencies and scripts
├── package-lock.json    # Lock file for dependencies
├── README.md            # This documentation
└── server.js            # Server entry point
```

## Running the Server

### Development Mode

```bash
npm run dev
```

This starts the server using nodemon, which automatically restarts when files change.

### Production Mode

```bash
npm start
```

This starts the server in production mode.

By default, the server runs on `http://0.0.0.0:3000`.


### Messaging Endpoints

- `GET /messages` - Fetch messages for a client
- `POST /messages` - Create a new message
- `POST /agent-generate` - Generate an agent response to a message



1. Create a new folder in the `Docs` directory with the client name
2. Place the client's KYC documents in this folder
3. Run the database initialization script:
   ```bash
   npm run init-kyc-db
   ```

## Database Schema

The system uses several database tables:

- `clients` - Client information
- `individuals` - Individual persons' details from KYC documents
- `companies` - Company details from KYC documents
- `document_sources` - Document metadata and content
- `directors` - Director information with source tracking
- `shareholders` - Shareholder information with source tracking
- `messages` - Client-agent message history

## Technology Stack

- **Fastify**: High-performance web framework
- **better-sqlite3**: SQLite database driver
- **mammoth**: DOCX file parsing
- **fastify-plugin**: Plugin system for Fastify
- **nodemon**: Development auto-restart tool

