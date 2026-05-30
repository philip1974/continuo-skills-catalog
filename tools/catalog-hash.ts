// Hash recompute tool. Reads catalog.json, iterates entries, fetches each
// repo at declared SHA, computes canonical tree-hash (Plan 04 §A spec)
// over subpath/SKILL.md (v0.1 SKILL.md-only policy), writes back to entry.hash.
//
// Run: pnpm tsx tools/catalog-hash.ts [--verify|--write]
//   --verify: assert each entry.hash matches recomputed; exit 1 on mismatch (CI)
//   --write: replace entry.hash with recomputed (PR helper)
//   default (no flag): print diff, exit 1 if any mismatch
//
// Canonical tree-hash spec (mirror Plan 04 §A canonical form):
// SHA-256 over: UTF-8 bytes of (filePath + "\0" + fileContentBytes + "\0")
// iterated lexicographically sorted entries.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface CatalogEntry {
  id: string;
  name: string;
  description?: string;
  version?: string;
  gitUrl: string;
  sha: string;
  hash: string;
  subpath?: string;
}

interface CatalogIndex {
  schemaVersion: number;
  generatedAt: string;
  seedPhase?: boolean;
  entries: CatalogEntry[];
}

const PLACEHOLDER = 'TBD-AT-OP6';

function computeEntryHash(entry: CatalogEntry): string {
  if (entry.sha === '0'.repeat(40)) {
    return PLACEHOLDER;
  }

  const tmp = mkdtempSync(join(tmpdir(), 'catalog-hash-'));
  try {
    const init = spawnSync('git', ['init', tmp], { encoding: 'utf-8' });
    if (init.status !== 0) throw new Error('git init failed: ' + init.stderr);

    const fetch = spawnSync(
      'git',
      ['fetch', '--depth', '1', entry.gitUrl, entry.sha],
      { cwd: tmp, encoding: 'utf-8' },
    );
    if (fetch.status !== 0) {
      throw new Error(`git fetch failed for ${entry.id}: ${fetch.stderr}`);
    }

    const subpath = entry.subpath || '';
    const ls = spawnSync('git', ['ls-tree', '-r', 'FETCH_HEAD', subpath || '.'], {
      cwd: tmp,
      encoding: 'utf-8',
    });
    if (ls.status !== 0) {
      throw new Error(`git ls-tree failed for ${entry.id}: ${ls.stderr}`);
    }

    const lines = ls.stdout
      .trim()
      .split('\n')
      .filter((line) => line)
      .map((line) => {
        const match = line.match(/^\d+\s+blob\s+([0-9a-f]+)\s+(.+)$/);
        return match ? { sha: match[1], path: match[2] } : null;
      })
      .filter((item): item is { sha: string; path: string } => item !== null);

    const filtered = lines.filter((entryLine) =>
      /(?:^|\/)SKILL\.md$/.test(entryLine.path),
    );
    if (filtered.length === 0) {
      throw new Error(`no SKILL.md in ${entry.id} subpath=${subpath}`);
    }

    filtered.sort((a, b) => a.path.localeCompare(b.path));
    const hash = createHash('sha256');
    for (const file of filtered) {
      const blob = spawnSync('git', ['cat-file', 'blob', file.sha], {
        cwd: tmp,
        encoding: 'buffer',
      });
      if (blob.status !== 0) {
        throw new Error(`git cat-file failed for ${file.sha}: ${blob.stderr}`);
      }
      hash.update(Buffer.from(file.path, 'utf-8'));
      hash.update(Buffer.from([0]));
      hash.update(blob.stdout);
      hash.update(Buffer.from([0]));
    }
    return hash.digest('hex');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function main(): void {
  const mode = process.argv[2] || '--diff';
  const path = 'catalog.json';
  const catalog: CatalogIndex = JSON.parse(readFileSync(path, 'utf-8'));
  let anyChange = false;
  const seedPhase = catalog.seedPhase === true;

  for (const entry of catalog.entries) {
    const computed = computeEntryHash(entry);
    if (computed !== entry.hash) {
      anyChange = true;
      console.log(`[${entry.id}] declared=${entry.hash} computed=${computed}`);
      if (mode === '--write') entry.hash = computed;
    }
  }

  if (mode === '--write' && anyChange) {
    writeFileSync(path, JSON.stringify(catalog, null, 2) + '\n');
    console.log('wrote catalog.json with recomputed hashes');
  }

  if (mode === '--verify' && anyChange && !seedPhase) {
    console.error('VERIFY FAIL: hash mismatch detected (seedPhase=false)');
    process.exit(1);
  }

  if (mode === '--diff' && anyChange && !seedPhase) {
    process.exit(1);
  }

  if (seedPhase) console.log('(seedPhase=true -> mismatch warnings ok)');
}

main();
