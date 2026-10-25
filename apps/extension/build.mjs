import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
const outdir = path.join(root, 'dist');
const fixture = process.argv.includes('--fixture');

fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

const common = {
  bundle: true,
  target: ['chrome116'],
  legalComments: 'none',
  logLevel: 'info',
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
};

await build({
  ...common,
  entryPoints: [path.join(root, 'src/background.ts')],
  outfile: path.join(outdir, 'background.js'),
  format: 'esm',
});

await build({
  ...common,
  entryPoints: [path.join(root, 'src/content/index.tsx')],
  outfile: path.join(outdir, 'content.js'),
  format: 'iife',
  jsx: 'automatic',
});

const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8'),
);
if (fixture) {
  manifest.content_scripts[0].matches.push('http://127.0.0.1:8899/*');
  manifest.host_permissions.push('http://127.0.0.1:8899/*');
  manifest.name += '（本地测试）';
}
fs.writeFileSync(
  path.join(outdir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

const iconsDir = path.join(root, 'public/icons');
if (fs.existsSync(iconsDir)) {
  fs.cpSync(iconsDir, path.join(outdir, 'icons'), { recursive: true });
}

console.log(`\n扩展已构建：${outdir}${fixture ? '（含本地测试页面）' : ''}`);
