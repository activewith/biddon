// 2026-11-24: 가스공사 확정메세지 — LH처럼 대표사 사업자번호만 표기
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/load-app');

function confirmComp(inst) {
  const { window: w } = loadApp();
  w.eval(`
  if(!state.db.some(function(x){return x.업체명==='(주)창흥전력';})){
    state.db.push({업체명:'(주)창흥전력',사업자번호:'308-81-04307',지역:'경기',시평액:21364468000,실적5:34191641000,신인도:0,감점:0,groups:[]});
    state.db.push({업체명:'한우리전기',사업자번호:'127-40-59419',지역:'경기',시평액:2972415000,실적5:4698786000,신인도:0,감점:0,groups:[]});
  }
  state.settings.customInstitutions=[{name:'가스공사'}];
  Object.assign(state.bid,{추정가격:5788800000,투찰률:87.495,구성업체수:5,최소지분율:10,지역의무지분:30,지역선택:['경기'],공종:'전기',적격기준:'${inst}'});
  state.combos[0].slots=[Object.assign(emptySlot(),{업체명:'한우리전기',grp:'지역',지분율:49,시평액:2972415000,실적:4698786000}),Object.assign(emptySlot(),{업체명:'(주)창흥전력',grp:'필요',지분율:51,시평액:21364468000,실적:34191641000})];
  _showConfirmPopCore(0);`);
  const v = w.document.getElementById('m-cf-txt').value;
  w.eval("MODAL_ROOT.innerHTML=''");
  return v.slice(v.indexOf('<구성현황>') + 7, v.indexOf('협정 부탁')).trim();
}

test('가스공사: 대표사 사업자번호만', () => {
  assert.strictEqual(confirmComp('가스공사'), '(주)창흥전력 51%\n(308-81-04307)\n한우리전기 49%');
});
test('LH: 기존과 동일(대표사만)', () => {
  assert.strictEqual(confirmComp('LH'), '(주)창흥전력 51%\n(308-81-04307)\n한우리전기 49%');
});
test('조달청: 기존과 동일(구성사만)', () => {
  assert.strictEqual(confirmComp('조달청'), '(주)창흥전력 51%\n한우리전기 49%\n(127-40-59419)');
});
