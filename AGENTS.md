# AGENTS.md

## Stack

Vanilla JS/HTML/CSS only. There is no `package.json`, build step, bundler, linter, or test suite — do not invent `npm`/lint/test commands. Run the game by opening `src/index.html` in a browser (or serving `src/` statically).

## Architecture

The four JS files are loaded as plain `<script>` tags in this exact order in `src/index.html`:

1. `maze.js` — maze data. Exposes `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS` on `window`.
2. `game.js` — state and rules. Exposes `createGame`, `update`, `DIRS`.
3. `render.js` — canvas drawing. Exposes `draw`.
4. `main.js` — loop, keyboard, overlay screens. Consumes the globals above.

No ES modules — files communicate via `window.*` globals. Adding a JS file requires adding a `<script>` tag to `index.html` in dependency order.

### Maze invariants

- Tile codes in `MAZE`: `1` wall, `2` dot, `0` empty, `3` ghost-pen door (blocks Pac-Man, passable by ghosts).
- `MAZE` (28×31) is pristine and never mutated; `createGame()` copies it into `game.grid`, which is the copy gameplay mutates. Render reads `game.grid`, not `MAZE`.

## Spec-driven workflow

This repo exists to practice spec-driven development. Features are designed first, then implemented:

- Skills live in `.agents/skills/` (`spec`, `spec-impl`), pinned by `skills-lock.json`.
- `/spec` produces `specs/NN-slug.md` (zero-padded, sequential). It writes specs only — never code.
- `/spec-impl <NN-slug>` implements a spec, but only if its state means "Approved"; it stops on any other state. It creates/switches to branch `spec-NN-slug` and honors flags in `specs/.spec-config.yml` (`AutoCreateBranch: true`, `AutoCommitSteps: false` by default — with defaults, it never commits).
- Before `/spec-impl`, the working tree must be clean.

## Language

README, code comments, and UI text are in Spanish. Reply in the language the user prompts in.
