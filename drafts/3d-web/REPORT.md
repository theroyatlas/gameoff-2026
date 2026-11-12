# 共振桌 3D polish 交付

2026-11-11。分支 `3d/polish`，基底 `d21994a`。本機作業，沒有 remote、push、GitHub repo、外部服務、額外依賴或付費操作。採用 repo 現有 commit 作者設定。

## 已查證：完成與限制

- 自適應畫質本來就在基底中，沒有重複併入。先對凍結入口做 CPU profiler／Performance trace，再針對實測繪圖提交成本合批靜態同材質零件。
- 每幀 draw call 約 446.85 → 239.94，frame callback 平均 16.38 → 13.38ms。方法、原始檔與限制詳 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\PERFORMANCE.md`。
- 球號使用 26 CSS px 圓牌、30px 中心間距排除重疊，共振／近期碰撞優先；不移動球、不縮字。策略理由在 NOTES.md 三行說明。
- 拖尾預設關閉，只有 `?trail=1` 才開啟實驗效果；低畫質與減少動態仍停用。本批沒有做拖尾美術驗收，正式影像及 FPS 都關閉拖尾。
- `npm test` 6 檔 59/59 通過；`npm run build:polish` TypeScript noEmit 與 Vite 通過，只輸出 dist-polish。
- `npm run verify:polish` 正式規則勝局：201.21 秒、118 發、Boss 歸零；敗局：135 秒、1 發、場上 14 隻怪物，觸發超過十隻的真正敗局條件。沒有球數耗盡或任意 Boss 勝利判定。
- 兩局 console error 0、page error 0；外部 HTTP(S) 請求 0。開始、連鎖、相變、波次、回放、結算可見性及重置、再次鍵盤發射斷言通過。
- 桌面 1280×950：45 球／36 個可見球號；手機 390×844：25 球／15 個可見球號。驗證逐對檢查保留的球號中心至少相距 30px。兩張實際畫面已檢視，拖尾計數均 0；手機是 Edge viewport + CDP 合成觸控，不是實體手機。
- 敗局完整影片長 143.72 秒、1280×950、VP8，包含結算畫面；無音軌。ffmpeg 產生 1704×948 的 4×3 總覽，前六格取勝局前 40 秒，後六格取敗局最後 28 秒，末格可見敗局。
- `src` 與 `artifacts\3d-parity` 相對基底沒有 diff；既有三個 JSON 未更動，新量測 JSON／trace／影片／PNG 均不提交。

WebGL 禁用、renderer 初始化例外與 context 遺失三例皆通過退回檢查，並實際進入凍結 2D 發射一球；page error 全為 0。前兩種故障注入有預期的 Three.js console 診斷，不混入正常勝敗局的零錯誤聲明。40ms rAF 排程延遲驗證畫質 1→2→3、ratio 0.75、效果上限 24，12 次鍵盤發射及第 3 級拖尾停用通過；這不是硬體 FPS。減少動態對 opt-in 拖尾的停用另有整合斷言。

## FPS（4× CPU）

| 段落 | 歷史平均 / 1% low | 本輪修正前 | 修正後 |
|---|---:|---:|---:|
| 平靜 | 35.77 / 12.83 | 67.18 / 19.82 | 80.08 / 14.93 |
| 相變 | 69.88 / 15.82 | 65.86 / 16.58 | 54.19 / 12.74 |

平均平靜已超過 45 FPS；**相較本輪基準，1% low 與相變 FPS 未改善，不能宣稱全部效能目標通過**。每組一次取樣，自適應畫質路徑不同，未鎖定相同檔位；歷史與本輪基準也有顯著波動。

## 新入口與影像

入口：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-polish\index.html`。

SHA-256：`2c7ed9b4f7c39ae3e93fae9d01bc8b3e7018f924574f34722453bcf3ff1a6db9`。

- 桌面密集畫面：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-polish\dense-desktop.png`
- 手機 390×844：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-polish\dense-mobile.png`
- 桌面相變：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-polish\shift-desktop.png`
- 勝局 PNG：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-polish\won-desktop.png`
- 敗局 PNG：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-polish\lost-desktop.png`
- 敗局完整錄影：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-polish\lost-full.webm`
- 勝局完整錄影：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-polish\won-full.webm`
- 12 格總覽：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-polish\sheet.png`

`dist-polish` 已加入 .gitignore；產物目錄列入本機 .git/info/exclude。另以本機排除規則保留建置目錄，讓切回 main 後工作樹仍乾淨。安全命令見 NOTES.md，不可執行其他輸出位置的 build。

## 凍結檔案

| 完整路徑 | 開工 SHA-256 | 驗收 SHA-256 |
|---|---|---|
| D:\Projects\Active\competitions\game-off-2026\g4-resonance\dist\index.html | 495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83 | 495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83 |
| D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist\index.html | 2b6bc04b03331c77c919acd9de9f8229a01d204ab58aea3fbe723b2f386f008b | 2b6bc04b03331c77c919acd9de9f8229a01d204ab58aea3fbe723b2f386f008b |
| D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-parity\index.html | e146515bbab83ce7280b4f5d6cf68ceec2c030c3bbd4b8a03712d2a0a9a14dca | e146515bbab83ce7280b4f5d6cf68ceec2c030c3bbd4b8a03712d2a0a9a14dca |

沒有執行重建或寫入上述三個檔案的命令。

## impeccable audit（實作者自查）

一致性通過：保留木頭、黃銅、青色狀態及既有操作，沒有新增視覺方向。桌面、手機、敗局與 12 格總覽已開啟檢視，未發現本批新阻擋問題，停止視覺擴張。

| 維度 | 分數 /4 | 發現 |
|---|---:|---|
| 無障礙 | 2 | 鍵盤、焦點、狀態文字及減少動態可用；缺完整非視覺遊戲替代 |
| 效能 | 2 | CPU 提交下降；1% low 和相變仍未改善 |
| 響應式 | 3 | 390px 無水平溢出；合成觸控可發射，密集球號分開 |
| 主題 | 3 | 沿用場景與色票；既有字級 ramp 文件不完整 |
| 實作一致性 | 4 | 正式 Game、自然勝敗、拖尾預設關閉，資料可追溯 |
| 合計 | 14/20 | 保留以下限制 |

P1：尾端幀率未穩定改善，Profiler 看見陰影降級時約 1030ms 的 getProgramInfoLog 採樣，後續需針對 shader variant 預熱／轉換做受控實驗。P2：隱藏部分密集球號是明確取捨，完整參與號碼仍見回放。P2：Canvas 非視覺替代與實體手機仍未驗收。

本輪機械偵測跑一次。靜態 HTML 未執行模組 CSS，產生黑色／16px 標題警告；實際畫面為米色明體標題，視為誤報。字級 ramp 提示屬既有文件落差，未擴大修改排版。

## 推論

CPU profile 與合批前後 call 數支持靜態繪圖提交是實際瓶頸之一。shader 轉換可能影響長幀，但 profiler 與 FPS 是不同執行，不主張已對應到每一個慢幀。

## 不確定／未做到

未證明 1% low 的穩定改善；未做 GPU timer、低階 GPU、實體手機、跨瀏覽器、多輪統計或主觀手感驗收。拖尾只保留 opt-in 實驗，未列入本批美術成果。
