"""使用本機既有 Matplotlib 畫圖；沒有該工具時保留模擬輸出的 CSV。"""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
import numpy as np

root = Path(__file__).resolve().parents[1]
folder = root / "artifacts" / "difficulty"
data = json.loads((folder / "summary.json").read_text(encoding="utf-8"))
font = Path("C:/Windows/Fonts/msjh.ttc")
if font.exists():
    plt.rcParams["font.family"] = FontProperties(fname=str(font)).get_name()
plt.rcParams.update({"font.size": 11, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.titlesize": 13, "axes.titleweight": "bold", "axes.unicode_minus": False})
fig, axes = plt.subplots(2, 2, figsize=(14, 9), constrained_layout=True)
colors = {"random": "#2463A6", "greedy": "#A6611A", "lazy": "#875594"}
styles = {"random": "-", "greedy": "--", "lazy": ":"}
for entry in data["results"]:
    bot, runs, summary = entry["bot"], entry["runs"], entry["summary"]
    points = {}
    for run in runs:
        for p in run["bossCurve"]:
            if p["tick"] % round(1 / data["config"]["dt"]) == 0:
                points.setdefault(p["seconds"], []).append(p["hp"])
    times = sorted(points)
    q = np.array([np.quantile(points[t], [.1, .5, .9]) for t in times])
    axes[0, 0].plot(times, q[:, 1], label=bot, color=colors[bot], ls=styles[bot], lw=2)
    axes[0, 0].fill_between(times, q[:, 0], q[:, 2], color=colors[bot], alpha=.1, linewidth=0)
    bins = summary["monsterBins"]
    axes[0, 1].plot([(b["from"] + b["to"]) / 2 for b in bins], [b["meanMonsters"] for b in bins],
                    label=bot, color=colors[bot], ls=styles[bot], marker="o", ms=4, lw=2)
    # 此處存活指在該秒尚未終局；終局恰在整秒的樣本不算存活。
    t = np.arange(0, int(max(r["seconds"] for r in runs)) + 2)
    axes[1, 0].step(t, [sum(r["seconds"] > v for r in runs) for v in t], where="post",
                    label=bot, color=colors[bot], ls=styles[bot], lw=2)
    i = list(colors).index(bot)
    for offset, field, hatch in [(-.19, "earlyChainRate", "//"), (.19, "winRate", "")]:
        value = summary[field] * 100
        axes[1, 1].bar(i + offset, value, width=.34, color=colors[bot], hatch=hatch,
                       edgecolor="#292929", linewidth=.6, alpha=.8)
        axes[1, 1].text(i + offset, value + 1.5, f"{value:.0f}%", ha="center", fontsize=10)
axes[0, 0].set(title="Boss HP：中位數與 P10–P90", xlabel="模擬秒數", ylabel="HP", ylim=(0, data["config"]["boss"]["hp"] * 1.03))
axes[0, 1].set(title="場上怪物：30 秒窗、實際 tick 加權", xlabel="模擬秒數（窗中心）", ylabel="平均隻數", ylim=(0, 11.7))
axes[0, 1].axhline(11, color="#555555", lw=1, ls="--")
axes[0, 1].text(0, 11.15, "失敗：超過 10 隻", fontsize=10)
axes[1, 0].set(title="仍在遊戲內的局數", xlabel="模擬秒數", ylabel="局數", ylim=(0, max(e["summary"]["games"] for e in data["results"]) + 2))
axes[1, 1].set(title="10 秒內連鎖與勝率", ylabel="全部已完成模擬的比例（%）", ylim=(0, 110),
               xticks=range(3), xticklabels=list(colors))
from matplotlib.patches import Patch
axes[1, 1].legend(handles=[Patch(facecolor="#dddddd", edgecolor="#292929", hatch="//", label="10 秒內至少 2 層"),
                         Patch(facecolor="#999999", edgecolor="#292929", label="勝率")], loc="upper left", fontsize=9)
for ax in axes.flat:
    ax.grid(axis="y", color="#dddddd", lw=.6)
    ax.set_axisbelow(True)
for ax in [axes[0, 0], axes[0, 1], axes[1, 0]]:
    ax.set_xlim(left=0)
    ax.legend(fontsize=9, frameon=False)
counts = " / ".join(f"{e['bot']} n={e['summary']['games']}" for e in data['results'])
fig.suptitle("共振球場：固定策略難度體檢\n" + counts + "；每 2 秒發球、120 Hz", fontsize=16)
fig.supxlabel("時間為模擬時間；曲線終局後不補值，後段母體改變。數值連鎖不代表真人感受。", fontsize=10)
path = folder / "curves.png"
fig.savefig(path, dpi=150, facecolor="white")
print(path)
