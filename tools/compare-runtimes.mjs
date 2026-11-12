import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '..'), out = resolve(root, '../review-closeup-ab');
await mkdir(out, { recursive: true });
const bundled = await build({ entryPoints: [resolve(root, 'tools/determinism-probe.ts')], bundle: true,
  format: 'iife', globalName: 'probe', write: false, target: 'es2022', minify: false });
const code = bundled.outputFiles[0].text;
await writeFile(resolve(out, 'determinism-probe.js'), code);
await writeFile(resolve(out, 'determinism-probe.html'), '<!doctype html><meta charset="utf-8"><title>共振桌規則重播比對</title><script>' + code + '</script>');
const probe = new Function(code + ';return probe')();
const reference = JSON.parse(await readFile(resolve(root, '../review-event-cards/events-300.json'), 'utf8'));
const recording = reference.rows.find(r => r.seed === Number(process.argv[2] ?? 20261113) && r.bot === (process.argv[3] ?? 'lazy'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(resolve(out, 'determinism-probe.html')).href);
  const options = { seed: recording.seed, recording, hashes: true };
  console.log('逐 tick 比對開始');
  const node = probe.run(options);
  const edge = await page.evaluate(o => probe.run(o), options);
  const nodeRepeat = probe.run({ ...options, hashes: false });
  const edgeRepeat = await page.evaluate(o => probe.run(o), { ...options, hashes: false });
  const repeated = { node: JSON.stringify(node.snapshot) === JSON.stringify(nodeRepeat.snapshot),
    edge: JSON.stringify(edge.snapshot) === JSON.stringify(edgeRepeat.snapshot) };
  if (!repeated.node || !repeated.edge) throw new Error('同環境固定輸入重跑不一致');
  for (const [name, result] of [['node', node], ['edge', edge]]) {
    await writeFile(resolve(out, `${name}-tick-hashes.csv`), 'tick,hash\n' + result.hashes.map(r => `${r.tick},${r.hash}`).join('\n') + '\n');
    await writeFile(resolve(out, `${name}-final.json`), JSON.stringify(result.snapshot));
  }
  const index = node.hashes.findIndex((r, i) => r.hash !== edge.hashes[i]?.hash);
  const tick = index < 0 ? null : node.hashes[index].tick;
  let first = null;
  function differences(a, b, path = '', list = []) {
    if (Object.is(a, b)) return list;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) differences(a[key], b[key], path ? `${path}.${key}` : key, list);
    } else list.push({ field: path, node: a, edge: b, delta: typeof a === 'number' && typeof b === 'number' ? b - a : null });
    return list;
  }
  if (tick !== null) {
    const beforeNode = probe.run({ ...options, hashes: false, stopAt: tick - 1 });
    const beforeEdge = await page.evaluate(o => probe.run(o), { ...options, hashes: false, stopAt: tick - 1 });
    const atNode = probe.run({ ...options, hashes: false, stopAt: tick });
    const atEdge = await page.evaluate(o => probe.run(o), { ...options, hashes: false, stopAt: tick });
    first = { tick, differences: differences(atNode.snapshot, atEdge.snapshot), precedingEqual: JSON.stringify(beforeNode.snapshot) === JSON.stringify(beforeEdge.snapshot) };
    const args = { state: beforeNode.snapshot.randomState, count: beforeNode.snapshot.balls.length };
    const nodeWake = probe.wakeSamples(args.state, args.count);
    const edgeWake = await page.evaluate(a => probe.wakeSamples(a.state, a.count), args);
    first.wakeMathDifferences = differences(nodeWake, edgeWake);
    await writeFile(resolve(out, 'wake-math-samples.json'), JSON.stringify({ node: nodeWake, edge: edgeWake }, null, 2));
    await writeFile(resolve(out, 'first-divergence-states.json'), JSON.stringify({ beforeNode: beforeNode.snapshot, beforeEdge: beforeEdge.snapshot, node: atNode.snapshot, edge: atEdge.snapshot }, null, 2));
  }
  const summary = { node: { version: process.version, v8: process.versions.v8, status: node.status, tick: node.tick, stalled: node.stalled },
    edge: { version: browser.version(), userAgent: await page.evaluate(() => navigator.userAgent), status: edge.status, tick: edge.tick, stalled: edge.stalled },
    reference: { seed: recording.seed, bot: recording.bot, tick: recording.ticks }, first,
    math: { node: probe.mathSamples(), edge: await page.evaluate(() => probe.mathSamples()) }, repeated, errors };
  await writeFile(resolve(out, 'runtime-comparison.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  if (!process.argv.includes('--trace-only')) {
  const rows = [];
  for (let seed = 20261111; seed <= 20261120; seed++) {
    for (const bot of ['random', 'greedy', 'lazy']) {
      const options = { seed, bot };
      const node = probe.run(options), edge = await page.evaluate(o => probe.run(o), options);
      rows.push({ seed, bot, node: node.status, edge: edge.status, sameOutcome: node.status === edge.status,
        nodeTick: node.tick, edgeTick: edge.tick, nodeHp: node.bossHp, edgeHp: edge.bossHp });
    }
    console.log(`跨環境 bot：${rows.length}/30`);
  }
  await writeFile(resolve(out, 'cross-runtime-bots.csv'), Object.keys(rows[0]).join(',') + '\n' + rows.map(r => Object.values(r).join(',')).join('\n') + '\n');
  const impact = { gamesPerRuntime: rows.length, nodeWins: rows.filter(r => r.node === 'won').length,
    edgeWins: rows.filter(r => r.edge === 'won').length, outcomeDisagreements: rows.filter(r => !r.sameOutcome).length, rows };
  await writeFile(resolve(out, 'cross-runtime-bots.json'), JSON.stringify(impact, null, 2));
  console.log(JSON.stringify({ ...impact, rows: undefined }));
  }
} finally { await browser.close(); }
