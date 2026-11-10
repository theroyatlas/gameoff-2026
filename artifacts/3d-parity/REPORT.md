# 共振桌：3D 完整一局驗收

日期：2026-11-11。分支 `3d/parity`，起點 `perf/3d-fallback`（3b572ad）。只在本機提交，不合併、推送、上傳、安裝服務或使用外部素材。

## 怎麼開

以 Microsoft Edge 直接開啟 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-parity\index.html`。不需伺服器或網路。

按「開始」，從下方發射座朝場內拖拉後放開；左右方向鍵瞄準、空白鍵發射。Boss 歸零獲勝，怪物超過十隻失敗。「重來」回到開始畫面；種子相同且輸入 tick 相同可重現。右上可靜音。

安全重現：切至 `3d/parity`，在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance` 依序執行 `npm test`、`npm run build:parity`、`npm run verify:parity`。禁止執行預設 `build`／`bundle`。節流測試在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web` 執行 `node verify-parity-perf.mjs`；相容性測試執行 `node verify-parity-compat.mjs`。

## 已查證：完成範圍

- adapter 直接重新匯出正式 Game，沒有覆寫波次、傷害、勝負或重置。正常 Boss HP 12000，第一波 15 秒、波間 30 秒；半血且超過寬限期後升級一次。怪物正常扣血、死亡，不回血。
- 怪物依 Game 在場邊生成；黃銅幾何籠以升起、展開、旋轉呈現生成，受擊發亮，死亡粒子散開。
- 發射後座、依力道的撞擊停格、粒子、鏡頭微震；漸進發光、點燃線、爆發環、連鎖層數與真正的相變網。停格只延遲畫面，固定時步物理繼續。
- 球號為面向相機的標籤，以 CSS 螢幕尺寸保底；細黃環表示接近共振，雙青環表示已共振。相變狀態使用深底 HTML 牌，不受粒子或鏡頭微震遮擋。
- 傷害字由世界座標投影成螢幕位置，再移到怪物血條上方。手機傷害文字至少 14px。可讀性採螢幕尺寸保底、提高狀態牌層級與傷害字上移的做法。
- 回放 HTML 小卡直接讀取 Game.replays：層數、參與球號、擊殺與 Boss 傷害；桌面右側，手機場地下方。球號序列是事件首次參與順序，不代表唯一因果路徑。
- 直接 import 共用 Sound，沒有複製音效或修改 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\src`。第一次手勢才建立 AudioContext，支援靜音。
- 開始、種子、Boss 血條、波次、壓力升級、下一球、勝負與重來。保留自動降畫質與 WebGL 退回。

流程：ENTRY v0.14、T-CREATIVE-20 v0.3，沿用 three.js、WebAudio、Playwright、ffmpeg。使用者已指定木頭／黃銅方向，沒有另選視覺方向。codebase-memory 索引為非即時資料，結構查詢後以實際原始碼逐檔確認。

## 已查證：測試與自動遊玩

- `npm test`：5 檔、56／56 通過；新增完整規則接線、自然波次失敗與重置、半血升級與勝利、傷害字位置、共振辨識測試。2D 測試維持通過。
- `npm run build:parity`：TypeScript noEmit 與 Vite 7.2.2 成功；唯一建置輸出是 dist-parity，約 602 kB 單一 HTML。
- `npm run verify:parity`：Playwright `channel: msedge`、1280×950、正式規則與自然時鐘。201.6 遊戲秒獲勝，118 發，2 次完整相變，最高 46 層，顯示 32 次回放。開始畫面、波次提示、連鎖文字、相變、回放及勝利畫面均有可見性斷言。
- 完整初始 snapshot 與重來後 snapshot 深度相等；球、怪物視覺、粒子、傷害字、事件計數與回放均清空。再次開始後鍵盤成功發射一球。
- 一般流程 console error 0、page error 0、外部 HTTP(S) 請求 0。音訊正常啟動且產生聲部；靜音按鈕狀態斷言通過。
- 手機為 Edge 390×844 模擬視窗及 CDP 合成觸控，第 29 發自然相變；沒有水平溢出。不是實體手機測試。
- 原始狀態、輸入 tick、事件與重置證據：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-parity\edge.json`。發射策略前 32 發約每 0.8 秒，之後每 2 秒；角度為 −π/2 + sin(發射序號) × 0.6。瀏覽器負載會改變實際輸入 tick，沒有把離線試算視為同一局。

## 影像

目錄：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-parity`。

