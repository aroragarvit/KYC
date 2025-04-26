import { Step, Workflow, WorkflowContext } from '@mastra/core/workflows';
import { z } from 'zod';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { documentClassificationAgent, kycAnalysisAgent } from '../agents/kyc';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define schemas for input and output data
const workflowTriggerSchema = z.object({
  client_id: z.number().describe('The client ID to process documents for'),
});

// Define the type for the workflow input
type WorkflowInput = {
  client_id: number;
};

// Document structure from API
const documentSchema = z.object({
  id: z.number(),
  document_name: z.string(),
  document_type: z.string().nullable(),
  file_path: z.string().optional(),
  client_id: z.number(),
});

// Document content schema
const documentContentSchema = z.object({
  document: z.object({
    id: z.number(),
    document_name: z.string(),
    document_type: z.string().nullable(),
    client_id: z.number().optional(),
  }),
  content: z.string(),
});

// Document classification schema
const documentClassificationSchema = z.object({
  id: z.number(),
  document_name: z.string(),
  document_type: z.string().nullable(),
  content: z.string(),
});

// Extracted information schema
const sourceSchema = z.object({
  documentId: z.number(),
  documentName: z.string(),
  documentType: z.string(),
  value: z.string(),
});

interface Source {
  documentId: number;
  documentName: string;
  documentType: string;
  value: string;
}

interface Discrepancy {
  field: string;
  values: string[];
  sources: string[];
}

interface Individual {
  full_name: string;
  client_id?: number;
  alternative_names?: string[];
  id_numbers?: Record<string, Source>;
  id_types?: Record<string, Source>;
  nationalities?: Record<string, Source>;
  addresses?: Record<string, Source>;
  emails?: Record<string, Source>;
  phones?: Record<string, Source>;
  roles?: Record<string, string>;
  shares_owned?: Record<string, Source>;
  price_per_share?: Record<string, Source>;
  discrepancies?: Discrepancy[];
}

interface Director {
  name: string;
  position?: string;
  appointment_date?: string;
}

interface Shareholder {
  name: string;
  is_corporate?: boolean;
  shares?: number;
  percentage?: number;
  date?: string;
}

interface CompanyRecord {
  company_name: string;
  client_id?: number;
  alternative_names?: string[];
  registration_number?: Record<string, Source>;
  jurisdiction?: Record<string, Source>;
  address?: any;
  directors?: string[];
  shareholders?: string[];
  company_activities?: any;
  shares_issued?: Record<string, Source>;
  price_per_share?: Record<string, Source>;
  discrepancies?: Discrepancy[];
  emails?: Record<string, Source>;
}

const individualSchema = z.object({
  full_name: z.string(),
  alternative_names: z.array(z.string()).optional(),
  id_numbers: z.record(z.string(), sourceSchema).optional(),
  id_types: z.record(z.string(), sourceSchema).optional(),
  nationalities: z.record(z.string(), sourceSchema).optional(),
  addresses: z.record(z.string(), sourceSchema).optional(),
  emails: z.record(z.string(), sourceSchema).optional(),
  phones: z.record(z.string(), sourceSchema).optional(),
  roles: z.record(z.string(), z.string()).optional(),
  shares_owned: z.record(z.string(), sourceSchema).optional(),
  price_per_share: z.record(z.string(), sourceSchema).optional(),
  discrepancies: z.array(
    z.object({
      field: z.string(),
      values: z.array(z.string()),
      sources: z.array(z.string()),
    })
  ).optional(),
});

const companySchema = z.object({
  company_name: z.string(),
  alternative_names: z.array(z.string()).optional(),
  registration_number: z.record(z.string(), sourceSchema).optional(),
  jurisdiction: z.record(z.string(), sourceSchema).optional(),
  address: z.record(z.string(), sourceSchema).optional(),
  directors: z.array(z.string()).optional(),
  shareholders: z.array(z.string()).optional(),
  company_activities: z.record(z.string(), sourceSchema).optional(),
  shares_issued: z.record(z.string(), sourceSchema).optional(),
  price_per_share: z.record(z.string(), sourceSchema).optional(),
  discrepancies: z.array(
    z.object({
      field: z.string(),
      values: z.array(z.string()),
      sources: z.array(z.string()),
    })
  ).optional(),
});

const extractedDataSchema = z.object({
  individuals: z.array(individualSchema),
  companies: z.array(companySchema),
});

// Result schema with markdown tables
const workflowResultSchema = z.object({
  status: z.enum(['success', 'error']),
  message: z.string(),
  summary: z.object({
    individuals_processed: z.number(),
    companies_processed: z.number(),
    documents_processed: z.number(),
  }).optional(),
  tables: z.object({
    individuals: z.string(),
    companies: z.string(),
  }).optional(),
});

