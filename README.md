# Resonance

用扇形下注發射方向，球透過碰撞累積共振、連鎖爆發與全場相變。規則見 SPEC.md，當次試玩範圍、量測與限制見 REPORT.md。

## 開啟

直接用 Microsoft Edge 開啟 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\dist\index.html`。不需要網路或伺服器。

開發與驗證：

```powershell
Set-Location 'D:\Projects\Active\competitions\game-off-2026\g4-resonance'
npm run dev
npm test
npm run build
npm run sim -- --label morning
npm run smoke
node scripts/motion.mjs
```

使用現有 Node.js、npm、Microsoft Edge 與 ffmpeg。測試及錄影只用本機 Edge，不下載瀏覽器；沒有執行時依賴。影片輸出至 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\motion`，影片不進版控。

## 怎麼玩

挑選夜光、紙本或極簡，按開始，從下方發射圈朝場內拖拉再放開，力道固定。
亮圈越強越接近爆發，多球同時共振會自動相變；球停下後仍能被下一球撞醒。
打空 Boss HP 獲勝，場上怪物超過十隻失敗；方向鍵與空白鍵也能操作，右上可靜音或重來。

## 結構

- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\config.ts`：規則參數。
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\game.ts`：固定步長、種子亂數、物理、波次、相變與回放事件。
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\main.ts`：三種風格、輸入與畫面回饋。
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\audio.ts`：WebAudio 合成音效。
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\scripts\balance-sim.ts`：直接執行同一個 Game，兩策略各 40 個種子，每兩秒一發。

相同種子、相同輸入角度與發射 tick 才能重現同一局；真人操作時間不同會造成物理分岔。視覺回饋不消耗遊戲亂數。SHIFT 期間以相同頻率結算，釋放後恢復球原本材質。
