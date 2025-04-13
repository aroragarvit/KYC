import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import axios from 'axios';
import { documentAnalysisAgent } from '../agents';

// Define schemas for input and output data
const companySchema = z.object({
  name: z.string().describe('The company name to extract director information for'),
});

// Document structure from API
const documentSchema = z.object({
  id: z.number(),
  name: z.string(),
  file_path: z.string().optional(),
});

// Document content schema
const documentContentSchema = z.object({
  document: z.object({
    id: z.number(),
    name: z.string(),
  }),
  content: z.string(),
});

// Director information schema
const directorInfoSchema = z.object({
  full_name: z.string().nullable(),
  id_number: z.string().nullable(),
  id_type: z.string().nullable(),
  nationality: z.string().nullable(),
  residential_address: z.string().nullable(),
  telephone_number: z.string().nullable(),
  email_address: z.string().nullable(),
  sources: z.object({
    full_name: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
    })),
    id_number: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
    })),
    id_type: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
    })),
    nationality: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
    })),
    residential_address: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
    })),
    telephone_number: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
    })),
    email_address: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
    })),
  }),
});

// Storage result schema
const extractionResultSchema = z.object({
  company: z.string(),
  directors: z.array(directorInfoSchema),
  extraction_status: z.enum(['SUCCESS', 'PARTIAL', 'FAILED']),
  message: z.string(),
});

// Step 1: Fetch documents for the company
const fetchCompanyDocuments = new Step({
  id: 'fetch-company-documents',
  description: 'Fetches all documents for a company',
  inputSchema: companySchema,
  outputSchema: z.array(documentSchema),
  execute: async ({ context }) => {
    const triggerData = context?.getStepResult<{ name: string }>('trigger');
    if (!triggerData) {
      throw new Error('Trigger data not found');
    }

    try {
      const response = await axios.get(`http://localhost:3000/companies/${triggerData.name}/documents`);
      return response.data.documents;
    } catch (error) {
      console.error('Error fetching company documents:', error);
      throw new Error(`Failed to fetch documents for company ${triggerData.name}`);
    }
  },
});

// Step 2: Read document contents
const readDocumentContents = new Step({
  id: 'read-document-contents',
  description: 'Reads the content of each document',
  inputSchema: z.array(documentSchema),
  outputSchema: z.array(documentContentSchema),
  execute: async ({ context }) => {
    const documents = context?.getStepResult(fetchCompanyDocuments);
    if (!documents || documents.length === 0) {
      throw new Error('No documents found');
    }

    const documentContents = [];
    for (const doc of documents) {
      try {
        const response = await axios.get(`http://localhost:3000/documents/read?id=${doc.id}`);
        documentContents.push({
          document: {
            id: doc.id,
            name: doc.name,
          },
          content: response.data.content,
        });
        console.log(`Read content from document: ${doc.name} (ID: ${doc.id})`);
      } catch (error) {
        console.error(`Error reading document ${doc.name} (ID: ${doc.id}):`, error);
        // Add with empty content to maintain document list
        documentContents.push({
          document: {
            id: doc.id,
            name: doc.name,
          },
          content: `Error reading document content`,
        });
      }
    }
    return documentContents;
  },
});

