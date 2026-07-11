#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { confirm, input, select } from '@vr_patel/tui';

const execFileAsync = promisify(execFile);
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
];

function parseOptions(args) {
  const rest = [];
  const options = { skipConfirmation: false };
  for (const arg of args) {
    if (arg === '--no-confirmation') options.skipConfirmation = true;
    else rest.push(arg);
  }
  return { options, rest };
}

function showHelp() {
  console.log(`
Usage: skill-cui [options]

Launch the standalone terminal UI for the skills CLI.

The standalone CUI invokes the public npx skills command and parses structured output where
available. It does not import private internals from the skills package.

Options:
  --no-confirmation   Skip confirmation prompts for destructive CUI actions
  --help, -h          Show this help message

Examples:
  npx skill-cui
  npx skill-cui --no-confirmation
`);
}

async function runSkills(args) {
  try {
    return await execFileAsync('npx', ['skills', ...args], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderr = typeof error.stderr === 'string' ? error.stderr : '';
    throw new Error(`Failed to run npx skills ${args.join(' ')}: ${stderr || message}`);
  }
}

async function listSkills(layer, agent) {
  const args = ['list', '--json'];
  if (layer === 'global') args.push('--global');
  if (agent) args.push('--agent', agent);
  const { stdout } = await runSkills(args);
  const parsed = JSON.parse(stdout || '[]');
  return parsed.map((skill) => ({ ...skill, layer }));
}

async function updateSkill(name, layer) {
  const args = ['update', name, '--yes'];
  if (layer === 'project') args.push('--project');
  if (layer === 'global') args.push('--global');
  await runSkills(args);
}

async function removeSkill(name, layer, skipConfirmation) {
  const args = ['remove', name];
  if (layer === 'global') args.push('--global');
  if (skipConfirmation) args.push('--yes');
  await runSkills(args);
}

async function moveSkill(name, fromLayer, skipConfirmation) {
  const [skill] = (await listSkills(fromLayer)).filter((item) => item.name === name);
  if (!skill?.path) throw new Error(`Could not find ${name} in ${fromLayer} skills.`);
  const toLayer = fromLayer === 'project' ? 'global' : 'project';
  const addArgs = ['add', skill.path, '--yes'];
  if (toLayer === 'global') addArgs.push('--global');
  await runSkills(addArgs);
  await removeSkill(name, fromLayer, skipConfirmation);
  return toLayer;
}

function formatSkills(skills, layers = ['project', 'global']) {
  const lines = [];
  for (const layer of layers) {
    const layerSkills = skills.filter((skill) => skill.layer === layer);
    const label = layer === 'project' ? 'Project' : 'Global';
    lines.push(`${label} skills (${layerSkills.length})`);
    if (layerSkills.length === 0) {
      lines.push(`  No ${layer} skills found.`);
      continue;
    }
    for (const skill of layerSkills.sort((a, b) => a.name.localeCompare(b.name))) {
      const agents = skill.agents?.length ? skill.agents.join(', ') : 'not linked';
      const path = skill.path ? ` — ${skill.path}` : '';
      lines.push(`  - ${skill.name} [${agents}]${path}`);
    }
  }
  return lines;
}

function printLines(lines) {
  for (const line of lines) console.log(line);
}

async function readField(args, index, message) {
  if (args[index] !== undefined) return args[index];
  return input({ message });
}

async function confirmAction(options, args, index, word, message) {
  if (options.skipConfirmation) return true;
  if (args[index] !== undefined) return args[index] === word;
  return confirm({ message, defaultValue: false });
}

function parseMenuSelection(args) {
  for (let size = Math.min(3, args.length); size >= 1; size--) {
    const candidate = args.slice(0, size).join(' ');
    if (MENU_OPTIONS.includes(candidate)) {
      return { selection: candidate, values: args.slice(size) };
    }
  }
  return { values: args };
}

async function promptMenu() {
  return select({
    message: 'skill-cui',
    options: MENU_OPTIONS.map((option) => ({ label: option, value: option })),
  });
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    showHelp();
    return;
  }

  const { options, rest } = parseOptions(rawArgs);
  const { selection: parsedSelection, values } = parseMenuSelection(rest);
  const selection = parsedSelection ?? (await promptMenu());

  if (selection === 'List all skills') {
    printLines(formatSkills([...(await listSkills('project')), ...(await listSkills('global'))]));
  } else if (selection === 'List project skills') {
    printLines(formatSkills(await listSkills('project'), ['project']));
  } else if (selection === 'List global skills') {
    printLines(formatSkills(await listSkills('global'), ['global']));
  } else if (selection === 'Filter by agent') {
    const agent = (
      await readField(values, 0, 'Agent id (for example: claude-code, codex, cursor):')
    ).trim();
    const skills = [
      ...(await listSkills('project', agent)),
      ...(await listSkills('global', agent)),
    ];
    printLines(formatSkills(skills));
  } else if (selection === 'Update skill') {
    const name = (await readField(values, 0, 'Skill name:')).trim();
    const layer = (await readField(values, 1, 'Layer (project, global, or all):')).trim();
    await updateSkill(name, layer);
    console.log('Update complete.');
  } else if (selection === 'Remove skill') {
    const name = (await readField(values, 0, 'Skill name:')).trim();
    const layerInput = (await readField(values, 1, 'Layer (project or global):')).trim();
    const ok = await confirmAction(options, values, 2, 'remove', `Remove ${name}?`);
    if (!ok) {
      console.log('Remove cancelled.');
      return;
    }
    await removeSkill(name, layerInput === 'global' ? 'global' : 'project', true);
    console.log('Remove complete.');
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
    const toLayer = await moveSkill(name, fromLayerInput === 'global' ? 'global' : 'project', true);
    console.log(`Moved to ${toLayer}.`);
  } else if (selection === 'Search skills') {
    console.log('Search flow will be implemented in the standalone CUI search/install feature.');
  } else if (selection === 'Install skill') {
    console.log('Install flow will be implemented in the standalone CUI search/install feature.');
  } else {
    console.log('Goodbye.');
  }

  if (options.skipConfirmation) {
    console.log('Confirmation prompts are disabled for destructive CUI actions.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
