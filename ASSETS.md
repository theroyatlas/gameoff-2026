# 素材清單

範圍：整合後 main 由 Git 追蹤的全部非程式視覺、音訊、字型、影片與模型素材。路徑相對於 repo 根目錄；以 `git ls-files` 及副檔名盤點，共 33 個檔案，全部為 PNG。日期：2026-11-12。

本表素材依專案著作權人指定，以根目錄 `LICENSE` 的 MIT 授權提供。版權標示：`Copyright (c) 2026 theroyatlas`。第三方程式庫授權另見 `drafts/3d-web/THIRD-PARTY-NOTICES.txt`。

沒有追蹤字型檔、音效檔、影片檔或 3D 模型檔。系統字型由裝置提供，不隨 repo 散布；WebAudio 音效及 three.js 幾何、材質由程式即時生成，程式碼依 MIT 授權。Blender 場景以 Python 腳本保存，渲染結果列於下表。建置目錄中的內嵌程式材質不是另外的素材檔。

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
| `concepts/3d/01-miniature.png` | PNG 圖片 | Codex 內建生圖工具 imagegen；使用者確認，提示詞見同名 `.txt`，commit `b0a57ec` | MIT |
| `concepts/3d/02-abyss.png` | PNG 圖片 | Codex 內建生圖工具 imagegen；使用者確認，提示詞見同名 `.txt`，commit `b0a57ec` | MIT |
| `concepts/3d/03-cosmic.png` | PNG 圖片 | Codex 內建生圖工具 imagegen；使用者確認，提示詞見同名 `.txt`，commit `b0a57ec` | MIT |
| `concepts/3d/blender/miniature-hero.png` | PNG 圖片 | Blender 4.4 EEVEE 渲染自製場景；`concepts/3d/blender/scene.py`，commit `b0a57ec` | MIT |
| `concepts/3d/blender/miniature-wide.png` | PNG 圖片 | Blender 4.4 EEVEE 渲染自製場景；`concepts/3d/blender/scene.py`，commit `b0a57ec` | MIT |
| `concepts/3d/compare.png` | PNG 圖片 | 上述三張 Codex imagegen 圖的比較拼圖；圖面逐一對照、同屬 commit `b0a57ec`；拼接工具未記錄 | MIT |
| `drafts/3d-web/shots/calm.png` | PNG 圖片 | 自製 three.js 遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify.mjs`、`capture-calm.mjs` | MIT |
| `drafts/3d-web/shots/mobile.png` | PNG 圖片 | 自製 three.js 遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify.mjs`、`capture-calm.mjs` | MIT |
| `drafts/3d-web/shots/sheet.png` | PNG 圖片 | 自製遊戲錄影經 ffmpeg 取格拼圖；`drafts/3d-web/verify.mjs` | MIT |
| `drafts/3d-web/shots/shift.png` | PNG 圖片 | 自製 three.js 遊戲之 Playwright／Edge 截圖；`drafts/3d-web/verify.mjs`、`capture-calm.mjs` | MIT |

## 已移除

沒有查出來源不明的保留素材。以下 15 張是使用者指定不公開的主題草稿，隨 `directions/` 整個資料夾以 `git rm` 移除；不是以來源不明為由移除。來源可由 commit `a65dfa6` 的目錄歷史及 `directions/verify.mjs` 核對。下表路徑為刪除前的 repo 相對位置。

| 路徑 | 類型 | 來源 | 授權 | 移除原因 |
| --- | --- | --- | --- | --- |
| `directions/shots/a-chorus-calm.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/a-chorus-chain.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/a-chorus-mobile.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/a-chorus-phase.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/b-fireflies-calm.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/b-fireflies-chain.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/b-fireflies-flash.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/b-fireflies-mobile.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/b-fireflies-phase.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/c-crew-calm.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/c-crew-chain.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/c-crew-mobile.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/c-crew-phase.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/selection-desktop.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
| `directions/shots/selection-mobile.png` | PNG 圖片 | 自製 HTML 主題草稿的瀏覽器截圖 | MIT（本專案） | 使用者指定不公開 |
