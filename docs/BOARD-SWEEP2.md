基準 commit：`9f9ed69dcd4880c20e816f0cdbb1110357695248`（tune/board-waves）。

# 棋盤第二輪單鍵掃描

**結論：選定 waveEveryTurns=3、waveHpGrowth=260；勝率 30/90（33.3%），距指定 35.6% 目標 2.27 個百分點。**

| 覆寫鍵（waveEveryTurns 均為 3） | 值 | 全體 | random | greedy | lazy |
|---|---:|---:|---:|---:|---:|
| waveBaseCount | 3 | 47/90（52.2%） | 14/30（46.7%） | 15/30（50.0%） | 18/30（60.0%） |
| waveBaseCount | 4 | 20/90（22.2%） | 9/30（30.0%） | 5/30（16.7%） | 6/30（20.0%） |
| waveHpGrowth | 160 | 76/90（84.4%） | 24/30（80.0%） | 27/30（90.0%） | 25/30（83.3%） |
| waveHpGrowth | 200 | 61/90（67.8%） | 22/30（73.3%） | 18/30（60.0%） | 21/30（70.0%） |
| waveHpGrowth | 280 | 23/90（25.6%） | 7/30（23.3%） | 11/30（36.7%） | 5/30（16.7%） |
| waveHpGrowth | 260 | 30/90（33.3%） | 8/30（26.7%） | 12/30（40.0%） | 10/30（33.3%） |

## 已查證：局長、敗局回合與 Boss HP

各欄為中位數；局長秒數是固定 tick 模擬時間，不含真人思考。終局 HP 計所有局，敗局 HP 只計敗局；無敗局留不適用。

| 鍵 | 值 | bot | 勝率 | 局長秒數 | 局長回合 | 敗局回合 | 終局 Boss HP | 敗局 Boss HP |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| waveBaseCount | 3 | random | 14/30（46.7%） | 277.26 | 24.00 | 22.50 | 2326.00 | 4551.50 |
| waveBaseCount | 3 | greedy | 15/30（50.0%） | 282.27 | 24.50 | 21.00 | 433.00 | 4666.00 |
| waveBaseCount | 3 | lazy | 18/30（60.0%） | 278.38 | 24.00 | 21.00 | 0.00 | 4204.00 |
| waveBaseCount | 3 | all | 47/90（52.2%） | 278.52 | 24.00 | 21.00 | 0.00 | 4466.00 |
| waveBaseCount | 4 | random | 9/30（30.0%） | 247.38 | 21.00 | 21.00 | 4666.00 | 5423.00 |
| waveBaseCount | 4 | greedy | 5/30（16.7%） | 246.55 | 21.00 | 21.00 | 4490.00 | 5223.00 |
| waveBaseCount | 4 | lazy | 6/30（20.0%） | 244.12 | 21.00 | 21.00 | 4330.00 | 5546.50 |
| waveBaseCount | 4 | all | 20/90（22.2%） | 246.71 | 21.00 | 21.00 | 4469.00 | 5372.50 |
| waveHpGrowth | 160 | random | 24/30（80.0%） | 288.24 | 25.00 | 24.00 | 0.00 | 3288.00 |
| waveHpGrowth | 160 | greedy | 27/30（90.0%） | 291.02 | 26.00 | 24.00 | 0.00 | 2653.00 |
| waveHpGrowth | 160 | lazy | 25/30（83.3%） | 293.49 | 26.00 | 24.00 | 0.00 | 3259.00 |
| waveHpGrowth | 160 | all | 76/90（84.4%） | 290.10 | 26.00 | 24.00 | 0.00 | 3104.00 |
| waveHpGrowth | 200 | random | 22/30（73.3%） | 288.71 | 25.00 | 24.00 | 0.00 | 4084.50 |
| waveHpGrowth | 200 | greedy | 18/30（60.0%） | 282.87 | 25.00 | 24.00 | 0.00 | 3909.00 |
| waveHpGrowth | 200 | lazy | 21/30（70.0%） | 284.93 | 25.00 | 24.00 | 0.00 | 4576.00 |
| waveHpGrowth | 200 | all | 61/90（67.8%） | 285.35 | 25.00 | 24.00 | 0.00 | 4237.00 |
| waveHpGrowth | 280 | random | 7/30（23.3%） | 277.20 | 24.00 | 24.00 | 2828.50 | 3377.00 |
| waveHpGrowth | 280 | greedy | 11/30（36.7%） | 276.55 | 24.00 | 21.00 | 2367.50 | 4468.00 |
| waveHpGrowth | 280 | lazy | 5/30（16.7%） | 261.13 | 22.50 | 21.00 | 4345.00 | 4862.00 |
| waveHpGrowth | 280 | all | 23/90（25.6%） | 276.62 | 24.00 | 21.00 | 3074.00 | 4340.00 |
| waveHpGrowth | 260 | random | 8/30（26.7%） | 278.43 | 24.00 | 24.00 | 3390.00 | 4382.50 |
| waveHpGrowth | 260 | greedy | 12/30（40.0%） | 280.32 | 24.00 | 24.00 | 3291.00 | 4305.00 |
| waveHpGrowth | 260 | lazy | 10/30（33.3%） | 276.19 | 24.00 | 21.00 | 3482.00 | 4805.00 |
| waveHpGrowth | 260 | all | 30/90（33.3%） | 278.08 | 24.00 | 21.00 | 3422.00 | 4441.00 |

