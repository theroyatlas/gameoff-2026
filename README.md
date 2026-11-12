# 共振桌 · Resonance

在手工桌遊風格的 14 格棋盤上擲骰走格、發射球，讓碰撞連成共振並擊破中央 Boss。

## 怎麼玩

1. 按「開始」，再按「擲骰」；棋子自動順時針走格並結算效果。
2. 每回合射 3 發。點擊球場，或拖拉後放開來瞄準發射；左右方向鍵瞄準，空白鍵擲骰／發射，也可用方向滑桿與「發射」按鈕。
3. SURGE 喚醒球並增加震盪；TUNE 強化指定材質；繞過 START 可讓下一回合多射 1 發。EVENT 目前預留。
4. 射完等待球停下（最多 6 秒），Boss 鐘增加 1；每 3 回合出現下一波怪物。
5. Boss 血量歸零即勝利；怪物超過 10 隻即失敗。「重來」可用同一種子重新開始。

## 本機執行

需要 Node.js 與 npm。在 repo 根目錄執行：

```sh
npm install
npm --prefix drafts/3d-web install
npm run dev
```

開啟終端顯示的本機網址。測試與正式建置：

```sh
npm test
npm run build:main
```

正式產物為 `drafts/3d-web/dist-main/index.html`，可直接用支援 WebGL 的瀏覽器開啟；建置只寫入 `dist-main/`。音效由首次操作啟動，無外部素材或服務依賴。

## 網址參數

| 參數 | 功能 |
| --- | --- |
| 不帶參數、`?mode=board` | 正式棋盤模式 |
| `?mode=realtime` | 即時模式；持續發射，按時間推進波次 |
| `?ball=a` / `b` / `c` | 原木紅漆陶土／玻璃鋼黃銅（預設 b）／做舊材質 |
| `?icon=a` / `b` / `c` | 細墨線（預設 a）／粗筆／印刷卡 |
| `?light=a` / `b` / `c` | 集中暖光（預設 a）／柔和暖光／低角度暖光 |
| `?ring=1` | 即時模式顯示外圈；棋盤模式外圈固定存在，包含 `ring=0` |

參數可用 `&` 組合，例如 `?mode=realtime&ball=c&icon=b&light=b&ring=1`。種子從開始畫面輸入；相同種子與相同輸入時序可重現同一局。

## 授權

[MIT](LICENSE) © 2026 theroyatlas。
