import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Import pages
import OrganizationsPage from "./pages/organizations";
import ClientsPage from "./pages/clients";
import ClientCompaniesPage from "./pages/client-companies";
import CompanyDetailsPage from "./pages/company-details";

// These pages will be implemented later if needed
const OrganisationDetailsPage = () => <div>Organization Details</div>;
const DocumentsPage = () => <div>Documents</div>;

function App() {
  return (
    <Router>
      <Routes>
        {/* Home route */}
        <Route path="/" element={<OrganizationsPage />} />
        
        {/* Client routes */}
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/client-companies/:id" element={<ClientCompaniesPage />} />
        <Route path="/company-details/:id" element={<CompanyDetailsPage />} />
        
        {/* Organization routes */}
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/organization/:id" element={<OrganisationDetailsPage />} />
        
        {/* Document routes */}
        <Route path="/documents" element={<DocumentsPage />} />
      </Routes>
    </Router>
  );
}

export default App; 