## 已查證：方法與決策

- 每組 random、greedy、lazy 各 30 局，seed 均為 20261111–20261140；每組 90 局，沒有換 seed 或重試不利局。
- tools 僅在記憶體固定 waveEveryTurns=3，並覆寫每組的一個鍵；其餘 CONFIG 完整對照基準。waveBaseCount=2、waveCountGrowth=1、wavesPerCountGrowth=2、waveMaxCount=8、waveHpGrowth=120 為未選鍵的原值。
- 沿用未修改的 board-difficulty-sim.ts 與 difficulty-sim.ts；dt=1/120 秒、發射間隔 2 秒、自然擲骰與回合結算。每 seed 三 bot 完整後才納入。
- 全部 src 及兩份 bot 模組在執行前與基準 commit 比對；只容許重跑時已選設定欄位的差異。每組再核對完整 CONFIG，確保只有允許覆寫。
- firstChain 是首次 depth>=2 的模擬秒數，未發生留空；deepestChain 是全局事件最大深度。沒有逾時局。
- 首四組依指定順序。只有四組均不合格、160→200 呈下降趨勢，才准追加 HP；總組數最多 6。280 依首兩個 HP 結果外推；260 依 200 與 280 結果內插，以逼近 35.6%。這些估計只用來選試值，決策仍依完整實測。
- 選定值與理由：選定 waveEveryTurns=3、waveHpGrowth=260；勝率 30/90（33.3%），距指定 35.6% 目標 2.27 個百分點。
- 完成 6 組、540 局。目標用指定 35.6%；即時參照 32/90 僅為既有資料，不冒充本輪新測。

## 已查證：驗證與交付

