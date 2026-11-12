"""由已驗證資料與驗收中繼資料產生調參報告。"""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--directory', default=str(ROOT.parent / 'review-board2'))
args = parser.parse_args()
out = Path(args.directory).resolve()
data = json.loads((out / 'sweep2-summary.json').read_bytes())
verified = json.loads((out / 'sweep2-verification.json').read_bytes())
validation = json.loads((out / 'sweep2-validation.json').read_bytes())
assert verified['passed']
assert verified['csvSha256'] == hashlib.sha256((out / 'runs-sweep2.csv').read_bytes()).hexdigest()
assert verified['selected'] == data['selected']


def rate(s):
    return f"{s['wins']}/{s['games']}（{s['wins'] / s['games'] * 100:.1f}%）"


def number(v):
    return '不適用（無敗局）' if v is None else f'{v:.2f}'


selected = next((g for g in data['groups'] if g['id'] == data['selected']), None)
decision = (f"選定 waveEveryTurns=3、{selected['key']}={selected['value']}；勝率 {rate(selected['summary'])}，"
            f"距指定 35.6% 目標 {abs(selected['summary']['winRate'] - .356) * 100:.2f} 個百分點。") if selected else \
    'BLOCKED：所有已測組均未落在 25%–45%；未改 src、未 build、未截圖。'
lines = [f"基準 commit：`{data['baselineCommit']}`（tune/board-waves）。", '',
         '# 棋盤第二輪單鍵掃描', '', f'**結論：{decision}**', '',
         '| 覆寫鍵（waveEveryTurns 均為 3） | 值 | 全體 | random | greedy | lazy |',
         '|---|---:|---:|---:|---:|---:|']
for group in data['groups']:
    lines.append(f"| {group['key']} | {group['value']} | {rate(group['summary'])} | " +
                 ' | '.join(rate(b['summary']) for b in group['bots']) + ' |')
lines += ['', '## 已查證：局長、敗局回合與 Boss HP', '',
          '各欄為中位數；局長秒數是固定 tick 模擬時間，不含真人思考。終局 HP 計所有局，敗局 HP 只計敗局；無敗局留不適用。', '',
          '| 鍵 | 值 | bot | 勝率 | 局長秒數 | 局長回合 | 敗局回合 | 終局 Boss HP | 敗局 Boss HP |',
          '|---|---:|---|---:|---:|---:|---:|---:|---:|']
for r in verified['rows']:
    lines.append(f"| {r['key']} | {r['value']} | {r['bot']} | {rate(r)} | " +
                 ' | '.join(number(r[k]) for k in ['seconds', 'turns', 'lossTurns', 'bossHp', 'lossBossHp']) + ' |')
