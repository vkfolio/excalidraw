# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Excalidraw is an open-source virtual whiteboard with a hand-drawn style. It's a **Yarn workspaces monorepo** separating the publishable React component library from the web application.

## Monorepo Structure

- **`packages/excalidraw/`** - Main React component library (`@excalidraw/excalidraw` on npm). Contains the editor UI, actions system, renderer, and all core editor logic.
- **`packages/element/`** - Element logic: Scene management, binding, bounds, collision, transformations, elbow arrows.
- **`packages/math/`** - Pure 2D math: vectors, curves, ellipses, lines, polygons, segments. Uses branded types (`GlobalPoint`, `LocalPoint`, `Radians`, `Degrees`).
- **`packages/common/`** - Shared constants, utilities, types used across all packages.
- **`packages/utils/`** - Export utilities, bbox, bounds checking for external consumers.
- **`excalidraw-app/`** - The excalidraw.com web app: collaboration, Firebase persistence, sharing, PWA.
- **`examples/`** - Integration examples (NextJS, browser script).

## Development Commands

```bash
yarn start               # Run the dev server (excalidraw-app)
yarn test:typecheck      # TypeScript type checking (tsc)
yarn test:app            # Run tests with vitest (interactive watch mode)
yarn test:update         # Run all tests with snapshot updates (no watch)
yarn test:app --watch=false -- packages/excalidraw/tests/selection.test.tsx  # Run a single test file
yarn test:code           # ESLint (--max-warnings=0)
yarn fix                 # Auto-fix formatting (prettier) and linting (eslint)
yarn build:packages      # Build all packages (common → math → element → excalidraw)
```

## Architecture

### State Management

Uses **Jotai** with store isolation. **Never import directly from `"jotai"`** — this is an ESLint error. Instead:
- `packages/excalidraw/editor-jotai.ts` — editor-level atoms (uses `jotai-scope` `createIsolation`)
- `excalidraw-app/app-jotai.ts` — app-level atoms

### Actions System

`packages/excalidraw/actions/` contains ~40 action files (align, canvas, clipboard, properties, history, etc.). Each exports action definitions with `execute`, optional `PanelComponent`, keyboard shortcuts, and predicates. Central registration in `actions/register.ts`.

### Rendering

Two-layer canvas rendering in `packages/excalidraw/renderer/`:
- `staticScene` — elements, backgrounds
- `interactiveScene` — selection handles, cursors, collaboration pointers

The main component is `packages/excalidraw/components/App.tsx` (very large, ~387KB) which orchestrates all canvas interactions and element lifecycle.

### Package Dependency Order

`common` → `math` → `element` → `excalidraw` → `excalidraw-app`

During development, `vitest.config.mts` aliases `@excalidraw/*` imports to source files (not built dist), so you don't need to rebuild packages when editing.

### Type Conventions

- Use the `Point` type from `@excalidraw/math` instead of `{ x, y }` objects
- Use branded types: `GlobalPoint`, `LocalPoint`, `Radians`, `Degrees`
- Always include `packages/math/src/types.ts` context when writing math-related code
- Consistent type imports enforced: `import type { Foo } from ...` (separate-type-imports style)

## Testing

Tests use **Vitest** with `jsdom` environment. Test files live alongside source or in `packages/excalidraw/tests/`.

### Test Helpers

- `tests/test-utils.ts` — `render()`, `unmountComponent()`, `fireEvent`, `act`, `assertSelectedElements`
- `tests/helpers/api.ts` — `API` class: `createElement`, `setElements`, `setSelectedElements`, `updateScene`
- `tests/helpers/ui.ts` — `Pointer` (mouse simulation), `Keyboard` (key events with modifiers), `UI` (tool selection, element creation)

### Typical Test Pattern

```typescript
import { render, unmountComponent } from "./test-utils";
import { API } from "./helpers/api";
import { Pointer, Keyboard, UI } from "./helpers/ui";

beforeEach(() => {
  unmountComponent();
  localStorage.clear();
  reseed(7);  // deterministic randomness
});

it("does something", async () => {
  await render(<Excalidraw />);
  const rect = API.createElement({ type: "rectangle", x: 0, y: 0, width: 100, height: 100 });
  // ... interact and assert
});
```

## Code Style

- TypeScript with strict mode. Prefer immutable data (`const`, `readonly`).
- React functional components with hooks. CSS modules for styling.
- PascalCase for components/types, camelCase for functions, ALL_CAPS for constants.
- Import order enforced by ESLint: builtins → external → `@excalidraw/**` → internal → relative.
- Prefer performant, allocation-free implementations where possible.
