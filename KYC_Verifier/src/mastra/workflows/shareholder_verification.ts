import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import axios from 'axios';
import { shareholderVerificationAgent } from '../agents';

// Define schemas for input and output data
const companySchema = z.object({
  name: z.string().describe('The company name to verify shareholder information for'),
});

// Company requirements schema
const companyRequirementsSchema = z.object({
  singapore_individual_documents: z.array(z.string()),
  foreign_individual_documents: z.array(z.string()),
  singapore_corporate_documents: z.array(z.string()),
  foreign_corporate_documents: z.array(z.string()),
  minimum_share_capital: z.number().optional(),
  beneficial_ownership_threshold: z.number().optional(),
});

// Beneficial owner schema
const beneficialOwnerSchema = z.object({
  name: z.string(),
  ownership_percentage: z.number(),
  indirect_path: z.string().optional(),
  requires_kyc: z.boolean(),
  verification_status: z.enum(['verified', 'pending', 'notverified']).optional(),
});

// Shareholder information schema with verification fields
const shareholderInfoSchema = z.object({
  id: z.number(),
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
  discrepancies: z.string().nullable(),
  verification_Status: z.string().nullable(),
  KYC_Status: z.string().nullable(),
  sources: z.record(z.string(), z.any()).optional(), // This will be parsed in the execution
});

// TypeScript types for runtime use
type Shareholder = z.infer<typeof shareholderInfoSchema> & {
  // Additional fields used during processing
  parsedDiscrepancies?: Array<Discrepancy>;
  parsedSources?: Record<string, Array<{ 
    documentId: number; 
    documentName: string; 
    value: string; 
    documentCategory: string;
  }>>;
  parsedBeneficialOwners?: Array<z.infer<typeof beneficialOwnerSchema>>;
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
  shareholders: z.array(shareholderInfoSchema),
  timestamp: z.string().optional(),
});

// Verification result schema
const verificationResultSchema = z.object({
  shareholder_id: z.number(),
  name: z.string().nullable(), // Either full_name or company_name
  shareholder_type: z.enum(['Individual', 'Corporate']),
  origin: z.string(),
  verification_Status: z.enum(['verified', 'notverified', 'pending', 'beneficial_ownership_incomplete']),
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
    missing_documents: z.array(z.string()).optional(),
    beneficial_ownership_issues: z.array(z.object({
      owner_name: z.string(),
      issue: z.string(),
    })).optional(),
  }),
});

// Final workflow result schema
const workflowResultSchema = z.object({
  company: z.string(),
  processed_shareholders: z.number(),
  skipped_shareholders: z.number(),
  verified_count: z.number(),
  pending_count: z.number(),
  notverified_count: z.number(),
  beneficial_ownership_incomplete_count: z.number(),
  verification_results: z.array(verificationResultSchema),
  summary: z.string(),
});

