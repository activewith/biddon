// [기준표 스냅샷] 적격UPDATE 대상 숫자표(ELIG_TABLE_DEFS) 전체를 저장된 스냅샷과 비교.
// 숫자 하나라도 바뀌면 실패 → 의도한 기준 개정이면 스냅샷을 갱신(npm run snapshot:update)하고,
// 의도하지 않은 변경이면 버그. 기준 개정 시 "무엇이 바뀌었는지"를 git diff로 그대로 확인하는 용도.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, plain } = require('./helpers/load-app');

const SNAP = path.join(__dirname, 'snapshots', 'elig-tables.json');

test('적격기준 숫자표가 스냅샷과 일치', () => {
  const { window: w } = loadApp();
  const defs = w.ELIG_TABLE_DEFS;
  assert.ok(Array.isArray(defs) && defs.length > 0, 'ELIG_TABLE_DEFS 없음');
  const current = {};
  for (const d of defs) current[d.key] = plain(w[d.varName]);
  if (process.env.UPDATE_SNAPSHOT || !fs.existsSync(SNAP)) {
    fs.writeFileSync(SNAP, JSON.stringify(current, null, 2) + '\n');
    return;
  }
  const saved = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
  const changed = Object.keys({ ...saved, ...current })
    .filter((k) => JSON.stringify(saved[k]) !== JSON.stringify(current[k]));
  assert.deepEqual(changed, [], '바뀐 표: ' + changed.join(', ') +
    ' — 기준 개정이 맞으면 `npm run snapshot:update` 후 커밋');
});