- `start-desktop.png`、`shift-desktop.png`、`outcome-desktop.png`：1280px 寬。
- `start-mobile.png`：390×844；`shift-mobile.png`：390px 寬完整頁面。
- `demo-40s.webm`：完整錄影的前 40 秒，無音軌，不進版控。
- `sheet.png`：ffmpeg 每 10/3 秒取一格，4×3 共 12 格。

所有五張截圖及聯絡表都已由實作者開啟檢視；沒有獨立視覺審查。影片含發射、波次、連鎖、相變與釋放，完整勝利另由整局自動驗證和勝利截圖證明。

## 和 2D 的差異

規則、種子亂數、固定時步、音效與回放資料共用。3D 採單一木頭／黃銅視覺，沒有 2D 的三種配色選擇；球仍在平面運動，沒有跳躍、堆疊或 3D 剛體。相機、粒子和籠子呈現由 3D 實作，這些手感與視覺效果不能只靠規則相同宣稱完全等同。

## impeccable audit：實作者自查

一致性通過：延續已指定材質、幾何與相變顏色。桌面及手機畫面均已檢視。機械偵測的黑色標題與 16px 同級文字是靜態 HTML 沒有執行模組 CSS 的誤報；實際截圖有米色大標、本文與控制項層級。字級 ramp 提示是設計文件結構未列齊實際字級，屬文件限制。

| 維度 | 分數 /4 | 發現 |
|---|---:|---|
| 無障礙 | 2 | 鍵盤、觸控、狀態文字與減少動態可用；缺完整非視覺遊戲替代 |
| 效能 | 2 | 降畫質保留；大量球與相變仍須留意長幀 |
| 響應式 | 3 | 無橫向溢出；手機相變牌和球號可讀，密集標籤仍接近 |
| 主題 | 3 | 木、黃銅與青色狀態一致；部分幾何色值在場景內定義 |
| 實作一致性 | 4 | 使用正式規則，沒有強制相變或展示靶 |

## 推論

共用同一個 Game 能避免兩種呈現的規則分歧；實際操作仍因投影和發射時間不同而產生不同結果。雙環加色彩提供兩種共振辨識線索；這是實作者視覺判斷，未取得使用者試玩回饋。

## 不確定與已知問題

- 手感、音色主觀聆聽、重玩意願與使用者偏好未驗收，不做評價。
- 密集球群的標籤可能靠近或互相遮住，手機尤其明顯；球數超過百顆時也有畫面密度與效能風險。未做標籤避讓或額外鏡頭操作。
- 球號採螢幕尺寸保底，因此手機標籤相對球體較大；玻璃、反光、幾何細節為即時程式材質，不宣稱寫實成片品質。
- CPU 節流不等於低階 GPU；未測其他瀏覽器、實體觸控、低階顯示卡或長時間多局。量測僅一次，不保證穩定幀率。
- 瀏覽器整局為勝利路徑；失敗路徑由正式 Game 的自然波次單元測試覆蓋，沒有額外錄製敗局。
- 未加入 2D 的速度拖尾；需求列出的後座、停格、粒子、微震、漸亮、點燃、連鎖、傷害與回放均已接入。沒有背景音樂或旁白。

## 執行環境註記

