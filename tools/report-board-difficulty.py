"""由已驗證的量測資料產生可提交報告及本機對照圖。"""
from collections import Counter
from datetime import datetime
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'board-difficulty'
data = json.loads((OUT / 'summary.json').read_bytes())
verification = json.loads((OUT / 'verification.json').read_bytes())
assert verification['passed']
assert verification['summarySha256'] == hashlib.sha256((OUT / 'summary.json').read_bytes()).hexdigest()
groups = {(g['mode'], g['bot']): g['summary'] for g in data['groups']}
rt, bd = groups['realtime', 'all'], groups['board', 'all']
count = int(data['protocol']['includedSeedsPerBot'])
names = {'realtime': '即時', 'board': '棋盤'}


def q(value):
    if not value['n']:
        return '不適用／未發生；n=0'
    return f"{value['median']:.2f}（{value['p10']:.2f}–{value['p90']:.2f}）；n={value['n']}"


def rate(s):
    return f"{s['wins']}/{s['games']}（{100 * s['winRate']:.1f}%）"


def loss_points(mode, bot):
    rows = [r for r in data['runs'] if r['mode'] == mode and (bot == 'all' or r['bot'] == bot) and r['status'] == 'lost']
    counts = Counter(r['turn'] if mode == 'board' else r['seconds'] for r in rows)
    return '；'.join(f'{point:g}{" 回合" if mode == "board" else " 秒"}：{n}' for point, n in sorted(counts.items())) or '無敗局'


lines = [f"規則來源 commit：`{data['rulesCommit']}`（e7f6eae）；bot 來源 commit：`{data['botCommit']}`（ee0a502）。", '',
    '# 棋盤與即時模式難度對照', '',
    f"**結論：本批固定 bot 的棋盤勝率低於即時模式 {100 * (rt['winRate'] - bd['winRate']):.1f} 個百分點；棋盤較難通關。這是無頭規則模擬，不是玩家體驗驗收。**", '',
    f"- 已查證：兩模式 × 三 bot × {count} seeds，共 {len(data['runs'])} 局；每組 seed 20261111–{20261110 + count}；逾時 {rt['timeouts'] + bd['timeouts']} 局。",
    f"- 已查證：即時勝率 **{rate(rt)}**；棋盤 **{rate(bd)}**。",
    f"- 已查證：局長中位數即時 **{rt['seconds']['median']:.2f} 秒**、棋盤 **{bd['seconds']['median']:.2f} 秒／{bd['turn']['median']:.0f} 回合**。",
    f"- 已查證：首次至少兩層連鎖中位數即時 **{rt['firstChainSeconds']['median']:.2f} 秒**、棋盤 **{bd['firstChainSeconds']['median']:.2f} 秒／{bd['firstChainTurn']['median']:.0f} 回合**。",
    f"- 已查證：敗局剩餘 Boss HP 中位數即時 **{rt['lossBossHp']['median']:.0f}**、棋盤 **{bd['lossBossHp']['median']:.0f}**（初始 12000）。", '',
    '## 已查證：兩模式對照', '',
    '時間及回合格為中位數（P10–P90）；n 為有效觀察局數。分位數採 `(n−1)×p` 線性內插。即時模式沒有原生回合，記 null／不適用，不用發射數捏造回合。棋盤「回合」指已開始的 turn，另列已完成的 Boss 鐘。', '',
    '| bot | 模式 | 勝率 | 局長秒數 | 局長回合 | 首次連鎖秒數 | 敗局秒數 | 敗局回合 |',
    '|---|---|---:|---|---|---|---|---|']
for bot in ['random', 'greedy', 'lazy', 'all']:
    for mode in ['realtime', 'board']:
        s = groups[mode, bot]
        lines.append(f"| {bot} | {names[mode]} | {rate(s)} | {q(s['seconds'])} | {q(s['turn'])} | {q(s['firstChainSeconds'])} | {q(s['lossSeconds'])} | {q(s['lossTurn'])} |")
