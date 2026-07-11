import { describe, expect, it } from 'vitest';
import { formatInstalledSkills } from './list-view.ts';
import type { CuiInstalledSkill } from './types.ts';

const skills: CuiInstalledSkill[] = [
  {
    name: 'global-skill',
    layer: 'global',
    agents: ['codex'],
    path: '~/.codex/skills/global-skill',
  },
  {
    name: 'project-skill',
    layer: 'project',
    agents: ['claude-code'],
    path: '.claude/skills/project-skill',
  },
];

describe('formatInstalledSkills', () => {
  it('separates project and global skills', () => {
    expect(formatInstalledSkills(skills)).toEqual([
      'Project skills (1)',
      '  - project-skill [Claude Code] — .claude/skills/project-skill',
      'Global skills (1)',
      '  - global-skill [Codex] — ~/.codex/skills/global-skill',
    ]);
  });

  it('renders clear empty states for each layer', () => {
    expect(formatInstalledSkills([])).toEqual([
      'Project skills (0)',
      '  No project skills found.',
      'Global skills (0)',
      '  No global skills found.',
    ]);
  });

  it('can render one selected layer', () => {
    expect(formatInstalledSkills(skills, ['project'])).toEqual([
      'Project skills (1)',
      '  - project-skill [Claude Code] — .claude/skills/project-skill',
    ]);
  });
});
