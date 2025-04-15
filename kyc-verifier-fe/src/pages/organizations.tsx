import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { motion } from "motion/react";
import { useCompanies, Company } from "@/queries/companies";
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
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

// Extend the Company type to include KYC status
interface CompanyWithKYC extends Company {
  kycStatus: "Pending" | "Approved" | "Rejected";
}

export default function Organizations() {
  const { data, isLoading, error } = useCompanies();
  const [searchTerm, setSearchTerm] = useState("");

  // Enhance companies with KYC status (default: Pending)
  const companiesWithKYC = useMemo(() => {
    if (!data?.companies) return [];
    return data.companies.map((company) => ({
      ...company,
      kycStatus: "Pending" as const,
    }));
  }, [data]);

  // Filter companies based on search term
  const filteredCompanies = useMemo(() => {
    return companiesWithKYC.filter((company) =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [companiesWithKYC, searchTerm]);

  // Handle view details
  const handleViewDetails = (companyId: number) => {
    // Using window.location for navigation instead of react-router-dom
    window.location.href = `/organization/${companyId}`;
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: CompanyWithKYC["kycStatus"] }) => {
    const variantMap: Record<CompanyWithKYC["kycStatus"], "default" | "destructive" | "outline" | "secondary"> = {
      Pending: "secondary",
      Approved: "default",
      Rejected: "destructive",
    };
    
    return <Badge variant={variantMap[status]}>{status}</Badge>;
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
              <h1 className="text-2xl font-semibold">Organizations</h1>
              <div className="w-full md:w-auto flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search organizations..."
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
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
                  <p>Loading organizations...</p>
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
                      <TableHead>Name</TableHead>
                      <TableHead>KYC Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No organizations found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCompanies.map((company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">{company.id}</TableCell>
                          <TableCell>{company.name}</TableCell>
                          <TableCell>
                            <StatusBadge status={company.kycStatus} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(company.id)}
                            >
                              View Details
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
