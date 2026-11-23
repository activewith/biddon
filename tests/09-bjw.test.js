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

test('만료일 자동계산: 자격증 실물과 대조 (취득연도−생년 60 미만 5년 / 60~64 3년 / 65 이상 2년, 취득일+N년-1일)', () => {
  const E = (생년, 취득일) => w._ymdLocal(w.bjwCalcExpiry({ 생년, 취득일 }));
  assert.strictEqual(E('1968-04-24', '2024-03-13'), '2029-03-12');  // 김성태
  assert.strictEqual(E('1976-01-25', '2023-03-08'), '2028-03-07');  // 김정훈
  assert.strictEqual(E('1975-03-19', '2022-05-11'), '2027-05-10');  // 정영준
  assert.strictEqual(E('1973-10-03', '2025-07-22'), '2030-07-21');  // 박민구
  assert.strictEqual(E('1981-01-10', '2024-09-25'), '2029-09-24');  // 오승환
  assert.strictEqual(E('1959-12-12', '2025-01-15'), '2027-01-14');  // 염광천(만 65세 → 2년)
  assert.strictEqual(E('1964-12-25', '2025-07-22'), '2028-07-21');  // 최광락(만 60세 → 3년)
  assert.strictEqual(E('', '2025-01-15'), '2030-01-14');            // 생년 없으면 5년
  assert.strictEqual(w.bjwNormBirth('620123'), '1962');
  assert.strictEqual(E('1965', '2025-01-15'), '2028-01-14');        // 월일 무시: 2025−1965=60 → 3년
  assert.strictEqual(E('1965-12-31', '2025-01-02'), '2028-01-01');  // 생년월일을 넣어도 연도만 사용
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
  assert.strictEqual(bir.value, '1959');
  assert.strictEqual(ex.value, '2027-01-14');
  ex.value = '2027-01-22'; ex.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
  acq.value = '250201'; acq.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
  assert.strictEqual(ex.value, '2027-01-22');                       // 직접 입력값 유지
});

test('변전 케이블접속: 이름·생년·취득일·만료일·참고 저장, 만료 알람', () => {
  const d = w.document;
  w.eval('canManageCompanyDB=function(){return true;};');
  w.eval("state.db.push({업체명:'케이블테스트',is자사:true});");
  const idx = w.eval('state.db.length-1');
  w.openCompanyModal(idx);
  d.getElementById('m-bjc-add').click();
  const rows = d.querySelectorAll('#m-bjc-body tr');
  assert.strictEqual(rows.length, 2);
  const tr = rows[0];
  tr.querySelector('.bjc-이름').value = '윤종환';
  tr.querySelector('.bjc-생년').value = '800101';
  tr.querySelector('.bjc-취득일').value = '230515';
  tr.querySelector('.bjc-만료일').value = '280514';
  tr.querySelector('.bjc-참고').value = '28년 5~6월 갱신';
  d.getElementById('m-save').click();
  const v = plain(w.eval('state.db[' + idx + '].변전케이블접속'));
  assert.deepStrictEqual(v, [{ 이름: '윤종환', 생년: '1980', 취득일: '2023-05-15', 만료일: '2028-05-14', 참고: '28년 5~6월 갱신' }]);
  const today = new w.Date(); today.setHours(0, 0, 0, 0);
  const soon = new w.Date(today); soon.setDate(soon.getDate() + 5);
  const a = plain(w.getExpiryAlerts({ is자사: true, 변전케이블접속: [{ 이름: '갑', 만료일: w._ymdLocal(soon) }, { 이름: '을', 만료일: '2099-01-01' }] }))
    .filter((x) => x.kind === '케이블접속');
  assert.strictEqual(a.length, 1);
  assert.match(a[0].custom, /^갑 갱신 D-5/);
});

test('케이블접속 알람: 만료일 3개월 전부터', () => {
  const today = new w.Date(); today.setHours(0, 0, 0, 0);
  const ymd = (mo, dd) => w._ymdLocal(new w.Date(today.getFullYear(), today.getMonth() + mo, today.getDate() + dd));
  const a = plain(w.getExpiryAlerts({ is자사: true, 변전케이블접속: [
    { 이름: '갑', 만료일: ymd(3, 0) }, { 이름: '을', 만료일: ymd(3, 2) }, { 이름: '병', 만료일: ymd(0, -1) },
  ] })).filter((x) => x.kind === '케이블접속').map((x) => x.custom);
  assert.strictEqual(a.length, 2);
  assert.match(a[0], /^갑 갱신 D-/);
  assert.match(a[1], /^병 갱신 만료됨/);
});

