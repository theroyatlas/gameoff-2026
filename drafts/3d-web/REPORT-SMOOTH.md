# 共振桌 3D smooth 交付

2026-11-11。分支 `3d/smooth`，自 `3d/polish` 的 `7438bac9f4dc970a7c02fe4107f38b79433a2efd` 建立。repo 無 remote，沒有 push、安裝依賴、外部服務或付費操作。

## 已查證：結果

CPU 4×、新舊各三輪，同機相同操作流程。中位數：

| 段落 | dist-polish 平均 / 1% low | dist-smooth 平均 / 1% low |
|---|---:|---:|
| 平靜 | 88.25 / 25.73 | 97.42 / 27.31 |
| 相變 | 80.26 / 17.40 | 94.82 / 19.43 |

兩段 1% low 中位數提高；相變平均中位數高於 65.9。所有正式樣本皆第 0 級、陰影開啟、像素比例 1。六輪全部數字、每一個 >50ms 間隔、逐幀診斷原因與推論邊界在 `./drafts/3d-web/PERFORMANCE.md`，本機副本 `./artifacts/3d-smooth/PERFORMANCE.md`。

## 已查證：修正範圍

- 開始前以 renderer.compile 與實際離屏 composer 管線預熱球及效果材質，保留代表材質以維持 shader cache；有／無陰影各預熱並還原。
- 相同波紋共享不可變 TorusGeometry，保留材質、半徑、時間、透明度及裁切，不更改效果數量與外觀。
- HUD 只更新變動文字／血量；同一幀的投影共用 rect，減少同步 layout。
- 沒改 2D src、遊戲規則、手感參數、畫質門檻、相變網線、粒子策略、樣式或美術資產。沒有無證據的池化、instancing 或遲滯。

## 已查證：驗證

- npm test：6 檔，59/59 通過。
- npm run build:smooth：通過；只建置 dist-smooth。根目錄 TypeScript 檢查沿用現有 tsconfig 範圍，不冒稱涵蓋全部 3D 型別。
- 完整勝局：220.10 秒、128 發、Boss 0；console 0、page error 0、外部 HTTP(S) 請求 0。
- 完整敗局：135.00 秒、1 發、場上 14 隻怪物、Boss 尚存；console 0、page error 0、外部 HTTP(S) 請求 0。
- 兩局結算可見；重置後狀態與最初一致，球／怪物／粒子／事件清空，再次鍵盤發射成功；勝局逐次檢查可見球號中心距離至少 30px。
- 另外用 Python 重新計算全部 12 段的平均 FPS／1% low，與 JSON 一致；六輪畫質、錯誤及對外請求檢查通過。
- 合成 40ms 排程延遲：既有降級 1→2→3、陰影關閉、ratio 0.75 通過；第 1 級 callback 90.0→19.2ms，shader 呼叫 53.5→3.4ms、links 10→1。此合成診斷不列入 FPS。
- 桌面 1280×950 與手機 390×844 在 reduce-motion 穩定開始畫面的新舊 PNG 位元組完全一致；無水平溢出。桌面遊戲密集畫面另已人工檢視，保留原本木頭、黃銅、球號、核心與怪物外觀。動態狀態不同，不宣稱遊戲畫面逐像素相同。

## 已查證：凍結檔案

開工即實算，收工再次實算；四者皆吻合指定值，未重建或寫入。

| 完整 Windows 路徑 | 開工 SHA-256 | 收工 SHA-256 |
|---|---|---|
| ./dist/index.html | 495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83 | 495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83 |
| ./drafts/3d-web/dist/index.html | 2b6bc04b03331c77c919acd9de9f8229a01d204ab58aea3fbe723b2f386f008b | 2b6bc04b03331c77c919acd9de9f8229a01d204ab58aea3fbe723b2f386f008b |
| ./drafts/3d-web/dist-parity/index.html | e146515bbab83ce7280b4f5d6cf68ceec2c030c3bbd4b8a03712d2a0a9a14dca | e146515bbab83ce7280b4f5d6cf68ceec2c030c3bbd4b8a03712d2a0a9a14dca |
| ./drafts/3d-web/dist-polish/index.html | 2c7ed9b4f7c39ae3e93fae9d01bc8b3e7018f924574f34722453bcf3ff1a6db9 | 2c7ed9b4f7c39ae3e93fae9d01bc8b3e7018f924574f34722453bcf3ff1a6db9 |

