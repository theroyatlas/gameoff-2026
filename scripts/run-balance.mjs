import { createServer } from 'vite';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);
const server = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const { run } = await server.ssrLoadModule('/scripts/balance-sim.ts');
  await run(process.argv.slice(2));
} finally {
  await server.close();
}
