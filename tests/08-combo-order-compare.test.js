// 2026-11-20: 조합 순서 이동 · 비교 조합 · 전송 체크 시각
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/load-app');

function setup(n) {
  const { window: w } = loadApp();
  const st = w.eval('state');
  st.combos.length = 0;
  for (let i = 0; i < n; i++) { const c = w.eval('emptyCombo()'); c._id = i + 1; st.combos.push(c); }
  return { w, st, ids: () => Array.from(st.combos, (c) => c._id) };
}

test('#3을 #1 뒤로', () => {
  const { w, ids } = setup(5);
  assert.ok(w.eval('moveCombo(2,0)'));
  assert.deepStrictEqual(ids(), [1, 3, 2, 4, 5]);
});

test('#1을 #5 뒤로', () => {
  const { w, ids } = setup(5);
  assert.ok(w.eval('moveCombo(0,4)'));
  assert.deepStrictEqual(ids(), [2, 3, 4, 5, 1]);
});

test('▲▼·맨 앞으로', () => {
  const { w, ids } = setup(4);
  w.eval("moveCombo(3,'front')"); assert.deepStrictEqual(ids(), [4, 1, 2, 3]);
  w.eval("moveCombo(1,'down')"); assert.deepStrictEqual(ids(), [4, 2, 1, 3]);
  assert.strictEqual(w.eval("moveCombo(0,'up')"), false);
});

test('비교 조합은 맨 아래(그룹 내 순서 유지), 그룹 간 이동 불가', () => {
  const { w, st, ids } = setup(5);
  st.combos[0].비교 = true; st.combos[2].비교 = true;
  w.eval('normalizeComboOrder(state.combos)');
  assert.deepStrictEqual(ids(), [2, 4, 5, 1, 3]);
  assert.strictEqual(w.eval('moveCombo(0,4)'), false); // 일반→비교 조합 뒤로는 불가
  assert.ok(w.eval("moveCombo(4,'front')"));            // 비교 그룹 안 맨 앞
  assert.deepStrictEqual(ids(), [2, 4, 5, 3, 1]);
});
