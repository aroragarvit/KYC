import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SidebarInset } from '@/components/ui/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SiteHeader } from '@/components/layout/site-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Users, Download, Send, MessageSquare, User, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { KycChat } from '@/components/layout/kyc-chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// API URL from Vite environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Company interface
interface Company {
  id: number;
  client_id?: number;
  company_name: string;
  registration_number: {
    [key: string]: {
      documentId: number;
      documentName: string;
      documentType: string;
      value: string;
    }
  };
  jurisdiction: {
    [key: string]: {
      documentId: number;
      documentName: string;
      documentType: string;
      value: string;
    }
  };
  address: {
    [key: string]: {
      documentId: number;
      documentName: string;
      documentType: string;
      value: string;
    }
  };
  directors?: string[];
  shareholders?: string[];
  company_activities?: {
    [key: string]: {
      documentId: number;
      documentName: string;
      documentType: string;
      value: string[];
    }
  };
  shares_issued?: {
    [key: string]: {
      documentId: number;
      documentName: string;
      documentType: string;
      value: string;
    }
  };
  price_per_share?: {
    [key: string]: {
      documentId: number;
      documentName: string;
      documentType: string;
      value: string;
    }
  };
  kyc_status?: string | null;
  discrepancies?: any[];
}

// Director interface
interface Director {
  id: number;
  client_id?: number;
  company_name?: string;
  director_name?: string;
  id_number?: string | null;
  id_number_source?: string | null;
  id_type?: string | null;
  id_type_source?: string | null;
  nationality?: string | null;
  nationality_source?: string | null;
  residential_address?: string | null;
  residential_address_source?: string | null;
  tel_number?: string | null;
  tel_number_source?: string | null;
  email_address?: string | null;
  email_address_source?: string | null;
  verification_status?: string | null;
  kyc_status?: string | null;
}

// Shareholder interface
interface Shareholder {
  id: number;
  client_id?: number;
  company_name?: string;
  shareholder_name?: string;
  shares_owned?: string;
  shares_owned_source?: string;
  price_per_share?: string | null;
  price_per_share_source?: string;
  id_number?: string | null;
  id_number_source?: string;
  id_type?: string | null;
  id_type_source?: string;
  nationality?: string | null;
  nationality_source?: string;
  address?: string | null;
  address_source?: string;
  tel_number?: string | null;
  tel_number_source?: string;
  email_address?: string | null;
  email_address_source?: string;
  verification_status?: string | null;
  kyc_status?: string | null;
  is_company?: number;
}

// Document interface
interface Document {
  id: number;
  file_name: string;
  file_type?: string;
  document_category?: string;
  uploaded_at?: string;
  file_path?: string;
}

// Helper function to parse source fields that might be JSON strings
function parseSourceField(field: any, defaultValue: string = '{}') {
  try {
    if (typeof field === 'string') {
      return field.trim() ? JSON.parse(field) : JSON.parse(defaultValue);
    }
    return field || JSON.parse(defaultValue);
  } catch (e) {
    console.error('Error parsing JSON field:', e);
    return JSON.parse(defaultValue);
  }
}

// Helper function to get a document source value from a field with structure like registration_number
function getDocumentValue(fieldData: any, defaultValue: string = 'Not provided'): string {
  if (!fieldData || typeof fieldData !== 'object') return defaultValue;
  
  // Get the first key's data
  const firstKey = Object.keys(fieldData)[0];
  if (!firstKey) return defaultValue;
  
  return fieldData[firstKey]?.value || defaultValue;
}

// Helper function to get a document source from a field
function getDocumentSource(fieldData: any): { documentName: string; documentType: string } | null {
  if (!fieldData || typeof fieldData !== 'object') return null;
  
  // Get the first key's data
  const firstKey = Object.keys(fieldData)[0];
  if (!firstKey) return null;
  
  const source = fieldData[firstKey];
  if (!source) return null;
  
  return {
    documentName: source.documentName || '',
    documentType: source.documentType || ''
  };
}

