# 共振桌中央近景 A／B

## 已查證

- 基底：`9595b42e47c75ace0c1ec4c7cd5514c791fa4c7b`；本機分支 `feat/closeup-ab`。
- A：`?cam=fieldA`。以核心為中心縮小取景範圍，寬畫面保留 ±2.25／±1.75 世界單位，窄畫面再乘 0.7。保留既有 45°／58° 仰角，球的顯示尺寸不另放大。
- B：`?cam=fieldB`。使用中央球場取景，球 mesh、球心高度與共振辨識環顯示縮放 2.2 倍；x/z 球心、規則半徑、碰撞、傷害、共振距離、RNG 不變。
- 兩版以原始射擊角度和散射半角畫扇形，沒有碰撞或落點預測。滑鼠／觸控仍以同一鏡頭反投影到原場地平面；畫面下緣保留方向與角度文字，A 說明發射口在近景外。
- 沒有改 `ball`、`icon`、`light` 或預設值。不加 `cam` 的同盤面桌面 PNG 與凍結 `dist-event-cards` 建置逐位相同。

截圖全部來自 seed 20261112 的同一個自然累積 90 球盤面，完整狀態 SHA-256：`106d1a0f95fcf0b9fd31c60c48bf7c06cc5f3980df00cd7c9263b05504379fa9`。五張已逐張打開檢視，沒有 email 或本機使用者路徑。

| 截圖 | 完整路徑 |
|---|---|
| A 桌面 1280×720 | `..\review-closeup-ab\desktop-fieldA.png` |
| B 桌面 1280×720 | `..\review-closeup-ab\desktop-fieldB.png` |
| A 手機 390×844 | `..\review-closeup-ab\mobile-fieldA.png` |
| B 手機 390×844 | `..\review-closeup-ab\mobile-fieldB.png` |
| 整桌對照 1280×720 | `..\review-closeup-ab\desktop-table.png` |

球在中央的投影直徑：整桌桌面 13.7 px；A 桌面 38.1 px／手機 26.2 px；B 桌面 42.4 px／手機 22.8 px。這是呈現量測，不是物理尺寸。

### 驗證

- `npm test`：13 個檔案、94 個測試全通過，包含 `tests\realtime-baseline.test.ts`。
- B 測試：`fieldB 顯示半徑放大，同 seed 同輸入的每 tick 完整規則狀態與整桌相同`，5000 tick 完整快照比對通過；設定物件保持相同。
- 額外實際 Edge DOM 整局驗證：整桌、A、B、B＋手機減少動態，均在 tick 30621、71 發自然失敗；四局完整快照 SHA-256 均為 `674f54999517eaada102ef449668ca2e24bc6b9e84554500da7e4a575851af19`。
- 四局使用受控 RAF 加速；沒有改規則狀態或直接設定勝敗。另用真實滑鼠拖拉、觸控與鍵盤發射，三組各成功射出 2 球；方向扇形和提示可見、沒有水平溢出。
- console error／page error／外部請求：**0／0／0**。
- TypeScript 規則／測試與診斷入口檢查通過。impeccable detector 回傳 `[]`；完成單次技術 audit 與一次手機取景修正，詳外部 `VISUAL-AUDIT.md`。這不是獨立代理審查。
- Node 90 局仍為 35/90；逐筆完整模擬紀錄與原 events-300 相同。跨環境首個差異與勝負影響見 `CLOSEUP-DETERMINISM.md`。

### 建置與凍結檔

- 建置：`drafts\3d-web\dist-closeup-ab\index.html`。
- SHA-256：`2e1204ecb9ce800efaedb526f843db0985c5bb768eae951120f9de2b074e2c61`。
- 只執行 `npm --prefix drafts/3d-web run build:closeup-ab`，沒有重建任何凍結資料夾。
- 13 個指定凍結檔，開工雜湊全部符合指定值，收工全數與開工逐字相同。證據：`..\review-closeup-ab\frozen-start.json`、`frozen-end.json`。
- `dist-art-round2` 保持未追蹤，沒有刪除、移動或加入 commit。

### 其他工作階段的分支變動

開工時 main 為 9595b42；收工發現 main 與 origin/main 已成為 081abb8。`git reflog show main` 記錄 **2026-11-12 19:48:31 +0800：merge 081abb8: Fast-forward**。本工作階段沒有執行此 merge 或任何 push；工作分支仍從原指定 9595b42 出發。沒有擅自重設 main。`art/round2` 仍為 `081abb831b2290f42a74b8c2e0665a1b965e4487`。

## 推論

- A 適合看核心附近的球與球面號碼；B 更接近「球鋪滿場地」的觀感，但密集區會有顯示重疊。
- 單純呈現縮放可以保留原有規則行為；B 的外觀輪廓不等於物理接觸邊界。

## 不確定

- A 會裁掉遠處的球、怪物及外圈；B 的視覺重疊是放大顯示的代價，尚未經真人手感驗收。
- 手機為 Edge 觸控模擬，非實體手機；整局為受控 RAF 加速，非一般速度的人工試玩或音效主觀驗收。
- 跨 Node／Edge 逐位一致沒有修復；已在不改規則／數值前提下完成第一分歧、Math.sin 最小證據及 30 組配對影響估計。
- 本工作沒有 merge、push、PR、付費服務或 itch 上傳；無法把其他工作階段移動 main 描述成「main 完全未動」。
