# 共振桌：CPU 瓶頸剖析與修正

## 已查證：範圍與順序

2026-11-11。自適應畫質與 WebGL fallback 已存在於 `d21994a`；其父 commit 為 `3b572ad`，本批沒有重複併入、改寫歷史或改動既有三個量測 JSON。

依 `artifacts\3d-parity\REPORT.md` 第 117 行建議，先撤回無 profiler 支持的試作最佳化，再對凍結 `dist-parity` 做 4× CPU 剖析，確認繪圖提交負擔後，才重新套用靜態幾何合批。HUD、相變幾何、後處理與自適應降級策略維持不變。拖尾預設關閉，僅 `?trail=1` 開啟實驗選項；本文件全部量測使用預設關閉狀態。

## 已查證：Profiler 方法與瓶頸

Edge 157.0.4341.42、1280×950、deviceScaleFactor=1、CDP CPU throttle 4、入口 `?quality=low`。沿用真實滑鼠輸入 32 發，方向 −π/2 + sin(i) × 0.6，約每 0.8 遊戲秒一發；最後一發後等 18 遊戲秒，再擷取約 10 秒平靜段。

使用 CDP `Profiler` 的 1ms CPU sampling、`Tracing` devtools.timeline，並包裝 WebGL2 draw／buffer 呼叫做每幀計數。計數涵蓋 composer 全部 pass；單看預設 `renderer.info.render.calls` 會被最後的後處理 pass 重設，無法代表整幀。Profiler 與 instrumentation 有額外成本，這組不當作驗收 FPS。

| 平靜段 profiler | 修正前 | 修正後 |
|---|---:|---:|
| 捕獲 idle callback 數 | 533 | 619 |
| drawElements + drawArrays / callback | 446.85 | 239.94 |
| 平均 callback ms | 16.38 | 13.38 |
| 繪圖呼叫鏈含子呼叫 CPU sample ms | 7744.58 | 6667.48 |
| 繪圖呼叫鏈佔全部 sample | 74.26% | 61.75% |
| 物理 step 呼叫鏈 sample ms | 39.48 | 32.22 |
| Layout trace ms | 364.30 | 433.89 |
| Minor + Major GC trace ms | 32.38 | 30.08 |

修正前主要成本在 Three.js 繪圖提交：`renderBufferDirect` self time 合計 695.79ms，`uniformMatrix4fv` 479.36ms，`bindVertexArray` 329.31ms；物理鏈只佔約 0.38%。沒有證據支持把平靜瓶頸歸因於物理或大量 GC。

修正僅將靜態木桌、邊框、螺絲等依材質合併並保留世界座標；核心、軌道、球、怪物保持獨立。整幀 draw call 減少約 46.3%，callback 平均縮短約 18.4%，支持針對性修正確實降低 CPU 提交成本。

修正後 profile 在遊戲 46.425 秒降為第 1 級，其 `getProgramInfoLog` self time 約 1030ms，顯示畫質轉換伴隨同步 shader 編譯／驗證停頓。此成本沒有在本批進一步修正。兩次 profile 的畫質路徑不同（前：第 2 級、ratio 0.75；後：第 1 級、ratio 1），不是固定畫質 microbenchmark，也未做 GPU timer 判定 GPU 執行時間。

## 已查證：未開 profiler 的 FPS

獨立執行，沒有同時錄影、截圖或跑其他遊戲驗證。GPU 回報 NVIDIA GeForce RTX 5060 Ti / ANGLE D3D11。兩次都使用正式 Game、自然相變與上述 32 發策略，沒有植入球或改時鐘。最後一發後等待 18 遊戲秒，取 10 秒 idle；相變取所有連續 active 幀，跨段不計。

平均 FPS = 幀間隔數 / 總秒數；1% low = 1000 / 最慢 ceil(N × 1%) 個幀間隔的平均毫秒。不刪長幀。沿用 rAF callback 採樣；撞擊停格可能跳過繪圖，所以活躍段 FPS 不等同每秒 GPU 畫面提交數。

| CPU 4× | 歷史基準平均 / 1% low | 本輪修正前平均 / 1% low | 修正後平均 / 1% low |
|---|---:|---:|---:|
| 平靜 | 35.77 / 12.83 | 67.18 / 19.82 | 80.08 / 14.93 |
| 相變 | 69.88 / 15.82 | 65.86 / 16.58 | 54.19 / 12.74 |

本輪平靜採樣前：671 幀間隔／9.9882 秒；後：798／9.9646 秒。相變前：327／4.9648 秒；後：270／4.9823 秒。

**平靜平均達到 ≥45 FPS；相較本輪重測，1% low 與相變 FPS 沒有改善，不宣稱全部效能目標通過。** 修正前最後為第 3 級、ratio 0.75；修正後保持第 0 級、ratio 1、陰影開。這是自適應啟用的體驗比較，非鎖定相同畫質的差值。歷史 35.77 與本輪 67.18 的差異也顯示單次樣本受環境／時序影響，不能將全部差距歸給修正。

## 證據與重現

所有新 JSON、cpuprofile、trace 均僅在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-polish`，不提交。

- `profile-before.json`、`profile-after.json`、`profile-summary.json`：完整畫質、每幀 GL 計數、時間與 CPU 摘要。
- `cpu-before.cpuprofile`、`cpu-after.cpuprofile`：可匯入 DevTools JavaScript profiler。
- `trace-before.json`、`trace-after.json`：可匯入 DevTools Performance。
- `fps-before-4x.json`、`fps-after-4x.json`：完整 rAF、輸入 tick、GPU 屬性與快照；`performance-before.json`、`performance-after.json` 為摘要。
- 歷史基準只讀 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\artifacts\3d-parity\performance.json`。
- `provisional` 中的中途資料不屬於本批正式成果；其中的拖尾開啟影像已移除。

在 `D:\Projects\Active\competitions\game-off-2026\g4-resonance` 執行 `npm run build:polish`；再於 `D:\Projects\Active\competitions\game-off-2026\g4-resonance\drafts\3d-web` 依序且獨立執行 `node profile-polish.mjs dist-parity before`、`node verify-polish-perf.mjs dist-parity before`、`node verify-polish-perf.mjs dist-polish after`、`node profile-polish.mjs dist-polish after`。只讀凍結入口，只建置 dist-polish。

## 推論

靜態多零件造成的 CPU 繪圖提交是已量到的主要負擔；合批的 call 數和 callback 成本下降支持修正方向。shader 轉換停頓可能影響 1% low，但 profiler run 與 FPS run 不同，不能把兩者的單一長幀直接當成同一事件。

## 不確定／未達成

未證明 1% low 的穩定改善；相變尾端仍需追查。沒有 GPU timer、實體手機、低階 GPU、多輪統計、跨瀏覽器或長時間熱降頻驗收。4× CPU 不等於低階 GPU。下一步應針對 shader variant 預熱／畫質轉換 trace 設計受控實驗，不用平均 FPS 掩蓋卡頓。
