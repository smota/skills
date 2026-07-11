import { createRequire } from 'node:module';
import type { AgentType } from '../types.ts';
import { CuiActions } from './actions.ts';
import { CoreCuiBackend } from './core-backend.ts';
import { formatInstalledSkills } from './list-view.ts';

type CuiFrame = {
  title: string;
  type: 'buttons' | 'fields';
  data: string[] | string | Record<string, string> | (() => string[]);
  action?: (cb: (err?: Error) => void) => void;
};

type CuiModule = {
  args: string[] | null;
  results: unknown[];
  push(frame: CuiFrame | ((cb: (err?: Error) => void) => void)): void;
  last(index: number): unknown;
  print(message: string): void;
};

const require = createRequire(import.meta.url);

function loadCui(): CuiModule {
  // `cui` is a small CommonJS package without TypeScript declarations.
  return require('cui/index.js') as CuiModule;
}

export interface CuiCliOptions {
  skipConfirmation: boolean;
}

export function parseCuiOptions(args: string[]): { options: CuiCliOptions; rest: string[] } {
  const rest: string[] = [];
  const options: CuiCliOptions = { skipConfirmation: false };

  for (const arg of args) {
    if (arg === '--no-confirmation') {
      options.skipConfirmation = true;
    } else {
      rest.push(arg);
    }
  }

  return { options, rest };
}

export function showCuiHelp(): void {
  console.log(`
Usage: skills cui [options]

Launch the guided command-line user interface for managing skills.

Options:
  --no-confirmation   Skip confirmation prompts for destructive CUI actions
  --help, -h          Show this help message

Examples:
  skills cui
  skills cui --no-confirmation
`);
}

export async function runCui(args: string[] = []): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    showCuiHelp();
    return;
  }

  const { options, rest } = parseCuiOptions(args);
  const cui = loadCui();
  const actions = new CuiActions(new CoreCuiBackend());

  cui.args = rest;
  cui.results = [];

  function printLines(lines: string[]): void {
    for (const line of lines) cui.print(line);
  }

  return new Promise((resolve) => {
    cui.push({
      title: 'skills CUI',
      type: 'buttons',
      data: [
        'List all skills',
        'List project skills',
        'List global skills',
        'Filter by agent',
        'Search skills',
        'Install skill',
        'Exit',
      ],
    });

    cui.push(async (cb) => {
      try {
        const selection = cui.last(1);
        if (selection === 'List all skills') {
          printLines(formatInstalledSkills(await actions.list({ layer: 'all' })));
        } else if (selection === 'List project skills') {
          printLines(formatInstalledSkills(await actions.list({ layer: 'project' }), ['project']));
        } else if (selection === 'List global skills') {
          printLines(formatInstalledSkills(await actions.list({ layer: 'global' }), ['global']));
        } else if (selection === 'Filter by agent') {
          cui.splice({
            title: 'Filter installed skills by agent',
            type: 'fields',
            data: 'Agent id (for example: claude-code, codex, cursor): ',
          });
          cui.splice(async (next) => {
            try {
              const agent = String(cui.last(1) ?? '').trim();
              const skills = await actions.list({ layer: 'all', agents: [agent as AgentType] });
              printLines(formatInstalledSkills(skills));
              next();
            } catch (error) {
              next(error instanceof Error ? error : new Error(String(error)));
            }
          });
        } else if (selection === 'Search skills') {
          cui.print('Search flow will be implemented in the CUI search/install feature.');
        } else if (selection === 'Install skill') {
          cui.print('Install flow will be implemented in the CUI search/install feature.');
        } else {
          cui.print('Goodbye.');
        }

        if (options.skipConfirmation) {
          cui.print('Confirmation prompts are disabled for destructive CUI actions.');
        }
        cb();
      } catch (error) {
        cb(error instanceof Error ? error : new Error(String(error)));
      }
    });

    cui.push((cb) => {
      cb();
      resolve();
    });
  });
}
