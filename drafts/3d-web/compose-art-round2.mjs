// 把 raw/ 的單張截圖排成並排圖：a、b、c 由左到右，上方標版本代號。只排版，不重繪畫面。
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const out = resolve(import.meta.dirname, '../../../review-art-round2'), raw = resolve(out, 'raw');
const capture = JSON.parse(await readFile(resolve(raw, 'capture.json'), 'utf8'));
const img = f => pathToFileURL(resolve(raw, f)).href;
const LABEL = { ui: ['a 紙卡', 'b 胡桃木框', 'c 毛線與暖光'], cage: ['a 鐵絲籠', 'b 毛線木樁籠', 'c 紙卡燈籠'], card: ['a 手繪紙卡', 'b 印刷卡', 'c 胡桃木黃銅牌'] };
const page = (body, width) => `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#120b06;color:#e8dcc2;font:700 22px "Microsoft JhengHei",sans-serif;width:${width}px}.row{display:flex;gap:12px;padding:0 12px 12px}.col{display:flex;flex-direction:column;gap:6px}.lab{padding:10px 4px 2px}h2{font-size:18px;margin:0;padding:10px 12px 0;color:#cdbb98}.crop{overflow:hidden;position:relative;border:2px solid #5a3a22}.crop img{position:absolute}</style>${body}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function shoot(html, width, file) {
  const p = await browser.newPage({ viewport: { width, height: 400 } }); const tmp = resolve(raw, '_compose.html');
  await writeFile(tmp, html); await p.goto(pathToFileURL(tmp).href); await p.waitForLoadState('load');
  await p.screenshot({ path: resolve(out, file), fullPage: true }); await p.close();
}
for (const [device, w, h] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
  const suffix = device === 'desktop' ? '' : '-mobile', width = w * 3 + 48;
  for (const group of ['ui', 'cage', 'card']) {
    let body = `<div class="row">${['a', 'b', 'c'].map((v, i) => `<div class="col"><div class="lab">${LABEL[group][i]}　?${group}=${v}</div><img src="${img(`${group}-${v}-${device}.png`)}" width="${w}" height="${h}"></div>`).join('')}</div>`;
    if (group === 'cage') {
      // 同一張截圖裡的怪物籠局部放大 3 倍（位置取自規則座標投影），方便對照實際大小。
      const z = 3, cw = Math.round(w / 3), ch = device === 'desktop' ? 220 : 200;
      body += `<h2>同一張截圖的局部放大 ×${z}（上面是實際大小）</h2><div class="row">${['a', 'b', 'c'].map(v => {
        const shot = capture.files.find(f => f.file === `raw/cage-${v}-${device}.png`), m = shot.cagesOnScreen.at(-1);
        return `<div class="crop" style="width:${w}px;height:${ch * 1.5}px"><img src="${img(`cage-${v}-${device}.png`)}" style="width:${w * z}px;left:${-(m.x * z - w / 2)}px;top:${-(m.y * z - ch * .75)}px"></div>`; }).join('')}</div>`;
    }
    await shoot(page(body, width), width, `sheet-${group}${suffix}.png`);
  }
}
// 卡面特寫：三版各六張，以程式產生的原尺寸卡面一半大小排列。
const names = ['多留一發', '換個材質', '鐘慢一拍', '雙倍共鳴', '即刻釋放', '輕敲核心'];
const faces = ['a', 'b', 'c'].map((v, r) => `<div class="lab" style="padding-left:12px">${LABEL.card[r]}　?card=${v}</div><div class="row">${names.map((_, i) => `<img src="${img(`face-${v}-${i}.png`)}" width="180" height="252">`).join('')}</div>`).join('');
await shoot(page(faces, 6 * 180 + 5 * 12 + 24), 6 * 180 + 5 * 12 + 24, 'sheet-card-closeup.png');
// 抽卡展示特寫：同一張截圖裡卡片周圍放大 2 倍，桌面、手機各一張。
for (const [device, w, h] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
  const z = 2, pad = 34, cells = ['a', 'b', 'c'].map(v => {
    const r = capture.files.find(f => f.file === `raw/card-${v}-${device}.png`).cardRect, cw = (r.w + pad * 2) * z, ch = (r.h + pad * 2) * z;
    return { v, html: `<div class="col"><div class="lab">${LABEL.card[['a', 'b', 'c'].indexOf(v)]}</div><div class="crop" style="width:${cw}px;height:${ch}px"><img src="${img(`card-${v}-${device}.png`)}" style="width:${w * z}px;left:${-(r.x - pad) * z}px;top:${-(r.y - pad) * z}px"></div></div>`, cw };
  });
  const width = cells.reduce((a, c) => a + c.cw + 12, 24);
  await shoot(page(`<h2>抽卡展示停在蓋章後 0.18 秒（雙倍共鳴），截圖局部放大 ×${z}</h2><div class="row">${cells.map(c => c.html).join('')}</div>`, width), width, `sheet-card-reveal-closeup${device === 'desktop' ? '' : '-mobile'}.png`);
}
await browser.close();
console.log('ok');
