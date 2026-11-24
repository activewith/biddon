// 2026-11-24: 확정메세지 '최대지분' 근거 줄
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/load-app');

function note(w, calcPatch, rows) {
  w.__c = Object.assign({ E7: 5713745509 }, calcPatch);
  w.__r = { ROW: rows };
  return w.eval('getMaxShareBasisNote(window.__r, window.__c)');
}

test('스크린샷 사례: 한우리 29.7억÷57.2억=52%, 100% 이상 업체 생략', () => {
  const { window: w } = loadApp();
  const out = note(w, {}, [
    { 업체명: '한우리전기', grp: '지역', 시평액: 2972415000, 최대지분율_pct: 52.02 },
    { 업체명: '(주)창흥전력', grp: '필요', 시평액: 21364468000, 최대지분율_pct: 373.91 },
    { 업체명: '', grp: '지역', 시평액: 0, 최대지분율_pct: 0 },
  ]);
  assert.strictEqual(out, '     [한우리전기29.7억÷투찰예상57.2억=52%]');
});

test('지역 유형만 표기(실적·필요 등은 100% 미만이어도 생략)', () => {
  const { window: w } = loadApp();
  const out = note(w, {}, [
    { 업체명: '실적사', grp: '실적', 시평액: 2000000000, 최대지분율_pct: 35 },
    { 업체명: '필요사', grp: '필요', 시평액: 2000000000, 최대지분율_pct: 35 },
    { 업체명: '지역사', grp: '지역', 시평액: 2000000000, 최대지분율_pct: 35 },
  ]);
  assert.strictEqual(out, '     [지역사20억÷투찰예상57.2억=35%]');
});

test('최대지분율 제한 없는 기준은 표기 안 함', () => {
  const { window: w } = loadApp();
  const rows = [{ 업체명: 'A', grp: '지역', 시평액: 1e9, 최대지분율_pct: 17.5 }];
  for (const p of [{ jijaTier: 1 }, { isDoRo: true }, { isRail: true }, { isKEPCO: true }]) {
    assert.strictEqual(note(w, p, rows), '');
  }
});

test('LH는 지분기준 라벨', () => {
  const { window: w } = loadApp();
  const out = note(w, { isLH: true, lh지분율기준: 6000000000 }, [{ 업체명: '㈜가나', grp: '지역', 시평액: 3000000000, 최대지분율_pct: 50 }]);
  assert.strictEqual(out, '     [가나30억÷지분기준60억=50%]');
});
