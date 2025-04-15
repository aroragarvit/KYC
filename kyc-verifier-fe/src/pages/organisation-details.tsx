import { useState } from 'react';
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
import { Search, ArrowLeft, FileText, Users, Download, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Base API URL from Vite environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
                <TabsList className="grid w-full grid-cols-2">
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
                      ) : directorsData?.directors?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Users className="h-12 w-12 text-muted-foreground mb-2" />
                          <p className="text-lg font-medium">No directors found</p>
                          <p className="text-sm text-muted-foreground">
                            No director information has been extracted or added yet.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {directorsData?.directors.map((director) => (
                            <div
                              key={director.id}
                              className="rounded-lg border p-4"
                            >
                              <h3 className="text-lg font-semibold">{director.full_name}</h3>
                              <Separator className="my-2" />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <div>
                                  <p className="text-sm text-muted-foreground">ID Number</p>
                                  <p>{director.id_number || 'Not provided'}</p>
                                  {director.id_number_source && (
                                    <p className="text-xs italic text-muted-foreground mt-1">
                                      Source: {director.id_number_source}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">ID Type</p>
                                  <p>{director.id_type || 'Not provided'}</p>
                                  {director.id_type_source && (
                                    <p className="text-xs italic text-muted-foreground mt-1">
                                      Source: {director.id_type_source}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Nationality</p>
                                  <p>{director.nationality || 'Not provided'}</p>
                                  {director.nationality_source && (
                                    <p className="text-xs italic text-muted-foreground mt-1">
                                      Source: {director.nationality_source}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Email</p>
                                  <p>{director.email_address || 'Not provided'}</p>
                                  {director.email_address_source && (
                                    <p className="text-xs italic text-muted-foreground mt-1">
                                      Source: {director.email_address_source}
                                    </p>
                                  )}
                                </div>
                                <div className="md:col-span-2">
                                  <p className="text-sm text-muted-foreground">Address</p>
                                  <p>{director.residential_address || 'Not provided'}</p>
                                  {director.residential_address_source && (
                                    <p className="text-xs italic text-muted-foreground mt-1">
                                      Source: {director.residential_address_source}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Phone</p>
                                  <p>{director.telephone_number || 'Not provided'}</p>
                                  {director.telephone_number_source && (
                                    <p className="text-xs italic text-muted-foreground mt-1">
                                      Source: {director.telephone_number_source}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {director.discrepancies && director.discrepancies.trim() !== '' && (
                                <div className="mt-4">
                                  <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Discrepancies Found</AlertTitle>
                                    <AlertDescription>{director.discrepancies}</AlertDescription>
                                  </Alert>
                                </div>
                              )}
                            </div>
                          ))}
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
