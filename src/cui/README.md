# CUI architecture

This directory contains the shared command-line user-interface domain for the future `skills cui` and `skill-cui` entry points.

## Backend contract

`types.ts` defines `CuiBackend`, the only execution boundary the interactive CUI should call. UI flows should depend on this contract instead of importing command modules or spawning subprocesses directly.

The contract covers:

- listing installed skills;
- searching remote skills;
- installing from a source;
- updating installed skills;
- removing installed skills;
- moving a skill between project and global layers;
- optional local agent detection.

`actions.ts` contains small validation and normalization helpers around that backend. These helpers are intentionally UI-library-agnostic so they can be tested without terminal interaction.

## Planned implementations

### Core `skills cui`

The core backend should call existing repository modules directly where possible:

- `listInstalledSkills` from `src/installer.ts` for installed skill views;
- `searchSkillsAPI` from `src/find.ts` for remote search;
- `runAdd` / `parseAddOptions` from `src/add.ts` for install flows;
- `runUpdate` and update helpers from `src/update.ts` for updates;
- `removeCommand` / `parseRemoveOptions` from `src/remove.ts` for removals;
- existing agent definitions and detection helpers for agent defaults.

### Standalone `skill-cui`

The standalone backend must not import private core internals. It should invoke the public `npx skills` command with explicit arguments and parse structured output where available. Today `skills list --json` is the primary structured command; if search, update, or remove need structured output for reliable standalone behavior, add that support deliberately in the relevant feature issue instead of parsing fragile terminal text.

## Manual validation scenarios

```bash
pnpm dev cui --help
pnpm dev cui Exit
pnpm dev cui "List all skills"
pnpm dev cui "Filter by agent" codex
pnpm dev cui "Search skills" typescript
pnpm dev cui "Remove skill" demo project nope
node packages/skill-cui/bin/skill-cui.mjs --help
node packages/skill-cui/bin/skill-cui.mjs Exit
node packages/skill-cui/bin/skill-cui.mjs "List project skills"
```

Before opening a PR, run the focused CUI checks plus the repository validation commands:

```bash
pnpm test src/cui/actions.test.ts src/cui/cli.test.ts src/cui/list-view.test.ts src/cli.test.ts tests/skill-cui-package.test.ts
pnpm test
pnpm build
```