// Step 1: Fetch all shareholders for the company
const fetchShareholders = new Step({
  id: 'fetch-shareholders',
  description: 'Fetches all shareholders for a company and filters out notverified ones',
  inputSchema: companySchema,
  outputSchema: storedDataSchema,
  execute: async ({ context }) => {
    const companyName = context?.getStepResult<{ name: string }>('trigger')?.name;
    
    if (!companyName) {
      throw new Error('Company name not found');
    }

    try {
      // Fetch shareholders from API
      const response = await axios.get(`http://localhost:3000/companies/${companyName}/shareholders`);
      
      // Filter out shareholders with "notverified" status - only process "pending" and "verified" ones
      const filteredShareholders = response.data.shareholders.filter(
        (shareholder: any) => shareholder.verification_Status !== 'notverified'
      );
      
      console.log(`Found ${response.data.shareholders.length} shareholders, processing ${filteredShareholders.length} (excluding notverified)`);
      
      // Parse data for each shareholder
      const processedShareholders = filteredShareholders.map((shareholder: any) => {
        // Parse discrepancies
        try {
          if (shareholder.discrepancies) {
            shareholder.parsedDiscrepancies = JSON.parse(shareholder.discrepancies);
          } else {
            shareholder.parsedDiscrepancies = [];
          }
        } catch (e) {
          console.error(`Error parsing discrepancies for shareholder ${shareholder.id}:`, e);
          shareholder.parsedDiscrepancies = [];
        }
        
        // Parse sources (convert each source field into a structured object)
        shareholder.parsedSources = {};
        
        // Fields to process based on shareholder type
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
        
        // Parse source data for each field
        fieldsToProcess.forEach(field => {
          const sourceField = `${field}_source`;
          try {
            if (shareholder[sourceField]) {
              shareholder.parsedSources[field] = JSON.parse(shareholder[sourceField]);
            } else {
              shareholder.parsedSources[field] = [];
            }
          } catch (e) {
            console.error(`Error parsing ${sourceField} for shareholder ${shareholder.id}:`, e);
            shareholder.parsedSources[field] = [];
          }
        });
        
        // Parse beneficial owners for corporate shareholders
        if (shareholder.shareholder_type === 'Corporate' && shareholder.beneficial_owners) {
          try {
            shareholder.parsedBeneficialOwners = JSON.parse(shareholder.beneficial_owners);
          } catch (e) {
            console.error(`Error parsing beneficial owners for shareholder ${shareholder.id}:`, e);
            shareholder.parsedBeneficialOwners = [];
          }
        } else {
          shareholder.parsedBeneficialOwners = [];
        }
        
        return shareholder;
      });
      
      return {
        company: companyName,
        shareholders: processedShareholders as z.infer<typeof shareholderInfoSchema>[]
      };
    } catch (error) {
      console.error('Error fetching shareholder data:', error);
      throw new Error(`Failed to retrieve shareholder data for company ${companyName}`);
    }
  },
});

