import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCompanies } from "@/queries/companies";
import { useDocuments } from "@/queries/documents";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Analytics() {
  const { data: companiesData, isLoading: isLoadingCompanies } = useCompanies();
  const { data: documentsData, isLoading: isLoadingDocuments } = useDocuments();

  const companies = companiesData?.companies || [];
  const documents = documentsData?.documents || [];

  // Calculate document distribution by company
  const documentsByCompany = documents.reduce((acc, doc) => {
    if (doc.company_name) {
      acc[doc.company_name] = (acc[doc.company_name] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Calculate companies with the most documents
  const companiesWithMostDocs = Object.entries(documentsByCompany)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Get most recent documents (for this demo, we'll just take the first few)
  const recentDocuments = [...documents].slice(0, 5);

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            <motion.div
              className="flex justify-between"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-2xl font-semibold">Analytics</h1>
            </motion.div>
            
            <motion.div
              className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {/* Companies card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Companies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoadingCompanies ? "Loading..." : companies.length}
                  </div>
                </CardContent>
              </Card>

              {/* Documents card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoadingDocuments ? "Loading..." : documents.length}
                  </div>
                </CardContent>
              </Card>

              {/* Average documents per company */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Avg. Documents per Company
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoadingDocuments || isLoadingCompanies || companies.length === 0
                      ? "N/A"
                      : (documents.length / companies.length).toFixed(1)}
                  </div>
                </CardContent>
              </Card>
              
              {/* Companies with documents */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Companies with Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoadingDocuments ? "Loading..." : Object.keys(documentsByCompany).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {companies.length > 0 
                      ? `${Math.round((Object.keys(documentsByCompany).length / companies.length) * 100)}% of all companies`
                      : ""}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Documents by company and Recent Documents */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Documents by company */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Companies with Most Documents</CardTitle>
                    <CardDescription>Top 5 companies by document count</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingDocuments ? (
                      <div className="flex h-full items-center justify-center">
                        Loading...
                      </div>
                    ) : companiesWithMostDocs.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        No data available
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Company</TableHead>
                            <TableHead className="text-right">Documents</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companiesWithMostDocs.map(([company, count]) => (
                            <TableRow key={company}>
                              <TableCell className="font-medium">{company}</TableCell>
                              <TableCell className="text-right">{count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Documents */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Recent Documents</CardTitle>
                    <CardDescription>Latest documents in the system</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingDocuments ? (
                      <div className="flex h-full items-center justify-center">
                        Loading...
                      </div>
                    ) : recentDocuments.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        No data available
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Document Name</TableHead>
                            <TableHead>Company</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentDocuments.map((doc) => (
                            <TableRow key={doc.id}>
                              <TableCell className="font-medium">{doc.name}</TableCell>
                              <TableCell>{doc.company_name || "N/A"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* All Documents by Company */}
            <motion.div
              className="grid grid-cols-1 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>All Documents by Company</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingDocuments ? (
                    <div className="flex h-[300px] items-center justify-center">
                      Loading...
                    </div>
                  ) : Object.keys(documentsByCompany).length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center">
                      No data available
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead className="text-right">Documents</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(documentsByCompany)
                          .sort((a, b) => b[1] - a[1])
                          .map(([company, count]) => (
                            <TableRow key={company}>
                              <TableCell className="font-medium">{company}</TableCell>
                              <TableCell className="text-right">{count}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
