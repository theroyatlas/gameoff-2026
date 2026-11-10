import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { modulePreload: false, assetsInlineLimit: 100000 },
  plugins: [{
    name: 'standalone-html',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const [name, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.isEntry) {
          source = source.replace(/<script\b[^>]*src="[^"]+"[^>]*><\/script>/,
            () => `<script type="module">${item.code.replace(/<\/script/gi, '<\\/script')}</script>`);
          delete bundle[name];
        } else if (item.type === 'asset' && name.endsWith('.css')) {
          source = source.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/,
            () => `<style>${String(item.source)}</style>`);
          delete bundle[name];
        }
      }
      html.source = source;
    }
  }]
});
