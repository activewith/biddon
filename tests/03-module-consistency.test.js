// [기준] 기관 간 동일해야 하는 표/모듈 관계, 레지스트리 매핑, 추정가격 구간 분기.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/load-app');

test('LH 별표2 = 조달청 별표6, LH 별표3(A공사) = 조달청 별표7A (2026-09-04 A/B공사 혼동 버그 재발 방지)', () => {
  const { window: w } = loadApp();
  for (const k of ['부채', '유동', '영업']) {
    assert.deepEqual(plain(w['ECON_TABLE_' + k + 'LH2']), plain(w['ECON_TABLE_' + k + '6']), k + ' LH2≠별표6');
    const sevenKey = k === '영업' ? 'ECON_TABLE_영업7' : 'ECON_TABLE_' + k + '7A';
    assert.deepEqual(plain(w['ECON_TABLE_' + k + 'LH3']), plain(w[sevenKey]), k + ' LH3≠별표7A');
  }
});

test('적격기준 레지스트리 매핑', () => {
  const { window: w, T } = loadApp();
  const r = w.resolveEligibilityModule;
  for (const k of ['지자체', '조달청', 'LH', '철도공단', '한전', '도로공사', '수자원공사']) assert.equal(r(k), T[k], k);
  assert.equal(r('미등록기관'), T.조달청, '미등록 → 조달청 fallback');
  assert.equal(r(undefined), T.조달청);
});

test('도로공사·수자원공사는 경영상태·판정을 조달청과 공유', () => {
  const { T } = loadApp();
  for (const k of ['도로공사', '수자원공사']) {
    assert.equal(T[k].econScore, T.조달청.econScore);
    assert.equal(T[k].judge, T.조달청.judge);
  }
});

test('추정가격 구간 경계(10억/30억/50억/100억)', () => {
  const { window: w } = loadApp();
  assert.equal(w.LIMIT_10, 1e9); assert.equal(w.LIMIT_30, 3e9);
  assert.equal(w.LIMIT_50, 5e9); assert.equal(w.LIMIT_100, 1e10);
});

test('조달청 경영상태: 50억 이상 별표6, 10~50억 별표7A, 10억 미만 해당없음', () => {
  const { T } = loadApp();
  assert.equal(T.조달청.econScore(40, 160, 6, 5e9).type, '6');
  assert.equal(T.조달청.econScore(40, 160, 6, 5e9 - 1).type, '7A');
  assert.equal(T.조달청.econScore(40, 160, 6, 1e9).type, '7A');
  assert.equal(T.조달청.econScore(40, 160, 6, 1e9 - 1), null);
});

test('경영상태 만점: 별표6 15점, 별표7A 15점, LH 동일, 철도1 15점, 철도2 15점', () => {
  const { T } = loadApp();
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' ≠ ' + b);
  close(T.조달청.econScore(10, 300, 10, 6e9).score, 15);
  close(T.조달청.econScore(10, 300, 10, 2e9).score, 15);
  close(T.LH.econScore(10, 300, 10, 6e9).score, 15);
  close(T.LH.econScore(10, 300, 10, 2e9).score, 15);
  close(T.철도공단.econScore(10, 300, 10, 6e9).score, 15);
  close(T.철도공단.econScore(10, 300, 10, 2e9).score, 15);
});

test('지자체 별표 tier: 30억 미만 1, 30~50억 2, 50~100억 3, 100억 이상 4', () => {
  const { T } = loadApp();
  const t = T.지자체.tier;
  assert.equal(t(0), 0);
  assert.equal(t(3e9 - 1), 1); assert.equal(t(3e9), 2);
  assert.equal(t(5e9 - 1), 2); assert.equal(t(5e9), 3);
  assert.equal(t(1e10 - 1), 3); assert.equal(t(1e10), 4);
  assert.equal(T.지자체.usesThreeYear(5e9), true);
  assert.equal(T.지자체.usesThreeYear(5e9 - 1), false);
  assert.equal(T.지자체.noMaxShareLimit(1), true);
  assert.equal(T.지자체.noMaxShareLimit(2), false);
});
