# S&Y Industries SMT Scheduling System

A full-stack web application for intelligent SMT line scheduling and manufacturing execution.

## Features

- 🔐 Role-based authentication (Admin, Scheduler, Viewer)
- 📅 Smart job scheduling across multiple SMT lines
- 🏭 Dynamic line management and status tracking
- 🕒 Configurable shift management
- 🤖 AI-powered schedule optimization
- 📊 Real-time scheduling dashboard with Gantt views
- 📥 Multiple job input methods (Manual, CSV/Excel, ERP Integration)
- 📈 Comprehensive reporting and analytics

## Tech Stack

- Frontend: React + TypeScript + TailwindCSS
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL
- Authentication: Clerk
- Deployment: Railway.app
- AI Integration: OpenAI API

## Project Structure

```
smt_schedule/
├── frontend/           # React frontend application
├── backend/           # Node.js + Express backend
├── database/          # Database migrations and schemas
└── docs/             # Additional documentation
```

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/smt_schedule.git
   cd smt_schedule
   ```

2. Install dependencies:
   ```bash
   # Install backend dependencies
   cd backend
   pnpm install

   # Install frontend dependencies
   cd ../frontend
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   # Backend
   cp backend/.env.example backend/.env

   # Frontend
   cp frontend/.env.example frontend/.env
   ```

4. Start development servers:
   ```bash
   # Start backend (from backend directory)
   pnpm dev

   # Start frontend (from frontend directory)
   pnpm dev
   ```

## Environment Variables

### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Backend server port (default: 3000)
- `JWT_SECRET`: Secret for JWT token generation
- `CETEC_API_URL`: Cetec ERP API URL
- `CETEC_API_TOKEN`: Cetec ERP API token
- `OPENAI_API_KEY`: OpenAI API key for scheduling optimization

### Frontend
- `VITE_API_URL`: Backend API URL
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk authentication publishable key

## License

Copyright © 2024 S&Y Industries. All rights reserved.

# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=smt_schedule

# Authentication (Clerk)
CLERK_SECRET_KEY=your_clerk_secret_key_here
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here

# OpenAI (for schedule optimization)
OPENAI_API_KEY=your_openai_api_key_here

# Cetec ERP Integration
CETEC_API_URL=https://sandy.cetecerp.com
CETEC_API_TOKEN=your_cetec_api_token_here

# JWT (for internal token signing)
JWT_SECRET=development_secret_key_change_in_production