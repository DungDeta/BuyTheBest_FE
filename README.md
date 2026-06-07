# BuyTheBest — Frontend

Hệ thống đấu giá trực tiếp — Buy The Best. Frontend React application.

## Tech Stack

- React 19 + TypeScript
- Vite (build tool)
- Ant Design (UI components)
- Zustand (state management)
- Axios (HTTP client)
- React Router 7 (routing)

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Start development server
npm run dev
```

## Project Structure

```
src/
├── api/          # Axios instances + generic API functions
├── assets/       # Styles, images
├── components/   # Reusable UI components
├── hooks/        # Custom hooks
├── layout/       # Layout wrappers (Public, Dashboard, Admin)
├── pages/        # Page components by role
├── routes/       # Route definitions + guards
├── store/        # Zustand stores
├── types/        # TypeScript interfaces
└── utils/        # Helper functions
```

## Available Scripts

- `npm run dev` — Start dev server (port 5173)
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run preview` — Preview production build
