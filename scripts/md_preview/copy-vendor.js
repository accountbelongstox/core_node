/**
 * Copy browser builds of marked and mermaid from node_modules to public/vendor.
 * Run after npm install (postinstall) so the preview works offline.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const nodeModules = path.join(root, 'node_modules');
const vendorDir = path.join(root, 'public', 'vendor');

const copies = [
  { from: path.join(nodeModules, 'marked', 'lib', 'marked.umd.js'), to: 'marked.umd.js' },
  { from: path.join(nodeModules, 'mermaid', 'dist', 'mermaid.min.js'), to: 'mermaid.min.js' },
];

if (!fs.existsSync(nodeModules)) {
  process.exit(0);
}

try {
  if (!fs.existsSync(vendorDir)) {
    fs.mkdirSync(vendorDir, { recursive: true });
  }
  for (const { from, to } of copies) {
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(vendorDir, to));
    }
  }
} catch (err) {
  console.warn('md_preview copy-vendor:', err.message);
}