// Step 1: Fetch documents
const fetchDocuments = new Step({
  id: 'fetch-documents',
  description: 'Fetches all available documents for a specific client',
  inputSchema: workflowTriggerSchema,
  outputSchema: z.object({
    documents: z.array(documentSchema),
    client_id: z.number(),
  }),
  execute: async ({ context }) => {
    try {
      // Get the trigger data from context
      const triggerData = context?.getStepResult<WorkflowInput>('trigger');
      if (!triggerData || !triggerData.client_id) {
        throw new Error('Client ID is required');
      }
      
      const clientId = triggerData.client_id;
      console.log(`Fetching documents for client ID: ${clientId}...`);
      const response = await axios.get(`http://localhost:3000/kyc/documents?client_id=${clientId}`);
      
      // Return both documents and client_id for future steps
      return {
        documents: response.data.documents,
        client_id: clientId
      };
    } catch (error: unknown) {
      console.error(`Error executing KYC document workflow step 1: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  },
});

// Step 2: Read document contents
const readDocumentContents = new Step({
  id: 'read-document-contents',
  description: 'Reads the content of each document',
  inputSchema: z.object({
    documents: z.array(documentSchema),
    client_id: z.number(),
  }),
  outputSchema: z.object({
    documentContents: z.array(documentContentSchema),
    client_id: z.number(),
  }),
  execute: async ({ context }) => {
    // Get the result from the previous step
    const fetchResult = context?.getStepResult(fetchDocuments);
    if (!fetchResult || !fetchResult.documents || fetchResult.documents.length === 0) {
      throw new Error('No documents found');
    }

    const { documents, client_id } = fetchResult;
    const documentContents = [];
    
    for (const doc of documents) {
      try {
        console.log(`Reading content for document ${doc.id}: ${doc.document_name}`);
        const response = await axios.get(`http://localhost:3000/kyc/documents/${doc.id}/content`);
        
        // Pass client_id through the document object
        documentContents.push({
          document: {
            id: doc.id,
            document_name: doc.document_name,
            document_type: doc.document_type,
            client_id: doc.client_id || client_id, // Include client_id if available
          },
          content: response.data.content,
        });
      } catch (error) {
        console.error(`Error reading document ${doc.document_name} (ID: ${doc.id}):`, error);
        // Add with empty content to maintain document list
        documentContents.push({
          document: {
            id: doc.id,
            document_name: doc.document_name,
            document_type: doc.document_type,
            client_id: doc.client_id || client_id, // Include client_id if available
          },
          content: `Error reading document content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
    
    // Pass both document contents and client_id to the next step
    return { documentContents, client_id };
  },
});

// Step 3: Classify documents based on content - OPTIMIZED VERSION
const classifyDocuments = new Step({
  id: 'classify-documents',
  description: 'Determines document types based on content analysis (batched)',
  inputSchema: z.object({
    documentContents: z.array(documentContentSchema),
    client_id: z.number(),
  }),
  outputSchema: z.object({
    classifiedDocuments: z.array(documentClassificationSchema),
    client_id: z.number(),
  }),
  execute: async ({ context }) => {
    const result = context?.getStepResult(readDocumentContents);
    if (!result || !result.documentContents || result.documentContents.length === 0) {
      throw new Error('No document contents found');
    }

    const { documentContents, client_id } = result;
    console.log(`Classifying ${documentContents.length} documents in a single batch...`);
    
    // Filter out documents that already have a type
    const documentsToClassify = documentContents.filter(
      doc => !doc.document.document_type || doc.document.document_type === 'null'
    );
    
    const preClassifiedDocuments = documentContents.filter(
      doc => doc.document.document_type && doc.document.document_type !== 'null'
    ).map(doc => ({
      id: doc.document.id,
      document_name: doc.document.document_name,
      document_type: doc.document.document_type,
      content: doc.content
    }));
    
    // If all documents are already classified, skip the API call
    if (documentsToClassify.length === 0) {
      console.log("All documents already have classifications. Skipping classification step.");
      return {
        classifiedDocuments: preClassifiedDocuments,
        client_id
      };
    }
    
    // Create a batch classification prompt
    let batchPrompt = `
      # Batch Document Classification for KYC

      Below are multiple documents that need to be classified for KYC (Know Your Customer) purposes.
      For each document, determine its most appropriate document type from these options:
      
      - identity_document: Official government ID like passports, national ID cards, NRIC
      - proof_of_address: Utility bills, bank statements showing residential address
      - company_registry: Official company register documents, incorporation certificates
      - shareholder_registry: Documents showing company ownership structure
      - director_registry: Documents listing company directors
      - director_appointment: Letters appointing directors
      - company_profile: Overview documents about a company
      - financial_statement: Company financial documents
      - beneficial_owner_declaration: Documents identifying ultimate beneficial owners
      - organizational_chart: Corporate structure diagrams
      - certificate_of_incorporation: Company formation documents
      - memorandum_of_association: Company bylaws
      - other: If none of the above categories apply
      
      For each document, return ONLY the document ID and classification type in this format:
      DOC_ID:classification_type
      
      For example:
      1:identity_document(NRIC)
      2:proof_of_address(Bank Statement)
      2:company_registry
      3:director_appointment
      
      CRITICAL:
      For identity documents, if the document is a passport, then the classification  should be like this:
      DOC_ID:identity_document(Passport)

      And For proof of address documents, if the document is a bank statement, then the classification  should be like this:
      DOC_ID:proof_of_address(Bank Statement)

      DO NOT include any explanations or additional text. Each document should be classified on a separate line.
      
      ## Documents to Classify:
    `;
    
    // Add each document to the prompt
    documentsToClassify.forEach(doc => {
      batchPrompt += `\n\n### DOCUMENT ID: ${doc.document.id} - ${doc.document.document_name}\n\n`;
      
      // Truncate content to reduce token usage (first 1500 chars should be enough for classification)
      const truncatedContent = doc.content.length > 1500
        ? doc.content.substring(0, 1500) + "... [content truncated]"
        : doc.content;
      
      batchPrompt += truncatedContent;
      batchPrompt += "\n----------\n";
    });
    
    try {
      // Import the correct agent
      console.log("Sending batch classification request to AI...");
      const response = await documentClassificationAgent.stream([
        { role: 'user', content: batchPrompt }
      ]);
      
      let classificationResult = '';
      try {
        for await (const chunk of response.textStream) {
          classificationResult += chunk;
        }
      } catch (streamError) {
        console.warn("Stream error encountered but continuing with parsing:", 
          typeof streamError === 'object' && streamError !== null ? String(streamError) : 'Unknown error');
      }
      
      console.log("Received batch classification response from AI");
      
      // Parse the batch classification results
      const classificationLines = classificationResult.trim().split('\n');
      const classificationMap = new Map();
      
      classificationLines.forEach(line => {
        const match = line.match(/(\d+):([\w_]+)/);
        if (match) {
          const [_, docId, docType] = match;
          classificationMap.set(parseInt(docId), docType.trim().toLowerCase());
        }
      });
      
      // Prepare the classified documents array
      const classifiedDocuments = [...preClassifiedDocuments];
      
      // Process the documents that needed classification
      for (const doc of documentsToClassify) {
        const documentType = classificationMap.get(doc.document.id) || 'unknown';
        
        try {
          // Update document type in database with client_id if available
          const updateParams: any = { document_type: documentType };
          if (client_id) {
            updateParams.client_id = client_id;
          }
          
          await axios.patch(`http://localhost:3000/kyc/documents/${doc.document.id}`, updateParams);
          
          console.log(`Classified document ${doc.document.id}: ${doc.document.document_name} as ${documentType}`);
        } catch (updateError: any) {
          console.error(`Error updating document type in database: ${updateError.message}`);
        }
        
        classifiedDocuments.push({
          id: doc.document.id,
          document_name: doc.document.document_name,
          document_type: documentType,
          content: doc.content
        });
      }
      
      // Make sure every returned object has a non-null document_type value
      return {
        classifiedDocuments: classifiedDocuments.map(doc => ({
        id: doc.id,
        document_name: doc.document_name,
        document_type: doc.document_type || 'unknown',
        content: doc.content
        })),
        client_id
      };
    } catch (error) {
      console.error('Error in batch document classification:', error);
      
      // Fallback: return documents with "unknown" type to not block the workflow
      return {
        classifiedDocuments: documentContents.map(doc => ({
        id: doc.document.id,
        document_name: doc.document.document_name,
        document_type: doc.document.document_type || 'unknown',
        content: doc.content
        })),
        client_id
      };
    }
  },
});

// Step 4: Process documents and extract information
const extractInformation = new Step({
  id: 'extract-information',
  description: 'Extracts structured information about individuals and companies',
  inputSchema: z.object({
    classifiedDocuments: z.array(documentClassificationSchema),
    client_id: z.number(),
  }),
  outputSchema: z.object({
    extractedData: extractedDataSchema,
    client_id: z.number(),
  }),
  execute: async ({ context }) => {
    const result = context?.getStepResult(classifyDocuments);
    if (!result || !result.classifiedDocuments || result.classifiedDocuments.length === 0) {
      throw new Error('No classified documents found');
    }

    const { classifiedDocuments, client_id } = result;
    console.log(`Extracting information from ${classifiedDocuments.length} documents...`);
    
    // Prepare extraction prompt with document contents
    let prompt = `
      # KYC Document Processing Agent

      You are a specialized KYC (Know Your Customer) document processing agent. Your task is to analyze the following documents and extract structured information about individuals and companies.
      
      ## Extraction Guidelines:
      
      ### For Individuals:
      - Full names (including any alternative names/spellings)
      - ID numbers (NRIC, passport, etc.) with sources
      - ID types with sources
      - Nationalities with sources
      - Addresses with sources
      - Email addresses with sources
      - Phone numbers with sources
      - Roles in companies with sources
      - Shares owned (if any) with sources
      - Price per share (if available) with sources
      
      ### For Companies:
      - Company names
      - Registration numbers with sources
      - Jurisdictions/countries with sources
      - Addresses with sources
      - Directors with sources
      - Company activities (IMPORTANT: Always extract business activities like "Investment Holding", "Technology Services", etc.)
      - Shareholders with detailed breakdown (IMPORTANT: Extract ALL shareholders with their ownership percentages):
        - For each shareholder, include their name and ownership percentage
        - Note if they are beneficial owners
        - If a company owns shares in another company (subsidiaries), make sure to capture this relationship
        - Include both direct shareholders and ultimate beneficial owners
      - Shares issued with sources (total number of shares issued by the company)
      - Price per share (if available) with sources

      ## IMPORTANT EXTRACTION REQUIREMENTS:
      - Pay special attention to company activities - this is often listed as "Principal Business Activities", "Nature of Business", etc.
      - For shareholding information, look for sections like "Beneficial Owners", "Ultimate Beneficial Owners", "Subsidiaries", etc.
      - If a company has subsidiaries (e.g., "Company X owns 100% of Company Y"), this should be captured in the shareholders field for Company Y.
      - When documents refer to ownership percentages, ALWAYS extract these details.
      
      ## Documents to Analyze:
    `;
    
    classifiedDocuments.forEach((doc, index) => {
      prompt += `\n### Document ${doc.id}: ${doc.document_name} (Type: ${doc.document_type})\n\n`;
      
      // Truncate very long documents to avoid token limits
      let content = doc.content;

      
      prompt += `${content}\n\n---\n\n`;
    });
    
    prompt += `
      ## Important:
      - Maintain meticulous source tracking. For each piece of information, record which document it came from.
      - Handle conflicting information by including all versions with their respective sources.
      - If information is implied rather than explicitly stated, note this.
      - Also take document name in consideration while gathering all that information, like if a document name is director registry for some company then that document may contain information about directors of that company. So keep document names in consideration also.
      
      ## Output Format:
      Return ONLY a valid JSON object with the following structure. Ensure ALL property names are double-quoted:
      {
        "individuals": [
          {
            "full_name": "Person's name",
            "alternative_names": ["Other names found"],
            "id_numbers": {"Document 1 Name": {"documentId": 1, "documentName": "Doc Name", "documentType": "identity_document", "value": "ID123456"}},
            "id_types": {"Document 1 Name": {"documentId": 1, "documentName": "Doc Name", "documentType": "identity_document", "value": "Passport"}},
            "nationalities": {"Document 1 Name": {"documentId": 1, "documentName": "Doc Name", "documentType": "identity_document", "value": "Singapore"}},
            "addresses": {"Document 2 Name": {"documentId": 2, "documentName": "Doc Name", "documentType": "proof_of_address", "value": "123 Main St"}},
            "emails": {"Document 3 Name": {"documentId": 3, "documentName": "Doc Name", "documentType": "company_registry", "value": "person@example.com"}},
            "phones": {"Document 3 Name": {"documentId": 3, "documentName": "Doc Name", "documentType": "company_registry", "value": "+1234567890"}},
            "roles": {"Company Name": "Director"},
            "shares_owned": {"Document 4 Name": {"documentId": 4, "documentName": "Doc Name", "documentType": "shareholder_registry", "companyName": "xyz company","value": "1000 shares (60%)"}}
          }
        ],
        "companies": [
          {
            "company_name": "Company name",
            "registration_number": {"Document 3 Name": {"documentId": 3, "documentName": "Doc Name", "documentType": "company_registry", "value": "REG123456"}},
            "jurisdiction": {"Document 3 Name": {"documentId": 3, "documentName": "Doc Name", "documentType": "company_registry", "value": "Singapore"}},
            "address": {"Document 3 Name": {"documentId": 3, "documentName": "Doc Name", "documentType": "company_registry", "value": "123 Business St"}},
            "directors": ["Director 1", "Director 2"],
            "shareholders": ["Alice Tan (60%)", "Michael Zhou (40%)"],
            "company_activities": {"Document 3 Name": {"documentId": 3, "documentName": "Doc Name", "documentType": "company_profile", "value": "Investment Holding"}},
            "shares_issued": {"Document 4 Name": {"documentId": 4, "documentName": "Doc Name", "documentType": "shareholder_registry", "value": "1000 shares"}}
          }
        ]
      }
      
      IMPORTANT JSON FORMATTING RULES:
      1. ALL property names MUST be in double quotes: "property": value
      2. Strings MUST use double quotes: "value"
      3. Do not use single quotes anywhere in the JSON
      4. Escape any double quotes within string values: "He said \\"hello\\""
      5. Do not include trailing commas in arrays or objects
      6. For non-English text like Chinese characters (e.g., 谭志聪), encode properly as UTF-8 characters, not as \\u escape sequences
      7. Avoid line breaks within string values
      8. All objects must have matching braces {}
      9. All arrays must have matching brackets []
      10. The entire response must be a complete, valid JSON object
      11. NEVER use the same key twice in the same object
      12. For multiple values, use arrays: "activities": ["value1", "value2"] 
      13. Do not include ANY markdown formatting, code blocks, or explanations

      Your response should start with "{" and end with "}". Do not include any explanations, markdown, or code blocks.
    `;
    
    try {
      console.log("Sending prompt to extract information...");
      const response = await kycAnalysisAgent.stream([
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
      
      console.log("resultText is", resultText);
      // Clean up the response text and extract the JSON
      let jsonText = resultText.trim();
      
      // Remove any non-JSON prefix/suffix content
      const startIdx = jsonText.indexOf('{');
      const endIdx = jsonText.lastIndexOf('}');
      
      if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        console.error("Could not find valid JSON object markers in response");
        throw new Error('Could not locate JSON object in response');
      }
      
      jsonText = jsonText.substring(startIdx, endIdx + 1);
      
      // Remove any markdown code block markers
      jsonText = jsonText.replace(/```(json)?|```/g, '').trim();
      
      try {
        // Sanitize JSON to fix common formatting issues
        // 1. Fix unquoted property names (convert from JavaScript object syntax to valid JSON)
        jsonText = jsonText.replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        
        // 2. Fix trailing commas in arrays and objects
        jsonText = jsonText.replace(/,\s*([\]}])/g, '$1');
        
        // Log first 100 chars of sanitized JSON for debugging
        console.log(`Sanitized JSON (first 100 chars): ${jsonText.substring(0, 100)}...`);
        
        // Parse the JSON
        let extractedData;
        try {
          extractedData = JSON.parse(jsonText);
        } catch (parseError) {
          console.error('Error parsing JSON after sanitization:', parseError);
          console.error('JSON position details:', {
            errorPosition: (parseError as SyntaxError).message.match(/position (\d+)/)?.[1],
            textAroundError: jsonText.substring(
              Math.max(0, parseInt((parseError as SyntaxError).message.match(/position (\d+)/)?.[1] || '0') - 30),
              Math.min(jsonText.length, parseInt((parseError as SyntaxError).message.match(/position (\d+)/)?.[1] || '0') + 30)
            )
          });
          throw parseError;
        }
        
        console.log(`Successfully extracted information about ${extractedData.individuals?.length || 0} individuals and ${extractedData.companies?.length || 0} companies`);
        
        // Make sure arrays are defined
        if (!extractedData.individuals) extractedData.individuals = [];
        if (!extractedData.companies) extractedData.companies = [];
        
        return { 
          extractedData,
          client_id 
        };
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        throw new Error(`Failed to parse extracted information`);
      }
    } catch (error: unknown) {
      console.error('Error extracting information:', error);
      throw new Error(`Information extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Step 5: Process discrepancies
const processDiscrepancies = new Step({
  id: 'process-discrepancies',
  description: 'Identifies discrepancies in the extracted information',
  inputSchema: z.object({
    extractedData: extractedDataSchema,
    client_id: z.number(),
  }),
  outputSchema: z.object({
    extractedData: extractedDataSchema,
    client_id: z.number(),
  }),
  execute: async ({ context }) => {
    const extractedData = context?.getStepResult(extractInformation);
    if (!extractedData) {
      throw new Error('No extracted data found');
    }

    console.log("Processing discrepancies in extracted data...");
    
    // Process individuals
    extractedData.extractedData.individuals.forEach((individual: any) => {
      const discrepancies: { field: string; values: string[]; sources: string[] }[] = [];
      
      // Check for discrepancies in each field with multiple sources
      checkFieldDiscrepancies(individual, 'id_numbers', discrepancies);
      checkFieldDiscrepancies(individual, 'id_types', discrepancies);
      checkFieldDiscrepancies(individual, 'nationalities', discrepancies);
      checkFieldDiscrepancies(individual, 'addresses', discrepancies);
      checkFieldDiscrepancies(individual, 'emails', discrepancies);
      checkFieldDiscrepancies(individual, 'phones', discrepancies);
      
      individual.discrepancies = discrepancies;
    });
    
    // Process companies
    extractedData.extractedData.companies.forEach((company: any) => {
      const discrepancies: { field: string; values: string[]; sources: string[] }[] = [];
      
      // Check for discrepancies in each field with multiple sources
      checkFieldDiscrepancies(company, 'registration_number', discrepancies);
      checkFieldDiscrepancies(company, 'jurisdiction', discrepancies);
      checkFieldDiscrepancies(company, 'address', discrepancies);
      checkFieldDiscrepancies(company, 'price_per_share', discrepancies);
      
      company.discrepancies = discrepancies;
    });
    
    // Return both extractedData and client_id
    return {
      extractedData: extractedData.extractedData,
      client_id: extractedData.client_id
    };
  },
});

// Helper: check for discrepancies in a field with strong typing
function checkFieldDiscrepancies(
  entity: any,
  field: string,
  discrepancies: { field: string; values: string[]; sources: string[] }[]
): void {
  const valObj = entity[field];
  if (valObj && typeof valObj === 'object' && !Array.isArray(valObj)) {
    // Collect unique values and their sources
    const values: Set<string> = new Set<string>();
    const sources: string[] = [];
    Object.entries(valObj).forEach(
      ([srcKey, srcInfo]: [string, any]) => {
        if (srcInfo && typeof srcInfo.value === 'string') {
          values.add(srcInfo.value);
          sources.push(srcKey);
        }
      }
    );
    // If multiple unique values detected
    if (values.size > 1) {
      discrepancies.push({
        field,
        values: Array.from(values),
        sources,
      });
    }
  }
}

// Step 6: Store extracted information
const storeInformation = new Step({
  id: 'store-information',
  description: 'Stores the extracted information in the database',
  inputSchema: z.object({
    extractedData: extractedDataSchema,
    client_id: z.number(),
  }),
  outputSchema: z.object({
    extractedData: extractedDataSchema,
    client_id: z.number(),
  }),
  execute: async ({ context }) => {
    const result = context?.getStepResult(processDiscrepancies);
    if (!result) {
      throw new Error('No processed data found');
    }
    
    const { extractedData, client_id } = result;

    console.log("Storing extracted information...");
    
    // Store individuals with upsert logic
    for (const individual of extractedData.individuals) {
      // Add client_id to individual object before storing
      (individual as Individual & { client_id: number }).client_id = client_id;
      try {
        // Check if individual exists before inserting
        const checkResponse = await axios.get(
          (individual as Individual & { client_id?: number }).client_id ? 
          `http://localhost:3000/kyc/individuals/by-name/${encodeURIComponent(individual.full_name)}?client_id=${(individual as Individual & { client_id: number }).client_id}` :
          `http://localhost:3000/kyc/individuals/by-name/${encodeURIComponent(individual.full_name)}`
        );
        
        if (checkResponse.data.individual) {
          // Update existing individual
          await axios.put(`http://localhost:3000/kyc/individuals/${checkResponse.data.individual.id}`, individual);
          console.log(`Updated existing individual: ${individual.full_name}`);
        } else {
          // Insert new individual
          await axios.post('http://localhost:3000/kyc/individuals', individual);
          console.log(`Stored new individual: ${individual.full_name}`);
        }
      } catch (error: unknown) {
        const axiosError = error as { response?: { status: number } };
        if (axiosError.response && axiosError.response.status === 404) {
          // Individual not found, create new
          await axios.post('http://localhost:3000/kyc/individuals', individual);
          console.log(`Stored new individual: ${individual.full_name}`);
        } else {
          console.error(`Error storing individual ${individual.full_name}:`, error);
        }
      }
    }
    
    // Store companies with upsert logic
    for (const company of extractedData.companies) {
      // Add client_id to company object before storing
      (company as CompanyRecord & { client_id?: number }).client_id = client_id;
      try {
        // Check if company exists before inserting
        const checkResponse = await axios.get(
          (company as CompanyRecord & { client_id?: number }).client_id ? 
          `http://localhost:3000/kyc/companies/by-name/${encodeURIComponent(company.company_name)}?client_id=${(company as CompanyRecord & { client_id: number }).client_id}` :
          `http://localhost:3000/kyc/companies/by-name/${encodeURIComponent(company.company_name)}`
        );
        
        if (checkResponse.data.company) {
          // Update existing company
          await axios.put(`http://localhost:3000/kyc/companies/${checkResponse.data.company.id}`, company);
          console.log(`Updated existing company: ${company.company_name}`);
        } else {
          // Insert new company
          await axios.post('http://localhost:3000/kyc/companies', company);
          console.log(`Stored new company: ${company.company_name}`);
        }
        
        // Process directors for this company after storing/updating
        await processDirectorsForCompany(company);
        // Process shareholders for this company after storing directors
        await processShareholdersForCompany(company);
      } catch (error: unknown) {
        const axiosError = error as { response?: { status: number } };
        if (axiosError.response && axiosError.response.status === 404) {
          // Company not found, create new
          await axios.post('http://localhost:3000/kyc/companies', company);
          console.log(`Stored new company: ${company.company_name}`);
          
          // Process directors for this new company
          await processDirectorsForCompany(company);
          // Process shareholders for this new company
          await processShareholdersForCompany(company);
        } else {
          console.error(`Error storing company ${company.company_name}:`, error);
        }
      }
    }
    
    return {
      extractedData,
      client_id
    };
  },
});

