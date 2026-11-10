# 三種感覺小樣

## 開啟與操作

直接雙擊任一 HTML，以 Edge 開啟；不需伺服器、建置或網路。

- 選擇頁：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\index.html`
- A 合唱：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\a-chorus\index.html`
- B 螢火：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\b-fireflies\index.html`
- C 小隊：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\c-crew\index.html`

從下方光圈往上拖，放開發射；拖的方向決定大致方向，力道固定。沒有預測軌跡。R 重來；也可用左右鍵選方向、空白鍵發射。第一次滑鼠／鍵盤操作才會啟動 WebAudio。

建議約每一到兩秒送出一顆，玩半分鐘到一分鐘。球會先衝撞、加速、連鎖，再停在場上；至少送出五顆並累積碰撞，就會自動進入相變。相變只有一次，按 R 可以再次體驗。

- **A 合唱**：把聲音送到不同群落附近。三種音色使用五聲音階，近鄰連鎖有短促的音序；相變合成和弦、染亮全場並震碎噪音。
- **B 螢火**：留意射出去的流光如何停下呼吸。附近的螢火會彼此同步；群體同步擴大亮處、逼退影子，相變閃白後回到同步呼吸。
- **C 小隊**：留意每顆球的名字、害怕與碰撞表情。相變全隊衝向核心，接著留下當下撞擊次數最高者的英雄小卡；平手依點燃夥伴數、再依編號選出。

## 已查證

本機 Playwright 使用已安裝的 Edge，`channel: msedge`，版本 157.0.4341.42；以 `file:` 開啟，未下載瀏覽器。三個小樣各完成十五次實際滑鼠拖拉，另做窄畫面五次發射；未直接改寫遊戲狀態來觸發相變。

以下秒數從第一次發射起算，包含停格造成的實際等待；每次隨機偏角會讓時間略有差異。「首次連鎖」必須確實把共振傳到另一顆球，單顆小爆發不計。

| 方向 | 桌面發射 | console error | 首次連鎖 | 相變 | 留場球數 |
|---|---:|---:|---:|---:|---:|
| A 合唱 | 15 | 0 | 1.37 秒 | 29.26 秒 | 15 |
| B 螢火 | 15 | 0 | 1.39 秒 | 29.63 秒 | 15 |
| C 小隊 | 15 | 0 | 2.53 秒 | 31.69 秒 | 15 |

- 三個頁面都沒有外部 HTTP 請求；CSS、JS 內嵌，無外部字型、音檔、圖片或 CDN。
- 三個頁面都觀察到共振碰撞加速；完成相變後等待，十五顆球均保留且物理速度歸零。
- 音訊操作前尚未建立；操作後 AudioContext 為 running，合成音符有產生。這是音訊程式執行證據，不是人工聽感評分。
- R 重置了球數、碰撞累積及相變狀態；所有球的位置與速度數值有限。
- 桌面 1440 × 960，窄畫面 390 × 844；選擇頁三張圖完整載入、三個相對連結對應存在的獨立小樣，沒有橫向溢位。
- 最終十五張截圖全部逐張檢視：A 音符聲波、B 森林微光、C 明亮表情角色一眼可辨；三個相變皆實際出現。B 另外保留閃白第一瞬間及退白畫面。
- C 本次英雄為 #1 小圓，41 次碰撞、點燃 13 位夥伴；卡片取自當次累積資料。
- 已做 impeccable critique：檢視首次操作、回饋、差異辨識與桌面／手機可讀性；修正滑鼠操作時多餘的焦點外框，保留鍵盤焦點，並讓隊員編號旁顯示名字。機械檢查第一輪為 0 項；修正後完成一輪截圖確認，不再追加美術迭代。

詳細事件與 HTML SHA-256：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\verification.json`。

## 截圖清單

`chain` 是第一次帶到鄰球的連鎖；`phase` 是相變演出，C 包含英雄卡；`calm` 是相變後安靜下來的場面；`mobile` 是窄畫面操作。選擇頁使用 A 相變、B 平靜與 C 相變三張圖。

- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\a-chorus-calm.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\a-chorus-chain.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\a-chorus-mobile.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\a-chorus-phase.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\b-fireflies-calm.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\b-fireflies-chain.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\b-fireflies-flash.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\b-fireflies-mobile.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\b-fireflies-phase.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\c-crew-calm.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\c-crew-chain.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\c-crew-mobile.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\c-crew-phase.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\selection-desktop.png`
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\shots\selection-mobile.png`

## 已知問題與不確定

- 真人耳機／喇叭的聽感尚未驗收；A 的音樂性排名仍需實際聽後調整。
- 手機僅以 Edge 窄視窗模擬並用滑鼠拖拉，尚未驗證真實手機觸控或效能；C 的隊員小名在窄畫面偏小。
- C 的英雄卡會遮住右上方部分場地，場地仍可繼續操作。畫面邊緣的短暫情緒字可能被裁切。
- 三者都是一分鐘感覺小樣，沒有長時間大量球的效能驗收；完全不操作或只發一兩顆球不會相變。
- 相變門檻採累積的共振能量：A、C 需要至少四顆有碰撞蓄積的球，B 需要全群同步程度達標。不是只等時間就播放的展示；本次十五次發射節奏下，三者都在約半分鐘出現。
- 未測螢幕閱讀器完整遊戲體驗；有鍵盤發射替代，但 Canvas 內部角色沒有完整的非視覺描述。

## 直覺排名（推論）

以下來自實際自動拖拉結果、逐張畫面觀察與互動機制檢視，不冒充真人手玩或耳機試聽。

1. **C 小隊**：最容易回答「我為什麼要把下一顆送出去」；名字、表情和最後的英雄卡把碰撞結果變成一個可以記住的小故事。
2. **A 合唱**：碰撞直接成為創作材料，相變也有清楚的集體回報。潛力很高，但是否真的好聽需要真人試聽，這點目前不能拿程式執行通過代替。
3. **B 螢火**：最有安靜陪伴與呼吸感，停下後也有生命。相較前兩者，繼續發射的動機較柔和，是否更吸引人取決於使用者想要療癒還是戲劇性的回報。

## 維護與重跑

三個 HTML 各自可單獨使用，毋須旁邊的腳本。共用編寫來源僅用於避免三份手改不同步：

- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\build-samples.mjs`：重新產生三份自包含 HTML。
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\directions\verify.mjs`：以既有 Playwright 與本機 Edge 驗證並重拍；會覆寫 shots 和 verification.json。重跑後若要對照本文件，請同步更新時間與英雄結果。

在專案根目錄執行 `node directions/build-samples.mjs` 或 `node directions/verify.mjs`。本輪只交付 directions 內的檔案。