test('케이블접속: 메모 문구에서 초안 생성, 소속이동', () => {
  const r = plain(w.bjcFromMemo('윤종환 접속케이블 인증만료 28년 5~6월.--> 알람설정 할 것\n<한전배치기술자>'));
  assert.deepStrictEqual([r.length, r[0].이름, r[0].만료일], [1, '윤종환', '2028-05-01']);
  const d = w.document;
  w.eval('canManageCompanyDB=function(){return true;};confirm=function(){return true;};');
  w.eval("state.db=state.db.filter(c=>!c.is자사);state.db.push({업체명:'A사',is자사:true,변전케이블접속:[{이름:'갑',만료일:'2028-01-01'},{이름:'을',만료일:'2029-01-01'}]});state.db.push({업체명:'B사',is자사:true});");
  const src = w.eval("state.db.findIndex(c=>c.업체명==='A사')"), dst = w.eval("state.db.findIndex(c=>c.업체명==='B사')");
  w.openCompanyModal(src);
  const tr = d.querySelectorAll('#m-bjc-body tr')[0];
  tr.querySelector('.bjc-move').value = String(dst);
  tr.querySelector('.bjc-movebtn').click();
  assert.deepStrictEqual(plain(w.eval('state.db[' + dst + '].변전케이블접속')).map((x) => x.이름), ['갑']);
  assert.deepStrictEqual(plain(w.eval('state.db[' + src + '].변전케이블접속')).map((x) => x.이름), ['을']);
});

test('전력케이블(Plug-in): 공고문 감지 + 단독판정은 유효 자격자 있어야 통과', () => {
  const T = (s) => plain(w.extractBidFields('한국전력공사 공사 적격심사 ' + s)).한전케이블;
  assert.strictEqual(T('154kV 4M.Tr 교체공사(전력케이블)'), '해당');
  assert.strictEqual(T('GIS JIG 시험'), '해당');
  assert.strictEqual(T('Plug-In 접속재'), '해당');
  assert.strictEqual(T('일반 배전공사'), undefined);
  const calc = { E5: 5e8, 공종: '전기' };
  const base = { 업체명: '자사A', is자사: true, 실적5: 1e10, 일자리가점: 3, 부채비율: 1, 유동비율: 9999, 공사업등록일: '1990-01-01' };
  const yes = Object.assign({}, base, { 변전케이블접속: [{ 이름: '갑', 만료일: '2099-01-01' }] });
  const expired = Object.assign({}, base, { 변전케이블접속: [{ 이름: '갑', 만료일: '2020-01-01' }] });
  w.eval('state.bid.한전케이블=true');
  const rY = plain(w.kepcoSoloScore(yes, calc)), rN = plain(w.kepcoSoloScore(base, calc)), rE = plain(w.kepcoSoloScore(expired, calc));
  w.eval('state.bid.한전케이블=false');
  const rOff = plain(w.kepcoSoloScore(base, calc));
  assert.deepStrictEqual([rY.cableOK, rN.cableOK, rE.cableOK, rOff.cableOK], [true, false, false, true]);
  assert.strictEqual(rN.ok, false);
  assert.strictEqual(rY.ok, rOff.ok);
});

test('한전 8천만 미만: 시공경험 없음, 경영상태 10점(부채5+유동5 / 신용 10)으로 판정', () => {
  w.eval("state.bid.업계평균부채비율=120;state.bid.업계평균유동비율=140;state.bid.한전변전가점=false;state.bid.한전케이블=false;state.bid.지역선택=[];");
  const calc = { E5: 67241000, 공종: '전기' };
  const t = plain(w.kepcoSoloTier(67241000));
  assert.deepStrictEqual([t.key, t.price, t.cap, t.noPerf, t.supported], ['U08', 85, 10, true, true]);
  const good = { 업체명: 'A', is자사: true, 실적5: 0, 부채비율: 50, 유동비율: 300, 일자리가점: 0 };
  const r1 = plain(w.kepcoSoloScore(good, calc));
  assert.deepStrictEqual([r1.시공, r1.경영, r1.합, r1.ok], [0, 10, 10, true]);
  const weak = { 업체명: 'B', is자사: true, 실적5: 0, 부채비율: 170, 유동비율: 300, 일자리가점: 0 };  // 부채 1.42배 → 4.0
  const r2 = plain(w.kepcoSoloScore(weak, calc));
  assert.deepStrictEqual([r2.경영, r2.ok], [9, false]);
  const weakPerf = Object.assign({}, weak, { 실적5: 1e9 });  // 실적 1배 이상 → 특별신인도 +1
  const r3 = plain(w.kepcoSoloScore(weakPerf, calc));
  assert.deepStrictEqual([r3.특별, r3.합, r3.ok], [1, 10, true]);
  const cr = plain(w.kepcoSoloScore({ 업체명: 'C', is자사: true, 실적5: 0, 신용평가: 'BB-(291231)', 일자리가점: 0 }, calc));
  assert.strictEqual(cr.경영, 9.9);
});