// Step 2: Verify shareholders and update status
const verifyShareholders = new Step({
  id: 'verify-shareholders',
  description: 'Evaluates shareholder information, discrepancies, and beneficial ownership',
  inputSchema: storedDataSchema,
  outputSchema: workflowResultSchema,
  execute: async ({ context }) => {
    const shareholderData = context?.getStepResult(fetchShareholders);
    const companyName = context?.getStepResult<{ name: string }>('trigger')?.name;
    
    if (!shareholderData || !shareholderData.shareholders || shareholderData.shareholders.length === 0) {
      console.log('No shareholders to verify');
      return {
        company: shareholderData?.company || 'Unknown',
        processed_shareholders: 0,
        skipped_shareholders: 0,
        verified_count: 0,
        pending_count: 0,
        notverified_count: 0,
        beneficial_ownership_incomplete_count: 0,
        verification_results: [],
        summary: 'No shareholders to verify',
      };
    }

    // Get company-specific requirements
    const companyRequirements = getCompanyRequirements(companyName);
    console.log(`Using verification requirements for company ${companyName}:`, companyRequirements);

    const verificationResults: Array<z.infer<typeof verificationResultSchema>> = [];
    let verified = 0;
    let pending = 0;
    let notverified = 0;
    let beneficialOwnershipIncomplete = 0;
    let skipped = 0;
    
    for (const shareholderBase of shareholderData.shareholders) {
      // Safely cast to our extended type with runtime properties
      const shareholder = shareholderBase as Shareholder;
      
      // Skip shareholders that are already marked as notverified
      if (shareholder.verification_Status === 'notverified') {
        skipped++;
        continue;
      }

      // Determine name for display (either full_name for individual or company_name for corporate)
      const shareholderName = shareholder.shareholder_type === 'Individual' 
        ? shareholder.full_name 
        : shareholder.company_name;
      
      console.log(`Verifying shareholder: ${shareholderName || 'Unknown'} (${shareholder.shareholder_type})`);
      
      // Check for discrepancies
      let discrepancies: Discrepancy[] = [];
      try {
        if (shareholder.discrepancies) {
          discrepancies = typeof shareholder.discrepancies === 'string' 
            ? JSON.parse(shareholder.discrepancies)
            : (shareholder.parsedDiscrepancies || []);
        }
      } catch (e) {
        console.error(`Error parsing discrepancies for shareholder ${shareholder.id}:`, e);
        discrepancies = [];
      }
      
      // Evaluate document requirements based on shareholder type and origin
      const requirementEvaluation = evaluateShareholderRequirements(
        shareholder, 
        companyRequirements
      );
      
      // If there are discrepancies, evaluate if they're genuine
      const genuineDiscrepancies: GenuineDiscrepancy[] = [];
      const resolvedDiscrepancies: ResolvedDiscrepancy[] = [];
      
      if (discrepancies.length > 0) {
        const prompt = `
        I need to evaluate if the following discrepancies in a shareholder's KYC information are genuine issues or just variations of the same information:
        
        Shareholder: ${shareholderName || 'Unknown'}
        Shareholder Type: ${shareholder.shareholder_type}
        Origin: ${shareholder.origin || 'Unknown'}
        
        Company Requirements:
        ${formatShareholderRequirements(companyRequirements)}
        
        Discrepancies:
        ${JSON.stringify(discrepancies, null, 2)}
        
        Document sources information:
        ${JSON.stringify(shareholder.parsedSources || {}, null, 2)}
        
        For each discrepancy, determine if it's a genuine issue (different information) or just a variation (same information in different format).
        Consider the document categories and shareholder type when evaluating discrepancies.
        
        Specific considerations by shareholder type:
        
        FOR INDIVIDUAL SHAREHOLDERS:
        - ID discrepancies: NRIC (Singapore) or passport (foreign) is required
        - Address discrepancies: Complete residential address is required
        - Name variations: Consider if they clearly refer to the same person
        
        FOR CORPORATE SHAREHOLDERS:
        - Company name variations: Check if they refer to the same entity
        - Registration number: Must be consistent (UEN for Singapore companies)
        - Registered address: Official address must be consistent
        - Signatory information: Must be present and consistent
        
        Examples of variations that are NOT genuine discrepancies:
        1. "American" vs "USA" (same nationality, different format)
        2. "Singaporean" vs "Singapore" (same nationality, different format)
        3. "John Doe" vs "Johnathan Doe" if they clearly refer to the same person
        4. Different formats of the same address
        5. "XYZ Pte Ltd" vs "XYZ Private Limited" (same company, different format)
        
        Examples of GENUINE discrepancies:
        1. Different nationalities or countries of incorporation
        2. Different addresses that don't refer to the same location
        3. Different ID or registration numbers
        4. Names that may refer to different people or companies
        
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
        const response = await shareholderVerificationAgent.stream([
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
          console.error(`Error parsing verification evaluation for ${shareholderName}:`, error);
        }
      }
      
      // Check for missing required fields based on shareholder type
      const missingFields = getMissingRequiredFields(shareholder);
      
      // Add any missing document requirements to the missing fields
      const missingDocuments = requirementEvaluation.missingRequirements;
      
      // For corporate shareholders, check beneficial ownership
      let beneficialOwnershipIssues: Array<{ owner_name: string, issue: string }> = [];
      let beneficialOwnershipVerified = true;
      
      if (shareholder.shareholder_type === 'Corporate' && 
          shareholder.percentage_ownership && 
          shareholder.percentage_ownership >= (companyRequirements.beneficial_ownership_threshold || 25)) {
        
        // Check for beneficial ownership information
        if (!shareholder.parsedBeneficialOwners || shareholder.parsedBeneficialOwners.length === 0) {
          beneficialOwnershipIssues.push({
            owner_name: "Missing",
            issue: "No beneficial owners identified for corporate shareholder with 25%+ ownership"
          });
          beneficialOwnershipVerified = false;
        } else {
          // Check verification status of each beneficial owner
          for (const owner of shareholder.parsedBeneficialOwners) {
            if (owner.requires_kyc && !owner.verification_status) {
              beneficialOwnershipIssues.push({
                owner_name: owner.name || "Unknown",
                issue: "Beneficial owner requires KYC but verification status not set"
              });
              beneficialOwnershipVerified = false;
            } else if (owner.requires_kyc && owner.verification_status === 'notverified') {
              beneficialOwnershipIssues.push({
                owner_name: owner.name || "Unknown",
                issue: "Beneficial owner failed verification"
              });
              beneficialOwnershipVerified = false;
            } else if (owner.requires_kyc && owner.verification_status === 'pending') {
              beneficialOwnershipIssues.push({
                owner_name: owner.name || "Unknown",
                issue: "Beneficial owner verification pending"
              });
              beneficialOwnershipVerified = false;
            }
          }
        }
      }
      
      // Determine verification status
      let verificationStatus: 'verified' | 'notverified' | 'pending' | 'beneficial_ownership_incomplete';
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
      } else if (missingFields.length > 0 || missingDocuments.length > 0) {
        // No genuine discrepancies but some required fields or documents are missing - mark as pending
        verificationStatus = 'pending';
        kycStatus = JSON.stringify({
          status: 'Required fields or documents missing',
          missing_fields: missingFields,
          missing_documents: missingDocuments
        });
        pending++;
      } else if (!beneficialOwnershipVerified) {
        // All fields present but beneficial ownership verification incomplete
        verificationStatus = 'beneficial_ownership_incomplete';
        kycStatus = JSON.stringify({
          status: 'Beneficial ownership verification incomplete',
          issues: beneficialOwnershipIssues
        });
        beneficialOwnershipIncomplete++;
      } else {
        // No genuine discrepancies, all required fields present, and beneficial ownership verified
        verificationStatus = 'verified';
        verified++;
      }
      
      // Prepare verification result
      const verificationResult: z.infer<typeof verificationResultSchema> = {
        shareholder_id: shareholder.id,
        name: shareholderName,
        shareholder_type: shareholder.shareholder_type,
        origin: shareholder.origin,
        verification_Status: verificationStatus,
        KYC_Status: kycStatus,
        details: {
          genuine_discrepancies: genuineDiscrepancies,
          resolved_discrepancies: resolvedDiscrepancies,
          missing_fields: missingFields,
          missing_documents: missingDocuments,
          beneficial_ownership_issues: beneficialOwnershipIssues
        }
      };
      
      // Update the shareholder status in the database
      try {
        await axios.patch(`http://localhost:3000/shareholders/${shareholder.id}/verification`, {
          verification_Status: verificationStatus,
          KYC_Status: kycStatus
        });
        console.log(`Updated verification status for shareholder ${shareholder.id} to ${verificationStatus}`);
      } catch (updateError) {
        console.error(`Error updating shareholder ${shareholder.id}:`, updateError);
      }
      
      verificationResults.push(verificationResult);
    }
    
    // Generate summary
    const summary = `
    KYC Verification Summary for ${shareholderData.company}
    -------------------------------------------
    Shareholders processed: ${verificationResults.length}
    Shareholders skipped (already notverified): ${skipped}
    
    Results:
    - Verified: ${verified}
    - Pending (incomplete information): ${pending}
    - Not Verified (discrepancies found): ${notverified}
    - Beneficial Ownership Incomplete: ${beneficialOwnershipIncomplete}
    
    Company Requirements:
    ${formatShareholderRequirements(companyRequirements)}
    `;
    
    return {
      company: shareholderData.company,
      processed_shareholders: verificationResults.length,
      skipped_shareholders: skipped,
      verified_count: verified,
      pending_count: pending,
      notverified_count: notverified,
      beneficial_ownership_incomplete_count: beneficialOwnershipIncomplete,
      verification_results: verificationResults,
      summary
    };
  },
});

