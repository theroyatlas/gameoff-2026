import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root, base: './',
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  build: { outDir: fileURLToPath(new URL('./dist', import.meta.url)), modulePreload: false,
    assetsInlineLimit: 10000000, minify: 'esbuild', rollupOptions: { output: { inlineDynamicImports: true } } },
  plugins: [{ name: 'offline-single-html', enforce: 'post', generateBundle(_, bundle) {
    const html = bundle['index.html'];
    if (!html || html.type !== 'asset') throw new Error('Missing HTML entry');
    let source = String(html.source);
    for (const [name, item] of Object.entries(bundle)) {
      if (item.type === 'chunk' && item.isEntry) {
        source = source.replace(/<script\b[^>]*src="[^"]+"[^>]*><\/script>/,
          () => `<script type="module">${item.code.replace(/<\/script/gi, '<\\/script')}</script>`);
        delete bundle[name];
      } else if (item.type === 'asset' && name.endsWith('.css')) {
        source = source.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/, () => `<style>${String(item.source)}</style>`);
        delete bundle[name];
      }
    }
    html.source = source;
  } }],
});
