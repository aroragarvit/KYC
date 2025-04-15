import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import axios from 'axios';
import { verificationAgent } from '../agents';
import * as fs from 'fs';
import * as path from 'path';

// Define schemas for input and output data
const companySchema = z.object({
  name: z.string().describe('The company name to verify director information for'),
});

// Company requirements schema
const companyRequirementsSchema = z.object({
  id_document_types: z.array(z.string()),
  address_document_types: z.array(z.string()),
  phone_requirement: z.string().optional(),
  email_required: z.boolean().optional(),
});

// Director information schema with verification fields
const directorInfoSchema = z.object({
  id: z.number(),
  full_name: z.string().nullable(),
  id_number: z.string().nullable(),
  id_type: z.string().nullable(),
  nationality: z.string().nullable(),
  residential_address: z.string().nullable(),
  telephone_number: z.string().nullable(),
  email_address: z.string().nullable(),
  discrepancies: z.string().nullable(),
  verification_Status: z.string().nullable(),
  KYC_Status: z.string().nullable(),
  sources: z.object({
    full_name: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
      documentCategory: z.string().optional(),
    })).optional(),
    id_number: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
      documentCategory: z.string().optional(),
    })).optional(),
    id_type: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
      documentCategory: z.string().optional(),
    })).optional(),
    nationality: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
      documentCategory: z.string().optional(),
    })).optional(),
    residential_address: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
      documentCategory: z.string().optional(),
    })).optional(),
    telephone_number: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
      documentCategory: z.string().optional(),
    })).optional(),
    email_address: z.array(z.object({
      documentId: z.number(),
      documentName: z.string(),
      value: z.string(),
      documentCategory: z.string().optional(),
    })).optional(),
  }).optional(),
});

// TypeScript types for runtime use
type Director = z.infer<typeof directorInfoSchema> & {
  // Additional fields used during processing
  parsedDiscrepancies?: Array<Discrepancy>;
  full_name_array?: string[];
  id_number_array?: string[];
  id_type_array?: string[];
  nationality_array?: string[];
  residential_address_array?: string[];
  telephone_number_array?: string[];
  email_address_array?: string[];
};

interface Discrepancy {
  field: string;
  values: string[];
}

interface GenuineDiscrepancy {
  field: string;
  values: string[];
  explanation: string;
}

interface ResolvedDiscrepancy {
  field: string;
  values: string[];
  resolution: string;
}

// Stored data schema
const storedDataSchema = z.object({
  company: z.string(),
  directors: z.array(directorInfoSchema),
  timestamp: z.string().optional(),
});

// Verification result schema
const verificationResultSchema = z.object({
  director_id: z.number(),
  full_name: z.string().nullable(),
  verification_Status: z.enum(['verified', 'notverified', 'pending']),
  KYC_Status: z.string().nullable(),
  details: z.object({
    genuine_discrepancies: z.array(z.object({
      field: z.string(),
      values: z.array(z.string()),
      explanation: z.string().optional(),
      documents: z.array(z.number()).optional(),
    })).optional(),
    resolved_discrepancies: z.array(z.object({
      field: z.string(),
      values: z.array(z.string()),
      resolution: z.string(),
    })).optional(),
    missing_fields: z.array(z.string()).optional(),
  }),
});

// Final workflow result schema
const workflowResultSchema = z.object({
  company: z.string(),
  processed_directors: z.number(),
  skipped_directors: z.number(),
  verified_count: z.number(),
  pending_count: z.number(),
  notverified_count: z.number(),
  verification_results: z.array(verificationResultSchema),
  summary: z.string(),
});

