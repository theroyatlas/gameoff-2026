import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '..');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// 覆蓋只發生在記憶體；未知鍵與型別錯誤直接拒絕，避免拼字錯誤被靜默忽略。
export function mergeConfig(base, overrides, path = 'config') {
  if (!object(overrides)) throw new Error(`${path} 必須是 JSON object`);
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(base, key) || ['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new Error(`${path}.${key} 不是可覆蓋的設定`);
    }
    const original = base[key], name = `${path}.${key}`;
    if (object(original)) result[key] = mergeConfig(original, value, name);
    else if (Array.isArray(original)) {
      // 陣列完整替換；元素依對應位置的 schema 驗證，不偷偷合併舊元素。
      if (!Array.isArray(value) || value.length !== original.length) throw new Error(`${name} 必須保留陣列長度`);
      result[key] = value.map((item, i) => {
        if (object(original[i])) {
          if (!object(item) || Object.keys(original[i]).some(k => !Object.hasOwn(item, k))) throw new Error(`${name}[${i}] 缺少欄位`);
          return mergeConfig(original[i], item, `${name}[${i}]`);
        }
        if (typeof item !== typeof original[i]) throw new Error(`${name}[${i}] 型別不符`);
        return item;
      });
    } else {
      if (typeof value !== typeof original || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`${name} 型別不符或不是有限數字`);
      result[key] = value;
    }
  }
  if (path === 'config' && result.dt <= 0) throw new Error('config.dt 必須大於零');
  return result;
}

export async function buildBalanceBundle(overrides = {}) {
  const configPath = resolve(root, 'src/config.ts');
  const before = await readFile(configPath);
  const baseBuild = await build({ entryPoints: [configPath], bundle: true, write: false, format: 'iife', globalName: 'defaults' });
  const defaults = new Function(`${baseBuild.outputFiles[0].text}; return defaults.CONFIG;`)();
  const config = mergeConfig(defaults, overrides);
  const bundled = await build({
    stdin: { contents: "export { run } from './tools/determinism-probe'; export { CONFIG } from './src/config'; export { BOTS } from './tools/bot-aim';", resolveDir: root },
    bundle: true, write: false, format: 'iife', globalName: 'balance', target: 'es2022', minify: false,
    plugins: [{ name: 'balance-config', setup(builder) {
      builder.onLoad({ filter: /[\\/]src[\\/]config\.ts$/ }, args => {
        if (resolve(args.path) !== configPath) return;
        return { contents: `export const CONFIG = ${JSON.stringify(config)};`, loader: 'js' };
      });
    } }],
  });
  if (!(await readFile(configPath)).equals(before)) throw new Error('src/config.ts 在打包期間被修改');
  const code = bundled.outputFiles[0].text;
  return { code, config, overrides, configSha256: sha256(JSON.stringify(config)),
    overridesSha256: sha256(JSON.stringify(overrides)), sourceConfigSha256: sha256(before), bundleSha256: sha256(code) };
}
