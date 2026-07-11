#!/usr/bin/env node

import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

function loadCui() {
  return require('cui/index.js');
}

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

Launch the standalone command-line UI for the skills CLI.

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

function printLines(cui, lines) {
  for (const line of lines) cui.print(line);
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    showHelp();
    return;
  }

  const { options, rest } = parseOptions(rawArgs);
  const cui = loadCui();
  cui.args = rest;
  cui.results = [];

  await new Promise((resolve) => {
    cui.push({
      title: 'skill-cui',
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
          const skills = [...(await listSkills('project')), ...(await listSkills('global'))];
          printLines(cui, formatSkills(skills));
        } else if (selection === 'List project skills') {
          printLines(cui, formatSkills(await listSkills('project'), ['project']));
        } else if (selection === 'List global skills') {
          printLines(cui, formatSkills(await listSkills('global'), ['global']));
        } else if (selection === 'Filter by agent') {
          cui.splice({
            title: 'Filter installed skills by agent',
            type: 'fields',
            data: 'Agent id (for example: claude-code, codex, cursor): ',
          });
          cui.splice(async (next) => {
            try {
              const agent = String(cui.last(1) ?? '').trim();
              const skills = [
                ...(await listSkills('project', agent)),
                ...(await listSkills('global', agent)),
              ];
              printLines(cui, formatSkills(skills));
              next();
            } catch (error) {
              next(error instanceof Error ? error : new Error(String(error)));
            }
          });
        } else if (selection === 'Search skills') {
          cui.print(
            'Search flow will be implemented in the standalone CUI search/install feature.'
          );
        } else if (selection === 'Install skill') {
          cui.print(
            'Install flow will be implemented in the standalone CUI search/install feature.'
          );
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
