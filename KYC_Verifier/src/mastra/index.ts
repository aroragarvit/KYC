import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow, kycVerificationWorkflow } from './workflows';
import { weatherAgent } from './agents';
import { documentAnalysisAgent, verificationAgent } from './agents';

export const mastra = new Mastra({
  workflows: { 
    weatherWorkflow, 
    kycVerificationWorkflow 
  },
  agents: { 
    weatherAgent, 
    documentAnalysisAgent, 
    verificationAgent 
  },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
