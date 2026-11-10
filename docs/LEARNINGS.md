# 平衡模擬的證據邊界

status: draft
promote: yes
date: 2026-11-10

直接呼叫遊戲固定步進，固定玩家策略並分離操作 RNG，才能把數值差異歸因到候選設定而非輸入時序。每局保留種子、勝敗、秒數、最大深度，逾時獨立列出。

依 chainId 聚合不等於短時間爆發；應保留事件跨度與最長間隔。連鎖數值、瀏覽器可見回饋、真人爽感是三個不同驗收層次。提高場邊失敗壓力，可能降低專注中央目標策略的勝率，不能只看全體平均。

證據：D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\balance-before.json、D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\balance-after.json、D:\Projects\Active\competitions\game-off-2026\g4-resonance\REPORT.md。

## 動態驗收與主題切換

status: draft
promote: yes
date: 2026-11-11

- 碰撞強度、點燃線與相變要以自然輸入錄影驗收；事件計數不能取代畫面。每種風格用同一模擬程式，錄影中的微小輸入時序差異仍會造成不同碰撞結果。
- CSS 變數定義在 body 時，從根元素繼承的 color 已經完成計算，不會隨 body 變數重新求值。主題容器必須明確套用 color 與 background。用明暗主題的開始畫面和手機頁尾一起檢查才能發現。
- 三十秒怪物平均數以尚在遊戲內的實際 tick 加權，並列出存活局數；終局後不補零，避免把提早獲勝誤讀成後期更容易。

證據：D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\motion\evidence.json、D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\balance-morning.json。
