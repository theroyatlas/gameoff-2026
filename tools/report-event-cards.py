"""將獨立重算、瀏覽器及同盤面截圖證據整理到指定本機交付目錄。"""
import json
import hashlib
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = root.parent / 'review-event-cards'
load = lambda name: json.loads((out / name).read_text(encoding='utf-8-sig'))
data = load('csv-recount.json')
capture = load('capture.json')
browser = load('browser-verification.json')
inputs = load('input-audit.json')
start = load('frozen-start.json')
end = []
for item in start:
    digest = hashlib.sha256((root / item['file']).read_bytes()).hexdigest()
    end.append(dict(item, endSha256=digest, match=digest == item['sha256']))
assert all(item['match'] for item in end)
(out / 'frozen-end.json').write_text(json.dumps(end, indent=2), encoding='utf-8')
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
main = subprocess.check_output(['git', 'rev-parse', 'main'], cwd=root, text=True).strip()
branch = subprocess.check_output(['git', 'branch', '--show-current'], cwd=root, text=True).strip()
assert main == 'bafa2962ca5fe53d34bf721347647836934ad65c' and branch == 'feat/event-cards'
build = root / 'drafts/3d-web/dist-event-cards/index.html'
build_sha = hashlib.sha256(build.read_bytes()).hexdigest()
assert build_sha == browser['buildSha256'] == capture['buildSha256']
lines = ['# 事件卡 v1 交付報告', '', '## 已查證', '', f'- 分支：`{branch}`；commit：`{head}`。',
         f'- main 保持 `{main}`；沒有 merge、push、rebase、PR 或發布。',
         '- 六張事件卡、原 RNG 抽卡、即時模式隔離；所有新機制狀態都在 BoardState。',
         '- npm test：12 個測試檔、92 個測試通過，包含 realtime-baseline.test.ts；tsc --noEmit 通過。',
         '- 原三組 ball/icon/light 與預設值未改；沒有新增外部素材或音檔。', '', '### 事件卡', '',
         '| 名稱 | 效果與數值 |', '|---|---|',
         '| 多留一發 | 下一回合 +1 發，可與繞圈加發累計 |',
         '| 換個材質 | 下一次成功發射的材質輪換 +1 種，只影響一球 |',
         '| 鐘慢一拍 | Boss 鐘 −1，最低 0，保留已生成波次 |',
         '| 雙倍共鳴 | 最新球的下一次爆發範圍、點燃量、傷害 ×2，一次；空場留給下一球 |',
         '| 即刻釋放 | 最新球立即爆發一次，保留球；空場留給下一球 |',
         '| 輕敲核心 | Boss 傷害 60 |', '', '### 難度', '',
         '每組 random／greedy／lazy 各 30 局，seed 20261111–20261140，每發間隔沿用既有 2 秒。waveEveryTurns 固定 3。沒有逾時局。', '',
         '| 參數組 | 局數 | 勝局 | 勝率 | 原始 CSV |', '|---|---:|---:|---:|---|']
for g in data['groups']:
    title = '無卡基準，HP 成長 260' if g['label'] == 'baseline' else '有卡，HP 成長 ' + g['label'].split('-')[1]
    lines.append(f"| {title} | {g['games']} | {g['wins']} | {g['winRate']:.1%} | `{out / (g['label'] + '.csv')}` |")
lines += ['', '採用 HP 成長 300：35/90＝38.9%。三 bot 分別 random 11/30、greedy 9/30、lazy 15/30。',
          f'CSV 包含 seed、bot、won、status、turns、shots、ticks、bossHp、cards；配對 JSON 另保留輸入與擲骰紀錄。獨立 Python 重算：`{out / "csv-recount.json"}`。',
          '', '### 密集盤面與鏡頭', '',
          '同 seed 20261112、90 球；所有 8 張截圖的完整盤面 SHA-256 相同：', f'`{capture["shots"][0]["snapshotSha"]}`。',
          '改前圖是同一自然盤面重放原全紙籤／全毛線呈現；不是原始建置的另一局。',
          '此盤桌面與手機：紙籤 90→4、毛線 120→2。一般上限桌面 10 張／24 條、手機 6 張／12 條；只改呈現，所有球仍參與規則。',
          '近景用 `?cam=field`；不加參數維持整桌。此盤球直徑桌面 13.7→19.1 CSS px、手機 7.6→10.3 CSS px。', '',
          '| 用途 | 完整路徑 |', '|---|---|']
for shot in capture['shots']:
    lines.append(f'| {shot["file"]} | `{out / shot["file"]}` |')
