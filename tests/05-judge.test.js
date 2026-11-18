// [현재동작] 조달청 공용 판정 엔진(judge) — 실적/시평/순신인도 게이트와 신용등급 구제.
// 비교 연산(초과 vs 이상)은 현재 코드 기준으로 고정. 기준서와 다르면 이 테스트를 근거로 함께 수정.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, plain } = require('./helpers/load-app');

const noRescue = { try: () => null, revert: () => {} };

test('조달청 judge: 모두 충족 → 적격', () => {
  const { T } = loadApp();
  const r = plain(T.조달청.judge(101, 100, 201, 200, 0, 0, noRescue));
  assert.equal(r.적격, true); assert.equal(r.적격사유, '적격');
});

test('조달청 judge: 실적 = 필요실적이면 부족(초과 요구)', () => {
  const { T } = loadApp();
  assert.equal(T.조달청.judge(100, 100, 201, 200, 0, 0, noRescue).적격사유, '실적 부족');
});

test('조달청 judge: 시평제한 없음(null)이면 시평 통과', () => {
  const { T } = loadApp();
  assert.equal(T.조달청.judge(101, 100, 0, null, 0, 0, noRescue).적격, true);
});

test('조달청 judge: 실적·시평 모두 부족 사유', () => {
  const { T } = loadApp();
  assert.equal(T.조달청.judge(1, 100, 1, 200, 0, 0, noRescue).적격사유, '실적·시평 모두 부족');
});

test('조달청 judge: 순신인도 음수 → 신용등급 구제 성공 시 적격', () => {
  const { T } = loadApp();
  let reverted = false;
  const rescue = { try: () => ({ 순신인도: 0.1, 감점환산: 0.2, applied: ['x'] }), revert: () => { reverted = true; } };
  const r = plain(T.조달청.judge(101, 100, 201, 200, -0.5, 1, rescue));
  assert.equal(r.적격, true); assert.equal(r.순신인도, 0.1); assert.equal(reverted, false);
});

test('조달청 judge: 구제해도 음수면 되돌리고 부적격', () => {
  const { T } = loadApp();
  let reverted = false;
  const rescue = { try: () => ({ 순신인도: -0.1, 감점환산: 0.9, applied: ['x'] }), revert: () => { reverted = true; } };
  const r = plain(T.조달청.judge(101, 100, 201, 200, -0.5, 1, rescue));
  assert.equal(r.적격, false); assert.equal(reverted, true);
  assert.match(r.적격사유, /신인도 감점 초과/);
});

test('한전 judge: 항상 적격판정 미적용(참고용)', () => {
  const { T } = loadApp();
  const r = plain(T.한전.judge(50, [], null, 100));
  assert.equal(r.적격, false);
  assert.match(r.적격사유, /50\.0%.*참고용/);
});
