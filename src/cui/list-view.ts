import { agents } from '../agents.ts';
import type { AgentType } from '../types.ts';
import type { CuiInstalledSkill, SkillLayer } from './types.ts';

const LAYERS: SkillLayer[] = ['project', 'global'];

export function formatAgentNames(agentIds: AgentType[]): string {
  if (agentIds.length === 0) return 'not linked';
  return agentIds.map((agent) => agents[agent]?.displayName ?? agent).join(', ');
}

export function formatInstalledSkills(
  skills: CuiInstalledSkill[],
  layers: SkillLayer[] = LAYERS
): string[] {
  const lines: string[] = [];

  for (const layer of layers) {
    const layerSkills = skills.filter((skill) => skill.layer === layer);
    const label = layer === 'project' ? 'Project' : 'Global';
    lines.push(`${label} skills (${layerSkills.length})`);

    if (layerSkills.length === 0) {
      lines.push(`  No ${layer} skills found.`);
      continue;
    }

    for (const skill of layerSkills.sort((a, b) => a.name.localeCompare(b.name))) {
      const agentInfo = formatAgentNames(skill.agents);
      const pathInfo = skill.path ? ` — ${skill.path}` : '';
      lines.push(`  - ${skill.name} [${agentInfo}]${pathInfo}`);
    }
  }

  return lines;
}
