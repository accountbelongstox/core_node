/**
 * Recursively scan directory for qualified files (.md, .mmd), skipping known build/cache dirs.
 */

import fs from 'fs';
import path from 'path';

export function scanQualifiedFiles(rootDir, extensions, skipDirNames) {
  const exts = new Set(extensions.map((e) => e.toLowerCase()));
  const skip = new Set([...skipDirNames].map((d) => d.toLowerCase()));
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const base = e.name.toLowerCase();
      if (e.isDirectory()) {
        if (skip.has(base)) continue;
        walk(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (exts.has(ext)) results.push(full);
      }
    }
  }

  walk(path.resolve(rootDir));
  return results.sort((a, b) => a.localeCompare(b));
}

/**
 * Find first file under root whose path (relative) or filename contains the fragment (case-insensitive).
 * Only considers qualified extensions. Skips skipDirNames.
 */
export function findFirstByFragment(rootDir, fragment, extensions, skipDirNames) {
  const exts = new Set(extensions.map((e) => e.toLowerCase()));
  const skip = new Set([...skipDirNames].map((d) => d.toLowerCase()));
  const needle = fragment.toLowerCase();

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const base = e.name.toLowerCase();
      if (e.isDirectory()) {
        if (skip.has(base)) continue;
        const found = walk(full);
        if (found) return found;
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (!exts.has(ext)) continue;
        const rel = path.relative(rootDir, full);
        if (base.includes(needle) || rel.toLowerCase().includes(needle)) return full;
      }
    }
    return null;
  }

  return walk(path.resolve(rootDir));
}
