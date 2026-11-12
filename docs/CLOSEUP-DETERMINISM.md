# 共振桌跨執行環境重播調查

日期：2026-11-12。規則基準：9595b42e47c75ace0c1ec4c7cd5514c791fa4c7b。
資料目錄：`D:\Projects\Active\competitions\game-off-2026\review-closeup-ab`。

## 已查證

### 第一個不同的 tick 與欄位

- 已重現舊報告的 18037 → 18102 問題；對應原始 `events-300.json` 的 **seed 20261113、lazy bot**。
- tick 1–8411 的逐 tick 狀態摘要相同；另重跑至 tick 8411，完整 JSON 逐字相同。
- **tick 8412** 首次不同：`balls[2].vy`，即球 **#3** 的 y 速度。
  - Node：`329.72132703174367`
  - Edge：`329.7213270317436`
  - Edge − Node：`-5.684341886080802e-14`
- 這個 tick 落在 SURGE：`Game.advanceBoard()` → `applyBoardTile()` → `wake(b, true)`。
- 原始碼位置：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\game.ts` 第 63–67 行；差異來自 `b.vy = Math.sin(a) * nextSpeed`。

### 最小運算證據

從 tick 8411 的相同 RNG 狀態重建 SURGE 的喚醒角度，第 3 球得到：

| 值 | Node | Edge |
|---|---|---|
| random | 0.13907455559819937 | 0.13907455559819937 |
| angle | 0.8738312043371368 | 0.8738312043371368 |
| Math.sin(angle) | 0.7667937837947527 | 0.7667937837947526 |
| Math.cos(angle) | 0.6418935216480426 | 0.6418935216480426 |
| Math.sin(angle) × 430 | 329.72132703174367 | 329.7213270317436 |

`sin` 差 1 ULP。`Math.sin` 的規範允許 implementation-approximated 結果，沒有跨實作逐位相同保證：[ECMAScript 2025 §21.3.2.31](https://tc39.es/ecma262/2025/multipage/numbers-and-dates.html#sec-math.sin)。

環境：Node v24.22.1／V8 13.6.233.17-node.58；Microsoft Edge 157.0.4341.46。兩者使用同一份由目前原始碼打包的 JS，逐 tick 直接呼叫公開規則操作，沒有 RAF、DOM 或角度滑桿。原固定輸入的 angle 直接讀 JSON Number，不轉換為整數角度。

因此第一個差異不是輸入時間點、不固定步長或未 seeded 亂數。規則模組沒有 `Math.random()`、`Date.now()` 或 `performance.now()`；RNG 狀態及輸入直到首個差異時仍相同。Node／Edge 各自在同環境重跑，完整最終快照各自逐字相同。

### 為何在 18037 停住

Edge 在 tick 18037 已完成第 13 回合、進入 `roll`；Node 輸入紀錄的第 14 回合擲骰在 tick 18102。`Game.step()` 在 `board.phase === 'roll'` 本來就不前進 tick，因此等待 18102 的重播器無法再前進。這是較早的浮點差異累積後造成的回合時序不同，不是該 tick 才開始出錯。

### 修法判斷與規則邊界

**沒有修改規則或數值，也沒有宣稱跨環境重播已修好。** `src\` 相對指定基準沒有任何差異。將速度取整、加 epsilon、換 sin 實作或改成整數物理，都可能改變碰撞與勝負，無法同時承諾原有數值逐位不變；本任務採用允許的「浮點證據＋勝率影響」交付路徑。

新增的比較器把「首個狀態差異」與「回合停滯」分開記錄，讓重播失敗可診斷。bot 的 `aim`／`boardAim` 原樣抽到可同時在 Node、瀏覽器載入的 `tools\bot-aim.ts`，既有模擬器重新匯出相同介面，沒有換策略。

### 勝率與影響樣本

1. 原 Node 90 局重跑：seed 20261111–20261140，random／greedy／lazy 各 30 局，HP 成長 300。結果 **35/90，38.8889%**。90 筆完整記錄（含發射、骰子及卡牌）全部與原 `events-300.json` 相同。
2. 跨環境樣本：seed 20261111–20261120，三種 bot，各環境 **30 局**。同一個 seed 和 bot 各自在自身規則狀態上自然選下一步；這是端到端 bot 結果比較，不是強制沿用已分歧的另一環境 tick 紀錄。

| 結果 | 數量 |
|---|---:|
| Node 勝局 | 8/30（26.7%） |
| Edge 勝局 | 7/30（23.3%） |
| 配對勝負相同 | 21/30 |
| 配對勝負不同 | **9/30（30%）** |
| Node 勝、Edge 敗 | 5 |
| Node 敗、Edge 勝 | 4 |

不能因總勝率只差 3.3 個百分點，就說單局差異可忽略。

### 原始證據與重跑

以下檔案全在 `D:\Projects\Active\competitions\game-off-2026\review-closeup-ab\`：

- `node-tick-hashes.csv`、`edge-tick-hashes.csv`：逐 tick 摘要。演算法為 FNV-1a32＋DJB2-32；完整目前狀態加只追加歷史的滾動摘要，沒有捨去浮點小數。這是定位用摘要，並非密碼學碰撞證明；首個差異另外直接比較完整 JSON。
- `first-divergence-states.json`：tick 8411、8412 的 Node／Edge 完整狀態。
- `wake-math-samples.json`：相同 RNG 喚醒角度與 sin/cos/速度輸出。
- `runtime-comparison.json`、`trace.log`：版本、首個欄位、停滯 tick、同環境重跑與錯誤計數。
- `node-final.json`、`edge-final.json`：固定輸入重播的最後快照。
- `events-300-closeup.csv`、`events-300-closeup.json`、`simulation-recount.json`：90 局原 bot 回歸與逐筆原紀錄比對。
- `cross-runtime-bots.csv`、`cross-runtime-bots.json`：30 組配對勝負。
- `determinism-probe.js`、`determinism-probe.html`：本輪兩環境使用的同一份打包診斷程式，不連外。

在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance` 執行：

```powershell
node tools\compare-runtimes.mjs 20261113 lazy
node tools\compare-runtimes.mjs 20261113 lazy --trace-only
node tools\run-event-cards.mjs events-300-closeup 300 ../review-closeup-ab
npm test
```

## 推論

- 微小浮點差異經碰撞與共振分支放大，足以改變回合結束、下一回合 RNG 消耗與最終勝負。首個差異及後續勝負已量測，但未逐一追出後面所有因果分支。
- Node 模擬仍可用來比較同環境內的調參趨勢；它的 35/90 不能直接當作 Edge 的 90 局勝率。配對結果已顯示跨環境單局不可互換。
- 若之後需要跨環境逐位重播，應另訂版本化數學／物理契約並重新驗收基準；這超出本輪「規則與數值不能改」的範圍。

## 不確定

- 沒有調查 Edge 所帶 V8 的原生 sin 實作或編譯器變更；確定的是同角度得到不同 Number，不能只憑版本號指認某一個底層 commit。
- 30 組配對只供影響估計，不能斷言所有 seed 的差異率固定 30%，也不能代表真人勝率。
- 早期另試 seed 20261111／greedy 曾先在 tick 4887 的 `balls[9].vx` 出現差異；正式原始資料以精確重現舊問題的 20261113／lazy 為準。