lines += ['', '## 已查證：方法與決策', '',
          '- 每組 random、greedy、lazy 各 30 局，seed 均為 20261111–20261140；每組 90 局，沒有換 seed 或重試不利局。',
          '- tools 僅在記憶體固定 waveEveryTurns=3，並覆寫每組的一個鍵；其餘 CONFIG 完整對照基準。waveBaseCount=2、waveCountGrowth=1、wavesPerCountGrowth=2、waveMaxCount=8、waveHpGrowth=120 為未選鍵的原值。',
          '- 沿用未修改的 board-difficulty-sim.ts 與 difficulty-sim.ts；dt=1/120 秒、發射間隔 2 秒、自然擲骰與回合結算。每 seed 三 bot 完整後才納入。',
          '- 全部 src 及兩份 bot 模組在執行前與基準 commit 比對；只容許重跑時已選設定欄位的差異。每組再核對完整 CONFIG，確保只有允許覆寫。',
          '- firstChain 是首次 depth>=2 的模擬秒數，未發生留空；deepestChain 是全局事件最大深度。沒有逾時局。',
          '- 首四組依指定順序。只有四組均不合格、160→200 呈下降趨勢，才准追加 HP；總組數最多 6。280 依首兩個 HP 結果外推；260 依 200 與 280 結果內插，以逼近 35.6%。這些估計只用來選試值，決策仍依完整實測。',
          f"- 選定值與理由：{decision}",
          f"- 完成 {len(data['groups'])} 組、{len(data['runs'])} 局。目標用指定 35.6%；即時參照 32/90 僅為既有資料，不冒充本輪新測。", '',
          '## 已查證：驗證與交付', '',
          f"- 整套 npm test：{validation['tests']} 項、{validation['testFiles']} 檔，{validation['testResult']}；即時回歸檔保持原樣，直接載入 84d6550ea25a710cb8a65ee8a1a13f4ff3ab5b94 比較完整狀態檢查點。",
          f"- Python 獨立核對 {verified['checks']} 項；完整回合驗證 {sum(v['checks'] for v in verified['fullTurnChecks'].values())} 項，全部通過。逐組核對出怪數、波次 HP、輸入、回合、統計與選值。",
          '- 完整回合驗證中引用的即時 90 局只是既有資料一致性核對，不是新跑即時模擬。',
          f"- 其他檢查：{validation['otherChecks']}",
          f"- 整局驗證：{validation['browser']}",
          f"- 建置：`{ROOT / 'drafts' / '3d-web' / 'dist-board2' / 'index.html'}`；SHA-256：`{validation['buildSha256']}`。",
          f"- 截圖：`{out / 'board2-desktop.png'}`；SHA-256：`{validation['screenshotSha256']}`。",
          f"- CSV：`{out / 'runs-sweep2.csv'}`；{verified['csvDataRows']} 筆資料＋1 列欄名；SHA-256：`{verified['csvSha256']}`。",
          f"- 完整逐局資料：`{out}` 下的 sweep2-<鍵>-<值>.json；雜湊記於 sweep2-summary.json。CSV、JSON、log 與截圖均在 repo 外，不 commit。",
          f"- 本報告另複製至 `{out / 'BOARD-SWEEP2.md'}`，切回 main 後仍可閱讀。", '',
          '## 已查證：資源、範圍與時間', '',
          '- 開工 date：2026-11-11 15:43:28（Asia/Taipei）。提交並切回 main 後的收工 date、commit、clean 狀態另存 sweep2-closeout.json。',
          f"- 掃描累計牆鐘 {sum(r['wallSeconds'] for r in data['resources']):.3f} 秒、CPU {sum(r['cpuSeconds'] for r in data['resources']):.3f} 秒；guard 取樣 RSS 峰值 {max(r['peakRssBytes'] for r in data['resources']) / 1024**2:.1f} MiB。",
          '- 單程序串行掃描，Node heap 上限 1536 MiB、RSS 保守停止線 3 GiB、累計掃描預算 2100 秒，保留 600 秒給驗證；17:00 到時停止。沒有安裝、派工、merge、push。',
          '- dist-board2 已加入本分支 .gitignore；另在本機 .git/info/exclude 加同一路徑，讓切回 main 後保留候選建置且 working tree clean，沒有修改 main 的提交。',
          '- ENTRY v0.14／W-TASK-001 v0.1：有限任務與可重現驗證；依受限 worker 範圍採用本專案 LEARNINGS 的獨立 RNG、完整輸入與證據分層。codebase-memory 索引過時且模擬器無記錄，已直接讀取指定來源補足。', '',
          '## 已查證：8 個凍結檔', '',
          '以下開工與報告生成時雜湊均已實讀。commit、切回 main 後再核對並寫入 sweep2-frozen-end.json。', '',
          '| 完整 Windows 路徑 | 開工 SHA-256 | 收尾核對 SHA-256 |', '|---|---|---|']
for row in json.loads((out / 'sweep2-frozen-start.json').read_text(encoding='utf-8-sig')):
    final_hash = hashlib.sha256(Path(row['Path']).read_bytes()).hexdigest()
    assert final_hash == row['Hash'].lower()
    lines.append(f"| `{row['Path']}` | `{row['Hash'].lower()}` | `{final_hash}` |")
