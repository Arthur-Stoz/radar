# Radar — progress log

Each phase appends an entry: what's done, what's left, known issues.

## Phase A — Scaffold (2026-10-19)

Done
- Next.js 16 (App Router) + TypeScript + Tailwind v4, npm, Node 22 (`.nvmrc`, `engines`).
- Design tokens from BUILD.md §7.1 as CSS variables (`app/globals.css`), light + derived dark theme.
  Theme follows the system, with a manual toggle (system → light → dark) stored in `localStorage`, applied before paint.
- Geist / Geist Mono via the `geist` package. Layout, logo, footer (cropped wordmark as in the design export).
- Design export unzipped in `design/` (the zip held 18 boards: Home, Results, Job page, Status, 404, Mobile, Dark…).
  Photos/icons converted to small WebP in `public/assets/` (4.7 MB → 0.7 MB).
- Scripts: dev, build, start (`$PORT`), ingest, test, e2e, eval, typecheck, lint. ESLint flat config, Vitest.
- `git init`.

Left
- Everything from phase B on.

Known issues
- None.
