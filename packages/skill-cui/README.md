# skill-cui

Standalone command-line user interface for the `skills` CLI.

```bash
npx skill-cui
npx skill-cui --no-confirmation
```

This package is intentionally standalone: it invokes the public `npx skills` command and parses structured output where available instead of importing private internals from the `skills` package.

For local development from the repository root:

```bash
node packages/skill-cui/bin/skill-cui.mjs --help
node packages/skill-cui/bin/skill-cui.mjs Exit
```