- 整套 npm test：79 項、10 檔，全部通過，失敗 0；即時回歸檔保持原樣，直接載入 84d6550ea25a710cb8a65ee8a1a13f4ff3ab5b94 比較完整狀態檢查點。
- Python 獨立核對 11398 項；完整回合驗證 410600 項，全部通過。逐組核對出怪數、波次 HP、輸入、回合、統計與選值。
- 完整回合驗證中引用的即時 90 局只是既有資料一致性核對，不是新跑即時模擬。
- 其他檢查：npx tsc --noEmit、Node/Python 語法與 git diff --check 通過；src 僅 config.ts 的兩個 board 值改變，realtime-baseline.test.ts、src/game.ts 及 drafts/3d-web 來源未改
- 整局驗證：PASS；Edge 157.0.4341.42；自然 lost，18 回合、57 發、終局 Boss HP 8341；console error=0、page error=0、外部請求=0；1280×720 無水平溢出，另通過 390×844 合成觸控、終局鎖定、重來與即時入口檢查
- 建置：`./drafts/3d-web/dist-board2/index.html`；SHA-256：`a8b7559a0ee1853f20fb2269957cc2ad4b9b9aafbe11731c00e45739d08c27d9`。
- 截圖：`../review-board2/board2-desktop.png`；SHA-256：`47b883f87d08af4d8e1bf71a38f1e7f404d6abab660863dc055491975506a5d4`。
- CSV：`../review-board2/runs-sweep2.csv`；540 筆資料＋1 列欄名；SHA-256：`df7f9003b948795e4dbf0140c8a600c790d2e54b75326139e3f8f227c903ad68`。
- 完整逐局資料：`../review-board2` 下的 sweep2-<鍵>-<值>.json；雜湊記於 sweep2-summary.json。CSV、JSON、log 與截圖均在 repo 外，不 commit。
- 本報告另複製至 `../review-board2/BOARD-SWEEP2.md`，切回 main 後仍可閱讀。

## 已查證：資源、範圍與時間

- 開工 date：2026-11-11 15:43:28（Asia/Taipei）。提交並切回 main 後的收工 date、commit、clean 狀態另存 sweep2-closeout.json。
- 掃描累計牆鐘 576.146 秒、CPU 574.500 秒；guard 取樣 RSS 峰值 403.4 MiB。
- 單程序串行掃描，Node heap 上限 1536 MiB、RSS 保守停止線 3 GiB、累計掃描預算 2100 秒，保留 600 秒給驗證；17:00 到時停止。沒有安裝、派工、merge、push。
- dist-board2 已加入本分支 .gitignore；另在本機 .git/info/exclude 加同一路徑，讓切回 main 後保留候選建置且 working tree clean，沒有修改 main 的提交。
- ENTRY v0.14／W-TASK-001 v0.1：有限任務與可重現驗證；依受限 worker 範圍採用本專案 LEARNINGS 的獨立 RNG、完整輸入與證據分層。codebase-memory 索引過時且模擬器無記錄，已直接讀取指定來源補足。

## 已查證：8 個凍結檔

以下開工與報告生成時雜湊均已實讀。commit、切回 main 後再核對並寫入 sweep2-frozen-end.json。

| 完整 Windows 路徑 | 開工 SHA-256 | 收尾核對 SHA-256 |
|---|---|---|
| `./dist/index.html` | `495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83` | `495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83` |
| `./drafts/3d-web/dist/index.html` | `2b6bc04b03331c77c919acd9de9f8229a01d204ab58aea3fbe723b2f386f008b` | `2b6bc04b03331c77c919acd9de9f8229a01d204ab58aea3fbe723b2f386f008b` |
| `./drafts/3d-web/dist-parity/index.html` | `e146515bbab83ce7280b4f5d6cf68ceec2c030c3bbd4b8a03712d2a0a9a14dca` | `e146515bbab83ce7280b4f5d6cf68ceec2c030c3bbd4b8a03712d2a0a9a14dca` |
| `./drafts/3d-web/dist-polish/index.html` | `2c7ed9b4f7c39ae3e93fae9d01bc8b3e7018f924574f34722453bcf3ff1a6db9` | `2c7ed9b4f7c39ae3e93fae9d01bc8b3e7018f924574f34722453bcf3ff1a6db9` |
| `./drafts/3d-web/dist-smooth/index.html` | `be355e0081647fd332141a77e4530cda93736ac663b80d0540e285627170652d` | `be355e0081647fd332141a77e4530cda93736ac663b80d0540e285627170652d` |
| `./drafts/3d-web/dist-style1/index.html` | `95f7f23f36882b890c2e14d4900407c68844c81f7340ba5f0a8e815bc7458880` | `95f7f23f36882b890c2e14d4900407c68844c81f7340ba5f0a8e815bc7458880` |
| `./drafts/3d-web/dist-board/index.html` | `eb42325d409582076a9ae61d7bab7998c91f1945e40f195d6dc8a45ea96a5624` | `eb42325d409582076a9ae61d7bab7998c91f1945e40f195d6dc8a45ea96a5624` |
| `./drafts/3d-web/dist-perf/index.html` | `79c8c24a14a1d00431388a972921206b5bb08b5b0630041e646e12ac9d551eb4` | `79c8c24a14a1d00431388a972921206b5bb08b5b0630041e646e12ac9d551eb4` |

