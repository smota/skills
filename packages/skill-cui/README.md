# skill-cui

Standalone terminal UI for the `skills` CLI.

```bash
npx skill-cui
npx skill-cui --no-confirmation
npm install -g skill-cui
skill-cui
```

Use it to list project/global skills, filter by agent, update, remove, move, search, and install skills from a guided terminal interface.

## How standalone mode works

`skill-cui` invokes the public `npx skills` command and parses structured output where available. It intentionally does not import private internals from the `skills` package, so it can run through `npx` without a previous local installation.

Standalone search requires keywords because open interactive search belongs to `npx skills find` itself.

## Safety

Destructive actions ask for confirmation by default. Use `--no-confirmation` only in trusted workflows where you want to skip CUI confirmation prompts.

## Attribution

`skill-cui` is published from the [`smota/skills`](https://github.com/smota/skills) fork as a standalone CUI package for the open `skills` CLI ecosystem. It is based on the upstream [`vercel-labs/skills`](https://github.com/vercel-labs/skills) project and keeps upstream attribution visible while exposing this fork's standalone package entry point. Package metadata uses the GitHub handle `smota` for fork/author attribution.

## Local development

From the repository root:

```bash
node packages/skill-cui/bin/skill-cui.mjs --help
node packages/skill-cui/bin/skill-cui.mjs Exit
node packages/skill-cui/bin/skill-cui.mjs "List all skills"
```

Before publishing, validate the package contents:

```bash
cd packages/skill-cui
npm pack --dry-run --json
```
