// index.html을 수정하지 않고 jsdom으로 불러와 전역 함수·상수에 접근한다.
// - 네트워크(fetch)·alert/confirm/prompt는 차단 → 동기화/팝업이 테스트에 끼어들지 않음
// - const로 선언된 적격기준 모듈은 window에 붙지 않으므로, 같은 전역 스코프에서 도는
//   보조 스크립트 하나로 window.__T에 담아 꺼낸다(앱 코드는 그대로).
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

let cached = null;

function loadApp() {
  if (cached) return cached;
  const file = process.env.APP_HTML || path.join(__dirname, '..', '..', 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String((e && e.message) || e)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://bid.activewith.net/',
    virtualConsole: vc,
    beforeParse(w) {
      w.fetch = () => Promise.reject(new Error('테스트 중 네트워크 차단'));
      w.alert = () => {};
      w.confirm = () => false;
      w.prompt = () => null;
    },
  });
  const w = dom.window;
  const s = w.document.createElement('script');
  s.textContent = [
    'window.__T={',
    ' 지자체:적격기준_지자체, 조달청:적격기준_조달청, LH:적격기준_LH,',
    ' 철도공단:적격기준_철도공단, 한전:적격기준_한전,',
    ' 도로공사:적격기준_도로공사, 수자원공사:적격기준_수자원공사',
    '};',
  ].join('\n');
  w.document.body.appendChild(s);
  cached = { window: w, T: w.__T, errors, file };
  return cached;
}

// jsdom 내부 객체를 일반 JSON 값으로 변환(deepStrictEqual 비교용)
function plain(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

module.exports = { loadApp, plain };
