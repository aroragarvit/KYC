import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SiteHeader } from '@/components/layout/site-header';
import { useCompanyById, useCompanyDocuments, useCompanyDirectors } from '@/queries/organization';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowLeft, FileText, Users, Download, AlertCircle, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery } from "@tanstack/react-query";

// Base API URL from Vite environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Extend the Director type to include our new fields
interface DocumentSource {
  documentId: number;
  documentName: string;
  value: string;
  documentCategory?: string;
}

interface Discrepancy {
  field: string;
  values: string[];
  explanation?: string;
}

interface KycStatus {
  status: string;
  missing_fields?: string[];
  discrepancies?: Discrepancy[];
  fields?: string[];
}

interface Director {
  id: number;
  full_name: string | null;
  id_number: string | null;
  id_type: string | null;
  nationality: string | null;
  residential_address: string | null;
  telephone_number: string | null;
  email_address: string | null;
  discrepancies: string | null;
  verification_Status: string | null;
  KYC_Status: string | null;
  full_name_source: string | null;
  id_number_source: string | null;
  id_type_source: string | null;
  nationality_source: string | null;
  residential_address_source: string | null;
  telephone_number_source: string | null;
  email_address_source: string | null;
}

// Add type definition for Shareholder
interface Shareholder {
  id: number;
  company_id: number;
  shareholder_type: 'Individual' | 'Corporate';
  origin: string;
  full_name: string | null;
  id_number: string | null;
  id_type: string | null;
  nationality: string | null;
  residential_address: string | null;
  company_name: string | null;
  registration_number: string | null;
  registered_address: string | null;
  signatory_name: string | null;
  signatory_email: string | null;
  telephone_number: string | null;
  email_address: string | null;
  number_of_shares: number | null;
  price_per_share: number | null;
  percentage_ownership: number | null;
  beneficial_owners: string | null;
  discrepancies: string | null;
  verification_Status: string | null;
  KYC_Status: string | null;
  full_name_source: string | null;
  company_name_source: string | null;
  registration_number_source: string | null;
  id_number_source: string | null;
  nationality_source: string | null;
  residential_address_source: string | null;
  registered_address_source: string | null;
  telephone_number_source: string | null;
  email_address_source: string | null;
  number_of_shares_source: string | null;
  price_per_share_source: string | null;
}

