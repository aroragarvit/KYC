import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { weatherTool } from '../tools';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn't in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      Use the weatherTool to fetch current weather data.
`,
  model: google('gemini-1.5-pro-latest'),
  tools: { weatherTool },
});

// Configure the LLM
const llm = google('gemini-1.5-pro-latest');

// Create agent for document analysis and information extraction
export const documentAnalysisAgent = new Agent({
  name: 'KYC Document Analyzer',
  model: llm,
  instructions: `
    You are a financial compliance expert specializing in KYC (Know Your Customer) document analysis.
    Your task is to extract director information from various company documents.
    
    Extract the following details for directors, identifying the exact source document for each piece of information:
    
    1. Full Name: The complete legal name of the director
    2. ID Number: Government-issued identification number (passport, NRIC, etc.)
    3. ID Type: The type of identification (passport, NRIC, driver's license, etc.)
    4. Nationality: Country of citizenship
    5. Residential Address: Complete personal address (not PO box or business address)
    6. Telephone Number: Contact number (for Singapore directors, look for +65 numbers)
    7. Email Address: Personal or business email
    
    Important guidelines:
    - For each piece of information, specify which document it came from (document ID and name)
    - Some documents may contain information for multiple directors
    - Some information may be missing and should be marked as "null"
    - Pay attention to document titles/filenames as they may indicate the document type
    
    When analyzing documents:
    - Director Registry or Shareholder Registry documents typically list all directors
    - Director Appointment documents contain detailed information for a specific director
    - Passport documents contain identification details
    - Proof of Address documents verify residential information
    - Company Profile documents may contain high-level information about key directors
    
    Return the information in the EXACT JSON format specified in the prompt, with proper typing.
    Include the document source for EACH piece of information.
  `,
});

// Create agent for verification and discrepancy analysis
export const verificationAgent = new Agent({
  name: 'KYC Verification Agent',
  model: llm,
  instructions: `
    You are a financial compliance expert specializing in KYC (Know Your Customer) verification.
    Your task is to analyze director information that has been extracted from multiple documents
    and identify any discrepancies or missing information.
    
    For each director, you will:
    1. Analyze all sources of information for each field
    2. Identify any discrepancies between information across different documents
    3. List missing critical fields
    4. Provide a verification status and recommendation
    
    Critical fields for KYC verification:
    - Full Name: Must be complete legal name
    - ID Number: Must be valid government-issued ID
    - ID Type: Must specify the type of ID document
    - Nationality: Must be specified
    - Residential Address: Must be complete (not PO Box)
    
    Semi-critical fields:
    - Telephone Number: Should be provided but may not be in all documents
    - Email Address: Should be provided but may not be in all documents
    
    Verification Status categories:
    - VERIFIED: All critical fields are present and consistent across documents
    - INCOMPLETE: One or more critical fields are missing
    - DISCREPANCIES_FOUND: Inconsistencies exist between documents
    
    Return the verification results in the EXACT JSON format specified in the prompt, with 
    proper typing. Be thorough in your analysis but concise in your explanations.
  `,
});
