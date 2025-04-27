import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const API_BASE_URL = "http://localhost:3000";

// Type definitions for KYC data
interface Individual {
  id: number;
  full_name: string;
  alternative_names: string[];
  id_numbers: Record<string, any>;
  id_types: Record<string, any>;
  nationalities: Record<string, any>;
  addresses: Record<string, any>;
  emails: Record<string, any>;
  phones: Record<string, any>;
  roles: Record<string, any>;
  shares_owned: Record<string, any>;
  price_per_share: Record<string, any>;
  discrepancies: string[];
  created_at: string;
}

interface Company {
  id: number;
  company_name: string;
  registration_number: Record<string, any>;
  jurisdiction: Record<string, any>;
  address: Record<string, any>;
  directors: any[];
  shareholders: any[];
  company_activities: Record<string, any>;
  shares_issued: Record<string, any>;
  price_per_share: Record<string, any>;
  discrepancies: string[];
  created_at: string;
}

interface Director {
  company_name: string;
  director_name: string;
  id_number?: string;
  id_number_source?: string;
  id_type?: string;
  id_type_source?: string;
  nationality?: string;
  nationality_source?: string;
  residential_address?: string;
  residential_address_source?: string;
  tel_number?: string;
  tel_number_source?: string;
  email_address?: string;
  email_address_source?: string;
  verification_status?: string;
  kyc_status?: string;
  created_at: string;
  updated_at: string;
}

interface Shareholder {
  company_name: string;
  shareholder_name: string;
  shares_owned?: string;
  shares_owned_source?: string;
  price_per_share?: string;
  price_per_share_source?: string;
  id_number?: string;
  id_number_source?: string;
  id_type?: string;
  id_type_source?: string;
  nationality?: string;
  nationality_source?: string;
  address?: string;
  address_source?: string;
  tel_number?: string;
  tel_number_source?: string;
  email_address?: string;
  email_address_source?: string;
  verification_status?: string;
  kyc_status?: string;
  is_company?: number;
  created_at: string;
  updated_at: string;
}

interface KycSummary {
  total_individuals: number;
  total_companies: number;
  total_documents: number;
  individuals_with_discrepancies: number;
  companies_with_discrepancies: number;
}

// Response interfaces
interface IndividualsResponse {
  individuals: Individual[];
}

interface IndividualResponse {
  individual: Individual;
}

interface CompaniesResponse {
  companies: Company[];
}

interface CompanyResponse {
  company: Company;
}

interface DirectorsResponse {
  directors: Director[];
}

interface ShareholdersResponse {
  shareholders: Shareholder[];
}

interface SummaryResponse {
  summary: KycSummary;
}

// Tool to fetch all individuals
export const getAllIndividualsTool = createTool({
  id: "get-all-individuals",
  description: "Get information about all individuals in the KYC database",
  inputSchema: z.object({
    client_id: z.string().describe("ID of the client to get individuals for")
  }),
  outputSchema: z.array(
    z.object({
      id: z.number(),
      full_name: z.string(),
      alternative_names: z.array(z.string()),
      id_numbers: z.record(z.any()),
      id_types: z.record(z.any()),
      nationalities: z.record(z.any()),
      addresses: z.record(z.any()),
      emails: z.record(z.any()),
      phones: z.record(z.any()),
      roles: z.record(z.any()),
      shares_owned: z.record(z.any()),
      price_per_share: z.record(z.any()),
      discrepancies: z.array(z.string()),
      created_at: z.string(),
    }),
  ),
  execute: async ({ context }) => {
    const response = await fetch(`${API_BASE_URL}/kyc/individuals?client_id=${context.client_id}`);
    const data = (await response.json()) as IndividualsResponse;
    return data.individuals;
  },
});