lines += ['', '上述 8 張及瀏覽器驗證截圖皆已逐張開啟檢查；沒有 email 或本機使用者路徑。',
          '可發射回合中，桌面點擊與手機合成觸控查看均保持 1 發→1 發；Space 開啟查看、左右鍵選球、Esc 結束均通過。',
          '', '### 瀏覽器', '',
          f'結果：**{"PASS" if browser.get("pass") else "未完成"}**。Edge 離線檔案；DOM 輸入＋Playwright 加速時鐘，勝局使用受控 RAF 對齊階段與發射節奏；不修改規則狀態。所有已完成的失敗嘗試都保留。', '',
          '| 模式 | seed／策略 | 結局 | 回合或 tick |', '|---|---|---|---|']
for r in browser['board']:
    strategy = r.get('strategy') or ('耐心直射' if r['patient'] else '優先弱怪')
    lines.append(f'| 棋盤 | {r["seed"]}／{strategy} | {r["status"]} | {r["board"]["turn"]} 回合 |')
for mode, key in [('即時', 'realtime'), ('減少動態／390×844', 'reduced')]:
    r = browser[key]
    lines.append(f'| {mode} | {r.get("seed", "預設")} | {r["status"]} | {r["tick"]} tick |')
lines += ['', 'console error／page error／外部請求：' + '／'.join(str(len(browser['errors'][k])) for k in ['console', 'page', 'external']) + '。',
          f'完整結果：`{out / "browser-verification.json"}`；另外捕圖及輸入檢查的錯誤也為 0。',
          '', '### 建置與凍結檔', '', f'建置：`{build}`', f'SHA-256：`{build_sha}`',
          '', '11 個凍結檔開工值皆與使用者指定值一致，收工逐字比較全部相同：', '', '| 檔案 | 開工 SHA-256 | 收工 |', '|---|---|---|']
for r in end:
    lines.append(f'| `{root / r["file"]}` | `{r["sha256"]}` | 相同 |')
lines += ['', '## 推論', '',
          '- 固定 bot 樣本的整體勝率符合 30–40%，不能推論真人勝率也相同。',
          '- 稀疏紙籤與毛線讓盤面較容易辨認；主觀美術偏好及遊玩感受仍由使用者判斷。',
          '', '## 不確定', '',
          '- 手機為 Edge 390×844 與合成觸控，尚未做實體手機驗收。',
          '- 完整局使用加速瀏覽器時鐘；不是一般速度的人工試玩或音效主觀驗收。',
          '- Node 固定輸入紀錄逐 tick 搬到 Edge 的額外嘗試未完全對齊：在 tick 18037 遇到較早回合結束，目標 tick 為 18102。原因尚未定位，不宣稱跨執行環境的整局物理軌跡逐位一致；本機同 seed 測試與瀏覽器內重跑另有證據。',
          '- 卡面插畫依要求未做；最近事件保留文字卡，不代表已交付美術卡面。',
          '- 未做獨立代理審查；impeccable audit 為本工作階段的技術自查。']
(out / 'REPORT.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

bars = []
for g in data['groups']:
    label = '無卡 · 260' if g['label'] == 'baseline' else '有卡 · ' + g['label'].split('-')[1]
    selected = g['label'] == 'events-300'
    color = 'var(--success)' if selected else 'var(--chart-1)'
    bars.append(f'<div class="row"><span>{label}</span><div class="track"><i style="width:{g["winRate"]*100}%;background:{color}"></i></div><b>{g["winRate"]:.1%}</b><small>{g["wins"]}/90</small></div>')
chart = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><style>body{font-family:var(--font-sans);color:var(--foreground)}p{color:var(--muted-foreground);font-size:13px}.row{display:grid;grid-template-columns:80px minmax(50px,1fr) 54px 42px;gap:10px;align-items:center;margin:16px 0;font-size:13px}.track{height:20px;background:var(--secondary);position:relative}.track:before{content:"";position:absolute;left:30%;width:10%;height:100%;background:var(--success);opacity:.2}.track i{display:block;height:100%;position:relative}small{color:var(--muted-foreground)}</style><body><p>固定三 bot，共 450 局。淡色區間為目標勝率 30–40%；數字為 waveHpGrowth，waveEveryTurns 均為 3。</p>' + ''.join(bars) + '</body></html>'
(out / 'win-rates.html').write_text(chart, encoding='utf-8')
print(json.dumps({'report': str(out / 'REPORT.md'), 'buildSha256': build_sha, 'frozenFiles': len(end), 'browserPass': browser.get('pass')}, ensure_ascii=False))
