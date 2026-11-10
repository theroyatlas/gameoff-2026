# Resonance

第一週可玩灰盒：用扇形下注發射方向，讓場上的球透過碰撞累積震盪、共振和連鎖爆發。完整規格見 SPEC.md，交付與驗證見 REPORT.md。

## 執行

需要 Node.js 22.12 以上與 npm；冒煙測試需要已安裝的 Microsoft Edge 或 Google Chrome。

```powershell
Set-Location 'D:\Projects\Active\competitions\game-off-2026\g4-resonance'
$env:npm_config_cache = "$PWD\.npm-cache"
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

開啟終端顯示的本機網址。停止時按 Ctrl+C。

```powershell
npm test
npm run build
npm run smoke
```

`dist/index.html` 是自含的靜態遊戲，可直接用瀏覽器開啟。也可把 dist 內容打包成 ZIP，讓 index.html 位於 ZIP 根目錄；本專案不執行上傳。

## 怎麼玩

按「開始」，從下方發射圈朝想射的方向拖拉後放開。
外圈越亮越接近共振，雙圈球下一次碰撞會爆發；相同材質放大，異材質干擾。
Boss HP 歸零獲勝，怪物超過 10 隻失敗，按「重來」清空整局。

## 結構與調參

- `src/config.ts`：所有遊戲規則與回饋時長參數。
- `src/game.ts`：固定步長模擬、種子亂數、碰撞、傷害、勝負、事件與快照。
- `src/main.ts`：Canvas 繪製、滑鼠操作與畫面狀態。
- `tests/game.test.ts`：Vitest 規則與確定性測試。
- `scripts/smoke.mjs`：Playwright，依序使用本機 msedge／chrome，不下載瀏覽器。

相同種子必須配合相同固定步時間的發射角度，才會得到相同一局。`inputs` 記錄固定步時間、意圖角度、實際角度與材質；`events` 記錄連鎖 ID、層數、球號、點燃球號及爆發傷害。`simultaneousResonanceCount` 提供未來相變的查詢介面。本週不含相變與回放面板。

## 點子來源