// Create and commit the verification workflow
const shareholderVerificationWorkflow = new Workflow({
  name: 'shareholder-verification-workflow',
  triggerSchema: companySchema,
})
  .step(fetchShareholders)
  .then(verifyShareholders);

shareholderVerificationWorkflow.commit();

export { shareholderVerificationWorkflow };

// Helper function to determine missing required fields based on shareholder type
function getMissingRequiredFields(shareholder: Shareholder): string[] {
  const missingFields: string[] = [];
  
  // Common required fields for all shareholders
  const commonRequiredFields = [
    'email_address', 
    'number_of_shares',
    'price_per_share', 
    'percentage_ownership'
  ];
  
  // Required fields specific to individual shareholders
  const individualRequiredFields = [
    'full_name',
    'id_number',
    'id_type',
    'nationality',
    'residential_address'
  ];
  
  // Required fields specific to corporate shareholders
  const corporateRequiredFields = [
    'company_name',
    'registration_number',
    'registered_address',
    'signatory_name',
    'signatory_email'
  ];
  
  // Determine which fields to check based on shareholder type
  const fieldsToCheck = [
    ...commonRequiredFields,
    ...(shareholder.shareholder_type === 'Individual' 
      ? individualRequiredFields 
      : corporateRequiredFields)
  ];
  
  // Check each required field
  fieldsToCheck.forEach(field => {
    const value = (shareholder as any)[field];
    if (value === null || value === undefined || value === '') {
      missingFields.push(field);
    }
  });
  
  return missingFields;
}

