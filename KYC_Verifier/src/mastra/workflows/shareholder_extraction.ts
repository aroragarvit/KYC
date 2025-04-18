import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import axios from 'axios';
import { shareholderAnalysisAgent } from '../agents';

// Define schemas for input and output data
const companySchema = z.object({
  name: z.string().describe('The company name to extract shareholder information for'),
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

// Company requirements schema - different from director requirements
const companyRequirementsSchema = z.object({
  singapore_individual_documents: z.array(z.string()),
  foreign_individual_documents: z.array(z.string()),
  singapore_corporate_documents: z.array(z.string()),
  foreign_corporate_documents: z.array(z.string()),
  minimum_share_capital: z.number().optional(),
  beneficial_ownership_threshold: z.number().optional(),
});

// Source document schema with category
const sourceDocumentSchema = z.object({
  documentId: z.number(),
  documentName: z.string(),
  value: z.string(),
  documentCategory: z.string(),
});

// Beneficial owner schema
const beneficialOwnerSchema = z.object({
  name: z.string(),
  ownership_percentage: z.number(),
  indirect_path: z.string().optional(),
  requires_kyc: z.boolean(),
});

// Shareholder information schema with shareholder type and document classification
const shareholderInfoSchema = z.object({
  shareholder_type: z.enum(['Individual', 'Corporate']),
  origin: z.string(),
  full_name: z.string().nullable(),
  company_name: z.string().nullable(),
  registration_number: z.string().nullable(),
  id_number: z.string().nullable(),
  id_type: z.string().nullable(),
  nationality: z.string().nullable(),
  registered_address: z.string().nullable(),
  residential_address: z.string().nullable(),
  email_address: z.string().nullable(),
  telephone_number: z.string().nullable(),
  number_of_shares: z.number().nullable(),
  price_per_share: z.number().nullable(),
  percentage_ownership: z.number().nullable(),
  beneficial_owners: z.array(beneficialOwnerSchema).optional(),
  signatory_name: z.string().nullable(),
  signatory_email: z.string().nullable(),
  sources: z.object({
    shareholder_type: z.array(sourceDocumentSchema).optional(),
    origin: z.array(sourceDocumentSchema).optional(),
    full_name: z.array(sourceDocumentSchema).optional(),
    company_name: z.array(sourceDocumentSchema).optional(),
    registration_number: z.array(sourceDocumentSchema).optional(),
    id_number: z.array(sourceDocumentSchema).optional(),
    id_type: z.array(sourceDocumentSchema).optional(),
    nationality: z.array(sourceDocumentSchema).optional(),
    registered_address: z.array(sourceDocumentSchema).optional(),
    residential_address: z.array(sourceDocumentSchema).optional(),
    email_address: z.array(sourceDocumentSchema).optional(),
    telephone_number: z.array(sourceDocumentSchema).optional(),
    number_of_shares: z.array(sourceDocumentSchema).optional(),
    price_per_share: z.array(sourceDocumentSchema).optional(),
    percentage_ownership: z.array(sourceDocumentSchema).optional(),
    beneficial_owners: z.array(sourceDocumentSchema).optional(),
    signatory_name: z.array(sourceDocumentSchema).optional(),
    signatory_email: z.array(sourceDocumentSchema).optional(),
  }),
});

// Storage result schema
const extractionResultSchema = z.object({
  company: z.string(),
  shareholders: z.array(shareholderInfoSchema),
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

// Step 3: Extract shareholder information with type classification
const extractShareholderInfo = new Step({
  id: 'extract-shareholder-info',
  description: 'Extracts shareholder information from documents with classification by type and origin',
  inputSchema: z.array(documentContentSchema),
  outputSchema: z.array(shareholderInfoSchema),
  execute: async ({ context }) => {
    const documentContents = context?.getStepResult(readDocumentContents);
    const companyName = context?.getStepResult<{ name: string }>('trigger')?.name;
    
    if (!documentContents || documentContents.length === 0) {
      throw new Error('No document contents found');
    }

    console.log(`Processing ${documentContents.length} documents to extract shareholder information...`);
    
    // Define company-specific requirements
    const companyRequirements = getCompanyRequirements(companyName);
    
    // Prepare a comprehensive prompt with company requirements and all document contents
    let prompt = `I need to extract complete shareholder information from the following company documents, distinguishing between individual and corporate shareholders, and identifying all required documents based on shareholder type.

COMPANY: ${companyName}

DOCUMENT REQUIREMENTS FOR SHAREHOLDERS:
${formatShareholderRequirements(companyRequirements)}

`;
    
    // Include all document contents in the prompt
    documentContents.forEach((doc, index) => {
      prompt += `DOCUMENT ${index + 1}: ${doc.document.name} (ID: ${doc.document.id})\n`;
      
      // For large documents, truncate content to avoid token limits
      let content = doc.content;
      if (content.length > 3000) {
        content = content.substring(0, 3000) + "... [content truncated]";
      }
      
      // Include content for each document
      prompt += `Content:\n${content}\n\n`;
      prompt += `---------- END OF DOCUMENT ${index + 1} ----------\n\n`;
    });
    

    // This Prompt is for truffles Ai Pvt Ltd  but It will be dynamic and stored in database for global purposes
    // company name will be dynamic and stored in database for global purposes
    // Add comprehensive extraction instructions
    prompt += `
    Your task is to identify  shareholders mentioned across these documents for company truffles Ai Pvt Ltd , classify them by type (Individual/Corporate) and origin (Singapore/Foreign), and extract all required information.
    
    EXTRACTION REQUIREMENTS:
    1. Identify ALL shareholders mentioned in ANY document For truffles Ai Pvt Ltd (need to make sure that they are direct shareholders and not indirect ones) CRITICAL POINT
    2. Classify each shareholder as either:
       - Individual Singapore shareholder
       - Individual Foreign shareholder
       - Corporate Singapore shareholder
       - Corporate Foreign shareholder
    3. For EACH shareholder, extract the following (fields vary by type):
    
    ALL SHAREHOLDERS:
    - Shareholder type: "Individual" or "Corporate"
    - Origin: "Singapore" or specific foreign country
    - Number of shares owned
    - Price per share (in SGD)
    - Percentage ownership (calculate if not explicitly stated)
    - Email address
    
    INDIVIDUAL SHAREHOLDERS:
    - Full name
    - ID number (NRIC for Singapore, passport for foreign)
    - ID type (NRIC, passport, FIN, etc.)
    - Nationality
    - Residential address
    - Telephone number
    
    CORPORATE SHAREHOLDERS:
    - Company name
    - Registration number (UEN for Singapore companies)
    - Registered address
    - Signatory name and email
    - For shareholders with 25%+ ownership: list of beneficial owners
      (individuals who own 25%+ of the corporate shareholder)
    
    DOCUMENT CLASSIFICATION REQUIREMENTS:
    For EACH piece of information extracted, you MUST intelligently classify the source document into one of these categories:
    - "identification_document": Official government ID documents like passports, NRIC, FIN cards
    - "address_proof": Documents proving residence like utility bills, phone bills, bank statements
    - "company_registry": Official company registration documents
    - "appointment_letter": Letters or documents formally appointing directors
    - "profile_document": Company profiles or informational documents
    - "other_document": Any other document type
    
    Rewuirements for shareholder type:
    INDIVIDUAL SINGAPORE:
    - "nric": NRIC document
    - "proof_of_address": Utility bill, phone bill, etc.
    - "email_verification": Email verification document
    
    INDIVIDUAL FOREIGN:
    - "passport": Passport document
    - "proof_of_address": Utility bill, phone bill, etc.
    - "email_verification": Email verification document
    
    CORPORATE SINGAPORE:
    - "acra_bizfile": ACRA Bizfile profile
    - "signatory_information": Document with signatory details(company profile document)
    
    CORPORATE FOREIGN:
    - "certificate_of_incorporation": Certificate of incorporation/incumbency
    - "register_of_directors": Register of directors document
    - "proof_of_address": Document proving company address
    - "register_of_members": Register of members/shareholders
    - "signatory_information": Document with signatory details(company profile document)
    
    Beneficial Ownership:
    - If a corporate shareholder owns 25% or more of the company shares
      identify any individuals who own 25%+ of that corporate shareholder
    - For these beneficial owners, include:
      * Name
      * Ownership percentage (both direct in corporate shareholder and indirect in target company)
      * Whether they require KYC (always true if indirect ownership ≥ 25%)
    
    Format the results as a JSON array with each object representing a shareholder:
    [
      {
        "shareholder_type": "Individual", 
        "origin": "Singapore",
        "full_name": "John Doe",
        "id_number": "S1234567D",
        "id_type": "NRIC",
        "nationality": "Singapore",
        "residential_address": "123 Main St, Singapore 123456",
        "email_address": "john@example.com",
        "telephone_number": "+6587654321",
        "number_of_shares": 500,
        "price_per_share": 10,
        "percentage_ownership": 50,
        "sources": {
          "shareholder_type": [
            {"documentId": 1, "documentName": "Doc Name", "value": "Individual", "documentCategory": "nric"}
          ],
          "origin": [
            {"documentId": 1, "documentName": "Doc Name", "value": "Singapore", "documentCategory": "nric"}
          ],
          "full_name": [
            {"documentId": 1, "documentName": "Doc Name", "value": "John Doe", "documentCategory": "nric"}
          ],
          // ... other fields with sources ...
        }
      },
      {
        "shareholder_type": "Corporate",
        "origin": "Foreign",
        "company_name": "ABC Ltd",
        "registration_number": "12345-X",
        "registered_address": "456 Business Ave, London EC1A 1BB, UK",
        "email_address": "contact@abcltd.com",
        "telephone_number": "+44123456789",
        "number_of_shares": 500,
        "price_per_share": 10,
        "percentage_ownership": 50,
        "signatory_name": "Jane Smith",
        "signatory_email": "jane@abcltd.com",
        "beneficial_owners": [
          {
            "name": "Robert Johnson",
            "ownership_percentage": 30,
            "indirect_path": "30% of ABC Ltd which owns 50% of ${companyName}",
            "requires_kyc": true
          }
        ],
        "sources": {
          // ... fields with sources ...
        }
      }
    ]
    
    IMPORTANT: 
    - Include ALL variations found across documents in the appropriate sources arrays
    - For each source, MUST include a documentCategory field with your assessment
    - Return ONLY the raw JSON array. No explanations or code blocks.
    - Your response should start with "[" and end with "]".
    `;
    
    try {
      console.log("Sending prompt to extract shareholder information...");
      const response = await shareholderAnalysisAgent.stream([
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
        const parsedShareholders = JSON.parse(jsonText);
        
        if (!Array.isArray(parsedShareholders)) {
          throw new Error('Parsed result is not an array');
        }
        
        // Post-process to ensure all source arrays exist
        const processedShareholders = parsedShareholders.map(shareholder => {
          // Ensure all source arrays exist
          const sourceFields = [
            'shareholder_type', 'origin', 'full_name', 'company_name', 'registration_number',
            'id_number', 'id_type', 'nationality', 'registered_address', 'residential_address',
            'email_address', 'telephone_number', 'number_of_shares', 'price_per_share',
            'percentage_ownership', 'beneficial_owners', 'signatory_name', 'signatory_email'
          ];
          
          if (!shareholder.sources) {
            shareholder.sources = {};
          }
          
          sourceFields.forEach(field => {
            if (!shareholder.sources[field]) {
              shareholder.sources[field] = [];
            }
          });
          
          // Verify beneficial owner data structure is consistent
          if (shareholder.beneficial_owners && Array.isArray(shareholder.beneficial_owners)) {
            shareholder.beneficial_owners = shareholder.beneficial_owners.map(owner => {
              if (typeof owner === 'object') {
                return {
                  name: owner.name || 'Unknown',
                  ownership_percentage: owner.ownership_percentage || 0,
                  indirect_path: owner.indirect_path || undefined,
                  requires_kyc: owner.ownership_percentage >= 25
                };
              }
              return {
                name: 'Unknown',
                ownership_percentage: 0,
                requires_kyc: false
              };
            });
          } else {
            shareholder.beneficial_owners = [];
          }
          
          return shareholder;
        });
        
        console.log(`Successfully extracted information for ${processedShareholders.length} shareholders`);
        return processedShareholders;
      } catch (parseError: unknown) {
        console.error('Error parsing JSON');
        if (parseError instanceof Error) {
          console.error('Error details:', parseError.message);
        }
        throw new Error(`Failed to parse shareholder information`);
      }
    } catch (error: unknown) {
      console.error('Error extracting shareholder information');
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      
      // Fallback: return a minimal shareholder structure to prevent workflow failure
      return [{
        shareholder_type: 'Individual',
        origin: 'Unknown',
        full_name: "Error extracting shareholders",
        company_name: null,
        registration_number: null,
        id_number: null,
        id_type: null,
        nationality: null,
        registered_address: null,
        residential_address: null,
        email_address: null,
        telephone_number: null,
        number_of_shares: null,
        price_per_share: null,
        percentage_ownership: null,
        beneficial_owners: [],
        signatory_name: null,
        signatory_email: null,
        sources: {
          shareholder_type: [{
            documentId: 0,
            documentName: "Error",
            value: "Failed to extract shareholders from documents",
            documentCategory: "error"
          }],
          origin: [],
          full_name: [],
          company_name: [],
          registration_number: [],
          id_number: [],
          id_type: [],
          nationality: [],
          registered_address: [],
          residential_address: [],
          email_address: [],
          telephone_number: [],
          number_of_shares: [],
          price_per_share: [],
          percentage_ownership: [],
          beneficial_owners: [],
          signatory_name: [],
          signatory_email: []
        }
      }];
    }
  },
});

// Step 4: Store extracted shareholder information
const storeShareholderInfo = new Step({
  id: 'store-shareholder-info',
  description: 'Stores extracted shareholder information in the database',
  inputSchema: z.array(shareholderInfoSchema),
  outputSchema: extractionResultSchema,
  execute: async ({ context }) => {
    const shareholderInfo = context?.getStepResult(extractShareholderInfo);
    const companyName = context?.getStepResult<{ name: string }>('trigger')?.name;
    
    if (!shareholderInfo || shareholderInfo.length === 0) {
      throw new Error('No shareholder information found');
    }
    
    if (!companyName) {
      throw new Error('Company name not found');
    }

    try {
      // Store all shareholder information for the company
      const successfulShareholders = [];
      const failedShareholders = [];

      for (const shareholder of shareholderInfo) {
        try {
          // Extract all values (including duplicates) for each field
          const allFieldValues: Record<string, string[]> = {};
          
          // Fields to process - different for individual vs corporate shareholders
          const commonFields = [
            'shareholder_type', 'origin', 'email_address', 'telephone_number', 
            'number_of_shares', 'price_per_share', 'percentage_ownership'
          ];
          
          const individualFields = [
            'full_name', 'id_number', 'id_type', 'nationality', 'residential_address'
          ];
          
          const corporateFields = [
            'company_name', 'registration_number', 'registered_address', 
            'signatory_name', 'signatory_email'
          ];
          
          // Determine which fields to process based on shareholder type
          const fieldsToProcess = [
            ...commonFields,
            ...(shareholder.shareholder_type === 'Individual' ? individualFields : corporateFields)
          ];
          
          // For each field, extract all values from all sources
          for (const field of fieldsToProcess) {
            if (field === 'beneficial_owners') continue; // Handle separately
            
            // Find the sources for this field
            const sources = (shareholder.sources as any)[field];
            // Initialize the array for this field
            allFieldValues[field] = [];
            
            if (sources && sources.length > 0) {
              // Extract all values from sources
              sources.forEach((source: any) => {
                if (source && source.value) {
                  allFieldValues[field].push(source.value);
                }
              });
            }
          }
          
          // Identify discrepancies - fields with multiple distinct values
          const discrepancies = [];
          for (const field of fieldsToProcess) {
            if (field === 'beneficial_owners') continue;
            
            // Get unique values
            const uniqueValues = [...new Set(allFieldValues[field] || [])];
            if (uniqueValues.length > 1) {
              discrepancies.push({
                field,
                values: uniqueValues
              });
            }
          }
          
          // Prepare beneficial owner information for storage
          const beneficialOwnersData = shareholder.beneficial_owners || [];
          
          // Store each shareholder with all values from all sources
          const response = await axios.post(`http://localhost:3000/companies/${companyName}/shareholders`, {
            company_id: null, // Will be assigned by the API based on company name
            shareholder_type: shareholder.shareholder_type,
            origin: shareholder.origin,
            // Main fields use the primary value
            full_name: shareholder.full_name,
            company_name: shareholder.company_name,
            registration_number: shareholder.registration_number,
            id_number: shareholder.id_number,
            id_type: shareholder.id_type,
            nationality: shareholder.nationality,
            registered_address: shareholder.registered_address,
            residential_address: shareholder.residential_address,
            email_address: shareholder.email_address,
            telephone_number: shareholder.telephone_number,
            number_of_shares: shareholder.number_of_shares,
            price_per_share: shareholder.price_per_share,
            percentage_ownership: shareholder.percentage_ownership,
            signatory_name: shareholder.signatory_name,
            signatory_email: shareholder.signatory_email,
            beneficial_owners: JSON.stringify(beneficialOwnersData),
            // Store all sources including document categories
            ...Object.entries(shareholder.sources).reduce((acc, [key, value]) => {
              acc[`${key}_source`] = JSON.stringify(value);
              return acc;
            }, {} as Record<string, string>),
            // Store all values as arrays (including duplicates)
            ...Object.entries(allFieldValues).reduce((acc, [key, value]) => {
              acc[`${key}_values`] = JSON.stringify(value);
              return acc;
            }, {} as Record<string, string>),
            // Store identified discrepancies
            discrepancies: JSON.stringify(discrepancies)
          });
          
          successfulShareholders.push({
            ...shareholder, 
            id: response.data.id,
            allFieldValues, 
            discrepancies
          });
          
          console.log(`Successfully stored shareholder: ${
            shareholder.shareholder_type === 'Individual' 
              ? shareholder.full_name 
              : shareholder.company_name
          } || 'Unknown'`);
          
          // Log all discrepancies for debugging
          if (discrepancies.length > 0) {
            console.log(`Found ${discrepancies.length} discrepancies for ${
              shareholder.shareholder_type === 'Individual' 
                ? shareholder.full_name 
                : shareholder.company_name
            } || 'Unknown':`);
            discrepancies.forEach(d => {
              console.log(`- ${d.field}: ${d.values.join(', ')}`);
            });
          }
        } catch (shareholderError: unknown) {
          console.error(`Error storing shareholder ${
            shareholder.shareholder_type === 'Individual' 
              ? shareholder.full_name 
              : shareholder.company_name
          } || 'Unknown'`);
          if (shareholderError instanceof Error) {
            console.error(`Error details: ${shareholderError.message}`);
          }
          failedShareholders.push(shareholder);
        }
      }

      if (failedShareholders.length === 0) {
        return {
          company: companyName,
          shareholders: shareholderInfo,
          extraction_status: 'SUCCESS' as const,
          message: `Successfully extracted and stored information for all ${shareholderInfo.length} shareholders`
        };
      } else if (successfulShareholders.length > 0) {
        return {
          company: companyName,
          shareholders: shareholderInfo,
          extraction_status: 'PARTIAL' as const,
          message: `Extracted information for ${shareholderInfo.length} shareholders, but only stored ${successfulShareholders.length} successfully`
        };
      } else {
        throw new Error('Failed to store any shareholder information');
      }
    } catch (error: unknown) {
      console.error('Error storing shareholder information');
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      return {
        company: companyName,
        shareholders: shareholderInfo,
        extraction_status: 'FAILED' as const,
        message: `Extracted shareholder information but failed to store permanently: ${
          (error instanceof Error) ? error.message : 'Unknown error'
        }`
      };
    }
  },
});

// Helper function to get company-specific requirements for shareholders
function getCompanyRequirements(companyName?: string): z.infer<typeof companyRequirementsSchema> {
  // Default requirements for all companies
  const defaultRequirements = {
    singapore_individual_documents: ['nric', 'proof_of_address', 'email_verification'],
    foreign_individual_documents: ['passport', 'proof_of_address', 'email_verification'],
    singapore_corporate_documents: ['acra_bizfile', 'signatory_information'],
    foreign_corporate_documents: ['certificate_of_incorporation', 'register_of_directors', 'proof_of_address', 'register_of_members', 'signatory_information'],
    minimum_share_capital: 1500,
    beneficial_ownership_threshold: 25
  };
  
  // You could implement company-specific overrides here based on company name
  
  return defaultRequirements;
}

// Helper function to format company requirements for the prompt
function formatShareholderRequirements(requirements: z.infer<typeof companyRequirementsSchema>): string {
  let formatted = '';
  
  formatted += 'INDIVIDUAL SINGAPORE SHAREHOLDERS:\n';
  formatted += '- Required documents: ' + requirements.singapore_individual_documents.join(', ') + '\n\n';
  
  formatted += 'INDIVIDUAL FOREIGN SHAREHOLDERS:\n';
  formatted += '- Required documents: ' + requirements.foreign_individual_documents.join(', ') + '\n\n';
  
  formatted += 'CORPORATE SINGAPORE SHAREHOLDERS:\n';
  formatted += '- Required documents: ' + requirements.singapore_corporate_documents.join(', ') + '\n\n';
  
  formatted += 'CORPORATE FOREIGN SHAREHOLDERS:\n';
  formatted += '- Required documents: ' + requirements.foreign_corporate_documents.join(', ') + '\n\n';
  
  formatted += 'BENEFICIAL OWNERSHIP:\n';
  formatted += `- Threshold for KYC requirements: ${requirements.beneficial_ownership_threshold}% ownership\n`;
  formatted += '- Corporate shareholders with 25%+ ownership must identify their beneficial owners\n\n';
  
  formatted += 'SHARE CAPITAL:\n';
  formatted += `- Recommended minimum share capital: S$${requirements.minimum_share_capital}\n`;
  
  return formatted;
}

// Create and commit the shareholder extraction workflow
const shareholderExtractionWorkflow = new Workflow({
  name: 'shareholder-extraction-workflow',
  triggerSchema: companySchema,
})
  .step(fetchCompanyDocuments)
  .then(readDocumentContents)
  .then(extractShareholderInfo)
  .then(storeShareholderInfo);

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

shareholderExtractionWorkflow.commit();

export { shareholderExtractionWorkflow }; 