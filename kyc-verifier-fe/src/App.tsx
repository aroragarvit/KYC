import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import OrganisationsPage from "./pages/organisations";
import OrganisationDetailsPage from "./pages/organisation-details";
import DocumentsPage from "./pages/documents";
import Navigation from "./components/Navigation";

function App() {
  return (
    <Router>
      <div className="flex min-h-screen">
        <Navigation />
        <main className="flex-1 p-4">
          <Routes>
            <Route path="/" element={<OrganisationsPage />} />
            <Route
              path="/organisations/:organisationName"
              element={<OrganisationDetailsPage />}
            />
            <Route
              path="/organisations/:organisationName/documents"
              element={<DocumentsPage />}
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 