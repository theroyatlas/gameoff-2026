import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const repo=resolve(import.meta.dirname,'..'), out=resolve(repo,'../review-mobile-card-r'), old=resolve(repo,'../review-mobile-card');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const csv=async p=>{const [head,...lines]=(await readFile(p,'utf8')).trim().split(/\r?\n/);const keys=head.split(',');return lines.map(l=>Object.fromEntries(l.split(',').map((v,i)=>[keys[i],i>1&&v!==''?Number(v):v])));};
const before=await csv(resolve(old,'audio-levels.csv')), after=await csv(resolve(out,'audio-levels-limited.csv'));
const fields=['lufs_full','lufs_integrated','true_peak_dbtp'];
assert.equal(before.length,231);assert.equal(after.length,231);
const differences=before.map((a,i)=>{const b=after[i];assert.equal(a.name,b.name);assert.equal(a.voices,b.voices);const delta=Object.fromEntries(fields.map(k=>[k,b[k]-a[k]]));assert.ok(Object.values(delta).every(v=>Math.abs(v)<=.1));return {name:a.name,before:a,after:b,delta,max:Math.max(...Object.values(delta).map(Math.abs))};});
const base=await json(resolve(old,'audio-summary.json')), limited=await json(resolve(out,'audio-summary.json')), probe=await json(resolve(out,'compressor-probe.json'));
assert.equal(limited.dense.length,16);
const dense=base.dense.map((a,i)=>{const b=limited.dense[i];assert.equal(a.name,b.name);assert.equal(a.voices,b.voices);assert.ok(b.true_peak_dbtp<=-1&&b.first_second.true_peak_dbtp<=-1);return {name:a.name,before:a,after:b};});
const top=[...differences].sort((a,b)=>b.max-a.max).slice(0,5), maxDelta=Object.fromEntries(fields.map(k=>[k,Math.max(...differences.map(d=>Math.abs(d.delta[k])))]));
await writeFile(resolve(out,'audio-comparison.json'),JSON.stringify({singleCount:231,maxDelta,top5:top,denseCount:16,denseHighestTruePeak:Math.max(...dense.map(d=>d.after.true_peak_dbtp)),dense},null,2)+'\n');
const f=n=>n.toFixed(3), tiny=n=>(n>=0?'+':'')+n.toFixed(6);
const rows=dense.map(d=>{const a=d.before.first_second,b=d.after.first_second;return `| ${d.name} | ${f(a.lufs_full)} → ${f(b.lufs_full)} | ${f(b.lufs_full-a.lufs_full)} | ${f(a.sample_peak_dbfs)} → ${f(b.sample_peak_dbfs)} | ${f(a.true_peak_dbtp)} → ${f(b.true_peak_dbtp)} |`;}).join('\n');
const full=dense.map(d=>{const a=d.before,b=d.after;return `| ${d.name} | ${f(a.lufs_full)} → ${f(b.lufs_full)} | ${f(a.lufs_integrated)} → ${f(b.lufs_integrated)} | ${f(a.sample_peak_dbfs)} → ${f(b.sample_peak_dbfs)} | ${f(a.true_peak_dbtp)} → ${f(b.true_peak_dbtp)} |`;}).join('\n');
const md=`# 主輸出限幅驗收

## 已查證

- 同一支 \`tools/measure-audio.mjs --limited\`、同一份 \`tools/audio-offline.ts\`（案例、權重、聲部限制、尾音區間未修改）。Edge ${limited.browserVersion}；48 kHz、立體聲 OfflineAudioContext。
- 舊 \`audio-summary.json\` 實際有 9/16 組超過 −1 dBTP，與工作單的 13 組有差異；對照表照原始檔記錄，不改舊資料。
- 16/16 密集案例的一秒與全段 true peak 均 ≤ −1 dBTP；最高 ${f(Math.max(...dense.map(d=>d.after.true_peak_dbtp)))} dBTP。
- 231/231 單音的全段 LUFS、gated LUFS、true peak 差皆在 ±0.1 dB 內。最大絕對差依序為 ${maxDelta.lufs_full.toFixed(6)}、${maxDelta.lufs_integrated.toFixed(6)}、${maxDelta.true_peak_dbtp.toFixed(6)} dB。
- 原壓縮器參數保持 threshold −18 dB、knee 8 dB、ratio 6、attack .003 s、release .12 s。實例由原 \`BoardAudio.unlock()\` 建立，抽離後量測 997 Hz 正弦波穩態 RMS，取第 1–2 秒。輸入 −60/−40/−30/−20 dBFS，補增益都約 **+${probe.makeup[1].makeupDb.toFixed(6)} dB**；原壓縮器未修改。明細：\`../review-mobile-card-r/compressor-probe.json\`。
- 限幅器在原壓縮器後、destination 前，使用 65537 點 WaveShaper 曲線。|x| ≤ .65（−3.742 dBFS）時 f(x)=x；以上用 sign(x)×[.65+.13×(1−exp(−(|x|−.65)/.13))] 收斂。Web Audio 曲線輸入在 ±1 端點夾限，實際最大輸出約 −2.257 dBFS，保留取樣間重建餘裕。
- 沒有新增 DynamicsCompressorNode，所以沒有新增 makeup gain。\`oversample=none\` 避免改動小音量高頻；實際瀏覽器 .1/.63 振幅的 997 Hz 正弦輸出增益差 < 0.000001 dB，最大取樣差 ≤ 5.97e−8。
- 各音效音量、平衡、音色合成參數、殘響、原壓縮器參數與主音量沒有改動；只有最後輸出峰值進入非線性限幅。
- 音訊量測及獨立壓縮器 probe 的 console/page error/外部請求均為 0/0/0。
- 單音 CSV：\`../review-mobile-card-r/audio-levels-limited.csv\`；16 組原始資料：\`../review-mobile-card-r/audio-comparison.json\`。舊輸出未覆蓋。

### 單音最大差前 5 名（依三指標最大絕對差排序）

| 案例 | Δ全段 LUFS | Δgated LUFS | Δtrue peak dB |
|---|---:|---:|---:|
${top.map(d=>`| ${d.name} | ${tiny(d.delta.lufs_full)} | ${tiny(d.delta.lufs_integrated)} | ${tiny(d.delta.true_peak_dbtp)} |`).join('\n')}

### 16 個最密一秒（前 → 後）

| 案例 | LUFS | ΔLUFS | sample peak dBFS | true peak dBTP |
|---|---:|---:|---:|---:|
${rows}

### 同案例完整尾音區間（前 → 後）

| 案例 | 全段 LUFS | gated LUFS | sample peak dBFS | true peak dBTP |
|---|---:|---:|---:|---:|
${full}

## 推論

限幅只作用在單音測試範圍以上的峰值；密集瞬態減少，整段響度變動遠小於最高峰值變動。採用無延遲的軟限幅，代價是被限幅的瞬態會產生諧波；未將量測通過描述成主觀音質通過。

[Web Audio 規範](https://webaudio.github.io/web-audio-api/#DynamicsCompressorNode) 說明 DynamicsCompressorNode 的固定自動增益與 threshold/knee/ratio 有關；本次數字以實際 Edge 量測為準。

## 不確定

−1 dBTP 是同一組 16 個壓力案例、同一個四倍 FIR 量測器的驗收結果，並非對任意波形／所有瀏覽器的數學保證。軟限幅不含 oversampled true-peak 偵測器；其他合成事件序列仍可能有不同取樣間峰值。未完成 BS.2217 全套認證、實機音訊輸出或耳機實聽。
`;
await writeFile(resolve(out,'AUDIO-LIMITER.md'),md);
console.log(JSON.stringify({single:231,dense:16,maxDelta,highestDenseTP:Math.max(...dense.map(d=>d.after.true_peak_dbtp)),makeupDb:probe.makeup[1].makeupDb}));
