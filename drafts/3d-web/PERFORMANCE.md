# 共振桌 3D 平順度量測

2026-11-11；分支 `3d/smooth`，基底 `7438bac9f4dc970a7c02fe4107f38b79433a2efd`。所有量測為本機實跑，不是 replay、mock 或低階實體裝置驗收。

## 已查證：方法與判定

先對凍結 dist-polish 做逐幀 WebGL 呼叫時間戳、1ms CPU sampling 與 devtools.timeline trace，取得診斷資料後才修改程式。正式量測關閉 profiler 和 GL 包裝；同一台電腦、Edge 157.0.4341.42、NVIDIA GeForce RTX 5060 Ti / ANGLE D3D11、1280×950、deviceScaleFactor 1、CDP CPU 4×、入口 ?quality=low。禁止外部 HTTP(S) 請求。

兩者皆使用正式 Game、預設種子、32 發真實滑鼠拖曳，目標角度 −π/2 + sin(i) × 0.6，約每 0.8 遊戲秒一發。最後一發後等待 18 遊戲秒，再取 10 秒平靜區間；相變取連續 active 幀，跨段不計。沒有植入球、強制相變、修改遊戲時鐘、規則或手感。

平均 FPS = 幀間隔數 / 總秒數。1% low = 1000 / 最慢 ceil(N×1%) 個幀間隔的平均毫秒；長幀全部保留。rAF callback 包含既有碰撞停格期間未繪圖的 callback，因此不等於 GPU 畫面提交頻率。

正式順序：baseline-1 → smooth-1 → smooth-2 → baseline-2 → baseline-3 → smooth-3。過程不平行執行其他遊戲、測試、截圖、錄影或 build。polish-1 是正式批次之前的探索，不列入中位數；原始資料保留。所有正式樣本都是第 0 級、陰影開、pixelRatio 1、antialias false、shadowMap 512，沒有降畫質換取差值。

## 已查證：三輪與中位數

| 版本／輪次 | 平靜平均 | 平靜 1% low | 相變平均 | 相變 1% low | 平靜／相變 >50ms | 相變秒數範圍 | 相變開始／結束球數 |
|---|---:|---:|---:|---:|---:|---|---:|
| baseline-1 | 73.79 | 23.07 | 126.85 | 34.93 | 0 / 0 | 10.067–15.042 | 12 / 18 |
| baseline-2 | 91.86 | 25.73 | 80.26 | 17.40 | 0 / 5 | 13.817–18.775 | 16 / 22 |
| baseline-3 | 88.25 | 25.91 | 63.90 | 15.10 | 0 / 8 | 16.042–21.017 | 19 / 25 |
| smooth-1 | 113.40 | 30.43 | 63.12 | 19.43 | 0 / 3 | 23.633–28.592 | 29 / 32 |
| smooth-2 | 97.42 | 13.48 | 94.82 | 19.31 | 11 / 2 | 10.475–15.458 | 12 / 18 |
| smooth-3 | 85.35 | 27.31 | 136.92 | 39.62 | 0 / 0 | 9.058–14.042 | 10 / 17 |
| **baseline 中位數** | **88.25** | **25.73** | **80.26** | **17.40** | — | — | — |
| **smooth 中位數** | **97.42** | **27.31** | **94.82** | **19.43** | — | — | — |

以三輪中位數判定：平靜 1% low +6.14%，相變 1% low +11.66%；相變平均 94.82 FPS ≥ 65.9，三項數值目標通過。這不代表每輪都改善：smooth-2 平靜尾端有 11 個長幀，smooth-1 相變平均只有 63.12 FPS。

## 已查證：原因、修正與反證

