import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { motion } from "motion/react";
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { Search, ArrowLeft } from "lucide-react";

// API URL for real implementation
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Company interface with KYC status
interface Company {
  id: number;
  client_id: number;
  company_name: string;
  kyc_status: "pending" | "approved" | "not_verified" | null;
  registration_number: any;
  jurisdiction: any;
  address: any;
  directors: string[];
  shareholders: string[];
  company_activities?: any;
  shares_issued?: any;
  price_per_share?: any;
  discrepancies: any[];
}

// Interface for the client
interface Client {
  id: number;
  name: string;
}

export default function ClientCompanies() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const clientId = id ? parseInt(id, 10) : null;
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch client data - using mock data for now
  const client: Client = useMemo(() => ({
    id: clientId || 1,
    name: "Truffles"
  }), [clientId]);

  // Fetch companies from KYC API
  const { data, isLoading, error } = useQuery({
    queryKey: ['client-companies', clientId],
    queryFn: async () => {
      try {
        // Fetch companies for the specific client using client_id query parameter
        const response = await fetch(`${API_URL}/kyc/companies?client_id=${clientId}`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        
        // The backend now returns properly structured data
        return data;
      } catch (error) {
        console.error('Failed to fetch companies:', error);
        throw error;
      }
    },
    enabled: !!clientId,
  });

  // Filter companies based on search term
  const filteredCompanies = useMemo(() => {
    if (!data?.companies) return [];
    return data.companies.filter((company: Company) => 
      (company.company_name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  // Handle view details
  const handleViewDetails = (companyId: number) => {
    window.location.href = `/company-details/${companyId}`;
  };

  // Go back to clients page
  const goBack = () => {
    navigate('/clients');
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: Company["kyc_status"] }) => {
    const variantMap: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      pending: "secondary",
      approved: "default",
      not_verified: "destructive",
    };
    
    const statusText = status || "Unknown";
    const variant = variantMap[statusText] || "outline";
    
    return <Badge variant={variant}>{statusText.replace('_', ' ')}</Badge>;
  };

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            <motion.div
              className="flex flex-col gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-fit flex items-center gap-1 mb-2"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Clients
              </Button>
              <h1 className="text-2xl font-semibold">Client: {client.name}</h1>
            </motion.div>

            <motion.div
              className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <h2 className="text-xl">Companies</h2>
              <div className="w-full md:w-auto flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search companies..."
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
                    <SelectItem value="not_verified">Not Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>

            <motion.div
              className="rounded-lg border bg-card text-card-foreground shadow-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <p>Loading companies...</p>
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
                          No companies found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCompanies.map((company: Company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">{company.id}</TableCell>
                          <TableCell>{company.company_name}</TableCell>
                          <TableCell>
                            <StatusBadge status="pending" />
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
