import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { motion } from "motion/react";
import { useDocuments, useCompanies, Document } from "@/queries/documents";
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, Download } from "lucide-react";

// Base API URL from Vite environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Documents() {
  const { data, isLoading, error } = useDocuments();
  const { data: companiesData } = useCompanies();
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");

  // Get all documents with company information
  const documentsWithCompany = useMemo(() => {
    if (!data?.documents) return [];
    
    // Join documents with their companies (mock implementation as we don't have actual join data)
    return data.documents.map((document) => {
      // In a real implementation, this would come from the API
      // For now, we'll randomly assign companies if company information isn't available
      if (!document.company_id && companiesData?.companies?.length) {
        const randomCompanyIndex = Math.floor(Math.random() * companiesData.companies.length);
        const randomCompany = companiesData.companies[randomCompanyIndex];
        return {
          ...document,
          company_id: randomCompany.id,
          company_name: randomCompany.name,
        };
      }
      return document;
    });
  }, [data, companiesData]);

  // Filter documents based on search term and company
  const filteredDocuments = useMemo(() => {
    let filtered = documentsWithCompany.filter((document) =>
      document.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (companyFilter !== "all") {
      filtered = filtered.filter(
        (document) => document.company_name === companyFilter
      );
    }
    
    return filtered;
  }, [documentsWithCompany, searchTerm, companyFilter]);

  // Handle document download
  const handleDownloadDocument = (document: Document) => {
    // In a real implementation, this would make a request to download the file
    // For now, we'll just open a new window with the path (this won't work in production)
    if (document.file_path) {
      const filename = document.file_path.split('/').pop();
      const downloadUrl = `${API_URL}/download?path=${encodeURIComponent(document.file_path)}&filename=${encodeURIComponent(filename || document.name)}`;
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            <motion.div
              className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-2xl font-semibold">Documents</h1>
              <div className="w-full md:w-auto flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select
                  value={companyFilter}
                  onValueChange={(value) => setCompanyFilter(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {companiesData?.companies?.map((company) => (
                      <SelectItem key={company.id} value={company.name}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>

            <motion.div
              className="rounded-lg border bg-card text-card-foreground shadow-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <p>Loading documents...</p>
                </div>
              ) : error ? (
                <div className="flex justify-center items-center h-64">
                  <p className="text-destructive">Error: {(error as Error).message}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Document Name</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No documents found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDocuments.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell className="font-medium">{document.id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText size={16} />
                              {document.name}
                            </div>
                          </TableCell>
                          <TableCell>{document.company_name || "Unknown"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadDocument(document)}
                            >
                              <Download size={16} className="mr-1" />
                              Download
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </motion.div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}