| 原因／事件 | 修正前證據 | 實作與複核 | 證據邊界 |
|---|---|---|---|
| 新球材質首次使用 | 遊戲 2.033s：callback 290.0ms，其中 getProgramInfoLog 279.9ms | 開局 renderer.compile 加實際離屏 composer.render，保留三種球及效果材質樣本；診斷複測遊戲開始後 linkProgram / getProgramInfoLog 皆 0 | 增加開局工作量，未作冷啟動時間三輪比較 |
| HUD 強制同步 layout | 3.700s：callback 45.0ms、相鄰 rAF 53.0ms，Layout+UpdateLayoutTree 34.63ms；CPU stack 指向 HUD → screenPoint → getBoundingClientRect | 同幀使用一次 rect；文字、血量僅變更時更新；沒有改動樣式與數值 | 其他長幀仍可能來自排程或渲染，不能全部歸為 layout |
| 相變高頻波紋建立與回收 | active CPU callback 採樣 3442.7ms 中，TorusGeometry 呼叫鏈 219.9ms（6.4%）；長幀同時出現 6–13 impact、多筆 buffer 建立／刪除 | 同形狀波紋共享不可變幾何；個別材質與生命週期不變。active 每 callback bufferData 12.64→0.86，deleteBuffer 12.44→0.75 | 含 instrumentation 成本且相變球數不同，非固定工作量 microbenchmark；不宣稱單一長幀全由幾何造成 |
| 陰影降級 shader | 自然診斷未降級；另以 40ms rAF 排程延遲觸發第 1 級，callback 90.0ms，shader 53.5ms、10 links | 同一降級流程 smooth 為 19.2ms、shader 3.4ms、1 link；第 2／3 級皆 0 links | 這是刻意誘發的診斷，不是正式 FPS 或自然長幀因果證明 |
| GC | 21.367s 長幀重疊 MinorGC 0.963ms，遠小於 45.6ms callback | 不做粒子物件池，也不改 GC 策略 | profiler 本身也會配置物件，不能視為完全無 GC |
| 怪物首次生成 | smooth 診斷 15.058s，兩個新 cage，callback 51.7ms、bufferData 103 次、shader 0 | 保留現況，記錄為殘餘瓶頸 | 僅事件共現，尚未細分幾何、上傳與其他 callback 成本 |

自適應畫質原本只有單向下降，沒有往返震盪證據，因此不加遲滯、不改門檻；相變網線與粒子策略保持原樣。

## 已查證：逐筆診斷長幀

時間為該 callback 結束後的遊戲秒數；rAF 間隔是該 callback 的 rAF timestamp 到下一 callback 的差值。列出任一間隔或 callback >50ms；shader 欄為 getProgramInfoLog。開局／啟動 profiler 與停止後擷取期間不作 FPS 驗收。原始 JSON 保留每一幀；啟動前沒有 trace 的 GC／layout 不能當成零成本證明。