// Process directors for company and store in dedicated table
async function processDirectorsForCompany(company: CompanyRecord): Promise<void> {
  // Keep track of document sources for traceability
  const documentSources: {[key: string]: {documentId: number, documentType: string}} = {};
  console.log(`\n=== Processing directors for company: ${company.company_name} ===\n`);
  
  // Log company details table with verification status
  console.log("COMPANY DETAILS TABLE");
  console.log("===================");
  console.log(`a. Intended Company Name: ${company.company_name}`);
  
  // Extract alternative names
  const altNames: string[] = company.alternative_names || [];
  console.log(`b. Alternative Company Name 1: ${altNames[0] || "N/A"}`);
  console.log(`c. Alternative Company Name 2: ${altNames[1] || "N/A"}`);
  
  // Extract company activities
  const actInfo = getValueAndSource(company.company_activities);
  console.log(`d. Company Activities: ${actInfo.value || "Unknown"}`);
  
  // Extract registered address
  let registeredAddress = "Unknown";
  if (company.address && Object.keys(company.address).length > 0) {
    const addressSource = Object.values(company.address)[0] as Source;
    registeredAddress = addressSource.value || "Unknown";
  }
  console.log(`e. Intended Registered Address: ${registeredAddress}`);
  
  // Find relevant individuals who are directors of this company
  const directorNames = company.directors || [];
  if (directorNames.length === 0) {
    console.log("No directors found for this company\n");
    return;
  }
  
  // Print directors table header with updated fields
  console.log("\nDIRECTORS TABLE");
  console.log("==============");
  console.log("| Name (Source) | ID No. (Source) | ID Type (Source) | Nationality (Source) | Residential Address (Source) | Tel. No. (Source) | Email Address (Source) | Verification Status | KYC Status |");
  console.log("|---------------|-----------------|------------------|--------------------|-----------------------------|------------------|---------------------|-------------------|-------------|");
  
  let companyVerificationStatus = "verified";
  
  try {
    // Query individuals API with client_id if available
    const response = await axios.get(company.client_id ? 
      `http://localhost:3000/kyc/individuals?client_id=${company.client_id}` :
      'http://localhost:3000/kyc/individuals');
    const allIndividuals = response.data.individuals || [];
    
    for (const directorName of directorNames) {
      const director = allIndividuals.find((ind: any) => ind.full_name === directorName);
      
      if (!director) {
        // Log missing director information
        console.log(`| ${directorName} (Unknown) | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | pending | Missing all required information |`);
        companyVerificationStatus = "pending";
        
        // Store minimal data about this missing director
        const directorData = {
          client_id: (company as CompanyRecord & { client_id?: number }).client_id,
          company_name: company.company_name,
          director_name: directorName,
          verification_status: 'pending',
          kyc_status: 'Missing all required information'
        };
        
        try {
          await axios.post('http://localhost:3000/kyc/directors', directorData);
        } catch (storeError: any) {
          console.error(`Error storing director data for ${directorName}:`, storeError?.message || storeError);
        }
        
        continue;
      }
      
      // Extract information and sources
      const idInfo = getValueAndSource(director.id_numbers);
      const nationalityInfo = getValueAndSource(director.nationalities);
      const addressInfo = getValueAndSource(director.addresses);
      const phoneInfo = getValueAndSource(director.phones);
      const emailInfo = getValueAndSource(director.emails);
      
      // Track document sources in a non-overlapping way
      const documentSourcesMap: Record<string, {documentId: number, documentType: string}> = {};
      if (idInfo.documentId) documentSourcesMap['id_number'] = {documentId: idInfo.documentId, documentType: idInfo.documentType || ''};
      if (nationalityInfo.documentId) documentSourcesMap['nationality'] = {documentId: nationalityInfo.documentId, documentType: nationalityInfo.documentType || ''};
      if (addressInfo.documentId) documentSourcesMap['address'] = {documentId: addressInfo.documentId, documentType: addressInfo.documentType || ''};
      if (phoneInfo.documentId) documentSourcesMap['phone'] = {documentId: phoneInfo.documentId, documentType: phoneInfo.documentType || ''};
      if (emailInfo.documentId) documentSourcesMap['email'] = {documentId: emailInfo.documentId, documentType: emailInfo.documentType || ''};
      
      // Infer ID type based on nationality and ID number if not already present
      let idType = director.id_types ? getValueAndSource(director.id_types).value : null;
      if (!idType && nationalityInfo.value && idInfo.value) {
        idType = inferIdType(nationalityInfo.value, idInfo.value);
      }
      
      const idTypeInfo = director.id_types ? 
        getValueAndSource(director.id_types) : 
        { 
          value: idType, 
          source: "Inferred from nationality", 
          documentId: nationalityInfo.documentId, 
          sourceJson: JSON.stringify({
            source: "Inferred from nationality", 
            documentId: nationalityInfo.documentId
          }) 
        };
      
      // Check for document types in sources
      const hasIdDocument = checkDocumentTypeExists(director.id_numbers, ['identity_document', 'nric', 'passport', 'fin']);
      const hasAddressProof = checkDocumentTypeExists(director.addresses, ['proof_of_address']);
      
      // Determine verification status and KYC status
      let verificationStatus = "verified";
      let kycStatus: string[] = [];
      
      // Check for discrepancies
      if (director.discrepancies && director.discrepancies.length > 0) {
        verificationStatus = "not_verified";
        director.discrepancies.forEach((d: Discrepancy) => {
          kycStatus.push(`Discrepancy in ${d.field}: ${d.values.join(" vs ")} (Sources: ${d.sources.join(", ")})`);
        });
      } else {
        // Check for missing requirements
        const missingRequirements: string[] = [];
        
        if (!hasIdDocument) {
          missingRequirements.push("Missing identification document");
        }
        if (!hasAddressProof) {
          missingRequirements.push("Missing proof of address");
        }
        if (!phoneInfo.value) {
          missingRequirements.push("Missing telephone number");
        } else if (nationalityInfo.value?.toLowerCase().includes("singapore") && !phoneInfo.value.includes("+65")) {
          missingRequirements.push("Local (+65) phone number required for Singapore director");
        }
        if (!emailInfo.value) {
          missingRequirements.push("Missing email address");
        }
        
        if (missingRequirements.length > 0) {
          verificationStatus = "pending";
          kycStatus = missingRequirements;
        }
      }
      
      // Update company verification status if needed
      if (verificationStatus !== "verified") {
        companyVerificationStatus = "pending";
      }
      
      // Format the KYC status for display
      const kycStatusDisplay = kycStatus.length > 0 ? kycStatus.join("; ") : "Complete";
      
      // Log director information with sources
      console.log(
        `| ${director.full_name} (${getSourceInfo(director.full_name_source)}) | ` +
        `${idInfo.value || "Missing"} (${idInfo.source}) | ` +
        `${idTypeInfo.value || "Missing"} (${idTypeInfo.source}) | ` +
        `${nationalityInfo.value || "Missing"} (${nationalityInfo.source}) | ` +
        `${addressInfo.value || "Missing"} (${addressInfo.source}) | ` +
        `${phoneInfo.value || "Missing"} (${phoneInfo.source}) | ` +
        `${emailInfo.value || "Missing"} (${emailInfo.source}) | ` +
        `${verificationStatus} | ${kycStatusDisplay} |`
      );
      
      // Query individuals API 
      await axios.post('http://localhost:3000/kyc/directors', {
        client_id: company.client_id,
        company_name: company.company_name,
        director_name: director.full_name,
        id_number: idInfo.value,
        id_number_source: idInfo.sourceJson,
        id_type: idTypeInfo.value,
        id_type_source: idTypeInfo.sourceJson,
        nationality: nationalityInfo.value,
        nationality_source: nationalityInfo.sourceJson,
        residential_address: addressInfo.value,
        residential_address_source: addressInfo.sourceJson,
        tel_number: phoneInfo.value,
        tel_number_source: phoneInfo.sourceJson,
        email_address: emailInfo.value,
        email_address_source: emailInfo.sourceJson,
        verification_status: verificationStatus,
        kyc_status: kycStatusDisplay
      });
      
      console.log(`Stored/updated director information for ${director.full_name}`);
    }
  } catch (error: any) {
    console.error("Error fetching individuals:", error?.message || error);
    companyVerificationStatus = "pending";
  }
  
  console.log("\nCompany Verification Status:", companyVerificationStatus);
  console.log("\n=== End of Processing ===\n");
}

