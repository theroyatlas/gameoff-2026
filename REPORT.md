# 共振灰盒：平衡調參與回饋驗證

驗證日期：2026-11-10。唯一規格：D:\Projects\Active\competitions\game-off-2026\g4-resonance\SPEC.md。
本輪基準 commit：badd584。只做本機修改與 commit，無 remote、無 push、無上傳。沒有新增執行時依賴，未刪除 node_modules 或 .npm-cache。

## 已查證：本輪結論

目前採用的參數達成「哇出現率」「隨機策略敗率」「平均時長」三項數字目標，**瞄準 Boss 的勝率優勢未達標**。這是本輪已測候選中採用的折衷，不宣稱全域最佳，也不代表真人爽感已驗收。

每種策略各用相同 40 個種子：20261110–20261149。第一發在 tick 0，之後每 240 ticks（2 秒）一發；固定步長 1/120 秒。操作 RNG 與遊戲 RNG 分離，保留遊戲本身的扇形隨機偏移。

- 隨機上方（random-up）：方向為正上方 ±60°，均勻取樣。
- 瞄準 Boss 附近（boss-near）：目標 y 固定為 Boss 中心，x 在 Boss 中心左右一個半徑內均勻取樣。策略不讀未來、不找精確落點。
- 最長模擬 600 秒；逾時獨立列出且仍計入平均，不當作敗局。本輪前後均無逾時。
- 「哇」按既有 chainId 聚合爆發事件：Boss 實扣傷害 ≥ 最大 HP 的 25%、同鏈擊殺 ≥3 個不同怪物、最大深度 ≥8。一般接觸傷害不灌入爆發連鎖。
- 最終 Boss HP 為 3000，因此大傷害門檻是 **750**，沒有偷用固定 25 傷害放寬驗收。
- 任一「哇」是三條件聯集；同一局可同時列在多個欄位。

| 策略／階段 | 勝／敗／逾時 | 勝率 | 平均發數 | 平均秒數 | 任一哇 | Boss ≥25% | 三殺 | ≥8 層 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 隨機上方／調參前 | 40／0／0 | 100% | 22.475 | 43.784 | 4／40 | 1／40 | 0／40 | 3／40 |
| 隨機上方／調參後 | 32／8／0 | 80% | 65.975 | 130.823 | 40／40 | 22／40 | 19／40 | 40／40 |
| 瞄準 Boss／調參前 | 40／0／0 | 100% | 21.475 | 41.900 | 2／40 | 1／40 | 0／40 | 1／40 |
| 瞄準 Boss／調參後 | 28／12／0 | 70% | 64.175 | 127.032 | 40／40 | 10／40 | 18／40 | 40／40 |

調參後：任一哇皆為 100%，且三種都有出現；隨機敗率 20%；兩種策略平均皆在 2–5 分鐘內。瞄準勝率反而低 10 個百分點，不能以平均快 3.79 秒代替勝率驗收。

機器證據：
- D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\balance-before.json
- D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\balance-after.json
- D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\balance-validation-m900.json：選定候選的完整 40 種子驗證，與寫入 config 後重跑的摘要一致。
- D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\balance-validation-m1000.json：較高怪物 HP 候選，隨機敗率 45%，超出上限，未採用。
- 各 JSON 的 games 記錄每局勝負、發數、秒數、最大連鎖深度、最大同鏈傷害／擊殺。after 另列短時間連鎖例子的跨度與最長事件間隔。
- 其他 balance-search1、pressure、choice、rebound、contact、finalists、deadline 檔為 8 或 12 種子的探索資料，**不能當作 40 局驗收**。部分探索批次提前停止，只將實際產生的檔案視為完成。

## 已查證：調整的參數與規則邊界

設定檔：D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\config.ts。

| 參數 | 調參前 | 調參後 | 目的 |
|---|---:|---:|---|
| ball.friction | 0.075 | 0.12 | 減少長時間漂移，理論無碰撞停止約 76.5 → 47.8 秒 |
| resonance.radiusInBalls | 2（28 px） | 6（84 px） | 增加球群能接上點燃的機率；同頻範圍仍倍增 |
| boss.hp | 100 | 3000 | 延長建立球群的時間，對應調高接觸傷害 |
| monsters.hp | 3 | 900 | 讓場邊怪物能累積成實際失敗壓力 |
| damage.normal | 1 | 10 | 提高直接碰到目標的貢獻 |
| damage.resonant | 5 | 25 | 保留共振接觸較強的差異 |
| damage.burstExtra | 10 | 10 | 爆發額外傷害不變，靠連鎖累加 |
| feedback.damageMergeTicks | 無 | 24（0.2 秒） | 合併同一位置連續傷害浮字 |

