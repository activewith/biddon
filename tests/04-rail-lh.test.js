// [기준] 철도공단 100점 배점제 구간, LH 가격점수.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

test('철도 구간: 3억 미만·100억 이상은 100점제 아님(null)', () => {
  const { window: w } = loadApp();
  assert.equal(w.railScoreTier(3e8 - 1), null);
  assert.equal(w.railScoreTier(3e8).tier, 'T3');
  assert.equal(w.railScoreTier(1e9 - 1).tier, 'T3');
  assert.equal(w.railScoreTier(1e9).tier, 'T2');
  assert.equal(w.railScoreTier(5e9 - 1).tier, 'T2');
  assert.equal(w.railScoreTier(5e9).tier, 'T1');
  assert.equal(w.railScoreTier(1e10 - 1).tier, 'T1');
  assert.equal(w.railScoreTier(1e10), null);
});

test('철도 시공계획적정성(20점)은 50억 이상(T1)만 적용 (2026-09-23 수정 재발 방지)', () => {
  const { window: w } = loadApp();
  assert.equal(w.railScoreTier(6e9).시공계획적용, true);
  assert.equal(w.railScoreTier(6e9).시공계획, 20);
  for (const e5 of [2e9, 5e8]) {
    assert.equal(w.railScoreTier(e5).시공계획적용, false);
    assert.equal(w.railScoreTier(e5).시공계획, 0);
  }
});

test('철도 만점 조합은 각 구간에서 정확히 95점(실적+기술+경영+시공계획+가격캡)', () => {
  const { window: w } = loadApp();
  for (const e5 of [6e9, 2e9, 5e8]) {
    const t = w.railScoreTier(e5);
    const sum = t.실적배점 + t.기술배점 + t.경영배점 + (t.시공계획적용 ? t.시공계획 : 0) + t.가격cap점수;
    assert.equal(sum, 95, t.tier + ' 만점합 ' + sum);
  }
});

test('철도 별표5(소방): 기술 제외·실적 15점, N값(30억 미만 ×2)', () => {
  const { window: w } = loadApp();
  const f = (E5, E4) => w.railTierFor({ E5, E4_eff: E4, 공종: '소방' });
  assert.equal(f(2e9, 2.2e9).기술배점, 0);
  assert.equal(f(2e9, 2.2e9).실적배점, 15);
  assert.equal(f(2e9, 2.2e9).실적N, 2);
  assert.equal(f(3e9, 3.3e9).실적N, 3);
  assert.equal(f(6e9, 6.6e9).실적N, 3);
  assert.equal(f(5e8, 5.5e8).실적N, 0.5);
  assert.equal(f(6e9, 6.6e9).설계금액적용, 5e9, '설계금액 50억 상한');
  // 별표5도 만점합 95
  for (const [e5, e4] of [[6e9, 6.6e9], [2e9, 2.2e9], [5e8, 5.5e8]]) {
    const t = f(e5, e4);
    assert.equal(t.실적배점 + t.기술배점 + t.경영배점 + (t.시공계획적용 ? t.시공계획 : 0) + t.가격cap점수, 95);
  }
});

test('철도 실적점수: 실적기준금액 이상이면 만점, 상한 초과 없음', () => {
  const { window: w } = loadApp();
  const t = w.railTierFor({ E5: 2e9, 공종: '전기' });
  assert.equal(w.railPerfScore(t.실적기준금액, t).점수, t.실적배점);
  assert.equal(w.railPerfScore(t.실적기준금액 * 3, t).점수, t.실적배점);
  assert.equal(w.railPerfScore(t.실적기준금액 / 2, t).점수, t.실적배점 / 2);
  assert.equal(w.railPerfScore(0, t).점수, 0);
});

test('LH 가격점수: 캡 구간(50억↑ 92.5~100% → 45, 미만 91.25~100% → 65)', () => {
  const { window: w } = loadApp();
  const p = w.lhCalcPriceScore;
  assert.equal(p(92.5, 100, 0, true), 45);
  assert.equal(p(100, 100, 0, true), 45);
  assert.equal(p(91.25, 100, 0, false), 65);
  assert.equal(p(100, 100, 0, false), 65);
  // A값 적용: (투찰-A)/(예정-A)
  assert.equal(p(10 + (100 - 10) * 0.925, 100, 10, true), 45);
  // 투찰금액/예정가격 없음 → 기본점수
  assert.equal(p(0, 100, 0, true), 45);
  assert.equal(p(0, 100, 0, false), 65);
});
