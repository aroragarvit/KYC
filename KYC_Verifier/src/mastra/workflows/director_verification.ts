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

// Stored data schema
const storedDataSchema = z.object({
  company: z.string(),
  directors: z.array(directorInfoSchema),
  timestamp: z.string().optional(),
});

// Verification result schema with discrepancies
const verificationResultSchema = z.object({
  director: directorInfoSchema,
  discrepancies: z.array(z.object({
    field: z.string(),
    values: z.array(z.object({
      value: z.string(),
      source: z.string(),
    })),
    recommendation: z.string(),
  })),
  missing_fields: z.array(z.string()),
  verification_status: z.enum(['VERIFIED', 'INCOMPLETE', 'DISCREPANCIES_FOUND']),
  verification_summary: z.string(),
});

// Final workflow result schema
const workflowResultSchema = z.object({
  company: z.string(),
  directors: z.array(verificationResultSchema),
  verification_status: z.enum(['VERIFIED', 'INCOMPLETE', 'DISCREPANCIES_FOUND']),
  summary: z.string(),
});

// Step 1: Fetch director data from storage
const fetchDirectorData = new Step({
  id: 'fetch-director-data',
  description: 'Fetches stored director information for a company',
  inputSchema: companySchema,
  outputSchema: storedDataSchema,
  execute: async ({ context }) => {
    const companyName = context?.getStepResult<{ name: string }>('trigger')?.name;
    
    if (!companyName) {
      throw new Error('Company name not found');
    }

    try {
      // Try fetching from API first using the companies/:name/directors endpoint
      const response = await axios.get(`http://localhost:3000/companies/${companyName}/directors`);
      
      // Transform the response to match our schema
      const directors = response.data.directors.map((director: any) => {
        // Parse the source strings back to objects
        const parseSourceField = (sourceStr: string | null) => {
          if (!sourceStr) return [];
          try {
            return JSON.parse(sourceStr);
          } catch (e) {
            return [];
          }
        };

        return {
          full_name: director.full_name,
          id_number: director.id_number,
          id_type: director.id_type,
          nationality: director.nationality,
          residential_address: director.residential_address,
          telephone_number: director.telephone_number,
          email_address: director.email_address,
          sources: {
            full_name: parseSourceField(director.full_name_source),
            id_number: parseSourceField(director.id_number_source),
            id_type: parseSourceField(director.id_type_source),
            nationality: parseSourceField(director.nationality_source),
            residential_address: parseSourceField(director.residential_address_source),
            telephone_number: parseSourceField(director.telephone_number_source),
            email_address: parseSourceField(director.email_address_source),
          }
        };
      });

      return {
        company: companyName,
        directors: directors
      };
    } catch (error) {
      console.log(`API fetch failed, trying local storage for ${companyName}`);
      
      // If API call fails, check local storage
      try {
        const dataDir = path.join(process.cwd(), 'data');
        const filePath = path.join(dataDir, `${companyName.toLowerCase()}_directors.json`);
        
        if (!fs.existsSync(filePath)) {
          throw new Error(`No stored data found for company ${companyName}`);
        }
        
        const fileData = fs.readFileSync(filePath, 'utf8');
        const parsedData = JSON.parse(fileData);
        
        return {
          company: parsedData.company,
          directors: parsedData.directors,
          timestamp: parsedData.timestamp
        };
      } catch (fsError) {
        console.error('Error reading director data from storage:', fsError);
        throw new Error(`Failed to retrieve director data for company ${companyName}`);
      }
    }
  },
});

// Step 2: Verify director information and identify discrepancies
const verifyDirectorInfo = new Step({
  id: 'verify-director-info',
  description: 'Verifies director information and identifies discrepancies',
  inputSchema: storedDataSchema,
  outputSchema: z.array(verificationResultSchema),
  execute: async ({ context }) => {
    const directorData = context?.getStepResult(fetchDirectorData);
    
    if (!directorData || !directorData.directors || directorData.directors.length === 0) {
      throw new Error('No director information found');
    }

    const verificationResults = [];
    
    for (const director of directorData.directors) {
      // Prepare prompt for verification agent
      const prompt = `
      I need to verify the following director information that has been extracted from multiple documents:
      
      ${JSON.stringify(director, null, 2)}
      
      Please analyze this information to:
      1. Identify any discrepancies between different sources
      2. List any missing critical fields
      3. Provide a verification status
      
      Return your analysis in this exact JSON format:
      {
        "director": ${JSON.stringify(director)},
        "discrepancies": [
          {
            "field": "field_name",
            "values": [
              { "value": "value1", "source": "Document 1" },
              { "value": "value2", "source": "Document 2" }
            ],
            "recommendation": "Clear explanation of the issue and recommendation"
          }
        ],
        "missing_fields": ["field_name1", "field_name2"],
        "verification_status": "STATUS", // VERIFIED, INCOMPLETE, or DISCREPANCIES_FOUND
        "verification_summary": "A concise summary of the verification result"
      }
      `;

      // Call the verification agent
      const response = await verificationAgent.stream([
        { role: 'user', content: prompt }
      ]);

      let resultText = '';
      for await (const chunk of response.textStream) {
        resultText += chunk;
      }

      // Parse the response
      try {
        const verificationResult = JSON.parse(resultText);
        verificationResults.push(verificationResult);
      } catch (error) {
        console.error(`Error parsing verification result for ${director.full_name}:`, error);
        // Try to extract JSON from text response
        const jsonRegex = /\{[\s\S]*\}/g;
        const match = resultText.match(jsonRegex);
        if (match) {
          try {
            const extracted = JSON.parse(match[0]);
            verificationResults.push(extracted);
          } catch (e) {
            throw new Error(`Failed to parse verification result for ${director.full_name}`);
          }
        } else {
          throw new Error(`Failed to extract verification result for ${director.full_name}`);
        }
      }
    }
    
    return verificationResults;
  },
});