| 診斷／幀 | 遊戲秒 | 段落 | rAF / callback ms | shader / layout / GC ms | 同幀事件或變動 | 解讀 |
|---|---:|---|---:|---:|---|---|
| diagnostic-before / 0 | 0.000 | idle | 2505.80 / 820.90 | 695.80 / 0.00 / 0.00 | 無新規則事件；粒子 0 | 開局／profiler 啟動，非遊戲 FPS |
| diagnostic-before / 10 | 0.000 | idle | 335.30 / 6.00 | 0.00 / 0.00 / 0.00 | 無新規則事件；粒子 0 | 開局／profiler 啟動，非遊戲 FPS |
| diagnostic-before / 27 | 0.000 | idle | 117.60 / 28.10 | 15.10 / 0.02 / 0.00 | 無新規則事件；粒子 0 | 開局／profiler 啟動，非遊戲 FPS |
| diagnostic-before / 253 | 2.033 | idle | 300.10 / 290.00 | 279.90 / 0.23 / 0.00 | 無新規則事件；新球+1；粒子 5 | 已定位 shader 同步驗證 |
| diagnostic-before / 433 | 3.700 | idle | 53.00 / 45.00 | 0.00 / 34.63 / 0.00 | 無新規則事件；粒子 44 | 已定位 layout 成本 |
| diagnostic-before / 1857 | 20.167 | idle | 58.80 / 46.00 | 0.00 / 3.31 / 0.00 | impact+1, burst+1；粒子 85 | 事件共現；非唯一原因 |
| diagnostic-before / 1916 | 21.367 | idle | 52.90 / 45.60 | 0.00 / 4.22 / 0.96 | damage+1, impact+2, burst+1；粒子 90 | 事件共現；非唯一原因 |
| diagnostic-before / 2015 | 22.592 | idle | 52.90 / 44.50 | 0.00 / 13.81 / 0.00 | 無新規則事件；粒子 106 | 已定位 layout 成本 |
| diagnostic-before / 2202 | 25.817 | active | 52.90 / 41.90 | 2.20 / 1.49 / 0.00 | 無新規則事件；粒子 131 | 原因未定；不強行歸因 |
| diagnostic-before / 2252 | 26.600 | active | 52.80 / 46.90 | 0.00 / 2.59 / 0.00 | impact+8；粒子 563 | 事件共現；非唯一原因 |
| diagnostic-before / 2537 | 30.383 | active | 52.90 / 50.50 | 0.00 / 1.84 / 0.00 | impact+13；粒子 517 | 事件共現；非唯一原因 |
| diagnostic-before / 2582 | 30.975 | idle | 47.10 / 50.90 | 0.00 / 4.66 / 0.00 | impact+6；粒子 543 | 事件共現；非唯一原因 |
| diagnostic-before / 2590 | 31.167 | idle | 58.70 / 51.10 | 0.00 / 3.75 / 0.00 | impact+8；粒子 480 | 事件共現；非唯一原因 |
| diagnostic-before / 5031 | 62.700 | idle | 64.70 / 49.50 | 0.00 / 0.00 / 0.00 | 無新規則事件；粒子 0 | 停止 profiler／擷取期間，非驗收區間 |
| diagnostic-before / 5071 | 63.500 | idle | 52.90 / 54.00 | 0.00 / 0.00 / 0.00 | 無新規則事件；粒子 0 | 停止 profiler／擷取期間，非驗收區間 |
| diagnostic-before / 5087 | 63.817 | idle | 64.80 / 52.40 | 0.00 / 0.00 / 0.00 | 無新規則事件；粒子 0 | 停止 profiler／擷取期間，非驗收區間 |
| diagnostic-after / 0 | 0.000 | idle | 3388.20 / 5.90 | 0.00 / 0.00 / 0.00 | 無新規則事件；粒子 0 | 開局／profiler 啟動，非遊戲 FPS |
| diagnostic-after / 11 | 0.000 | idle | 288.30 / 5.40 | 0.00 / 0.00 / 0.00 | 無新規則事件；粒子 0 | 開局／profiler 啟動，非遊戲 FPS |
| diagnostic-after / 26 | 0.000 | idle | 82.40 / 13.90 | 7.20 / 0.00 / 0.00 | 無新規則事件；粒子 0 | 開局／profiler 啟動，非遊戲 FPS |
| diagnostic-after / 185 | 1.392 | idle | 100.10 / 11.30 | 0.00 / 0.00 / 0.00 | damage+1, impact+1；粒子 31 | 事件共現；非唯一原因 |
| diagnostic-after / 1749 | 15.058 | active | 52.80 / 51.70 | 0.00 / 0.00 / 0.00 | impact+1；新 cage+2；粒子 80 | 新幾何共現；細分成本未定 |
| diagnostic-after / 6301 | 54.117 | idle | 82.20 / 25.00 | 0.00 / 0.00 / 0.00 | 無新規則事件；粒子 0 | 停止 profiler／擷取期間，非驗收區間 |
| diagnostic-after / 6765 | 61.825 | idle | 52.60 / 47.80 | 0.00 / 0.00 / 0.00 | 無新規則事件；粒子 0 | 停止 profiler／擷取期間，非驗收區間 |

## 已查證：正式批次全部 >50ms 間隔

正式 FPS 未開 trace 或逐幀 snapshot，以免污染量測。下表保留所有遊戲中 >50ms 間隔（包括驗收區間外）；事件欄僅列唯讀 timing 能證實的變化，沒有證據的原因標示未知，不拿另一次診斷的事件套用。

