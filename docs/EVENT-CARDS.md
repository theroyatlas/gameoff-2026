# 棋盤事件卡 v1

只使用既有的加發、材質、Boss 鐘、爆發與傷害機制。每次落在 EVENT，從下列固定順序等機率抽一張，直接使用 `Game.random()`；不使用視覺或系統亂數。

| 名稱 | 效果 |
| --- | --- |
| 多留一發 | 下一回合加 1 發，與繞圈獎勵累計；本回合發數不變 |
| 換個材質 | 下一次成功發射的材質向後輪換一種，只換一球 |
| 鐘慢一拍 | Boss 鐘回撥 1，最低 0；不刪除已生成的怪物，也不重發已生成的波次 |
| 雙倍共鳴 | 指定最後射出的一球，下一次爆發的範圍、點燃量與傷害乘 2，一次用完；空場時指定下一球 |
| 即刻釋放 | 最後射出的一球立即爆發一次，保留球；空場時於下一球發射當下兌現 |
| 輕敲核心 | Boss 立即受到 60 點傷害，可達成勝利 |

事件卡參數集中於 `CONFIG.board.events`。待用材質、指定加倍球與空場引爆存在 `BoardState`；重來全部清空。卡名、當回合、目標、材質與效果文字留在 `board.cards`，同 seed、同輸入可重現整個紀錄。

落格橫幅與操作區紙色文字卡顯示名稱、數值與目標。最近一張保留至下一張或重來；減少動態不影響閱讀。沒有新增卡面插畫、音效或外部素材。

密集盤面只為優先球補紙籤，桌面最多 10 張、窄舞台最多 6 張，且相互避讓。滑鼠移過球可查看；觸控按「查看球號」後點球，查看手勢不發射。鍵盤聚焦球場，用左右鍵換球、Esc 結束查看。毛線只顯示共振球或被查看球的鄰接，桌面最多 24 條、窄舞台最多 12 條；物理及傷害仍計算所有球。

`?cam=field` 是中央球場近景。不加參數維持整桌，`ball`、`icon`、`light` 及其預設值不變。

驗證工具：

- `tools/run-event-cards.mjs <標籤> <waveHpGrowth>`：沿用 random、greedy、lazy bot，各跑 seed 20261111–20261140；逐局 CSV 與含輸入紀錄的 JSON 存到 repo 同層 `review-event-cards`。
- `drafts/3d-web/verify-event-cards.mjs`：離線 Edge 中走 DOM 操作到自然勝敗。Playwright clock 加速等待；不改規則狀態。這是瀏覽器加速時間驗證，並非一般速度的人工試玩。
- `drafts/3d-web/verify-event-cards-fixed-input.mjs 20261113 --repeat`：以受控 RAF 時戳精確對齊階段／發射節奏，經 DOM 依球群瞄準；重跑比較同 seed 的完整盤面，沒有取得 Game 實例或改寫規則狀態。
- `drafts/3d-web/capture-event-cards.mjs`：既有 lab 的公開規則操作自然累積 70 球以上，停在回合邊界或終局。切呈現策略與鏡頭前後核對完整盤面 SHA-256。改前圖重放原本全紙籤／全毛線呈現，不是舊規則版本的另一局。
- 建置只用 `npm --prefix drafts/3d-web run build:event-cards`，輸出 `drafts/3d-web/dist-event-cards`。

實測數據、各組參數勝率、截圖與凍結檔雜湊見 repo 同層 `review-event-cards/REPORT.md`。手機證據為 Edge 觸控模擬，不能視為實機驗收。