// Helper function to evaluate shareholder document requirements based on type and origin
function evaluateShareholderRequirements(
  shareholder: Shareholder, 
  requirements: z.infer<typeof companyRequirementsSchema>
): {
  missingRequirements: string[];
  hasRequiredDocuments: boolean;
} {
  const missingRequirements: string[] = [];
  const documentCategories = new Set<string>();
  
  // Extract all document categories from all sources
  if (shareholder.parsedSources) {
    Object.values(shareholder.parsedSources).forEach(sources => {
      sources.forEach(source => {
        if (source.documentCategory) {
          documentCategories.add(source.documentCategory.toLowerCase());
        }
      });
    });
  }
  
  // Determine required document types based on shareholder type and origin
  let requiredDocuments: string[] = [];
  
  if (shareholder.shareholder_type === 'Individual') {
    if (shareholder.origin === 'Singapore') {
      requiredDocuments = requirements.singapore_individual_documents;
    } else {
      requiredDocuments = requirements.foreign_individual_documents;
    }
  } else { // Corporate
    if (shareholder.origin === 'Singapore') {
      requiredDocuments = requirements.singapore_corporate_documents;
    } else {
      requiredDocuments = requirements.foreign_corporate_documents;
      
      // For foreign corporate shareholders with 25%+ ownership, register_of_members is required
      if (shareholder.percentage_ownership && 
          shareholder.percentage_ownership >= (requirements.beneficial_ownership_threshold || 25)) {
        if (!requiredDocuments.includes('register_of_members')) {
          requiredDocuments.push('register_of_members');
        }
      }
    }
  }
  
  // Check for missing required documents
  for (const requiredDoc of requiredDocuments) {
    let hasDocument = false;
    
    // Check if any document has this category
    for (const category of documentCategories) {
      if (category.includes(requiredDoc)) {
        hasDocument = true;
        break;
      }
    }
    
    if (!hasDocument) {
      missingRequirements.push(requiredDoc);
    }
  }
  
  return {
    missingRequirements,
    hasRequiredDocuments: missingRequirements.length === 0
  };
}

// Helper function to get company-specific requirements
function getCompanyRequirements(companyName?: string): z.infer<typeof companyRequirementsSchema> {
  // Default requirements for all companies
  const defaultRequirements = {
    singapore_individual_documents: ['nric', 'proof_of_address', 'email_verification'],
    foreign_individual_documents: ['passport', 'proof_of_address', 'email_verification'],
    singapore_corporate_documents: ['acra_bizfile', 'signatory_information'],
    foreign_corporate_documents: ['certificate_of_incorporation', 'register_of_directors', 'proof_of_address', 'signatory_information'],
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