import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const BOTS = ['random', 'greedy', 'lazy'];
const columns = ['seed', 'bot', 'won', 'turns', 'cards', 'status', 'ticks', 'shots', 'bossHp'];
export function gameRow(result) {
  if (result.stalled) throw new Error(`規則驅動停滯：${JSON.stringify(result.stalled)}`);
  const status = result.status === 'playing' ? 'timeout' : result.status;
  return { seed: result.seed, bot: result.bot, won: Number(status === 'won'), turns: result.snapshot.board.turn,
    cards: result.snapshot.board.cards, status, ticks: result.tick, shots: result.shots, bossHp: result.bossHp };
}
export function toCsv(rows) {
  const quote = v => `"${String(v).replaceAll('"', '""')}"`;
  return columns.join(',') + '\n' + rows.map(row => columns.map(key => quote(key === 'cards' ? JSON.stringify(row[key]) : row[key])).join(',')).join('\n') + (rows.length ? '\n' : '');
}
// 支援 JSON 卡牌中的逗號、雙引號與換行，不能用 split(',') 讀 CSV。
export function fromCsv(text) {
  const records = []; let record = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      record.push(cell.replace(/\r$/, '')); cell = '';
      if (char === '\n') { records.push(record); record = []; }
    } else cell += char;
  }
  if (quoted) throw new Error('CSV 引號未閉合');
  if (cell || record.length) { record.push(cell); records.push(record); }
  if (records.shift()?.join(',') !== columns.join(',')) throw new Error('CSV 欄位不符');
  const seen = new Set();
  return records.map(fields => {
    if (fields.length !== columns.length) throw new Error('CSV 欄位數不符');
    const row = Object.fromEntries(columns.map((key, i) => [key, fields[i]]));
    for (const key of ['seed', 'won', 'turns', 'ticks', 'shots', 'bossHp']) {
      if (!row[key].trim() || !Number.isFinite(Number(row[key]))) throw new Error(`CSV ${key} 非數字`);
      row[key] = Number(row[key]);
    }
    const key = `${row.seed}/${row.bot}`;
    if (seen.has(key) || !BOTS.includes(row.bot) || !Number.isSafeInteger(row.seed)
      || ![0, 1].includes(row.won) || !['won', 'lost', 'timeout'].includes(row.status)
      || row.won !== Number(row.status === 'won')) throw new Error(`CSV 資料無效或重複：${key}`);
    seen.add(key); row.cards = JSON.parse(row.cards);
    if (!Array.isArray(row.cards)) throw new Error('CSV cards 必須是陣列');
    return row;
  });
}
const stats = rows => ({ wins: rows.filter(r => r.won === 1).length, games: rows.length, timeouts: rows.filter(r => r.status === 'timeout').length });
export function summarize(node, edge) {
  const pairs = new Map(node.map(row => [`${row.seed}/${row.bot}`, row]));
  for (const row of edge) if (!pairs.has(`${row.seed}/${row.bot}`)) throw new Error('Edge 樣本沒有對應 Node 局');
  const pairedNode = edge.map(row => pairs.get(`${row.seed}/${row.bot}`));
  return { node: stats(node), edge: stats(edge), pairedNode: stats(pairedNode),
    bots: Object.fromEntries(BOTS.map(bot => [bot, { node: stats(node.filter(r => r.bot === bot)), edge: stats(edge.filter(r => r.bot === bot)) }])),
    pairs: edge.length, disagreements: edge.filter((r, i) => r.won !== pairedNode[i].won).length };
}
const rate = stat => stat.games ? `${stat.wins}/${stat.games} (${(100 * stat.wins / stat.games).toFixed(4)}%)` : '0/0 (N/A)';
export function summaryMarkdown(summary) {
  return '# 共振桌平衡對照\n\n| 樣本 | Node | Edge |\n|---|---:|---:|\n'
    + `| 整體 | ${rate(summary.node)} | ${rate(summary.edge)} |\n`
    + BOTS.map(bot => `| ${bot} | ${rate(summary.bots[bot].node)} | ${rate(summary.bots[bot].edge)} |\n`).join('')
    + `| 相同 seed / bot 配對子集 | ${rate(summary.pairedNode)} | ${rate(summary.edge)} |\n\n`
    + `配對勝負不同：${summary.disagreements}/${summary.pairs} 組。\n\n`
    + `未完局（計入分母、不算勝局）：Node ${summary.node.timeouts}；Edge ${summary.edge.timeouts}。\n\n`
    + 'Node 全樣本與 Edge 子集的分母不同；配對子集列供同樣本比較。每局各自根據所在執行環境的狀態選下一步，不強制重播另一環境的 tick。\n';
}
export async function verifyOutput(out) {
  const node = fromCsv(await readFile(resolve(out, 'node.csv'), 'utf8'));
  const edge = fromCsv(await readFile(resolve(out, 'edge.csv'), 'utf8'));
  const summary = summarize(node, edge);
  if (await readFile(resolve(out, 'summary.md'), 'utf8') !== summaryMarkdown(summary)) throw new Error('CSV 重算與 summary.md 不一致');
  return summary;
}
