# 手機抽卡展示與離線音量量測

## 已查證

- 分支 `fix/mobile-card-reveal`，直接從 main `081abb8` 建立，未包含近景分支的程式變更。
- 手機寬度不超過 700 px 時，舞台右下角顯示最近事件卡的 60×84 px 副本；收卡末段移向該卡位，完整文字仍留在原操作區。桌機副本不顯示，沿用原展示行為。
- 正常展示時間表保持 2.17 秒；減少動態保持原有 1.6 秒靜態展示。沒有改章上的「抽到」、字型、遊戲文字、規則、設定或任何外觀變體預設值。
- Pointer/touch、點擊、Space、Enter 在捕捉階段結束展示；收尾直接畫出完整卡面並清除舞台位移，不補播被跳過的聲音。吞掉同次手勢的 pointerup/click 和按鍵 repeat/keyup，避免同時發射或擲骰。
- 跳過單元測試：`抽卡展示跳過 > 點擊、空白鍵與 Enter 跳到結束且不穿透遊戲操作`。另有 997 Hz 響度校準及取樣間峰值測試。
- `npm test`：15 檔、98 測試通過；根目錄 TypeScript 及離線音訊入口 strict 檢查通過。
- `node drafts/3d-web/verify-mobile-card.mjs`：近景混合參數一局、手機卡面 a/b/c 各一局、作業系統減少動態一局，均自然終局。前三種手機卡面與近景局在相同輸入節奏下完整狀態 hash 相同。減少動態局等待展示較短，輸入時序不同，不宣稱該局與正常動態逐 tick 相同。
- touch、Space、Enter × 正常/減少動態共六組跳過驗證；跳過當下完整規則狀態不變。所有 console 訊息、page error、外部請求均為 0。
- 截圖為 seed 20261113 自然抽到第一張卡後 1.1 秒，非指定規則狀態或合成卡面。桌面改前/後中段 PNG 完全相同。手機結束卡位邊界完整落在 390×844 內。全部交付圖已逐張開啟目視，無 email 或本機使用者路徑。

| 證據 | repo 相對路徑 |
|---|---|
| 手機修正前中段 | `../review-mobile-card/mobile-before-mid.png` |
| 手機修正後中段 | `../review-mobile-card/mobile-after-mid.png` |
| 手機修正後飛入卡位途中 | `../review-mobile-card/mobile-after-flight.png` |
| 手機修正後結束 | `../review-mobile-card/mobile-after-end.png` |
| 桌機修正後中段 | `../review-mobile-card/desktop-after-mid.png` |
| 桌機改前對照 | `../review-mobile-card/desktop-before-mid.png` |
| 瀏覽器紀錄 | `../review-mobile-card/browser-verification.json` |
| 音量 CSV | `../review-mobile-card/audio-levels.csv` |
| 音量方法及完整摘要 | `../review-mobile-card/AUDIO-LEVELS.md` |
| 所有密集測試 | `../review-mobile-card/audio-summary.json` |

音效原檔不變。231 個單音案例、16 個密集案例直接執行原 BoardAudio 的 OfflineAudioContext 波形。單音最高 −4.07 dBTP，沒有超過 −1 dBTP；短音效全段最響 −23.40 LUFS、最輕 −64.81 LUFS，差距 41.40 dB。密集一秒經原壓縮器後仍達 +1.95 dBFS／+2.02 dBTP，符合本次「超過 0 dBFS」的爆音定義。沒有調音。

建置只執行 `npm --prefix drafts/3d-web run build:mobile-card`，輸出 `drafts/3d-web/dist-mobile-card/`；不使用任何既有凍結輸出目錄。

## 推論

- 舞台內保留卡位可讓首屏中的玩家看見收卡終點，而無需捲動到原操作區。
- 原碼的翻卡音效條件會擋住其後的收卡 else-if。此次僅給手機獨立的收卡條件，桌機不順便改動。
- 壓力情境表示現有壓縮器不能保證所有密集瞬態都低於滿刻度；是否以及如何調整需另行決定。

## 不確定

- Edge 為本機無頭瀏覽器與觸控模擬，不是實體手機驗收。完整局使用受控 RAF 加速，不是正常速度真人試玩。
- 密集音量是有記錄排程的合成壓力情境，不是全部可能事件序列的數學最大值；未做耳機實聽。
- 量測器已做兩種基準測試，未完成 BS.2217 全套認證；詳細的全段/gated LUFS、尾音區間及 FIR 口徑見音量摘要。

## 單次 impeccable audit

針對本次變更，使用既有 DESIGN.md、桌機/手機截圖、尺寸與輸入測試作自查，非獨立代理審查。

| 面向 | 分數 /4 | 證據與限制 |
|---|---:|---|
| 可及性 | 3 | 可用觸控與鍵盤跳過；沿用完整文字；未做全頁讀屏及對比認證 |
| 效能 | 3 | 一個小 Canvas 副本，無新增依賴；未量實機 FPS |
| 響應式 | 3 | 390×844 卡位在首屏內，1280×720 中段逐像素一致；其他尺寸未全面驗收 |
| 主題與風格 | 4 | 沿用原卡面、色票與字體，沒有新美術方向 |
| 實作一致性 | 4 | 規則不動、跳過不穿透、預設值不變 |

17/20；本次範圍未發現 P0/P1。偵測器的彈性 easing 是原有桌機 slot-arrive，依桌機不變要求保留；色票/字級 advisory 對照根目錄 DESIGN.md 與既有 CSS，屬巢狀原型規範的口徑差異，未擅自修訂設計文件。手機小卡可能遮到右下外圈一小部分，為保留可見收卡終點的取捨（P2），沒有攔截指標操作。
