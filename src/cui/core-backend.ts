import { runAdd } from '../add.ts';
import { agents } from '../agents.ts';
import { searchSkillsAPI } from '../find.ts';
import { listInstalledSkills } from '../installer.ts';
import { removeCommand } from '../remove.ts';
import type { AgentType } from '../types.ts';
import { runUpdate } from '../update.ts';
import type {
  CuiActionResult,
  CuiBackend,
  CuiInstallRequest,
  CuiInstalledSkill,
  CuiListRequest,
  CuiMoveRequest,
  CuiRemoveRequest,
  CuiSearchRequest,
  CuiSearchResult,
  CuiUpdateRequest,
  SkillLayer,
} from './types.ts';

function layerToGlobalFlag(layer: SkillLayer): boolean {
  return layer === 'global';
}

function layerFilterToListLayers(layer: CuiListRequest['layer']): SkillLayer[] {
  if (!layer || layer === 'all') return ['project', 'global'];
  return [layer];
}

function layerFilterToUpdateArgs(layer: CuiUpdateRequest['layer']): string[] {
  if (layer === 'project') return ['--project'];
  if (layer === 'global') return ['--global'];
  return [];
}

export class CoreCuiBackend implements CuiBackend {
  async list(request: CuiListRequest): Promise<CuiInstalledSkill[]> {
    const layers = layerFilterToListLayers(request.layer);
    const results = await Promise.all(
      layers.map((layer) =>
        listInstalledSkills({
          global: layerToGlobalFlag(layer),
          agentFilter: request.agents,
        })
      )
    );

    return results.flat().map((skill) => ({
      name: skill.name,
      layer: skill.scope,
      agents: skill.agents,
      path: skill.canonicalPath,
    }));
  }

  async search(request: CuiSearchRequest): Promise<CuiSearchResult[]> {
    return searchSkillsAPI(request.query ?? '', request.owner);
  }

  async install(request: CuiInstallRequest): Promise<CuiActionResult> {
    const args = [request.source];
    if (request.layer === 'global') args.push('--global');
    if (request.copy) args.push('--copy');
    if (request.fullDepth) args.push('--full-depth');
    for (const agent of request.agents) args.push('--agent', agent);
    for (const skill of request.skills ?? []) args.push('--skill', skill);
    args.push('--yes');

    await runAdd(args);
    return { ok: true };
  }

  async update(request: CuiUpdateRequest): Promise<CuiActionResult> {
    await runUpdate([...(request.names ?? []), ...layerFilterToUpdateArgs(request.layer), '--yes']);
    return { ok: true };
  }

  async remove(request: CuiRemoveRequest): Promise<CuiActionResult> {
    await removeCommand(request.names, {
      global: request.layer === 'global',
      agent: request.agents,
      yes: request.skipConfirmation,
    });
    return { ok: true };
  }

  async move(_request: CuiMoveRequest): Promise<CuiActionResult> {
    return {
      ok: false,
      message:
        'Moving skills between layers will be implemented with the installed-skill actions flow.',
    };
  }

  async detectAgents() {
    const entries = await Promise.all(
      (Object.keys(agents) as AgentType[]).map(async (id) => ({
        id,
        label: agents[id].displayName,
        detected: await agents[id].detectInstalled(),
      }))
    );
    return entries;
  }
}
