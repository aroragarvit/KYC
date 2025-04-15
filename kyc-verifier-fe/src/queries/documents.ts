import { useQuery } from '@tanstack/react-query';

export interface Document {
  id: number;
  name: string;
  file_path?: string;
  company_id?: number;
  company_name?: string;
}


// Base API URL - adjust this to match your environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useDocuments() {
  return useQuery<{ documents: Document[] }>({
    queryKey: ['documents'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/documents`);
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      return response.json();
    },
  });
}

export function useCompanies() {
  return useQuery<{ companies: { id: number; name: string }[] }>({
    queryKey: ['companies'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/companies`);
      if (!response.ok) {
        throw new Error('Failed to fetch companies');
      }
      return response.json();
    },
  });
}

export function useCompanyDocuments(companyName: string) {
  return useQuery<{ company: { id: number; name: string }, documents: Document[] }>({
    queryKey: ['company-documents', companyName],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/companies/${companyName}/documents`);
      if (!response.ok) {
        throw new Error('Failed to fetch company documents');
      }
      return response.json();
    },
    enabled: !!companyName,
  });
}

export function useDocumentById(id: number) {
  return useQuery<{ document: Document }>({
    queryKey: ['document', id],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/documents/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      return response.json();
    },
    enabled: !!id,
  });
}   

export function useDocumentContent(id: number) {
  return useQuery<{ document: Document, content: string }>({
    queryKey: ['document-content', id],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/documents/read?id=${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch document content');
      }
      return response.json();
    },
    enabled: !!id,
  });
} 