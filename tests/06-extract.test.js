// [현재동작] 공고문분석(extractBidFields) — 과거 버그가 났던 문구 형태를 고정.
// 실제 공고문 원문을 tests/fixtures/공고문/ 에 추가하면 자동으로 확장할 수 있다(아래 FIXTURE 참고).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, plain } = require('./helpers/load-app');

const ex = (t) => plain(loadApp().window.extractBidFields(t));

test('지자체 공고: 추정가격·기초금액·시공능력평가금액·지분율·구성사·지역', () => {
  const r = ex(`공고명 OO초등학교 전기공사
수요기관 대전광역시 서구
추정가격 1,234,567,890원
기초금액 1,358,024,679원
종목 전기공사업  042-123-4567
지역제한 대전광역시
공동도급 공동이행방식 허용, 구성원수 3개사 이하, 최소지분율 10%
시공능력평가금액 2,000,000,000원 이상
지방자치단체 입찰시 낙찰자 결정기준 적격심사`);
  assert.equal(r.공종, '전기');
  assert.equal(r.추정가격, 1234567890);
  assert.equal(r.기초금액, 1358024679);
  assert.equal(r.시평제한, 2000000000, '"시공능력평가금액" 표현(과거 미검출 버그)');
  assert.equal(r.최소지분율, 10);
  assert.equal(r.구성업체수, 3);
  assert.deepEqual(r.지역선택, ['대전']);
  assert.equal(r.적격기준, '지자체');
});

test('LH 사전감지(공정계약처/전화번호) + 시평 "평가액"', () => {
  const r = ex(`한국토지주택공사 공정계약처
추정가격 3,500,000,000원
종목 전기공사업 055)922-4359
시공능력평가액 7,000,000,000원 이상인 자`);
  assert.equal(r.적격기준, 'LH');
  assert.equal(r.공종, '전기', '종목 뒤 공백 1칸(2026-08-07 버그)');
  assert.equal(r.시평제한, 7e9);
});

test('표 형식(탭 구분) 시평제한·통신 공종', () => {
  const r = ex('추정가격\t2,000,000,000원\n시공능력평가액\t3,000,000,000원 이상\n종목\t정보통신공사업\t02-1');
  assert.equal(r.공종, '통신');
  assert.equal(r.시평제한, 3e9);
});

test('지역: "전국" 단독이면 전국, 지역명 병기 시 해당 지역 (2026-10-13 규칙)', () => {
  assert.deepEqual(ex('추정가격 800,000,000원\n종목 정보통신공사업  02-0\n지역제한 전국').지역선택, ['전국']);
  assert.deepEqual(ex('추정가격 2,000,000,000원\n종목 전기공사업 042-1\n지역제한 전국, 충청남도').지역선택, ['충남']);
});

test('조달청 기준 문구 + A값', () => {
  const r = ex('추정가격 2,000,000,000원\nA값 123,456,789원\n종목 전기공사업  02-1\n조달청 시설공사 적격심사세부기준');
  assert.equal(r.적격기준, '조달청');
  assert.equal(r.A값, 123456789);
});

test('한전: 적격기준·주공정예정기간', () => {
  const r = ex('한국전력공사 \n추정가격 500,000,000원\n종목 전기공사업  061-1\n주공정예정기간 2027.01.01 ~ 2027.03.31');
  assert.equal(r.적격기준, '한전');
  assert.ok(r.주공정예정기간, '주공정예정기간 추출');
});

// 실제 공고문 fixture: tests/fixtures/공고문/이름.txt + 이름.expected.json (기대값에 적은 필드만 비교)
const FIXTURE = path.join(__dirname, 'fixtures', '공고문');
if (fs.existsSync(FIXTURE)) {
  for (const f of fs.readdirSync(FIXTURE).filter((n) => n.endsWith('.txt'))) {
    const expFile = path.join(FIXTURE, f.replace(/\.txt$/, '.expected.json'));
    if (!fs.existsSync(expFile)) continue;
    test('실제 공고문: ' + f, () => {
      const got = ex(fs.readFileSync(path.join(FIXTURE, f), 'utf8'));
      const exp = JSON.parse(fs.readFileSync(expFile, 'utf8'));
      for (const k of Object.keys(exp)) assert.deepEqual(got[k], exp[k], k);
    });
  }
}