| 輪次／幀 | 遊戲秒 | phase | rAF / callback ms | 已知變化 | 是否計入目標區間 |
|---|---:|---|---:|---|---|
| baseline-1 / 287 | 1.975 | idle | 276.50 / 276.40 | shots 1→2 | 區間外 |
| baseline-1 / 2984 | 24.042 | idle | 58.70 / 56.90 | 無 timing 變化；原因未知 | 區間外 |
| baseline-1 / 3198 | 27.225 | idle | 52.90 / 48.50 | 無 timing 變化；原因未知 | 區間外 |
| baseline-1 / 4297 | 37.392 | idle | 70.70 / 62.10 | 無 timing 變化；原因未知 | 區間外 |
| baseline-1 / 4321 | 37.883 | idle | 53.00 / 46.90 | 無 timing 變化；原因未知 | 區間外 |
| baseline-1 / 4332 | 38.125 | idle | 53.00 / 37.50 | 無 timing 變化；原因未知 | 區間外 |
| baseline-2 / 216 | 2.000 | idle | 317.60 / 309.50 | shots 1→2 | 區間外 |
| baseline-2 / 1820 | 16.025 | active | 59.00 / 55.20 | 無 timing 變化；原因未知 | 相變 |
| baseline-2 / 1821 | 16.083 | active | 52.90 / 52.20 | 無 timing 變化；原因未知 | 相變 |
| baseline-2 / 1862 | 16.883 | active | 64.70 / 56.80 | 無 timing 變化；原因未知 | 相變 |
| baseline-2 / 1867 | 17.000 | active | 53.10 / 45.00 | 無 timing 變化；原因未知 | 相變 |
| baseline-2 / 1876 | 17.275 | active | 53.10 / 45.90 | 無 timing 變化；原因未知 | 相變 |
| baseline-2 / 2037 | 19.233 | idle | 53.00 / 47.10 | 無 timing 變化；原因未知 | 區間外 |
| baseline-2 / 3754 | 37.525 | idle | 53.00 / 46.20 | 無 timing 變化；原因未知 | 區間外 |
| baseline-3 / 304 | 1.933 | idle | 282.40 / 280.40 | shots 1→2 | 區間外 |
| baseline-3 / 821 | 6.183 | idle | 64.70 / 37.30 | 無 timing 變化；原因未知 | 區間外 |
| baseline-3 / 825 | 6.267 | idle | 76.50 / 1.60 | 無 timing 變化；原因未知 | 區間外 |
| baseline-3 / 826 | 6.342 | idle | 64.80 / 31.80 | 無 timing 變化；原因未知 | 區間外 |
| baseline-3 / 1985 | 17.983 | active | 64.80 / 60.90 | 無 timing 變化；原因未知 | 相變 |
| baseline-3 / 1991 | 18.183 | active | 53.10 / 51.40 | 無 timing 變化；原因未知 | 相變 |
| baseline-3 / 2023 | 18.867 | active | 58.80 / 52.30 | 無 timing 變化；原因未知 | 相變 |
| baseline-3 / 2068 | 19.642 | active | 58.80 / 53.10 | 無 timing 變化；原因未知 | 相變 |
| baseline-3 / 2074 | 19.808 | active | 64.80 / 55.90 | shots 23→24 | 相變 |
| baseline-3 / 2090 | 20.083 | active | 64.70 / 51.60 | 無 timing 變化；原因未知 | 相變 |
| baseline-3 / 2109 | 20.658 | active | 70.60 / 66.90 | 無 timing 變化；原因未知 | 相變 |
| baseline-3 / 2110 | 20.725 | active | 52.90 / 46.70 | 無 timing 變化；原因未知 | 相變 |
| baseline-3 / 2124 | 21.058 | idle | 52.90 / 43.50 | phase active→idle | 區間外 |
| baseline-3 / 2126 | 21.142 | idle | 70.50 / 68.90 | 無 timing 變化；原因未知 | 區間外 |
| smooth-1 / 568 | 3.608 | idle | 52.90 / 7.80 | 無 timing 變化；原因未知 | 區間外 |
| smooth-1 / 1083 | 7.517 | idle | 52.90 / 48.80 | 無 timing 變化；原因未知 | 區間外 |
| smooth-1 / 2753 | 22.933 | warning | 58.90 / 42.90 | phase idle→warning | 區間外 |
| smooth-1 / 2950 | 25.833 | active | 52.90 / 54.30 | 無 timing 變化；原因未知 | 相變 |
| smooth-1 / 3086 | 27.725 | active | 52.90 / 49.80 | 無 timing 變化；原因未知 | 相變 |
| smooth-1 / 3087 | 27.775 | active | 52.90 / 49.40 | 無 timing 變化；原因未知 | 相變 |
| smooth-2 / 1331 | 10.367 | warning | 52.90 / 43.60 | 無 timing 變化；原因未知 | 區間外 |
| smooth-2 / 1536 | 12.508 | active | 65.00 / 57.10 | shots 14→15 | 相變 |
| smooth-2 / 1684 | 14.000 | active | 52.90 / 44.30 | 無 timing 變化；原因未知 | 相變 |
| smooth-2 / 2433 | 21.275 | idle | 64.80 / 61.30 | 無 timing 變化；原因未知 | 區間外 |
| smooth-2 / 2909 | 26.558 | idle | 53.00 / 51.30 | 無 timing 變化；原因未知 | 區間外 |
| smooth-2 / 5490 | 49.350 | idle | 64.80 / 4.40 | 無 timing 變化；原因未知 | 平靜 |
| smooth-2 / 5556 | 49.917 | idle | 82.40 / 80.00 | 無 timing 變化；原因未知 | 平靜 |
| smooth-2 / 5561 | 50.025 | idle | 76.50 / 69.50 | 無 timing 變化；原因未知 | 平靜 |
| smooth-2 / 5587 | 50.375 | idle | 53.10 / 38.00 | 無 timing 變化；原因未知 | 平靜 |
| smooth-2 / 5641 | 51.025 | idle | 106.00 / 79.10 | 無 timing 變化；原因未知 | 平靜 |
| smooth-2 / 5676 | 51.433 | idle | 64.70 / 57.60 | 無 timing 變化；原因未知 | 平靜 |
| smooth-2 / 5741 | 52.050 | idle | 58.90 / 57.00 | 無 timing 變化；原因未知 | 平靜 |
| smooth-2 / 5747 | 52.133 | idle | 105.90 / 86.80 | 無 timing 變化；原因未知 | 平靜 |
| smooth-2 / 5754 | 52.275 | idle | 58.90 / 61.90 | 無 timing 變化；原因未知 | 平靜 |
| smooth-2 / 5774 | 52.533 | idle | 64.80 / 30.10 | 無 timing 變化；原因未知 | 平靜 |
| smooth-2 / 5815 | 53.100 | idle | 58.70 / 58.80 | 無 timing 變化；原因未知 | 平靜 |

