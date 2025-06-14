# Context for l1-chat Agent

## Project Overview
Monorepo (Bun workspaces). Frontend: `apps/web` (React/Vite/TS/Tailwind/Shadcn). Backend: `apps/server` (Hono/Bun/TS). DB: `lib/db` (Drizzle/PGlite).
**Rule: Prioritize Bun.** Use `bun` for scripts, tests, installs (`bun install`, `bun run dev`, `bun test`). Prefer Bun APIs (`Bun.serve`, `Bun.file`) over Node/etc. See `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc`.

## Common Commands (cd to dir if specified)
- Root: `bun install` (install all), `bun run dev` (run web+server dev)
- `apps/web`:
  - `bun run dev` (dev server), `bun run build` (build)
  - `bun run test` (all tests) | `... test src/file.tsx` (single file) | `... test -t "name"` (by name)
  - `bun run check` (lint & format with Biome)
- `apps/server`: `bun run dev`
- `lib/db`: `bun run generate-migrations`

## Code Style (main: `apps/web/biome.json`)
- Formatting: Tabs, double quotes (Biome enforces in `apps/web`).
- Imports: Auto-organized by Biome; path aliases like `@/components/*`.
- Naming: `PascalCase` (Components), `camelCase` (functions/variables).
- Types: Strict TypeScript. Use Zod for runtime validation.
- Error Handling: Standard `try/catch`, `throw new Error()`.
- UI: Shadcn UI patterns. API: Hono for server.
