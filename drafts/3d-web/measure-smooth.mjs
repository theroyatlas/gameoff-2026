import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const build = process.argv[2] ?? 'dist-smooth', tag = process.argv[3] ?? 'smooth-1';
const diagnostic = process.argv.includes('--diagnostic');
assert(['dist-polish', 'dist-smooth'].includes(build));
const out = resolve(import.meta.dirname, '../../artifacts/3d-smooth');
await mkdir(out, { recursive: true });
const entry = resolve(import.meta.dirname, build, 'index.html');
const sha256 = createHash('sha256').update(await readFile(entry)).digest('hex');
export function stats(frames, predicate) {
  const intervals = [];
  for (let i = 1; i < frames.length; i++) if (predicate(frames[i]) && predicate(frames[i - 1])) intervals.push(frames[i].wall - frames[i - 1].wall);
  const total = intervals.reduce((a, b) => a + b, 0);
  const tail = [...intervals].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(intervals.length * .01)));
  return { frames: intervals.length, seconds: total / 1000, averageFps: 1000 * intervals.length / total, onePercentLow: 1000 * tail.length / tail.reduce((a, b) => a + b, 0), longFrames: intervals.filter(x => x > 50).length };
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', e => errors.push({ type: 'page', message: e.message }));
  page.on('console', m => { if (m.type() === 'error') errors.push({ type: 'console', message: m.text() }); });
  await context.route(/^https?:/, r => { requests.push(r.request().url()); return r.abort(); });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(({ diagnostic }) => {
    window.smoothFrames = []; let costs = {}, counts = {};
    if (diagnostic) for (const name of ['compileShader', 'linkProgram', 'getProgramInfoLog', 'getShaderInfoLog', 'getProgramParameter', 'bufferData', 'bufferSubData', 'deleteBuffer', 'drawElements', 'drawArrays', 'texImage2D']) {
      const proto = WebGL2RenderingContext.prototype, original = proto[name];
      proto[name] = function (...args) {
        const start = performance.now(), result = original.apply(this, args);
        costs[name] = (costs[name] ?? 0) + performance.now() - start; counts[name] = (counts[name] ?? 0) + 1;
        return result;
      };
    }
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => raf.call(window, now => {
      costs = {}; counts = {}; const begin = performance.now();
      callback(now);
      const end = performance.now(), s = window.studyEvidence?.timing();
      if (!s) return;
      const row = { wall: now, begin, end, callbackMs: end - begin, ...s };
      if (diagnostic) {
        const snapshot = window.studyEvidence.snapshot();
        Object.assign(row, { costs, counts, events: snapshot.counts, visuals: { balls: snapshot.visuals.balls, cages: snapshot.visuals.cages, particles: snapshot.visuals.particles }, stages: window.studyEvidence.frameProfile?.() });
      }
      window.smoothFrames.push(row);
    });
  }, { diagnostic });
  await page.goto(pathToFileURL(entry).href + '?quality=low' + (diagnostic ? '&profile=1' : ''));
  await page.waitForSelector('#scene[data-ready=true]', { timeout: 90000 });
  if (diagnostic) {
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,v8', transferMode: 'ReturnAsStream' });
    await page.evaluate(() => console.timeStamp('smooth-clock:' + performance.now()));
  }
  await page.locator('#start').click();
  const gpu = await page.evaluate(() => { const g = document.querySelector('canvas').getContext('webgl2'), e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); });
  for (let i = 0; i < 32; i++) {
    await page.waitForFunction(t => window.studyEvidence.timing().seconds >= t, 1 + i * .8, { polling: 25, timeout: 60000 });
    const p = await page.evaluate(a => ({ start: window.studyEvidence.project(400, 622), end: window.studyEvidence.project(400 + Math.cos(a) * 180, 622 + Math.sin(a) * 180) }), -Math.PI / 2 + Math.sin(i) * .6);
    await page.mouse.move(p.start.x, p.start.y); await page.mouse.down(); await page.mouse.move(p.end.x, p.end.y, { steps: 4 }); await page.mouse.up();
    if (i % 8 === 7) console.log(JSON.stringify({ tag, shots: i + 1 }));
  }
  const calmStart = await page.evaluate(() => window.studyEvidence.timing().seconds + 18);
  await page.waitForFunction(t => window.studyEvidence.timing().seconds >= t, calmStart + 10, { polling: 100, timeout: 120000 });
  const data = await page.evaluate(() => ({ frames: window.smoothFrames, snapshot: window.studyEvidence.snapshot() }));
  if (diagnostic) {
    const { profile } = await cdp.send('Profiler.stop');
    await writeFile(resolve(out, `cpu-${tag}.cpuprofile`), JSON.stringify(profile));
    const finished = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end'); const { stream } = await finished; let raw = '';
    while (true) { const part = await cdp.send('IO.read', { handle: stream }); raw += part.data; if (part.eof) break; }
    await cdp.send('IO.close', { handle: stream }); await writeFile(resolve(out, `trace-${tag}.json`), raw);
  }
  const calm = stats(data.frames, f => f.seconds >= calmStart && f.seconds <= calmStart + 10 && f.phase === 'idle');
  const shift = stats(data.frames, f => f.phase === 'active');
  const result = { build, tag, diagnostic, sha256, browser: browser.version(), gpu, cpuRate: 4, viewport: { width: 1280, height: 950 }, calmStart, calm, shift, errors, requests, ...data };
  await writeFile(resolve(out, `${tag}.json`), JSON.stringify(result));
  console.log(JSON.stringify({ tag, calm, shift, quality: data.snapshot.quality, errors }));
  assert(calm.frames > 100 && shift.frames > 50); assert.equal(data.snapshot.shots, 32);
  assert(data.snapshot.shifts.some(s => s.kind === 'release')); assert.deepEqual(errors, []); assert.deepEqual(requests, []);
} finally { await browser.close(); }
