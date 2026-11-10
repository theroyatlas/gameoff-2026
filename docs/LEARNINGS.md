# 平衡模擬的證據邊界

status: draft
promote: yes
date: 2026-11-10

直接呼叫遊戲固定步進，固定玩家策略並分離操作 RNG，才能把數值差異歸因到候選設定而非輸入時序。每局保留種子、勝敗、秒數、最大深度，逾時獨立列出。

依 chainId 聚合不等於短時間爆發；應保留事件跨度與最長間隔。連鎖數值、瀏覽器可見回饋、真人爽感是三個不同驗收層次。提高場邊失敗壓力，可能降低專注中央目標策略的勝率，不能只看全體平均。

證據：D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\balance-before.json、D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\balance-after.json、D:\Projects\Active\competitions\game-off-2026\g4-resonance\REPORT.md。