// Step 1: Fetch all directors for the company
const fetchDirectors = new Step({
  id: 'fetch-directors',
  description: 'Fetches all directors for a company and filters out notverified ones',
  inputSchema: companySchema,
  outputSchema: storedDataSchema,
  execute: async ({ context }) => {
    const companyName = context?.getStepResult<{ name: string }>('trigger')?.name;
    
    if (!companyName) {
      throw new Error('Company name not found');
    }

    try {
      // Fetch directors from API
      const response = await axios.get(`http://localhost:3000/companies/${companyName}/directors`);
      
      // Filter out directors with "notverified" status - only process "pending" and "verified" ones
      const filteredDirectors = response.data.directors.filter(
        (director: any) => director.verification_Status !== 'notverified'
      );
      
      console.log(`Found ${response.data.directors.length} directors, processing ${filteredDirectors.length} (excluding notverified)`);
      
      // Parse discrepancies for each director
      const processedDirectors = filteredDirectors.map((director: any) => {
        try {
          if (director.discrepancies) {
            director.parsedDiscrepancies = JSON.parse(director.discrepancies);
          } else {
            director.parsedDiscrepancies = [];
          }
        } catch (e) {
          console.error(`Error parsing discrepancies for director ${director.id}:`, e);
          director.parsedDiscrepancies = [];
        }
        
        // Ensure sources arrays are defined
        director.sources = {
          full_name: [],
          id_number: [],
          id_type: [],
          nationality: [],
          residential_address: [],
          telephone_number: [],
          email_address: [],
        };
        
        // Parse value arrays
        ['full_name_values', 'id_number_values', 'id_type_values', 'nationality_values', 
         'residential_address_values', 'telephone_number_values', 'email_address_values'].forEach(field => {
          try {
            if (director[field]) {
              director[field.replace('_values', '_array')] = JSON.parse(director[field]);
            } else {
              director[field.replace('_values', '_array')] = [];
            }
          } catch (e) {
            director[field.replace('_values', '_array')] = [];
          }
        });
        
        // Parse source arrays
        ['full_name_source', 'id_number_source', 'id_type_source', 'nationality_source', 
         'residential_address_source', 'telephone_number_source', 'email_address_source'].forEach(field => {
          try {
            if (director[field]) {
              const sourceField = field.replace('_source', '');
              director.sources[sourceField] = JSON.parse(director[field]);
            }
          } catch (e) {
            const sourceField = field.replace('_source', '');
            director.sources[sourceField] = [];
          }
        });
        
        return director;
      });
      
      return {
        company: companyName,
        directors: processedDirectors as z.infer<typeof directorInfoSchema>[]
      };
    } catch (error) {
      console.error('Error fetching director data:', error);
      throw new Error(`Failed to retrieve director data for company ${companyName}`);
    }
  },
});

