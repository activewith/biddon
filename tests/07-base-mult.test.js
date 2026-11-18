// 2026-11-18: 공고입력 '기초금액' 칸 = 공고별 배율 입력. 기초금액(금액)은 공고문분석에서만 입력.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./helpers/load-app');

function setup() {
  const { window: w } = loadApp();
  // 입력칸 이벤트는 boot()→bind()에서 연결됨(테스트 로더는 로그인 전 상태라 직접 호출, 파일별 별도 프로세스)
  try { w.eval('boot()'); } catch (e) {}
  const st = w.eval('state');
  Object.assign(st.bid, { 추정가격: 3046900000, 기초금액: null, 기초배율: null });
  const el = w.document.getElementById('in-기초금액');
  const type = (v) => {
    el.dispatchEvent(new w.Event('focus'));
    el.value = v;
    el.dispatchEvent(new w.Event('blur'));
  };
  const base = () => w.document.getElementById('o-기초자동').textContent;
  return { w, st, el, type, base };
}

test('배율 미입력: 설정 배율(1.1) 적용', () => {
  const { w, st } = setup();
  w.eval('refreshBidStats()');
  assert.strictEqual(Math.round(w.eval('calcBid()').E4_eff), Math.round(3046900000 * 1.1));
  assert.strictEqual(st.bid.기초배율, null);
});

test('배율 수기 입력(1.05) → 기초가격(자동)=추정×1.05', () => {
  const { st, type, base } = setup();
  type('1.05');
  assert.strictEqual(st.bid.기초배율, 1.05);
  assert.strictEqual(base(), Math.round(3046900000 * 1.05).toLocaleString('ko-KR'));
});

test('10 이상(금액) 입력은 거부 — 기초금액은 공고문분석에서만', () => {
  const { st, el, type } = setup();
  type('3351590000');
  assert.strictEqual(st.bid.기초금액, null);
  assert.strictEqual(st.bid.기초배율, null);
  assert.strictEqual(el.value, '');
});

test('공고문분석 기초금액이 있으면 금액 우선, 칸에 금액 표시', () => {
  const { w, st, el } = setup();
  st.bid.기초금액 = 3300000000; st.bid.기초배율 = 1.05;
  w.eval('renderBaseField();refreshBidStats()');
  assert.strictEqual(el.value, (3300000000).toLocaleString('ko-KR'));
  assert.strictEqual(Math.round(w.eval('calcBid()').E4_eff), 3300000000);
});

test('비우면 배율·기초금액 모두 해제 → 설정 배율 복귀', () => {
  const { w, st, type } = setup();
  st.bid.기초배율 = 1.05;
  type('');
  assert.strictEqual(st.bid.기초배율, null);
  assert.strictEqual(Math.round(w.eval('calcBid()').E4_eff), Math.round(3046900000 * 1.1));
});

// boot()가 남긴 타이머 정리(프로세스가 끝나도록)
test.after(() => { try { loadApp().window.close(); } catch (e) {} });
