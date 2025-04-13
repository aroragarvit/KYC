
import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow } from './workflows';
import { weatherAgent, documentAnalysisAgent, verificationAgent } from './agents';
import { directorExtractionWorkflow } from './workflows/director_extraction';
import { directorVerificationWorkflow } from './workflows/director_verification';
export const mastra = new Mastra({
  workflows: { weatherWorkflow, directorVerificationWorkflow, directorExtractionWorkflow },
  agents: { weatherAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