lines += ['', '| bot | 模式 | 首次連鎖回合 | 已完成回合（Boss 鐘） | 發射數 | 最深連鎖層數 | 樣本最大深度 |', '|---|---|---|---|---|---|---:|']
for bot in ['random', 'greedy', 'lazy', 'all']:
    for mode in ['realtime', 'board']:
        s = groups[mode, bot]
        lines.append(f"| {bot} | {names[mode]} | {q(s['firstChainTurn'])} | {q(s['completedTurns'])} | {q(s['shots'])} | {q(s['deepestChain'])} | {s['deepestChainMax']} |")
lines += ['', '## 已查證：敗局位置與 Boss 剩餘 HP', '', '| bot | 即時敗局時間：局數 | 棋盤敗局回合：局數 |', '|---|---|---|']
for bot in ['random', 'greedy', 'lazy', 'all']:
    lines.append(f'| {bot} | {loss_points("realtime", bot)} | {loss_points("board", bot)} |')
lines += ['', '每個敗局的精確秒數、回合與 Boss HP 均在原始 JSON／CSV，棋盤回合不是秒數換算。原始 JSON 另外保留波次及終局曲線的 tick。', '',
    '| bot | 模式 | 終局 HP：中位數（P10–P90） | 敗局 HP：中位數（P10–P90） | HP=0 | 1–2999 | 3000–5999 | 6000–8999 | 9000–12000 |',
    '|---|---|---|---|---:|---:|---:|---:|---:|']
for bot in ['random', 'greedy', 'lazy', 'all']:
    for mode in ['realtime', 'board']:
        s = groups[mode, bot]
        hp = [r['bossHp'] for r in data['runs'] if r['mode'] == mode and (bot == 'all' or r['bot'] == bot)]
        bins = [sum(v == 0 for v in hp), sum(0 < v < 3000 for v in hp), sum(3000 <= v < 6000 for v in hp), sum(6000 <= v < 9000 for v in hp), sum(9000 <= v <= 12000 for v in hp)]
        lines.append(f"| {bot} | {names[mode]} | {q(s['bossHp'])} | {q(s['lossBossHp'])} | " + ' | '.join(map(str, bins)) + ' |')
