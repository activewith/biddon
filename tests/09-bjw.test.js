// 변전전기원 양성·보유실적 (2026-11-20) — 점수 산정, 만료 알람, 업체등록 화면, 한전 단독판정 반영
const test = require('node:test');
const assert = require('node:assert');
const { loadApp, plain } = require('./helpers/load-app');
const { window: w } = loadApp();
const at = new w.Date(2026, 10, 20);

test('평점 → 배점 구간 (5↑3.5 / 3↑2.4 / 2↑1.2 / 미만 0)', () => {
  const S = (d) => plain(w.calcBjwScore(d, at));
  assert.strictEqual(S({}).score, 0);
  assert.strictEqual(S({ 보유: [{ 급: '2', 취득일: '2020-01-01' }] }).score, 1.2);   // 2.5
  assert.strictEqual(S({ 보유: [{ 급: '1' }] }).score, 2.4);                          // 3.0
  assert.strictEqual(S({ 보유: [{ 급: '2' }, { 급: '2' }] }).score, 3.5);              // 5.0
  const r = S({ 양성: { 급: '2', 취득일: '250125' }, 보유: [{ 급: '2' }] });           // 2.5+2.5
  assert.deepStrictEqual([r.양성, r.보유, r.평점, r.score], [2.5, 2.5, 5, 3.5]);
});

test('양성: 수료일 없으면 0, 5년 경과 0, 만료일 지정 시 그 날까지', () => {
  const S = (d) => plain(w.calcBjwScore(d, at)).양성;
  assert.strictEqual(S({ 양성: { 급: '1' } }), 0);
  assert.strictEqual(S({ 양성: { 급: '1', 취득일: '2021-11-20' } }), 2.5);  // 정확히 5년째 당일
  assert.strictEqual(S({ 양성: { 급: '1', 취득일: '2021-11-19' } }), 0);
  assert.strictEqual(S({ 양성: { 급: '1', 취득일: '2025-01-01', 만료일: '2026-11-19' } }), 0);
});

test('보유: 미래 취득·만료 경과·급수 미선택은 제외', () => {
  const r = plain(w.calcBjwScore({ 보유: [
    { 급: '1', 취득일: '2026-12-01' }, { 급: '2', 만료일: '2026-11-19' }, { 급: '' }, { 급: '1', 만료일: '2026-11-20' },
  ] }, at));
  assert.deepStrictEqual([r.보유, r.n1, r.n2], [3, 1, 0]);
});

test('만료 알람: 자사만, 30일 이내·만료됨 표시', () => {
  const today = new w.Date(); today.setHours(0, 0, 0, 0);
  const ymd = (n) => { const d = new w.Date(today); d.setDate(d.getDate() + n); return w._ymdLocal(d); };
  const c = { is자사: true, 변전전기원: { 양성: {}, 보유: [
    { 이름: '갑', 급: '2', 만료일: ymd(10) }, { 이름: '을', 급: '2', 만료일: ymd(40) }, { 이름: '병', 급: '1', 만료일: ymd(-3) },
  ] } };
  const a = plain(w.getExpiryAlerts(c)).filter((x) => x.kind === '변전전기원');
  assert.strictEqual(a.length, 2);
  assert.match(a[0].custom, /^갑 D-10/);
  assert.match(a[1].custom, /^병 만료됨/);
  c.is자사 = false;
  assert.strictEqual(plain(w.getExpiryAlerts(c)).filter((x) => x.kind === '변전전기원').length, 0);
});

test('업체등록: 1회성(임시) 맨 왼쪽, 자사 체크 시에만 변전전기원 패널, 저장', () => {
  const d = w.document;
  w.eval('canManageCompanyDB=function(){return true;}');
  w.eval("state.db.push({업체명:'테스트전력',사업자번호:'999-99-99999'});");
  const idx = w.eval('state.db.length-1');
  w.openCompanyModal(idx);
  const ids = [...d.querySelectorAll('#m-is임시,#m-is실적,#m-is자사')].map((e) => e.id);
  assert.deepStrictEqual(ids, ['m-is임시', 'm-is실적', 'm-is자사']);
  const pan = d.getElementById('m-bjw-panel');
  assert.strictEqual(pan.style.display, 'none');
  const chk = d.getElementById('m-is자사');
  chk.checked = true; chk.dispatchEvent(new w.Event('change'));
  assert.strictEqual(pan.style.display, '');
  const rows = () => d.querySelectorAll('#m-bjw-body tr');
  assert.strictEqual(rows().length, 2);                       // 양성 1 + 보유 빈칸 1
  d.getElementById('m-bjw-add').click();
  assert.strictEqual(rows().length, 3);
  const set = (tr, cls, v) => { const el = tr.querySelector(cls); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  set(rows()[0], '.bjw-이름', '송민기'); set(rows()[0], '.bjw-급', '1'); set(rows()[0], '.bjw-취득일', '250125');
  set(rows()[1], '.bjw-이름', '염광덕'); set(rows()[1], '.bjw-급', '2');
  set(rows()[2], '.bjw-이름', '염광천'); set(rows()[2], '.bjw-급', '2');
  assert.match(d.getElementById('m-bjw-score').textContent, /평점 7.5.*3.5점/);
  assert.strictEqual(rows()[2].querySelector('.bjw-no').textContent, '2');
  d.getElementById('m-save').click();
  const saved = plain(w.eval('state.db[' + idx + '].변전전기원'));
  assert.strictEqual(saved.양성.취득일, '2025-01-25');
  assert.deepStrictEqual(saved.보유.map((r) => r.이름), ['염광덕', '염광천']);
  assert.strictEqual(w.eval('state.db[' + idx + '].is자사'), true);
});

test('한전 단독판정: [변전전기원 3.5] 체크 시 시공경험 = 실적 11.5 + 변전전기원', () => {
  const calc = { E5: 5e8, 공종: '전기' };
  const base = { 업체명: '자사A', is자사: true, 실적5: 1e10, 일자리가점: 0 };
  const full = Object.assign({}, base, { 변전전기원: { 양성: {}, 보유: [{ 급: '2' }, { 급: '2' }] } });
  const none = Object.assign({}, base);
  w.eval('state.bid.한전변전가점=false');
  const off = plain(w.kepcoSoloScore(none, calc));
  w.eval('state.bid.한전변전가점=true');
  const onFull = plain(w.kepcoSoloScore(full, calc));
  const onNone = plain(w.kepcoSoloScore(none, calc));
  w.eval('state.bid.한전변전가점=false');
  assert.strictEqual(off.시공, 15);
  assert.deepStrictEqual([onFull.실적점, onFull.변전, onFull.시공], [11.5, 3.5, 15]);
  assert.deepStrictEqual([onNone.실적점, onNone.변전, onNone.시공], [11.5, 0, 11.5]);
  assert.strictEqual(onFull.신인도, off.신인도);            // 신인도에는 더하지 않음
  assert.ok(onNone.합 < off.합);
});

test('공고문분석: 변전전기원 문구 감지', () => {
  assert.strictEqual(plain(w.extractBidFields('한국전력공사 공사 적격심사 시공경험 ○ 변전전기원 양성 또는 보유실적 3.5')).한전변전, '해당');
  assert.strictEqual(plain(w.extractBidFields('일반 전기공사 적격심사')).한전변전, undefined);
});