HP 與傷害的絕對值變動較大，是純參數折衷；怪物目前需要多次接觸／爆發才會死亡。是否讓玩家感覺目標太硬，仍需真人試玩，不以數字達標代替感受。

沒有改變碰撞震盪規則，因此不新增牆壁開關。SPEC 第 3 節的「發生碰撞時」及共振後「不論撞到什麼」均保留，牆壁仍可累積並觸發爆發。閾值 5、點燃 +2、三種材質、反彈係數、每五發一隻怪物、超過十隻失敗均保留。
扇形仍無軌跡或落點預測、爆發自動、球永久留場、震盪數字不顯示。R3／R5 不執行，其介面保留。SPEC 未修改。

## 模擬與重跑指令

需 Node.js 22.12 以上；本輪使用 Node.js 24.22.1、npm 11.19.1、既有 Vite／Vitest／Playwright。

~~~powershell
Set-Location 'D:\Projects\Active\competitions\game-off-2026\g4-resonance'
npm run sim
npm run sim -- --label after
npm run sim -- --label reproduce-before --cases artifacts/tuning-before.json
npm run sim -- --label validation --cases artifacts/tuning-validation.json
npm test
npm run build
npm run smoke
~~~

一般 sim 輸出 D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\balance-current.json。label 決定檔名；案例 JSON 只在模擬程序內覆寫設定，不寫回遊戲 config。探索可加 --count 8 或 --count 12，正式驗收省略此參數，固定跑全部 40 種子。
入口 D:\Projects\Active\competitions\game-off-2026\g4-resonance\scripts\run-balance.mjs 使用已安裝 Vite 載入 TypeScript，未監聽 HTTP／WebSocket；直接呼叫實際 Game.fire／Game.step，沒有另外複製物理實作。

開發與試玩：
~~~powershell
Set-Location 'D:\Projects\Active\competitions\game-off-2026\g4-resonance'
npm run dev
~~~
或直接以瀏覽器開啟 D:\Projects\Active\competitions\game-off-2026\g4-resonance\dist\index.html。此檔是內嵌 JS／CSS 的靜態成品，無 CDN。乾淨環境才需 npm ci；既有依賴與快取完整保留。

## 已查證：必要驗證

| 指令／檢查 | 實際結果 |
|---|---|
| npm test | exit 0；2 檔案、28／28 passed；原 25 個規則案例保留，只更新相關數值／範圍邊界與殘血測試值 |
| 模擬計分測試 | 另加 3 個案例：chainId 隔離與 25% 比例、三個不同怪物／八層、逾時不隱藏 |
| npm run build | exit 0；TypeScript 檢查與 Vite 建置成功；HTML 17.04 kB，gzip 6.90 kB |
| npm run smoke | exit 0；passed: true；本機 msedge |
| 瀏覽器冒煙 | 10 次實際滑鼠拖拉、10 顆球永久保留、偏移在扇形內、重來重置與 file URL 開啟通過 |
| 錯誤／外部請求 | console error 0、page error 0、外部請求 0 |
| 連鎖畫面 | 另以測試頁 RAF 時鐘加速及實際滑鼠事件，捕捉 20261110、tick 6300、26 發、8 層；不屬固定策略的平衡統計 |
| 手機尺寸 | 390 × 844，無水平溢出；不是實體手機／觸控驗收 |

最後一次一般冒煙為 6 次爆發、Boss 2950 HP，僅描述那次滑鼠時序，不是平衡驗收。
證據目錄 D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts：
smoke-result.json、smoke-desktop.png、smoke-mobile.png、aim-desktop.png、feedback-desktop.png、feedback-mobile.png。

## 已查證：浮字處理與 impeccable audit

沿用 D:\Projects\Active\competitions\game-off-2026\g4-resonance\DESIGN.md 的灰盒限制，未建立新美術方向。

