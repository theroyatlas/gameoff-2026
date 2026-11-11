基準 commit：`a90eb9c73bcc5ea66d56a3e88d8d37a89f2d49be`（analysis/board-difficulty）；規則來源 `e7f6eaeb01f5ee1b614d1fea23ac155f52498b86`。

# 棋盤出怪間隔量測

**結論：BLOCKED。3 為 89/90（98.9%），4 為 90/90（100.0%），兩者都高於 45% 上限；不選候選值，src 保留 2，不輸出 dist-board2。**

## 已查證：總體結果

時間、回合與 HP 均為中位數。局長秒數是模擬時間，不含真人思考；敗局統計只計敗局，無敗局記不適用，不補零。2 的資料直接引用 a90eb9c 的既有資料，未重跑。

| waveEveryTurns | bot | 勝率 | 局長秒數 | 局長回合 | 敗局回合 | 終局 Boss HP | 敗局 Boss HP |
|---:|---|---:|---:|---:|---:|---:|---:|
| 2 | all | 0/90（0.0%） | 207.06 | 18.00 | 18.00 | 6891.00 | 6891.00 |
| 3 | all | 89/90（98.9%） | 293.58 | 26.00 | 24.00 | 0.00 | 4274.00 |
| 4 | all | 90/90（100.0%） | 295.99 | 26.00 | 不適用（無敗局） | 0.00 | 不適用（無敗局） |

即時目標為 32/90（35.6%），引用同一基準報告。3 與目標差 63.29 個百分點，4 差 64.40 個百分點（按指定 35.6% 計）；3 雖較接近，仍觸發「兩者皆在 25%–45% 外」的硬性停止條件。**選定值：無；保留值：2。**

## 已查證：各 bot 分項

| waveEveryTurns | bot | 勝率 | 局長秒數 | 局長回合 | 敗局回合 | 終局 Boss HP | 敗局 Boss HP |
|---:|---|---:|---:|---:|---:|---:|---:|
| 2 | random | 0/30（0.0%） | 186.07 | 16.00 | 16.00 | 7956.50 | 7956.50 |
| 2 | greedy | 0/30（0.0%） | 207.00 | 18.00 | 18.00 | 7042.50 | 7042.50 |
| 2 | lazy | 0/30（0.0%） | 207.10 | 18.00 | 18.00 | 6549.50 | 6549.50 |
| 3 | random | 30/30（100.0%） | 291.23 | 25.00 | 不適用（無敗局） | 0.00 | 不適用（無敗局） |
| 3 | greedy | 30/30（100.0%） | 295.15 | 26.00 | 不適用（無敗局） | 0.00 | 不適用（無敗局） |
| 3 | lazy | 29/30（96.7%） | 293.89 | 26.00 | 24.00 | 0.00 | 4274.00 |
| 4 | random | 30/30（100.0%） | 296.28 | 26.00 | 不適用（無敗局） | 0.00 | 不適用（無敗局） |
| 4 | greedy | 30/30（100.0%） | 295.92 | 26.00 | 不適用（無敗局） | 0.00 | 不適用（無敗局） |
| 4 | lazy | 30/30（100.0%） | 295.07 | 26.00 | 不適用（無敗局） | 0.00 | 不適用（無敗局） |

候選 3 唯一敗局：lazy，seed 20261111，第 24 回合，278.7083333333333 模擬秒，Boss HP 4274。候選 4 沒有敗局。兩個候選均沒有逾時或未完整輪。

## 已查證：方法與資料