// Step 3: Extract director information
const extractDirectorInfo = new Step({
  id: 'extract-director-info',
  description: 'Extracts director information from document contents',
  inputSchema: z.array(documentContentSchema),
  outputSchema: z.array(directorInfoSchema),
  execute: async ({ context }) => {
    const documentContents = context?.getStepResult(readDocumentContents);
    if (!documentContents || documentContents.length === 0) {
      throw new Error('No document contents found');
    }

    // Prepare prompt for the agent
    let prompt = `I need to extract director information from the following company documents.\n\n`;
    
    // Include document contents in the prompt
    documentContents.forEach((doc, index) => {
      prompt += `Document ${index + 1}: ${doc.document.name} (ID: ${doc.document.id})\n`;
      // Truncate content if too long to fit in prompt
      const contentPreview = doc.content.length > 800 
        ? doc.content.substring(0, 800) + '... (content truncated)'
        : doc.content;
      prompt += `Content: ${contentPreview}\n\n`;
    });

    // Add formatting instructions
    prompt += `
    Extract all director information from these documents. For each director, provide:
    1. Full Name
    2. ID Number
    3. ID Type (Passport, NRIC, etc.)
    4. Nationality
    5. Residential Address
    6. Telephone Number
    7. Email Address

    For EACH piece of information, list ALL documents where this information appears, even if it's the same value.
    
    Return the information as a JSON array with this exact structure:
    [
      {
        "full_name": "Director's Name",
        "id_number": "ID123456",
        "id_type": "Passport",
        "nationality": "Singapore",
        "residential_address": "123 Main St, Singapore",
        "telephone_number": "+65 1234 5678",
        "email_address": "director@example.com",
        "sources": {
          "full_name": [
            { "documentId": 1, "documentName": "Document Name", "value": "Director's Name" }
          ],
          "id_number": [
            { "documentId": 2, "documentName": "Document Name", "value": "ID123456" }
          ],
          "id_type": [
            { "documentId": 2, "documentName": "Document Name", "value": "Passport" }
          ],
          "nationality": [
            { "documentId": 1, "documentName": "Document Name", "value": "Singapore" }
          ],
          "residential_address": [
            { "documentId": 3, "documentName": "Document Name", "value": "123 Main St, Singapore" }
          ],
          "telephone_number": [
            { "documentId": 1, "documentName": "Document Name", "value": "+65 1234 5678" }
          ],
          "email_address": [
            { "documentId": 1, "documentName": "Document Name", "value": "director@example.com" }
          ]
        }
      }
    ]
    
    If multiple documents contain the same field, include all sources.
    If information is missing, use null for that field.
    Always use the exact field names shown above.
    `;

    // Run the agent
    const response = await documentAnalysisAgent.stream([
      { role: 'user', content: prompt }
    ]);

    let resultText = '';
    for await (const chunk of response.textStream) {
      resultText += chunk;
    }

    // Parse the response
    try {
      const parsedResponse = JSON.parse(resultText);
      if (!Array.isArray(parsedResponse)) {
        throw new Error('Response is not an array');
      }
      return parsedResponse;
    } catch (error) {
      console.error('Error parsing document analysis response:', error);
      // Try to extract JSON from text response
      const jsonRegex = /\[[\s\S]*\]/g;
      const match = resultText.match(jsonRegex);
      if (match) {
        try {
          const extracted = JSON.parse(match[0]);
          return extracted;
        } catch (e) {
          throw new Error('Failed to parse director information from response');
        }
      }
      throw new Error('Failed to extract director information');
    }
  },
});

// Step 4: Store extracted director information
const storeDirectorInfo = new Step({
  id: 'store-director-info',
  description: 'Stores extracted director information in the database',
  inputSchema: z.array(directorInfoSchema),
  outputSchema: extractionResultSchema,
  execute: async ({ context }) => {
    const directorInfo = context?.getStepResult(extractDirectorInfo);
    const companyName = context?.getStepResult<{ name: string }>('trigger')?.name;
    
    if (!directorInfo || directorInfo.length === 0) {
      throw new Error('No director information found');
    }
    
    if (!companyName) {
      throw new Error('Company name not found');
    }

    try {
      // Store director information for the company
      const response = await axios.post(`http://localhost:3000/api/director-data`, {
        company: companyName,
        directors: directorInfo
      });

      return {
        company: companyName,
        directors: directorInfo,
        extraction_status: 'SUCCESS',
        message: `Successfully extracted and stored information for ${directorInfo.length} directors`
      };
    } catch (error) {
      console.error('Error storing director information:', error);
      
      // If API call fails, use in-memory storage (filesystem approach)
      try {
        // Using Node.js fs module to write to a JSON file
        const fs = require('fs');
        const path = require('path');
        
        // Ensure the directory exists
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Write data to file
        const filePath = path.join(dataDir, `${companyName.toLowerCase()}_directors.json`);
        fs.writeFileSync(filePath, JSON.stringify({
          company: companyName,
          directors: directorInfo,
          timestamp: new Date().toISOString()
        }, null, 2));
        
        return {
          company: companyName,
          directors: directorInfo,
          extraction_status: 'SUCCESS',
          message: `Successfully extracted and stored information for ${directorInfo.length} directors (local storage fallback)`
        };
      } catch (fsError) {
        console.error('Error with fallback storage:', fsError);
        return {
          company: companyName,
          directors: directorInfo,
          extraction_status: 'PARTIAL',
          message: `Extracted director information but failed to store permanently: ${fsError.message}`
        };
      }
    }
  },
});

// Create and commit the director extraction workflow
const directorExtractionWorkflow = new Workflow({
  name: 'director-extraction-workflow',
  triggerSchema: companySchema,
})
  .step(fetchCompanyDocuments)
  .then(readDocumentContents)
  .then(extractDirectorInfo)
  .then(storeDirectorInfo);

directorExtractionWorkflow.commit();

export { directorExtractionWorkflow }; 