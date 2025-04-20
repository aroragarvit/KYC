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
import { ArrowLeft, FileText, Users, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useQuery } from "@tanstack/react-query";

// API URL from Vite environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Company interface
interface Company {
  id: number;
  name: string;
  company_name?: string;
  registration_number: any;
  jurisdiction: any;
  address: any;
  directors?: any[];
  shareholders?: any[];
  kyc_status?: string | null;
  discrepancies?: any[];
}

// Director interface
interface Director {
  id: number;
  director_name?: string;
  full_name?: string;
  id_number?: string | null;
  id_type?: string | null;
  nationality?: string | null;
  residential_address?: string | null;
  telephone_number?: string | null;
  email_address?: string | null;
  discrepancies?: string | null;
  verification_Status?: string | null;
  KYC_Status?: string | null;
  // Source fields
  full_name_source?: string | null;
  id_number_source?: string | null;
  id_type_source?: string | null;
  nationality_source?: string | null;
  residential_address_source?: string | null;
  telephone_number_source?: string | null;
  email_address_source?: string | null;
}

// Shareholder interface
interface Shareholder {
  id: number;
  company_id?: number;
  shareholder_type?: 'Individual' | 'Corporate';
  full_name?: string | null;
  company_name?: string | null;
  id_number?: string | null;
  id_type?: string | null;
  nationality?: string | null;
  residential_address?: string | null;
  registered_address?: string | null;
  registration_number?: string | null;
  telephone_number?: string | null;
  email_address?: string | null;
  number_of_shares?: number | null;
  price_per_share?: number | null;
  percentage_ownership?: number | null;
  discrepancies?: string | null;
  verification_Status?: string | null;
  // Source fields
  full_name_source?: string | null;
  id_number_source?: string | null;
  id_type_source?: string | null;
  nationality_source?: string | null;
  residential_address_source?: string | null;
  registered_address_source?: string | null;
  registration_number_source?: string | null;
  telephone_number_source?: string | null;
  email_address_source?: string | null;
  number_of_shares_source?: string | null;
  price_per_share_source?: string | null;
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

export default function CompanyDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const companyId = id ? parseInt(id, 10) : null;
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch company data
  const { data: companyData, isLoading: isCompanyLoading, error: companyError } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_URL}/kyc/companies/${companyId}`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        
        // Process the company data to ensure proper parsing of nested JSON
        // The backend returns fields like registration_number, jurisdiction, address, directors, shareholders, discrepancies as JSON strings.
        // Also, the company name is under company_name, not name.
        const company = data.company || data;
        const parsedCompany = {
          id: company.id,
          name: company.company_name || company.name || '',
          registration_number: parseSourceField(company.registration_number),
          jurisdiction: parseSourceField(company.jurisdiction),
          address: parseSourceField(company.address),
          directors: Array.isArray(company.directors)
            ? company.directors
            : (typeof company.directors === 'string' && company.directors.trim() ? JSON.parse(company.directors) : []),
          shareholders: Array.isArray(company.shareholders)
            ? company.shareholders
            : (typeof company.shareholders === 'string' && company.shareholders.trim() ? JSON.parse(company.shareholders) : []),
          kyc_status: company.kyc_status || null,
          discrepancies: parseSourceField(company.discrepancies, '[]'),
        };
        return parsedCompany;
      } catch (error) {
        console.error('Error fetching company data:', error);
        throw error;
      }
    },
    enabled: !!companyId
  });

  // Fetch company directors
  const { data: directorsData, isLoading: isDirectorsLoading, error: directorsError } = useQuery({
    queryKey: ['company-directors', companyId],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_URL}/kyc/companies/${companyId}/directors`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        
        // Ensure directors is always an array and properly parsed
        const directors = Array.isArray(data.directors) 
          ? data.directors 
          : (typeof data.directors === 'string' && data.directors.trim() ? JSON.parse(data.directors) : []);
          
        return { directors };
      } catch (error) {
        console.error('Error fetching directors:', error);
        throw error;
      }
    },
    enabled: !!companyId,
  });

  // Fetch company shareholders
  const { data: shareholdersData, isLoading: isShareholdersLoading, error: shareholdersError } = useQuery({
    queryKey: ['company-shareholders', companyId],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_URL}/kyc/companies/${companyId}/shareholders`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        
        // Ensure shareholders is always an array and properly parsed
        const shareholders = Array.isArray(data.shareholders) 
          ? data.shareholders 
          : (typeof data.shareholders === 'string' && data.shareholders.trim() ? JSON.parse(data.shareholders) : []);
          
        return { shareholders };
      } catch (error) {
        console.error('Error fetching shareholders:', error);
        throw error;
      }
    },
    enabled: !!companyId,
  });

  // Fetch company documents
  const { data: documentsData, isLoading: isDocumentsLoading, error: documentsError } = useQuery({
    queryKey: ['company-documents', companyId],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_URL}/kyc/companies/${companyId}/documents`);
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
  const getBadgeVariant = (status: string | null): "default" | "secondary" | "destructive" => {
    if (!status) return "default";
    switch (status.toLowerCase()) {
      case 'verified':
      case 'approved':
        return "default";
      case 'pending':
        return "secondary";
      case 'not_verified':
      case 'rejected':
        return "destructive";
      default:
        return "default";
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
        <Button onClick={goBack} className="mt-4">
          Return to Companies
        </Button>
      </div>
    );
  }

  if (!companyData) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p>No company found with the specified ID.</p>
        <Button onClick={goBack} className="mt-4">
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
              <h2 className="text-2xl font-bold tracking-tight">
                Company: {company.name}
              </h2>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="directors">Directors</TabsTrigger>
                  <TabsTrigger value="shareholders">Shareholders</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Company Details</CardTitle>
                      <CardDescription>
                        Basic information about the company
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Identification</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Name</div>
                            <div className="mt-1">{company.name}</div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Registration Number</div>
                            <div className="mt-1">{company.registration_number?.value || 'Not provided'}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Source: {company.registration_number?.source || 'Unknown'}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Jurisdiction</div>
                            <div className="mt-1">{company.jurisdiction?.value || 'Not provided'}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Source: {company.jurisdiction?.source || 'Unknown'}
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
                        <div className="mt-1">{company.address?.value || 'Not provided'}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Source: {company.address?.source || 'Unknown'}
                        </div>
                      </div>
                      
                      {company.discrepancies && company.discrepancies.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold mb-2 text-destructive">Discrepancies</h3>
                          <div className="space-y-2">
                            {company.discrepancies.map((disc: any, idx: number) => (
                              <div key={idx} className="p-3 bg-destructive/10 rounded-md">
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

                <TabsContent value="directors" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Directors</CardTitle>
                      <CardDescription>
                        People who direct the company's affairs
                      </CardDescription>
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
                          {directors.map((director: Director, idx: number) => (
                            <div key={idx} className="border rounded-lg p-4">
                              <h3 className="text-lg font-semibold mb-2">
                                {director.full_name}
                                {director.verification_Status && (
                                  <Badge 
                                    variant={getBadgeVariant(director.verification_Status)}
                                    className="ml-2"
                                  >
                                    {director.verification_Status}
                                  </Badge>
                                )}
                              </h3>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-3">
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-1">ID Information</h4>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="font-medium">Number:</span> {director.id_number || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {director.id_number_source || 'Unknown'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium">Type:</span> {director.id_type || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {director.id_type_source || 'Unknown'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium">Nationality:</span> {director.nationality || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {director.nationality_source || 'Unknown'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Address</h4>
                                  <div>
                                    {director.residential_address || 'Not provided'}
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Source: {director.residential_address_source || 'Unknown'}
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Contact Information</h4>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="font-medium">Phone:</span> {director.telephone_number || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {director.telephone_number_source || 'Unknown'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium">Email:</span> {director.email_address || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {director.email_address_source || 'Unknown'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="shareholders" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Shareholders</CardTitle>
                      <CardDescription>
                        Entities that own shares in the company
                      </CardDescription>
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
                          {shareholders.map((shareholder: Shareholder, idx: number) => (
                            <div key={idx} className="border rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <h3 className="text-lg font-semibold mb-2">
                                  {shareholder.full_name || shareholder.company_name}
                                  {shareholder.verification_Status && (
                                    <Badge 
                                      variant={getBadgeVariant(shareholder.verification_Status)}
                                      className="ml-2"
                                    >
                                      {shareholder.verification_Status}
                                    </Badge>
                                  )}
                                </h3>
                                <Badge>
                                  {shareholder.shareholder_type === 'Corporate' ? 'Company' : 'Individual'}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-3">
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Ownership Information</h4>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="font-medium">Shares Owned:</span> {shareholder.number_of_shares || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {shareholder.number_of_shares_source || 'Unknown'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium">Price Per Share:</span> {shareholder.price_per_share || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {shareholder.price_per_share_source || 'Unknown'}
                                      </div>
                                    </div>
                                    {shareholder.percentage_ownership && (
                                      <div>
                                        <span className="font-medium">Ownership Percentage:</span> {shareholder.percentage_ownership}%
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-1">ID Information</h4>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="font-medium">Number:</span> {shareholder.id_number || shareholder.registration_number || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {shareholder.id_number_source || shareholder.registration_number_source || 'Unknown'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium">Type:</span> {shareholder.id_type || (shareholder.company_name ? 'UEN' : 'Unknown') || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {shareholder.id_type_source || 'Unknown'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium">Nationality:</span> {shareholder.nationality || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {shareholder.nationality_source || 'Unknown'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Contact Information</h4>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="font-medium">Address:</span> {shareholder.residential_address || shareholder.registered_address || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {shareholder.residential_address_source || shareholder.registered_address_source || 'Unknown'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium">Phone:</span> {shareholder.telephone_number || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {shareholder.telephone_number_source || 'Unknown'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium">Email:</span> {shareholder.email_address || 'Not provided'}
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Source: {shareholder.email_address_source || 'Unknown'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Documents</CardTitle>
                      <CardDescription>
                        Files associated with this company
                      </CardDescription>
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
              </Tabs>
            </motion.div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
