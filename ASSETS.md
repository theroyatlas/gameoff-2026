# 素材清單

範圍：整合後 main 由 Git 追蹤的全部非程式視覺、音訊、字型、影片與模型素材。路徑相對於 repo 根目錄；以 `git ls-files` 及副檔名盤點，共 33 個檔案，全部為 PNG。日期：2026-11-12。

本表素材依專案著作權人指定，以根目錄 `LICENSE` 的 MIT 授權提供。版權標示：`Copyright (c) 2026 theroyatlas`。第三方程式庫授權另見 `drafts/3d-web/THIRD-PARTY-NOTICES.txt`。

沒有追蹤字型檔、音效檔、影片檔或 3D 模型檔（音效的生成方式見下方「音效」一節）。系統字型由裝置提供，不隨 repo 散布；WebAudio 音效及 three.js 幾何、材質由程式即時生成，程式碼依 MIT 授權。Blender 場景以 Python 腳本保存，渲染結果列於下表。建置目錄中的內嵌程式材質不是另外的素材檔。

| 路徑 | 類型 | 來源與查證依據 | 授權 |
| --- | --- | --- | --- |
| `artifacts/3d-parity/outcome-desktop.png` | PNG 圖片 | 自製遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify-parity.mjs`、同目錄 `REPORT.md` | MIT |
| `artifacts/3d-parity/sheet.png` | PNG 圖片 | 自製遊戲錄影經 ffmpeg 取格拼圖；同目錄 `REPORT.md`「影像」 | MIT |
| `artifacts/3d-parity/shift-desktop.png` | PNG 圖片 | 自製遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify-parity.mjs`、同目錄 `REPORT.md` | MIT |
| `artifacts/3d-parity/shift-mobile.png` | PNG 圖片 | 自製遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify-parity.mjs`、同目錄 `REPORT.md` | MIT |
| `artifacts/3d-parity/start-desktop.png` | PNG 圖片 | 自製遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify-parity.mjs`、同目錄 `REPORT.md` | MIT |
| `artifacts/3d-parity/start-mobile.png` | PNG 圖片 | 自製遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify-parity.mjs`、同目錄 `REPORT.md` | MIT |
| `artifacts/aim-desktop.png` | PNG 圖片 | 自製 Canvas 遊戲之 Playwright／Edge 截圖；`scripts/smoke.mjs` | MIT |
| `artifacts/feedback-desktop.png` | PNG 圖片 | 自製 Canvas 遊戲回饋截圖；commit `66c6bd9` 的 `scripts/smoke.mjs`，`be97760` 更新 | MIT |
| `artifacts/feedback-mobile.png` | PNG 圖片 | 自製 Canvas 遊戲回饋截圖；commit `66c6bd9` 的 `scripts/smoke.mjs`，`be97760` 更新 | MIT |
| `artifacts/motion/rep/夜光-shift.png` | PNG 圖片 | 自製 Canvas 遊戲相變代表截圖；commit `53397e5`、`drafts/docs/itch-page.md` | MIT |
| `artifacts/motion/rep/極簡-shift.png` | PNG 圖片 | 自製 Canvas 遊戲相變代表截圖；commit `53397e5`、`drafts/docs/itch-page.md` | MIT |
| `artifacts/motion/rep/紙本-shift.png` | PNG 圖片 | 自製 Canvas 遊戲相變代表截圖；commit `53397e5`、`drafts/docs/itch-page.md` | MIT |
| `artifacts/motion/夜光-desktop.png` | PNG 圖片 | 自製 Canvas 遊戲之 Playwright／Edge 截圖；`scripts/motion.mjs` | MIT |
| `artifacts/motion/夜光-mobile.png` | PNG 圖片 | 自製 Canvas 遊戲之 Playwright／Edge 截圖；`scripts/motion.mjs` | MIT |
| `artifacts/motion/夜光-sheet.png` | PNG 圖片 | 自製遊戲錄影經 ffmpeg 取格拼圖；`scripts/motion.mjs` | MIT |
| `artifacts/motion/極簡-desktop.png` | PNG 圖片 | 自製 Canvas 遊戲之 Playwright／Edge 截圖；`scripts/motion.mjs` | MIT |
| `artifacts/motion/極簡-mobile.png` | PNG 圖片 | 自製 Canvas 遊戲之 Playwright／Edge 截圖；`scripts/motion.mjs` | MIT |
| `artifacts/motion/極簡-sheet.png` | PNG 圖片 | 自製遊戲錄影經 ffmpeg 取格拼圖；`scripts/motion.mjs` | MIT |
| `artifacts/motion/紙本-desktop.png` | PNG 圖片 | 自製 Canvas 遊戲之 Playwright／Edge 截圖；`scripts/motion.mjs` | MIT |
| `artifacts/motion/紙本-mobile.png` | PNG 圖片 | 自製 Canvas 遊戲之 Playwright／Edge 截圖；`scripts/motion.mjs` | MIT |
| `artifacts/motion/紙本-sheet.png` | PNG 圖片 | 自製遊戲錄影經 ffmpeg 取格拼圖；`scripts/motion.mjs` | MIT |
| `artifacts/smoke-desktop.png` | PNG 圖片 | 自製 Canvas 遊戲之 Playwright／Edge 截圖；`scripts/smoke.mjs` | MIT |
| `artifacts/smoke-mobile.png` | PNG 圖片 | 自製 Canvas 遊戲之 Playwright／Edge 截圖；`scripts/smoke.mjs` | MIT |
| `concepts/3d/01-miniature.png` | PNG 圖片 | Codex 內建生圖工具 imagegen；提示詞見同名 `.txt`，commit `b0a57ec` | MIT |
| `concepts/3d/02-abyss.png` | PNG 圖片 | Codex 內建生圖工具 imagegen；提示詞見同名 `.txt`，commit `b0a57ec` | MIT |
| `concepts/3d/03-cosmic.png` | PNG 圖片 | Codex 內建生圖工具 imagegen；提示詞見同名 `.txt`，commit `b0a57ec` | MIT |
| `concepts/3d/blender/miniature-hero.png` | PNG 圖片 | Blender 4.4 EEVEE 渲染自製場景；`concepts/3d/blender/scene.py`，commit `b0a57ec` | MIT |
| `concepts/3d/blender/miniature-wide.png` | PNG 圖片 | Blender 4.4 EEVEE 渲染自製場景；`concepts/3d/blender/scene.py`，commit `b0a57ec` | MIT |
| `concepts/3d/compare.png` | PNG 圖片 | 上述三張 Codex imagegen 圖的比較拼圖；圖面逐一對照、同屬 commit `b0a57ec`；拼接工具未記錄 | MIT |
| `drafts/3d-web/shots/calm.png` | PNG 圖片 | 自製 three.js 遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify.mjs`、`capture-calm.mjs` | MIT |
| `drafts/3d-web/shots/mobile.png` | PNG 圖片 | 自製 three.js 遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify.mjs`、`capture-calm.mjs` | MIT |
| `drafts/3d-web/shots/sheet.png` | PNG 圖片 | 自製遊戲錄影經 ffmpeg 取格拼圖；`drafts/3d-web/verify.mjs` | MIT |
| `drafts/3d-web/shots/shift.png` | PNG 圖片 | 自製 three.js 遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify.mjs`、`capture-calm.mjs` | MIT |

