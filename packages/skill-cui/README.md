# skill-cui

Standalone terminal UI for the `skills` CLI.

```bash
npx skill-cui
npx skill-cui --no-confirmation
```

Use it to list project/global skills, filter by agent, update, remove, move, search, and install skills from a guided terminal interface.

## How standalone mode works

`skill-cui` invokes the public `npx skills` command and parses structured output where available. It intentionally does not import private internals from the `skills` package, so it can run through `npx` without a previous local installation.

Standalone search requires keywords because open interactive search belongs to `npx skills find` itself.

## Safety

Destructive actions ask for confirmation by default. Use `--no-confirmation` only in trusted workflows where you want to skip CUI confirmation prompts.

## Local development

From the repository root:

```bash
node packages/skill-cui/bin/skill-cui.mjs --help
node packages/skill-cui/bin/skill-cui.mjs Exit
node packages/skill-cui/bin/skill-cui.mjs "List all skills"
```
