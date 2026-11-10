import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const out = resolve(import.meta.dirname, '../../artifacts/3d-smooth');
const tag = process.argv[2] ?? 'diagnostic-before';
const data = JSON.parse(await readFile(resolve(out, `${tag}.json`), 'utf8'));
const trace = JSON.parse(await readFile(resolve(out, `trace-${tag}.json`), 'utf8'));
const clock = trace.traceEvents.find(e => e.name === 'TimeStamp' && e.args?.data?.message?.startsWith('smooth-clock:'));
const offset = clock.ts / 1000 - Number(clock.args.data.message.split(':')[1]);
const gc = trace.traceEvents.filter(e => ['MinorGC', 'MajorGC'].includes(e.name) && e.ph === 'X');
const layouts = trace.traceEvents.filter(e => ['Layout', 'UpdateLayoutTree'].includes(e.name) && e.ph === 'X');
const long = [], all = data.frames;
for (let i = 0; i < all.length - 1; i++) {
  const f = all[i], prev = all[i - 1], interval = all[i + 1].wall - f.wall;
  if (interval <= 50 && f.callbackMs <= 50) continue;
  const events = Object.fromEntries(Object.entries(f.events).map(([k, v]) => [k, v - (prev?.events[k] ?? 0)]).filter(([, v]) => v));
  const overlaps = gc.filter(g => g.ts / 1000 - offset < all[i + 1].begin && (g.ts + g.dur) / 1000 - offset > f.begin);
  const layout = layouts.filter(e => e.ts / 1000 - offset >= f.begin && e.ts / 1000 - offset <= f.end);
  long.push({ frame: i, seconds: f.seconds, phase: f.phase, quality: f.qualityLevel, qualityChange: f.qualityLevel !== prev?.qualityLevel, phaseChange: f.phase !== prev?.phase, intervalMs: interval, callbackMs: f.callbackMs, costs: f.costs, counts: f.counts, events, visuals: f.visuals, newBalls: f.visuals.balls - (prev?.visuals.balls ?? 0), newCages: f.visuals.cages - (prev?.visuals.cages ?? 0), gcMs: overlaps.reduce((a, e) => a + e.dur / 1000, 0), layoutMs: layout.reduce((a,e)=>a+e.dur/1000,0), layoutCount: layout.length, stages: f.stages });
}
const totals = {};
for (const phase of ['idle', 'warning', 'active']) {
  const rows = all.filter(f => f.phase === phase && f.seconds > 0);
  const costs = {}, calls = {};
  for (const f of rows) { for (const [k, v] of Object.entries(f.costs)) costs[k] = (costs[k] ?? 0) + v; for (const [k, v] of Object.entries(f.counts)) calls[k] = (calls[k] ?? 0) + v; }
  totals[phase] = { frames: rows.length, callbackMs: rows.reduce((a, f) => a + f.callbackMs, 0), costs, calls };
}
const profile = JSON.parse(await readFile(resolve(out, `cpu-${tag}.cpuprofile`), 'utf8'));
const self = new Map(); profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + profile.timeDeltas[i] / 1000));
const cpu = profile.nodes.map(n => ({ name: n.callFrame.functionName, line: n.callFrame.lineNumber, selfMs: self.get(n.id) ?? 0 })).sort((a, b) => b.selfMs - a.selfMs).slice(0, 30);
await writeFile(resolve(out, `long-${tag}.json`), JSON.stringify({ totals, cpu, long }, null, 2));
console.log(JSON.stringify({ totals, cpu, longCount: long.length, longest: [...long].sort((a, b) => b.callbackMs - a.callbackMs).slice(0, 18) }));
