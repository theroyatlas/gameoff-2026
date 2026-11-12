# 共振桌平衡測量工具

在 repo 根目錄執行，使用既有 Node、依賴與本機 Microsoft Edge，不下載瀏覽器、不連線到遊戲服務：

```powershell
node tools/balance-compare.mjs --config tools/balance-baseline.json --out ../review-balance-tool/baseline --expect-node-wins 35
node tools/balance-compare.mjs --verify --out ../review-balance-tool/baseline
```

輸出目錄必須為空或尚未建立，避免覆蓋既有證據。repo 內只接受已忽略的 `.preview/` 子目錄；其他輸出請放 repo 外。工具不呼叫任何既有 dist 建置命令。

## 設定與參數

`--config` 必填，JSON 只列要覆蓋的欄位，例如 `{"board":{"waveHpGrowth":300}}`；`{}` 沿用全部預設。來源是 `src/config.ts`。工具先深層合併，再由 esbuild 的記憶體 loader 注入設定，**不寫回來源檔**，模組載入時計算的常數也使用覆蓋後的值。未知鍵、錯誤型別、非有限數字與非正數 dt 會報錯。陣列完整替換且須保留原長度及各位置欄位；這是工具輸入限制，不改遊戲規則。

| 參數 | 預設 | 說明 |
|---|---|---|
| `--config` | 無 | 覆蓋 JSON 路徑，依目前工作目錄解析 |
| `--out` | 無 | 輸出目錄，依目前工作目錄解析 |
| `--seed-start` | 20261111 | 第一個 seed；後續連續遞增 |
| `--node-seeds` | 30 | 每個 seed 跑三種 bot；1–500 個 seed |
| `--edge-seeds` | 10 | Node 樣本的前 N 個 seed；1 至 node-seeds |
| `--expect-node-wins` | 不檢查固定勝局數 | 如不符合就保存 Node CSV 並停止，尚未啟動 Edge |
| `--verify` | 關閉 | 只讀兩份 CSV 重算，核對 summary；不啟動模擬 |
| `--help` | 關閉 | 顯示用法 |

參數路徑依目前工作目錄解析；規則來源固定使用工具所在 repo，不依工作目錄猜測。測試範例：

```powershell
node tools/balance-compare.mjs --config tools/balance-baseline.json --out ../review-balance-tool/sample --node-seeds 2 --edge-seeds 1
npm test
```

## 執行協定

- Node 預設 90 局，Edge 預設 30 局。每個 seed 的順序固定為 random、greedy、lazy。
- 兩邊執行同一份 `balance-bundle.js`，共用 `tools/determinism-probe.ts` 的 `run`，與 `tools/compare-runtimes.mjs` 相同，bot 來自 `tools/bot-aim.ts`。不透過 DOM、RAF 或角度換算，仍保留兩秒發射間隔與原 seeded RNG。
- Node 與 Edge 都在自己的狀態上自然選下一步，不把 Node 的 tick 輸入強迫套在 Edge 上。測試另將新 bundle 的完整單局快照與 `simulateBoard` 比對。
- 每局最多 600 秒遊戲時間；尚未結束記為 `timeout`，計入分母但不算勝局，summary 另列數量。
- Edge 使用 Playwright `msedge` channel 的 headless 本機瀏覽器，開啟輸出目錄的 `file:` 頁面；context 設為 offline，阻擋 HTTP(S)、service worker，並關閉背景網路與元件更新。沒有啟動網站伺服器。
- 勝率不能代表真人表現；不同執行環境的浮點差異仍存在。Node 大樣本與 Edge 子集分母不同，summary 額外列相同 seed/bot 的 Node 子集。

## 輸出與驗證

| 檔案 | 內容 |
|---|---|
| `node.csv`、`edge.csv` | seed、bot、won（0/1）、turns、cards（JSON 陣列）、status、ticks、shots、bossHp |
| `summary.md` | 整體與各 bot 的勝局、局數、勝率；配對子集與勝負不同組數 |
| `run.json` | 覆蓋值、完整生效設定、設定 SHA-256、來源與 bundle SHA-256、commit、Node/V8/Edge 版本、開始/結束時間、各階段秒數、資源紀錄及驗證狀態 |
| `resources.json` | 獨立監測程序的記憶體、CPU 抽樣與停止原因，異常中止時仍可讀取 |
| `balance-bundle.js`、`balance.html` | 本輪實際使用的規則 bundle 與離線載入頁面 |

