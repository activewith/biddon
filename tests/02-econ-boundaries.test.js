// [기준] 경영상태 배점표 경계값 해석.
// 부채비율: "○% 미만"이 상위 등급(경계값 자체는 아래 등급). 유동비율·영업연수: "○ 이상"이 상위 등급.
// 표 숫자를 바꿔도(개정) 이 해석 규칙이 깨지면 실패한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const SETS = [
  ['부채등급6', 'ECON_TABLE_부채6', 'lt'], ['유동등급6', 'ECON_TABLE_유동6', 'gte'], ['영업등급6', 'ECON_TABLE_영업6', 'gte'],
  ['부채등급7A', 'ECON_TABLE_부채7A', 'lt'], ['유동등급7A', 'ECON_TABLE_유동7A', 'gte'], ['영업등급7', 'ECON_TABLE_영업7', 'gte'],
  ['부채등급LH2', 'ECON_TABLE_부채LH2', 'lt'], ['유동등급LH2', 'ECON_TABLE_유동LH2', 'gte'], ['영업등급LH2', 'ECON_TABLE_영업LH2', 'gte'],
  ['부채등급LH3', 'ECON_TABLE_부채LH3', 'lt'], ['유동등급LH3', 'ECON_TABLE_유동LH3', 'gte'], ['영업등급LH3', 'ECON_TABLE_영업LH3', 'gte'],
  ['부채등급철도1', 'ECON_TABLE_부채철도1', 'lt'], ['유동등급철도1', 'ECON_TABLE_유동철도1', 'gte'], ['영업등급철도1', 'ECON_TABLE_영업철도1', 'gte'],
  ['부채등급철도2', 'ECON_TABLE_부채철도2', 'lt'], ['유동등급철도2', 'ECON_TABLE_유동철도2', 'gte'], ['영업등급철도2', 'ECON_TABLE_영업철도2', 'gte'],
];

for (const [fn, tbl, mode] of SETS) {
  test(fn + ' 경계값', () => {
    const { window: w } = loadApp();
    const f = w[fn], table = w[tbl];
    for (let i = 0; i < table.length - 1; i++) {
      const t = table[i].t, up = table[i], down = table[i + 1];
      if (mode === 'lt') {
        assert.equal(f(t - 0.01).g, up.g, `${fn}(${t - 0.01}) → ${up.g}`);
        assert.equal(f(t).g, down.g, `${fn}(${t}) 경계값은 아래 등급 ${down.g}`);
      } else {
        assert.equal(f(t).g, up.g, `${fn}(${t}) 경계값은 위 등급 ${up.g}`);
        assert.equal(f(t - 0.01).g, down.g, `${fn}(${t - 0.01}) → ${down.g}`);
      }
    }
    // 점수는 등급이 내려갈수록 줄어야 함(표 입력 실수 검출)
    for (let i = 1; i < table.length; i++) assert.ok(table[i].s < table[i - 1].s, `${tbl} 점수 역전: ${i}`);
  });
}

test('부채비율 구간 경계 t는 오름차순, 유동·영업은 내림차순', () => {
  const { window: w } = loadApp();
  for (const [, tbl, mode] of SETS) {
    const ts = w[tbl].slice(0, -1).map((r) => r.t);
    for (let i = 1; i < ts.length; i++) {
      assert.ok(mode === 'lt' ? ts[i] > ts[i - 1] : ts[i] < ts[i - 1], `${tbl} 경계 순서 오류`);
    }
  }
});
