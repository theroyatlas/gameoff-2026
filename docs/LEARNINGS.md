# 平衡模擬的證據邊界

status: draft
promote: yes
date: 2026-11-10

直接呼叫遊戲固定步進，固定玩家策略並分離操作 RNG，才能把數值差異歸因到候選設定而非輸入時序。每局保留種子、勝敗、秒數、最大深度，逾時獨立列出。

依 chainId 聚合不等於短時間爆發；應保留事件跨度與最長間隔。連鎖數值、瀏覽器可見回饋、真人爽感是三個不同驗收層次。提高場邊失敗壓力，可能降低專注中央目標策略的勝率，不能只看全體平均。

證據：./artifacts/balance-before.json、./artifacts/balance-after.json、./REPORT.md。

## 動態驗收與主題切換

status: draft
promote: yes
date: 2026-11-11

- 碰撞強度、點燃線與相變要以自然輸入錄影驗收；事件計數不能取代畫面。每種風格用同一模擬程式，錄影中的微小輸入時序差異仍會造成不同碰撞結果。
- CSS 變數定義在 body 時，從根元素繼承的 color 已經完成計算，不會隨 body 變數重新求值。主題容器必須明確套用 color 與 background。用明暗主題的開始畫面和手機頁尾一起檢查才能發現。
- 三十秒怪物平均數以尚在遊戲內的實際 tick 加權，並列出存活局數；終局後不補零，避免把提早獲勝誤讀成後期更容易。

證據：./artifacts/motion/evidence.json、./artifacts/balance-morning.json。

## 3D 長幀與量測邊界

status: draft
promote: yes
date: 2026-11-11

- 將 callback 起訖、下一個 rAF 間隔、GL shader 呼叫及 trace 時鐘對齊，才能區別首次材質等待、同步 layout、事件幾何配置和排程空檔。事件共現本身不是唯一因果證據。
- HUD 改 DOM 後逐個投影再讀 getBoundingClientRect 會強制同步 layout；同幀使用一次 rect，且文字只在變更時寫入，可保留畫面與規則並減少成本。
- 材質預熱要經實際離屏 composer 管線，並保留代表材質以維持 program cache；compile 不能自動代表所有後續變體都不會再編譯。合成降級測試仍有 1 個 link，須如實列出。
- 自然輸入的微小時序差異會改變相變時機與球數；同機三輪中位數是本機體驗比較，不能直接稱為固定負載的因果實驗。保留每輪與所有長幀，不刪異常輪次。

證據：./drafts/3d-web/PERFORMANCE.md；原始資料在 ./artifacts/3d-smooth。

## 共用規則的模式隔離

status: draft
promote: yes
date: 2026-11-11

- 增加遊戲模式時，直接用 `git show <不可變 commit>:<規則檔>` 載入基準，套用固定 seed 與相同 tick 輸入，比較完整快照；不能從候選重新生成基準而宣稱行為不變。
- 回合規則、骰子 RNG 與結算上限應留在共用規則層；呈現只消費狀態。整局驗收以 DOM 操作抵達真正勝敗，唯讀快照用於觀測，避免測試控制直接改出成功狀態。
- 單一離線 HTML 同時包含兩個入口時，以明確啟動函式隔離初始化，避免同頁建立兩套 renderer；灰盒 CSS 限定模式 class，防止改動預設畫面。
- 種子確定性仍需要相同操作與 tick 時序。瀏覽器自然操作的延遲會改變碰撞結果，不能把兩次不同時序的自動點擊當成相同輸入。

證據：`./tests/realtime-baseline.test.ts`、`./drafts/3d-web/BOARD-NOTES.md`；量測在 repo 外 `../review-board-graybox/verification.json`。

## 事件卡與同盤面驗收

status: draft
promote: yes
date: 2026-11-12

- 抽卡使用規則本身的 seeded RNG，並保留每張的 tick、回合、目標與效果。逐局 CSV 與獨立重算器可分開核對勝率，不以彙總百分比取代原始局紀錄。
- 畫面減量對照只切呈現策略，前後核對完整規則快照雜湊；多球截圖不能各挑一個較有利的盤面。
- 加速瀏覽器時計若以粗粒度輪詢才發射，實際輸入會晚於階段切換。精確節奏的 DOM 驅動可用受控 RAF 對齊階段和發射 tick，但不得回寫球、血量或結局；本輪 seed 20261113 的完整勝局重跑一致。
- Node 的逐 tick 輸入紀錄直接移到 Edge 未完全對齊；本輪在 18037 tick 提早回合結束，原紀錄下一個操作在 18102。原因尚未定位，不能把同執行環境重現外推成跨執行環境逐位一致。

證據：repo 同層 `../review-event-cards/csv-recount.json`、`capture.json`、`browser-fixed-input.json`、`cross-runtime-replay-attempt.log`。
