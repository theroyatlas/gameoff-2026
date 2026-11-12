import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const repo = resolve(import.meta.dirname, '..'), out = resolve(repo, '../review-mobile-card');
await mkdir(out, { recursive: true });
const result = await build({ entryPoints: [resolve(import.meta.dirname, 'audio-offline.ts')], bundle: true, format: 'iife', platform: 'browser', write: false });
const html = resolve(out, 'audio-harness.html');
await writeFile(html, `<!doctype html><meta charset="utf-8"><title>Offline audio measurement</title><script>${result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = { console: [], page: [], external: [] }, rows = [], dense = [];
let browserVersion;
try {
  browserVersion = browser.version();
  const context = await browser.newContext();
  await context.route(/^https?:/, r => { errors.external.push(r.request().url()); return r.abort(); });
  const page = await context.newPage();
  page.on('console', m => errors.console.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => errors.page.push(e.message));
  await page.goto(pathToFileURL(html).href);
  const names = await page.evaluate(() => window.audioCases);
  for (let i = 0; i < names.length; i++) {
    rows.push(await page.evaluate(i => window.measureAudioCase(i), i));
    if (i % 30 === 0) console.log(`audio ${i + 1}/${names.length}`);
  }
  for (const family of ['shiny', 'wood']) for (const cage of [null, 'a', 'b', 'c']) for (const pan of [0, .85]) {
    dense.push(await page.evaluate(({ family, cage, pan }) => window.measureDense(family, cage, pan), { family, cage, pan }));
  }
  assert.deepEqual(errors, { console: [], page: [], external: [] });
} finally { await browser.close(); }
const fields = ['name', 'category', 'speed', 'strength', 'sample_peak_dbfs', 'true_peak_dbtp', 'rms_dbfs', 'lufs_full', 'lufs_integrated', 'duration_seconds', 'voices'];
const fmt = v => typeof v === 'number' ? Number.isInteger(v) ? String(v) : v.toFixed(6) : String(v);
await writeFile(resolve(out, 'audio-levels.csv'), fields.join(',') + '\n' + rows.map(r => fields.map(k => fmt(r[k])).join(',')).join('\n') + '\n');
const sorted = [...rows].sort((a, b) => b.lufs_full - a.lufs_full), loud = sorted[0], quiet = sorted.at(-1);
const peak = [...rows].sort((a, b) => b.true_peak_dbtp - a.true_peak_dbtp)[0];
const worst = [...dense].sort((a, b) => b.first_second.sample_peak_dbfs - a.first_second.sample_peak_dbfs)[0];
const over = rows.filter(r => r.true_peak_dbtp > -1);
const categories = [...new Set(rows.map(r => r.category))].map(category => {
  const values = rows.filter(r => r.category === category);
  // 同類案例等權重，先平均線性能量，再換回 LUFS；不是直接平均 dB。
  return { category, count: values.length, lufs: 10 * Math.log10(values.reduce((s, r) => s + 10 ** (r.lufs_full / 10), 0) / values.length) };
});
const audioSha256 = createHash('sha256').update(await readFile(resolve(repo, 'drafts/3d-web/board-audio.ts'))).digest('hex');
const data = { browserVersion, sampleRate: 48000, audioSha256, rows: rows.length, loud, quiet, differenceLU: loud.lufs_full - quiet.lufs_full, peak, overMinus1dBTP: over, worst, categories, dense, errors };
await writeFile(resolve(out, 'audio-summary.json'), JSON.stringify(data, null, 2) + '\n');
const n = v => v.toFixed(2);
await writeFile(resolve(out, 'AUDIO-LEVELS.md'), `# 共振桌音效離線量測\n\n## 已查證\n\n- 引擎：Edge ${browserVersion} 的 OfflineAudioContext，48 kHz、立體聲、浮點波形；${rows.length} 個單音案例、${dense.length} 個密集重疊案例。沒有播放到音效裝置。\n- 原始音效檔 SHA-256：\`${audioSha256}\`。量測直接 bundle 原檔，不改主音量、音效參數、殘響或壓縮器。\n- 最響（短音效全段 K 權重）：\`${loud.name}\`，${n(loud.lufs_full)} LUFS；最輕：\`${quiet.name}\`，${n(quiet.lufs_full)} LUFS；差距 ${n(loud.lufs_full - quiet.lufs_full)} dB。\n- 最高 true peak：\`${peak.name}\`，${n(peak.true_peak_dbtp)} dBTP；超過 −1 dBTP：${over.length} 個。\n- 最密一秒最高主輸出取樣峰值：${n(worst.first_second.sample_peak_dbfs)} dBFS，true peak ${n(worst.first_second.true_peak_dbtp)} dBTP（\`${worst.name}\`）；${worst.first_second.sample_peak_dbfs > 0 ? '超過 0 dBFS，符合本次爆音判準' : '沒有超過 0 dBFS，未達本次爆音判準'}。包含尾音的全段峰值 ${n(Math.max(...dense.map(r => r.sample_peak_dbfs)))} dBFS。\n- console、page error、外部請求：0／0／0。\n\n| 類別 | 案例數 | 平均響度 LUFS |\n|---|---:|---:|\n${categories.map(c => `| ${c.category} | ${c.count} | ${n(c.lufs)} |`).join('\n')}\n\n## 方法與推論\n\n- 重跑：在 repo 根目錄執行 \`node tools/measure-audio.mjs\`。輸出到 \`../review-mobile-card/\`。CSV：\`audio-levels.csv\`；所有密集案例：\`audio-summary.json\`。\n- 依 [ITU-R BS.1770-5](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en) Annex 1 的兩級 K 權重及左右聲道各 1 的能量加總；Annex 2 的 4 相、12 taps/相 FIR 估算 true peak，含前後零填補。\n- CSV 的 \`lufs_full\` 是短音效整段 −0.691 + 10 log10(K 權重雙聲道能量和)，本摘要採這個口徑。另列 \`lufs_integrated\`：400 ms 區塊、75% 重疊、−70 LUFS 絕對閘及 −10 LU 相對閘；不足 400 ms 才退回整段。\n- 全段區間從呼叫時刻起，到最後一個音源 stop 加 1.1 s 殘響及 20 ms 餘裕；包含衰減與尾音，不以音量閾值裁切。\`duration_seconds\` 就是這段長度；RMS 是此區間左右聲道平方的平均。\n- 碰撞速度用規則單位 px/s：0、950、1900，對應 \`impactStrength\` 的零點、中點、飽和端點。0 是合成器最小力度邊界，不代表遊戲會產生零速度撞擊。涵蓋兩組球材質、三個材質編號、球球有序組合、牆、核心、原籠及 a/b/c 籠。碰撞 seed 固定 17、pan 0。\n- 其餘案例包含擲骰兩種、走格與落格 0–5、SURGE、三材質 TUNE、繞圈、抽卡/翻卡/蓋章三版、獎勵六主音、連鎖 0–10 的普通及加倍、跳字、收尾與所有 play() 有聲事件。\n- 密集一秒是合成壓力情境：每秒 60 畫面，每畫面嘗試六次最大速碰撞、跳字；每六畫面一個加倍連鎖，加相變與抽卡系列。保留真實 40/64 聲部上限及每畫面碰撞限制；兩組球材質 × 四種籠 × 中央/偏右聲像，共 16 案。記錄壓縮器後輸出。\n- 類別平均先將各案例 LUFS 換成線性能量，等權平均後再換回 dB；不代表實際遊玩出現頻率。\n\n## 不確定\n\n- 密集測試是明確排程的壓力模擬，不是所有可能遊戲排程的數學最大值，也不是錄製真人遊玩。\n- True peak 為 4 倍 FIR 估值，非無限頻寬精確重建；量測器有 997 Hz 響度及取樣間峰值測試，未執行完整 BS.2217 認證素材。\n- 瀏覽器、硬體輸出、系統音量與耳機可能影響實際聽感；本次未做主觀音量平衡，未調整任何聲音。\n`);
console.log(JSON.stringify({ rows: rows.length, loud: loud.name, loudLUFS: loud.lufs_full, quiet: quiet.name, quietLUFS: quiet.lufs_full, differenceLU: data.differenceLU, peak: peak.true_peak_dbtp, over: over.length, densePeak: worst.first_second.sample_peak_dbfs, denseTP: worst.first_second.true_peak_dbtp }));
