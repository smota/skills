import { createRequire } from 'node:module';
import { CuiActions } from './actions.ts';
import { CoreCuiBackend } from './core-backend.ts';

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

  return new Promise((resolve, reject) => {
    cui.push({
      title: 'skills CUI',
      type: 'buttons',
      data: ['List project skills', 'List global skills', 'Search skills', 'Install skill', 'Exit'],
    });

    cui.push(async (cb) => {
      try {
        const selection = cui.last(1);
        if (selection === 'List project skills') {
          const skills = await actions.list({ layer: 'project' });
          cui.print(`Found ${skills.length} project skill(s).`);
        } else if (selection === 'List global skills') {
          const skills = await actions.list({ layer: 'global' });
          cui.print(`Found ${skills.length} global skill(s).`);
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