- 同一套 random、greedy、lazy；每值每 bot 固定 seed 20261111–20261140，共 90 局。每 seed 依序跑 3 與 4 各三 bot，完整六局才納入。
- 直接呼叫未修改的 tools/board-difficulty-sim.ts simulateBoard；它重用 tools/difficulty-sim.ts 的 bot。固定 dt=1/120 秒、射擊間隔 2 秒、自然擲骰與結算，每局最多 600 模擬秒。
- 只有 tools/run-board-waves.mjs 在記憶體覆寫 CONFIG.board.waveEveryTurns，完成後還原。每次執行比對全部 src 與兩份 bot 模組，除允許重跑時來源 config 的該數字外，必須等同基準。這次實際 src 沒有任何改動。
- firstChain 為首次 depth >= 2 的模擬秒數，無事件留空；firstChainTurn 另列回合。deepestChain 為整局最大事件深度。
- 逐局 CSV：`D:\Projects\Active\competitions\game-off-2026\review-board2\runs-waves.csv`；270 筆資料＋1 列欄名。包含基準值 2 的 90 局與新測值 3、4 的 180 局，provenance 區分來源。
- CSV SHA-256：`55ae0f6f8511b26f81f8fcdf6d4fda1149b0ee9bcf951d646cb24d060e07378e`。
- 完整逐局 JSON（含輸入、擲骰、波次、曲線與終局 snapshot）：`D:\Projects\Active\competitions\game-off-2026\review-board2\waves-summary.json`。SHA-256：`84e15baf53b5028a5f360112d891b9baf89e9742be6f92d2931e5bf3f8c21ea5`。
- 引用基準：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\board-difficulty\summary.json`。SHA-256：`d80f5825728153affb0553afb8bc1ec7b9f54f03a8feee192d506a9eed629657`，與 a90eb9c 報告記錄一致。
- CSV、JSON、執行 log 與驗證輸出皆在 repo 外，不 commit。

## 已查證：驗證結果

- npm test 整套：10 個測試檔、79 項全過，失敗 0。tests/realtime-baseline.test.ts 原樣執行，與固定 84d6550ea25a710cb8a65ee8a1a13f4ff3ab5b94 的完整狀態檢查點一致。測試檔未修改。
- npx tsc --noEmit、node --check 與 git diff --check 均通過。src、drafts/3d-web 及 .gitignore 與 a90eb9c 完全相同。
- Python 獨立核對 3965 項通過（樣本、CSV、基準逐局引用、勝敗、中位數與停止決策）；既有完整回合驗證器對 3 為 79573 項、對 4 為 78627 項，全部通過。
- 回合驗證器的即時資料為引用既有 90 局，沒有新跑即時模擬；它們逐局等同基準原始 JSON。不要把這項資料核對稱為新跑 90 局即時模式。
- BLOCKED 路徑沒有 build、沒有 dist-board2、沒有瀏覽器整局驗證或新截圖；console/page error 數量因此未量測，不能填 0。
- 未產生檔案：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-board2\index.html`；SHA-256 不適用。
- 未產生截圖：`D:\Projects\Active\competitions\game-off-2026\review-board2\board2-desktop.png`；SHA-256 不適用。
- 測試 log：`D:\Projects\Active\competitions\game-off-2026\review-board2\npm-test.log`；資料驗證：`D:\Projects\Active\competitions\game-off-2026\review-board2\waves-verification.json`。

## 已查證：完整重跑指令

在相同本機資料仍存在、已授權重跑時執行。日後重跑會更新 repo 外量測輸出；程式拒絕不符雜湊的基準資料。

```powershell
Set-Location -LiteralPath 'D:\Projects\Active\competitions\game-off-2026\g4-resonance'
git switch tune/board-waves
node --max-old-space-size=2048 tools/run-board-waves.mjs --budget-seconds 1800 --stop-at ((Get-Date).AddMinutes(30).ToString('o'))
python tools/verify-board-waves.py --directory 'D:\Projects\Active\competitions\game-off-2026\review-board2'
$env:NODE_OPTIONS='--max-old-space-size=1024'
npm test -- --maxWorkers=1 --no-file-parallelism
npx tsc --noEmit
node --check tools/run-board-waves.mjs
git diff --check
git grep ([char]64 + 'gmail') # 預期 0 筆；無命中 exit code 為 1
git switch main
git status --porcelain=v1 # 預期無輸出
```

本次實際量測命令（停止線早於指定截止）：

```powershell
Set-Location -LiteralPath 'D:\Projects\Active\competitions\game-off-2026\g4-resonance'
node --max-old-space-size=2048 tools/run-board-waves.mjs --budget-seconds 1800 --stop-at '2026-11-11T16:05:00+08:00'
```

