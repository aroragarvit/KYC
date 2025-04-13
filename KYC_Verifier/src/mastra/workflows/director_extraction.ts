import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import axios from 'axios';
import { documentAnalysisAgent } from '../agents';
import * as fs from 'fs';
import * as path from 'path';

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

    IMPORTANT INSTRUCTIONS FOR DISCREPANCIES:
    - For the SAME director, if different documents list DIFFERENT values for the SAME field (e.g., different addresses, different phone numbers), include ALL these different values with their sources.
    - This is critical for identifying discrepancies in our KYC verification process.
    - Do not attempt to resolve or merge different values - include ALL values found.

    For EACH piece of information, list ALL documents where this information appears, even if it's the same value.
    
    IMPORTANT: Return ONLY a raw JSON array without any markdown formatting, code blocks, or additional text. The response should start with '[' and end with ']'.
    
    Use this exact JSON structure:
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
            { "documentId": 3, "documentName": "Document Name", "value": "123 Main St, Singapore" },
            { "documentId": 5, "documentName": "Different Document", "value": "456 Other St, Singapore" }
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
    Remember: Return ONLY the JSON without any surrounding text, markdown, or code blocks.
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
      // Check for and remove any markdown code block markers that might be present
      let cleanedText = resultText.replace(/```(json)?\s*|\s*```/g, '').trim();
      
      // Ensure it starts with [ and ends with ]
      if (!cleanedText.startsWith('[')) {
        cleanedText = cleanedText.substring(cleanedText.indexOf('['));
      }
      if (!cleanedText.endsWith(']')) {
        cleanedText = cleanedText.substring(0, cleanedText.lastIndexOf(']') + 1);
      }
      
      const parsedResponse = JSON.parse(cleanedText);
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
      // Store all director information for the company
      const successfulDirectors = [];
      const failedDirectors = [];

      for (const director of directorInfo) {
        try {
          // Analyze and detect discrepancies for this director
          const discrepancies = [];
          
          // Define a source type interface
          interface SourceInfo {
            documentId: number;
            documentName: string;
            value: string;
          }

          // Check for discrepancies in each field
          const fieldsToCheck = [
            {name: 'full_name', label: 'Full Name'},
            {name: 'id_number', label: 'ID Number'},
            {name: 'id_type', label: 'ID Type'},
            {name: 'nationality', label: 'Nationality'},
            {name: 'residential_address', label: 'Residential Address'},
            {name: 'telephone_number', label: 'Telephone Number'},
            {name: 'email_address', label: 'Email Address'}
          ];
          
          for (const field of fieldsToCheck) {
            const sources = director.sources[field.name as keyof typeof director.sources];
            if (sources && sources.length > 1) {
              // Extract unique values from sources
              const uniqueValues = new Map();
              
              for (const source of sources) {
                if (!uniqueValues.has(source.value)) {
                  uniqueValues.set(source.value, [source]);
                } else {
                  uniqueValues.get(source.value).push(source);
                }
              }
              
              // If we have more than one unique value, we have a discrepancy
              if (uniqueValues.size > 1) {
                const discrepancyValues = [];
                for (const [value, valueSources] of uniqueValues.entries()) {
                  discrepancyValues.push({
                    value,
                    sources: valueSources.map((s: SourceInfo) => `${s.documentName} (ID: ${s.documentId})`)
                  });
                }
                
                discrepancies.push({
                  field: field.label,
                  values: discrepancyValues,
                  recommendation: `Please verify the correct ${field.label.toLowerCase()} for this director.`
                });
              }
            }
          }
          
          // Store each director with discrepancies information
          await axios.post(`http://localhost:3000/companies/${companyName}/directors`, {
            company_id: null, // Will be assigned by the API based on company name
            full_name: director?.full_name || null,
            id_number: director?.id_number || null,
            id_type: director?.id_type || null,
            nationality: director?.nationality || null,
            residential_address: director?.residential_address || null,
            telephone_number: director?.telephone_number || null,
            email_address: director?.email_address || null,
            full_name_source: JSON.stringify(director?.sources?.full_name || []),
            id_number_source: JSON.stringify(director?.sources?.id_number || []),
            id_type_source: JSON.stringify(director?.sources?.id_type || []),
            nationality_source: JSON.stringify(director?.sources?.nationality || []),
            residential_address_source: JSON.stringify(director?.sources?.residential_address || []),
            telephone_number_source: JSON.stringify(director?.sources?.telephone_number || []),
            email_address_source: JSON.stringify(director?.sources?.email_address || []),
            discrepancies: JSON.stringify(discrepancies)
          });
          
          successfulDirectors.push({...director, discrepancies});
          console.log(`Successfully stored director: ${director?.full_name || 'Unknown'}`);
          if (discrepancies.length > 0) {
            console.log(`Found ${discrepancies.length} discrepancies for ${director?.full_name || 'Unknown'}`);
          }
        } catch (directorError) {
          console.error(`Error storing director ${director?.full_name || 'Unknown'}:`, directorError);
          failedDirectors.push(director);
        }
      }

      if (failedDirectors.length === 0) {
        return {
          company: companyName,
          directors: directorInfo,
          extraction_status: 'SUCCESS' as const,
          message: `Successfully extracted and stored information for all ${directorInfo.length} directors`
        };
      } else if (successfulDirectors.length > 0) {
        return {
          company: companyName,
          directors: directorInfo,
          extraction_status: 'PARTIAL' as const,
          message: `Extracted information for ${directorInfo.length} directors, but only stored ${successfulDirectors.length} successfully`
        };
      } else {
        throw new Error('Failed to store any director information');
      }
    } catch (error) {
      console.error('Error storing director information:', error);
      
      // If API calls fail, use in-memory storage (filesystem approach)
      try {
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
          extraction_status: 'SUCCESS' as const,
          message: `Successfully extracted and stored information for ${directorInfo.length} directors (local storage fallback)`
        };
      } catch (fsError: unknown) {
        console.error('Error with fallback storage:', fsError);
        return {
          company: companyName,
          directors: directorInfo,
          extraction_status: 'PARTIAL' as const,
          message: `Extracted director information but failed to store permanently: ${
            (fsError instanceof Error) ? fsError.message : 'Unknown error'
          }`
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