// Step 2: Verify directors and update status
const verifyDirectors = new Step({
  id: 'verify-directors',
  description: 'Evaluates discrepancies and updates verification status',
  inputSchema: storedDataSchema,
  outputSchema: workflowResultSchema,
  execute: async ({ context }) => {
    const directorData = context?.getStepResult(fetchDirectors);
    const companyName = context?.getStepResult<{ name: string }>('trigger')?.name;
    
    if (!directorData || !directorData.directors || directorData.directors.length === 0) {
      console.log('No directors to verify');
      return {
        company: directorData?.company || 'Unknown',
        processed_directors: 0,
        skipped_directors: 0,
        verified_count: 0,
        pending_count: 0,
        notverified_count: 0,
        verification_results: [],
        summary: 'No directors to verify',
      };
    }

    // Get company-specific requirements
    const companyRequirements = getCompanyRequirements(companyName);
    console.log(`Using verification requirements for company ${companyName}:`, companyRequirements);

    const verificationResults: Array<z.infer<typeof verificationResultSchema>> = [];
    let verified = 0;
    let pending = 0;
    let notverified = 0;
    let skipped = 0;
    
    for (const directorBase of directorData.directors) {
      // Safely cast to our extended type with runtime properties
      const director = directorBase as Director;
      
      // Skip directors that are already marked as notverified
      if (director.verification_Status === 'notverified') {
        skipped++;
        continue;
      }

      // Check for discrepancies
      let discrepancies: Discrepancy[] = [];
      try {
        if (director.discrepancies) {
          discrepancies = typeof director.discrepancies === 'string' 
            ? JSON.parse(director.discrepancies)
            : (director.parsedDiscrepancies || []);
        }
      } catch (e) {
        console.error(`Error parsing discrepancies for director ${director.id}:`, e);
        discrepancies = [];
      }
      
      // Evaluate document requirements based on AI-classified documents
      const requirementEvaluation = evaluateDocumentRequirements(director, companyRequirements);
      
      // If there are discrepancies, evaluate if they're genuine
      const genuineDiscrepancies: GenuineDiscrepancy[] = [];
      const resolvedDiscrepancies: ResolvedDiscrepancy[] = [];
      
      if (discrepancies.length > 0) {
        const prompt = `
        I need to evaluate if the following discrepancies in a director's KYC information are genuine issues or just variations of the same information:
        
        Director: ${director.full_name || 'Unknown'}
        
        Company Requirements:
        ${formatCompanyRequirements(companyRequirements)}
        
        Discrepancies:
        ${JSON.stringify(discrepancies, null, 2)}
        
        Document sources information:
        ${JSON.stringify(director.sources || {}, null, 2)}
        
        For each discrepancy, determine if it's a genuine issue (different information) or just a variation (same information in different format).
        Consider the document categories when evaluating discrepancies. Pay special attention to:
        
        1. ID verification requires one of these document types: ${companyRequirements.id_document_types.join(', ')}
        2. Address verification requires one of these document types: ${companyRequirements.address_document_types.join(', ')}
        3. ${companyRequirements.phone_requirement || 'Phone number is required'}
        4. ${companyRequirements.email_required ? 'Email address is required' : 'Email address is optional'}
        
        Examples of variations that are NOT genuine discrepancies:
        1. "American" vs "USA" (same nationality, different format)
        2. "Singaporean" vs "Singapore" (same nationality, different format)
        3. "John Doe" vs "Johnathan Doe" if they clearly refer to the same person
        4. Different formats of the same address
        5. Different formats of the same phone number
        
        Examples of GENUINE discrepancies:
        1. Different nationalities ("Singapore" vs "Malaysia")
        2. Different addresses that don't refer to the same location
        3. Different ID numbers unless one is a passport and another is a national ID
        4. Names that may refer to different people
        
        Provide your analysis in this exact JSON format:
        {
          "evaluated_discrepancies": [
            {
              "field": "field_name",
              "values": ["value1", "value2"],
              "is_genuine_discrepancy": true/false,
              "explanation": "Clear explanation of your reasoning"
            }
          ]
        }`;

        // Call the verification agent to evaluate discrepancies
        const response = await verificationAgent.stream([
          { role: 'user', content: prompt }
        ]);

        let resultText = '';
        for await (const chunk of response.textStream) {
          resultText += chunk;
        }

        // Extract JSON from the response
        try {
          const jsonRegex = /\{[\s\S]*\}/g;
          const match = resultText.match(jsonRegex);
          if (match) {
            const evaluation = JSON.parse(match[0]) as { 
              evaluated_discrepancies?: Array<{
                field: string;
                values: string[];
                is_genuine_discrepancy: boolean;
                explanation: string;
              }> 
            };
            
            // Process evaluated discrepancies
            if (evaluation.evaluated_discrepancies) {
              evaluation.evaluated_discrepancies.forEach((item) => {
                if (item.is_genuine_discrepancy) {
                  // This is a genuine discrepancy
                  genuineDiscrepancies.push({
                    field: item.field,
                    values: item.values,
                    explanation: item.explanation
                  });
                } else {
                  // This is a resolved discrepancy (not a genuine issue)
                  resolvedDiscrepancies.push({
                    field: item.field,
                    values: item.values,
                    resolution: item.explanation
                  });
                }
              });
            }
          }
        } catch (error) {
          console.error(`Error parsing verification evaluation for ${director.full_name}:`, error);
        }
      }
      
      // Check for missing required fields - use safe property access
      const requiredFields = ['full_name', 'id_number', 'id_type', 'nationality', 'residential_address'];
      const missingFields = requiredFields.filter(field => {
        const key = field as keyof typeof director;
        const value = director[key];
        return !value || value === '' || value === null;
      });
      
      // Add any missing document requirements to the missing fields
      if (requirementEvaluation.missingRequirements.length > 0) {
        missingFields.push(...requirementEvaluation.missingRequirements);
      }
      
      // Determine verification status
      let verificationStatus: 'verified' | 'notverified' | 'pending';
      let kycStatus = null;
      
      if (genuineDiscrepancies.length > 0) {
        // Genuine discrepancies detected - mark as notverified
        verificationStatus = 'notverified';
        kycStatus = JSON.stringify({
          status: 'Discrepancies detected',
          fields: genuineDiscrepancies.map(d => d.field),
          discrepancies: genuineDiscrepancies
        });
        notverified++;
      } else if (missingFields.length > 0) {
        // No genuine discrepancies but some required fields or documents are missing - mark as pending
        verificationStatus = 'pending';
        kycStatus = JSON.stringify({
          status: 'Required fields or documents missing',
          missing_fields: missingFields
        });
        pending++;
      } else {
        // No genuine discrepancies and all required fields are present - mark as verified
        verificationStatus = 'verified';
        verified++;
      }
      
      // Prepare verification result
      const verificationResult: z.infer<typeof verificationResultSchema> = {
        director_id: director.id,
        full_name: director.full_name,
        verification_Status: verificationStatus,
        KYC_Status: kycStatus,
        details: {
          genuine_discrepancies: genuineDiscrepancies,
          resolved_discrepancies: resolvedDiscrepancies,
          missing_fields: missingFields
        }
      };
      
      // Update the director status in the database
      try {
        await axios.patch(`http://localhost:3000/directors/${director.id}/verification`, {
          verification_Status: verificationStatus,
          KYC_Status: kycStatus
        });
        console.log(`Updated verification status for director ${director.id} to ${verificationStatus}`);
      } catch (updateError) {
        console.error(`Error updating director ${director.id}:`, updateError);
      }
      
      verificationResults.push(verificationResult);
    }
    
    // Generate summary
    const summary = `
    KYC Verification Summary for ${directorData.company}
    -------------------------------------------
    Directors processed: ${verificationResults.length}
    Directors skipped (already notverified): ${skipped}
    
    Results:
    - Verified: ${verified}
    - Pending (incomplete information): ${pending}
    - Not Verified (discrepancies found): ${notverified}
    
    Company Requirements:
    ${formatCompanyRequirements(companyRequirements)}
    `;
    
    return {
      company: directorData.company,
      processed_directors: verificationResults.length,
      skipped_directors: skipped,
      verified_count: verified,
      pending_count: pending,
      notverified_count: notverified,
      verification_results: verificationResults,
      summary
    };
  },
});

