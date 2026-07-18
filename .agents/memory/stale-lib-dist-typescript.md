---
name: Stale workspace lib dist output causing false TS2305
description: Adding new exports to a workspace lib (e.g. lib/db, lib/api-zod) can silently fail to typecheck downstream if dist/*.d.ts wasn't rebuilt.
---

In this pnpm-workspace monorepo, packages like `lib/db` and `lib/api-zod` build to `dist/*.d.ts` via `tsc --build` (project references), and downstream packages (e.g. `artifacts/api-server`) typecheck against that `dist` output, not the `src` directly. If you add a new schema/export to a lib's `src` but the `dist/*.d.ts` and `.tsbuildinfo` weren't invalidated/rebuilt, downstream typecheck fails with a misleading `TS2305: Module has no exported member` — even though the source is correct.

**How to apply:** After adding exports to a workspace lib, if downstream typecheck reports `TS2305` for something you just added, first try `rm -rf <lib>/dist <lib>/*.tsbuildinfo` then rerun `pnpm -w run typecheck:libs` (or `tsc --build`) before assuming the code itself is wrong.
