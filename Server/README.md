# KYC Agent - Document Processing API

This server provides an API for reading, parsing, and extracting director information from company documents for KYC (Know Your Customer) processes.

## Features

- Upload and manage company documents
- Parse document content using mammoth.js for DOCX files
- Extract director information using an AI agent
- Identify and track data discrepancies between documents
- Store director information with source tracking

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Initialize the database:
   ```
   npm run init-db
   ```

3. Start the server:
   ```
   npm start
   ```

   Or for development with auto-restart:
   ```
   npm run dev
   ```

## API Endpoints

### Document Management

- `GET /companies/:name/documents` - Get all documents for a company
- `GET /documents/:id` - Get document information by ID
- `GET /documents/read?id=:documentId` - Read the content of a document by its ID
- `GET /documents/read?name=:documentName` - Read the content of a document by its name
- `GET /documents` - List all available documents

### Director Information

- `GET /companies/:name/directors` - Get all directors for a company
- `POST /companies/:name/directors` - Save director information for a company

### Workflow

- `POST /run-workflow` - Run the director extraction workflow for a company

## Director Extraction Workflow

The system includes an AI-powered workflow that:

1. Fetches all documents for a specified company
2. Reads the content of each document
3. Uses an AI agent to extract director information:
   - Full Name
   - ID Number
   - ID Type
   - Nationality
   - Residential Address
   - Telephone Number
   - Email Address
4. For each piece of information, it tracks the source document
5. Identifies discrepancies between information found in different documents
6. Saves the extracted information to the database

## Example: Running the Workflow

```bash
curl -X POST http://localhost:3000/run-workflow \
  -H "Content-Type: application/json" \
  -d '{"name": "Truffles"}'
```

This will process all documents for the "Truffles" company, extract director information, and save it to the database.

## Database Schema

The system uses SQLite with the following tables:

- `companies` - Company information
- `documents` - Document metadata (name, file path)
- `company_documents` - Many-to-many relationship between companies and documents
- `directors` - Extracted director information with source tracking

## Technologies

- Fastify - Web server
- Better-SQLite3 - Database
- Mammoth.js - DOCX parsing
- Google Generative AI - AI processing
- Mastra - Workflow framework
- Zod - Schema validation 