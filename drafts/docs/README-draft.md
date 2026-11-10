# Resonance

一款以碰撞、共振連鎖與全場相變詮釋 SHIFT 的網頁遊戲。球留在場上，等待下一次碰撞接起意料之外的連鎖。

## 怎麼玩

選夜光、紙本或極簡，按「開始」。從下方發射圈朝場內拖拉、放開，方向帶有扇形內的隨機偏移，力道固定。左、右方向鍵也能調整方向，空白鍵發射。

碰撞使球逐漸發光並進入共振，共振後再次碰撞會爆發。相同頻率互相放大，不同頻率互相干擾。多球同時共振會自動觸發 SHIFT：降低摩擦、同步頻率、顯示共振網，最後一起釋放。球號不會因爆發消失，停住的球能被下一球再次推動。

清空 Boss HP 獲勝；場上怪物超過十隻失敗。畫面右上可切換音效與重來。

## 開啟與建置

已建置的本機遊戲可直接以 Microsoft Edge 開啟：

`D:\Projects\Active\competitions\game-off-2026\g4-resonance\dist\index.html`

以下是日後解除試玩凍結後使用的建置說明。本輪只記錄，不執行，也不覆蓋現有成品。

需求：支援 Vite 7 的 Node.js（20.19+ 或 22.12+）與 npm。下載套件時需要網路，建置完成的 HTML 不需要網路。

```powershell
Set-Location 'D:\Projects\Active\competitions\game-off-2026\g4-resonance'
npm ci
npm test
npm run build
```

建置產物位於 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\dist\index.html`。開發時執行 `npm run dev`；冒煙測試為 `npm run smoke`，使用本機 Microsoft Edge，不需下載測試瀏覽器。

物理與規則使用固定時間步長；相同種子、發射 tick 和角度才會重現同一局。參數集中於 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\config.ts`。

## AI 使用

AI 協助程式實作、測試與驗證腳本，以及 3D 概念圖探索。音效由程式合成，不含語音或旁白。

## 授權

（待使用者決定）

## 點子來源

（待使用者決定）
