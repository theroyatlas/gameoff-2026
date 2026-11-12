# 手機收卡與主輸出限幅交付

## 已查證

- 本機分支 `fix/mobile-card-reveal-r`；以原 `fix/mobile-card-reveal` 的 `3771689` 建新分支，rebase 至 main `a52779d`。重播 commit 為 `d925ba7`。
- rebase 只有 `drafts/3d-web/package.json` 衝突：同時保留 closeup-ab、closeup-ab-r、mobile-card 指令，後續新增 mobile-card-r。近景 `?cam=fieldA/fieldB` 與抽卡跳過均保留。
- main 仍為 `a52779dbc39f91fdf769954f8bc9564ba0f3826f`，原分支仍為 `37716893f2c8539108d011d829313188ac8182de`。沒有 merge、push、PR、git config 變更、付費或上傳。
- 17 個凍結檔開工全符合工作單，收工每個 SHA-256 與開工逐字相同，詳 `../review-mobile-card-r/frozen-start.json` 與 `../review-mobile-card-r/frozen-end.json`。

### 手機修正

只保留操作區內 60×84 px 原縮圖，移除舞台右下角副本。手機的收卡動畫落在預留的正常排版卡位，結束取消 slot-arrive 放大；事件文字和「下一回合額外 0 發」保留原字句及字型。桌機的縮圖尺寸、動畫、版面與預設變體不變。

main 沒有上一輪新增的舞台副本，所以 main 對照呈現的是原操作區縮圖放大遮字；雙卡問題則來自 `3771689`。修正前後是同一 seed 20261113 自然抽到的第一張卡，同一局時鐘、同一視窗大小。結束圖為展示時間 2.3 秒，CSS 收卡動畫固定在起始 0 ms，公平呈現原本 1.25 倍放大遮字的位置；沒有修改規則狀態、卡面或把畫面拼貼成驗證圖。

main 使用 `git archive main` 的獨立來源快照重建，輸出 `../review-mobile-card-r/main-build/index.html`，SHA-256 `278b6d4e558754c80193b21b83cd6dc5305be001d5443c1783c027bfd67921a2`，與既有 a52779d 建置逐位相同。

| 截圖 | repo 相對路徑 | SHA-256 |
|---|---|---|
| mobile-before-end.png | `../review-mobile-card-r/mobile-before-end.png` | `56391563215d42b07c6f678c8a23627b7a9d1a1f8caea9166613c736d0d35428` |
| mobile-after-end.png | `../review-mobile-card-r/mobile-after-end.png` | `31391f745e87b6e613d6ee5375d5a0d22cb82e2be0f00e41489b3452e207100b` |
| mobile-after-mid.png | `../review-mobile-card-r/mobile-after-mid.png` | `a831f692dfa88aef7dd0f8712639f34718ad06e0210d75683466b46124018410` |
| desktop-after-end.png | `../review-mobile-card-r/desktop-after-end.png` | `cc3e56d7ccca9f74d0e54da0c1eb9e7c26464fe2a236c76c2ae885525ed19c05` |
| desktop-before-end.png | `../review-mobile-card-r/desktop-before-end.png` | `cc3e56d7ccca9f74d0e54da0c1eb9e7c26464fe2a236c76c2ae885525ed19c05` |
| desktop-after-mid.png | `../review-mobile-card-r/desktop-after-mid.png` | `72e9bbfe18de570d8a271d38460f709afe4a1f84d04eca544a69569e2f9d8f33` |
| desktop-before-mid.png | `../review-mobile-card-r/desktop-before-mid.png` | `72e9bbfe18de570d8a271d38460f709afe4a1f84d04eca544a69569e2f9d8f33` |

手機結束前後 hash 不同，共 12,507 個像素不同；桌機展示中途與結束各為 0 個像素不同，PNG 位元組完全相同。第一次桌機結束比較曾有單一場景像素差；同參數重拍後完全相同，沒有為對齊截圖修改場景。詳 `../review-mobile-card-r/pixel-comparison.json`。

全部 8 張原始截圖已逐張開啟目視，沒有 email 或本機使用者路徑。手機結束縮圖邊界在 viewport 內，頂緣不高於 bonus 文字底緣，右緣不超過事件文字左緣。展示中途仍為原卡面與原「抽到」章。

### 音訊