## 已查證：時間、資源與邊界

- 開工 date：2026-11-11 15:28:08（Asia/Taipei）。收工 date、提交與 main clean 狀態另存 repo 外 closeout.json。
- 新測 180 局：牆鐘 380.061 秒、CPU 329.672 秒；guard 取樣 RSS 峰值 754.7 MiB。Windows 途中讀得主程序歷史峰值 1140900 KiB；這與 guard 取樣時間不同，不能互換。
- 模擬 heap 上限 2 GiB、RSS guard 3 GiB、計算預算 1800 秒；測試單 worker，Node heap 上限 1 GiB。未達 45 分鐘計算上限或 17:00 停止線。
- 只試 3 與 4，沒有測其他數字或參數。沒有建置、merge、push、套件安裝或派工。
- ENTRY v0.14／W-TASK-001 v0.1：採用有限任務與可重現驗證。已查經驗索引，本次無需套用跨專案案例；本專案 LEARNINGS 的獨立 RNG、完整輸入記錄與數值／體驗證據分開均適用，直接採用。
- codebase-memory 覆蓋顯示索引過時／檔案尚未納入；已讀當前來源作判斷，不依舊索引推斷完整性。

## 已查證：8 個凍結檔

報告生成時再次核對，下表開工與結束核對值一致。commit、切回 main 後再核對的結果另存 frozen-end.json；不重建任何凍結檔。

| 完整 Windows 路徑 | 開工 SHA-256 | 結束核對 SHA-256 |
|---|---|---|
| `D:\Projects\Active\competitions\game-off-2026\g4-resonance\dist\index.html` | `495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83` | `495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83` |
| `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist\index.html` | `2b6bc04b03331c77c919acd9de9f8229a01d204ab58aea3fbe723b2f386f008b` | `2b6bc04b03331c77c919acd9de9f8229a01d204ab58aea3fbe723b2f386f008b` |
| `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-parity\index.html` | `e146515bbab83ce7280b4f5d6cf68ceec2c030c3bbd4b8a03712d2a0a9a14dca` | `e146515bbab83ce7280b4f5d6cf68ceec2c030c3bbd4b8a03712d2a0a9a14dca` |
| `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-polish\index.html` | `2c7ed9b4f7c39ae3e93fae9d01bc8b3e7018f924574f34722453bcf3ff1a6db9` | `2c7ed9b4f7c39ae3e93fae9d01bc8b3e7018f924574f34722453bcf3ff1a6db9` |
| `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-smooth\index.html` | `be355e0081647fd332141a77e4530cda93736ac663b80d0540e285627170652d` | `be355e0081647fd332141a77e4530cda93736ac663b80d0540e285627170652d` |
| `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-style1\index.html` | `95f7f23f36882b890c2e14d4900407c68844c81f7340ba5f0a8e815bc7458880` | `95f7f23f36882b890c2e14d4900407c68844c81f7340ba5f0a8e815bc7458880` |
| `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-board\index.html` | `eb42325d409582076a9ae61d7bab7998c91f1945e40f195d6dc8a45ea96a5624` | `eb42325d409582076a9ae61d7bab7998c91f1945e40f195d6dc8a45ea96a5624` |
| `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-perf\index.html` | `79c8c24a14a1d00431388a972921206b5bb08b5b0630041e646e12ac9d551eb4` | `79c8c24a14a1d00431388a972921206b5bb08b5b0630041e646e12ac9d551eb4` |

## 推論

在這組固定策略與 seed 中，把出怪間隔由 2 拉到 3 已讓通關率大幅超出指定目標；單靠此次允許的兩個候選無法滿足門檻。本結論不授權額外調參。

## 不確定

- 30 個固定 seed 與三種 bot 不能代表真人勝率；不宣稱所有 seed 或所有策略都有相同結果。
- 無頭規則模擬不驗證畫面、操作手感、真實裝置效能或瀏覽器錯誤；BLOCKED 亦未產生候選建置供上述驗收。
- 即時回歸證據涵蓋固定測試輸入與檢查點，不宣稱枚舉所有可能輸入。

報告生成時間：2026-11-11T15:39:05+08:00。
