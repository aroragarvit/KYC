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

// Simplified Step 3: Extract director information with direct consolidation
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

    console.log(`Processing ${documentContents.length} documents to extract director information...`);
    
    // Prepare a single comprehensive prompt with all document contents
    let prompt = `I need to extract complete director information from the following company documents, identifying ALL variations and discrepancies across documents.\n\n`;
    
    // Include all document contents in the prompt
    documentContents.forEach((doc, index) => {
      prompt += `DOCUMENT ${index + 1}: ${doc.document.name} (ID: ${doc.document.id})\n`;
      prompt += `Document Type: ${categorizeDocumentType(doc.document.name)}\n`;
      
      // For large documents, truncate content to avoid token limits
      let content = doc.content;
      if (content.length > 3000) {
        content = content.substring(0, 3000) + "... [content truncated]";
      }
      
      // Include content for each document
      prompt += `Content:\n${content}\n\n`;
      prompt += `---------- END OF DOCUMENT ${index + 1} ----------\n\n`;
    });
    
    // Add comprehensive extraction instructions
    prompt += `
    Your task is to identify ALL directors mentioned across these documents and extract their complete information, including ALL variations and discrepancies.
    
    EXTRACTION REQUIREMENTS:
    1. Identify ALL directors mentioned in ANY document
    2. For each director, extract:
       - Full Name (including ALL variations: formal names, nicknames, etc.)
       - ALL ID Numbers found across documents (passport numbers, NRIC, etc.)
       - ID Types (passport, NRIC, etc. - based on ID format and context)
       - Nationality (including ALL variations)
       - ALL Residential Addresses found across documents
       - ALL Telephone Numbers found across documents
       - ALL Email Addresses found across documents
    
    CRITICAL RULES:
    - SAME PERSON, DIFFERENT NAMES: A person may appear with different names (e.g., "John Doe" vs "Johnathan Doe")
    - SAME PERSON, MULTIPLE ID NUMBERS: A person may have different ID numbers across documents
    - MULTIPLE ADDRESSES: Include ALL addresses a person might have across documents
    - NEVER miss ANY discrepancy or variation in ANY field
    - Determine the correct ID type based on format:
       * Singapore NRIC: Starts with S/T/F/G/M + 7 digits + letter (e.g., S1234567A)
       * Passport: Often starts with letter(s) + numbers (e.g., P0987654B, X1234567)
    
    Format the results as a JSON array with each object representing a director:
    [
      {
        "full_name": "Most formal/complete version of name",
        "id_number": "Most official ID number",
        "id_type": "Most appropriate ID type (NEVER use generic terms if specific type can be determined)",
        "nationality": "Primary nationality",
        "residential_address": "Primary address",
        "telephone_number": "Primary phone number",
        "email_address": "Primary email address",
        "sources": {
          "full_name": [
            {"documentId": 1, "documentName": "Doc Name", "value": "Name as appears in this document"},
            {"documentId": 3, "documentName": "Another Doc", "value": "Different name found in this document"}
          ],
          "id_number": [
            {"documentId": 2, "documentName": "Doc Name", "value": "ID123456"},
            {"documentId": 4, "documentName": "Another Doc", "value": "Different ID number"}
          ],
          "id_type": [ ... ],
          "nationality": [ ... ],
          "residential_address": [ ... ],
          "telephone_number": [ ... ],
          "email_address": [ ... ]
        }
      }
    ]
    
    IMPORTANT: 
    - Include ALL variations found across documents in the appropriate sources arrays.
    - Return ONLY the raw JSON array. Do not include any explanations, markdown, or code blocks.
    - Your response should start with "[" and end with "]".
    `;
    
    try {
      console.log("Sending prompt to extract director information...");
      const response = await documentAnalysisAgent.stream([
        { role: 'user', content: prompt }
      ]);
      let resultText = '';
      try {
        for await (const chunk of response.textStream) {
          resultText += chunk;
        }
      } catch (streamError) {
        console.warn("Stream error encountered but continuing with parsing:", 
          typeof streamError === 'object' && streamError !== null ? String(streamError) : 'Unknown error');
      }
      
      console.log("Received response, parsing...");
      
      // Clean up the response text and extract the JSON
      let jsonText = resultText.trim();
      
      // Remove any non-JSON prefix/suffix content
      const startIdx = jsonText.indexOf('[');
      const endIdx = jsonText.lastIndexOf(']');
      
      if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        console.error("Could not find valid JSON array markers in response");
        console.log("Response text:", jsonText.substring(0, 200) + "...");
        throw new Error('Could not locate JSON array in response');
      }
      
      jsonText = jsonText.substring(startIdx, endIdx + 1);
      
      // Remove any markdown code block markers
      jsonText = jsonText.replace(/```(json)?|```/g, '').trim();
      
      try {
        // Parse the JSON
        const parsedDirectors = JSON.parse(jsonText);
        
        if (!Array.isArray(parsedDirectors)) {
          throw new Error('Parsed result is not an array');
        }
        
        // Post-process to ensure correct ID types and standardize fields
        const processedDirectors = parsedDirectors.map(director => {
          // Infer ID type from format if not specified or "Other ID"
          if (director.id_number && (!director.id_type || director.id_type === "Unknown" || director.id_type === "Other ID")) {
            director.id_type = inferIdTypeFromNumber(director.id_number, director.nationality);
            
            // Add inferred ID type to sources if not already present
            if (director.id_type && 
                (!director.sources.id_type || 
                 director.sources.id_type.length === 0 || 
                 director.sources.id_type.every((s: {value: string}) => s.value === "Other ID" || s.value === "Unknown"))) {
              director.sources.id_type = [{
                documentId: 0,
                documentName: "Inferred from ID format",
                value: director.id_type
              }];
            }
          }
          
          // Standardize nationality
          if (director.nationality === "Singaporean") {
            director.nationality = "Singapore";
          } else if (director.nationality === "American") {
            director.nationality = "USA";
          }
          
          // Ensure all source arrays exist
          ['full_name', 'id_number', 'id_type', 'nationality', 
           'residential_address', 'telephone_number', 'email_address'].forEach(field => {
            if (!director.sources[field]) {
              director.sources[field] = [];
            }
          });
          
          return director;
        });
        
        console.log(`Successfully extracted information for ${processedDirectors.length} directors`);
        return processedDirectors;
      } catch (parseError: unknown) {
        console.error('Error parsing JSON');
        if (parseError instanceof Error) {
          console.error('Error details:', parseError.message);
        }
        throw new Error(`Failed to parse director information`);
      }
    } catch (error: unknown) {
      console.error('Error extracting director information');
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      
      // Fallback: return a minimal director structure to prevent workflow failure
      return [{
        full_name: "Error extracting directors",
        id_number: null,
        id_type: null,
        nationality: null,
        residential_address: null,
        telephone_number: null,
        email_address: null,
        sources: {
          full_name: [{
            documentId: 0,
            documentName: "Error",
            value: "Failed to extract directors from documents"
          }],
          id_number: [],
          id_type: [],
          nationality: [],
          residential_address: [],
          telephone_number: [],
          email_address: []
        }
      }];
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
    console.log("Director Info is", directorInfo);
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
          // Extract all values (including duplicates) for each field
          const allFieldValues: Record<string, string[]> = {};
          
          // Fields to process
          const fieldsToProcess = [
            'full_name',
            'id_number',
            'id_type',
            'nationality',
            'residential_address',
            'telephone_number',
            'email_address'
          ];
          
          // For each field, extract all values from all sources
          for (const field of fieldsToProcess) {
            const sources = director.sources[field as keyof typeof director.sources];
            // Initialize the array for this field
            allFieldValues[field] = [];
            
            if (sources && sources.length > 0) {
              // Extract all values from sources
              sources.forEach(source => {
                if (source && source.value) {
                  allFieldValues[field].push(source.value);
                }
              });
            }
          }
          
          // Identify discrepancies - fields with multiple distinct values
          const discrepancies = [];
          for (const field of fieldsToProcess) {
            // Get unique values
            const uniqueValues = [...new Set(allFieldValues[field])];
            if (uniqueValues.length > 1) {
              discrepancies.push({
                field,
                values: uniqueValues
              });
            }
          }
          
          // Store each director with all values from all sources
          await axios.post(`http://localhost:3000/companies/${companyName}/directors`, {
            company_id: null, // Will be assigned by the API based on company name
            // Main fields use the first value found (or null if not found)
            full_name: director?.full_name || null,
            id_number: director?.id_number || null,
            id_type: director?.id_type || null,
            nationality: director?.nationality || null,
            residential_address: director?.residential_address || null,
            telephone_number: director?.telephone_number || null,
            email_address: director?.email_address || null,
            // Store all sources
            full_name_source: JSON.stringify(director?.sources?.full_name || []),
            id_number_source: JSON.stringify(director?.sources?.id_number || []),
            id_type_source: JSON.stringify(director?.sources?.id_type || []),
            nationality_source: JSON.stringify(director?.sources?.nationality || []),
            residential_address_source: JSON.stringify(director?.sources?.residential_address || []),
            telephone_number_source: JSON.stringify(director?.sources?.telephone_number || []),
            email_address_source: JSON.stringify(director?.sources?.email_address || []),
            // Store all values as arrays (including duplicates)
            full_name_values: JSON.stringify(allFieldValues.full_name || []),
            id_number_values: JSON.stringify(allFieldValues.id_number || []),
            id_type_values: JSON.stringify(allFieldValues.id_type || []),
            nationality_values: JSON.stringify(allFieldValues.nationality || []),
            residential_address_values: JSON.stringify(allFieldValues.residential_address || []),
            telephone_number_values: JSON.stringify(allFieldValues.telephone_number || []),
            email_address_values: JSON.stringify(allFieldValues.email_address || []),
            // Store identified discrepancies
            discrepancies: JSON.stringify(discrepancies)
          });
          
          successfulDirectors.push({...director, allFieldValues, discrepancies});
          console.log(`Successfully stored director: ${director?.full_name || 'Unknown'}`);
          
          // Log all discrepancies for debugging
          if (discrepancies.length > 0) {
            console.log(`Found ${discrepancies.length} discrepancies for ${director?.full_name || 'Unknown'}:`);
            discrepancies.forEach(d => {
              console.log(`- ${d.field}: ${d.values.join(', ')}`);
            });
          }
        } catch (directorError: unknown) {
          console.error(`Error storing director ${director?.full_name || 'Unknown'}`);
          if (directorError instanceof Error) {
            console.error(`Error details: ${directorError.message}`);
          }
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
    } catch (error: unknown) {
      console.error('Error storing director information');
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      return {
        company: companyName,
        directors: directorInfo,
        extraction_status: 'PARTIAL' as const,
        message: `Extracted director information but failed to store permanently: ${
          (error instanceof Error) ? error.message : 'Unknown error'
        }`
      };
    }
  },
});