lines += ['', '## 推論：只改一個 config 數字的提案（未套用、未試跑）', '',
    '| 鍵名 | 現值 | 建議值 | 理由 |', '|---|---:|---:|---|',
    '| `CONFIG.board.waveEveryTurns` | 2 | 3 | 每波間隔增加一個回合，基本射擊機會由 6 發增為 9 發（另有繞圈獎勵），讓留場球及連鎖累積後再承受下一波；只作用於棋盤。 |', '',
    '棋盤本批較早敗北且剩餘 HP 較多，支持先放緩出怪壓力這個方向；但沒有做反事實實驗，不能把差異完全歸因於出怪間隔。此鍵也會延後波次 HP 成長與增量，可能拉長局長或變得太容易。建議值只是下一次單鍵驗證起點，不保證提高多少勝率。本次 CONFIG 完全未改，也未額外跑調參模擬。', '',
    '## 已查證：量測方法與完整重跑指令', '',
    '- 直接載入來源 Game／CONFIG，dt=1/120 秒，不開瀏覽器、不使用替代物理、不執行 build。來源比對拒絕非指定規則或改寫的 bot；只允許 LF／CRLF 差異。',
    '- 即時模式完整沿用來源 simulate：tick 0 首射，每 2 秒一發，最多 600 模擬秒。random 操作 RNG 獨立；lazy 固定朝上；greedy 瞄上方最近的共振或群聚候選，無候選則瞄 Boss。',
    '- 棋盤 roll 階段立即呼叫 rollBoard；走格／格子效果由 Game.step 處理。shooting 首 tick 射第一發，之後間隔 2 秒；用完 shotsLeft，包括規則本身的繞圈獎勵，通常 3 發、有獎勵時 4 發。自然等待球停或最多 6 秒，由規則增加 Boss 鐘，沒有跳回合、改時鐘或植球。',
    '- TUNE 材質可經公開 game.board.tuneMaterial 讀取。棋盤 greedy 優先選同一候選集合中的 TUNE 材質；候選內仍取距離最近、同距較小 id；沒有候選則回到原策略。這是允許的策略擴充，因此 greedy 的模式差異同時包含 TUNE 利用策略；random／lazy 的瞄準策略完全相同。',
    '- 棋盤秒數為 tick×dt，包含骰子、走格、效果顯示的模擬 ticks；等待玩家思考時間為零，不能當作真人局長。原始資料另存 physicsSeconds 以區分實際物理推進時間。',
    '- 首次連鎖採第一個 ChainEvent.depth >= 2；未發生記 null，不補零。最深層數可沿 chainId 跨時間延續，不等同短時間視覺連段。',
    '- 每個 seed 依序跑三 bot × 兩模式，六局完整才納入共同樣本。未完整輪留在 partialRound，不混入對照；沒有依結果挑選 seed。',
    '- ObservedGame 先呼叫原公開方法再記錄出怪。所有新增控制及統計都在 tools；src 和 drafts\\3d-web 沒有任何修改，也沒有新增讀取用 export。', '',
    '```powershell',
    f"Set-Location -LiteralPath '{ROOT}'",
    'git switch analysis/board-difficulty',
    'npm run sim:board-difficulty -- --count 30 --budget-seconds 2700',
    'python tools\\verify-board-difficulty.py',
    'python tools\\report-board-difficulty.py',
    'npm test -- --maxWorkers=1 --no-file-parallelism',
    'npx tsc --noEmit',
    'git switch main',
    '```', '',
    '腳本預設本次 2026-11-11 17:00（+08:00）停止線。日後另行授權重跑時，完整模擬命令可用 `npm run sim:board-difficulty -- --count 30 --budget-seconds 2700 --stop-at ((Get-Date).AddMinutes(45).ToString("o"))`。報表與驗證可隨時重跑，不會重跑模擬。原來源命令 `npm run sim:difficulty -- --count 30 --budget-seconds 1500 --no-plot` 也保留，只執行即時量測並輸出至 artifacts\\difficulty。', '',
    f"原始資料目錄：`{OUT}`（本機 git exclude，沒有 commit）。逐局 `summary.json`／`runs.csv`，執行 log `run.log`，獨立驗證 `verification.json`。", '',
    '## 已查證：驗證、資源與保護邊界', '',
    f"- Python 獨立重算及一致性檢查 **{verification['checks']} 項通過**，涵蓋各組 seed、統計、輸入節奏、完整回合額度、波次時間及 HP、連鎖事件、終局狀態。",
    f"- 即時 **{verification['realtimeBaseline']['matchedRuns']} 局完整逐局 JSON** 與來源基準資料一致，不只比較摘要。基準資料 SHA-256：`{verification['realtimeBaseline'].get('sha256', '不可用')}`。",
    '- npm test：10 檔、79 測試全過（單 worker、無檔案並行）；npx tsc --noEmit 與 Node 語法檢查通過。棋盤新增完整局重播測試用未包裝 Game 核對整份 snapshot；既有即時回歸另與固定 84d6550 規則比較。',
    f"- 正式模擬牆鐘 **{data['resources']['wallSeconds']:.3f} 秒**、主程序 CPU **{data['resources']['cpuSeconds']:.3f} 秒**、取樣 RSS 峰值 **{data['resources']['peakRssBytes'] / 1024 ** 2:.1f} MiB**；heap 上限 2 GiB、RSS 停止線 3 GiB，逐局順序執行。",
    f"- 停止原因：`{data['stoppedReason']}`；未完整輪完成局 {len(data['partialRound'])}；納入 {len(data['runs'])} 局。計算上限 60 分鐘，本次正式模擬預算設為 2700 秒並預留測試與驗證。",
    f"- summary.json SHA-256：`{verification['summarySha256']}`。",
    '- 開工 date：2026-11-11 15:12:19 +08:00。收工在 commit 並切回 main 後用 date 另存 closeout.json，避免把報表產生時間當最終收工時間。',
    '- ENTRY v0.14／W-TASK-001 v0.1：使用有界任務及可執行驗證；專案 LEARNINGS 中獨立 RNG、保留事件時間及數值／體驗分開的適用條件成立，採用。codebase-memory 覆蓋檢查指出圖索引過時／缺檔，已改讀當前來源，不依舊圖作結論。',
    '- 沒有 build、merge、push、額外模型派工、套件安裝或規則調整。提交前敏感字串掃描與 src／drafts 差異檢查另存 closeout.json。', '',
    '## 不確定：證據外推限制', '',
    '- 三種固定 bot 不代表真人策略分布；30 個固定 seed 不是大量隨機抽樣，比例差不附顯著性／最佳參數宣稱。相同 seed 是配對識別，模式會改變 RNG 消耗路徑，並非完全相同外生隨機序列。',
    '- 未量測真人思考、3D 操作、畫面、音效、手機、幀率與體感；沒有將無頭勝率稱為好玩或可玩性通過。',
    '- 棋盤射擊採每 2 秒，快速連射或慢速瞄準可能改變結果；本次未做節奏敏感度分析。greedy 的 TUNE 優先策略沒有另外做關閉對照。',
    '- RSS 每模擬秒取樣，不是 OS 強制記憶體上限或全機總 RAM；未逐一累加短暫 shell／Python 的 CPU。正式模擬與測試順序執行，量測遠低於 4 GB，任務總牆鐘也低於 60 分鐘。',
    '- CONFIG 建議值完全未套用，尚未確認其勝率、局長或副作用。', '',
    '## 已查證：7 個凍結檔 SHA-256', '',
    '| 完整 Windows 絕對路徑 | 開工 | 收工前 |', '|---|---|---|']
