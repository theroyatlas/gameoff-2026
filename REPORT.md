# 第一週灰盒交付

驗證日期：2026-11-10。唯一功能規格：D:\Projects\Active\competitions\game-off-2026\g4-resonance\SPEC.md。

## 已查證：安裝、執行、建置、測試

本機驗證環境：Node.js 24.22.1、npm 11.19.1、Vite 7.3.8、Vitest 3.2.7、已安裝的 Microsoft Edge。需要 Node.js 22.12 以上。

未完成的交付清理：第三方套件與 npm 暫存有 215 個檔案含 email 格式，非遊戲作者資料。嘗試移除 D:\Projects\Active\competitions\game-off-2026\g4-resonance\node_modules 與 D:\Projects\Active\competitions\game-off-2026\g4-resonance\.npm-cache，兩次均被自動審核以 `blocked by policy` 拒絕，未提供具體理由，因此目錄仍在本機，不能宣稱「整個資料夾任何檔案都不含 email」。兩者已被 gitignore 排除，不進 commit 或 dist；交付原始碼、文件、截圖與 dist 的 email 格式掃描為 0。直接玩成品不需套件；乾淨環境重跑需先安裝。

首次安裝與開發，於 PowerShell 執行：

```powershell
Set-Location 'D:\Projects\Active\competitions\game-off-2026\g4-resonance'
$env:npm_config_cache = "$PWD\.npm-cache"
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

開啟終端顯示的本機網址；停止伺服器按 Ctrl+C。另一個 PowerShell 視窗可執行：

```powershell
Set-Location 'D:\Projects\Active\competitions\game-off-2026\g4-resonance'
npm test
npm run build
npm run smoke
```

冒煙程式自行啟動並關閉本機 Vite，優先使用 `channel: msedge`，未安裝時嘗試 `chrome`；兩者均無則失敗，不下載瀏覽器。

成品：D:\Projects\Active\competitions\game-off-2026\g4-resonance\dist\index.html。

`base: './'`，建置後 CSS 和 JavaScript 內嵌，無 CDN、字型或其他外部請求；已實測 Edge 以 file URL 直接開啟並開始遊戲。若要製作上傳包，把 dist 內容放在 ZIP 根目錄，使 index.html 位於最外層。本次沒有上傳或建立遠端服務。

## 怎麼玩

1. 按「開始」，在下方發射圈按住滑鼠，朝想射的方向拖拉後放開。
2. 外圈越亮越接近共振，雙圈球下次碰撞會爆發；同材質放大、異材質干擾，球永遠留在場上。
3. Boss HP 歸零就贏，怪物超過 10 隻就輸；按「重來」回到開始畫面，整局歸零。

## 已查證：功能與測試結果

| 驗證 | 實際結果 |
|---|---|
| `npm test` | **25 passed / 25，1 個測試檔通過，0 failed** |
| `npm run build` | **exit 0**，TypeScript 檢查與 Vite 建置成功；HTML 約 16.39 kB，gzip 約 6.59 kB |
| `npm run smoke` | **exit 0 / passed: true**，實際使用 `msedge` |
| 滑鼠冒煙 | 10 次拖拉全部成功、10 顆球保留、實際發射角均在扇形內 |
| 最後一次冒煙快照 | 7 次爆發，Boss HP 96；此數據只代表該次輸入時序，不是爽感通過證據 |
| 瀏覽器錯誤／外部請求 | console error 0、page error 0、外部資源請求 0 |
| 窄畫面 | 390 × 844 視窗無水平溢出，已存圖並檢視 |
| 重來 | 瀏覽器確認球、怪物、事件、接觸紀錄、發射數清空，Boss HP 回到 100 |
| 直接開檔 | dist/index.html 以 file URL 開啟、按開始、進入 playing 通過 |

單元測試涵蓋：零值初始狀態、閾值與下一次碰撞爆發、冷卻、半徑邊界點燃、連鎖 ID／層數、實際固定步牆壁連鎖、同頻倍增、異頻動量與延後、一般／共振／範圍傷害、怪物每五發生成與場邊位置、勝敗優先序、終局凍結、貼合不重複計數、角度偏移與材質輪替、無效輸入、種子零、動量傳遞、重疊分離、牆壁反彈、摩擦、球不刪除、同種子同輸入的完整快照一致、三種狀態的完全重置。

實作範圍：M1、S1、R1、R2 層 A／B、E1、E2、R4、開始與勝敗／重來畫面。R3 與 R5 不執行；`simultaneousResonanceCount`、`inputs`、`events` 已預留。

## 已查證：截圖與證據路徑

- 冒煙桌面：D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\smoke-desktop.png
- 冒煙窄畫面：D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\smoke-mobile.png
- 拖拉扇形：D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\aim-desktop.png
- 機器結果：D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\smoke-result.json

這些圖片是實際 Edge 遊戲畫面，不是示意圖。截圖不含個人資料；交付文字與成品的 email 格式掃描為 0。Git 使用使用者允許的本機佔位身份，無 remote。

## 調參位置與主要參數

全部遊戲參數集中於 D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\config.ts。

| 參數 | 預設值與用途 |
|---|---|
| `seed` / `dt` | 20261110；1/120 秒固定步長 |
| `ball` | 半徑 14、速度 620、反彈係數 0.96、摩擦 0.075、停止速度 2 |
| `launcher` | 固定位置 (400,622)、扇形半角 12 度、最短拖拉 12、發射間隔 28 ticks |
| `resonance.threshold` | 5 次震盪進入共振 |
| `resonance.radiusInBalls` / `ignite` | 半徑 2 倍球半徑＝28；點燃 +2 |
| `resonance.cooldownTicks` | 爆發後 18 ticks＝0.15 秒，不累積震盪 |
| `sameFrequencyMultiplier` | 2：點燃範圍、點燃量、爆發傷害都倍增 |
| `interferenceMomentum` / `interferenceTicks` | 速度保留 45%；48 ticks＝0.4 秒後，下一次碰撞才能爆發 |
| `materials` | 實心、環紋、雙紋，三種頻率，依發射順序輪替 |
| `boss` | 幾何中心 (400,340)，HP 100、半徑 48 |
| `monsters` | 每 5 發生成、HP 3、半徑 21、超過 10 隻失敗 |
| `damage` | 普通接觸 1、共振接觸 5、範圍爆發額外 10 |
| `feedback` | 傷害浮字／爆發／點燃／目標閃光時長 |

調整後需重新建置。亂數種子也可在開始畫面直接設定。

## 規格未定細節的實作決定

以下是推論補足，不宣稱是 SPEC 原文：

- 球為等質量剛體，靜止靶不動；只在「新的接觸」計數，避免貼合每一幀扣血。
- 異頻共振球減速、保留共振，延後 0.4 秒後需再次碰撞才釋放，不以計時器自動爆發。
- 同頻兩球各釋放一次雙倍爆發，共用連鎖 ID；兩球先進入冷卻，避免同一釋放互相重新點燃。
- 點燃半徑採球心距離；目標只要圓形與爆發範圍相交就受傷。傷害不得低於 0 HP，浮字與事件記錄實際扣除量。
- 同一步同時滿足勝敗時，Boss 死亡優先判勝。
- 發射速度固定，拖拉只控制方向；短間隔防止重疊輸入。初始場地沒有球；怪物與球共用唯一 ID，所以球號可能跳號。
- 同種子重現必須配合同一組「固定步時間＋發射方向」。滑鼠自動化使用真實時間，因此兩次冒煙的傷害或爆發數可能不同；確定性由固定步單元測試核對。
- 事件紀錄包含爆發對目標的傷害；沒有實作回放播放、事件匯出 UI 或相變觸發。

沒有替換物理引擎、改動 SPEC 的明定數值或增加規格外玩法。灰盒設計文件僅整理本次已指定的外觀限制，未決定正式美術。

## 已查證：impeccable audit 與一次修正

檢查方式：本機程式與 CSS、Edge 桌面／390px 截圖、一次機械 detector。非獨立評審。

| 面向 | 分數 | 證據／限制 |
|---|---:|---|
| 無障礙 | 2/4 | 原生按鈕、標籤、焦點框、終局 status；遊戲核心仍依賴視覺及指標操作 |
| 效能 | 3/4 | 小型獨立 HTML、固定步長、短期特效清理；未做大量球效能壓測 |
| 響應式 | 2/4 | 窄畫面無溢出，但球號及場上文字偏小；未測實機觸控 |
| 外觀一致性 | 3/4 | 遵循固定灰階灰盒；不提供主題切換 |
| 實作完整性 | 3/4 | 扇形、球身份、HP、爆發、點燃與傷害可見；密集浮字會重疊 |
| 合計 | **13/20** | 灰盒可用，正式視覺與完整無障礙尚未驗收 |

機械 detector 回傳 1 個 `flat-type-hierarchy` warning，命令 exit 1。它把標題和內文都判為 16px；實際 CSS 的 h1 為 24px、h2 為 22–32px，並已在畫面確認，故列為未解析匯入 CSS 的誤報，沒有宣稱 detector 零警告。

一次修正：補上終局種子欄位的 hidden 樣式、明確標示點燃、Boss 置於幾何中心；之後重建並重跑單元與冒煙、桌面／手機截圖確認。

## 已知問題與不確定

- **P2，窄畫面閱讀**：D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\main.ts 的場內字體隨 Canvas 縮小，390px 視窗球號約 5px，手機閱讀不佳；本週主要驗收是滑鼠桌面。建議之後做獨立手機字級與操作尺度。
- **P2，回饋重疊**：同檔案的浮字與連鎖標示在密集碰撞時會互相遮擋。建議真人試玩後再決定排序／合併方式，不在本週加新系統。
- **P2，無障礙範圍**：沒有鍵盤發射或非視覺替代玩法，不能宣稱 WCAG 完整通過。已保留 reduced-motion 下的靜態外圈，停用顫動與脈動。
- **未驗證**：實體手機、實體觸控、Chrome 獨立執行、不同 JS 引擎的位元級一致性、itch.io 實際託管環境。
- **未驗證**：真人完整勝敗體驗、三殺／Boss 單鏈 25%／八層連鎖的出現機率，以及 SPEC 的「哇」成功標準。勝敗規則與重置已由單元測試核對；瀏覽器冒煙沒有刻意跑到終局。
- **實作限制**：圓碰撞採固定步離散求解，兩兩檢查為 O(n²)，未驗證極密集堆球與極端調參速度；不宣稱為高精度通用物理引擎。
- R3 相變、R5 回放面板、音效、旁白與正式美術依本週範圍不製作。

## 第 3 天試玩請注意三件事

1. 不看數字，只看亮度和外圈，能否快速指出「哪一顆快共振」及「哪一顆已共振」？材質內圈是否與共振外圈混淆？
2. 連鎖發生時，能否分清爆發、點燃、同頻放大與異頻干擾，並看懂傷害落在 Boss 還是怪物？
3. 一局有沒有自然出現讓你說「哇」的時刻？記下是三殺、Boss 大幅掉血或多層連鎖，以及此前自己選的發射方向。
