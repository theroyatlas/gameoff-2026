"""獨立核對固定樣本、CSV、決策，並重用基準的完整回合驗證器。"""
import argparse
import copy
import csv
import hashlib
import json
import math
import statistics
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--directory', default=str(ROOT.parent / 'review-board2'))
args = parser.parse_args()
directory = Path(args.directory)
data = json.loads((directory / 'waves-summary.json').read_bytes())
baseline_bytes = (ROOT / 'artifacts' / 'board-difficulty' / 'summary.json').read_bytes()
baseline = json.loads(baseline_bytes)
checks = 0


def check(condition, label):
    global checks
    checks += 1
    if not condition:
        raise AssertionError(label)


def median(rows, key):
    values = [r[key] for r in rows if r[key] is not None]
    return statistics.median(values) if values else None


check(hashlib.sha256(baseline_bytes).hexdigest() == data['baselineSha256'] ==
      'd80f5825728153affb0553afb8bc1ec7b9f54f03a8feee192d506a9eed629657', '基準雜湊')
check(data['complete'] and data['stoppedReason'] is None and not data['partialRound'], '完整完成')
check(len(data['runs']) == 270, '基準 90 局加新測 180 局')
bots = ['random', 'greedy', 'lazy']
lookup = {(r['bot'], r['seed']): r for r in baseline['runs'] if r['mode'] == 'board'}
summary_rows = []
for value in [2, 3, 4]:
    for bot in bots:
        rows = [r for r in data['runs'] if r['waveEveryTurns'] == value and r['bot'] == bot]
        check([r['seed'] for r in rows] == list(range(20261111, 20261141)), '固定 30 seed')
        check(all(r['mode'] == 'board' and r['status'] in ['won', 'lost'] for r in rows), '棋盤自然勝敗，無逾時')
        if value == 2:
            for row in rows:
                original = lookup[(row['bot'], row['seed'])]
                check({key: row[key] for key in original} == original, '2 完整原始資料直接引用')
    for bot in [*bots, 'all']:
        rows = [r for r in data['runs'] if r['waveEveryTurns'] == value and (bot == 'all' or r['bot'] == bot)]
        losses = [r for r in rows if r['status'] == 'lost']
        expected = dict(games=len(rows), wins=sum(r['status'] == 'won' for r in rows), losses=len(losses),
                        seconds=median(rows, 'seconds'), turns=median(rows, 'turn'),
                        lossTurns=median(losses, 'turn'), bossHp=median(rows, 'bossHp'), lossBossHp=median(losses, 'bossHp'))
        actual = next(g['summary'] for g in data['groups'] if g['waveEveryTurns'] == value and g['bot'] == bot)
        check(actual['games'] == expected['games'] and actual['wins'] == expected['wins'] and actual['losses'] == expected['losses'], '勝敗統計')
        for target, key in [('seconds', 'seconds'), ('turn', 'turns'), ('lossTurn', 'lossTurns'), ('bossHp', 'bossHp'), ('lossBossHp', 'lossBossHp')]:
            check(actual[target]['median'] == expected[key], '中位數 ' + key)
        summary_rows.append(dict(waveEveryTurns=value, bot=bot, **expected))

csv_path = directory / 'runs-waves.csv'
with csv_path.open(encoding='utf-8', newline='') as f:
    csv_rows = list(csv.DictReader(f))
check(len(csv_rows) == 270, 'CSV 資料列數')
for row, original in zip(csv_rows, data['runs']):
    for key in ['mode', 'waveEveryTurns', 'bot', 'seed', 'bossHp', 'deepestChain', 'firstChainTurn', 'completedTurns', 'shots', 'provenance']:
        expected = original[key]
        check(row[key] == ('' if expected is None else str(expected)), 'CSV ' + key)
    for target, key in [('result', 'status'), ('turns', 'turn')]:
        check(row[target] == str(original[key]), 'CSV ' + target)
    for target, key in [('seconds', 'seconds'), ('firstChain', 'firstChainSeconds')]:
        expected = original[key]
        check(row[target] == '' if expected is None else math.isclose(float(row[target]), expected, abs_tol=1e-10), 'CSV ' + target)

candidates = [r for r in summary_rows if r['bot'] == 'all' and r['waveEveryTurns'] != 2]
blocked = all(not .25 <= r['wins'] / r['games'] <= .45 for r in candidates)
selected = None if blocked else min(candidates, key=lambda r: (abs(r['wins'] / r['games'] - .356), r['waveEveryTurns']))['waveEveryTurns']
check(data['blocked'] == blocked and data['selected'] == selected, '獨立選值判定')
full_checks = {}
for value in [3, 4]:
    fixture = copy.deepcopy(baseline)
    fixture['config']['board']['waveEveryTurns'] = value
    fixture['runs'] = [r for r in baseline['runs'] if r['mode'] == 'realtime'] + [r for r in data['runs'] if r['waveEveryTurns'] == value]
    fixture['groups'] = [g for g in baseline['groups'] if g['mode'] == 'realtime'] + [dict(mode='board', bot=g['bot'], summary=g['summary']) for g in data['groups'] if g['waveEveryTurns'] == value]
    target = directory / f'verify-wave{value}'
    target.mkdir(exist_ok=True)
    (target / 'summary.json').write_text(json.dumps(fixture, ensure_ascii=False), encoding='utf-8')
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'verify-board-difficulty.py'), '--directory', str(target)], check=True, cwd=ROOT)
    full_checks[str(value)] = json.loads((target / 'verification.json').read_bytes())

result = dict(passed=True, checks=checks, fullTurnChecks=full_checks, blocked=blocked, selected=selected,
              rows=summary_rows, csvDataRows=len(csv_rows), csvSha256=hashlib.sha256(csv_path.read_bytes()).hexdigest(),
              summarySha256=hashlib.sha256((directory / 'waves-summary.json').read_bytes()).hexdigest())
(directory / 'waves-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
