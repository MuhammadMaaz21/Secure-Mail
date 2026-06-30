# UOL Secure Email System

A secure email management system with AI-powered spam and phishing detection.

## Project Structure

```
UOL Secure Email System/
├── backend/          # Express.js backend server
├── frontend/         # React + Vite frontend
└── docs/            # Project documentation
```

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   The backend will run on `http://localhost:5000`

5. For production:
   ```bash
   npm start
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `frontend/` directory (optional):
   ```env
   VITE_API_URL=http://localhost:5000
   PORT=5173
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`

5. Build for production:
   ```bash
   npm run build
   ```

6. Preview production build:
   ```bash
   npm run preview
   ```

## Running Both Servers Together

### Option 1: Using Root Dev Script (Recommended)

1. Install root dependencies (includes concurrently):
   ```bash
   npm install
   ```

2. Install all project dependencies:
   ```bash
   npm run install:all
   ```

3. Start both servers with a single command:
   ```bash
   npm run dev
   ```
   This will start both backend (port 5000) and frontend (port 5173) simultaneously.

### Option 2: Manual (Two Terminals)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Option 3: Using Concurrently Globally

If you have concurrently installed globally:
```bash
concurrently "cd backend && npm run dev" "cd frontend && npm run dev"
```

## Environment Variables

### Backend (.env)
- `PORT` - Server port (default: 5000)
- `JWT_SECRET` - Secret key for JWT token signing (required)

### Frontend (.env)
- `VITE_API_URL` - Backend API URL (default: http://localhost:5000)
- `PORT` - Frontend dev server port (default: 5173)
- `BASE` - Base path for the app (default: /)

## Available Scripts

### Backend Scripts
- `npm run dev` - Start development server with nodemon (auto-reload)
- `npm start` - Start production server

### Frontend Scripts
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production (creates `dist/` folder)
- `npm run build:client` - Build client bundle only
- `npm run build:server` - Build SSR server bundle only
- `npm run preview` - Preview production build locally

## Ports

- **Backend**: `5000` (configurable via `PORT` env variable)
- **Frontend**: `5173` (configurable via `PORT` env variable)

## Tech Stack

### Backend
- Express.js
- Node.js
- JWT for authentication

### Frontend
- React 19
- Vite 7
- React Router v7
- Tailwind CSS 4
- Axios for API calls

## Development Notes

- The frontend uses Vite with React plugin for fast HMR (Hot Module Replacement)
- Backend uses nodemon for auto-restart on file changes
- Both servers support hot-reload in development mode

## Troubleshooting

### Port Already in Use
If you get a "port already in use" error:
- Backend: Change `PORT` in `.env` or use `PORT=5001 npm run dev`
- Frontend: Change `PORT` in `.env` or use `PORT=5174 npm run dev`

### CORS Issues
Ensure the frontend URL is allowed in backend CORS configuration if needed.

### Module Not Found
Run `npm install` in both `backend/` and `frontend/` directories.

