"""以 Python 標準庫獨立重算統計及檢查輸入／回合記錄。"""
import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--directory', default=str(ROOT / 'artifacts' / 'board-difficulty'))
args = parser.parse_args()
directory = Path(args.directory)
raw = (directory / 'summary.json').read_bytes()
data = json.loads(raw)
runs = data['runs']
checks = 0


def check(condition, message):
    global checks
    checks += 1
    if not condition:
        raise AssertionError(message)


def quantiles(values):
    values = sorted(v for v in values if v is not None)
    if not values:
        return dict(n=0, p10=None, median=None, p90=None)

    def q(p):
        index = (len(values) - 1) * p
        low = math.floor(index)
        return values[low] + (values[math.ceil(index)] - values[low]) * (index - low)
    return dict(n=len(values), p10=q(.1), median=q(.5), p90=q(.9))


def equal(actual, expected, label):
    if isinstance(expected, dict):
        for key, value in expected.items():
            equal(actual[key], value, label + '.' + key)
    elif isinstance(expected, (int, float)):
        check(actual is not None and math.isclose(actual, expected, abs_tol=1e-8), label)
    else:
        check(actual == expected, label)


count = data['protocol']['includedSeedsPerBot']
check(count == int(count) and 0 < count <= 30, '完整共同 seed 輪數')
for mode in ['realtime', 'board']:
    for bot in ['random', 'greedy', 'lazy']:
        group = [r for r in runs if r['mode'] == mode and r['bot'] == bot]
        check([r['seed'] for r in group] == list(range(20261111, 20261111 + int(count))), '相同完整 seed 前綴')

for group in data['groups']:
    rows = [r for r in runs if r['mode'] == group['mode'] and (group['bot'] == 'all' or r['bot'] == group['bot'])]
    losses = [r for r in rows if r['status'] == 'lost']
    summary = group['summary']
    equal(summary, dict(games=len(rows), wins=sum(r['status'] == 'won' for r in rows), losses=len(losses),
        timeouts=sum(r['status'] == 'timeout' for r in rows), winRate=sum(r['status'] == 'won' for r in rows) / len(rows)), '比例')
    for key in ['seconds', 'turn', 'completedTurns', 'firstChainSeconds', 'firstChainTurn', 'bossHp', 'deepestChain', 'shots']:
        equal(summary[key], quantiles(r[key] for r in rows), key)
    for target, key in [('lossSeconds', 'seconds'), ('lossTurn', 'turn'), ('lossBossHp', 'bossHp')]:
        equal(summary[target], quantiles(r[key] for r in losses), target)
    equal(summary['deepestChainMax'], max(r['deepestChain'] for r in rows), '最深層數')

dt = data['config']['dt']
for r in runs:
    check(r['status'] in ['won', 'lost', 'timeout'], '終局狀態')
    check(0 <= r['bossHp'] <= data['config']['boss']['hp'], 'Boss HP 範圍')
    check((r['bossHp'] == 0) == (r['status'] == 'won'), '勝利與 HP')
    check(r['seconds'] <= 600, '模擬秒數上限')
    check(r['bossCurve'][-1]['hp'] == r['bossHp'], '終局曲線 HP')
    check(r['bossCurve'][-1]['seconds'] == r['seconds'], '終局曲線時間')
    if r['mode'] == 'realtime':
        check(r['turn'] is None and r['completedTurns'] is None and r['firstChainTurn'] is None, '即時無回合')
        check(math.isclose(sum(b['bossDamage'] for b in r['bins']) + r['bossHp'], data['config']['boss']['hp']), 'Boss 傷害守恆')
        continue
    final = r['finalSnapshot']
    check(final['tick'] * dt == r['seconds'], '棋盤秒數')
    check(final['board']['turn'] == r['turn'] == len(r['rolls']) == len(r['turns']), '已開始回合')
    check(final['board']['bossClock'] == r['completedTurns'], '已完成回合')
    check(r['turn'] - r['completedTurns'] in [0, 1], '可能未結算最後回合')
    check(r['shots'] == len(r['inputs']) == sum(t['shots'] for t in r['turns']), '發射總數')
    check(r['inputs'] == final['inputs'] and r['rolls'] == final['board']['rolls'], '原始輸入完整')
    check(r['bossHp'] == final['boss']['hp'], '終局狀態 HP')
    check(final['status'] == r['status'] or r['status'] == 'timeout' and final['status'] == 'playing', '終局狀態一致')
    check(r['deepestChain'] == max((e['depth'] for e in final['events']), default=0), '事件最大深度')
    chain = next((e for e in r['chains'] if e['depth'] >= 2), None)
    check(r['firstChainSeconds'] == (chain['tick'] * dt if chain else None), '首次連鎖秒數')
    check(r['firstChainTurn'] == (chain['turn'] if chain else None), '首次連鎖回合')
    check(len(r['chains']) == len(final['events']), '事件記錄數量')
    for observed, event in zip(r['chains'], final['events']):
        check(observed['tick'] == event['tick'] and observed['depth'] == event['depth'], '事件記錄內容')
    for index, turn in enumerate(r['turns']):
        inputs = [s for s in r['inputs'] if s['tick'] >= turn['startTick'] and (index + 1 == len(r['turns']) or s['tick'] < r['turns'][index + 1]['startTick'])]
        check(len(inputs) == turn['shots'], '各回合射擊數')
        if inputs:
            check(inputs[0]['tick'] == turn['shootingTick'], '開放後立即首射')
        check(all(b['tick'] - a['tick'] == round(2 / dt) for a, b in zip(inputs, inputs[1:])), '兩秒發射間距')
        if turn['turn'] <= r['completedTurns']:
            check(turn['shots'] == turn['allowance'], '完成回合用完額度')
            check(turn['endTick'] is not None and turn['bossClock'] == turn['turn'], '完成回合時鐘')
        if index + 1 < len(r['turns']):
            check(r['turns'][index + 1]['startTick'] == turn['endTick'], '結算後立即擲骰')
    check(all(w['kind'] == 'scheduled' for w in r['waves']), '棋盤無半血增怪')
    for wave in r['waves']:
        clock = next(t['bossClock'] for t in r['turns'] if t['endTick'] == wave['tick'])
        check(clock == wave['wave'] * data['config']['board']['waveEveryTurns'], '波次按回合')
        check(wave['hp'] == data['config']['monsters']['hp'] + (wave['wave'] - 1) * data['config']['board']['waveHpGrowth'], '波次 HP')
    if r['status'] == 'lost':
        check(len(final['monsters']) > data['config']['monsters']['loseAbove'], '敗局怪物超量')

baseline_path = ROOT / 'artifacts' / 'difficulty' / 'summary.json'
baseline = {'available': baseline_path.exists(), 'matchedRuns': 0}
if baseline_path.exists():
    reference = json.loads(baseline_path.read_bytes())
    lookup = {(r['bot'], r['seed']): r for g in reference['results'] for r in g['runs']}
    baseline['sha256'] = hashlib.sha256(baseline_path.read_bytes()).hexdigest()
    for r in (r for r in runs if r['mode'] == 'realtime'):
        original = lookup.get((r['bot'], r['seed']))
        check(original is not None, '即時來源基準樣本存在')
        check({k: r[k] for k in original} == original, '即時完整逐局資料等同來源基準')
        baseline['matchedRuns'] += 1

result = dict(passed=True, checks=checks, includedGames=len(runs), seedsPerBot=count,
    summarySha256=hashlib.sha256(raw).hexdigest(), realtimeBaseline=baseline)
(directory / 'verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