// Tool to search individuals by partial name
export const searchIndividualsByPartialNameTool = createTool({
  id: "search-individuals-by-partial-name",
  description: "Search for individuals by partial name match",
  inputSchema: z.object({
    partial_name: z.string().describe("Partial name to search for"),
    client_id: z.string().describe("ID of the client to search individuals for")
  }),
  outputSchema: z.array(
    z.object({
      id: z.number(),
      full_name: z.string(),
      alternative_names: z.array(z.string()),
      id_numbers: z.record(z.any()),
      id_types: z.record(z.any()),
      nationalities: z.record(z.any()),
      addresses: z.record(z.any()),
      emails: z.record(z.any()),
      phones: z.record(z.any()),
      roles: z.record(z.any()),
      shares_owned: z.record(z.any()),
      price_per_share: z.record(z.any()),
      discrepancies: z.array(z.string()),
      created_at: z.string(),
    }),
  ),
  execute: async ({ context }) => {
    const response = await fetch(`${API_BASE_URL}/kyc/individuals/search?partial_name=${encodeURIComponent(context.partial_name)}&client_id=${context.client_id}`);
    const data = (await response.json()) as IndividualsResponse;
    return data.individuals;
  },
});

// Tool to fetch individual by name
export const getIndividualByNameTool = createTool({
  id: "get-individual-by-name",
  description: "Get information about a specific individual by name",
  inputSchema: z.object({
    name: z.string().describe("Full name of the individual to search for"),
    client_id: z.string().describe("ID of the client to get individual for")
  }),
  outputSchema: z
    .object({
      id: z.number(),
      full_name: z.string(),
      alternative_names: z.array(z.string()),
      id_numbers: z.record(z.any()),
      id_types: z.record(z.any()),
      nationalities: z.record(z.any()),
      addresses: z.record(z.any()),
      emails: z.record(z.any()),
      phones: z.record(z.any()),
      roles: z.record(z.any()),
      shares_owned: z.record(z.any()),
      price_per_share: z.record(z.any()),
      discrepancies: z.array(z.string()),
      created_at: z.string(),
    })
    .nullable(),
  execute: async ({ context }) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/kyc/individuals/by-name/${encodeURIComponent(context.name)}?client_id=${context.client_id}`,
      );
      const data = (await response.json()) as IndividualResponse;
      return data.individual;
    } catch (error) {
      return null;
    }
  },
});

// Tool to fetch all companies
export const getAllCompaniesTool = createTool({
  id: "get-all-companies",
  description: "Get information about all companies in the KYC database",
  inputSchema: z.object({
    client_id: z.string().describe("ID of the client to get companies for")
  }),
  outputSchema: z.array(
    z.object({
      id: z.number(),
      company_name: z.string(),
      registration_number: z.record(z.any()),
      jurisdiction: z.record(z.any()),
      address: z.record(z.any()),
      directors: z.array(z.any()),
      shareholders: z.array(z.any()),
      company_activities: z.record(z.any()),
      shares_issued: z.record(z.any()),
      price_per_share: z.record(z.any()),
      discrepancies: z.array(z.string()),
      created_at: z.string(),
    }),
  ),
  execute: async ({ context }) => {
    const response = await fetch(`${API_BASE_URL}/kyc/companies?client_id=${context.client_id}`);
    const data = (await response.json()) as CompaniesResponse;
    return data.companies;
  },
});

// Tool to search companies by partial name
export const searchCompaniesByPartialNameTool = createTool({
  id: "search-companies-by-partial-name",
  description: "Search for companies by partial name match",
  inputSchema: z.object({
    partial_name: z.string().describe("Partial name to search for"),
    client_id: z.string().describe("ID of the client to search companies for")
  }),
  outputSchema: z.array(
    z.object({
      id: z.number(),
      company_name: z.string(),
      registration_number: z.record(z.any()),
      jurisdiction: z.record(z.any()),
      address: z.record(z.any()),
      directors: z.array(z.any()),
      shareholders: z.array(z.any()),
      company_activities: z.record(z.any()),
      shares_issued: z.record(z.any()),
      price_per_share: z.record(z.any()),
      discrepancies: z.array(z.string()),
      created_at: z.string(),
    }),
  ),
  execute: async ({ context }) => {
    const response = await fetch(`${API_BASE_URL}/kyc/companies/search?partial_name=${encodeURIComponent(context.partial_name)}&client_id=${context.client_id}`);
    const data = (await response.json()) as CompaniesResponse;
    return data.companies;
  },
});

// Tool to fetch company by name
export const getCompanyByNameTool = createTool({
  id: "get-company-by-name",
  description: "Get information about a specific company by name",
  inputSchema: z.object({
    name: z.string().describe("Name of the company to search for"),
    client_id: z.string().describe("ID of the client to get company for")
  }),
  outputSchema: z
    .object({
      id: z.number(),
      company_name: z.string(),
      registration_number: z.record(z.any()),
      jurisdiction: z.record(z.any()),
      address: z.record(z.any()),
      directors: z.array(z.any()),
      shareholders: z.array(z.any()),
      company_activities: z.record(z.any()),
      shares_issued: z.record(z.any()),
      price_per_share: z.record(z.any()),
      discrepancies: z.array(z.string()),
      created_at: z.string(),
    })
    .nullable(),
  execute: async ({ context }) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/kyc/companies/by-name/${encodeURIComponent(context.name)}?client_id=${context.client_id}`,
      );
      const data = (await response.json()) as CompanyResponse;
      return data.company;
    } catch (error) {
      return null;
    }
  },
});

