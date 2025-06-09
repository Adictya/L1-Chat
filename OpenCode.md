# OpenCode Context for l1-chat

## Project Overview
This is a monorepo using Bun workspaces.
- Frontend (`apps/web`): React (Vite), TypeScript, TanStack Router, Tailwind CSS, Shadcn UI.
- Backend (`apps/server`): Hono (Bun runtime), TypeScript.
- Database (`lib/db`): Drizzle ORM, PGlite.

## Common Commands

### Workspace Root
- Install all dependencies: `bun install`
- Run web and server dev environments: `bun run dev`

### Web App (`apps/web`)
- Start dev server: `cd apps/web && bun run dev`
- Build for production: `cd apps/web && bun run build`
- Run tests: `cd apps/web && bun run test`
  - Single test file: `cd apps/web && bun run test src/components/Chat.test.tsx`
  - Specific test name: `cd apps/web && bun run test -t "should render chat messages"`
- Lint: `cd apps/web && bun run lint` (Biome)
- Format: `cd apps/web && bun run format` (Biome)
- Check (lint & format): `cd apps/web && bun run check`

### Server App (`apps/server`)
- Start dev server: `cd apps/server && bun run dev`
- Deploy: `cd apps/server && bun run deploy`

### Database (`lib/db`)
- Generate migrations: `cd lib/db && bun run generate-migrations`

## Code Style (mainly from `apps/web/biome.json`)
- Formatting: Tabs for indentation, double quotes for strings. Biome handles this.
- Imports: Auto-organized by Biome. Use path aliases like `@/components/*`.
- Naming: PascalCase for components (e.g., `AppSidebar`), camelCase for functions/variables.
- Types: TypeScript is strictly used. Define types/interfaces. Zod for runtime validation.
- Error Handling: Standard `try/catch` and `throw new Error()`.
- UI Components: Follow Shadcn UI patterns.
- API: Hono for server routes.
