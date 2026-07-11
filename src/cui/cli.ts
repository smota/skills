import { Box, confirm, input, select } from '@vr_patel/tui';
import type { AgentType } from '../types.ts';
import { CuiActions } from './actions.ts';
import { CoreCuiBackend } from './core-backend.ts';
import { formatInstalledSkills } from './list-view.ts';
import type {
  CuiAgentOption,
  CuiInstalledSkill,
  CuiSearchResult,
  SkillLayer,
  SkillLayerFilter,
} from './types.ts';

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

const SKILL_ACTIONS = ['Update skill', 'Remove skill', 'Move skill', 'Back', 'Exit'] as const;

type MenuOption = (typeof MENU_OPTIONS)[number];
type SkillAction = (typeof SKILL_ACTIONS)[number];

export interface CuiCliOptions {
  skipConfirmation: boolean;
}

interface ListContext {
  layer: SkillLayerFilter;
  agents?: AgentType[];
  title: string;
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

function printWindow(title: string, instructions: string[], content: string[] = []): void {
  const box = new Box({ title, borderStyle: 'round' });
  const body = [
    'Skills command center',
    'Discover, install, update, move, and remove agent skills from one guided terminal UI.',
    'Explore more skills at https://www.skills.sh/',
    '',
    'Keys: ↑/↓ or j/k to move • Enter to select • Ctrl+C to cancel • choose Exit to quit',
    '',
    ...instructions.map((line) => `• ${line}`),
    ...(content.length > 0 ? ['', ...content] : []),
  ].join('\n');
  console.log(box.render(body));
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
  printWindow('Main menu', [
    'Choose a command, then continue to the next relevant options.',
    'Use Update skill here for the guided equivalent of `npx skills update`.',
    'Exit is always available.',
  ]);
  return select<MenuOption>({
    message: 'Command:',
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

function parseLayer(value: string, fallback: SkillLayer = 'project'): SkillLayer {
  return value.trim() === 'global' ? 'global' : fallback;
}

function oppositeLayer(layer: SkillLayer): SkillLayer {
  return layer === 'project' ? 'global' : 'project';
}

function parseAgentSelection(value: string): AgentType[] {
  return value
    .split(',')
    .map((agent) => agent.trim())
    .filter(Boolean) as AgentType[];
}

async function defaultDetectedAgents(actions: CuiActions): Promise<AgentType[]> {
  const detected = (await actions.detectAgents?.()) ?? [];
  return detected.filter((agent: CuiAgentOption) => agent.detected).map((agent) => agent.id);
}

async function promptInstallOptions(
  actions: CuiActions,
  values: string[],
  source: string
): Promise<{ layer: SkillLayer; agents: AgentType[] }> {
  const layerInput = (
    await readField(values, 1, 'Layer (project or global, default project):')
  ).trim();
  const layer = parseLayer(layerInput || 'project');
  const detectedAgents = await defaultDetectedAgents(actions);
  const defaultAgents = detectedAgents.join(',');
  const agentInput = (
    await readField(
      values,
      2,
      `Agents comma-separated${defaultAgents ? ` (default ${defaultAgents})` : ''}:`
    )
  ).trim();
  const agents = parseAgentSelection(agentInput || defaultAgents);
  if (agents.length === 0) throw new Error(`Select at least one agent to install ${source}.`);
  return { layer, agents };
}

function formatSearchResults(results: CuiSearchResult[]): string[] {
  if (results.length === 0) return ['No matching skills found.'];
  return results.map((result) => {
    const installs = result.installs === undefined ? '' : ` — ${result.installs} install(s)`;
    return `- ${result.name} — ${result.source}${installs}`;
  });
}

async function installFromSource(
  actions: CuiActions,
  values: string[],
  source: string,
  skills?: string[]
): Promise<void> {
  const { layer, agents } = await promptInstallOptions(actions, values, source);
  const result = await actions.install({ source, layer, agents, skills });
  console.log(result.message ?? `Installed from ${source}.`);
}

async function showSearchFlow(
  actions: CuiActions,
  values: string[],
  interactive: boolean
): Promise<'continue' | 'exit'> {
  const query = (
    await readField(values, 0, 'Search keywords (leave blank for open search):')
  ).trim();
  const results = await actions.search({ query });
  printWindow(
    'Search skills',
    ['Review search results.', 'Select a result to install, or exit.'],
    formatSearchResults(results)
  );
  if (!interactive || results.length === 0) return 'continue';

  const selected = await select<string>({
    message: 'Search result:',
    options: [
      ...results.map((result, index) => ({
        label: result.name,
        value: String(index),
        description: result.source,
      })),
      { label: 'Back', value: '__back' },
      { label: 'Exit', value: '__exit' },
    ],
  });

  if (selected === '__exit') return 'exit';
  if (selected === '__back') return 'continue';
  const result = results[Number(selected)];
  if (!result) return 'continue';
  await installFromSource(actions, [], result.source, [result.name]);
  return 'continue';
}

async function updateSkill(actions: CuiActions, skill: CuiInstalledSkill): Promise<void> {
  const result = await actions.update({ names: [skill.name], layer: skill.layer });
  console.log(result.message ?? 'Update complete.');
}

async function removeSkill(
  actions: CuiActions,
  options: CuiCliOptions,
  skill: CuiInstalledSkill
): Promise<void> {
  const ok = options.skipConfirmation
    ? true
    : await confirm({ message: `Remove ${skill.name} from ${skill.layer}?`, defaultValue: false });
  if (!ok) {
    console.log('Remove cancelled.');
    return;
  }
  const result = await actions.remove({
    names: [skill.name],
    layer: skill.layer,
    skipConfirmation: true,
  });
  console.log(result.message ?? 'Remove complete.');
}

async function moveSkill(
  actions: CuiActions,
  options: CuiCliOptions,
  skill: CuiInstalledSkill
): Promise<void> {
  const toLayer = oppositeLayer(skill.layer);
  const ok = options.skipConfirmation
    ? true
    : await confirm({ message: `Move ${skill.name} to ${toLayer}?`, defaultValue: false });
  if (!ok) {
    console.log('Move cancelled.');
    return;
  }
  const result = await actions.move({
    name: skill.name,
    fromLayer: skill.layer,
    toLayer,
    skipConfirmation: true,
  });
  console.log(result.message ?? 'Move complete.');
}

async function promptSkillAction(
  actions: CuiActions,
  options: CuiCliOptions,
  skill: CuiInstalledSkill
): Promise<'back' | 'exit'> {
  printWindow('Skill actions', [`Selected: ${skill.name}`, `Layer: ${skill.layer}`]);
  const action = await select<SkillAction>({
    message: 'Next action:',
    options: SKILL_ACTIONS.map((item) => ({ label: item, value: item })),
  });

  if (action === 'Exit') return 'exit';
  if (action === 'Back') return 'back';
  if (action === 'Update skill') await updateSkill(actions, skill);
  if (action === 'Remove skill') await removeSkill(actions, options, skill);
  if (action === 'Move skill') await moveSkill(actions, options, skill);
  return 'back';
}

async function showListFlow(
  actions: CuiActions,
  options: CuiCliOptions,
  context: ListContext,
  interactive: boolean
): Promise<'continue' | 'exit'> {
  const skills = await actions.list({ layer: context.layer, agents: context.agents });
  printWindow(
    context.title,
    ['Review installed skills.', 'Select one skill for update/remove/move, or exit.'],
    formatInstalledSkills(skills)
  );

  if (!interactive) return 'continue';
  if (skills.length === 0) return 'continue';

  const selected = await select<string>({
    message: 'Skill:',
    options: [
      ...skills.map((skill) => ({
        label: skill.name,
        value: skill.name,
        description: `${skill.layer} — ${skill.agents.join(', ') || 'not linked'}`,
      })),
      { label: 'Back', value: '__back' },
      { label: 'Exit', value: '__exit' },
    ],
  });

  if (selected === '__exit') return 'exit';
  if (selected === '__back') return 'continue';
  const skill = skills.find((item) => item.name === selected);
  if (!skill) return 'continue';
  return (await promptSkillAction(actions, options, skill)) === 'exit' ? 'exit' : 'continue';
}

async function runSingleCommand(
  actions: CuiActions,
  options: CuiCliOptions,
  selection: MenuOption,
  values: string[]
): Promise<void> {
  if (selection === 'List all skills') {
    await showListFlow(actions, options, { layer: 'all', title: 'All skills' }, false);
  } else if (selection === 'List project skills') {
    await showListFlow(actions, options, { layer: 'project', title: 'Project skills' }, false);
  } else if (selection === 'List global skills') {
    await showListFlow(actions, options, { layer: 'global', title: 'Global skills' }, false);
  } else if (selection === 'Filter by agent') {
    const agent = (
      await readField(values, 0, 'Agent id (for example: claude-code, codex, cursor):')
    ).trim();
    await showListFlow(
      actions,
      options,
      { layer: 'all', agents: [agent as AgentType], title: `Skills for ${agent}` },
      false
    );
  } else if (selection === 'Update skill') {
    const name = (await readField(values, 0, 'Skill name:')).trim();
    const layerInput = (await readField(values, 1, 'Layer (project, global, or all):')).trim();
    const layer = layerInput === 'project' || layerInput === 'global' ? layerInput : 'all';
    const result = await actions.update({ names: [name], layer });
    console.log(result.message ?? 'Update complete.');
  } else if (selection === 'Remove skill') {
    const name = (await readField(values, 0, 'Skill name:')).trim();
    const layer = parseLayer(await readField(values, 1, 'Layer (project or global):'));
    const ok = await confirmAction(options, values, 2, 'remove', `Remove ${name}?`);
    if (!ok) {
      console.log('Remove cancelled.');
      return;
    }
    const result = await actions.remove({ names: [name], layer, skipConfirmation: true });
    console.log(result.message ?? 'Remove complete.');
  } else if (selection === 'Move skill') {
    const name = (await readField(values, 0, 'Skill name:')).trim();
    const fromLayer = parseLayer(await readField(values, 1, 'Current layer (project or global):'));
    const ok = await confirmAction(options, values, 2, 'move', `Move ${name} to the other layer?`);
    if (!ok) {
      console.log('Move cancelled.');
      return;
    }
    const result = await actions.move({
      name,
      fromLayer,
      toLayer: oppositeLayer(fromLayer),
      skipConfirmation: true,
    });
    console.log(result.message ?? 'Move complete.');
  } else if (selection === 'Search skills') {
    await showSearchFlow(actions, values, false);
  } else if (selection === 'Install skill') {
    const source = (
      await readField(values, 0, 'Folder, GitHub shorthand, git URL, or full URL:')
    ).trim();
    await installFromSource(actions, values, source);
  } else {
    console.log('Goodbye.');
  }
}

export async function runCui(args: string[] = []): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    showCuiHelp();
    return;
  }

  const { options, rest } = parseCuiOptions(args);
  const { selection: parsedSelection, values } = parseMenuSelection(rest);
  const actions = new CuiActions(new CoreCuiBackend());

  if (parsedSelection) {
    await runSingleCommand(actions, options, parsedSelection, values);
    if (options.skipConfirmation) {
      console.log('Confirmation prompts are disabled for destructive CUI actions.');
    }
    return;
  }

  while (true) {
    const selection = await promptMenu();
    if (selection === 'Exit') {
      console.log('Goodbye.');
      return;
    }
    const result = await (async () => {
      if (selection === 'List all skills')
        return showListFlow(actions, options, { layer: 'all', title: 'All skills' }, true);
      if (selection === 'List project skills')
        return showListFlow(actions, options, { layer: 'project', title: 'Project skills' }, true);
      if (selection === 'List global skills')
        return showListFlow(actions, options, { layer: 'global', title: 'Global skills' }, true);
      if (selection === 'Filter by agent') {
        const agent = (
          await input({ message: 'Agent id (for example: claude-code, codex, cursor):' })
        ).trim();
        return showListFlow(
          actions,
          options,
          { layer: 'all', agents: [agent as AgentType], title: `Skills for ${agent}` },
          true
        );
      }
      if (selection === 'Search skills') return showSearchFlow(actions, [], true);
      if (selection === 'Install skill') {
        const source = (
          await input({ message: 'Folder, GitHub shorthand, git URL, or full URL:' })
        ).trim();
        await installFromSource(actions, [], source);
        return 'continue' as const;
      }
      await runSingleCommand(actions, options, selection, []);
      return 'continue' as const;
    })();
    if (result === 'exit') return;
  }
}