// Helper function to extract missing information from KYC status
function extractMissingInfo(kycStatus: string | null | undefined) {
  if (!kycStatus) return [];
  
  const missingItems = [];
  
  // Look for common phrases indicating missing information
  if (kycStatus.includes("Missing Telephone Number") || 
      kycStatus.includes("missing telephone number")) {
    missingItems.push("telephone number");
  }
  
  if (kycStatus.includes("Missing Email Address") || 
      kycStatus.includes("missing email address")) {
    missingItems.push("email address");
  }
  
  if (kycStatus.includes("identification document") || 
      kycStatus.includes("identity document") || 
      kycStatus.includes("Missing ID")) {
    missingItems.push("identification document");
  }
  
  if (kycStatus.includes("address verification") || 
      kycStatus.includes("proof of address") || 
      kycStatus.includes("Missing address")) {
    missingItems.push("address verification document");
  }
  
  return missingItems;
}

// Helper function to extract document source information for directors
function getDirectorDocumentSource(sourceString: string | null | undefined) {
  if (!sourceString) return null;
  
  try {
    const parsed = JSON.parse(sourceString);
    return {
      documentId: parsed.documentId,
      documentName: parsed.documentName,
      documentType: parsed.documentType,
      source: parsed.source
    };
  } catch (e) {
    console.error('Error parsing document source:', e);
    return null;
  }
}

