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
  inputSchema: z.object({}),
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
  execute: async () => {
    const response = await fetch(`${API_BASE_URL}/kyc/individuals`);
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
        `${API_BASE_URL}/kyc/individuals/by-name/${encodeURIComponent(context.name)}`,
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
  inputSchema: z.object({}),
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
  execute: async () => {
    const response = await fetch(`${API_BASE_URL}/kyc/companies`);
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
        `${API_BASE_URL}/kyc/companies/by-name/${encodeURIComponent(context.name)}`,
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
    let url = `${API_BASE_URL}/kyc/directors`;
    if (context.company) {
      url += `?company=${encodeURIComponent(context.company)}`;
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
    let url = `${API_BASE_URL}/kyc/shareholders`;
    if (context.company) {
      url += `?company=${encodeURIComponent(context.company)}`;
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
        `${API_BASE_URL}/kyc/companies/${encodeURIComponent(context.company)}/directors`,
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
        `${API_BASE_URL}/kyc/companies/${encodeURIComponent(context.company)}/shareholders`,
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
  inputSchema: z.object({}),
  outputSchema: z.object({
    total_individuals: z.number(),
    total_companies: z.number(),
    total_documents: z.number(),
    individuals_with_discrepancies: z.number(),
    companies_with_discrepancies: z.number(),
  }),
  execute: async () => {
    const response = await fetch(`${API_BASE_URL}/kyc/summary`);
    const data = (await response.json()) as SummaryResponse;
    return data.summary;
  },
});
