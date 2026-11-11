// 把挑選截圖拼成一張總覽 overview.png（同資料夾）。只讀本機 PNG，不連網。
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const dir = resolve(process.argv[2]);
const rows = [];
for (const g of ['ball', 'icon', 'light']) for (const ring of ['plain', 'ring']) rows.push({ label: `${g} · ${ring === 'ring' ? '有外圈' : '無外圈'}`, files: ['a', 'b', 'c'].map(v => `${g}-${v}-${ring}.png`) });
rows.splice(2, 0, { label: 'ball · 2 倍特寫（無外圈）', files: ['a', 'b', 'c'].map(v => `ball-${v}-plain-closeup.png`) });
const img = async f => `data:image/png;base64,${(await readFile(resolve(dir, f))).toString('base64')}`;
let html = '<body style="margin:0;background:#120b06;color:#efe3c8;font:15px \'Microsoft JhengHei\',system-ui;padding:16px;width:1328px">';
for (const r of rows) {
  html += `<div style="margin:6px 0 4px">${r.label}</div><div style="display:flex;gap:8px">`;
  for (const [i, f] of r.files.entries()) html += `<figure style="margin:0;width:432px"><img src="${await img(f)}" style="width:432px;display:block"><figcaption style="font-size:13px;color:#bfa98a">${'abc'[i]} · ${f}</figcaption></figure>`;
  html += '</div>';
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try { const page = await browser.newPage({ viewport: { width: 1360, height: 800 } }); await page.setContent(html + '</body>'); await page.screenshot({ path: resolve(dir, 'overview.png'), fullPage: true }); }
finally { await browser.close(); }