start = json.loads((OUT / 'hashes-start.json').read_text(encoding='utf-8-sig'))
for entry in start:
    digest = hashlib.sha256(Path(entry['Path']).read_bytes()).hexdigest()
    assert digest == entry['Hash'].lower(), entry['Path']
    lines.append(f"| `{entry['Path']}` | `{entry['Hash'].lower()}` | `{digest}` |")
lines += ['', f"報告生成時間：{datetime.now().astimezone().isoformat(timespec='seconds')}。切回 main 後的再驗證另存 `{OUT / 'hashes-final.json'}`。", '']
report = '\n'.join(lines)
(ROOT / 'docs' / 'BOARD-DIFFICULTY.md').write_text(report, encoding='utf-8')
(OUT / 'BOARD-DIFFICULTY.md').write_text(report, encoding='utf-8')

# 圖只呈現量測數據；全量分位數與限制留在報告。
rows = []
for bot in ['random', 'greedy', 'lazy', 'all']:
    bars = []
    for mode in ['realtime', 'board']:
        s = groups[mode, bot]
        percent = 100 * s['winRate']
        bars.append(f'<div class="row"><span>{names[mode]}</span><div class="track"><div class="bar {mode}" style="width:{percent}%"></div></div><strong>{percent:.1f}%</strong></div>')
    rows.append(f'<section><h3>{"全部 bot" if bot == "all" else bot}</h3>{"".join(bars)}</section>')
html = '''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font-family:var(--font-sans,system-ui);color:var(--foreground)}h2{font-size:19px;margin:8px 0}p{font-size:13px;line-height:1.6;color:var(--muted-foreground)}section{margin:18px 0}h3{font-size:14px;margin:0 0 8px}.row{display:grid;grid-template-columns:38px 1fr 58px;gap:10px;align-items:center;margin:8px 0;font-size:13px}.track{height:18px;background:var(--secondary);border-radius:3px}.bar{height:18px;border-radius:3px}.realtime{background:var(--chart-1)}.board{background:var(--chart-2)}strong{text-align:right;font-variant-numeric:tabular-nums}
</style><h2>同一批 bot：棋盤與即時勝率</h2>'''
html += f'<p>每組 {count} 局 · seed 20261111–{20261110 + count} · 無頭規則模擬</p>' + ''.join(rows)
html += f'<p>兩模式各 {3 * count} 局；0% 表示本批沒有勝局，不代表永遠無法通關。每 2 秒射一發，棋盤依回合額度射擊。真人難度未驗證。</p></html>'
(OUT / 'comparison.html').write_text(html, encoding='utf-8')
print(ROOT / 'docs' / 'BOARD-DIFFICULTY.md')