- 同目標位置、0.2 秒內的連續傷害合併成一個浮字；事件仍記各次實際傷害。
- 所有文字在特效圓之後繪製；八層以上連鎖、傷害、其他文字依序優先。
- 以實際文字寬高檢查重疊，向上錯開；最多嘗試八格，無空間時省略低優先文字，特效圓仍保留。位置限制在畫布內。
- 已一起檢視桌面／390px 的八層連鎖截圖，標示有分開。這是有限次自查，不是所有密度均保證可讀。

| audit 面向 | 分數 | 結論 |
|---|---:|---|
| 無障礙 | 2/4 | 保留原生按鈕、焦點及 reduced-motion；核心仍依賴視覺與指標 |
| 效能 | 3/4 | 無新套件；浮字合併，新增文字避讓的兩兩比較未做極端壓測 |
| 響應式 | 2/4 | 無溢出；Canvas 等比縮小後手機文字仍偏小 |
| 外觀一致性 | 3/4 | 保留既定灰盒、系統字型與灰階 |
| 實作完整性 | 3/4 | 本次畫面中的浮字／連鎖分開，極密集時會省略低優先文字 |
| 合計 | 13/20 | 局部修正完成，非完整無障礙或正式美術驗收 |

機械 detector 對 index.html 回報一個 flat-type-hierarchy warning，exit 1；把 h1／h2 都讀成 16px。實際 CSS 為 h1 24px、h2 22–32px，且截圖可見，判為未解析外部 CSS 的誤報。此結果與上方三個 npm 指令均成功分開列示。

## 第 3 天建議試玩種子

1. **20261113**：隨機上方策略 138.642 秒獲勝；同鏈最大 Boss 傷害 1195（39.83%）、擊殺 5 隻、最大 75 層。其中有一段 2.95 秒內達 11 層的連鎖例子。
2. **20261124**：瞄準 Boss 策略 126.392 秒獲勝；同鏈最大 Boss 傷害 1040（34.67%）、擊殺 3 隻、最大 88 層。

上列三種最大值可能來自不同鏈，不宣稱同一瞬間同時達成。
開始畫面在「亂數種子」輸入框全選原數字，輸入建議種子，按「開始」。已開局時先按右上角「重來」，回到開始畫面再填。
種子只重現亂數序列，**必須相同發射時刻與方向才會重現模擬結果**；真人不同操作不保證出現相同連鎖。建議約每兩秒一發，分別試上方分散發射與 Boss 附近發射。
請記下連鎖能否被看懂、單次清場是否明顯、HP 上升後是否太拖；真人爽感由試玩者決定。

## 推論：未達標的原因與下一步

瞄準 Boss 比隨機分散更少照顧場邊怪物；當怪物耐久提高，失敗壓力會抵消其較快擊中 Boss 的優勢。高摩擦／低反彈的探索也出現瞄準較慢，推測碰撞後球群堆在 Boss 下方，後續球先撞球群。這些是由模擬差異與規則推導，未做獨立因果實驗，不能當成已證明原因。
本輪不增加引力、怪物 AI、手動爆發等系統來湊策略優勢。若下一輪仍要求該優勢，應先討論目標配置與策略定義是否符合「下注」設計紀律，再做有限參數試驗。

## 不確定與已知限制

- 連鎖依現有 chainId 記錄，可隔一段時間繼續；大傷害／三殺統計可能跨數十秒，**不是保證瞬間完成**。after 的 wowExamples 附跨度與最大間隔，供檢查。8 層雖有實際畫面證據，真人是否說「哇」仍未知。
- 全部固定種子也用於候選篩選，沒有獨立 holdout；40 局比例不是普遍勝率保證，亦不宣稱統計顯著。
- P2：手機場內字級仍小；沒有鍵盤發射、實機觸控或非視覺替代玩法。
- P2：極端密集特效與大量球的效能尚未驗收；物理兩兩碰撞為 O(n²)，採固定步離散碰撞。
- 未驗證 Chrome 獨立執行、跨 JS 引擎位元級一致性、實際託管平台與真人完整勝敗體驗。
- R3 相變、R5 回放面板、音效、旁白與正式美術維持未實作。

## 工作流紀錄

開工依本機 ENTRY → 情境索引 → W-TASK-001 v0.1（draft／trial）讀取，適用本次明確範圍的派工與驗收；以現有任務取代額外工作單。重要分岔依實測候選保留證據，未更換模型或再派工。收尾核對 SPEC、規則測試、實際截圖、模擬 JSON 與本機 git 差異；尚未達標的策略優勢維持明列。
