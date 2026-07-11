import { confirm, input, select } from '@vr_patel/tui';
import type { AgentType } from '../types.ts';
import { CuiActions } from './actions.ts';
import { CoreCuiBackend } from './core-backend.ts';
import { formatInstalledSkills } from './list-view.ts';

const MENU_OPTIONS = [
  'List all skills',
  'List project skills',
  'List global skills',
  'Filter by agent',
  'Update skill',
  'Remove skill',
  'Move skill',
  'Search skills',
  'Install skill',
  'Exit',
] as const;

type MenuOption = (typeof MENU_OPTIONS)[number];

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

Launch the guided terminal UI for managing skills.

Options:
  --no-confirmation   Skip confirmation prompts for destructive CUI actions
  --help, -h          Show this help message

Examples:
  skills cui
  skills cui --no-confirmation
`);
}

function printLines(lines: string[]): void {
  for (const line of lines) console.log(line);
}

function parseMenuSelection(args: string[]): { selection?: MenuOption; values: string[] } {
  for (let size = Math.min(3, args.length); size >= 1; size--) {
    const candidate = args.slice(0, size).join(' ');
    if (MENU_OPTIONS.includes(candidate as MenuOption)) {
      return { selection: candidate as MenuOption, values: args.slice(size) };
    }
  }
  return { values: args };
}

async function promptMenu(): Promise<MenuOption> {
  return select<MenuOption>({
    message: 'skills CUI',
    options: MENU_OPTIONS.map((option) => ({ label: option, value: option })),
  });
}

async function readField(args: string[], index: number, message: string): Promise<string> {
  if (args[index] !== undefined) return args[index]!;
  return input({ message });
}

async function confirmAction(
  options: CuiCliOptions,
  args: string[],
  index: number,
  word: 'remove' | 'move',
  message: string
): Promise<boolean> {
  if (options.skipConfirmation) return true;
  if (args[index] !== undefined) return args[index] === word;
  return confirm({ message, defaultValue: false });
}

export async function runCui(args: string[] = []): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    showCuiHelp();
    return;
  }

  const { options, rest } = parseCuiOptions(args);
  const { selection: parsedSelection, values } = parseMenuSelection(rest);
  const actions = new CuiActions(new CoreCuiBackend());
  const selection = parsedSelection ?? (await promptMenu());

  if (selection === 'List all skills') {
    printLines(formatInstalledSkills(await actions.list({ layer: 'all' })));
  } else if (selection === 'List project skills') {
    printLines(formatInstalledSkills(await actions.list({ layer: 'project' }), ['project']));
  } else if (selection === 'List global skills') {
    printLines(formatInstalledSkills(await actions.list({ layer: 'global' }), ['global']));
  } else if (selection === 'Filter by agent') {
    const agent = (
      await readField(values, 0, 'Agent id (for example: claude-code, codex, cursor):')
    ).trim();
    printLines(
      formatInstalledSkills(await actions.list({ layer: 'all', agents: [agent as AgentType] }))
    );
  } else if (selection === 'Update skill') {
    const name = (await readField(values, 0, 'Skill name:')).trim();
    const layerInput = (await readField(values, 1, 'Layer (project, global, or all):')).trim();
    const layer = layerInput === 'project' || layerInput === 'global' ? layerInput : 'all';
    const result = await actions.update({ names: [name], layer });
    console.log(result.message ?? 'Update complete.');
  } else if (selection === 'Remove skill') {
    const name = (await readField(values, 0, 'Skill name:')).trim();
    const layerInput = (await readField(values, 1, 'Layer (project or global):')).trim();
    const ok = await confirmAction(options, values, 2, 'remove', `Remove ${name}?`);
    if (!ok) {
      console.log('Remove cancelled.');
      return;
    }
    const layer = layerInput === 'global' ? 'global' : 'project';
    const result = await actions.remove({ names: [name], layer, skipConfirmation: true });
    console.log(result.message ?? 'Remove complete.');
  } else if (selection === 'Move skill') {
    const name = (await readField(values, 0, 'Skill name:')).trim();
    const fromLayerInput = (
      await readField(values, 1, 'Current layer (project or global):')
    ).trim();
    const ok = await confirmAction(options, values, 2, 'move', `Move ${name} to the other layer?`);
    if (!ok) {
      console.log('Move cancelled.');
      return;
    }
    const fromLayer = fromLayerInput === 'global' ? 'global' : 'project';
    const toLayer = fromLayer === 'project' ? 'global' : 'project';
    const result = await actions.move({ name, fromLayer, toLayer, skipConfirmation: true });
    console.log(result.message ?? 'Move complete.');
  } else if (selection === 'Search skills') {
    console.log('Search flow will be implemented in the CUI search/install feature.');
  } else if (selection === 'Install skill') {
    console.log('Install flow will be implemented in the CUI search/install feature.');
  } else {
    console.log('Goodbye.');
  }

  if (options.skipConfirmation) {
    console.log('Confirmation prompts are disabled for destructive CUI actions.');
  }
}