lines += ['', '## 已查證：重跑指令', '',
          '日後在同一 repo、已授權的本機環境重跑。請使用新的輸出目錄，工具拒絕覆蓋既有量測。', '',
          '```powershell', f"Set-Location -LiteralPath '{ROOT}'", 'git switch tune/board-sweep2',
          "$sweepOut = 'D:\\Projects\\Active\\competitions\\game-off-2026\\review-board2-rerun'",
          "node --max-old-space-size=1536 tools/run-board-sweep2.mjs --output $sweepOut --budget-seconds 2100 --stop-at ((Get-Date).AddMinutes(35).ToString('o'))"]
for group in data['groups'][4:]:
    lines.append(f"node --max-old-space-size=1536 tools/run-board-sweep2.mjs --output $sweepOut --extra-hp {group['value']} --budget-seconds 2100 --stop-at ((Get-Date).AddMinutes(35).ToString('o'))")
lines += ['python tools/verify-board-sweep2.py --directory $sweepOut',
          "$env:NODE_OPTIONS='--max-old-space-size=1024'", 'npm test -- --maxWorkers=1 --no-file-parallelism',
          'npx tsc --noEmit', 'node --check tools/run-board-sweep2.mjs', 'git diff --check',
          "git grep ([char]64 + 'gmail') # 預期 0 筆，無命中 exit code 為 1", 'git switch main', 'git status --porcelain=v1', '```', '',
          '## 推論', '',
          '勝率差異支持這批固定 bot 與 seed 的候選取捨；只用本批樣本選值，尚未以保留樣本檢驗泛化。', '',
          '## 不確定', '',
          '- bot 勝率不是玩家勝率，也不代表其他 seed、操作節奏或策略。',
          '- 即時回歸只證明既定輸入與檢查點，不是所有可能輸入的窮舉證明。',
          '- RSS 數字為 guard 取樣；不是整台電腦或所有瞬間的總記憶體量測。',
          f"- {validation['uncertainty']}", '',
          f"報告生成時間：{datetime.now().astimezone().isoformat(timespec='seconds')}。", '']
text = '\n'.join(lines)
if selected:
    browser_instructions = '\n'.join([
        '## 已查證：候選建置與瀏覽器重跑', '',
        '```powershell', f"Set-Location -LiteralPath '{ROOT}'", 'git switch tune/board-sweep2',
        "$env:NODE_OPTIONS='--max-old-space-size=1024'", 'npx tsc --noEmit',
        'npm --prefix drafts/3d-web run bundle -- --outDir dist-board2 --emptyOutDir',
        'node --max-old-space-size=768 tools/verify-board-sweep2-browser.mjs', '```', '',
        f"腳本用已安裝的 Playwright／Edge 開啟 `{ROOT / 'drafts' / '3d-web' / 'dist-board2' / 'index.html'}`，帶 `?mode=board`，viewport 設 1280×720。",
        f"結果寫入 `{out / 'sweep2-browser-verification.json'}`，以實際 DOM 擲骰／射擊、唯讀 boardEvidence.snapshot 觀測；必須 status=PASS、desktopFinal.game.status 為 won 或 lost，consoleErrors 與 pageErrors 皆空。",
        '腳本最多等待 10 分鐘，未改規則時間或終局狀態。瀏覽器採正弦掃角輸入，與勝率掃描 bot 不同；這一局驗證可操作與無錯誤，不混入 540 局勝率。',
        'T3 預覽初始化曾因 expression 尾端空白被拒絕，接著讀取未初始化狀態失敗；修正後仍約一秒一幀，130 秒牆鐘只推進約 30 秒模擬，故關閉預覽並改用 Edge。T3 未完成資料在 sweep2-preview-incomplete.json，不算整局通過；這兩次工具錯誤不冒充遊戲 console／page error。', '',
    ])
    text = text.replace('## 推論\n', browser_instructions + '\n## 推論\n')
(ROOT / 'docs' / 'BOARD-SWEEP2.md').write_text(text, encoding='utf-8')
(out / 'BOARD-SWEEP2.md').write_text(text, encoding='utf-8')
print(decision)
