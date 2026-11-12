# 共振桌：操作與驗證

離線入口：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-polish\index.html`。

按開始後，從下方黃銅發射座朝場內拖拉並放開；或方向鍵瞄準、空白鍵發射。Boss 歸零獲勝，怪物超過十隻失敗；沒有球用完的敗局條件。重來回到開始畫面。第一次操作啟動音效。

規則、波次、傷害、種子與音效仍由共用 Game／Sound 提供，`D:\Projects\Active\competitions\game-off-2026\g4-resonance\src` 沒有修改。

## 球號策略（三行）

採螢幕空間避讓：26 CSS px 圓牌的中心至少相距 30 px，碰撞者隱藏低優先標籤。
共振球及最近一秒碰撞球優先，同權重按固定球號決定，避免畫面密集時把號碼疊成一團。
不移動實際球或縮小字級；空間足夠仍顯示所有球號，完整參與球號保留於連鎖回放。

## 速度效果與畫質

預設不顯示拖尾。只有網址加 `?trail=1` 才開啟實驗尾帶；減少動態偏好或畫質第 3 級仍強制關閉。所有正式截圖、錄影、總覽與 FPS 都使用預設關閉狀態。

實驗尾帶使用真實速度：低於或等於 220 px/s 不顯示，速度上升時漸長、漸亮，1850 px/s 達 1.35 場景單位上限。此效果未作本批美術驗收。

自適應畫質與 WebGL fallback 原本就存在，本批保留它們。Profiler 確認 CPU 繪圖提交成本後，只對靜態同材質零件合批，不改 HUD、相變幾何、後處理或畫質降級政策。

## 安全重現

切至 `3d/polish`，在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance` 執行 `npm test`、`npm run build:polish`、`npm run verify:polish`。

其餘檢查在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web` 執行 `node verify-polish-perf.mjs`、`node verify-polish-fallback.mjs`、`node verify-polish-quality.mjs`。效能量測獨立執行，不與其他瀏覽器驗證同時進行。

只能用 `build:polish`；不要執行預設 build、bundle、build:parity 或其他輸出位置的建置。三個凍結 HTML 均不得寫入。

截圖、影片、量測及原始輸入保存在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-polish`，透過本機 Git exclude 排除；新建置目錄列入 .gitignore，不提交大型產物。