## 已查證：重跑指令

日後在同一 repo、已授權的本機環境重跑。請使用新的輸出目錄，工具拒絕覆蓋既有量測。

```powershell
Set-Location -LiteralPath '.'
git switch tune/board-sweep2
$sweepOut = '../review-board2-rerun'
node --max-old-space-size=1536 tools/run-board-sweep2.mjs --output $sweepOut --budget-seconds 2100 --stop-at ((Get-Date).AddMinutes(35).ToString('o'))
node --max-old-space-size=1536 tools/run-board-sweep2.mjs --output $sweepOut --extra-hp 280 --budget-seconds 2100 --stop-at ((Get-Date).AddMinutes(35).ToString('o'))
node --max-old-space-size=1536 tools/run-board-sweep2.mjs --output $sweepOut --extra-hp 260 --budget-seconds 2100 --stop-at ((Get-Date).AddMinutes(35).ToString('o'))
python tools/verify-board-sweep2.py --directory $sweepOut
$env:NODE_OPTIONS='--max-old-space-size=1024'
npm test -- --maxWorkers=1 --no-file-parallelism
npx tsc --noEmit
node --check tools/run-board-sweep2.mjs
git diff --check
git grep ([char]64 + 'gmail') # 預期 0 筆，無命中 exit code 為 1
git switch main
git status --porcelain=v1
```

## 已查證：候選建置與瀏覽器重跑

```powershell
Set-Location -LiteralPath '.'
git switch tune/board-sweep2
$env:NODE_OPTIONS='--max-old-space-size=1024'
npx tsc --noEmit
npm --prefix drafts/3d-web run bundle -- --outDir dist-board2 --emptyOutDir
node --max-old-space-size=768 tools/verify-board-sweep2-browser.mjs
```

腳本用已安裝的 Playwright／Edge 開啟 `./drafts/3d-web/dist-board2/index.html`，帶 `?mode=board`，viewport 設 1280×720。
結果寫入 `../review-board2/sweep2-browser-verification.json`，以實際 DOM 擲骰／射擊、唯讀 boardEvidence.snapshot 觀測；必須 status=PASS、desktopFinal.game.status 為 won 或 lost，consoleErrors 與 pageErrors 皆空。
腳本最多等待 10 分鐘，未改規則時間或終局狀態。瀏覽器採正弦掃角輸入，與勝率掃描 bot 不同；這一局驗證可操作與無錯誤，不混入 540 局勝率。
T3 預覽初始化曾因 expression 尾端空白被拒絕，接著讀取未初始化狀態失敗；修正後仍約一秒一幀，130 秒牆鐘只推進約 30 秒模擬，故關閉預覽並改用 Edge。T3 未完成資料在 sweep2-preview-incomplete.json，不算整局通過；這兩次工具錯誤不冒充遊戲 console／page error。

## 推論

勝率差異支持這批固定 bot 與 seed 的候選取捨；只用本批樣本選值，尚未以保留樣本檢驗泛化。

## 不確定

- bot 勝率不是玩家勝率，也不代表其他 seed、操作節奏或策略。
- 即時回歸只證明既定輸入與檢查點，不是所有可能輸入的窮舉證明。
- RSS 數字為 guard 取樣；不是整台電腦或所有瞬間的總記憶體量測。
- 本機 Edge 自動化不等於真人體驗或實機手機驗收；T3 預覽未完成，未列為通過證據。

報告生成時間：2026-11-11T16:06:44+08:00。
