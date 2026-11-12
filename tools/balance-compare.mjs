import { fork, spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { buildBalanceBundle, root, sha256 } from './balance-config.mjs';
import { BOTS, gameRow, toCsv, summarize, summaryMarkdown, verifyOutput } from './balance-report.mjs';

const { values } = parseArgs({ options: {
  config: { type: 'string' }, out: { type: 'string' }, 'seed-start': { type: 'string', default: '20261111' },
  'node-seeds': { type: 'string', default: '30' }, 'edge-seeds': { type: 'string', default: '10' },
  'expect-node-wins': { type: 'string' }, verify: { type: 'boolean' }, help: { type: 'boolean' },
} });
if (values.help) {
  console.log('node tools/balance-compare.mjs --config overrides.json --out output [--seed-start 20261111] [--node-seeds 30] [--edge-seeds 10] [--expect-node-wins 35]\nnode tools/balance-compare.mjs --verify --out output');
} else {
  await main().catch(error => { console.error(error.stack ?? String(error)); process.exitCode = 1; });
}

async function main() {
  if (!values.out) throw new Error('必須提供 --out');
  const out = resolve(values.out);
  if (values.verify) { console.log(JSON.stringify({ verified: true, ...await verifyOutput(out) }, null, 2)); return; }
  if (process.platform !== 'win32') throw new Error('資源監測目前需要 Windows，本機 Edge 使用 msedge channel');
  if (!values.config) throw new Error('必須提供 --config（沿用全部預設時檔案內容為 {}）');
  const number = (name, min, max) => {
    const value = Number(values[name]);
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} 必須是 ${min}–${max} 的整數`);
    return value;
  };
  const seedStart = number('seed-start', 0, 0xffffffff);
  const nodeSeeds = number('node-seeds', 1, 500), edgeSeeds = number('edge-seeds', 1, nodeSeeds);
  if (seedStart + nodeSeeds - 1 > 0xffffffff) throw new Error('seed 超出 uint32 範圍');
  const expectedWins = values['expect-node-wins'] === undefined ? null : number('expect-node-wins', 0, nodeSeeds * 3);
  const inside = relative(root, out);
  if (!isAbsolute(inside) && inside !== '..' && !inside.startsWith(`..${sep}`) && !inside.startsWith(`.preview${sep}`)) {
    throw new Error('repo 內輸出只允許已忽略的 .preview 子目錄；請使用 repo 外的新目錄');
  }
  const existing = await readdir(out).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  if (existing.length) throw new Error('輸出目錄非空；請選新目錄以保留先前證據');
  const configText = await readFile(resolve(values.config), 'utf8');
  const overrides = JSON.parse(configText.replace(/^\uFEFF/, ''));
  await mkdir(out, { recursive: true });
  const started = Date.now(), deadline = started + 1740_000;
  const configBefore = await readFile(resolve(root, 'src/config.ts'));
  const run = { schema: 1, status: 'running', startedAt: new Date(started).toISOString(), overrides,
    inputFileSha256: sha256(configText), nodeVersion: process.version, nodeV8: process.versions.v8, edgeVersion: null,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    protocol: { seedStart, nodeSeeds, requestedEdgeSeeds: edgeSeeds, actualEdgeSeeds: 0, bots: BOTS,
      shotIntervalSeconds: 2, maxGameSeconds: 600, budgetSeconds: 1800, monitorStopSeconds: 1740,
      memoryLimitBytes: 4_000_000_000, memoryStopBytes: 3_500_000_000,
      driver: 'tools/determinism-probe.ts run, matching tools/compare-runtimes.mjs', expectedNodeWins: expectedWins },
    warnings: [] };
  const persist = () => writeFile(resolve(out, 'run.json'), JSON.stringify(run, null, 2) + '\n');
  await persist();
  let browser, worker, monitor, monitorExit, monitorFailure;
  const stopPath = resolve(out, '.monitor-stop');
  const resourcePath = resolve(out, 'resources.json');
  try {
    monitor = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
      resolve(root, 'tools/balance-monitor.ps1'), '-RootProcessId', String(process.pid), '-ReportPath', resourcePath,
      '-StopPath', stopPath, '-BudgetSeconds', String((deadline - Date.now()) / 1000)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let monitorError = '';
    monitor.stderr.on('data', data => { monitorError += data; });
    monitorExit = new Promise(resolveExit => {
      monitor.on('error', error => { monitorFailure = error; resolveExit(1); });
      monitor.on('exit', code => {
        if (code !== 0) { monitorFailure = new Error(`資源監測失敗：${code} ${monitorError}`); worker?.kill(); void browser?.close(); }
        resolveExit(code);
      });
    });
    await new Promise((accept, reject) => {
      const timer = setTimeout(() => reject(new Error('資源監測啟動逾時')), 20000);
      monitor.stdout.once('data', () => { clearTimeout(timer); accept(); });
      monitor.once('error', error => { clearTimeout(timer); reject(error); });
      monitor.once('exit', code => { clearTimeout(timer); reject(new Error(`資源監測提前結束：${code} ${monitorError}`)); });
    });
    const built = await buildBalanceBundle(overrides);
    const { code, ...metadata } = built;
    Object.assign(run, metadata);
    const bundlePath = resolve(out, 'balance-bundle.js');
    await writeFile(bundlePath, code);
    await writeFile(resolve(out, 'balance.html'), '<!doctype html><meta charset="utf-8"><title>共振桌平衡測量</title><script src="./balance-bundle.js"></script>');
    await persist();
    const nodeRows = [], edgeRows = [], nodeStarted = Date.now();
    worker = fork(resolve(root, 'tools/balance-worker.mjs'), [], {
      execArgv: ['--max-old-space-size=1536'], windowsHide: true, stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    await new Promise((accept, reject) => {
      let workerError;
      worker.on('message', message => {
        if (message.error) workerError = new Error(message.error);
        if (message.row) {
          nodeRows.push(message.row);
          if (nodeRows.length % 15 === 0) console.log(`Node ${nodeRows.length}/${nodeSeeds * 3}，${((Date.now() - nodeStarted) / 1000).toFixed(1)} 秒`);
        }
      });
      worker.once('error', reject);
      worker.once('exit', code => code === 0 && !workerError ? accept() : reject(workerError ?? new Error(`Node worker 結束：${code}`)));
      worker.send({ bundle: bundlePath, seedStart, seeds: nodeSeeds, deadline });
    });
    run.nodeSeconds = (Date.now() - nodeStarted) / 1000;
    await writeFile(resolve(out, 'node.csv'), toCsv(nodeRows));
    if (nodeRows.length !== nodeSeeds * 3) throw new Error('Node 局數不足');
    const wins = nodeRows.filter(row => row.won).length;
    if (expectedWins !== null && wins !== expectedWins) throw new Error(`Node 基準不符：預期 ${expectedWins}/${nodeRows.length}，實際 ${wins}/${nodeRows.length}；停止 Edge，保留 CSV 供調查`);
    if (monitorFailure) throw monitorFailure;
    const edgeStarted = Date.now();
    browser = await chromium.launch({ channel: 'msedge', headless: true,
      args: ['--disable-background-networking', '--disable-component-update', '--js-flags=--max-old-space-size=1024'] });
    run.edgeVersion = browser.version();
    const context = await browser.newContext({ offline: true, serviceWorkers: 'block' });
    await context.route(/^https?:\/\//, route => route.abort());
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(pathToFileURL(resolve(out, 'balance.html')).href);
    run.edgeUserAgent = await page.evaluate(() => navigator.userAgent);
    const browserConfig = await page.evaluate(() => balance.CONFIG);
    if (sha256(JSON.stringify(browserConfig)) !== built.configSha256) throw new Error('Edge 設定雜湊不符');
    let actualEdgeSeeds = edgeSeeds;
    for (let i = 0; i < actualEdgeSeeds; i++) {
      if (Date.now() >= deadline || monitorFailure) throw monitorFailure ?? new Error('Edge 時間預算到達');
      for (const bot of BOTS) {
        const result = await page.evaluate(options => balance.run(options), { seed: seedStart + i, bot, stopAt: Math.round(600 / built.config.dt) });
        edgeRows.push(gameRow(result));
      }
      await writeFile(resolve(out, 'edge.csv'), toCsv(edgeRows));
      run.protocol.actualEdgeSeeds = i + 1;
      const secondsPerSeed = (Date.now() - edgeStarted) / 1000 / (i + 1);
      const availableSeeds = Math.max(0, Math.floor(((deadline - Date.now()) / 1000 - 15) / (secondsPerSeed * 1.5)));
      if (i + 1 + availableSeeds < actualEdgeSeeds) {
        const previous = actualEdgeSeeds; actualEdgeSeeds = i + 1 + availableSeeds;
        const warning = `依實測速度及 1.5 倍餘裕，Edge 由 ${previous * 3} 局縮為 ${actualEdgeSeeds * 3} 局`;
        run.warnings.push(warning); console.warn(warning);
      }
      console.log(`Edge ${edgeRows.length}/${actualEdgeSeeds * 3}，${((Date.now() - edgeStarted) / 1000).toFixed(1)} 秒`);
    }
    if (pageErrors.length) throw new Error(`Edge pageerror：${pageErrors.join('; ')}`);
    run.edgeSeconds = (Date.now() - edgeStarted) / 1000;
    await browser.close(); browser = undefined;
    await writeFile(resolve(out, 'summary.md'), summaryMarkdown(summarize(nodeRows, edgeRows)));
    run.summary = await verifyOutput(out);
    run.csvSummaryVerified = true;
    run.status = 'complete';
  } catch (error) {
    run.status = 'failed'; run.error = error.stack ?? String(error); throw error;
  } finally {
    worker?.kill();
    await browser?.close().catch(() => {});
    if (monitor) {
      await writeFile(stopPath, 'stop');
      const timer = setTimeout(() => monitor.kill(), 15000);
      await monitorExit; clearTimeout(timer);
      await unlink(stopPath).catch(() => {});
      run.resources = await readFile(resourcePath, 'utf8').then(JSON.parse).catch(() => null);
    }
    run.sourceConfigUnchanged = (await readFile(resolve(root, 'src/config.ts'))).equals(configBefore);
    run.finishedAt = new Date().toISOString(); run.elapsedSeconds = (Date.now() - started) / 1000;
    if (!run.sourceConfigUnchanged || monitorFailure || !run.resources || run.resources.stopReason || run.elapsedSeconds > 1800) {
      run.status = 'failed'; run.error ??= monitorFailure?.message ?? '設定完整性或資源監測未通過';
    }
    await persist();
    if (run.status !== 'complete') process.exitCode = 1;
  }
  console.log(JSON.stringify({ status: run.status, seconds: run.elapsedSeconds, summary: run.summary, resources: run.resources }, null, 2));
}
