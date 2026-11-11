"""獨立核對掃描限制、逐局 CSV、完整回合與選值。"""
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
data = json.loads((directory / 'sweep2-summary.json').read_bytes())
baseline_raw = (ROOT / 'artifacts' / 'board-difficulty' / 'summary.json').read_bytes()
baseline = json.loads(baseline_raw)
checks = 0


def check(condition, label):
    global checks
    checks += 1
    if not condition:
        raise AssertionError(label)


def median(rows, key):
    values = [r[key] for r in rows if r[key] is not None]
    return statistics.median(values) if values else None


check(hashlib.sha256(baseline_raw).hexdigest() ==
      'd80f5825728153affb0553afb8bc1ec7b9f54f03a8feee192d506a9eed629657', '基準資料雜湊')
check(data['baselineCommit'] == '9f9ed69dcd4880c20e816f0cdbb1110357695248', '基準 commit')
check(data['complete'] and data['stoppedReason'] is None, '完整完成')
check(data['config'] == baseline['config'], '未覆寫基準設定')
groups = data['groups']
check(4 <= len(groups) <= 6, '4 至 6 組')
check([(g['key'], g['value']) for g in groups[:4]] == [
    ('waveBaseCount', 3), ('waveBaseCount', 4), ('waveHpGrowth', 160), ('waveHpGrowth', 200)], '指定四組及順序')
check(len({g['id'] for g in groups}) == len(groups), '無重複組')
if len(groups) > 4:
    check(all(not .25 <= g['summary']['winRate'] <= .45 for g in groups[:4]), '追加前四組均不合格')
    check(groups[2]['summary']['winRate'] > groups[3]['summary']['winRate'], 'HP 有下降趨勢')
    check(all(g['key'] == 'waveHpGrowth' for g in groups[4:]), '僅追加 HP')
check(sum(r['wallSeconds'] for r in data['resources']) < 2100, '累計掃描牆鐘預算')
check(sum(r['cpuSeconds'] for r in data['resources']) < 2100, '累計掃描 CPU 預算')
check(all(r['peakRssBytes'] < 3 * 1024 ** 3 for r in data['resources']), '取樣 RSS 預算')
bots = ['random', 'greedy', 'lazy']
summary_rows, full_checks, expected_csv = [], {}, []
for group in groups:
    raw = Path(group['detailPath']).read_bytes()
    check(hashlib.sha256(raw).hexdigest() == group['detailSha256'], '完整逐局檔案雜湊')
    detail = json.loads(raw)
    check(not detail['partialRound'] and group['complete'], '無不完整輪')
    config = copy.deepcopy(data['config'])
    config['board']['waveEveryTurns'] = 3
    config['board'][group['key']] = group['value']
    check(detail['config'] == config, '僅改間隔與指定單鍵')
    runs = detail['runs']
    check(len(runs) == 90, '每組 90 局')
    for bot in bots:
        rows = [r for r in runs if r['bot'] == bot]
        check([r['seed'] for r in rows] == list(range(20261111, 20261141)), '固定 30 seed')
    for r in runs:
        check(r['mode'] == 'board' and r['status'] in ['won', 'lost'], '自然勝敗，無逾時')
        for wave in r['waves']:
            planned = min(config['board']['waveMaxCount'], config['board']['waveBaseCount'] +
                          ((wave['wave'] - 1) // config['board']['wavesPerCountGrowth']) * config['board']['waveCountGrowth'])
            check(wave['planned'] == planned, '出怪數量按候選公式')
        expected_csv.append(dict(mode='board', waveEveryTurns=3, key=group['key'], value=group['value'],
                                 bot=r['bot'], seed=r['seed'], result=r['status'], turns=r['turn'],
                                 seconds=r['seconds'], bossHp=r['bossHp'], firstChain=r['firstChainSeconds'],
                                 deepestChain=r['deepestChain']))
    for bot in [*bots, 'all']:
        rows = [r for r in runs if bot == 'all' or r['bot'] == bot]
        losses = [r for r in rows if r['status'] == 'lost']
        expected = dict(games=len(rows), wins=sum(r['status'] == 'won' for r in rows), losses=len(losses),
                        seconds=median(rows, 'seconds'), turns=median(rows, 'turn'),
                        lossTurns=median(losses, 'turn'), bossHp=median(rows, 'bossHp'), lossBossHp=median(losses, 'bossHp'))
        actual = group['summary'] if bot == 'all' else next(b['summary'] for b in group['bots'] if b['bot'] == bot)
        for key in ['games', 'wins', 'losses']:
            check(actual[key] == expected[key], '勝敗統計 ' + key)
        check(math.isclose(actual['winRate'], expected['wins'] / expected['games']), '勝率')
        for target, key in [('seconds', 'seconds'), ('turn', 'turns'), ('lossTurn', 'lossTurns'), ('bossHp', 'bossHp'), ('lossBossHp', 'lossBossHp')]:
            check(actual[target]['median'] == expected[key], '中位數 ' + key)
        summary_rows.append(dict(key=group['key'], value=group['value'], bot=bot, **expected))
    fixture = copy.deepcopy(baseline)
    fixture['config'] = config
    fixture['runs'] = [r for r in baseline['runs'] if r['mode'] == 'realtime'] + runs
    fixture['groups'] = [g for g in baseline['groups'] if g['mode'] == 'realtime'] + [
        dict(mode='board', bot=bot, summary=group['summary'] if bot == 'all' else next(b['summary'] for b in group['bots'] if b['bot'] == bot))
        for bot in [*bots, 'all']]
    target = directory / ('verify-sweep2-' + group['id'])
    target.mkdir(exist_ok=True)
    (target / 'summary.json').write_text(json.dumps(fixture), encoding='utf-8')
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'verify-board-difficulty.py'), '--directory', str(target)], check=True, cwd=ROOT)
    full_checks[group['id']] = json.loads((target / 'verification.json').read_bytes())

csv_path = directory / 'runs-sweep2.csv'
with csv_path.open(encoding='utf-8', newline='') as file:
    reader = csv.DictReader(file)
    check(reader.fieldnames == ['mode', 'waveEveryTurns', 'key', 'value', 'bot', 'seed', 'result', 'turns', 'seconds', 'bossHp', 'firstChain', 'deepestChain'], '精確 CSV 欄位')
    csv_rows = list(reader)
check(len(csv_rows) == len(groups) * 90, 'CSV 列數')
check(data['runs'] == expected_csv, '摘要逐局資料')
for row, expected in zip(csv_rows, expected_csv):
    for key, value in expected.items():
        if key in ['seconds', 'firstChain'] and value is not None:
            check(math.isclose(float(row[key]), value, abs_tol=1e-10), 'CSV ' + key)
        else:
            check(row[key] == ('' if value is None else str(value)), 'CSV ' + key)
eligible = [g for g in groups if .25 <= g['summary']['wins'] / 90 <= .45]
selected = min(eligible, key=lambda g: abs(g['summary']['wins'] / 90 - .356))['id'] if eligible else None
check(data['selected'] == selected and data['blocked'] == (selected is None), '獨立選值')
result = dict(passed=True, checks=checks, fullTurnChecks=full_checks, selected=selected, blocked=selected is None,
              rows=summary_rows, csvDataRows=len(csv_rows), csvSha256=hashlib.sha256(csv_path.read_bytes()).hexdigest())
(directory / 'sweep2-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
