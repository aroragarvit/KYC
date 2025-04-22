import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { weatherWorkflow } from "./workflows";
import {
  weatherAgent,
  documentAnalysisAgent,
  verificationAgent,
} from "./agents";
import { directorExtractionWorkflow } from "./workflows/director_extraction";
import { directorVerificationWorkflow } from "./workflows/director_verification";
import { shareholderExtractionWorkflow } from "./workflows/shareholder_extraction";
import { shareholderVerificationWorkflow } from "./workflows/shareholder_verification";
import { kycDocumentWorkflow } from "./workflows/kyc_document_workflow";
import { kycAgent } from "./agents/kyc";

export const mastra = new Mastra({
  workflows: {
    weatherWorkflow,
    directorVerificationWorkflow,
    directorExtractionWorkflow,
    shareholderExtractionWorkflow,
    shareholderVerificationWorkflow,
    kycDocumentWorkflow,
  },
  agents: { weatherAgent, kycAgent },
});
