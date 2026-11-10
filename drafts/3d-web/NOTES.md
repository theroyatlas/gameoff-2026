# 共振桌：3D 網頁原型

這是可操作的視覺參考，不是正式比賽版。所有新增檔案都位於 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\`。

## 開啟

直接雙擊 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist\index.html`，以 Microsoft Edge 開啟。成品已將 JavaScript、CSS 和程式生成的材質打包在同一 HTML，不需要伺服器或外部網路。

從下緣黃銅發射座朝場內拖拉後放開。力道固定，扇形表示方向的不確定性。也可讓場地取得焦點後，用左右方向鍵瞄準、空白鍵發射。

## 已查證：實作範圍

- 木製桌面與場地、黃銅圍框及螺絲、暖色檯燈、三種帶號碼的球（玻璃、銀色金屬、黃銅）、中央玻璃罩核心、四角幾何籠靶與下緣發射座。
- 固定斜俯視；球的位置由平面物理決定，球體旋轉依實際位移更新。
- 拖拉發射、牆與球／核心／四角靶的碰撞、摩擦減速、球保留、共振光環、爆發擴散環、點燃線、青色相變網與同步釋放。
- 直接 import `D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\game.ts` 和 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\src\config.ts`。沒有複製簡化物理，沒有修改 CONFIG。
- `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\adapter.ts` 只停用波次與勝負、放置四角靜止靶，並在受擊後恢復靶 HP，讓場景可以持續展示。物理、共振、干擾、連鎖、低摩擦、相變觸發及結束釋放仍由 Game 執行。
- 相變不是計時動畫或按鈕強制觸發；必須滿足 Game 的共振條件。驗收介面只有狀態讀取與投影座標，沒有植入球或強制換相的入口。
- 相變摩擦係數沿用 0.055，一般狀態為 0.65；相變持續 600 tick，即 5 秒。
- 所有材質、號碼與幾何均在本機用程式產生，沒有讀入外部圖片、模型、字型或音檔。

## 已查證：本機 Edge 驗收

日期：2026-11-11。Playwright 1.56.1，`channel: 'msedge'`，本機 Edge 157.0.4341.42；GPU 回報 NVIDIA GeForce RTX 5060 Ti / ANGLE D3D11。沒有下載瀏覽器。

主要證據：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\evidence\edge.json`。

| 項目 | 結果 |
|---|---|
| 載入 | 直接 file URL 開啟打包成品 |
| 滑鼠發射 | 15 次真實 pointer 拖拉，約每 1.7 秒一發，無狀態注入 |
| console error／page error | 0／0 |
| 外部 HTTP(S) 請求 | 0；測試路由亦禁止外連 |
| 保留與停止 | 40.08 秒時 15 顆全保留、速度全為 0 |
| 碰撞／爆發／點燃回饋 | 498／23／1；最深二層連鎖 |
| 相變開始 | tick 2533，21.108 秒 |
| 一起釋放 | tick 3133，26.108 秒；15 顆球於同一 tick、同一 chainId 放大爆發 |
| 窄畫面 | 390 × 844，無水平溢出；Edge CDP 合成觸控成功發射一次 |
| 桌面 | 1440 × 1000，無水平溢出 |
| 影片 | 30.000 秒，WebM，無音軌 |

最初固定步進模擬比較八組輸入節奏，用來挑選適合展示的自然發射序列；結果保存在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\evidence\simulation.json`。這不是隨機玩家樣本，也不代表任何 15 次發射都一定換相。瀏覽器實際輸入 tick 與角度另外記錄在 edge.json。

主要錄影從正常頁面載入開始，連續操作至 40 秒，ffmpeg 取開頭 30 秒，再以每 2.5 秒一格製作 4 × 3 聯絡表。沒有加速時鐘或把不同場次拼接成同一支影片。

## 畫面與錄影

- 平靜：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\shots\calm.png`。另一次自然發射後等全部球停下的靜止畫面，見 evidence\calm.json；不是主要錄影的同一時刻。
- 相變：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\shots\shift.png`。
- 手機尺寸：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\shots\mobile.png`。
- 30 秒影片：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\shots\demo-30s.webm`。
- 12 格聯絡表：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\shots\sheet.png`。
- 產物雜湊：`D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\evidence\sha256.json`。

已開啟檢視桌面、相變、手機截圖和聯絡表。場地厚度、球、中央罩體、四角籠子及青色共振網可辨認。聯絡表末排可看到相變與放大釋放；靜態聯絡表不能單獨證明操作手感。

## 推論：視覺判斷與取捨

採用使用者指定的微縮木頭／黃銅方向，流程 W-3D-001 v0.1 的既定參考確認條件由本次明確指定滿足；工具索引 T-CREATIVE-20 v0.3 對應 three.js 與 ffmpeg。沒有增加建模服務或素材依賴。

選擇「簡化」：以 three.js 幾何及物理材質做即時網頁場景。玻璃罩、金屬高光與陰影可辨認，但沒有重製參考圖的寫實折射、焦散、精密木工、厚玻璃細節及景深。核心內部形狀仍受反光遮擋；這是視覺原型，不宣稱達到概念圖的成片品質。

依 impeccable audit 作一次檢查並集中修一輪：放大場地、壓低過亮金屬與粗糙木紋、讓球號可讀、將擴散環裁切於場內。最終確認後停止修飾。未另派審查者，為本次實作者依 skill 自查，非獨立審核。詳見 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\VISUAL-AUDIT.md`。

## 不確定與未做

- 沒有實體手機、其他 GPU／瀏覽器或長時間大量球數壓力測試；手機球號仍小。
- 尚未經使用者試玩，手感、重玩意願與美術偏好均未驗收。
- 不是完整 3D 剛體；球不跳躍、不堆疊。這是為重用現有規則而刻意保留的平面運動。
- 依任務範圍沒有勝負、選單或音效；沒有第二關。靶會閃回饋但不死亡。
- 有鍵盤操作、焦點與相變文字提示，但沒有完整的 Canvas 螢幕閱讀替代體驗。

## 重現指令（只在子資料夾）

```powershell
Set-Location 'D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web'
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1'
npm ci --ignore-scripts --no-audit --no-fund --cache .npm-cache
npm run bundle
node verify.mjs
node capture-calm.mjs
```

安裝套件需要 npm 網路下載；成品執行不需網路。所有本次套件及快取均在子資料夾。Vite 7.2.2、three.js 0.180.0、Playwright 1.56.1 由鎖檔固定。three.js 授權聲明保存在 public 和 dist 的 THIRD-PARTY-NOTICES.txt，隨成品提供；作品授權仍待使用者決定。

## 凍結邊界

本輪沒有執行專案根目錄的建置指令。凍結範圍共 18 個檔案，在開始與收工逐檔以原始位元組 SHA-256 比對。

`D:\Projects\Active\competitions\game-off-2026\g4-resonance\dist\index.html` 的預期 SHA-256：

`495c5d39242dcd6d317ca8812273c2e33b33a0b9d28bac864de8f0bec32a5a83`

結果保存在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\evidence\frozen-check.json`。只提交 drafts；影片、套件與快取不進版控。不建立遠端、不推送、不發布。