// Tool to fetch directors
export const getDirectorsTool = createTool({
  id: "get-directors",
  description:
    "Get information about directors, optionally filtered by company",
  inputSchema: z.object({
    company: z
      .string()
      .optional()
      .describe("Company name to filter directors by"),
    client_id: z.string().describe("ID of the client to get directors for")
  }),
  outputSchema: z.array(
    z.object({
      company_name: z.string(),
      director_name: z.string(),
      id_number: z.string().optional(),
      id_number_source: z.string().optional(),
      id_type: z.string().optional(),
      id_type_source: z.string().optional(),
      nationality: z.string().optional(),
      nationality_source: z.string().optional(),
      residential_address: z.string().optional(),
      residential_address_source: z.string().optional(),
      tel_number: z.string().optional(),
      tel_number_source: z.string().optional(),
      email_address: z.string().optional(),
      email_address_source: z.string().optional(),
      verification_status: z.string().optional(),
      kyc_status: z.string().optional(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  ),
  execute: async ({ context }) => {
    let url = `${API_BASE_URL}/kyc/directors?client_id=${context.client_id}`;
    if (context.company) {
      url += `&company=${encodeURIComponent(context.company)}`;
    }
    const response = await fetch(url);
    const data = (await response.json()) as DirectorsResponse;
    return data.directors;
  },
});

// Tool to fetch shareholders
export const getShareholdersTool = createTool({
  id: "get-shareholders",
  description:
    "Get information about shareholders, optionally filtered by company",
  inputSchema: z.object({
    company: z
      .string()
      .optional()
      .describe("Company name to filter shareholders by"),
    client_id: z.string().describe("ID of the client to get shareholders for")
  }),
  outputSchema: z.array(
    z.object({
      company_name: z.string(),
      shareholder_name: z.string(),
      shares_owned: z.string().optional(),
      shares_owned_source: z.string().optional(),
      price_per_share: z.string().optional(),
      price_per_share_source: z.string().optional(),
      id_number: z.string().optional(),
      id_number_source: z.string().optional(),
      id_type: z.string().optional(),
      id_type_source: z.string().optional(),
      nationality: z.string().optional(),
      nationality_source: z.string().optional(),
      address: z.string().optional(),
      address_source: z.string().optional(),
      tel_number: z.string().optional(),
      tel_number_source: z.string().optional(),
      email_address: z.string().optional(),
      email_address_source: z.string().optional(),
      verification_status: z.string().optional(),
      kyc_status: z.string().optional(),
      is_company: z.number().optional(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  ),
  execute: async ({ context }) => {
    let url = `${API_BASE_URL}/kyc/shareholders?client_id=${context.client_id}`;
    if (context.company) {
      url += `&company=${encodeURIComponent(context.company)}`;
    }
    const response = await fetch(url);
    const data = (await response.json()) as ShareholdersResponse;
    return data.shareholders;
  },
});

// Tool to fetch company directors
export const getCompanyDirectorsTool = createTool({
  id: "get-company-directors",
  description: "Get all directors for a specific company",
  inputSchema: z.object({
    company: z.string().describe("Company name to get directors for"),
    client_id: z.string().describe("ID of the client to get company directors for")
  }),
  outputSchema: z.array(
    z.object({
      company_name: z.string(),
      director_name: z.string(),
      id_number: z.string().optional(),
      id_number_source: z.string().optional(),
      id_type: z.string().optional(),
      id_type_source: z.string().optional(),
      nationality: z.string().optional(),
      nationality_source: z.string().optional(),
      residential_address: z.string().optional(),
      residential_address_source: z.string().optional(),
      tel_number: z.string().optional(),
      tel_number_source: z.string().optional(),
      email_address: z.string().optional(),
      email_address_source: z.string().optional(),
      verification_status: z.string().optional(),
      kyc_status: z.string().optional(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  ),
  execute: async ({ context }) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/kyc/companies/${encodeURIComponent(context.company)}/directors?client_id=${context.client_id}`,
      );
      const data = (await response.json()) as DirectorsResponse;
      return data.directors;
    } catch (error) {
      return [];
    }
  },
});

// Tool to fetch company shareholders
export const getCompanyShareholdersTool = createTool({
  id: "get-company-shareholders",
  description: "Get all shareholders for a specific company",
  inputSchema: z.object({
    company: z.string().describe("Company name to get shareholders for"),
    client_id: z.string().describe("ID of the client to get company shareholders for")
  }),
  outputSchema: z.array(
    z.object({
      company_name: z.string(),
      shareholder_name: z.string(),
      shares_owned: z.string().optional(),
      shares_owned_source: z.string().optional(),
      price_per_share: z.string().optional(),
      price_per_share_source: z.string().optional(),
      id_number: z.string().optional(),
      id_number_source: z.string().optional(),
      id_type: z.string().optional(),
      id_type_source: z.string().optional(),
      nationality: z.string().optional(),
      nationality_source: z.string().optional(),
      address: z.string().optional(),
      address_source: z.string().optional(),
      tel_number: z.string().optional(),
      tel_number_source: z.string().optional(),
      email_address: z.string().optional(),
      email_address_source: z.string().optional(),
      verification_status: z.string().optional(),
      kyc_status: z.string().optional(),
      is_company: z.number().optional(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  ),
  execute: async ({ context }) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/kyc/companies/${encodeURIComponent(context.company)}/shareholders?client_id=${context.client_id}`,
      );
      const data = (await response.json()) as ShareholdersResponse;
      return data.shareholders;
    } catch (error) {
      return [];
    }
  },
});

// Tool to get KYC database summary
export const getKycSummaryTool = createTool({
  id: "get-kyc-summary",
  description: "Get summary statistics for the KYC database",
  inputSchema: z.object({
    client_id: z.string().describe("ID of the client to get KYC summary for")
  }),
  outputSchema: z.object({
    total_individuals: z.number(),
    total_companies: z.number(),
    total_documents: z.number(),
    individuals_with_discrepancies: z.number(),
    companies_with_discrepancies: z.number(),
  }),
  execute: async ({ context }) => {
    const response = await fetch(`${API_BASE_URL}/kyc/summary?client_id=${context.client_id}`);
    const data = (await response.json()) as SummaryResponse;
    return data.summary;
  },
});

// Tool to update director information
export const updateDirectorTool = createTool({
  id: "update-director",
  description: "Update information for a specific director of a company",
  inputSchema: z.object({
    company: z.string().describe("Company name the director belongs to"),
    director: z.string().describe("Name of the director to update"),
    client_id: z.string().describe("ID of the client the director belongs to"),
    id_number: z.string().optional().describe("ID number of the director"),
    id_type: z.string().optional().describe("Type of ID document"),
    nationality: z.string().optional().describe("Nationality of the director"),
    residential_address: z.string().optional().describe("Residential address of the director"),
    tel_number: z.string().optional().describe("Telephone number of the director"),
    email_address: z.string().optional().describe("Email address of the director"),
    verification_status: z.string().optional().describe("Verification status (pending, verified, not_verified)"),
    kyc_status: z.string().optional().describe("KYC status message")
  }),
  outputSchema: z.object({
    message: z.string(),
    company: z.string(),
    director: z.string(),
    client_id: z.string(),
    updated_fields: z.record(z.any())
  }),
  execute: async ({ context }) => {
    try {
      // Create the update payload
      const updatePayload: Record<string, any> = {};
      
      // Only include fields that were provided
      if (context.id_number !== undefined) updatePayload.id_number = context.id_number;
      if (context.id_type !== undefined) updatePayload.id_type = context.id_type;
      if (context.nationality !== undefined) updatePayload.nationality = context.nationality;
      if (context.residential_address !== undefined) updatePayload.residential_address = context.residential_address;
      if (context.tel_number !== undefined) updatePayload.tel_number = context.tel_number;
      if (context.email_address !== undefined) updatePayload.email_address = context.email_address;
      if (context.verification_status !== undefined) updatePayload.verification_status = context.verification_status;
      if (context.kyc_status !== undefined) updatePayload.kyc_status = context.kyc_status;
      
      // Send update request
      const response = await fetch(
        `${API_BASE_URL}/kyc/directors/${encodeURIComponent(context.company)}/${encodeURIComponent(context.director)}?client_id=${context.client_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updatePayload)
        }
      );
      
      const result = await response.json();
      
      if (response.ok) {
        return {
          message: result.message || "Director updated successfully",
          company: context.company,
          director: context.director,
          client_id: context.client_id,
          updated_fields: updatePayload
        };
      } else {
        throw new Error(result.error || "Failed to update director");
      }
    } catch (error: any) {
      throw new Error(`Error updating director: ${error.message}`);
    }
  },
});

// Tool to update shareholder information
export const updateShareholderTool = createTool({
  id: "update-shareholder",
  description: "Update information for a specific shareholder of a company",
  inputSchema: z.object({
    company: z.string().describe("Company name the shareholder belongs to"),
    shareholder: z.string().describe("Name of the shareholder to update"),
    client_id: z.string().describe("ID of the client the shareholder belongs to"),
    shares_owned: z.string().optional().describe("Number of shares owned"),
    price_per_share: z.string().optional().describe("Price per share"),
    id_number: z.string().optional().describe("ID number of the shareholder"),
    id_type: z.string().optional().describe("Type of ID document"),
    nationality: z.string().optional().describe("Nationality of the shareholder"),
    address: z.string().optional().describe("Address of the shareholder"),
    tel_number: z.string().optional().describe("Telephone number of the shareholder"),
    email_address: z.string().optional().describe("Email address of the shareholder"),
    verification_status: z.string().optional().describe("Verification status (pending, verified, not_verified)"),
    kyc_status: z.string().optional().describe("KYC status message"),
    is_company: z.number().optional().describe("Whether the shareholder is a company (1) or individual (0)")
  }),
  outputSchema: z.object({
    message: z.string(),
    company: z.string(),
    shareholder: z.string(),
    client_id: z.string(),
    updated_fields: z.record(z.any())
  }),
  execute: async ({ context }) => {
    try {
      // Create the update payload
      const updatePayload: Record<string, any> = {};
      
      // Only include fields that were provided
      if (context.shares_owned !== undefined) updatePayload.shares_owned = context.shares_owned;
      if (context.price_per_share !== undefined) updatePayload.price_per_share = context.price_per_share;
      if (context.id_number !== undefined) updatePayload.id_number = context.id_number;
      if (context.id_type !== undefined) updatePayload.id_type = context.id_type;
      if (context.nationality !== undefined) updatePayload.nationality = context.nationality;
      if (context.address !== undefined) updatePayload.address = context.address;
      if (context.tel_number !== undefined) updatePayload.tel_number = context.tel_number;
      if (context.email_address !== undefined) updatePayload.email_address = context.email_address;
      if (context.verification_status !== undefined) updatePayload.verification_status = context.verification_status;
      if (context.kyc_status !== undefined) updatePayload.kyc_status = context.kyc_status;
      if (context.is_company !== undefined) updatePayload.is_company = context.is_company;
      
      // Send update request
      const response = await fetch(
        `${API_BASE_URL}/kyc/shareholders/${encodeURIComponent(context.company)}/${encodeURIComponent(context.shareholder)}?client_id=${context.client_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updatePayload)
        }
      );
      
      const result = await response.json();
      
      if (response.ok) {
        return {
          message: result.message || "Shareholder updated successfully",
          company: context.company,
          shareholder: context.shareholder,
          client_id: context.client_id,
          updated_fields: updatePayload
        };
      } else {
        throw new Error(result.error || "Failed to update shareholder");
      }
    } catch (error: any) {
      throw new Error(`Error updating shareholder: ${error.message}`);
    }
  },
});