export default function OrganizationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const companyId = id ? parseInt(id, 10) : null;
  const [searchTerm, setSearchTerm] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('all');

  // Fetch company data
  const { data: companyData, isLoading: isCompanyLoading, error: companyError } = useCompanyById(companyId);

  // Fetch company documents
  const { data: documentsData, isLoading: isDocumentsLoading, error: documentsError } = useCompanyDocuments(companyId);

  // Fetch company directors
  const { data: directorsData, isLoading: isDirectorsLoading, error: directorsError } = useCompanyDirectors(companyId);

  // Type assertion for directors
  const directors = directorsData?.directors as Director[] | undefined;

  // Filter documents based on search term and type
  const filteredDocuments = documentsData?.documents
    ? documentsData.documents.filter((doc) => doc.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // Handle document download
  const handleDownloadDocument = (filePath: string, fileName: string) => {
    if (filePath) {
      const downloadUrl = `${API_URL}/download?path=${encodeURIComponent(filePath)}&filename=${encodeURIComponent(fileName)}`;
      window.open(downloadUrl, '_blank');
    }
  };

  // Handle view document
  const handleViewDocument = (documentId: number) => {
    navigate(`/document/${documentId}`);
  };

  // Parse document source JSON
  const parseSources = (sourceStr: string | null): DocumentSource[] => {
    try {
      return sourceStr ? JSON.parse(sourceStr) : [];
    } catch (e) {
      return [];
    }
  };

  // Helper function to get document category badge style
  const getDocumentCategoryBadge = (category?: string): "default" | "secondary" | "outline" | "destructive" => {
    if (!category) return "secondary";
    
    category = category.toLowerCase();
    
    if (category.includes('identification') || category.includes('passport') || category.includes('nric') || category.includes('fin')) {
      return "default";
    } else if (category.includes('address') || category.includes('bill')) {
      return "outline";
    } else if (category.includes('registry') || category.includes('appointment')) {
      return "secondary";
    }
    
    return "secondary";
  };

  // Update the hook for company shareholders to fetch from API
  const useCompanyShareholders = (companyId) => {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Function to refetch data
    const refetch = useCallback(async () => {
      if (!companyId) {
        setData({ shareholders: [] });
        return;
      }
      
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/companies/${companyId}/shareholders`);
        if (!response.ok) {
          throw new Error('Failed to fetch shareholders');
        }
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }, [companyId]);

    // Fetch data on component mount or when companyId changes
    useEffect(() => {
      refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch };
  };

  // Fetch company shareholders
  const { data: shareholdersData, isLoading: isShareholdersLoading, error: shareholdersError } = useCompanyShareholders(companyId);

  // Type assertion for shareholders
  const shareholders = shareholdersData?.shareholders as Shareholder[] | undefined;

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/organizations')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-semibold">
                {isCompanyLoading ? 'Loading...' : companyData?.company?.name || 'Organization Details'}
              </h1>
              {!isCompanyLoading && companyData?.company?.kycStatus && (
                <Badge
                  variant={
                    companyData.company.kycStatus === 'approved'
                      ? 'default'
                      : companyData.company.kycStatus === 'rejected'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {companyData.company.kycStatus}
                </Badge>
              )}
            </motion.div>

            {(companyError || documentsError || directorsError) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {companyError?.message || documentsError?.message || directorsError?.message}
                </AlertDescription>
              </Alert>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Tabs
                defaultValue="documents"
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger
                    value="documents"
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Documents
                  </TabsTrigger>
                  <TabsTrigger
                    value="directors"
                    className="flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Directors
                  </TabsTrigger>
                  <TabsTrigger
                    value="shareholders"
                    className="flex items-center gap-2"
                  >
                    <Briefcase className="h-4 w-4" />
                    Shareholders
                  </TabsTrigger>
                </TabsList>

                {/* Documents Tab Content */}
                <TabsContent value="documents">
                  <Card>
                    <CardHeader>
                      <CardTitle>Organization Documents</CardTitle>
                      <CardDescription>View and manage documents for this organization</CardDescription>
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-2">
                        <div className="relative w-full md:w-72">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search documents..."
                            className="pl-8 w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <Select
                          value={docTypeFilter}
                          onValueChange={setDocTypeFilter}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Documents</SelectItem>
                            <SelectItem value="identification">Identification</SelectItem>
                            <SelectItem value="registration">Registration</SelectItem>
                            <SelectItem value="address">Address Proof</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isDocumentsLoading ? (
                        <div className="flex justify-center items-center h-64">
                          <p>Loading documents...</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Document Name</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredDocuments.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={2}
                                  className="h-24 text-center"
                                >
                                  No documents found.
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredDocuments.map((document) => (
                                <TableRow key={document.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <FileText size={16} />
                                      {document.name}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewDocument(document.id)}
                                      >
                                        View
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.file_path ? handleDownloadDocument(document.file_path, document.name) : null}
                                      >
                                        <Download
                                          size={16}
                                          className="mr-1"
                                        />
                                        Download
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Directors Tab Content */}
                <TabsContent value="directors">
                  <Card>
                    <CardHeader>
                      <CardTitle>Directors Information</CardTitle>
                      <CardDescription>Directors and key personnel associated with this organization</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isDirectorsLoading ? (
                        <div className="flex justify-center items-center h-64">
                          <p>Loading directors...</p>
                        </div>
                      ) : directors?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Users className="h-12 w-12 text-muted-foreground mb-2" />
                          <p className="text-lg font-medium">No directors found</p>
                          <p className="text-sm text-muted-foreground">
                            No director information has been extracted or added yet.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {directors?.map((director: Director) => {
                            // Parse JSON strings to objects
                            const idNumberSources = parseSources(director.id_number_source);
                            const addressSources = parseSources(director.residential_address_source);
                            const nameSources = parseSources(director.full_name_source);
                            const nationalitySources = parseSources(director.nationality_source);
                            const phoneSources = parseSources(director.telephone_number_source);
                            const emailSources = parseSources(director.email_address_source);
                            
                            // Parse discrepancies
                            let discrepanciesObj: Discrepancy[] = [];
                            try {
                              if (director.discrepancies) {
                                discrepanciesObj = JSON.parse(director.discrepancies);
                              }
                            } catch (e) {
                              console.error("Error parsing discrepancies", e);
                            }
                            
                            // Parse KYC Status
                            let kycStatus: KycStatus | null = null;
                            try {
                              if (director.KYC_Status) {
                                kycStatus = JSON.parse(director.KYC_Status);
                              }
                            } catch (e) {
                              console.error("Error parsing KYC status", e);
                            }
                            
                            // Helper function for badge variant
                            const getBadgeVariant = (status: string | null): "default" | "secondary" | "destructive" => {
                              if (status === 'verified') return "default";
                              if (status === 'notverified') return "destructive";
                              return "secondary";
                            };
                            
                            return (
                              <div
                                key={director.id}
                                className="rounded-lg border p-4"
                              >
                                <div className="flex justify-between items-center">
                                  <h3 className="text-lg font-semibold">{director.full_name}</h3>
                                  <Badge 
                                    variant={getBadgeVariant(director.verification_Status)}
                                  >
                                    {director.verification_Status || 'pending'}
                                  </Badge>
                                </div>
                                <Separator className="my-2" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                  <div>
                                    <p className="text-sm text-muted-foreground">ID Number</p>
                                    <p>{director.id_number || 'Not provided'}</p>
                                    {idNumberSources?.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                        <p className="font-medium">Document Sources:</p>
                                        {idNumberSources.map((source: DocumentSource, idx: number) => (
                                          <div key={idx} className="ml-2">
                                            <span className="italic">{source.documentName}</span>
                                            <Badge className="ml-1" variant={getDocumentCategoryBadge(source.documentCategory)}>
                                              {source.documentCategory || 'Unknown Type'}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">ID Type</p>
                                    <p>{director.id_type || 'Not provided'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Nationality</p>
                                    <p>{director.nationality || 'Not provided'}</p>
                                    {nationalitySources?.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                        <p className="font-medium">Document Sources:</p>
                                        {nationalitySources.map((source: DocumentSource, idx: number) => (
                                          <div key={idx} className="ml-2">
                                            <span className="italic">{source.documentName}</span>
                                            <Badge className="ml-1" variant={getDocumentCategoryBadge(source.documentCategory)}>
                                              {source.documentCategory || 'Unknown Type'}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Email</p>
                                    <p>{director.email_address || 'Not provided'}</p>
                                    {emailSources?.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                        <p className="font-medium">Document Sources:</p>
                                        {emailSources.map((source: DocumentSource, idx: number) => (
                                          <div key={idx} className="ml-2">
                                            <span className="italic">{source.documentName}</span>
                                            <Badge className="ml-1" variant={getDocumentCategoryBadge(source.documentCategory)}>
                                              {source.documentCategory || 'Unknown Type'}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="md:col-span-2">
                                    <p className="text-sm text-muted-foreground">Address</p>
                                    <p>{director.residential_address || 'Not provided'}</p>
                                    {addressSources?.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                        <p className="font-medium">Document Sources:</p>
                                        {addressSources.map((source: DocumentSource, idx: number) => (
                                          <div key={idx} className="ml-2">
                                            <span className="italic">{source.documentName}</span>
                                            <Badge className="ml-1" variant={getDocumentCategoryBadge(source.documentCategory)}>
                                              {source.documentCategory || 'Unknown Type'}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Phone</p>
                                    <p>{director.telephone_number || 'Not provided'}</p>
                                    {phoneSources?.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                        <p className="font-medium">Document Sources:</p>
                                        {phoneSources.map((source: DocumentSource, idx: number) => (
                                          <div key={idx} className="ml-2">
                                            <span className="italic">{source.documentName}</span>
                                            <Badge className="ml-1" variant={getDocumentCategoryBadge(source.documentCategory)}>
                                              {source.documentCategory || 'Unknown Type'}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* KYC Status section */}
                                {kycStatus && (
                                  <div className="mt-4">
                                    {kycStatus.status === 'Discrepancies detected' && (
                                      <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Discrepancies Found</AlertTitle>
                                        <AlertDescription>
                                          <div className="mt-2">
                                            {kycStatus.discrepancies?.map((disc, idx) => (
                                              <div key={idx} className="mb-2">
                                                <p className="font-medium">Field: {disc.field}</p>
                                                <p>Values: {disc.values.join(', ')}</p>
                                                {disc.explanation && <p className="italic text-xs">{disc.explanation}</p>}
                                              </div>
                                            ))}
                                          </div>
                                        </AlertDescription>
                                      </Alert>
                                    )}
                                    
                                    {kycStatus.status === 'Required fields or documents missing' && (
                                      <Alert>
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Missing Required Information</AlertTitle>
                                        <AlertDescription>
                                          <div className="mt-2">
                                            <p>The following required fields or documents are missing:</p>
                                            <ul className="list-disc pl-5 mt-1">
                                              {kycStatus.missing_fields?.map((field, idx) => (
                                                <li key={idx}>{field.replace(/_/g, ' ')}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        </AlertDescription>
                                      </Alert>
                                    )}
                                  </div>
                                )}
                                
                                {/* Raw discrepancies section (if not parsed in KYC Status) */}
                                {discrepanciesObj.length > 0 && !kycStatus && (
                                  <div className="mt-4">
                                    <Alert>
                                      <AlertTitle>Data Variations</AlertTitle>
                                      <AlertDescription>
                                        <div className="mt-2">
                                          {discrepanciesObj.map((disc, idx) => (
                                            <div key={idx} className="mb-2">
                                              <p className="font-medium">{disc.field}:</p>
                                              <p>{disc.values.join(', ')}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </AlertDescription>
                                    </Alert>
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

                {/* Shareholders Tab Content */}
                <TabsContent value="shareholders">
                  <Card>
                    <CardHeader>
                      <CardTitle>Shareholders Information</CardTitle>
                      <CardDescription>Shareholders associated with this organization</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isShareholdersLoading ? (
                        <div className="flex justify-center items-center h-64">
                          <p>Loading shareholders...</p>
                        </div>
                      ) : shareholders?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Briefcase className="h-12 w-12 text-muted-foreground mb-2" />
                          <p className="text-lg font-medium">No shareholders found</p>
                          <p className="text-sm text-muted-foreground">
                            No shareholder information has been extracted or added yet.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {shareholders?.map((shareholder) => {
                            // Parse JSON strings to objects
                            const idNumberSources = parseSources(shareholder.id_number_source);
                            const addressSources = shareholder.shareholder_type === 'Individual' 
                              ? parseSources(shareholder.residential_address_source)
                              : parseSources(shareholder.registered_address_source);
                            const nameSources = shareholder.shareholder_type === 'Individual'
                              ? parseSources(shareholder.full_name_source)
                              : parseSources(shareholder.company_name_source);
                            const nationalitySources = parseSources(shareholder.nationality_source);
                            const phoneSources = parseSources(shareholder.telephone_number_source);
                            const emailSources = parseSources(shareholder.email_address_source);
                            const sharesSources = parseSources(shareholder.number_of_shares_source);
                            
                            // Parse beneficial owners for corporate shareholders
                            let beneficialOwners = [];
                            try {
                              if (shareholder.beneficial_owners) {
                                beneficialOwners = JSON.parse(shareholder.beneficial_owners);
                              }
                            } catch (e) {
                              console.error("Error parsing beneficial owners", e);
                            }
                            
                            // Parse discrepancies
                            let discrepanciesObj = [];
                            try {
                              if (shareholder.discrepancies) {
                                discrepanciesObj = JSON.parse(shareholder.discrepancies);
                              }
                            } catch (e) {
                              console.error("Error parsing discrepancies", e);
                            }
                            
                            // Parse KYC Status
                            let kycStatus = null;
                            try {
                              if (shareholder.KYC_Status) {
                                kycStatus = JSON.parse(shareholder.KYC_Status);
                              }
                            } catch (e) {
                              console.error("Error parsing KYC status", e);
                            }
                            
                            // Helper function for badge variant
                            const getBadgeVariant = (status) => {
                              if (status === 'verified') return "default";
                              if (status === 'notverified') return "destructive";
                              if (status === 'beneficial_ownership_incomplete') return "warning";
                              return "secondary";
                            };
                            
                            return (
                              <div
                                key={shareholder.id}
                                className="rounded-lg border p-4"
                              >
                                <div className="flex justify-between items-center">
                                  <h3 className="text-lg font-semibold">
                                    {shareholder.shareholder_type === 'Individual' 
                                      ? shareholder.full_name 
                                      : shareholder.company_name}
                                    <span className="ml-2 text-sm text-muted-foreground">
                                      ({shareholder.shareholder_type})
                                    </span>
                                  </h3>
                                  <Badge 
                                    variant={getBadgeVariant(shareholder.verification_Status)}
                                  >
                                    {shareholder.verification_Status || 'pending'}
                                  </Badge>
                                </div>
                                <Separator className="my-2" />
                                
                                {/* Render based on shareholder type */}
                                {shareholder.shareholder_type === 'Individual' ? (
                                  // Individual shareholder details
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div>
                                      <p className="text-sm text-muted-foreground">ID Number</p>
                                      <p>{shareholder.id_number || 'Not provided'}</p>
                                      {idNumberSources?.length > 0 && (
                                        <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                          <p className="font-medium">Document Sources:</p>
                                          {idNumberSources.map((source, idx) => (
                                            <div key={idx} className="ml-2">
                                              <span className="italic">{source.documentName}</span>
                                              <Badge className="ml-1" variant={getDocumentCategoryBadge(source.documentCategory)}>
                                                {source.documentCategory || 'Unknown Type'}
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">ID Type</p>
                                      <p>{shareholder.id_type || 'Not provided'}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Nationality</p>
                                      <p>{shareholder.nationality || 'Not provided'}</p>
                                      {nationalitySources?.length > 0 && (
                                        <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                          <p className="font-medium">Document Sources:</p>
                                          {nationalitySources.map((source, idx) => (
                                            <div key={idx} className="ml-2">
                                              <span className="italic">{source.documentName}</span>
                                              <Badge className="ml-1" variant={getDocumentCategoryBadge(source.documentCategory)}>
                                                {source.documentCategory || 'Unknown Type'}
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Email</p>
                                      <p>{shareholder.email_address || 'Not provided'}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                      <p className="text-sm text-muted-foreground">Residential Address</p>
                                      <p>{shareholder.residential_address || 'Not provided'}</p>
                                      {addressSources?.length > 0 && (
                                        <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                          <p className="font-medium">Document Sources:</p>
                                          {addressSources.map((source, idx) => (
                                            <div key={idx} className="ml-2">
                                              <span className="italic">{source.documentName}</span>
                                              <Badge className="ml-1" variant={getDocumentCategoryBadge(source.documentCategory)}>
                                                {source.documentCategory || 'Unknown Type'}
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  // Corporate shareholder details
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Registration Number</p>
                                      <p>{shareholder.registration_number || 'Not provided'}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Origin</p>
                                      <p>{shareholder.origin || 'Not provided'}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                      <p className="text-sm text-muted-foreground">Registered Address</p>
                                      <p>{shareholder.registered_address || 'Not provided'}</p>
                                      {addressSources?.length > 0 && (
                                        <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                          <p className="font-medium">Document Sources:</p>
                                          {addressSources.map((source, idx) => (
                                            <div key={idx} className="ml-2">
                                              <span className="italic">{source.documentName}</span>
                                              <Badge className="ml-1" variant={getDocumentCategoryBadge(source.documentCategory)}>
                                                {source.documentCategory || 'Unknown Type'}
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Signatory</p>
                                      <p>{shareholder.signatory_name || 'Not provided'}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Signatory Email</p>
                                      <p>{shareholder.signatory_email || 'Not provided'}</p>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Common shareholder details */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 border-t pt-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Shares</p>
                                    <p>{shareholder.number_of_shares?.toLocaleString() || 'Not provided'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Price per Share</p>
                                    <p>{shareholder.price_per_share ? `$${shareholder.price_per_share}` : 'Not provided'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Ownership Percentage</p>
                                    <p>{shareholder.percentage_ownership ? `${shareholder.percentage_ownership}%` : 'Not provided'}</p>
                                  </div>
                                </div>
                                
                                {/* Beneficial owners section for corporate shareholders */}
                                {shareholder.shareholder_type === 'Corporate' && beneficialOwners.length > 0 && (
                                  <div className="mt-4 border-t pt-4">
                                    <h4 className="font-medium mb-2">Beneficial Owners</h4>
                                    <div className="space-y-2">
                                      {beneficialOwners.map((owner, idx) => (
                                        <div key={idx} className="p-2 border rounded-md">
                                          <div className="flex justify-between items-center">
                                            <p>{owner.name}</p>
                                            <Badge variant={owner.requires_kyc ? "destructive" : "secondary"}>
                                              {owner.ownership_percentage}%
                                            </Badge>
                                          </div>
                                          {owner.indirect_path && (
                                            <p className="text-sm text-muted-foreground mt-1">{owner.indirect_path}</p>
                                          )}
                                          {owner.verification_status && (
                                            <Badge 
                                              variant={getBadgeVariant(owner.verification_status)}
                                              className="mt-1"
                                            >
                                              {owner.verification_status}
                                            </Badge>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* KYC Status section */}
                                {kycStatus && (
                                  <div className="mt-4">
                                    {kycStatus.status === 'Discrepancies detected' && (
                                      <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Discrepancies Found</AlertTitle>
                                        <AlertDescription>
                                          <div className="mt-2">
                                            {kycStatus.discrepancies?.map((disc, idx) => (
                                              <div key={idx} className="mb-2">
                                                <p className="font-medium">Field: {disc.field}</p>
                                                <p>Values: {disc.values.join(', ')}</p>
                                                {disc.explanation && <p className="italic text-xs">{disc.explanation}</p>}
                                              </div>
                                            ))}
                                          </div>
                                        </AlertDescription>
                                      </Alert>
                                    )}
                                    
                                    {kycStatus.status === 'Required fields or documents missing' && (
                                      <Alert>
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Missing Required Information</AlertTitle>
                                        <AlertDescription>
                                          <div className="mt-2">
                                            <p>The following required fields or documents are missing:</p>
                                            <ul className="list-disc pl-5 mt-1">
                                              {kycStatus.missing_fields?.map((field, idx) => (
                                                <li key={idx}>{field.replace(/_/g, ' ')}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        </AlertDescription>
                                      </Alert>
                                    )}
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
              </Tabs>
            </motion.div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