// Create and commit the verification workflow
const directorVerificationWorkflow = new Workflow({
  name: 'director-verification-workflow',
  triggerSchema: companySchema,
})
  .step(fetchDirectors)
  .then(verifyDirectors);

directorVerificationWorkflow.commit();

export { directorVerificationWorkflow };

function getCompanyRequirements(companyName?: string): z.infer<typeof companyRequirementsSchema> {
  // Default requirements for all companies, It can be overriden using a having those requirements in a database and fetching using api call in future cases
  const defaultRequirements = {
    id_document_types: ['passport', 'nric', 'fin', 'identification_document'],
    address_document_types: ['utility_bill', 'phone_bill', 'bank_statement', 'government_id', 'address_proof'],
    phone_requirement: '+65 number for local directors',
    email_required: true
  };  
  return defaultRequirements;
}

// Helper function to format company requirements for the prompt
function formatCompanyRequirements(requirements: z.infer<typeof companyRequirementsSchema>): string {
  let formatted = '';
  
  formatted += '1. Identification Document: ' + requirements.id_document_types.join(', ') + '\n';
  formatted += '2. Proof of Address: ' + requirements.address_document_types.join(', ') + '\n';
  if (requirements.phone_requirement) {
    formatted += '3. Telephone Number: ' + requirements.phone_requirement + '\n';
  }
  if (requirements.email_required) {
    formatted += '4. Email Address: Required\n';
  }
  
  return formatted;
}

// Helper function to evaluate if director has all required document types based on AI classification
function evaluateDocumentRequirements(director: Director, requirements: z.infer<typeof companyRequirementsSchema>): {
  missingRequirements: string[];
  hasIdDocument: boolean;
  hasAddressDocument: boolean;
  hasLocalPhoneNumber: boolean;
  hasEmail: boolean;
} {
  const missingRequirements: string[] = [];
  let hasIdDocument = false;
  let hasAddressDocument = false;
  let hasLocalPhoneNumber = false;
  let hasEmail = false;
  
  // Check for ID document using AI-classified document categories
  if (director.sources?.id_number?.length) {
    const idSources = director.sources.id_number;
    hasIdDocument = idSources.some(source => {
      const docCategory = source.documentCategory?.toLowerCase() || '';
      return requirements.id_document_types.some(type => docCategory.includes(type.toLowerCase()));
    });
  }
  
  // Check for address verification document using AI-classified document categories
  if (director.sources?.residential_address?.length) {
    const addressSources = director.sources.residential_address;
    hasAddressDocument = addressSources.some(source => {
      const docCategory = source.documentCategory?.toLowerCase() || '';
      return requirements.address_document_types.some(type => docCategory.includes(type.toLowerCase()));
    });
  }
  
  // Check for local Singapore phone number
  if (director.telephone_number) {
    hasLocalPhoneNumber = director.telephone_number.includes('+65') || 
                          director.telephone_number.startsWith('65');
  }
  
  // Check for email
  hasEmail = !!director.email_address;
  
  // Build missing requirements list
  if (!hasIdDocument) {
    missingRequirements.push('identification_document');
  }
  
  if (!hasAddressDocument) {
    missingRequirements.push('address_verification_document');
  }
  
  if (!hasLocalPhoneNumber && requirements.phone_requirement?.includes('+65')) {
    missingRequirements.push('local_singapore_phone');
  }
  
  if (!hasEmail && requirements.email_required) {
    missingRequirements.push('email_address');
  }
  
  return {
    missingRequirements,
    hasIdDocument,
    hasAddressDocument,
    hasLocalPhoneNumber,
    hasEmail
  };
} 