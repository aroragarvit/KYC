import { useQuery } from '@tanstack/react-query';

// Type definition for company
export interface Company {
  id: number;
  name: string;
}

// Base API URL - adjust this to match your environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Function to fetch companies
export const fetchCompanies = async (): Promise<{ companies: Company[] }> => {
  const response = await fetch(`${API_URL}/companies`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch companies');
  }
  
  return response.json();
};

// React query hook for companies
export const useCompanies = () => {
  return useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  });
};