`configSha256` 是 `JSON.stringify(config)` UTF-8 位元組的 SHA-256；`overridesSha256` 同理。`inputFileSha256` 保留原輸入檔文字（含空白）的雜湊，`sourceConfigSha256` 則對來源原始位元組計算。

工具寫出 CSV 後會重新讀回，正確處理卡牌 JSON 的逗號、引號、換行，再重算所有勝率與配對差異，逐字核對 summary。`--verify` 可日後獨立重跑；欄位錯誤、重複 seed/bot、勝負與 status 不符、缺少 Node 配對或 summary 不符均以非零 exit code 結束。測試有已知一勝一敗的資料及刻意竄改 summary 的失敗案例。

## 資源邊界

此版本的完整執行需要 Windows PowerShell 與本機 Edge。Node 局數在單一子程序循序執行，Node worker 的 heap 上限 1536 MiB，Edge V8 heap 上限 1024 MiB。獨立 PowerShell 監測每秒加上查詢耗時，遍歷本次 runner 的程序樹（含監測器、esbuild 與 Edge 子程序），累加 working set 與 private bytes。任一值到達保守的 3.5 GB 停止線，或抽樣 CPU／牆鐘到達 1740 秒，停止本次程序樹，為 4 GB／1800 秒上限保留餘裕。不按程序名稱終止其他使用者的 Node 或 Edge。

記憶體數字是抽樣峰值，不是作業系統硬性配額；抽樣 CPU 累積各已觀測程序的 lifetime CPU，短於抽樣間隔且未被觀測的子程序可能漏計。報告保留這些界線，不宣稱量到瞬間峰值。硬中止時 `run.json` 可能仍顯示 running；須以非零 exit code 與 `resources.json` 的 stopReason 判斷未完成，不使用未完成輸出做平衡結論。

Edge 每完成一組三種 bot，以每 seed 實測耗時乘 1.5 倍餘裕估算剩餘可跑數；如果超過預算，縮小尚未執行的 Edge seed 數，並在 console 與 `run.json.warnings` 記錄原局數及新局數。完整實際局數寫在 `protocol.actualEdgeSeeds`，不可把縮小後結果當成原要求的 30 局。

## 首次基準驗收（2026-11-12）

規則來源為 main `8bbc8b0`，設定 `waveHpGrowth=300`。原始輸出在 `../review-balance-tool/baseline/`。

| 樣本 | Node | Edge |
|---|---:|---:|
| 整體 | 35/90（38.8889%） | 7/30（23.3333%） |
| random | 11/30（36.6667%） | 2/10（20.0000%） |
| greedy | 9/30（30.0000%） | 3/10（30.0000%） |
| lazy | 15/30（50.0000%） | 2/10（20.0000%） |
| 配對子集 | 8/30（26.6667%） | 7/30（23.3333%） |

- 配對勝負不同 9/30；兩端未完局均為 0。Edge 未縮減樣本。
- 總牆鐘 200.577 秒；Node 150.803 秒，Edge 47.411 秒。
- 152 次程序樹抽樣：working set 峰值 1,006,047,232 bytes，private bytes 峰值 780,087,296 bytes，抽樣 CPU 211.390625 秒。未達任何停止線。
- CSV 讀回重算與 summary 一致；獨立 `--verify` 通過。Node 90 局的 seed、bot、status、turns、shots、ticks、bossHp、cards 與原 `../review-event-cards/events-300.json` 逐筆相同，差異 0。
- `npm test`：18 個測試檔、106 個測試全部通過；`npx tsc --noEmit` 通過。新增測試涵蓋設定注入與來源位元組不變、錯誤覆蓋、單局快照回歸、CSV 重算與刻意竄改的失敗案例。
- 18 個指定凍結檔的開工與收工 SHA-256 均符合指定值，兩次逐字一致；紀錄在 `../review-balance-tool/frozen-start.json`、`../review-balance-tool/frozen-end.json`。`src/` 相對 main 無差異，四個既有建置資料夾只新增忽略規則。
- 另外以 `waveHpGrowth=301`、`boss.hp=1` 執行 Node 3 局及 Edge 3 局的設定覆蓋 smoke；兩端設定核對通過，來源未改。此 smoke 只驗證工具，不作平衡結論，輸出位於 `../review-balance-tool/override-smoke/`。
- 第一次啟動遇到 Windows PowerShell 5.1 將無 BOM UTF-8 腳本誤讀的解析錯誤，在任何遊戲模擬前停止；監測腳本改用 ASCII 字元後通過。失敗紀錄保留於 `../review-balance-tool/baseline-startup-failed-utf8/`。