// Step 3: Generate final verification report
const generateVerificationReport = new Step({
  id: 'generate-verification-report',
  description: 'Generates a final verification report',
  inputSchema: z.array(verificationResultSchema),
  outputSchema: workflowResultSchema,
  execute: async ({ context }) => {
    const verificationResults = context?.getStepResult(verifyDirectorInfo);
    const directorData = context?.getStepResult(fetchDirectorData);
    
    if (!verificationResults || verificationResults.length === 0) {
      throw new Error('No verification results found');
    }
    
    if (!directorData || !directorData.company) {
      throw new Error('Company information not found');
    }

    const companyName = directorData.company;

    // Determine overall verification status
    let overallStatus: 'VERIFIED' | 'INCOMPLETE' | 'DISCREPANCIES_FOUND' = 'VERIFIED';
    for (const result of verificationResults) {
      if (result.verification_status === 'INCOMPLETE') {
        overallStatus = 'INCOMPLETE';
      } else if (result.verification_status === 'DISCREPANCIES_FOUND' && overallStatus !== 'INCOMPLETE') {
        overallStatus = 'DISCREPANCIES_FOUND';
      }
    }

    // Generate summary based on verification results
    let summary = `KYC Verification Report for ${companyName}\n\n`;
    summary += `Directors Analyzed: ${verificationResults.length}\n`;
    
    const verified = verificationResults.filter(r => r.verification_status === 'VERIFIED').length;
    const incomplete = verificationResults.filter(r => r.verification_status === 'INCOMPLETE').length;
    const discrepancies = verificationResults.filter(r => r.verification_status === 'DISCREPANCIES_FOUND').length;
    
    summary += `Verified: ${verified}\n`;
    summary += `Incomplete: ${incomplete}\n`;
    summary += `With Discrepancies: ${discrepancies}\n\n`;
    
    summary += `Overall Status: ${overallStatus}\n\n`;
    
    if (overallStatus !== 'VERIFIED') {
      summary += 'Action Required: The following issues need to be addressed:\n';
      
      verificationResults.forEach((result, index) => {
        if (result.verification_status !== 'VERIFIED') {
          summary += `\n- Director ${index + 1} (${result.director.full_name || 'Unknown'}): ${result.verification_status}\n`;
          
          if (result.missing_fields.length > 0) {
            summary += `  Missing fields: ${result.missing_fields.join(', ')}\n`;
          }
          
          if (result.discrepancies.length > 0) {
            summary += `  Discrepancies: ${result.discrepancies.length} found\n`;
            result.discrepancies.forEach(discrepancy => {
              summary += `    - ${discrepancy.field}: ${discrepancy.recommendation}\n`;
            });
          }
        }
      });
    }

    // Store verification results if needed
    try {
      // Since there's no direct verification results API, 
      // we'll update each director with the discrepancies field
      for (const verificationResult of verificationResults) {
        try {
          // Find existing director in database
          const director = verificationResult.director;
          if (director && director.full_name) {
            // Post to the companies/:name/directors endpoint with discrepancies
            await axios.post(`http://localhost:3000/companies/${companyName}/directors`, {
              full_name: director.full_name,
              id_number: director.id_number,
              id_type: director.id_type,
              nationality: director.nationality,
              residential_address: director.residential_address,
              telephone_number: director.telephone_number,
              email_address: director.email_address,
              // Keep source information
              full_name_source: JSON.stringify(director.sources?.full_name || []),
              id_number_source: JSON.stringify(director.sources?.id_number || []),
              id_type_source: JSON.stringify(director.sources?.id_type || []),
              nationality_source: JSON.stringify(director.sources?.nationality || []),
              residential_address_source: JSON.stringify(director.sources?.residential_address || []),
              telephone_number_source: JSON.stringify(director.sources?.telephone_number || []),
              email_address_source: JSON.stringify(director.sources?.email_address || []),
              // Add discrepancies information
              discrepancies: JSON.stringify(verificationResult.discrepancies)
            });
          }
        } catch (directorError) {
          console.error('Error updating director with verification results:', directorError);
        }
      }
    } catch (error) {
      console.log('Failed to store verification results, continuing with report generation');
    }

    return {
      company: companyName,
      directors: verificationResults,
      verification_status: overallStatus,
      summary,
    };
  },
});

// Create and commit the verification workflow
const directorVerificationWorkflow = new Workflow({
  name: 'director-verification-workflow',
  triggerSchema: companySchema,
})
  .step(fetchDirectorData)
  .then(verifyDirectorInfo)
  .then(generateVerificationReport);

directorVerificationWorkflow.commit();

export { directorVerificationWorkflow }; 