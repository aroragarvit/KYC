import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { motion } from "motion/react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

// API URL for real implementation
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Client interface with KYC status
interface Client {
  id: number;
  name: string;
  kycStatus?: "Pending" | "Approved" | "Rejected";
}

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch clients from the KYC API
  const { data, isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_URL}/kyc/clients`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        
        // Map the response to match our Client interface
        return {
          clients: data.clients.map((client: any) => ({
            id: client.id,
            name: client.name,
            // We could fetch KYC status for each client here or add it to the API
            kycStatus: "Pending"
          }))
        };
      } catch (error) {
        console.error('Failed to fetch clients:', error);
        throw error;
      }
    }
  });

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!data?.clients) return [];
    
    return data.clients.filter((client: Client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  // Handle view details - navigates to the client's companies page
  const handleViewDetails = (clientId: number) => {
    window.location.href = `/client-companies/${clientId}`;
  };
  
  // Status badge component
  const StatusBadge = ({ status }: { status: Client["kycStatus"] }) => {
    if (!status) return null;
    
    const variantMap: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      Pending: "secondary",
      Approved: "default",
      Rejected: "destructive",
    };
    
    return <Badge variant={variantMap[status] || "outline"}>{status}</Badge>;
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
              <h1 className="text-2xl font-semibold">Clients</h1>
              <div className="w-full md:w-auto flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients..."
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
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
                  <p>Loading clients...</p>
                </div>
              ) : error ? (
                <div className="flex justify-center items-center h-64 text-destructive">
                  <p>Error: {(error as Error).message}</p>
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
                    {filteredClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No clients found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredClients.map((client: Client) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.id}</TableCell>
                          <TableCell>{client.name}</TableCell>
                          <TableCell>
                            <StatusBadge status={client.kycStatus} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(client.id)}
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