整局驗收在約 115 遊戲秒處發生環境長停頓；原始 quality.history 記有極長幀，沒有刪除。201.6 秒指遊戲時間，不是牆鐘時間。不能把這次整局錄影當成流暢度保證。效能量測另開獨立 Edge，沒有同時錄影或跑其他測試。第一次效能啟動與數個 shell 讀取命令停住，已停止該啟動；改以不載入 shell profile 的命令重跑，沒有採用未完成的樣本。原因未做系統級定位。


## 已查證：CPU 4 倍節流

本機 Edge 157.0.4341.42，Playwright channel msedge，1280×950、deviceScaleFactor=1；NVIDIA GeForce RTX 5060 Ti／ANGLE D3D11。CDP Emulation.setCPUThrottlingRate=4，入口加 `?quality=low`，自動降畫質啟用。32 次真實滑鼠拖拉；沒有植入球、強制換相、加速時鐘或改寫規則。

| 段落 | 平均 FPS | 1% low FPS | 幀間隔數 | 採樣秒數 |
|---|---:|---:|---:|---:|
| 平靜 | 35.77 | 12.83 | 356 | 9.9529 |
| 相變 | 69.88 | 15.82 | 349 | 4.9941 |

平靜窗為 44.5333–54.5333 遊戲秒，32 顆球留場；相變取連續 active 的 rAF 間隔。平均 FPS = 間隔數 / 總秒數；1% low = 1000 / 最慢 ceil(N×1%) 個間隔的平均毫秒。兩段尾端各只有 4 個間隔，沒有去掉長幀。沒有同時錄影，截圖不在採樣內。

此算法與共用效能量測一致，是 rAF 回呼間隔；撞擊停格會略過 composer.render，因此不是「每秒不同畫面」的計數。相變與平靜的場上事件、降級時序不同，不能用此表推論相變較省資源。平靜段低於 45 FPS，沒有達成穩定 45 FPS 保證。

降級紀錄：5.6833 秒關陰影、7.8667 秒解析度降為 0.75、16.9333 秒進入效果減量；最終陰影關閉、renderer／composer pixel ratio 皆 0.75、特效上限 24。正常量測 console／page error 0、外部請求 0。

原始幀與設定：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-parity\cpu-4x.json`；摘要 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-parity\performance.json`。

## 凍結與交付雜湊

建置入口：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-parity\index.html`

SHA-256：`e146515bbab83ce7280b4f5d6cf68ceec2c030c3bbd4b8a03712d2a0a9a14dca`

| 凍結檔案 | 開工 SHA-256 | 收工 SHA-256 |
|---|---|---|
| D:\Projects\Active\competitions\game-off-2026\g4-resonance\dist\index.html | 495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83 | 495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83 |
| D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist\index.html | 2b6bc04b03331c77c919acd9de9f8229a01d204ab58aea3fbe723b2f386f008b | 2b6bc04b03331c77c919acd9de9f8229a01d204ab58aea3fbe723b2f386f008b |

沒有執行會寫入上述兩個 dist 的命令。dist-parity 已列入分支 .gitignore；另以本機 .git/info/exclude 保留交付輸出與證據，切回 main 時不將它們顯示為未追蹤修改。影片不進版控。

## 已查證：退回與降畫質整合

`node verify-parity-compat.mjs` 通過：禁用 WebGL、renderer 建立例外、context 遺失三種情境皆顯示可操作退回連結，桌面與 390px 無水平溢出；實際開啟凍結的 2D 成品並以鍵盤發射一球。page error 全為 0。前兩種故障注入有 three.js 預期的 console 診斷，未把它們算成一般流程的零錯誤聲明。

另以 40ms rAF 排程延遲驗證降級 1→2→3、陰影關閉、renderer／composer ratio 0.75、效果上限 24，並成功鍵盤發射 12 球。這是功能測試，不列入 FPS 表。證據為 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-parity\compatibility.json`。

P1 效能：CPU 4 倍節流平靜段平均 35.77 FPS，未達穩定 45 FPS；需另做 CPU/GPU profiler 才能判定瓶頸。P2 可讀性：密集球號尚無避讓。這些限制保留於報告，停止視覺擴張。
