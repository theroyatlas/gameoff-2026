// 風格一挑選截圖：同一局相變當下，切換三組外觀各截一張。輸出到 repo 外的資料夾（argv[2]）。
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const out = resolve(process.argv[2] ?? 'shots-style1'); await mkdir(out, { recursive: true });
const entry = pathToFileURL(resolve(import.meta.dirname, 'dist-style1/index.html')).href;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const DEFAULT = { ball: 'b', icon: 'a', light: 'a' };
const errors = [];

async function playUntilShift(page) {
  await page.waitForSelector('#scene[data-ready=true]', { timeout: 90000 });
  await page.locator('#start').click();
  let next = 1, shot = 0, warmed = false;
  while (true) {
    const s = await page.evaluate(() => window.studyEvidence.timing());
    // 球上場後先輪過三種球材質一次，讓 shader 在相變前就編譯好。
    if (!warmed && s.seconds > 4) { for (const ball of ['a', 'c', 'b']) { await page.evaluate(b => window.styleLab.set({ ball: b }), ball); await page.waitForTimeout(250); } warmed = true; }
    if (s.phase === 'active') return s;
    if (s.seconds > 400) throw new Error('no shift within 400s');
    if (s.seconds >= next) {
      const a = -Math.PI / 2 + Math.sin(shot) * .6, p = await page.evaluate(a => ({ start: window.studyEvidence.project(400, 622), end: window.studyEvidence.project(400 + Math.cos(a) * 180, 622 + Math.sin(a) * 180) }), a);
      await page.mouse.move(p.start.x, p.start.y); await page.mouse.down(); await page.mouse.move(p.end.x, p.end.y, { steps: 2 }); await page.mouse.up(); shot++; next += shot < 32 ? .8 : 2;
    }
    await page.waitForTimeout(70);
  }
}
async function session(ring, viewport, shots) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${ring}:${e.message}`)); page.on('console', m => { if (m.type() === 'error') errors.push(`${ring}:${m.text()}`); });
  await context.route(/^https?:/, r => { errors.push(`request ${r.request().url()}`); return r.abort(); });
  await page.goto(`${entry}?lab=1${ring ? '&ring=1' : ''}`);
  // 先預熱三種球材質的 shader，避免相變時切換卡頓吃掉相變時間。
  const at = await playUntilShift(page); const taken = [];
  for (const [file, choice] of shots) {
    await page.evaluate(c => window.styleLab.set(c), { ...DEFAULT, ...choice });
    await page.waitForTimeout(140);
    const t = await page.evaluate(() => window.studyEvidence.timing());
    await page.screenshot({ path: resolve(out, file) }); taken.push({ file, choice: { ...DEFAULT, ...choice, ring }, phase: t.phase, seconds: t.seconds });
  }
  await context.close(); return { ring, shiftAt: at.seconds, taken };
}
const groups = []; for (const g of ['ball', 'icon', 'light']) for (const v of ['a', 'b', 'c']) groups.push([g, v]);
const plan = ring => groups.map(([g, v]) => [`${g}-${v}-${ring ? 'ring' : 'plain'}.png`, { [g]: v }]);
try {
  // 每組 a／b／c 在同一局、同一次相變裡連拍，彼此可比；不同組來自不同局。
  const jobs = [];
  // 預設組合單獨一局，避免一局連拍太多張而拍到相變結束後。ONLY=ball-plain 之類可只重拍一組。
  const named = [['default', () => session(false, { width: 1280, height: 720 }, [['default-desktop-1280x720.png', {}]])]];
  for (const ring of [false, true]) for (const g of ['ball', 'icon', 'light']) named.push([`${g}-${ring ? 'ring' : 'plain'}`, () => session(ring, { width: 1280, height: 720 }, plan(ring).filter(([f]) => f.startsWith(g)))]);
  named.push(['mobile', () => session(false, { width: 390, height: 844 }, [['default-mobile-390x844.png', {}]])]);
  for (const [name, job] of named) if (!process.env.ONLY || process.env.ONLY.split(',').includes(name)) jobs.push(job);
  const results = [];
  for (let i = 0; i < jobs.length; i += 4) results.push(...await Promise.all(jobs.slice(i, i + 4).map(j => j())));
  await mkdir(resolve(import.meta.dirname, '../../artifacts/3d-style1'), { recursive: true }); await writeFile(resolve(import.meta.dirname, '../../artifacts/3d-style1/capture-log.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ errors, results: results.map(r => ({ ring: r.ring, shiftAt: r.shiftAt, phases: r.taken.map(t => t.phase) })) }));
} finally { await browser.close(); }
