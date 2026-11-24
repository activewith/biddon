// 2026-11-24: 지역 유형 업체선택 a/b 영역 — a=한 업체로 지역의무지분 충족, b=2개 이상 필요, c=감점, d===== 아래
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/load-app');

function run(의무, groups) {
  const { window: w } = loadApp();
  w.eval(`
    state.groups=${JSON.stringify(groups)};
    state.bid.지역의무지분=${의무 === null ? 'null' : 의무};
    state.bid.최소지분율=null;
    state.combos.length=0;
    window.__db=[
      {업체명:'A1',시평:600,ded:0,groups:['G1']},
      {업체명:'A2',시평:300,ded:0,groups:[]},
      {업체명:'B1',시평:299,ded:0,groups:['G1']},
      {업체명:'B2',시평:100,ded:0,groups:[]},
      {업체명:'C1',시평:900,ded:0.5,groups:[]}
    ];
    getDbByType=function(){return window.__db.slice();};
    getCompPerfData=function(c){return {시평액:c.시평,실적5:0,실적3:0};};
    getEffectiveDeduction=function(c){return {value:c.ded};};
    getRegionList=function(){return [];};
    regionMatchCo=function(){return false;};
  `);
  const calc = { E7: 1000, 공종: '전기' };
  w.__calc = calc;
  const html = w.eval("buildTypeCompanyOptions('지역','',window.__calc,null,null)");
  const order = Array.from(html.matchAll(/<option value="([^"]+)"/g)).map((m) => m[1]);
  return { html, order };
}

test('의무 30%: a(≥30%) → b(<30%) → c(감점), 영역 안은 그룹 → 개별', () => {
  const { html, order } = run(30, ['G1']);
  assert.deepStrictEqual(order, ['A1', 'A2', 'B1', 'B2', 'C1']);
  assert.ok(html.indexOf('label="개별"') > 0);
});

test('그룹 없음: a → 구분선 → b → 구분선 → c', () => {
  const { html, order } = run(30, []);
  assert.deepStrictEqual(order, ['A1', 'A2', 'B1', 'B2', 'C1']);
  assert.strictEqual((html.match(/label="─────────────"/g) || []).length, 2);
});

test('의무 미입력이면 기존 순서(그룹 → 개별 → 감점)', () => {
  const { order } = run(null, ['G1']);
  assert.deepStrictEqual(order, ['A1', 'B1', 'A2', 'B2', 'C1']);
});
