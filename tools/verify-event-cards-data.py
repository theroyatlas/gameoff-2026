"""以獨立 CSV 解析重算每組完整固定 seed/bot 結果，不依賴報告勝率。"""
import csv
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = root.parent / 'review-event-cards'
groups = []
for label in ['baseline', 'events-260', 'events-340', 'events-420', 'events-300']:
    path = out / f'{label}.csv'
    with path.open(encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
    expected = {(str(seed), bot) for seed in range(20261111, 20261141) for bot in ['random', 'greedy', 'lazy']}
    assert len(rows) == 90 and {(r['seed'], r['bot']) for r in rows} == expected
    for row in rows:
        assert row['status'] in ['won', 'lost']
        assert int(row['won']) == int(row['status'] == 'won')
        assert int(row['turns']) > 0
        cards = json.loads(row['cards'])
        assert all(c['turn'] <= int(row['turns']) and c['name'] and c['effect'] for c in cards)
    wins = sum(int(r['won']) for r in rows)
    recorded = json.loads((out / f'{label}.json').read_text(encoding='utf-8'))
    assert wins == recorded['wins'] and len(rows) == recorded['games']
    groups.append({'label': label, 'games': len(rows), 'wins': wins, 'winRate': wins / len(rows),
                   'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                   'cards': sum(len(json.loads(r['cards'])) for r in rows)})
selected = next(g for g in groups if g['label'] == 'events-300')
assert .30 <= selected['winRate'] <= .40
(out / 'csv-recount.json').write_text(json.dumps({'pass': True, 'groups': groups}, indent=2), encoding='utf-8')
print(json.dumps(groups, ensure_ascii=False))