// Process shareholders for a company and store in dedicated table
async function processShareholdersForCompany(company: CompanyRecord): Promise<void> {
  // Keep track of document sources for traceability
  const documentSources: {[key: string]: {documentId: number, documentType: string}} = {};
  console.log(`\n=== Processing shareholders for company: ${company.company_name} ===\n`);
  console.log("SHAREHOLDERS TABLE");
  console.log("==================");
  console.log("| Name (Source) | Shares Owned (Source) | Price per Share (Source) | ID No. (Source) | ID Type (Source) | Nationality (Source) | Address (Source) | Tel. No. (Source) | Email Address (Source) | Verification Status | KYC Status |");
  console.log("|--------------|------------------------|-------------------------|-----------------|------------------|---------------------|-----------------|------------------|---------------------|-------------------|-------------|");
  let overallStatus = "verified";
  try {
    // Query individuals and companies API with client_id if available
    const indResp = await axios.get(company.client_id ?
      `http://localhost:3000/kyc/individuals?client_id=${company.client_id}` :
      'http://localhost:3000/kyc/individuals');
    const allIndividuals = indResp.data.individuals || [];
    
    const compResp = await axios.get(company.client_id ?
      `http://localhost:3000/kyc/companies?client_id=${company.client_id}` :
      'http://localhost:3000/kyc/companies');
    const allCompanies = compResp.data.companies || [];
    console.log("Shareholders:", company.shareholders);
    for (const shEntry of company.shareholders || []) {
      // parse "Name (XX%)" entries
      let parsedName = shEntry;
      let sharePctStr = "";
      const shareMatch = shEntry.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (shareMatch) {
        parsedName = shareMatch[1].trim();
        sharePctStr = shareMatch[2].trim();
      }
      let isIndividual = false;
      const individual = allIndividuals.find((ind: any) => ind.full_name.trim().toLowerCase() === parsedName.toLowerCase());
      if (individual) isIndividual = true;
      let idInfo, idTypeInfo, nationalityInfo, addressInfo, phoneInfo, emailInfo, sharesInfo, priceInfo;
      let verificationStatus = "verified";
      let kycStatus: string[] = [];
      
      if (isIndividual) {
        // Process individual shareholder
        idInfo = getValueAndSource(individual.id_numbers);
        nationalityInfo = getValueAndSource(individual.nationalities);
        addressInfo = getValueAndSource(individual.addresses);
        phoneInfo = getValueAndSource(individual.phones);
        emailInfo = getValueAndSource(individual.emails);
        sharesInfo = sharePctStr ? 
          { value: sharePctStr, source: "Declaration", sourceJson: JSON.stringify({source: "Declaration"}) } : 
          getValueAndSource(individual.shares_owned);
        priceInfo = getValueAndSource(individual.price_per_share);
        
        // Track document sources
        if (idInfo.documentId) documentSources[`id_number`] = {documentId: idInfo.documentId, documentType: idInfo.documentType || ''};
        if (nationalityInfo.documentId) documentSources[`nationality`] = {documentId: nationalityInfo.documentId, documentType: nationalityInfo.documentType || ''};
        if (addressInfo.documentId) documentSources[`address`] = {documentId: addressInfo.documentId, documentType: addressInfo.documentType || ''};
        if (phoneInfo.documentId) documentSources[`phone`] = {documentId: phoneInfo.documentId, documentType: phoneInfo.documentType || ''};
        if (emailInfo.documentId) documentSources[`email`] = {documentId: emailInfo.documentId, documentType: emailInfo.documentType || ''};
        if (sharesInfo.documentId) documentSources[`shares_owned`] = {documentId: sharesInfo.documentId, documentType: sharesInfo.documentType || ''};
        if (priceInfo.documentId) documentSources[`price_per_share`] = {documentId: priceInfo.documentId, documentType: priceInfo.documentType || ''};
        
        // Infer ID type based on nationality and ID number if not already present
        let idType = individual.id_types ? getValueAndSource(individual.id_types).value : null;
        if (!idType && nationalityInfo.value && idInfo.value) {
          idType = inferIdType(nationalityInfo.value, idInfo.value);
        }
        
        idTypeInfo = individual.id_types ? 
          getValueAndSource(individual.id_types) : 
          { 
            value: idType, 
            source: "Inferred from nationality", 
            documentId: nationalityInfo.documentId, 
            sourceJson: JSON.stringify({
              source: "Inferred from nationality", 
              documentId: nationalityInfo.documentId
            }) 
          };
        const isLocal = nationalityInfo.value?.toLowerCase().includes('singapore');
        const hasNRIC = checkDocumentTypeExists(individual.id_numbers, ['nric']);
        const hasPassport = checkDocumentTypeExists(individual.id_numbers, ['passport']);
        const hasAddrProof = checkDocumentTypeExists(individual.addresses, ['proof_of_address']);
        
        if (individual.discrepancies?.length) {
          verificationStatus = "not_verified";
          individual.discrepancies!.forEach((d: Discrepancy) => kycStatus.push(`Discrepancy in ${d.field}: ${d.values.join(" vs ")} (Sources: ${d.sources.join(", ")})`));
        } else {
          const missing: string[] = [];
          if (isLocal && !hasNRIC) missing.push("Missing NRIC");
          if (!isLocal && !hasPassport) missing.push("Missing passport");
          if (!hasAddrProof) missing.push("Missing proof of address");
          if (!emailInfo.value) missing.push("Missing email");
          if (missing.length) { verificationStatus = "pending"; kycStatus = missing; }
        }
        
        // Store individual shareholder in the shareholders table with field sources
        try {
          await axios.post('http://localhost:3000/kyc/shareholders', {
            client_id: company.client_id,
            company_name: company.company_name,
            shareholder_name: parsedName,
            shares_owned: sharesInfo.value,
            shares_owned_source: sharesInfo.sourceJson,
            price_per_share: priceInfo.value,
            price_per_share_source: priceInfo.sourceJson,
            id_number: idInfo.value,
            id_number_source: idInfo.sourceJson,
            id_type: idTypeInfo.value,
            id_type_source: idTypeInfo.sourceJson,
            nationality: nationalityInfo.value,
            nationality_source: nationalityInfo.sourceJson,
            address: addressInfo.value,
            address_source: addressInfo.sourceJson,
            tel_number: phoneInfo.value,
            tel_number_source: phoneInfo.sourceJson,
            email_address: emailInfo.value,
            email_address_source: emailInfo.sourceJson,
            verification_status: verificationStatus,
            kyc_status: kycStatus.length ? kycStatus.join("; ") : "Complete",
            is_company: 0  // Individual
          });
          console.log(`Stored/updated individual shareholder information for ${parsedName}`);
        } catch (storeError: any) {
          console.error(`Error storing individual shareholder data for ${parsedName}:`, storeError?.message || storeError);
        }
        
      } else {
        // Process corporate shareholder
        const compEnt = allCompanies.find((c: any) => c.company_name.trim().toLowerCase() === parsedName.toLowerCase());
        if (!compEnt) {
          console.log(`| ${parsedName} (Unknown) | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | pending | Missing info |`);
          overallStatus = "pending";
          
          // Store minimal data about this unknown corporate shareholder
          try {
            await axios.post('http://localhost:3000/kyc/shareholders', {
              client_id: company.client_id,
              company_name: company.company_name,
              shareholder_name: parsedName,
              shares_owned: sharePctStr,
              verification_status: 'pending',
              kyc_status: 'Missing information',
              is_company: 1  // Company
            });
          } catch (storeError: any) {
            console.error(`Error storing unknown corporate shareholder data for ${parsedName}:`, storeError?.message || storeError);
          }
          
          continue;
        }
        
        idInfo = getValueAndSource(compEnt.registration_number);
        idTypeInfo = { value: "Registration Number", source: "System", sourceJson: JSON.stringify({source: "System"}) };
        nationalityInfo = getValueAndSource(compEnt.jurisdiction);
        addressInfo = getValueAndSource(compEnt.address);
        phoneInfo = { value: null, source: "No source", sourceJson: JSON.stringify({source: "No source"}) };
        emailInfo = getValueAndSource(compEnt.emails);
        sharesInfo = sharePctStr ? 
          { value: sharePctStr, source: "Declaration", sourceJson: JSON.stringify({source: "Declaration"}) } : 
          getValueAndSource(compEnt.shares_issued);
        priceInfo = getValueAndSource(compEnt.price_per_share);
        const isLocalCorp = nationalityInfo.value?.toLowerCase() === 'singapore';
        const hasBizfile = checkDocumentTypeExists(compEnt.company_activities, ['bizfile']);
        const hasIncorp = checkDocumentTypeExists(compEnt.registration_number, ['incorporation', 'incumbency']);
        const hasDirReg = checkDocumentTypeExists(compEnt.company_activities, ['register_of_directors']);
        const hasAddrProofCorp = checkDocumentTypeExists(compEnt.address, ['proof_of_address']);
        const hasMemReg = checkDocumentTypeExists(compEnt.shares_issued, ['register_of_members']);
        
        if (compEnt.discrepancies?.length) {
          verificationStatus = "not_verified";
          compEnt.discrepancies!.forEach((d: Discrepancy) => kycStatus.push(`Discrepancy in ${d.field}: ${d.values.join(" vs ")} (Sources: ${d.sources.join(", ")})`));
        } else {
          const missing: string[] = [];
          if (isLocalCorp && !hasBizfile) missing.push("Missing ACRA Bizfile");
          if (!isLocalCorp) {
            if (!hasIncorp) missing.push("Missing incorporation certificate");
            if (!hasDirReg) missing.push("Missing register of directors");
          }
          if (!hasAddrProofCorp) missing.push("Missing proof of address");
          if (sharesInfo.value && parseFloat(sharesInfo.value) >= 25 && !hasMemReg) missing.push("Missing register of members");
          if (!emailInfo.value) missing.push("Missing email & signatory");
          if (missing.length) { verificationStatus = "pending"; kycStatus = missing; }
        }
        
        // Store corporate shareholder in the shareholders table with field sources
        try {
          await axios.post('http://localhost:3000/kyc/shareholders', {
            client_id: company.client_id,
            company_name: company.company_name,
            shareholder_name: parsedName,
            shares_owned: sharesInfo.value,
            shares_owned_source: sharesInfo.sourceJson,
            price_per_share: priceInfo.value,
            price_per_share_source: priceInfo.sourceJson,
            id_number: idInfo.value,
            id_number_source: idInfo.sourceJson,
            id_type: idTypeInfo.value,
            id_type_source: idTypeInfo.sourceJson,
            nationality: nationalityInfo.value,
            nationality_source: nationalityInfo.sourceJson,
            address: addressInfo.value,
            address_source: addressInfo.sourceJson,
            tel_number: phoneInfo.value,
            tel_number_source: phoneInfo.sourceJson,
            email_address: emailInfo.value,
            email_address_source: emailInfo.sourceJson,
            verification_status: verificationStatus,
            kyc_status: kycStatus.length ? kycStatus.join("; ") : "Complete",
            is_company: 1  // Company
          });
          console.log(`Stored/updated corporate shareholder information for ${parsedName}`);
        } catch (storeError: any) {
          console.error(`Error storing corporate shareholder data for ${parsedName}:`, storeError?.message || storeError);
        }
      }
      
      if (verificationStatus !== "verified") overallStatus = "pending";
      const statusDisplay = kycStatus.length ? kycStatus.join("; ") : "Complete";
      console.log(
        `| ${parsedName} | ${sharesInfo.value || "Missing"} (${sharesInfo.source}) | ${priceInfo.value || "Missing"} (${priceInfo.source}) | ${idInfo.value || "Missing"} (${idInfo.source}) | ${idTypeInfo.value || "Missing"} (${idTypeInfo.source}) | ${nationalityInfo.value || "Missing"} (${nationalityInfo.source}) | ${addressInfo.value || "Missing"} (${addressInfo.source}) | ${phoneInfo.value || "Missing"} (${phoneInfo.source}) | ${emailInfo.value || "Missing"} (${emailInfo.source}) | ${verificationStatus} | ${statusDisplay} |`
      );
    }
  } catch (err: any) {
    console.error("Error processing shareholders:", err?.message || err);
    overallStatus = "pending";
  }
  console.log("\nCompany Shareholder KYC Status:", overallStatus);
  console.log("\n=== End of Shareholder Processing ===\n");
}