## 已查證：新產物與證據

入口：`./drafts/3d-web/dist-smooth/index.html`。

SHA-256：`be355e0081647fd332141a77e4530cda93736ac663b80d0540e285627170652d`。

- 桌面遊戲截圖：`./artifacts/3d-smooth/dense-desktop.png`
- 桌面相變截圖：`./artifacts/3d-smooth/shift-desktop.png`
- 桌面一致性截圖：`./artifacts/3d-smooth/dist-smooth-desktop.png`
- 手機一致性截圖：`./artifacts/3d-smooth/dist-smooth-mobile.png`
- 勝敗紀錄：`./artifacts/3d-smooth/verify.json`
- 六輪統計：`./artifacts/3d-smooth/comparison.json`
- 全部正式長幀：`./artifacts/3d-smooth/formal-long-frames.json`
- 降級與 PNG 雜湊：`./artifacts/3d-smooth/visual-quality.json`

所有 JSON、cpuprofile、trace、PNG、build 產物均不 commit。dist-smooth 按 dist-parity 慣例加入 .gitignore；本機 .git/info/exclude 也保留產物目錄，以便切回 main 後乾淨。程式、驗證腳本及文件才納入提交。最終 commit 與切回 main 的查核結果附在本機 REPORT.md 與最終回報。

## impeccable audit：實作者限定範圍自查

已讀 DESIGN.md。桌面、手機、密集遊戲截圖已檢視；機械 detector 對修改的 main.ts / hud.ts 回傳空清單。無本批新增外觀問題，不擴張視覺修正。

| 維度 | 分數 /4 | 證據與限制 |
|---|---:|---|
| 無障礙 | 2 | 鍵盤、焦點、減少動態保留；未做完整非視覺遊戲驗收 |
| 效能 | 3 | 三輪中位數達標，仍有殘餘長幀與波動 |
| 響應式 | 3 | 390px 開始畫面無溢出，未重做實體手機／觸控局 |
| 主題 | 3 | 桌面手機穩定畫面與基準 PNG 相同，既有 token 文件仍有限制 |
| 實作一致性 | 4 | 正式 Game、自然勝敗、規則未改，原始資料可重算 |

P2：剩餘長幀與冷啟動成本仍待獨立工作量研究。P2：Canvas 非視覺替代與實體手機未驗。DESIGN.md 的 .impeccable/design.json 副本較舊；本批以 DESIGN.md 為準，未擴張修改，可獨立以 impeccable document 同步。

## 工作流程查用

ENTRY v0.14／W-TASK-001 v0.1（trial）／T-CREATIVE-20 v0.3：沿用 repo 已有 Three.js 與 Playwright，沒有建模或新視覺方向，因此不啟用 3D 建模流程。已查 experience INDEX 與專案 LEARNINGS；沒有可直接套用的 GPU 長幀案例，依此任務的實際 profiler 重探。codebase-memory 的 main.ts 部分語法 coverage 有缺口，已讀完整原始碼補足。未派子代理、未換模型。經驗僅寫入本 repo docs/LEARNINGS.md，status: draft、promote: yes。

## 推論

三項修正共同降低 layout、幾何配置與材質首次使用成本，與同畫質三輪中位數改善一致；沒有逐項 ablation，不能把全部差距分配到單一修正。

## 不確定／未做到

沒有消除所有長幀，也沒有每輪皆改善。自然操作引發的相變時間與球數不同，僅三輪不足以證明統計穩定性；smooth-2 平靜 1% low 為 13.48，smooth-1 相變平均為 63.12。新怪物首次生成仍見 51.7ms callback，尚未細分成因。未驗冷啟動三輪、GPU timer、低階 GPU、實體手機、長時間熱降頻、跨瀏覽器或主觀手感。未錄製新影片（本次只要求截圖）。
