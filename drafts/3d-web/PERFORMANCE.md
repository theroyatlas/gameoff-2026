# 3D 效能與 WebGL 退回驗證

## 已查證

- 從 b0a57ec 建立獨立分支；src 與展示轉接器均未修改。
- 沿用工具索引 T-CREATIVE-20 的 three.js 路線與既有木頭／黃銅方向；沒有新增依賴或工具選型。
- 暖機兩秒後，每三秒計算實際幀間隔平均；持續低於 45 FPS 時每窗下降一級：關陰影 → renderer 與 composer pixel ratio 同步乘 0.75（底限 0.5）→ 碰撞擴散環只保留四分之一、同時特效上限由 96 減至 24。原型沒有點狀粒子發射器，因此減量對象是既有擴散環與點燃線；球、身份標籤、相變網與玩法都保留。
- 不自動升級，避免震盪。頁面隱藏時不採樣，回到頁面重新暖機。
- `?quality=low` 使用 pixel ratio 1、關閉抗鋸齒、512×512 陰影與 low-power 提示；正常入口保留原本初始化畫質。
- 無 WebGL、renderer 建立例外及 WebGL context 遺失均顯示說明與 2D 連結，停止顯示失效 Canvas 與操作指示。
- 相對連結由 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\settings.ts` 的 TWO_D_URL 設定，目前為 ../../../dist/index.html。兩版合併封裝時依檔案配置修改此常數。
- 唯一 3D 建置輸出：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-perf\`。
- npm test：4 檔、51/51 通過，包含暖機、短暫卡頓、45 FPS 邊界、依序降級與隱藏重設。根目錄 TypeScript noEmit 通過；3D 由 Vite 7.2.2 打包通過。

## 本機實測效能

Playwright channel msedge；Edge 157.0.4341.42；1280×950；deviceScaleFactor=1。GPU 實際回報 NVIDIA GeForce RTX 5060 Ti / ANGLE D3D11。CDP Emulation.setCPUThrottlingRate 分別設 4、6；頁面使用 quality=low，讓降畫質照常運作。

兩組皆以相同方向序列約每 0.8 遊戲秒做一次真實滑鼠拖拉，共 32 次；物理時間與相變均由正式 Game 執行，沒有植入球或強制相變。實際輸入 tick 仍受系統負載影響，兩次球軌跡並不完全相同。

| CPU 節流 | 段落 | 平均 FPS | 1% low FPS | 幀間隔數 | 採樣秒數 |
|---|---|---:|---:|---:|---:|
| 4× | 平靜 | 51.79 | 18.20 | 517 | 9.982 |
| 4× | 相變 | 37.85 | 2.13 | 226 | 5.971 |
| 6× | 平靜 | 70.04 | 15.07 | 700 | 9.995 |
| 6× | 相變 | 75.31 | 21.20 | 373 | 4.953 |


平靜段：最後一發後等待 18 遊戲秒，接著取約 10 秒 idle 幀（4× 為 44.25–54.25 遊戲秒；6× 為 44.05–54.05）。結束快照均為 32 顆球留場。相變段取所有 active 的連續幀間隔，跨段幀不計。平均 FPS = 幀間隔數 / 總秒數；1% low = 1000 / 最慢 ceil(N×1%) 個幀間隔的平均毫秒數。沒有刪除長幀。截圖在採樣結束後擷取。

4× 相變跨過畫質級別 0、1、2，包含降級轉換；6× 在相變前已到第 3 級。因此這是自動降畫質啟用時的兩次執行紀錄，不能用來斷言更強 CPU 節流更快。每段只有一次採樣，1% 尾段為 3–7 個幀間隔，數字不穩定性較高。

首次 15 發試跑沒有自然相變，因此未列入正式表格。第一輪僅保留錯誤輸出；補存原始資料的重跑保存在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\perf-3d\pilot-no-shift.json`，完整揭露，不算通過。