// Helper function to get value and source from a record
function getValueAndSource(record?: Record<string, Source>): { 
  value: string | null; 
  source: string; 
  documentId?: number; 
  documentType?: string;
  documentName?: string;
  sourceJson?: string; // JSON representation of source for storage
} {
  if (!record || Object.keys(record).length === 0) {
    return { 
      value: null, 
      source: "No source",
      sourceJson: JSON.stringify({source: "No source"}) 
    };
  }
  
  const firstKey = Object.keys(record)[0];
  const source = record[firstKey];
  
  // Prepare source JSON for storage in the database
  const sourceObject = {
    documentId: source.documentId,
    documentName: source.documentName,
    documentType: source.documentType
  };
  
  return { 
    value: source.value, 
    source: source.documentName || "Unknown source",
    documentId: source.documentId,
    documentType: source.documentType,
    documentName: source.documentName,
    sourceJson: JSON.stringify(sourceObject)
  };
}

// Helper function to infer ID type based on nationality
function inferIdType(nationality: string | null, idNumber: string | null): string {
  if (!nationality || !idNumber) return "Unknown";
  
  const natLower = nationality.toLowerCase();
  
  // Singapore ID types
  if (natLower.includes("singapore") || natLower === "sg" || natLower === "sgp") {
    if (idNumber.match(/^[STFG]\d{7}[A-Z]$/)) return "NRIC";
    if (idNumber.match(/^[A-Z]\d{7}[A-Z]$/)) return "FIN";
  }
  
  // Malaysian ID
  if (natLower.includes("malaysia") || natLower === "my" || natLower === "mys") {
    if (idNumber.match(/^\d{6}-\d{2}-\d{4}$/)) return "Malaysian IC";
  }
  
  // Indonesian ID
  if (natLower.includes("indonesia") || natLower === "id" || natLower === "idn") {
    if (idNumber.match(/^\d{16}$/)) return "KTP";
  }
  
  // Chinese ID
  if (natLower.includes("china") || natLower === "cn" || natLower === "chn") {
    if (idNumber.match(/^\d{18}$/) || idNumber.match(/^\d{17}[0-9X]$/)) return "Chinese ID Card";
  }
  
  // Indian ID
  if (natLower.includes("india") || natLower === "in" || natLower === "ind") {
    if (idNumber.match(/^[A-Z]{5}\d{4}[A-Z]$/)) return "PAN Card";
    if (idNumber.match(/^\d{12}$/)) return "Aadhaar";
  }
  
  // Check for passport-like format
  if (idNumber.match(/^[A-Z]\d{7,9}$/)) return "Passport";
  
  return "National ID";
}

// Helper function to format source information
function getSourceInfo(sourceStr: string): string {
  try {
    const sources = JSON.parse(sourceStr || '[]') as Source[];
    if (sources.length === 0) return "No source";
    return sources.map(s => s.documentType).join(", ");
  } catch {
    return "Invalid source";
  }
}

// Helper function to check if a set of records contains required document types
function checkDocumentTypeExists(
  sources: Record<string, Source> | undefined,
  documentTypes: string[]
): boolean {
  if (!sources) return false;
  return Object.values(sources).some(src =>
    documentTypes.some(type =>
      src.documentType.toLowerCase().includes(type.toLowerCase())
    )
  );
}

// Create and commit the workflow
const kycDocumentWorkflow = new Workflow({
  name: 'kyc-document-workflow',
  triggerSchema: workflowTriggerSchema,
})
  .step(fetchDocuments)
  .then(readDocumentContents)
  .then(classifyDocuments)
  .then(extractInformation)
  .then(processDiscrepancies)
  .then(storeInformation)

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  //console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error("Unhandeled rejection");
});

kycDocumentWorkflow.commit();

export { kycDocumentWorkflow };