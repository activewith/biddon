// 변전전기원 양성·보유실적 (2026-11-20) — 점수 산정, 만료 알람, 업체등록 화면, 한전 단독판정 반영
const test = require('node:test');
const assert = require('node:assert');
const { loadApp, plain } = require('./helpers/load-app');
const { window: w } = loadApp();
const at = new w.Date(2026, 10, 20);

test('평점 → 배점 구간 (5↑3.5 / 3↑2.4 / 2↑1.2 / 미만 0)', () => {
  const S = (d) => plain(w.calcBjwScore(d, at));
  assert.strictEqual(S({}).score, 0);
  assert.strictEqual(S({ 보유: [{ 급: '2', 취득일: '2022-01-01' }] }).score, 1.2);   // 2.5
  assert.strictEqual(S({ 보유: [{ 급: '1' }] }).score, 2.4);                          // 3.0
  assert.strictEqual(S({ 보유: [{ 급: '2' }, { 급: '2' }] }).score, 3.5);              // 5.0
  const r = S({ 양성: { 급: '2', 취득일: '250125' }, 보유: [{ 급: '2' }] });           // 2.5+2.5
  assert.deepStrictEqual([r.양성, r.보유, r.평점, r.score], [2.5, 2.5, 5, 3.5]);
});

test('양성: 수료일·만료일 모두 없으면 0, 만료일만 있으면 그 날까지, 5년 경과 0', () => {
  const S = (d) => plain(w.calcBjwScore(d, at)).양성;
  assert.strictEqual(S({ 양성: { 급: '1' } }), 0);
  assert.strictEqual(S({ 양성: { 급: '2', 만료일: '2027-12-23' } }), 2.5);
  assert.strictEqual(S({ 양성: { 급: '2', 만료일: '2026-11-19' } }), 0);
  assert.strictEqual(plain(w.calcBjwScore({ 양성: { 급: '2', 만료일: '2027-12-23' }, 보유: [{ 급: '2', 만료일: '2028-03-02' }] }, at)).score, 3.5);
  assert.strictEqual(S({ 양성: { 급: '1', 취득일: '2021-11-21' } }), 2.5);  // 만료 2026-11-20(취득+5년-1일)
  assert.strictEqual(S({ 양성: { 급: '1', 취득일: '2021-11-20' } }), 0);
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
  assert.match(a[0].custom, /^갑 갱신 D-10/);
  assert.match(a[1].custom, /^병 갱신 만료됨/);
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

test('보유도 5년 갱신: 만료일 비우면 취득일+5년(점수·알람)', () => {
  assert.strictEqual(plain(w.calcBjwScore({ 보유: [{ 급: '1', 취득일: '2021-11-20' }] }, at)).보유, 0);
  assert.strictEqual(plain(w.calcBjwScore({ 보유: [{ 급: '1', 취득일: '2021-11-21' }] }, at)).보유, 3);
  const today = new w.Date(); today.setHours(0, 0, 0, 0);
  const acq = new w.Date(today.getFullYear() - 5, today.getMonth(), today.getDate() + 11);
  const a = plain(w.getExpiryAlerts({ is자사: true, 변전전기원: { 양성: { 이름: '양', 급: '2', 취득일: w._ymdLocal(acq) }, 보유: [] } }))
    .filter((x) => x.kind === '변전전기원');
  assert.strictEqual(a.length, 1);
  assert.match(a[0].custom, /^양성 양 갱신 D-10/);
});

test('소속이동: 보유 인원만 다른 자사로 이동, 즉시 저장', () => {
  const d = w.document;
  w.eval('canManageCompanyDB=function(){return true;};confirm=function(){return true;};');
  w.eval("state.db=state.db.filter(c=>!c.is자사);state.db.push({업체명:'자사가',is자사:true,변전전기원:{양성:{이름:'양',급:'1',취득일:'2025-01-01'},보유:[{이름:'갑',급:'2'},{이름:'을',급:'1'}]}});state.db.push({업체명:'자사나',is자사:true});");
  const src = w.eval("state.db.findIndex(c=>c.업체명==='자사가')"), dst = w.eval("state.db.findIndex(c=>c.업체명==='자사나')");
  w.openCompanyModal(src);
  const rows = () => [...d.querySelectorAll('#m-bjw-body tr')];
  assert.strictEqual(rows()[0].querySelector('.bjw-move'), null);           // 양성은 고정
  const tr = rows()[1];
  tr.querySelector('.bjw-move').value = String(dst);
  tr.querySelector('.bjw-movebtn').click();
  assert.strictEqual(rows().length, 2);
  assert.deepStrictEqual(plain(w.eval('state.db[' + dst + '].변전전기원.보유')).map((r) => r.이름), ['갑']);
  assert.deepStrictEqual(plain(w.eval('state.db[' + src + '].변전전기원.보유')).map((r) => r.이름), ['을']);
  assert.strictEqual(w.eval('state.db[' + src + '].변전전기원.양성.이름'), '양');
});

test('만료일 자동계산: 자격증 실물과 대조 (만 60세 미만 5년 / 65세 이상 2년, 취득일+N년-1일)', () => {
  const E = (생년, 취득일) => w._ymdLocal(w.bjwCalcExpiry({ 생년, 취득일 }));
  assert.strictEqual(E('1968-04-24', '2024-03-13'), '2029-03-12');  // 김성태
  assert.strictEqual(E('1976-01-25', '2023-03-08'), '2028-03-07');  // 김정훈
  assert.strictEqual(E('1975-03-19', '2022-05-11'), '2027-05-10');  // 정영준
  assert.strictEqual(E('1973-10-03', '2025-07-22'), '2030-07-21');  // 박민구
  assert.strictEqual(E('1981-01-10', '2024-09-25'), '2029-09-24');  // 오승환
  assert.strictEqual(E('1959-12-12', '2025-01-15'), '2027-01-14');  // 염광천(만 65세 → 2년)
  assert.strictEqual(E('1964-06-01', '2025-01-15'), '2028-01-14');  // 만 60세 → 3년
  assert.strictEqual(E('', '2025-01-15'), '2030-01-14');            // 생년 없으면 5년
  assert.strictEqual(w.bjwNormBirth('620123'), '1962-01-23');
  assert.strictEqual(w.bjwNormBirth('1962'), '1962');
});

test('업체등록: 생년 칸, 취득일 입력 시 만료일 자동 입력(직접 입력값은 유지)', () => {
  const d = w.document;
  w.eval('canManageCompanyDB=function(){return true;};');
  w.eval("state.db.push({업체명:'자동테스트',is자사:true,변전전기원:{양성:{},보유:[{이름:'갑',생년:'1981-01-10',급:'2',취득일:'2024-09-25'}]}});");
  w.openCompanyModal(w.eval('state.db.length-1'));
  const tr = d.querySelectorAll('#m-bjw-body tr')[1];
  const ex = tr.querySelector('.bjw-만료일');
  assert.strictEqual(ex.value, '2029-09-24');                       // 저장 안 된 만료일도 화면에 채움
  const acq = tr.querySelector('.bjw-취득일'), bir = tr.querySelector('.bjw-생년');
  bir.value = '591212'; bir.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
  acq.value = '250115'; acq.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
  assert.strictEqual(bir.value, '1959-12-12');
  assert.strictEqual(ex.value, '2027-01-14');
  ex.value = '2027-01-22'; ex.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
  acq.value = '250201'; acq.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
  assert.strictEqual(ex.value, '2027-01-22');                       // 직접 입력값 유지
});