export default function CompanyDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const companyId = id ? parseInt(id, 10) : null;
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch company data
  const {
    data: companyData,
    isLoading: isCompanyLoading,
    error: companyError,
  } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_URL}/kyc/companies/${companyId}`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();

        // Process the company data to ensure proper parsing of nested JSON
        const company = data.company || data;
        
        // No need to parse fields - they are already structured objects
        const parsedCompany: Company = {
          id: company.id,
          client_id: company.client_id,
          company_name: company.company_name,
          registration_number: company.registration_number || {},
          jurisdiction: company.jurisdiction || {},
          address: company.address || {},
          directors: company.directors || [],
          shareholders: company.shareholders || [],
          company_activities: company.company_activities || {},
          shares_issued: company.shares_issued || {},
          price_per_share: company.price_per_share || {},
          kyc_status: company.kyc_status || null,
          discrepancies: company.discrepancies || [],
        };
        
        return parsedCompany;
      } catch (error) {
        console.error('Error fetching company data:', error);
        throw error;
      }
    },
    enabled: !!companyId,
  });

  // Fetch company directors
  const {
    data: directorsData,
    isLoading: isDirectorsLoading,
    error: directorsError,
  } = useQuery({
    queryKey: ['company-directors', companyId],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_URL}/kyc/companies/id/${companyId}/directors`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();

        // Ensure directors is always an array and properly parsed
        const directors = Array.isArray(data.directors)
          ? data.directors
          : typeof data.directors === 'string' && data.directors.trim()
            ? JSON.parse(data.directors)
            : [];

        return { directors };
      } catch (error) {
        console.error('Error fetching directors:', error);
        throw error;
      }
    },
    enabled: !!companyId,
  });

  // Fetch company shareholders
  const {
    data: shareholdersData,
    isLoading: isShareholdersLoading,
    error: shareholdersError,
  } = useQuery({
    queryKey: ['company-shareholders', companyId],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_URL}/kyc/companies/id/${companyId}/shareholders`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();

        // Ensure shareholders is always an array and properly parsed
        const shareholders = Array.isArray(data.shareholders)
          ? data.shareholders
          : typeof data.shareholders === 'string' && data.shareholders.trim()
            ? JSON.parse(data.shareholders)
            : [];

        return { shareholders };
      } catch (error) {
        console.error('Error fetching shareholders:', error);
        throw error;
      }
    },
    enabled: !!companyId,
  });

  // Fetch company documents
  const {
    data: documentsData,
    isLoading: isDocumentsLoading,
    error: documentsError,
  } = useQuery({
    queryKey: ['company-documents', companyId],
    queryFn: async () => {
      try {
        // Updated to use client_id as a query parameter
        const response = await fetch(`${API_URL}/kyc/documents?client_id=${companyId}`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }
    },
    enabled: !!companyId,
  });

  // Helper function for badge variant
  const getBadgeVariant = (status: string | null): 'default' | 'secondary' | 'destructive' => {
    if (!status) return 'default';
    switch (status.toLowerCase()) {
      case 'verified':
      case 'approved':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'not_verified':
      case 'rejected':
        return 'destructive';
      default:
        return 'default';
    }
  };

  // Handle document download
  const handleDownloadDocument = (filePath: string, fileName: string) => {
    // In a real implementation, this would trigger a download
    console.log(`Downloading document: ${fileName} from ${filePath}`);
  };

  // Go back function
  const goBack = () => {
    navigate('/client-companies');
  };

  if (isCompanyLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading company details...</p>
      </div>
    );
  }

  if (companyError) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive">Error loading company details</p>
        <p>{(companyError as Error).message}</p>
        <Button
          onClick={goBack}
          className="mt-4"
        >
          Return to Companies
        </Button>
      </div>
    );
  }

  if (!companyData) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p>No company found with the specified ID.</p>
        <Button
          onClick={goBack}
          className="mt-4"
        >
          Return to Companies
        </Button>
      </div>
    );
  }

  // Extract data from query results
  const company = companyData;
  const directors = directorsData?.directors || [];
  const shareholders = shareholdersData?.shareholders || [];
  const documents = documentsData?.documents || [];

  return (
    <SidebarProvider>
      <SidebarInset className="bg-background">
        <div className="h-full flex flex-col">
          <SiteHeader />
          <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-2xl font-bold tracking-tight">Company: {company.company_name}</h2>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Tabs
                defaultValue="overview"
                value={activeTab}
                onValueChange={setActiveTab}
              >
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="directors">Directors</TabsTrigger>
                  <TabsTrigger value="shareholders">Shareholders</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                </TabsList>

                <TabsContent
                  value="overview"
                  className="space-y-4"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>Company Details</CardTitle>
                      <CardDescription>Basic information about the company</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Identification</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Name</div>
                            <div className="mt-1">{company.company_name}</div>
                          </div>

                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Registration Number</div>
                            <div className="mt-1">{getDocumentValue(company.registration_number)}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Source: {getDocumentSource(company.registration_number)?.documentName || 'Unknown'}
                              {getDocumentSource(company.registration_number)?.documentType ? 
                                ` (${getDocumentSource(company.registration_number)?.documentType})` : ''}
                            </div>
                          </div>

                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Jurisdiction</div>
                            <div className="mt-1">{getDocumentValue(company.jurisdiction)}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Source: {getDocumentSource(company.jurisdiction)?.documentName || 'Unknown'}
                              {getDocumentSource(company.jurisdiction)?.documentType ? 
                                ` (${getDocumentSource(company.jurisdiction)?.documentType})` : ''}
                            </div>
                          </div>

                          <div>
                            <div className="text-sm font-medium text-muted-foreground">KYC Status</div>
                            <div className="mt-1">
                              <Badge variant={getBadgeVariant(company.kyc_status)}>
                                {company.kyc_status || 'Unknown'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-2">Address</h3>
                        <div className="mt-1">{getDocumentValue(company.address)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Source: {getDocumentSource(company.address)?.documentName || 'Unknown'}
                          {getDocumentSource(company.address)?.documentType ? 
                            ` (${getDocumentSource(company.address)?.documentType})` : ''}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-2">Company Activities</h3>
                        {company.company_activities && Object.keys(company.company_activities).length > 0 ? (
                          <div>
                            <ul className="list-disc pl-5 space-y-1">
                              {company.company_activities[Object.keys(company.company_activities)[0]]?.value?.map((activity, i) => (
                                <li key={i} className="text-sm">{activity}</li>
                              ))}
                            </ul>
                            <div className="text-xs text-muted-foreground mt-1">
                              Source: {getDocumentSource(company.company_activities)?.documentName || 'Unknown'}
                              {getDocumentSource(company.company_activities)?.documentType ? 
                                ` (${getDocumentSource(company.company_activities)?.documentType})` : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No activities provided</div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-2">Share Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Shares Issued</div>
                            <div className="mt-1">{getDocumentValue(company.shares_issued)}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Source: {getDocumentSource(company.shares_issued)?.documentName || 'Unknown'}
                              {getDocumentSource(company.shares_issued)?.documentType ? 
                                ` (${getDocumentSource(company.shares_issued)?.documentType})` : ''}
                            </div>
                          </div>

                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Price Per Share</div>
                            <div className="mt-1">{getDocumentValue(company.price_per_share)}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Source: {getDocumentSource(company.price_per_share)?.documentName || 'Unknown'}
                              {getDocumentSource(company.price_per_share)?.documentType ? 
                                ` (${getDocumentSource(company.price_per_share)?.documentType})` : ''}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-2">Ownership</h3>
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-1">Directors</div>
                            {company.directors && company.directors.length > 0 ? (
                              <ul className="list-disc pl-5 space-y-1">
                                {company.directors.map((director, i) => (
                                  <li key={i} className="text-sm">{director}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-sm text-muted-foreground">No directors provided</div>
                            )}
                          </div>

                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-1">Shareholders</div>
                            {company.shareholders && company.shareholders.length > 0 ? (
                              <ul className="list-disc pl-5 space-y-1">
                                {company.shareholders.map((shareholder, i) => (
                                  <li key={i} className="text-sm">{shareholder}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-sm text-muted-foreground">No shareholders provided</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {company.discrepancies && company.discrepancies.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold mb-2 text-destructive">Discrepancies</h3>
                          <div className="space-y-2">
                            {company.discrepancies.map((disc: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-3 bg-destructive/10 rounded-md"
                              >
                                <div className="font-medium">{disc.field || 'Unknown field'}</div>
                                <div className="text-sm">{disc.description || 'No description provided'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent
                  value="directors"
                  className="space-y-4"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>Directors</CardTitle>
                      <CardDescription>People who direct the company's affairs</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isDirectorsLoading ? (
                        <div className="text-center p-4">Loading directors...</div>
                      ) : directorsError ? (
                        <div className="text-center p-4 text-destructive">
                          Error loading directors: {(directorsError as Error).message}
                        </div>
                      ) : directors.length === 0 ? (
                        <div className="text-center p-4">No directors found for this company.</div>
                      ) : (
                        <div className="space-y-6">
                          {directors.map((director: Director, idx: number) => {
                            const idNumberSource = getDirectorDocumentSource(director.id_number_source);
                            const idTypeSource = getDirectorDocumentSource(director.id_type_source);
                            const nationalitySource = getDirectorDocumentSource(director.nationality_source);
                            const addressSource = getDirectorDocumentSource(director.residential_address_source);
                            const telSource = getDirectorDocumentSource(director.tel_number_source);
                            const emailSource = getDirectorDocumentSource(director.email_address_source);
                            
                            // Safely handle kyc_status to avoid type errors
                            let directorKycStatus: string | null = null;
                            if (typeof director.kyc_status === 'string') {
                              directorKycStatus = director.kyc_status;
                            }
                            const missingItems = extractMissingInfo(directorKycStatus);
                            
                            return (
                              <div
                                key={idx}
                                className="bg-background/95 dark:bg-background rounded-lg p-8 border border-border/50"
                              >
                                <div className="flex justify-between items-center mb-6">
                                  <h3 className="text-xl font-semibold">
                                    {director.director_name}
                                  </h3>
                                  <Badge 
                                    variant={getBadgeVariant(director.verification_status || "pending")}
                                    className="text-xs px-3 py-1 font-medium"
                                  >
                                    {director.verification_status || "pending"}
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">ID Number</div>
                                    <div className="mt-1">{director.id_number || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {idNumberSource && idNumberSource.documentName && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {idNumberSource.documentName}
                                          {idNumberSource.documentType ? ` (${idNumberSource.documentType})` : ''}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">ID Type</div>
                                    <div className="mt-1">{director.id_type || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {idTypeSource && idTypeSource.documentName && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {idTypeSource.documentName}
                                          {idTypeSource.documentType ? ` (${idTypeSource.documentType})` : ''}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">Nationality</div>
                                    <div className="mt-1">{director.nationality || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {nationalitySource && nationalitySource.documentName && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {nationalitySource.documentName}
                                          {nationalitySource.documentType ? ` (${nationalitySource.documentType})` : ''}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">Email</div>
                                    <div className="mt-1">{director.email_address || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {emailSource && emailSource.documentName ? (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {emailSource.documentName}
                                          {emailSource.documentType ? ` (${emailSource.documentType})` : ''}
                                        </Badge>
                                      ) : emailSource && emailSource.source === "No source" ? (
                                        <span className="text-xs text-muted-foreground ml-2">No source</span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="col-span-1 md:col-span-2">
                                    <div className="text-sm font-medium text-muted-foreground">Address</div>
                                    <div className="mt-1">{director.residential_address || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {addressSource && addressSource.documentName && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {addressSource.documentName}
                                          {addressSource.documentType ? ` (${addressSource.documentType})` : ''}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">Phone</div>
                                    <div className="mt-1">{director.tel_number || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {telSource && telSource.documentName ? (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {telSource.documentName}
                                          {telSource.documentType ? ` (${telSource.documentType})` : ''}
                                        </Badge>
                                      ) : telSource && telSource.source === "No source" ? (
                                        <span className="text-xs text-muted-foreground ml-2">No source</span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                {director.kyc_status && (
                                  <div className="mt-6">
                                    <div className="flex items-center gap-2 mb-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                      </svg>
                                      <h4 className="font-medium">KYC Status Information</h4>
                                    </div>
                                    <div className="p-4 bg-muted/50 rounded-md text-sm">
                                      <ReactMarkdown 
                                        components={{
                                          p: ({ node, ...props }) => (
                                            <p className="text-muted-foreground mb-4" {...props} />
                                          ),
                                          h2: ({ node, ...props }) => (
                                            <h2 className="text-base font-bold my-3" {...props} />
                                          ),
                                          h3: ({ node, ...props }) => (
                                            <h3 className="text-sm font-bold my-2" {...props} />
                                          ),
                                          ul: ({ node, ...props }) => (
                                            <ul className="list-disc pl-5 my-2" {...props} />
                                          ),
                                          li: ({ node, ...props }) => (
                                            <li className="text-muted-foreground mb-1" {...props} />
                                          ),
                                          strong: ({ node, ...props }) => (
                                            <strong className="font-bold" {...props} />
                                          )
                                        }}
                                        remarkPlugins={[remarkGfm]}
                                      >
                                        {director.kyc_status}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                )}

                                {(missingItems.length > 0 || !director.tel_number || !director.email_address) && (
                                  <div className="mt-6">
                                    <div className="flex items-center gap-2 text-destructive mb-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                      </svg>
                                      <h4 className="font-medium">Missing Required Information</h4>
                                    </div>
                                    <div className="p-4 bg-destructive/5 rounded-md text-sm">
                                      <div className="text-destructive/90">The following required fields or documents are missing:</div>
                                      <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                                        {!director.tel_number && <li>telephone number</li>}
                                        {!director.email_address && <li>email address</li>}
                                        {missingItems.filter(item => 
                                          item !== "telephone number" && 
                                          item !== "email address"
                                        ).map((item, idx) => (
                                          <li key={idx}>{item}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent
                  value="shareholders"
                  className="space-y-4"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>Shareholders</CardTitle>
                      <CardDescription>Entities that own shares in the company</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isShareholdersLoading ? (
                        <div className="text-center p-4">Loading shareholders...</div>
                      ) : shareholdersError ? (
                        <div className="text-center p-4 text-destructive">
                          Error loading shareholders: {(shareholdersError as Error).message}
                        </div>
                      ) : shareholders.length === 0 ? (
                        <div className="text-center p-4">No shareholders found for this company.</div>
                      ) : (
                        <div className="space-y-6">
                          {shareholders.map((shareholder: Shareholder, idx: number) => {
                            const idNumberSource = getDirectorDocumentSource(shareholder.id_number_source);
                            const idTypeSource = getDirectorDocumentSource(shareholder.id_type_source);
                            const nationalitySource = getDirectorDocumentSource(shareholder.nationality_source);
                            const addressSource = getDirectorDocumentSource(shareholder.address_source);
                            const telSource = getDirectorDocumentSource(shareholder.tel_number_source);
                            const emailSource = getDirectorDocumentSource(shareholder.email_address_source);
                            const sharesOwnedSource = getDirectorDocumentSource(shareholder.shares_owned_source);
                            const ppsSource = getDirectorDocumentSource(shareholder.price_per_share_source);
                            
                            // Safely handle kyc_status to avoid type errors
                            let shareholderKycStatus: string | null = null;
                            if (typeof shareholder.kyc_status === 'string') {
                              shareholderKycStatus = shareholder.kyc_status;
                            }
                            const missingItems = extractMissingInfo(shareholderKycStatus);
                            
                            return (
                              <div
                                key={idx}
                                className="bg-background/95 dark:bg-background rounded-lg p-8 border border-border/50"
                              >
                                <div className="flex justify-between items-center mb-6">
                                  <h3 className="text-xl font-semibold">
                                    {shareholder.shareholder_name}
                                  </h3>
                                  <Badge 
                                    variant={getBadgeVariant(shareholder.verification_status || "pending")}
                                    className="text-xs px-3 py-1 font-medium"
                                  >
                                    {shareholder.verification_status || "pending"}
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">Ownership</div>
                                    <div className="mt-1">{shareholder.shares_owned || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {sharesOwnedSource && sharesOwnedSource.source ? (
                                        <span className="text-xs text-muted-foreground ml-2">{sharesOwnedSource.source}</span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">Price Per Share</div>
                                    <div className="mt-1">{shareholder.price_per_share || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {ppsSource && ppsSource.source ? (
                                        <span className="text-xs text-muted-foreground ml-2">{ppsSource.source}</span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">ID Number</div>
                                    <div className="mt-1">{shareholder.id_number || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {idNumberSource && idNumberSource.documentName && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {idNumberSource.documentName}
                                          {idNumberSource.documentType ? ` (${idNumberSource.documentType})` : ''}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">ID Type</div>
                                    <div className="mt-1">{shareholder.id_type || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {idTypeSource && idTypeSource.documentName && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {idTypeSource.documentName}
                                          {idTypeSource.documentType ? ` (${idTypeSource.documentType})` : ''}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">Nationality</div>
                                    <div className="mt-1">{shareholder.nationality || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {nationalitySource && nationalitySource.documentName && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {nationalitySource.documentName}
                                          {nationalitySource.documentType ? ` (${nationalitySource.documentType})` : ''}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">Email</div>
                                    <div className="mt-1">{shareholder.email_address || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {emailSource && emailSource.documentName ? (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {emailSource.documentName}
                                          {emailSource.documentType ? ` (${emailSource.documentType})` : ''}
                                        </Badge>
                                      ) : emailSource && emailSource.source ? (
                                        <span className="text-xs text-muted-foreground ml-2">{emailSource.source}</span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="col-span-1 md:col-span-2">
                                    <div className="text-sm font-medium text-muted-foreground">Address</div>
                                    <div className="mt-1">{shareholder.address || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {addressSource && addressSource.documentName && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {addressSource.documentName}
                                          {addressSource.documentType ? ` (${addressSource.documentType})` : ''}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">Phone</div>
                                    <div className="mt-1">{shareholder.tel_number || 'Not provided'}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Document Sources:
                                      {telSource && telSource.documentName ? (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {telSource.documentName}
                                          {telSource.documentType ? ` (${telSource.documentType})` : ''}
                                        </Badge>
                                      ) : telSource && telSource.source ? (
                                        <span className="text-xs text-muted-foreground ml-2">{telSource.source}</span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                {shareholder.kyc_status && (
                                  <div className="mt-6">
                                    <div className="flex items-center gap-2 mb-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                      </svg>
                                      <h4 className="font-medium">KYC Status Information</h4>
                                    </div>
                                    <div className="p-4 bg-muted/50 rounded-md text-sm">
                                      <ReactMarkdown 
                                        components={{
                                          p: ({ node, ...props }) => (
                                            <p className="text-muted-foreground mb-4" {...props} />
                                          ),
                                          h2: ({ node, ...props }) => (
                                            <h2 className="text-base font-bold my-3" {...props} />
                                          ),
                                          h3: ({ node, ...props }) => (
                                            <h3 className="text-sm font-bold my-2" {...props} />
                                          ),
                                          ul: ({ node, ...props }) => (
                                            <ul className="list-disc pl-5 my-2" {...props} />
                                          ),
                                          li: ({ node, ...props }) => (
                                            <li className="text-muted-foreground mb-1" {...props} />
                                          ),
                                          strong: ({ node, ...props }) => (
                                            <strong className="font-bold" {...props} />
                                          )
                                        }}
                                        remarkPlugins={[remarkGfm]}
                                      >
                                        {shareholder.kyc_status}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                )}

                                {(missingItems.length > 0 || !shareholder.tel_number || !shareholder.email_address) && (
                                  <div className="mt-6">
                                    <div className="flex items-center gap-2 text-destructive mb-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                      </svg>
                                      <h4 className="font-medium">Missing Required Information</h4>
                                    </div>
                                    <div className="p-4 bg-destructive/5 rounded-md text-sm">
                                      <div className="text-destructive/90">The following required fields or documents are missing:</div>
                                      <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                                        {!shareholder.tel_number && <li>telephone number</li>}
                                        {!shareholder.email_address && <li>email address</li>}
                                        {missingItems.filter(item => 
                                          item !== "telephone number" && 
                                          item !== "email address"
                                        ).map((item, idx) => (
                                          <li key={idx}>{item}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent
                  value="documents"
                  className="space-y-4"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>Documents</CardTitle>
                      <CardDescription>Files associated with this company</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isDocumentsLoading ? (
                        <div className="text-center p-4">Loading documents...</div>
                      ) : documentsError ? (
                        <div className="text-center p-4 text-destructive">
                          Error loading documents: {(documentsError as Error).message}
                        </div>
                      ) : !documents || documents.length === 0 ? (
                        <div className="text-center p-4">No documents found for this company.</div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>File Name</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Upload Date</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {documents.map((doc: Document) => (
                              <TableRow key={doc.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center">
                                    <FileText className="h-4 w-4 mr-2" />
                                    {doc.file_name}
                                  </div>
                                </TableCell>
                                <TableCell>{doc.file_type || 'Unknown'}</TableCell>
                                <TableCell>
                                  {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'Unknown'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadDocument(doc.file_path || '', doc.file_name)}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent
                  value="chat"
                  className="space-y-4"
                >
              <Card>
    <CardHeader>
      <CardTitle className="flex items-center">
        <MessageSquare className="h-5 w-5 mr-2" />
        KYC Assistant Chat
      </CardTitle>
      <CardDescription>Chat with our KYC assistant about this company</CardDescription>
    </CardHeader>
    <CardContent>
      {/* Replace the dummy chat UI with the functional KycChat component */}
      <KycChat clientId={"1"} />
    </CardContent>
  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
