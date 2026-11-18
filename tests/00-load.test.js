// 앱이 오류 없이 로드되는지, 핵심 함수가 존재하는지
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

test('index.html 로드 시 JS 오류 없음', () => {
  const { errors } = loadApp();
  assert.deepEqual(errors, []);
});

test('핵심 함수·모듈 존재', () => {
  const { window: w, T } = loadApp();
  for (const f of ['extractBidFields', 'calcBid', 'calcSlot', 'calcEconScore', 'resolveEligibilityModule',
    'railScoreTier', 'railTierFor', 'railPerfScore', 'lhCalcPriceScore', 'calcSafetyBonus', 'parseCreditRating']) {
    assert.equal(typeof w[f], 'function', f + ' 없음');
  }
  for (const k of ['지자체', '조달청', 'LH', '철도공단', '한전', '도로공사', '수자원공사']) {
    assert.ok(T[k], '적격기준_' + k + ' 없음');
  }
});
