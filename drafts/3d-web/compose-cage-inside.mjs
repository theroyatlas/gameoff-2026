// 把 review-cage-inside/raw 的單張截圖排成並排圖。只排版，不重繪畫面。
import { chromium } from 'playwright';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const out = resolve(import.meta.dirname, '../../../review-cage-inside'), raw = resolve(out, 'raw');
const capture = JSON.parse(await readFile(resolve(raw, 'capture.json'), 'utf8'));
const img = f => pathToFileURL(resolve(raw, f)).href;
const LABEL = { a: 'a 紅漆木偶怪', b: 'b 毛線團怪', c: 'c 紙摺怪' };
const page = (body, width) => `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#120b06;color:#e8dcc2;font:700 22px "Microsoft JhengHei",sans-serif;width:${width}px}.row{display:flex;gap:12px;padding:0 12px 12px}.col{display:flex;flex-direction:column;gap:6px}.lab{padding:10px 4px 2px}.sub{font-size:16px;color:#cdbb98;padding:2px 4px}h2{font-size:18px;margin:0;padding:10px 12px 4px;color:#cdbb98}.crop{overflow:hidden;position:relative;border:2px solid #5a3a22}.crop img{position:absolute;image-rendering:pixelated}.frames{display:flex;gap:8px}.frame{display:flex;flex-direction:column;gap:4px;font-size:15px;color:#cdbb98}.frame img{border:2px solid #5a3a22}</style>${body}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const tmp = resolve(raw, '_compose.html');
async function shoot(html, width, file) {
  const p = await browser.newPage({ viewport: { width, height: 400 } });
  await writeFile(tmp, html); await p.goto(pathToFileURL(tmp).href); await p.waitForLoadState('load');
  await p.screenshot({ path: resolve(out, file), fullPage: true }); await p.close();
}
// 1) 整桌鏡頭並排：上排實際大小，下排同一張截圖兩隻怪物籠各自局部放大 ×3（位置取自規則座標投影）。
for (const [device, w, h] of [['desktop', 1280, 720], ['mobile', 390, 844]]) {
  const z = 3, width = w * 3 + 48, sw = device === 'desktop' ? 140 : 130, sh = device === 'desktop' ? 100 : 90;
  let body = `<h2>同一盤面（seed 20261111，第 22 發後）、同一整桌鏡頭、六項預設組合，只換 ?inside=。上排是實際大小。</h2><div class="row">${['a', 'b', 'c'].map(v => `<div class="col"><div class="lab">${LABEL[v]}　?inside=${v}</div><img src="${img(`inside-${v}-${device}.png`)}" width="${w}" height="${h}"></div>`).join('')}</div>`;
  body += `<h2>同一張截圖的局部放大 ×${z}（兩隻怪物籠各一格）</h2><div class="row">${['a', 'b', 'c'].map(v => {
    const shot = capture.files.find(f => f.file === `raw/inside-${v}-${device}.png`);
    const crops = shot.cagesOnScreen.map(m => `<div class="crop" style="width:${sw * z}px;height:${sh * z}px"><img src="${img(`inside-${v}-${device}.png`)}" style="width:${w * z}px;left:${-(m.x - sw / 2) * z}px;top:${-(m.y - sh * .6) * z}px"></div>`).join('');
    return `<div class="col" style="width:${w}px;${device === 'desktop' ? 'flex-direction:row;gap:12px' : ''}">${crops}</div>`;
  }).join('')}</div>`;
  await shoot(page(body, width), width, `sheet-inside${device === 'desktop' ? '' : '-mobile'}.png`);
}
// 2) 受傷與擊破的反應對照：三版各一格；每格上排一般動態四個時刻、下排減少動態三個時刻。
const NAMES = { idle: '平常（滿血）', hit: '受傷後 0.07 秒', low: '血量剩 20%', defeat: '擊破後 0.55 秒' };
const RNAMES = { hit: '受傷（換姿勢，0.35 秒）', low: '血量剩 20%', defeat: '擊破（直接換倒下姿勢）' };
const fw = 255, fh = 225;
const cells = ['a', 'b', 'c'].map(v => `<div class="col" style="padding:0 12px 14px"><div class="lab">${LABEL[v]}　?inside=${v}</div>
  <div class="sub">一般動態</div><div class="frames">${['idle', 'hit', 'low', 'defeat'].map(n => `<div class="frame"><img src="${img(`react-${v}-full-${n}.png`)}" width="${fw}" height="${fh}">${NAMES[n]}</div>`).join('')}</div>
  <div class="sub">減少動態（只換姿勢、表情，不播動畫）</div><div class="frames">${['hit', 'low', 'defeat'].map(n => `<div class="frame"><img src="${img(`react-${v}-reduce-${n}.png`)}" width="${fw}" height="${fh}">${RNAMES[n]}</div>`).join('')}</div></div>`).join('');
const rw = fw * 4 + 8 * 3 + 24 + 8;
await shoot(page(`<h2>籠內反應對照（同一盤面、同一隻怪物；截圖專用近景鏡頭，與整桌同為 45° 俯角）</h2>${cells}`, rw), rw, 'sheet-inside-react.png');
await rm(tmp, { force: true });
await browser.close();
console.log('ok');
