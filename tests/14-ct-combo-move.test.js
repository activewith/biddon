// 2026-11-27: 조합결과TXT 팝업에서 ▲▼로 조합 순서 이동
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
const lines = (w) => w.document.getElementById('m-ct-txt');
const click = (w, ci, dir) => {
  const b = w.document.querySelector('[data-ct-mv="' + ci + '"][data-dir="' + dir + '"]');
  assert.ok(b, '버튼 없음 ' + ci + dir);
  b.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
};

test('조합 줄마다 ▲▼ 표시, 복사 텍스트에는 마커/버튼 없음', () => {
  const { w } = setup(['가가전기', '나나전기', '다다전기']);
  w.eval('exportCombosText()');
  assert.strictEqual(w.document.querySelectorAll('.ct-mv').length, 3);
  assert.ok(w.document.querySelector('[data-ct-mv="0"][data-dir="up"]').disabled);
  assert.ok(w.document.querySelector('[data-ct-mv="2"][data-dir="down"]').disabled);
  {
    w.__CT_RETURN_ONLY = true; const t = w.eval('exportCombosText()'); w.__CT_RETURN_ONLY = false;
    assert.ok(!/[-▲▼]/.test(t));
  }
});

test('▼ 클릭 → 조합 순서·TXT 순서 함께 변경', () => {
  const { w, order } = setup(['가가전기', '나나전기', '다다전기']);
  w.eval('exportCombosText()');
  click(w, 0, 'down');
  assert.deepStrictEqual(order(), ['나나전기', '가가전기', '다다전기']);
  const tx = lines(w).textContent;
  assert.ok(tx.indexOf('나나') < tx.indexOf('가가'));
});

test('빈 조합은 건너뛰고 보이는 이웃 기준으로 ▲ 이동', () => {
  const { w, order } = setup(['가가전기', '', '다다전기']);
  w.eval('exportCombosText()');
  assert.strictEqual(w.document.querySelectorAll('.ct-mv').length, 2);
  click(w, 2, 'up');
  assert.deepStrictEqual(order(), ['다다전기', '가가전기', '(빈)']);
});

test('비교 조합끼리만 이동', () => {
  const { w, st, order } = setup(['가가전기', '나나전기', '다다전기', '라라전기']);
  st.combos[2].비교 = true; st.combos[3].비교 = true;
  w.eval('exportCombosText()');
  assert.ok(w.document.querySelector('[data-ct-mv="2"][data-dir="up"]').disabled);
  click(w, 3, 'up');
  assert.deepStrictEqual(order(), ['가가전기', '나나전기', '라라전기', '다다전기']);
});
