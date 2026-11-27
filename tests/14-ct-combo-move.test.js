// 2026-11-27: 조합결과TXT 팝업에서 ⠿ 손잡이로 조합 줄을 끌어 순서 이동 (조합 카드의 ▲▼·위치 메뉴는 삭제)
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/load-app');

function setup(names) {
  const { window: w } = loadApp();
  const st = w.eval('state');
  st.combos.length = 0;
  names.forEach((nm) => {
    const c = w.eval('emptyCombo()');
    if (nm) { c.slots[0].업체명 = nm; c.slots[0].지분율 = 100; }
    c._nm = nm || '(빈)';
    st.combos.push(c);
  });
  return { w, st, order: () => Array.from(st.combos, (c) => c._nm) };
}

test('조합 줄마다 ⠿ 손잡이, 복사 텍스트에는 마커/손잡이 없음', () => {
  const { w } = setup(['가가전기', '나나전기', '다다전기']);
  w.eval('exportCombosText()');
  assert.strictEqual(w.document.querySelectorAll('#m-ct-txt [data-ct-grip]').length, 3);
  w.__CT_RETURN_ONLY = true; const t = w.eval('exportCombosText()'); w.__CT_RETURN_ONLY = false;
  assert.ok(!/[-⠿]/.test(t));
});

test('ctDropCombo: 앞/중간/맨 끝으로 놓기', () => {
  const { w, order } = setup(['A', 'B', 'C', 'D']);
  assert.ok(w.eval('ctDropCombo(3,0)')); assert.deepStrictEqual(order(), ['D', 'A', 'B', 'C']);
  assert.ok(w.eval('ctDropCombo(0,3)')); assert.deepStrictEqual(order(), ['A', 'B', 'D', 'C']);
  assert.ok(w.eval('ctDropCombo(0,null)')); assert.deepStrictEqual(order(), ['B', 'D', 'C', 'A']);
  assert.strictEqual(w.eval('ctDropCombo(1,2)'), false); // 이미 그 자리
});

test('빈 조합이 사이에 있어도 보이는 위치 기준', () => {
  const { w, order } = setup(['A', '', 'C']);
  assert.ok(w.eval('ctDropCombo(2,0)'));
  assert.strictEqual(order()[0], 'C');
});

test('비교 조합끼리만 이동', () => {
  const { w, st, order } = setup(['A', 'B', 'C', 'D']);
  st.combos[2].비교 = true; st.combos[3].비교 = true;
  assert.strictEqual(w.eval('ctDropCombo(3,0)'), false);
  assert.ok(w.eval('ctDropCombo(3,2)'));
  assert.deepStrictEqual(order(), ['A', 'B', 'D', 'C']);
  assert.ok(w.eval('ctDropCombo(0,null)'));
  assert.deepStrictEqual(order(), ['B', 'A', 'D', 'C']);
});

test('마우스 드래그(손잡이 잡고 맨 위에 놓기) → 순서 변경 후 창 다시 그림', () => {
  const { w, order } = setup(['가가전기', '나나전기', '다다전기']);
  w.eval('exportCombosText()');
  const grip = w.document.querySelector('#m-ct-txt [data-ct-grip="2"]');
  grip.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, button: 0 }));
  w.document.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true, clientY: -5 }));
  w.document.dispatchEvent(new w.MouseEvent('mouseup', { bubbles: true }));
  assert.deepStrictEqual(order(), ['다다전기', '가가전기', '나나전기']);
  const tx = w.document.getElementById('m-ct-txt').textContent;
  assert.ok(tx.indexOf('다다') < tx.indexOf('가가'));
});

test('조합 카드에 ▲▼·위치 메뉴 없음', () => {
  const { w } = setup(['A', 'B']);
  w.eval('refreshCombos()');
  assert.strictEqual(w.document.querySelectorAll('.combo-move,[data-move-combo]').length, 0);
});
