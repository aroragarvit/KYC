import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Type definitions
export interface Company {
  id: number;
  name: string;
  kycStatus?: string;
}

export interface Document {
  id: number;
  name: string;
  file_path?: string;
}

export interface Director {
  id: number;
  company_id: number;
  full_name: string;
  id_number: string;
  id_type: string;
  nationality: string;
  residential_address: string;
  telephone_number: string;
  email_address: string;
  discrepancies?: string;
  // Sources and values fields are stored as JSON strings
  full_name_source?: string;
  id_number_source?: string;
  id_type_source?: string;
  nationality_source?: string;
  residential_address_source?: string;
  telephone_number_source?: string;
  email_address_source?: string;
  // Values fields
  full_name_values?: string;
  id_number_values?: string;
  id_type_values?: string;
  nationality_values?: string;
  residential_address_values?: string;
  telephone_number_values?: string;
  email_address_values?: string;
}

// Base API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Fetch company by ID
export const useCompanyById = (id: number | null) => {
  return useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/companies/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch company details');
      }
      return response.json() as Promise<{ company: Company }>;
    },
    enabled: !!id, // Only run query if id is provided
  });
};

// Fetch company documents
export const useCompanyDocuments = (companyId: number | null) => {
  return useQuery({
    queryKey: ['company-documents', companyId],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/companies/${companyId}/documents`);
      if (!response.ok) {
        throw new Error('Failed to fetch company documents');
      }
      return response.json() as Promise<{ company: Company; documents: Document[] }>;
    },
    enabled: !!companyId,
  });
};

// Fetch company directors
export const useCompanyDirectors = (companyId: number | null) => {
  return useQuery({
    queryKey: ['company-directors', companyId],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/companies/${companyId}/directors`);
      if (!response.ok) {
        throw new Error('Failed to fetch company directors');
      }
      return response.json() as Promise<{ company: Company; directors: Director[] }>;
    },
    enabled: !!companyId,
  });
};

// Helper function to download document
export const getDocumentDownloadUrl = (filePath: string, filename: string) => {
  return `${API_URL}/download?path=${encodeURIComponent(filePath)}&filename=${encodeURIComponent(filename)}`;
};

// Update company KYC status
export const useUpdateCompanyKycStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      companyId, 
      kycStatus 
    }: { 
      companyId: number; 
      kycStatus: string 
    }) => {
      const response = await fetch(`${API_URL}/companies/${companyId}/kyc-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kycStatus }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update company KYC status');
      }
      
      return response.json() as Promise<{ 
        message: string; 
        company: Company 
      }>;
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['company', variables.companyId] });
    },
  });
};

// Save director information
export const useSaveDirector = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      companyId, 
      directorData 
    }: { 
      companyId: number; 
      directorData: Partial<Director> 
    }) => {
      const response = await fetch(`${API_URL}/companies/${companyId}/directors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(directorData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save director information');
      }
      
      return response.json() as Promise<{ 
        message: string; 
        director: Director 
      }>;
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['company-directors', variables.companyId] });
    },
  });
};