## 推論

相同畫質下減少同步 layout、幾何配置和 shader 初次等待，與三輪中位數改善方向一致。這支持這組修正有效，但不是每項修正獨立因果的 ablation 實驗。

## 不確定／未做

每組只有三輪，沒有統計顯著性或跨機器保證。自然滑鼠輸入的 tick／視角微震會改變實際角度和碰撞，首次相變球數及時間並不固定；同流程不等於逐 tick 相同負載。未做 GPU timer、實體手機、低階 GPU、長時間熱降頻或主觀手感驗收。剩餘長幀沒有完全消除；未明確歸因的長幀保留 UNKNOWN。

## 重現與檔案

工作目錄：D:\Projects\Active\competitions\game-off-2026\g4-resonance。只允許 npm run build:smooth，新產物為 D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web\dist-smooth\index.html。

量測工作目錄：D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web。執行 node measure-smooth.mjs dist-polish baseline-1 等六次，順序見上文；診斷加 --diagnostic，再執行 node analyze-smooth.mjs <tag>。node verify-smooth-visual.mjs 做外觀與合成降級測試；npm run verify:smooth 做完整勝敗局。

所有原始 JSON、cpuprofile、trace、PNG 均在 D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-smooth，未 commit。diagnostic-before / diagnostic-after 是獨立 profiler run；baseline-1..3 / smooth-1..3 是正式 FPS。comparison.json 與 formal-long-frames.json 為衍生統計。
