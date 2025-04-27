# KYC Verifier Frontend

A modern, responsive user interface for the KYC Verifier system, providing comprehensive tools for KYC document management and compliance analysis.

## Overview

The KYC Verifier Frontend is a React-based web application that serves as the user interface for the KYC Verifier system. It provides compliance officers and financial institutions with a powerful dashboard to manage, visualize, and analyze KYC (Know Your Customer) data processed by the backend system.

## Features

- **Interactive Dashboard**: Data visualization and key metrics overview
- **Document Management**: Upload, categorize, and manage KYC documents
- **Client Management**: Organize and track client information and status
- **Company Profiles**: Detailed views of company information, directors, and shareholders
- **Compliance Analytics**: Visual reports and insights into KYC compliance status
- **Responsive Design**: Fully responsive interface that works on desktop and mobile devices

## Technology Stack

- **Framework**: React 19 with TypeScript
- **Routing**: React Router v7
- **State Management**: React Query for server state
- **UI Components**: Radix UI primitives with Tailwind CSS
- **Data Visualization**: Recharts
- **Build Tool**: Vite
- **API Communication**: Axios

## Folder Structure

```
src/
├── assets/           # Static assets like images and icons
├── components/       # Reusable UI components
│   ├── layout/       # Layout components like sidebar, header, etc.
│   └── ui/           # UI primitive components and form elements
├── hooks/            # Custom React hooks
├── lib/              # Utility functions and shared code
├── pages/            # Page components for each route
│   ├── dashboard.tsx
│   ├── documents.tsx
│   ├── clients.tsx
│   ├── client-companies.tsx
│   ├── company-details.tsx
│   └── analytics.tsx
├── queries/          # React Query definitions for API requests
└── main.tsx          # Application entry point
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- NPM or Yarn
- KYC Verifier Backend running

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.example` to `.env` (if not present)
   - Configure the backend API URL: `VITE_API_URL=http://localhost:3000`

### Development

Run the development server:

```
npm run dev
```

This will start the application in development mode at `http://localhost:5173`.

### Building for Production

```
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Usage

1. **Dashboard**: View overall KYC metrics and pending tasks
2. **Documents**: Upload and manage KYC documents
3. **Clients**: View and manage client profiles
4. **Company Details**: Access detailed company information, including directors and shareholders
5. **Analytics**: Generate reports and visualize compliance data

## Integration with Backend

The frontend communicates with the KYC Verifier backend API using React Query for efficient data fetching and caching. All API requests are defined in the `queries/` directory, making it easy to maintain and update API integration points.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Contact

For questions or support, please create an issue in this repository or email at agarvit1142000@gmail.com
