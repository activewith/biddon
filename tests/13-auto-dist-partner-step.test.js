// 2026-11-25: 자동분배 — 우선협정업체가 약정지분율로는 '필요' 후보가 아니면 지역업체 지분을 5%단위로 낮춰(지역의무지분까지) 재시도
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/load-app');

function run(의무, okMax) {
  const { window: w } = loadApp();
  w.eval(`
    state.bid.지역의무지분=${의무 === null ? 'null' : 의무};
    state.bid.최소지분율=10;
    state.bid.기본지분율=65;
    state.db=[
      {업체명:'지역A',전기_우선협정:'협정B',개별최대지분율:49},
      {업체명:'협정B'}
    ];
    calcBid=function(){return {E7:100,공종:'전기',jijaTier:0};};
    save=function(){};refreshCombos=function(){};
    window.__toasts=[];toast=function(m){window.__toasts.push(m);};
    window.__tried=[];
    isEligibleForNeedType=function(name,calc,ci,si){
      var r=state.combos[0].slots.find(function(s){return s.grp==='지역';});
      window.__tried.push(r.지분율);
      return r.지분율<=${okMax};
    };
    var s0=emptySlot();s0.grp='지역';s0.업체명='지역A';s0.시평액=1000;s0.개별최대지분율=49;
    state.combos.length=0;state.combos.push({slots:[s0,emptySlot(),emptySlot()]});
  `);
  w.eval('recommendRegional(0)');
  const slots = w.eval('JSON.parse(JSON.stringify(state.combos[0].slots))');
  return { slots, tried: JSON.parse(w.eval('JSON.stringify(window.__tried)')), toasts: JSON.parse(w.eval('JSON.stringify(window.__toasts)')) };
}

test('의무 30%: 49→45→40에서 통과 → 지역 40 / 우선협정 60', () => {
  const { slots, tried } = run(30, 40);
  assert.deepStrictEqual(tried, [49, 45, 40]);
  assert.strictEqual(slots[0].지분율, 40);
  assert.strictEqual(slots[1].업체명, '협정B');
  assert.strictEqual(slots[1].grp, '필요');
  assert.strictEqual(slots[1].지분율, 60);
});

test('의무 30%까지 낮춰도 불가 → 투입 안 함, 지역은 약정 49 유지', () => {
  const { slots, tried } = run(30, 20);
  assert.deepStrictEqual(tried, [49, 45, 40, 35, 30]);
  assert.strictEqual(slots[0].지분율, 49);
  assert.strictEqual(slots[1].업체명, '');
});

test('지역의무지분 미입력 → 기존 동작(49만 시도)', () => {
  const { tried, slots } = run(null, 40);
  assert.deepStrictEqual(tried, [49]);
  assert.strictEqual(slots[1].업체명, '');
});
