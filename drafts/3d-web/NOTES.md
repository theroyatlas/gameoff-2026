# 共振桌：完整一局

使用 Microsoft Edge 開啟 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-parity\index.html`，直接離線遊玩。

按開始後，從下方黃銅發射座朝場內拖拉並放開；也可以方向鍵瞄準、空白鍵發射。Boss 歸零獲勝，場上超過十隻怪物失敗。重來會回到開始畫面。第一次操作才啟動音效。

正式規則與 WebAudio 模組分別直接引用 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\game.ts`、`D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\audio.ts`。沒有覆寫怪物、傷害、波次、相變或勝負。

在專案根目錄執行 `npm test`、`npm run build:parity`、`npm run verify:parity`。建置只輸出 dist-parity，禁止使用預設 build 或 bundle。效能量測在子目錄執行 `node verify-parity-perf.mjs`。

完整結果與限制見 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-parity\REPORT.md`。
