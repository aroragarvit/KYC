import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";

import { kycDocumentWorkflow } from "./workflows/kyc_document_workflow";
import { kycAgent } from "./agents/kyc";

export const mastra = new Mastra({
  workflows: {
    kycDocumentWorkflow,
  },
  agents: { kycAgent },
});