三張 Codex 生成的概念圖以 MIT 提供；AI 生成的內容在部分地區可能不受著作權保護。

## 音效

棋盤模式（預設）的音效全部由 `drafts/3d-web/board-audio.ts` 以 WebAudio 即時合成，**沒有下載、沒有內嵌任何音檔或取樣**，不需要外部授權；程式碼依本專案 `LICENSE` 的 MIT 授權。殘響用的脈衝響應與噪音來源也由程式以固定種子產生。2D 版與即時模式沿用既有的 `src/audio.ts`（同樣是 WebAudio 合成）。

共同處理：主音量 → 壓縮器（threshold −18 dB、ratio 6）；每個聲部可左右定位（依事件在場上的 x 位置），並送一部分到 1.1 秒的程式殘響。同時聲部上限 40，每畫面撞擊最多 6 聲。

| 音效 | 觸發 | 生成方式 | 來源／授權 |
| --- | --- | --- | --- |
| 擲骰（搖骰） | 進入擲骰階段 | 6 下帶通噪音（2.6–3.5 kHz）＋短三角波，間隔越來越短 | 程式合成／MIT |
| 骰子落桌 | 擲骰階段結束 | 118→70 Hz 正弦悶響＋900 Hz 帶通噪音＋高頻接觸聲，三下遞減彈跳 | 程式合成／MIT |
| 棋子逐格 | 棋子每前進一格 | 三角波木頭敲擊＋1.8 kHz 帶通噪音，音高沿五聲音階逐步往上 | 程式合成／MIT |
| 落格 | 最後一格 | 同上加重，另加低頻與低通紙聲 | 程式合成／MIT |
| SURGE | 落在 SURGE | 鋸齒波 70→360 Hz 上衝＋掃頻帶通噪音＋7 下劈啪＋55 Hz 低頻重擊 | 程式合成／MIT |
| TUNE | 落在 TUNE | FM 鐘聲（載波依材質 880／659／523 Hz、調變比 1.4）＋五度泛音 | 程式合成／MIT |
| 繞過起點加發 | 繞圈數增加 | 4 個往上的三角波亮音（C6–C7）＋高泛音 | 程式合成／MIT |
| 球撞球 | 規則的撞擊事件，位置判斷為球 | 模態合成：每種材質一組基頻與泛音比（玻璃 2350 Hz 短、鋼 1720 Hz 長、黃銅 1180 Hz 暖；`ball=a` 改用木球組），碰撞速度同時決定音量、泛音數、音高微升與接觸噪音 | 程式合成／MIT |
| 球撞木框 | 撞擊位置在場邊 | 150–210 Hz 正弦「咚」＋帶通噪音，球本身的材質聲壓低 | 程式合成／MIT |
| 球撞玻璃罩／怪物籠 | 撞擊位置在核心或怪物旁 | 玻璃：2.9／4.6 kHz 長衰減；籠：410 Hz 三角波＋1.1 kHz 方波 | 程式合成／MIT |
| 連鎖爆發 | 每次爆發 | 三角波＋八度＋三倍泛音＋低八度；音高依同一串的第幾下沿五聲音階往上 | 程式合成／MIT |
| 傷害跳字 | 累加數字每跳兩下 | 25 ms 方波點擊，音高隨次數上升 | 程式合成／MIT |
| 定格重拍 | 一串連鎖結束 | 98→55 Hz 低頻＋低通噪音，3 層以上加一個高音 | 程式合成／MIT |
| 抽事件卡（`?card=` 有值時） | 新抽到事件卡 | 紙張摩擦：帶通噪音掃頻（a 1.1→2.8 kHz、b 1.8→4.2 kHz）；c 木牌為 500→900 Hz 帶通噪音＋130 Hz 三角波；另疊 392→587 Hz、784→1175 Hz 兩聲部上滑的期待音 | 程式合成／MIT |
| 翻卡 | 抽卡展示翻面的一半 | a、b：高通噪音「啪」（2.2／3.2 kHz）＋900 Hz 帶通＋170→120 Hz 低頻；c：980／1240 Hz 三角波兩下木頭輕敲 | 程式合成／MIT |
| 蓋章 | 翻開那一刻 | 140→58 Hz 正弦悶響＋1.3 kHz 低通噪音＋2.6 kHz 接觸聲；c 另加 1660 Hz 金屬泛音 | 程式合成／MIT |
| 卡面數字跳動 | 大字每跳一次 | 沿用「傷害跳字」的 25 ms 方波點擊 | 程式合成／MIT |
| 抽卡獎勵 | 數字跳完 | 依卡號換主音（C5 起大調五聲）的四音上行三角波琶音，最後一音拉長並加八度泛音 | 程式合成／MIT |
| 球撞鐵絲籠（`?cage=a`） | 撞擊位置在怪物旁 | 1480 Hz 三角波＋3870 Hz 正弦長衰減、620 Hz 低泛音、6 kHz 高通接觸聲 | 程式合成／MIT |
| 球撞毛線籠（`?cage=b`） | 同上 | 700–1200 Hz 低通噪音「噗」＋165→110 Hz 正弦木樁聲，球材質聲壓低 | 程式合成／MIT |
| 球撞紙燈籠（`?cage=c`） | 同上 | 2.4 kHz 帶通噪音「啪」＋240→160 Hz 低頻，再兩下 3.6／3.0 kHz 紙張抖動聲 | 程式合成／MIT |
| 發射、共振、怪物擊破、預兆、相變、釋放、波次 | 對應規則事件 | 正弦／三角／鋸齒／方波與濾波噪音的短音型，見 `BoardAudio.play` | 程式合成／MIT |

不是旁白，沒有使用任何語音合成。

## 已移除

沒有查出來源不明的保留素材。以下 15 張是放棄的主題草稿，正式版不用，隨 `directions/` 整個資料夾以 `git rm` 移除，較早的 commit 裡仍看得到；不是以來源不明為由移除。來源可由 commit `a65dfa6` 的目錄歷史及 `directions/verify.mjs` 核對。下表路徑為刪除前的 repo 相對位置。

| 路徑 | 類型 | 來源 | 授權 | 移除原因 |
| --- | --- | --- | --- | --- |
| `directions/shots/a-chorus-calm.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/a-chorus-chain.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/a-chorus-mobile.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/a-chorus-phase.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/b-fireflies-calm.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/b-fireflies-chain.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/b-fireflies-flash.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/b-fireflies-mobile.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/b-fireflies-phase.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/c-crew-calm.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/c-crew-chain.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/c-crew-mobile.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/c-crew-phase.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/selection-desktop.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
| `directions/shots/selection-mobile.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 放棄的草稿 |