test('한전 변전기자재 양식(3억~50억): 시공경험 18 = 실적 14.5 + 동종 3.5, 경영 12', () => {
  w.eval("state.bid.업계평균부채비율=120;state.bid.업계평균유동비율=140;state.bid.한전변전가점=false;state.bid.한전케이블=false;state.bid.지역선택=[];state.bid.한전기자재=true;state.bid.한전동종점수={'갑사':3.5};");
  const calc = { E5: 5e8, 공종: '전기' };
  const c = { 업체명: '갑사', is자사: true, 실적5: 1e10, 부채비율: 50, 유동비율: 300, 공사업등록일: '1990-01-01', 일자리가점: 0 };
  const r = plain(w.kepcoSoloScore(c, calc));
  assert.deepStrictEqual([r.isGJ, r.실적점, r.동종, r.시공, r.경영, r.합, r.ok], [true, 14.5, 3.5, 18, 12, 30, true]);
  const c2 = Object.assign({}, c, { 업체명: '을사' });          // 동종 미입력 → 0
  const r2 = plain(w.kepcoSoloScore(c2, calc));
  assert.deepStrictEqual([r2.시공, r2.ok], [14.5, false]);
  const cr = plain(w.kepcoSoloScore({ 업체명: '갑사', is자사: true, 실적5: 1e10, 신용평가: 'B+(291231)', 일자리가점: 0 }, calc));
  assert.strictEqual(cr.경영, 11.7);
  w.eval('state.bid.한전기자재=false');
  const r3 = plain(w.kepcoSoloScore(c, calc));
  assert.deepStrictEqual([r3.isGJ, r3.시공, r3.경영], [false, 15, 15]);
  assert.strictEqual(plain(w.extractBidFields('한국전력공사 공사 적격심사 추정가격 8천만원 미만 변전기자재 설치공사')).한전기자재, '해당');
});

test('업체등록 한전(변전): 변전 전문 자격(변압기·개폐기 0~2급) 저장, 참고는 줄바꿈 가능', () => {
  const d = w.document;
  w.eval('canManageCompanyDB=function(){return true;};');
  w.eval("state.db.push({업체명:'전문자격테스트',is자사:true});");
  const idx = w.eval('state.db.length-1');
  w.openCompanyModal(idx);
  assert.strictEqual(d.getElementById('m-bjw-label').textContent, '한전(변전)');
  const sels = d.querySelectorAll('#m-bjs [data-bjs]');
  assert.strictEqual(sels.length, 2);
  assert.deepStrictEqual([...sels[0].options].map((o) => o.value), ['0', '1', '2']);
  d.querySelector('#m-bjs [data-bjs="변압기"]').value = '1';
  const memo = d.querySelector('#m-bjc-body .bjc-참고');
  assert.strictEqual(memo.tagName, 'TEXTAREA');
  memo.value = '1줄\n2줄';
  d.querySelector('#m-bjc-body .bjc-이름').value = '갑';
  d.getElementById('m-save').click();
  assert.deepStrictEqual(plain(w.eval('state.db[' + idx + '].변전전문자격')), { 변압기: 1, 개폐기: 0 });
  assert.strictEqual(w.eval('state.db[' + idx + '].변전케이블접속[0].참고'), '1줄\n2줄');
});

test('변전전문자격: 공고문 감지 + 단독판정 요건(1급은 2급 요건도 충족)', () => {
  const T = (s) => plain(w.extractBidFields('한국전력공사 공사 적격심사 ' + s)).한전전문자격;
  assert.strictEqual(T('변전전문회사 변압기 1급 이상'), '변압기 1급');
  assert.strictEqual(T('변압기 2급 또는 개패기 1급'), '변압기 2급, 개폐기 1급');
  assert.strictEqual(T('일반공사'), undefined);
  assert.deepStrictEqual(plain(w.parseKepcoSpecReq('변압기 1급')), { 변압기: 1 });
  const req2 = w.parseKepcoSpecReq('변압기 2급');
  assert.strictEqual(w.kepcoSpecOK({ 변전전문자격: { 변압기: 1, 개폐기: 0 } }, req2), true);
  assert.strictEqual(w.kepcoSpecOK({ 변전전문자격: { 변압기: 2 } }, w.parseKepcoSpecReq('변압기 1급')), false);
  assert.strictEqual(w.kepcoSpecOK({}, req2), false);
  assert.strictEqual(w.kepcoSpecOK({ 변전전문자격: { 개폐기: 1 } }, w.parseKepcoSpecReq('변압기 1급, 개폐기 1급')), true);
  w.eval("state.bid.업계평균부채비율=120;state.bid.업계평균유동비율=140;state.bid.한전기자재=false;state.bid.한전변전가점=false;state.bid.한전케이블=false;state.bid.지역선택=[];state.bid.한전전문자격={변압기:1};");
  const calc = { E5: 5e8, 공종: '전기' };
  const base = { 업체명: 'A', is자사: true, 실적5: 1e10, 부채비율: 50, 유동비율: 300, 공사업등록일: '1990-01-01', 일자리가점: 0 };
  const no = plain(w.kepcoSoloScore(base, calc));
  const yes = plain(w.kepcoSoloScore(Object.assign({}, base, { 변전전문자격: { 변압기: 1, 개폐기: 0 } }), calc));
  w.eval('state.bid.한전전문자격=null');
  assert.deepStrictEqual([no.specOK, no.ok, yes.specOK, yes.ok], [false, false, true, true]);
});
