import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('skill-cui package', () => {
  const packageDir = join(import.meta.dirname, '..', 'packages', 'skill-cui');

  it('defines a standalone npx executable package', () => {
    const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf-8'));

    expect(pkg.name).toBe('skill-cui');
    expect(pkg.bin).toEqual({ 'skill-cui': './bin/skill-cui.mjs' });
    expect(pkg.dependencies).toEqual({ cui: '^0.0.10' });
  });

  it('ships the executable and does not import private skills internals', () => {
    const binPath = join(packageDir, 'bin', 'skill-cui.mjs');
    const source = readFileSync(binPath, 'utf-8');

    expect(existsSync(binPath)).toBe(true);
    expect(source).toContain('npx');
    expect(source).toContain('skills');
    expect(source).not.toContain("from '../../src");
    expect(source).not.toContain("from '../src");
  });
});
