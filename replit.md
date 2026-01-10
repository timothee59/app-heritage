# Héritage Partagé

## Overview

Héritage Partagé is a family inheritance management application designed to help elderly parents (65+) catalog household items and coordinate distribution preferences among family members. The app allows family members to photograph items, express preferences (want it, might want it, not interested), and identify conflicts when multiple people want the same item.

This is an MVP focused on simplicity - no complex authentication (just first name selection), full transparency (everyone sees everything), and collaborative contribution. Built as a PWA for iOS/iPad use.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (compiled with tsx)
- **API Style**: RESTful JSON endpoints under `/api/*`
- **Static Serving**: Express serves built client files in production

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client/server)
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Current Storage**: In-memory storage (`MemStorage` class) with interface for future database migration

### Authentication Pattern
- Simple first-name selection from dropdown (no passwords)
- User ID stored in `localStorage` for session persistence
- Roles: "parent" or "enfant" (child)

### Project Structure
```
client/           # React frontend
  src/
    components/ui/  # shadcn/ui components
    pages/          # Route pages
    hooks/          # Custom React hooks
    lib/            # Utilities (queryClient, utils)
server/           # Express backend
  index.ts        # Server entry point
  routes.ts       # API route definitions
  storage.ts      # Data access layer
shared/           # Shared types and schemas
  schema.ts       # Drizzle schema definitions
stories/          # User story documentation
```

### Design System
- Apple HIG + Material Design hybrid approach
- Accessibility-focused for elderly users (minimum 16px text, 44px touch targets)
- Mobile-first responsive design (2 columns mobile, 3-4 desktop)
- Bottom tab navigation pattern for PWA

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations and schema management

### UI Framework
- **Radix UI**: Accessible component primitives (dialog, select, dropdown, etc.)
- **shadcn/ui**: Pre-styled component library built on Radix
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development

### State & Data
- **TanStack React Query**: Server state management and caching
- **Zod**: Runtime type validation
- **React Hook Form**: Form state management (with @hookform/resolvers)

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Development tooling
- `@replit/vite-plugin-dev-banner`: Development environment indicator