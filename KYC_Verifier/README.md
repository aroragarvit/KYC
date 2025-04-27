# KYC Verifier

A robust AI-powered Know Your Customer (KYC) verification system leveraging document analysis to automate compliance workflows.

## Overview

KYC Verifier is an intelligent agent-based application that processes and analyzes identity documents, company records, and other compliance-related materials to extract structured information for KYC compliance purposes. Built on the Mastra framework, it automates document classification, information extraction, and discrepancy detection.

## Features

- **Intelligent Document Classification**: Automatically identifies document types (passports, incorporation certificates, proof of address, etc.)
- **Information Extraction**: Parses documents to extract names, ID numbers, addresses, corporate structures, and more
- **Entity Mapping**: Builds relationships between individuals and companies (directors, shareholders)
- **Discrepancy Detection**: Identifies and highlights inconsistencies across multiple documents
- **Compliance Status Analysis**: Evaluates KYC completion status and suggests missing requirements
- **Data Querying API**: Provides structured access to KYC information through various tools

## Technology Stack

- **Framework**: Mastra for workflow and agent orchestration
- **Language**: TypeScript/Node.js
- **AI Models**: Google's Gemini 1.5 Pro
- **Data Storage**: Local database with memory persistence

## Getting Started

### Prerequisites

- Node.js (v18+)
- NPM or Yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables:
   - create `.env.development`
   - Add necessary API keys and configuration

### Running the Application

```
npm run dev
```

## Architecture

The system is built around three main components:

1. **Agents**:
   - Document Classification Agent: Identifies document types
   - KYC Analysis Agent: Extracts structured information from documents
   - KYC Status Analysis Agent: Evaluates compliance status
   - kyc Agent: General purpose agent that uses tools to query the database and update the database based on user chat 
2. **Workflows**:
   - KYC Document Workflow: Orchestrates the document processing pipeline

3. **Tools**:
   - Query interfaces for retrieving processed KYC information

## Usage

The system can be used by:

1. Triggering the workflow with a client ID
   NOTE: The workflow is triggered by a client ID. The client ID is a unique identifier for the client. And it can take 5-10 minutes to process this because of rate limits on the API.
   
2. Querying the processed data through the KYC Agent


## Contact

For questions or support, please create an issue in this repository or email me at agarvit1142000@gmail.com