16/16 密集案例一秒與全段均 ≤ −1 dBTP，最高 −1.390520 dBTP。231/231 單音差異符合 ±0.1 dB：最大全段 LUFS 差 0.000004 dB、gated LUFS 0.000003 dB、true peak 0.000053 dB。

末級 WaveShaper 在原壓縮器後，|x|≤.65 時單位增益，高峰柔和收斂並預留取樣間餘裕。各音效、平衡、殘響和原壓縮器不變。原壓縮器實測補增益 +7.339918 dB。完整 16 案前後全段／一秒 LUFS、sample peak、true peak 與差最多的 5 個單音，見 `../review-mobile-card-r/AUDIO-LIMITER.md`。CSV：`../review-mobile-card-r/audio-levels-limited.csv`。

原始音量檔案實際有 9/16 組高於 −1 dBTP，與工作單寫的 13 組不同。保留原始紀錄，沒有改舊檔。

### 驗證與建置

- `npm test`：17 檔、102 項通過；新增 2 項限幅測試，涵蓋低振幅單位增益、正負極端值上限、實際曲線插值。`npx tsc --noEmit` 通過。
- 實際 OfflineAudioContext 另測 .1/.63 振幅直通及 2.0 振幅限幅，全部通過，見 compressor-probe.json。
- 手機 `?card=a`：lost，tick 31784；手機 reduced-motion：won，tick 36220。另 fieldA 與 fieldB 各一局皆自然終局。沒有直接寫入遊戲狀態。
- 觸控、Space、Enter × 正常／減少動態，共 6 組跳過通過，不穿透規則操作。
- 四局、六組跳過與截圖的 console 訊息、page error、外部請求皆 0/0/0。完整紀錄：`../review-mobile-card-r/browser-verification.json`。
- 共用 preview 的截圖連續兩次 15000 ms timeout，依工具 fallback 規則改用既有 Playwright／Edge 157。
- 正式交付建置：`drafts/3d-web/dist-mobile-card-r/index.html`；SHA-256 `a4d3ec4217e080e580866ee88c2d751bc7a08c4da542d00b5c84d56d2dd2e296`。
- 首次 `npm exec` 的工作目錄解析造成額外的根目錄 `dist-mobile-card-r/`（2D 建置），不是交付建置；依不刪、不移 untracked dist-* 的限制保留，未加入 commit。所有既有 dist-* 也未刪、未移、未提交。

### 單次 impeccable audit 與一次修正

先按現有 DESIGN.md 檢查桌面／手機，再做一輪修正：移除會碰到外圈標籤的舞台副本，保留正常排版縮圖。這是本機自查，不是獨立審查。工具路由依 ENTRY v0.14／創作工具清單 v0.3，沿用已存在的 three.js、Web Audio、Playwright，不加套件。

| 面向 | 分數 /4 | 證據與界線 |
|---|---:|---|
| 可及性 | 3 | 完整文字保留，觸控與鍵盤跳過有驗證；未作全頁讀屏認證 |
| 效能 | 3 | 移除重複 Canvas，新增末級 lookup curve；未量實體手機 FPS |
| 響應式 | 3 | 390×844 結束不遮字，1280×720 前後逐位相同；其他尺寸未全面驗收 |
| 主題與風格 | 4 | 原字型、色票、素材、外觀預設不變 |
| 實作一致性 | 4 | 規則不動，錯誤與外部請求 0，兩種近景保留 |

17/20。偵測器只報既有桌機 bounce easing 與巢狀 DESIGN 色票 advisory；手機不再使用該 easing，桌機依要求保留。根目錄 DESIGN.md 已定義相應顏色，未改設計文件。未發現本次範圍內未修復的遮字問題。

## 推論

操作區縮圖跟完整事件文字相鄰，且不遮外圈格子，適合作為手機唯一的常駐卡面。限幅對密集瞬態的影響遠大於整段 LUFS 變化，符合保留單音及原平衡的需求。

## 不確定

- 手機為 Edge 模擬，不是實機；完整局採受控 RAF 加速，不是正常速度真人試玩。相同種子的可重現只限同一瀏覽器環境與相同輸入時序。
- −1 dBTP 為指定 16 案的四倍 FIR 實測通過，不保證任意新事件序列或其他瀏覽器的 true peak。此軟限幅器不是 oversampled lookahead true-peak limiter。
- 未做耳機實聽、實體音效裝置驗收、全套 BS.2217 認證。