// Helper function to categorize document type
function categorizeDocumentType(documentName: string) {
  const lowerName = documentName.toLowerCase();
  
  if (lowerName.includes('passport')) return 'Passport Document';
  if (lowerName.includes('national id') || lowerName.includes('nric') || lowerName.includes('id document')) return 'National ID Document';
  if (lowerName.includes('registry')) return 'Registry Document';
  if (lowerName.includes('appointment')) return 'Appointment Document';
  if (lowerName.includes('address') || lowerName.includes('proof')) return 'Address Verification';
  if (lowerName.includes('profile')) return 'Company Profile';
  if (lowerName.includes('shareholder')) return 'Shareholding Document';
  
  return 'Other Document';
}

// Helper function to infer ID type from number format and nationality
function inferIdTypeFromNumber(idNumber: any, nationality: any) {
  if (!idNumber) return null;
  
  // Convert to string if not already
  const idStr = String(idNumber).trim();
  
  // Singapore NRIC pattern: S/T/F/G/M followed by 7 digits and a letter
  if (/^[STFGM]\d{7}[A-Z]$/i.test(idStr)) {
    return 'NRIC';
  }
  
  // Passport patterns
  if (/^P\d+[A-Z]?$/i.test(idStr) || // P followed by numbers
      /^[A-Z]\d{6,9}$/i.test(idStr) || // Letter followed by digits
      /^X\d{7}$/i.test(idStr)) { // X followed by 7 digits
    return 'Passport';
  }
  
  // If format looks like a passport but we couldn't specifically identify
  if (/^[A-Z0-9]{6,10}$/i.test(idStr)) {
    return 'Passport';
  }
  
  // If we can't determine from format
  return 'Unknown ID';
}

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