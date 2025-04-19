import { Step, Workflow } from '@mastra/core/workflows';
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
  company: z.string().describe('The company name to process KYC documents for'),
});

// Document structure from API
const documentSchema = z.object({
  id: z.number(),
  document_name: z.string(),
  document_type: z.string().nullable(),
  file_path: z.string().optional(),
});

// Document content schema
const documentContentSchema = z.object({
  document: z.object({
    id: z.number(),
    document_name: z.string(),
    document_type: z.string().nullable(),
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
  registration_number: z.record(z.string(), sourceSchema).optional(),
  jurisdiction: z.record(z.string(), sourceSchema).optional(),
  address: z.record(z.string(), sourceSchema).optional(),
  corporate_roles: z.record(z.string(), z.string()).optional(),
  directors: z.array(z.string()).optional(),
  shareholders: z.array(z.string()).optional(),
  ownership_information: z.record(z.string(), sourceSchema).optional(),
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
  description: 'Fetches all available documents',
  inputSchema: workflowTriggerSchema,
  outputSchema: z.array(documentSchema),
  execute: async ({ context }) => {
    try {
      console.log("Fetching documents...");
      const response = await axios.get('http://localhost:3000/kyc/documents');
      return response.data.documents;
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw new Error('Failed to fetch documents');
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
    const documents = context?.getStepResult(fetchDocuments);
    if (!documents || documents.length === 0) {
      throw new Error('No documents found');
    }

    const documentContents = [];
    for (const doc of documents) {
      try {
        console.log(`Reading content for document ${doc.id}: ${doc.document_name}`);
        const response = await axios.get(`http://localhost:3000/kyc/documents/${doc.id}/content`);
        documentContents.push({
          document: {
            id: doc.id,
            document_name: doc.document_name,
            document_type: doc.document_type,
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
          },
          content: `Error reading document content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
    return documentContents;
  },
});

// Step 3: Classify documents based on content - OPTIMIZED VERSION
const classifyDocuments = new Step({
  id: 'classify-documents',
  description: 'Determines document types based on content analysis (batched)',
  inputSchema: z.array(documentContentSchema),
  outputSchema: z.array(documentClassificationSchema),
  execute: async ({ context }) => {
    const documentContents = context?.getStepResult(readDocumentContents);
    if (!documentContents || documentContents.length === 0) {
      throw new Error('No document contents found');
    }

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
      return preClassifiedDocuments;
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
      1:identity_document
      2:company_registry
      3:director_appointment
      
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
          // Update document type in database
          await axios.patch(`http://localhost:3000/kyc/documents/${doc.document.id}`, {
            document_type: documentType
          });
          
          console.log(`Classified document ${doc.document.id}: ${doc.document.document_name} as ${documentType}`);
        } catch (updateError) {
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
      return classifiedDocuments.map(doc => ({
        id: doc.id,
        document_name: doc.document_name,
        document_type: doc.document_type || 'unknown',
        content: doc.content
      }));
    } catch (error) {
      console.error('Error in batch document classification:', error);
      
      // Fallback: return documents with "unknown" type to not block the workflow
      return documentContents.map(doc => ({
        id: doc.document.id,
        document_name: doc.document.document_name,
        document_type: doc.document.document_type || 'unknown',
        content: doc.content
      }));
    }
  },
});
// Step 4: Process documents and extract information
const extractInformation = new Step({
  id: 'extract-information',
  description: 'Extracts structured information about individuals and companies',
  inputSchema: z.array(documentClassificationSchema),
  outputSchema: extractedDataSchema,
  execute: async ({ context }) => {
    const classifiedDocuments = context?.getStepResult(classifyDocuments);
    if (!classifiedDocuments || classifiedDocuments.length === 0) {
      throw new Error('No classified documents found');
    }

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
      - Corporate roles (subsidiary, parent company, etc.) with sources (That company is subsidiary or parent of what company)
      - Directors with sources
      - Shareholders with sources
      - Ownership information with sources (Who owns that company)
      - Price per share (if available) with sources
      
      ## Documents to Analyze:
    `;
    
    classifiedDocuments.forEach((doc, index) => {
      prompt += `\n### Document ${doc.id}: ${doc.document_name} (Type: ${doc.document_type})\n\n`;
      
      // Truncate very long documents to avoid token limits
      let content = doc.content;
      if (content.length > 3000) {
        content = content.substring(0, 3000) + "... [content truncated]";
      }
      
      prompt += `${content}\n\n---\n\n`;
    });
    
    prompt += `
      ## Important:
      - Maintain meticulous source tracking. For each piece of information, record which document it came from.
      - Handle conflicting information by including all versions with their respective sources.
      - If information is implied rather than explicitly stated, note this.
      - Also take document name in consideration while gathering all that information, like if a document name is director reqsitry for some company then that document may contain information about directors of that company. So keep document names in consideration also.
      
      ## Output Format:
      Return ONLY a JSON object with the following structure:
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
            "shares_owned": {"Document 4 Name": {"documentId": 4, "documentName": "Doc Name", "documentType": "shareholder_registry", "value": "1000 shares"}}
          }
        ],
        "companies": [
          {
            "company_name": "Company name",
            "registration_number": {"Document 3 Name": {"documentId": 3, "documentName": "Doc Name", "documentType": "company_registry", "value": "REG123456"}},
            "jurisdiction": {"Document 3 Name": {"documentId": 3, "documentName": "Doc Name", "documentType": "company_registry", "value": "Singapore"}},
            "address": {"Document 3 Name": {"documentId": 3, "documentName": "Doc Name", "documentType": "company_registry", "value": "123 Business St"}},
            "corporate_roles": {"Parent Company": "Subsidiary"},
            "directors": ["Director 1", "Director 2"],
            "shareholders": ["Shareholder 1", "Shareholder 2"],
            "ownership_information": {"Document 4 Name": {"documentId": 4, "documentName": "Doc Name", "documentType": "shareholder_registry", "value": "100% owned by Parent Co"}}
          }
        ]
      }
      
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
        // Parse the JSON
        const extractedData = JSON.parse(jsonText);
        
        console.log(`Successfully extracted information about ${extractedData.individuals?.length || 0} individuals and ${extractedData.companies?.length || 0} companies`);
        
        // Make sure arrays are defined
        if (!extractedData.individuals) extractedData.individuals = [];
        if (!extractedData.companies) extractedData.companies = [];
        
        return extractedData;
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        throw new Error(`Failed to parse extracted information`);
      }
    } catch (error) {
      console.error('Error extracting information:', error);
      throw new Error(`Information extraction failed: ${error.message}`);
    }
  },
});
// Step 5: Process discrepancies
const processDiscrepancies = new Step({
  id: 'process-discrepancies',
  description: 'Identifies discrepancies in the extracted information',
  inputSchema: extractedDataSchema,
  outputSchema: extractedDataSchema,
  execute: async ({ context }) => {
    const extractedData = context?.getStepResult(extractInformation);
    if (!extractedData) {
      throw new Error('No extracted data found');
    }

    console.log("Processing discrepancies in extracted data...");
    
    // Process individuals
    extractedData.individuals.forEach(individual => {
      const discrepancies = [];
      
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
    extractedData.companies.forEach(company => {
      const discrepancies = [];
      
      // Check for discrepancies in each field with multiple sources
      checkFieldDiscrepancies(company, 'registration_number', discrepancies);
      checkFieldDiscrepancies(company, 'jurisdiction', discrepancies);
      checkFieldDiscrepancies(company, 'address', discrepancies);
      checkFieldDiscrepancies(company, 'price_per_share', discrepancies);
      
      company.discrepancies = discrepancies;
    });
    
    return extractedData;
  },
});

// Step 6: Store extracted information
const storeInformation = new Step({
  id: 'store-information',
  description: 'Stores the extracted information in the database',
  inputSchema: extractedDataSchema,
  outputSchema: extractedDataSchema,
  execute: async ({ context }) => {
    const extractedData = context?.getStepResult(processDiscrepancies);
    if (!extractedData) {
      throw new Error('No processed data found');
    }

    console.log("Storing extracted information...");
    
    // Store individuals with upsert logic
    for (const individual of extractedData.individuals) {
      try {
        // Check if individual exists before inserting
        const checkResponse = await axios.get(`http://localhost:3000/kyc/individuals/by-name/${encodeURIComponent(individual.full_name)}`);
        
        if (checkResponse.data.individual) {
          // Update existing individual
          await axios.put(`http://localhost:3000/kyc/individuals/${checkResponse.data.individual.id}`, individual);
          console.log(`Updated existing individual: ${individual.full_name}`);
        } else {
          // Insert new individual
          await axios.post('http://localhost:3000/kyc/individuals', individual);
          console.log(`Stored new individual: ${individual.full_name}`);
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
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
      try {
        // Check if company exists before inserting
        const checkResponse = await axios.get(`http://localhost:3000/kyc/companies/by-name/${encodeURIComponent(company.company_name)}`);
        
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
      } catch (error) {
        if (error.response && error.response.status === 404) {
          // Company not found, create new
          await axios.post('http://localhost:3000/kyc/companies', company);
          console.log(`Stored new company: ${company.company_name}`);
          
          // Process directors for this new company
          await processDirectorsForCompany(company);
        } else {
          console.error(`Error storing company ${company.company_name}:`, error);
        }
      }
    }
    
    return extractedData;
  },
});

// Modified function to only log director information
async function processDirectorsForCompany(company) {
  console.log(`\n=== Processing directors for company: ${company.company_name} ===\n`);
  
  // Log company details table
  console.log("COMPANY DETAILS TABLE");
  console.log("===================");
  console.log(`a. Intended Company Name: ${company.company_name}`);
  
  // Extract alternative names if they exist in the data
  const altNames = [];
  if (company.alternative_names) {
    altNames.push(...company.alternative_names);
  }
  console.log(`b. Alternative Company Name 1: ${altNames[0] || "N/A"}`);
  console.log(`c. Alternative Company Name 2: ${altNames[1] || "N/A"}`);
  
  // Try to extract company activities from various fields
  let companyActivities = "Unknown";
  if (company.company_activities) {
    companyActivities = company.company_activities;
  }
  console.log(`d. Company Activities: ${companyActivities}`);
  
  // Extract registered address
  let registeredAddress = "Unknown";
  if (company.address && Object.keys(company.address).length > 0) {
    const addressSource = Object.values(company.address)[0];
    registeredAddress = addressSource.value || "Unknown";
  }
  console.log(`e. Intended Registered Address: ${registeredAddress}`);
  
  console.log(`f. Financial Year End: 31/12/${new Date().getFullYear()}`);
  console.log(`g. Constitution to be Adopted: (i) the model Constitution in the Companies Act in force from time to time`);
  console.log("\n");
  
  // Find relevant individuals who are directors of this company
  const directorNames = company.directors || [];
  if (directorNames.length === 0) {
    console.log("No directors found for this company\n");
    return;
  }
  
  // Print directors table header
  console.log("DIRECTORS TABLE");
  console.log("==============");
  console.log("| Name | ID No. | ID Type | Nationality | Residential Address | Tel. No. | Email Address | Requirements Status |");
  console.log("|------|---------|----------|-------------|-------------------|----------|---------------|-------------------|");
  
  // Try to fetch all individuals
  try {
    const response = await axios.get('http://localhost:3000/kyc/individuals');
    const allIndividuals = response.data.individuals || [];
    
    for (const directorName of directorNames) {
      // Find the director in the fetched individuals
      const director = allIndividuals.find(ind => ind.full_name === directorName);
      
      if (!director) {
        console.log(`| ${directorName} | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | INCOMPLETE |`);
        continue;
      }
      
      // Extract information from director data
      const idNumber = getFirstValue(director.id_numbers);
      const idType = getFirstValue(director.id_types);
      const nationality = getFirstValue(director.nationalities);
      const address = getFirstValue(director.addresses);
      const phone = getFirstValue(director.phones);
      const email = getFirstValue(director.emails);
      
      // Check requirements
      const requirements = [];
      if (!idNumber || !idType) requirements.push("ID Document missing");
      if (!address) requirements.push("Proof of address missing");
      if (!phone) requirements.push("Phone number missing");
      if (nationality?.toLowerCase().includes("singapore") && !phone?.includes("+65")) {
        requirements.push("Local phone number required");
      }
      if (!email) requirements.push("Email missing");
      
      const requirementsStatus = requirements.length === 0 ? "COMPLETE" : `INCOMPLETE (${requirements.join(", ")})`;
      
      // Log director information
      console.log(
        `| ${director.full_name} | ${idNumber || "Missing"} | ${idType || "Missing"} | ` +
        `${nationality || "Missing"} | ${address || "Missing"} | ${phone || "Missing"} | ` +
        `${email || "Missing"} | ${requirementsStatus} |`
      );
      
      // If there are discrepancies, log them
      if (director.discrepancies && director.discrepancies.length > 0) {
        console.log("\nDiscrepancies found for", director.full_name);
        director.discrepancies.forEach(d => {
          console.log(`- ${d.field}: ${d.values.join(" vs ")}`);
          console.log(`  Sources: ${d.sources.join(", ")}`);
        });
      }
    }
  } catch (error) {
    console.error("Error fetching individuals:", error);
  }
  
  console.log("\n=== End of Processing ===\n");
}

// Helper function to extract first value from sourced data
function getFirstValue(sourceObj) {
  if (!sourceObj || Object.keys(sourceObj).length === 0) {
    return null;
  }
  return Object.values(sourceObj)[0]?.value || null;
}

// Step 7: Generate summary tables
const generateSummaryTables = new Step({
  id: 'generate-summary-tables',
  description: 'Generates markdown tables summarizing the extracted information',
  inputSchema: extractedDataSchema,
  outputSchema: workflowResultSchema,
  execute: async ({ context }) => {
    const extractedData = context?.getStepResult(storeInformation);
    if (!extractedData) {
      throw new Error('No stored data found');
    }

    const documents = context?.getStepResult(fetchDocuments);
    
    console.log("Generating summary tables...");
    
    // Generate individuals table
    let individualsTable = "## Master List: Individuals (Detailed View)\n\n";
    
    if (extractedData.individuals.length > 0) {
      // Create header row with all individual names
      individualsTable += "Feature | " + extractedData.individuals.map(i => i.full_name || "Unknown").join(" | ") + "\n";
      individualsTable += "--- | " + extractedData.individuals.map(_ => "---").join(" | ") + "\n";
      
      // Add rows for each feature
      individualsTable += generateFeatureRow("Full Name", extractedData.individuals, i => i.full_name || "Unknown");
      individualsTable += generateFeatureRow("ID Numbers", extractedData.individuals, i => formatSourcedInfo(i.id_numbers));
      individualsTable += generateFeatureRow("ID Type", extractedData.individuals, i => formatSourcedInfo(i.id_types));
      individualsTable += generateFeatureRow("Nationalities", extractedData.individuals, i => formatSourcedInfo(i.nationalities));
      individualsTable += generateFeatureRow("Address", extractedData.individuals, i => formatSourcedInfo(i.addresses));
      individualsTable += generateFeatureRow("Email", extractedData.individuals, i => formatSourcedInfo(i.emails));
      individualsTable += generateFeatureRow("Phone", extractedData.individuals, i => formatSourcedInfo(i.phones));
      individualsTable += generateFeatureRow("Roles", extractedData.individuals, i => formatRoles(i.roles));
      individualsTable += generateFeatureRow("Shares Owned", extractedData.individuals, i => formatSourcedInfo(i.shares_owned));
      individualsTable += generateFeatureRow("Price Per Share", extractedData.individuals, i => formatSourcedInfo(i.price_per_share));
    } else {
      individualsTable += "*No individuals found in the processed documents.*\n";
    }
    
    // Generate companies table
    let companiesTable = "## Master List: Companies (Detailed View)\n\n";
    
    if (extractedData.companies.length > 0) {
      // Create header row with all company names
      companiesTable += "Feature | " + extractedData.companies.map(c => c.company_name || "Unknown").join(" | ") + "\n";
      companiesTable += "--- | " + extractedData.companies.map(_ => "---").join(" | ") + "\n";
      
      // Add rows for each feature
      companiesTable += generateFeatureRow("Company Name", extractedData.companies, c => c.company_name || "Unknown");
      companiesTable += generateFeatureRow("Registration Number", extractedData.companies, c => formatSourcedInfo(c.registration_number));
      companiesTable += generateFeatureRow("Jurisdiction/Country", extractedData.companies, c => formatSourcedInfo(c.jurisdiction));
      companiesTable += generateFeatureRow("Address", extractedData.companies, c => formatSourcedInfo(c.address));
      companiesTable += generateFeatureRow("Corporate Roles", extractedData.companies, c => formatRoles(c.corporate_roles));
      companiesTable += generateFeatureRow("Directors", extractedData.companies, c => formatArray(c.directors));
      companiesTable += generateFeatureRow("Shareholders", extractedData.companies, c => formatArray(c.shareholders));
      companiesTable += generateFeatureRow("Ownership Information", extractedData.companies, c => formatSourcedInfo(c.ownership_information));
      companiesTable += generateFeatureRow("Price Per Share", extractedData.companies, c => formatSourcedInfo(c.price_per_share));
    } else {
      companiesTable += "*No companies found in the processed documents.*\n";
    }
    
    // Write the tables to files
    try {

      const outputDir = path.join(__dirname, '../../output');
      
      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Write individual and company tables
      fs.writeFileSync(path.join(outputDir, 'individuals_table.md'), individualsTable);
      fs.writeFileSync(path.join(outputDir, 'companies_table.md'), companiesTable);
      
      // Write a combined report
      const combinedReport = `# KYC Document Processing Report
      
Date: ${new Date().toISOString().split('T')[0]}

## Processing Summary
- Total Documents Processed: ${documents?.length || 0}
- Individuals Extracted: ${extractedData.individuals.length}
- Companies Extracted: ${extractedData.companies.length}

${individualsTable}

${companiesTable}
      `;
      
      fs.writeFileSync(path.join(outputDir, 'kyc_report.md'), combinedReport);
      
      console.log("Generated tables and saved to output directory.");
    } catch (fileError) {
      console.error("Error writing tables to files:", fileError);
    }
    
    return {
      status: 'success',
      message: 'KYC document processing completed successfully',
      summary: {
        individuals_processed: extractedData.individuals.length,
        companies_processed: extractedData.companies.length,
        documents_processed: documents?.length || 0,
      },
      tables: {
        individuals: individualsTable,
        companies: companiesTable,
      },
    };
  },
});

// Helper functions for table generation and discrepancy processing

function checkFieldDiscrepancies(entity, field, discrepancies) {
  if (entity[field] && typeof entity[field] === 'object' && !Array.isArray(entity[field])) {
    // Collect unique values from different sources
    const values = new Set();
    const sources = [];
    
    Object.entries(entity[field]).forEach(([source, sourceInfo]) => {
      if (sourceInfo && sourceInfo.value) {
        values.add(sourceInfo.value);
        sources.push(source);
      }
    });
    
    // If there are multiple unique values, mark as discrepancy
    if (values.size > 1) {
      discrepancies.push({
        field,
        values: Array.from(values),
        sources,
      });
    }
  }
}

function generateFeatureRow(featureName, entities, valueFn) {
  let row = `${featureName} | `;
  row += entities.map(entity => valueFn(entity) || "Not Found").join(" | ");
  row += "\n";
  return row;
}

function formatSourcedInfo(sourcedInfo) {
  if (!sourcedInfo || Object.keys(sourcedInfo).length === 0) {
    return "Not Found";
  }

  return Object.entries(sourcedInfo)
    .map(([source, info]) => {
      if (info && info.value) {
        return `${info.value} (Source: ${info.documentName})`;
      }
      return null;
    })
    .filter(item => item !== null)
    .join("<br>");
}

function formatRoles(roles) {
  if (!roles || Object.keys(roles).length === 0) {
    return "None Found";
  }

  return Object.entries(roles)
    .map(([entity, role]) => {
      return `${role} (${entity})`;
    })
    .join("<br>");
}

function formatArray(arr) {
  if (!arr || arr.length === 0) {
    return "None Found";
  }

  return arr.join("<br>");
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
  .then(generateSummaryTables);

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  //console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error("Unhandeled rejection");
});

kycDocumentWorkflow.commit();

export { kycDocumentWorkflow };