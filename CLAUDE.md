# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in a chat interface, and Claude generates React/JSX code that renders in a sandboxed iframe preview.

## Commands

- `npm run setup` — Install deps, generate Prisma client, run migrations (first-time setup)
- `npm run dev` — Start dev server with Turbopack (uses `cross-env` for Windows compat)
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm test` — Run Vitest (all tests)
- `npx vitest run src/path/to/test.ts` — Run a single test file
- `npm run db:reset` — Reset SQLite database

## Architecture

### AI Chat Flow
1. User sends message → `ChatContext` (`src/lib/contexts/chat-context.tsx`) sends to `/api/chat` via Vercel AI SDK's `useChat`
2. API route (`src/app/api/chat/route.ts`) calls Claude via `streamText` with two tools: `str_replace_editor` and `file_manager`
3. Tool calls modify a server-side `VirtualFileSystem` instance; tool call results stream back to client
4. `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) processes tool calls client-side via `handleToolCall` to keep the client VFS in sync

### Virtual File System
`src/lib/file-system.ts` — In-memory filesystem (no disk writes). All generated files live here. Supports create, read, update, delete, rename, and text-editor operations (view, str_replace, insert). Serializes to/from JSON for persistence and client-server transfer.

### AI Provider
`src/lib/provider.ts` — If `ANTHROPIC_API_KEY` is set, uses Claude Haiku 4.5. Otherwise falls back to `MockLanguageModel` which returns static component code (counter/form/card) without any API calls.

### Live Preview
`src/lib/transform/jsx-transformer.ts` — Transforms JSX files using `@babel/standalone`, creates blob URLs, builds an import map (third-party deps via esm.sh), and generates a self-contained HTML preview document. The preview runs in an iframe (`src/components/preview/PreviewFrame.tsx`).

### Generated Code Conventions
The AI generates code into the VFS with these rules (defined in `src/lib/prompts/generation.tsx`):
- Entry point is always `/App.jsx` (default export)
- Uses Tailwind CSS for styling, no hardcoded styles
- No HTML files — `App.jsx` is the entrypoint
- Internal imports use `@/` alias (e.g., `@/components/Calculator`)

### Auth & Data
- JWT-based auth using `jose`, stored in httpOnly cookies (7-day expiry)
- Prisma with SQLite (`prisma/dev.db`); Prisma client output: `src/generated/prisma`
- Projects store messages and file system data as JSON strings
- Anonymous users can use the app but can't persist projects
- **DB schema**: Always reference `prisma/schema.prisma` to understand the structure of data stored in the database

### Key Patterns
- Path alias: `@/*` maps to `./src/*`
- UI components: shadcn/ui (new-york style) in `src/components/ui/`
- Tests use Vitest + jsdom + React Testing Library, colocated in `__tests__/` directories
- Dev server requires `node-compat.cjs` polyfill loaded via `NODE_OPTIONS`

### Routing
- `/` — Anonymous workspace or redirect to latest project (authenticated users)
- `/[projectId]` — Project workspace
- `/api/chat` — Streaming chat endpoint
- Protected routes (`/api/projects`, `/api/filesystem`) enforced by middleware