完整原始幀、輸入、GPU 設定、降級紀錄與樣本：
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\perf-3d\cpu-4x.json`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\perf-3d\cpu-6x.json`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\perf-3d\performance.json`

兩組正常呈現皆無 console error、page error 或外部網路請求。降級整合測試另外用實際 40ms 排程延遲，確認級別 1→2→3、陰影關閉、renderer/composer ratio 都是 0.75、特效上限 24，以及十二次鍵盤發射；這是人為負載測試，數字未混入效能表。

## WebGL 退回實測

| 情境 | 方法 | 結果 |
|---|---|---|
| WebGL 禁用 | --disable-gpu --disable-webgl --disable-webgl2 | 說明與連結可見，沒有白畫面 |
| renderer 建立失敗 | 測試端讓 WebGL getContext 丟例外 | 同上 |
| context 遺失 | WEBGL_lose_context.loseContext() | 同上，停止繪圖 |

三者的 1280px 與 390×844 截圖均已開啟檢視，說明與按鈕可讀，沒有橫向溢出；每個案例都用鍵盤啟動相對連結，成功開啟凍結的 2D 成品、開始並發射一球。page error 全為零；禁用 WebGL 與注入例外時 three.js 會輸出預期的 renderer 診斷 console error，未宣稱這兩例 console 全乾淨。

證據目錄：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\perf-3d\`。

fallback-disabled-desktop.png、fallback-disabled-mobile.png；fallback-renderer-failure-desktop.png、fallback-renderer-failure-mobile.png；fallback-context-lost-desktop.png、fallback-context-lost-mobile.png。細節見 fallback.json。

## impeccable audit（實作者自查）

實作一致性通過。所有正常場景與退回桌面／手機截圖均已檢視；維持場景外觀，降級後影像較粗、無陰影是預期取捨。

| 維度 | 分數 /4 | 結論 |
|---|---:|---|
| 無障礙 | 2 | 退回說明與鍵盤連結可用；Canvas 非視覺遊戲替代仍不足 |
| 效能 | 2 | 自動降級實測有效；4× 相變仍有長幀 |
| 響應式 | 3 | 390px 無溢出，退回按鈕至少 44px；3D 球號仍小 |
| 主題 | 3 | 退回沿用現有色票；字級文件未全列入結構化 ramp |
| 實作一致性 | 4 | 遊戲模擬未變更，退回可實際到達 2D |
| 合計 | 14/20 | 功能完成，效能與手機仍有邊界 |

P1：4× 相變 1% low 2.13 FPS，玩家會感到停頓；位置 main.ts 的畫質轉換與呈現流程。後續應另做 GPU/CPU profiler，定位長幀後再針對 shader 編譯或幾何負載改善，不能僅靠平均 FPS 宣稱順暢。P2：手機球號小（既有 3D 標籤），可另案調整手機 sprite 尺寸。P2：Canvas 缺完整非視覺替代，建議加入語意事件摘要。

機械偵測的字級警告屬稀疏 ramp 文件與既有尺寸（29/17/13px 已在設計正文），退回標題 20–28px 為此次狀態說明；黑色 h1 警告來自靜態 HTML 未載入模組 CSS，實際截圖為米色標題，屬誤報。無新阻擋項目，停止視覺擴張。

## 推論

關陰影與降低解析度能減少 GPU 負載；降級轉換時的 shader 編譯及兩輪不同負載時序可能影響尾端幀時間，但未用 GPU profiler 定位因果。6× 的較高數字不能當成硬體效能改善證明。

## 不確定與未做

- 沒有真實低階 GPU／實體手機。CDP 是 CPU 節流，pixel ratio／抗鋸齒／陰影只改繪圖預算，並非等效 GPU 節流。
- 沒有多輪統計、長時間大量球數壓力、跨瀏覽器或 itch 部署驗收。
- 未達成穩定 45 FPS 保證，仍保留上述長幀風險；需求中的低 FPS 自動依序降級已完成。
- 未合併、未上傳、未新增 remote 或依賴。

## 安全重現

切至 perf/3d-fallback；工作目錄 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\`。

依序執行 `npx --no-install vite build --outDir dist-perf --emptyOutDir`、`node verify-perf.mjs`、`node verify-fallback.mjs`、`node verify-quality.mjs`。效能量測時不要同時跑其他測試或瀏覽器。

不可使用預設 bundle/build，亦不可重建兩個凍結輸出。
