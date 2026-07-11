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

async function listSkills(layer) {
  const args = ['list', '--json'];
  if (layer === 'global') args.push('--global');
  const { stdout } = await runSkills(args);
  return JSON.parse(stdout || '[]');
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

  await new Promise((resolve, reject) => {
    cui.push({
      title: 'skill-cui',
      type: 'buttons',
      data: ['List project skills', 'List global skills', 'Search skills', 'Install skill', 'Exit'],
    });

    cui.push(async (cb) => {
      try {
        const selection = cui.last(1);
        if (selection === 'List project skills') {
          const skills = await listSkills('project');
          cui.print(`Found ${skills.length} project skill(s).`);
        } else if (selection === 'List global skills') {
          const skills = await listSkills('global');
          cui.print(`Found ${skills.length} global skill(s).`);
        } else if (selection === 'Search skills') {
          cui.print('Search flow will be implemented in the standalone CUI search/install feature.');
        } else if (selection === 'Install skill') {
          cui.print('Install flow will be implemented in the standalone CUI search/install feature.');
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
