/* =====================================================================
   타임 홀 (터널 달리기 추리 게임) 독립 모듈
   전역은 window.TimeHole 하나만 노출한다.
     TimeHole.mount(containerEl, { assetBase })  화면 만들기 (assetBase: images/ 폴더가 있는 위치, 앱 안에서는 '')
     TimeHole.start({ onComplete })              시작. 끝나면 onComplete(획득 순서대로 카드 id 배열)
     TimeHole.destroy()                          이벤트·타이머·애니메이션 정리
     TimeHole.reveal(containerEl, cardIds, { onDone })  타임라인 진입 시 숨긴 카드 일제 공개 연출
   외부 전송·저장(fetch, XHR, localStorage 등)은 쓰지 않는다.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- 설정값 (여기만 고치면 됨) ---------------- */
  var CONFIG = {
    GRACE_MS: 1000,              // 코요테 타임: 시계가 다 꺼진 뒤에도 이 시간 동안은 답을 고를 수 있음
    QUESTION_TIME_MS: 15000,     // 문제 제한 시간
    CRUISE_SPEED: 17,            // 평소 달리는 속도 (거리/초). 문제가 떠 있는 동안에도 이 속도 그대로
    BOOST_SPEED: 44,             // 답을 고르면 확 올라가는 속도. 코너를 빠져나갈 때까지 그대로 유지
    SPEED_SPRING: 8,             // 가속 빠르기 (클수록 확 빨라짐. 8이면 약 0.35초)
    SPEED_DAMP: 0.82,            // 가속 때만: 1보다 조금 작아 아주 살짝 관성 (작을수록 출렁임 큼)
    BRAKE_AT: 0.5,                // 감속이 시작되는 곳: 곡선 안의 위치 (0 = 코너에 들어서자마자, 0.5 = 곡선 중간, 1 = 곡선이 끝날 때)
    BRAKE_SPRING: 5.5,          // 감속 빠르기. 감속은 되튐 없이 부드럽게
    ACCEL_KICK: 0,               // 가속·감속 때 화면이 밀리고 당겨지는 정도 (화면이 숨 쉬듯 출렁여 끔)
    OPENING_FADE_MS: 1400,       // 시작할 때 흰 화면이 걷히는 시간
    FIRST_BUBBLE_DELAY_MS: 1000, // 흰 화면이 걷힌 뒤 첫 토리 말풍선이 켜지기까지 기다리는 시간
    DEMO_TIMER_MS: 5000,         // 튜토리얼에서 시간 눈금이 한 바퀴 꺼지는 시간 (시범용, 실제 제한 시간과 별개)
    TUTORIAL_PC_CURSOR: true,    // 튜토리얼 조작법: 방향키는 모든 기기에서 보여 줌(블루투스 키보드). true(지금) 면 PC 는 터치 대신 '마우스 커서 클릭'을 보여 주고, 슬라이드 설명은 '모바일과 태블릿에서는' 을 붙여 남김. false 면 모든 기기에서 손가락 누르기·슬라이드
    SHOW_GUIDE: false,         // true 면 오프닝 뒤에 '타임 홀 달리는 법' 안내 패널을 보여 줌 (지금은 뺌)
    OPENING_LOCK_MS: 1000,       // 오프닝 대사 네 줄: 뜬 뒤 이 시간이 지나야 넘길 수 있음
    OPENING_GLITCH_LOCK_MS: 1500,   // 맨 앞의 깨진 글자(글리치) 대사는 글리치가 보일 시간을 고려해 더 길게
    OPENING_TAP_LOCK_MS: 400,    // 오프닝 대사가 뜬 직후 이 시간 동안은 터치해도 넘어가지 않음 (실수로 건너뛰기 방지)
    APPROACH_MS: 1700,           // 문제 직전 대사가 보이는 시간
    TURN_MS: 1200,               // 시간 초과 때 직진한 뒤 결과가 나올 때까지 시간
    CARD_SHOW_MS: 1900,          // 카드 획득 연출이 화면 가운데 머무는 시간
    WRONG_NOTE_DELAY_MS: 500,    // 오답 후 안내가 뜨기까지 기다리는 시간
    CARD_FLY_MS: 300,            // 얻은 카드가 아래 칸으로 쇽! 내려가는 시간
    WRONG_NOTE_MS: 3000,        // 오답 안내가 보이는 시간. 이 시간이 지나면 저절로 꺼지고 다음 문제로 (터치·클릭·키로 닫는 기능은 없음)
    EXIT_DIST: 24,               // 마지막 카드 뒤 터널 출구까지 거리 (출구가 점점 다가옴)
    EXIT_FADE_AT: 2.2,           // 출구까지 이만큼 남으면 화면이 하얗게 밝아짐
    REVEAL_DELAY_MS: 2000,       // 타임라인 진입 후 공개까지 기다리는 시간
    FLIP_MS: 600,                // 카드 뒤집기 시간 (css 의 .th-flip-inner transition 과 같게)
    SWIPE_MIN_PX: 40,            // 이만큼 이상 가로로 밀면 슬라이드로 인정
    RING_COUNT: 26,              // 화면에 그리는 링 수
    SPOKE_COUNT: 18,             // 방사선 수
    STREAK_COUNT: 46,            // 가속할 때 빛줄기 수 (속도감)
    STREAK_COUNT_CRUISE: 22,     // 평소 속도일 때 빛줄기 수 (속도에 따라 이 수와 위 수 사이로 서서히 바뀜)
    STAR_COUNT: 220,             // 터널 바깥 우주 공간에서 지나가는 별 수
    STAR_DEPTH: 60,              // 별이 생기는 가장 먼 거리
    FOV_KICK: 0.06,              // 빠를 때 시야가 살짝 넓어지는 정도 (속도감)
    RING_GAP: 2,                 // 링 사이 간격 (넓을수록 빨라도 링이 뚝뚝 튀어 보이지 않음)
    VANISH_Y: 0.5,               // 터널 소실점 높이 (화면 높이 비율, 0.5 = 정가운데)
    SPLIT_FAR: 27,               // 고른 순간 갈림길이 생기는 거리 (터널 끝 너머에서 생겨 서서히 다가옴)
    BRANCH_ANGLE: 30,            // 갈림길 두 갈래가 벌어지는 각도 (도). 작을수록 덜 꺾여 덜 어지러움
    BRANCH_CURVE_LEN: 20,        // 갈래가 곧은 터널에서 완만하게 휘어 BRANCH_ANGLE 까지 도는 곡선 길이 (클수록 완만)
    TURN_BANK: 0,                // 코너에서 화면이 기우는 각도 (라디안). 0 이면 기울지 않음 (원래 값 0.035, 약 2도)
    TURN_ZOOM: 0.03,             // 코너 가운데서 화면이 확대되는 정도 (0.03 = 3%). 기울기와 따로 조절. 0 이면 확대 없음
    TURN_DRIFT: 0.12,            // 코너 가운데서 원심력으로 바깥쪽으로 밀리는 정도
    TURN_SHAKE_PX: 0,            // 코너에서 흔들리는 크기 (픽셀). 어지러워서 끔
    SPEED_SCALE: 0.6,          // 모든 기기 공통 이동 배율 (1 = 원래 속도, 0.5 = 절반). 속도 숫자들(CRUISE/BOOST)은 그대로 두고 실제 이동량만 줄임
    MAX_DPR: 2,                  // 캔버스 해상도 상한 (모바일 가볍게)
    ASSET_BASE: ''               // 이미지 경로 앞부분 (mount 옵션으로 덮어씀)
  };

  /* ---------------- 데이터: 카드 · 문제 · 토리 대사 ---------------- */
  // 카드 이름은 타임라인에서 쓰는 이름 그대로. image 는 ASSET_BASE 뒤에 붙는 경로
  var CARDS = {
    tutorial: { name: '클뤼니 수도원 설립 문서', image: 'images/card/card_1.webp', open: true },
    c2: { name: '교황이 보낸 편지', image: 'images/card/card_2.webp' },
    c3: { name: '왕이 보낸 편지', image: 'images/card/card_3.webp' },
    c4: { name: '교황이 제후들에게 쓴 글', image: 'images/card/card_4.webp' },
    c5: { name: '황제와 교황의 문서', image: 'images/card/card_5.webp' },
    fake: { name: '교황이 왕에게 한 서약', image: 'images/card/card_E.webp' }
  };
  // 섞기 규칙에만 쓰는 상대 순서 (화면에는 쓰지 않음)
  var ORDER_RULE = ['c2', 'c3', 'c4', 'c5'];

  var QUESTIONS = [
    { id: 'tutorial', card: 'tutorial', tutorial: true,
      text: '교회의 세속화에 맞서 클뤼니 수도원이 강조한 삶의 모습은?',
      answer: '기도, 고전 연구, 노동에 집중하는 삶', wrong: '영주를 섬기며 재산을 늘리는 삶',
      wrongNote: '클뤼니 수도원은 기도, 고전 연구, 노동에 집중하는 삶을 강조하며 교회의 개혁을 이끌었어.' },
    { id: 'q1', card: 'c2',
      text: '교황과 왕이 대립하게 된 원인으로 옳은 것은?',
      answer: '성직자 임명권을 둘러싼 다툼', wrong: '세금 징수권을 둘러싼 다툼',
      wrongNote: '교황과 왕은 성직자를 누가 임명할 것인가를 두고 대립했어.' },
    { id: 'q2', card: 'c3',
      text: '봉건제가 확대되면서 성직자를 임명하는 일이 많아진 사람들은?',
      answer: '왕과 제후', wrong: '민중과 상인',
      wrongNote: '봉건제가 확대되면서 왕과 제후가 성직자를 임명하는 일이 많아졌어.' },
    { id: 'q3', card: 'c4',
      text: '교회가 신도의 자격을 빼앗고 공동체에서 추방하는 것은?',
      answer: '파문', wrong: '성직 매매',
      wrongNote: '신도의 자격을 빼앗고 공동체에서 추방하는 것을 파문이라고 해.' },
    { id: 'q4', card: 'c5',
      text: '교황과 황제가 성직자 임명권을 두고 맺은 협약은?',
      answer: '보름스 협약', wrong: '카노사 협약',
      wrongNote: '교황과 황제가 성직자 임명권을 두고 맺은 협약은 보름스 협약이야.' },
    { id: 'q5', card: 'fake',
      text: '11세기 후반 교황과 성직자 임명권을 두고 대립한 나라는?',
      answer: '신성 로마 제국', wrong: '프랑크 왕국',
      wrongNote: '11세기 후반 교황과 성직자 임명권을 두고 대립한 나라는 신성 로마 제국이야.' }
  ];

  var TORI_LINES = {
    // 오프닝: 터치할 때마다 한 줄씩. {이름} 은 코드네임(합칠 때 start({ codename }) 으로 받음, 없으면 '패트롤')
    //   parts 의 inline 은 앞 조각과 같은 줄에 이어 붙임, glitch 는 깨진 글자 효과
    opening: [   // 두 줄 이상이 되는 대사는 뜻 단위로 줄바꿈해서 말풍선에서 어색하게 꺾이지 않게 함
      { pose: 'happy', parts: [{ text: '치ㅊㅈ.. 들ㄹIㄴrㅛ?', glitch: true }, { text: '{n}{이름}{/n}님, {k}타임홀{/k} 진입에 성공했어요!' }] },
      { pose: 'default', parts: [{ text: '여기는 붕괴된 타임라인으로 이어지는 시간의 터널이에요. 이곳에서 {y}흩어진 사료 카드를 모아{/y}야 {y}타임라인을 복구{/y}할 수 있어요.' }] },
      { pose: 'hint', parts: [{ text: '제가 문제를 내면, 정답이 있는 쪽 길로 달려 주세요. 사실을 하나씩 맞힐 때마다 카드가 모일 거예요. 제 무전을 잘 들어 주세요!' }] },
      { pose: 'what', parts: [{ text: '어... 처음이라서 잘 모르시겠다고요? 그렇다면, 먼저 연습부터 해 볼게요!' }] }
    ],
    beforeQuestion: ['앞에 문제가 기다리고 있어요. 잘 들어 주세요!', '다음 길이에요. 집중해 주세요!'],
    wrong: '앗, 이 길이 아니었어요.',
    timeout: '앗, 시간이 다 되어 버렸어요.',   // 시간 초과일 때 (가운데 창은 '시간이 지났어요!')
    cardGet: '정답이에요. 사료 카드를 얻었어요!',
    tunnelEnd: '카드를 다 모았어요! 이제 타임홀에서 나갈 수 있어요!'
  };
  var UI_TEXT = {
    wrongTitle: '길을 잘못 들었어요!',
    timeoutTitle: '시간이 지났어요!',
    wrongRetry: '잠시 뒤에 다시 도전해보아요.',
    nextHint: 'Enter·Space 또는 터치로 진행해 주세요.',
    nextHintPc: 'Enter·Space 또는 클릭으로 진행해 주세요.',   // 마우스가 주 입력인 기기(PC)
    guideTitle: '타임 홀 달리는 법',
    guideRows: { keys: '키보드 ← → 키', click: '왼쪽·오른쪽 글 클릭하기', swipe: '왼쪽·오른쪽으로 슬라이드', tap: '왼쪽·오른쪽 글 누르기' },
    guideNote: '토리가 문제를 내면 15초 안에 정답이 있는 쪽을 골라. 토리 둘레 눈금이 다 꺼지면 시간이 끝난 거야.',
    guideStart: '출발!',
    tutStart: '이제 선택지를 직접 골라 보세요!',   // 조작법 안내 팝업 아래의 시작 버튼
    hiddenLabel: '아직 모르는 카드',
    timeLabel: '남은 시간',
    demoLeft: '왼쪽 글', demoRight: '오른쪽 글',   // 튜토리얼 시범용 선택지 (정답이 드러나지 않게 중립 문구)
    radioTag: '토리 · 무전'
  };

  var TIMER_TICKS = 30;   // 토리 모니터 둘레 시간 눈금 수
  var TORI_POSES = ['default', 'happy', 'sad', 'what', 'sup', 'hint', 'roading'];

  /* ---------------- 내부 상태 ---------------- */
  var S = null;            // 게임 화면 상태
  var R = null;            // 공개 연출 상태
  var imgCache = {};       // 미리 불러와 decode() 해 둔 이미지 (경로 → Image)
  var imgFailed = {};      // 불러오기 실패한 경로 (자리표시자로 대체)
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------------- 작은 도우미 ---------------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(viewBox, cls, shapes) {   // shapes: [[태그, {속성}], ...]
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', viewBox);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    if (cls) s.setAttribute('class', cls);
    shapes.forEach(function (sh) {
      var n = document.createElementNS(SVGNS, sh[0]);
      Object.keys(sh[1]).forEach(function (k) { n.setAttribute(k, sh[1][k]); });
      if (sh[2]) n.textContent = sh[2];
      s.appendChild(n);
    });
    return s;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // 효과음: 앱(index.html)에 SFX 가 있을 때만 울림. 시험 페이지처럼 없으면 소리 없이 지나감 (오류를 화면·로그에 내보내지 않음)
  function sfx(name, vol) { try { if (window.SFX && typeof window.SFX.play === 'function') window.SFX.play(name, vol); } catch (_) { /* 소리가 안 나도 게임은 계속 */ } }
  function bgmDuck(on) { try { if (window.BGM && typeof window.BGM.duck === 'function') window.BGM.duck(on ? 0.7 : 1, 1.2); } catch (_) { /* 소리 조절이 안 되어도 게임은 계속 */ } }   // 튜토리얼 구간 동안 배경음을 30% 낮춤
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function qById(id) { for (var i = 0; i < QUESTIONS.length; i++) if (QUESTIONS[i].id === id) return QUESTIONS[i]; return null; }
  function src(path) { return CONFIG.ASSET_BASE + path; }
  function calm() { try { return document.documentElement.classList.contains('calm-mode'); } catch (_) { return false; } }
  function reducedMotion() { return calm(); }   // 설정의 '흔들림·움직임 줄이기'를 켠 경우에만 속도·흔들림·빛줄기를 줄임 (기기 설정은 읽지 않음)
  function boostSpeed() { return calm() ? 30 : CONFIG.BOOST_SPEED; }

  /* ---------------- 이미지 미리 불러오기 ---------------- */
  function preload(path) {
    var url = src(path);
    if (imgCache[url] || imgFailed[url]) return;
    var im = new Image();
    im.decoding = 'async';
    im.alt = '';
    im.draggable = false;
    imgCache[url] = im;
    im.onerror = function () { imgFailed[url] = true; delete imgCache[url]; };
    im.src = url;
    if (im.decode) im.decode().catch(function () { /* 실패하면 onerror 에서 자리표시자로 처리 */ });
  }
  function preloadAll() {
    Object.keys(CARDS).forEach(function (k) { preload(CARDS[k].image); });
    TORI_POSES.forEach(function (p) { preload('images/tori/tori_' + p + '.webp'); });
  }
  // 이미 decode 된 이미지를 쓸 수 있으면 그 요소를, DOM 에 이미 붙어 있으면 복제본을 돌려줌
  function cardImage(path, cls) {
    var url = src(path);
    if (imgFailed[url]) return null;
    var im = imgCache[url];
    var out = (im && !im.parentNode) ? im : (im ? im.cloneNode(false) : new Image());
    if (!im) { out.src = url; out.alt = ''; }
    out.className = cls;
    out.draggable = false;
    return out;
  }

  /* ---------------- 카드 DOM ---------------- */
  function questionArt() {   // 타임라인의 물음표 카드(손패 뒷면)와 같은 모양: 어두운 남색 바탕 + 하늘색으로 빛나는 큰 '?' (모양은 css 의 .th-q-art)
    var w = el('div', 'th-q-art');
    w.appendChild(el('span', 'th-q-mark', '?'));   // 글자 크기는 .th-q-art(컨테이너) 너비 기준이라 안쪽 요소에 줌
    w.setAttribute('aria-hidden', 'true');
    return w;
  }
  function hiddenCardEl() {
    var c = el('div', 'th-card th-hidden');
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', UI_TEXT.hiddenLabel);
    c.appendChild(questionArt());
    return c;
  }
  function openCardEl(cardId) {
    var card = CARDS[cardId];
    var c = el('div', 'th-card');
    var im = cardImage(card.image, 'th-card-img');
    if (im) {
      im.alt = card.name;
      im.onerror = function () { if (im.parentNode) im.parentNode.replaceChild(cardPlaceholder(), im); };   // 깨진 그림 대신 자리표시자
      c.appendChild(im);
    } else {
      c.appendChild(cardPlaceholder());
    }
    c.appendChild(el('p', 'th-card-name', card.name));
    return c;
  }
  function cardPlaceholder() {
    var ph = el('div', 'th-card-ph');
    ph.appendChild(svg('0 0 40 40', '', [['rect', { x: 6, y: 4, width: 28, height: 32, rx: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }], ['path', { d: 'M12 14h16M12 20h16M12 26h10', stroke: 'currentColor', 'stroke-width': 2 }]]));
    return ph;
  }

  /* ---------------- 문제 순서 ---------------- */
  function cardOf(qid) { return qById(qid).card; }
  function isRuleOrder(cards) {   // 카드 id 순서에서 ORDER_RULE 카드만 뽑았을 때 타임라인 정답 순서와 똑같은가 (바로 이어지는 쌍은 허용, 전체가 똑같은 것만 금지)
    return cards.filter(function (c) { return ORDER_RULE.indexOf(c) >= 0; }).join() === ORDER_RULE.join();
  }
  function orderOk(seq) { return !isRuleOrder(seq.map(cardOf)); }
  function makeOrder() {
    var FIRST = 'q1';   // 수도원 다음 첫 문제는 항상 q1 (뒤 문제들에 '임명' 같은 말이 많이 나와서). 나머지만 섞음
    var ids = QUESTIONS.filter(function (q) { return !q.tutorial && q.id !== FIRST; }).map(function (q) { return q.id; });
    for (var t = 0; t < 1000; t++) { shuffle(ids); if (orderOk([FIRST].concat(ids))) break; }
    return [FIRST].concat(ids);
  }
  // 틀린 문제를 남은 문제 사이 무작위 위치에 다시 넣음 (바로 다음 칸은 피함)
  function requeue(qid) {
    var q = S.queue;
    if (qById(qid).tutorial) { q.unshift(qid); return; }
    if (q.length === 0) { q.push(qid); return; }
    var cand = [];
    for (var p = 1; p <= q.length; p++) cand.push(p);
    var good = cand.filter(function (p) {   // 이미 얻은 카드 + 남은 문제를 이어 붙였을 때 타임라인 정답 순서가 되지 않는 자리
      var next = q.slice(); next.splice(p, 0, qid);
      return !isRuleOrder(S.obtained.concat(next.map(cardOf)));
    });
    var pool = good;
    if (!pool.length) {   // 1칸 뒤 이후 자리가 모두 정답 순서가 되면, 어쩔 수 없이 바로 다음 칸(0)을 허용
      var next0 = q.slice(); next0.splice(0, 0, qid);
      pool = isRuleOrder(S.obtained.concat(next0.map(cardOf))) ? cand : [0];
    }
    q.splice(pool[Math.floor(Math.random() * pool.length)], 0, qid);
  }

  /* ---------------- 이벤트·타이머 관리 ---------------- */
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts || false);
    S.listeners.push([target, type, fn, opts || false]);
  }
  function after(ms, fn) { var t = { at: S.clock + ms, fn: fn }; S.timers.push(t); return t; }   // 게임 시계 기준 (탭이 숨으면 같이 멈춤)
  function clearTimers() { if (S) S.timers.length = 0; }

  /* ---------------- 화면 만들기 ---------------- */
  function mount(container, opts) {
    if (!container) return;
    if (S) destroyGame();
    opts = opts || {};
    if (typeof opts.assetBase === 'string') CONFIG.ASSET_BASE = opts.assetBase;

    S = { container: container, listeners: [], timers: [], clock: 0, raf: 0, lastT: 0,
      w: 0, h: 0, dpr: 1, dist: 0, speed: CONFIG.CRUISE_SPEED, speedVel: 0, targetSpeed: CONFIG.CRUISE_SPEED,
      bank: 0, bankTarget: 0, zoom: 0, zoomTarget: 0, branch: null, phase: 'idle', qElapsed: 0, light: 0.05, lightTarget: 0.05,
      queue: [], current: null, sides: null, obtained: [], reduced: reducedMotion(), onComplete: null,
      pointer: null, swallowClickUntil: 0, sway: 0, corner: 0, streaks: [], stars: [], backdrop: null,
      cam: { x: 0, z: 0, yaw: 0 }, ringPhase: 0, ringBase: 0 };
    for (var sj = 0; sj < (S.reduced ? CONFIG.STAR_COUNT >> 1 : CONFIG.STAR_COUNT); sj++) S.stars.push(newStar(0.5, CONFIG.STAR_DEPTH));
    for (var si = 0; si < (S.reduced ? 16 : CONFIG.STREAK_COUNT); si++) S.streaks.push(newStreak(0.5, CONFIG.RING_COUNT));

    var root = el('div', 'th-root');
    root.setAttribute('role', 'application');
    root.setAttribute('aria-label', '타임 홀');
    var canvas = el('canvas', 'th-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    root.appendChild(canvas);

    // 상단 무전 말풍선: 모서리를 깎은 판 + 테두리를 뚫고 나온 가시(무전 표시) + 왼쪽에 토리 무전 모니터
    var top = el('div', 'th-top');
    var bubble = el('div', 'th-radio');
    var rbg = el('div', 'th-radio-bg');
    rbg.appendChild(el('div', 'th-radio-frame'));
    rbg.appendChild(el('div', 'th-radio-fill'));
    bubble.appendChild(rbg);
    ['l', 'r', 't1', 't2', 'b1', 'b2'].forEach(function (pos) {
      bubble.appendChild(svg('0 0 22 16', 'th-spike th-spike-' + pos, [['path', { d: 'M22 8 L13 6 L9 1 L7 6 L0 8 L7 10 L9 15 L13 10 Z' }]]));
    });
    var tag = el('div', 'th-radio-tag');
    tag.setAttribute('aria-hidden', 'true');
    tag.appendChild(svg('0 0 16 16', 'th-radio-ant', [['path', { d: 'M8 15 L8 7 M4.5 4.5 A5 5 0 0 1 11.5 4.5 M2.5 2.5 A8 8 0 0 1 13.5 2.5' }], ['circle', { cx: 8, cy: 7, r: 1.6 }]]));
    tag.appendChild(el('span', '', UI_TEXT.radioTag));
    var sig = el('span', 'th-sig');
    for (var sgi = 0; sgi < 3; sgi++) sig.appendChild(el('i'));
    tag.appendChild(sig);
    bubble.appendChild(tag);
    var rbody = el('div', 'th-radio-body');
    var btext = el('p', 'th-bubble-text');
    btext.setAttribute('aria-live', 'polite');
    bubble.appendChild(rbody);
    var nextMark = el('span', 'th-next', '\u25BC');   // 터치해서 넘기라는 표시 (오프닝 대사 동안)
    nextMark.setAttribute('aria-hidden', 'true');
    bubble.appendChild(nextMark);
    var nextHint = el('span', 'th-hint', (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? UI_TEXT.nextHint : UI_TEXT.nextHintPc);   // 진행 안내 (Enter·Space 또는 터치)
    nextHint.setAttribute('aria-hidden', 'true');
    bubble.appendChild(nextHint);
    top.appendChild(bubble);
    function makeOpt(side) {
      var b = el('button', 'th-opt th-opt-' + side);
      b.type = 'button';
      b.tabIndex = -1;
      b.appendChild(svg('0 0 24 24', 'th-opt-arrow', [['path', { d: side === 'left' ? 'M15 4 L7 12 L15 20' : 'M9 4 L17 12 L9 20' }]]));
      var t = el('span', 'th-opt-text');
      b.appendChild(t);
      return { btn: b, text: t };
    }
    var optL = makeOpt('left');
    var optR = makeOpt('right');
    var toriBox = el('div', 'th-tori-box');
    var toriWrap = el('div', 'th-tori-wrap');
    var tori = el('img', 'th-tori');
    tori.alt = '토리';
    tori.draggable = false;
    toriWrap.appendChild(tori);
    toriBox.appendChild(toriWrap);
    // 남은 시간: 토리 원 둘레의 노란 선이 12시 방향부터 시계방향으로 사라짐
    var tickShapes = [['circle', { cx: 50, cy: 50, r: 49.5, 'class': 'th-timer-rim' }]];
    for (var ti0 = 0; ti0 < TIMER_TICKS; ti0++) {
      var ang = ti0 / TIMER_TICKS * Math.PI * 2;   // 12시부터 시계방향
      var sx = Math.sin(ang), sy = -Math.cos(ang);
      tickShapes.push(['line', { x1: (50 + sx * 43.5).toFixed(2), y1: (50 + sy * 43.5).toFixed(2), x2: (50 + sx * 48).toFixed(2), y2: (50 + sy * 48).toFixed(2), 'class': 'th-tick' }]);
    }
    var timer = svg('0 0 100 100', 'th-timer', tickShapes);
    timer.setAttribute('role', 'progressbar');
    timer.setAttribute('aria-label', UI_TEXT.timeLabel);
    timer.removeAttribute('aria-hidden');
    toriBox.appendChild(timer);
    rbody.appendChild(toriBox);   // 토리는 말풍선 왼쪽 무전 모니터 안에
    rbody.appendChild(btext);
    root.appendChild(top);
    var opts = el('div', 'th-opts');   // 선택지: 화면 가운데 높이, 홀 왼쪽·오른쪽
    opts.appendChild(optL.btn);
    opts.appendChild(optR.btn);
    root.appendChild(opts);

    // 오답 안내도 상단 말풍선과 같은 무전 디자인 (붉은색): 깎은 판 + 가시 + '토리 · 무전' 꼬리표
    var banner = el('div', 'th-banner th-radio');
    banner.setAttribute('aria-live', 'assertive');
    var bbg = el('div', 'th-radio-bg');
    bbg.appendChild(el('div', 'th-radio-frame'));
    bbg.appendChild(el('div', 'th-radio-fill'));
    banner.appendChild(bbg);
    ['l', 'r', 't1', 'b2'].forEach(function (pos) {
      banner.appendChild(svg('0 0 22 16', 'th-spike th-spike-' + pos, [['path', { d: 'M22 8 L13 6 L9 1 L7 6 L0 8 L7 10 L9 15 L13 10 Z' }]]));
    });
    var btag = el('div', 'th-radio-tag');
    btag.setAttribute('aria-hidden', 'true');
    btag.appendChild(svg('0 0 16 16', 'th-radio-ant', [['path', { d: 'M8 15 L8 7 M4.5 4.5 A5 5 0 0 1 11.5 4.5 M2.5 2.5 A8 8 0 0 1 13.5 2.5' }], ['circle', { cx: 8, cy: 7, r: 1.6 }]]));
    btag.appendChild(el('span', '', UI_TEXT.radioTag));
    var bsig = el('span', 'th-sig');
    for (var bgi = 0; bgi < 3; bgi++) bsig.appendChild(el('i'));
    btag.appendChild(bsig);
    banner.appendChild(btag);
    var bbody = el('div', 'th-banner-body');
    var bTitle = el('strong', 'th-banner-title');
    var bNote = el('p', 'th-banner-note');
    bbody.appendChild(bTitle);
    bbody.appendChild(bNote);
    banner.appendChild(bbody);
    root.appendChild(banner);

    // 수도원 문제 설명용: 가운데에 글리치로 뜨는 두 번째 무전창 (상단 무전창에는 문제가 떠 있으므로)
    var tutbox = el('div', 'th-banner th-tutbox th-radio');
    tutbox.setAttribute('aria-live', 'polite');
    var tbg = el('div', 'th-radio-bg');
    tbg.appendChild(el('div', 'th-radio-frame'));
    tbg.appendChild(el('div', 'th-radio-fill'));
    tutbox.appendChild(tbg);
    ['l', 'r', 't1', 'b2'].forEach(function (pos) {
      tutbox.appendChild(svg('0 0 22 16', 'th-spike th-spike-' + pos, [['path', { d: 'M22 8 L13 6 L9 1 L7 6 L0 8 L7 10 L9 15 L13 10 Z' }]]));
    });
    var ttag = el('div', 'th-radio-tag');
    ttag.setAttribute('aria-hidden', 'true');
    ttag.appendChild(svg('0 0 16 16', 'th-radio-ant', [['path', { d: 'M8 15 L8 7 M4.5 4.5 A5 5 0 0 1 11.5 4.5 M2.5 2.5 A8 8 0 0 1 13.5 2.5' }], ['circle', { cx: 8, cy: 7, r: 1.6 }]]));
    ttag.appendChild(el('span', '', UI_TEXT.radioTag));
    var tsig = el('span', 'th-sig');
    for (var tgi = 0; tgi < 3; tgi++) tsig.appendChild(el('i'));
    ttag.appendChild(tsig);
    tutbox.appendChild(ttag);
    var tbody = el('div', 'th-banner-body');
    var tutnote = el('p', 'th-banner-note');
    tbody.appendChild(tutnote);
    tutbox.appendChild(tbody);
    var tnext = el('span', 'th-next', '▼');
    tnext.setAttribute('aria-hidden', 'true');
    var thint = el('span', 'th-hint', (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? UI_TEXT.nextHint : UI_TEXT.nextHintPc);
    thint.setAttribute('aria-hidden', 'true');
    thint.appendChild(tnext);   // ▼ 는 안내 글 바로 옆에 붙임
    tutbox.appendChild(thint);
    root.appendChild(tutbox);

    // 조작법 안내 팝업: 타이머 설명 다음에 화면 거의 전체를 덮는 글리치 창으로 뜸. 안은 3칸(키보드 · 클릭/터치 · 슬라이드)이고 칸 내용은 열 때 채움
    var gbox = el('div', 'th-banner th-tutbox th-guidebox th-radio');
    gbox.setAttribute('role', 'group');
    gbox.setAttribute('aria-label', '조작법 안내');
    var gbg = el('div', 'th-radio-bg');
    gbg.appendChild(el('div', 'th-radio-frame'));
    gbg.appendChild(el('div', 'th-radio-fill'));
    gbox.appendChild(gbg);
    ['l', 'r', 't1', 'b2'].forEach(function (pos) {
      gbox.appendChild(svg('0 0 22 16', 'th-spike th-spike-' + pos, [['path', { d: 'M22 8 L13 6 L9 1 L7 6 L0 8 L7 10 L9 15 L13 10 Z' }]]));
    });
    var gtag = el('div', 'th-radio-tag');
    gtag.setAttribute('aria-hidden', 'true');
    gtag.appendChild(svg('0 0 16 16', 'th-radio-ant', [['path', { d: 'M8 15 L8 7 M4.5 4.5 A5 5 0 0 1 11.5 4.5 M2.5 2.5 A8 8 0 0 1 13.5 2.5' }], ['circle', { cx: 8, cy: 7, r: 1.6 }]]));
    gtag.appendChild(el('span', '', UI_TEXT.radioTag));
    var gsig = el('span', 'th-sig');
    for (var ggi = 0; ggi < 3; ggi++) gsig.appendChild(el('i'));
    gtag.appendChild(gsig);
    gbox.appendChild(gtag);
    var gbody = el('div', 'th-banner-body');
    var gcols = el('div', 'th-gcols');
    gbody.appendChild(gcols);
    var gstart = el('button', 'th-gstart', UI_TEXT.tutStart);
    gstart.type = 'button';
    gbody.appendChild(gstart);
    gbox.appendChild(gbody);
    root.appendChild(gbox);

    var cardget = el('div', 'th-cardget');
    root.appendChild(cardget);

    var hud = el('div', 'th-hud');
    hud.setAttribute('aria-label', '얻은 카드');
    var slots = [];
    for (var i = 0; i < QUESTIONS.length; i++) { var s = el('div', 'th-slot'); hud.appendChild(s); slots.push(s); }
    root.appendChild(hud);

    var guide = el('div', 'th-guide');
    guide.setAttribute('role', 'dialog');
    guide.setAttribute('aria-modal', 'true');
    guide.setAttribute('aria-label', UI_TEXT.guideTitle);
    var gp = el('div', 'th-guide-panel');
    gp.appendChild(el('h2', 'th-guide-title', UI_TEXT.guideTitle));
    var rows = el('div', 'th-guide-rows');
    var HAND_FILL = 'rgba(95,212,224,0.22)';
    var icons = {
      keys: [['rect', { x: 4, y: 10, width: 22, height: 26, rx: 5 }], ['path', { d: 'M20 23 L10 23 M14 18 L9 23 L14 28' }], ['rect', { x: 30, y: 10, width: 22, height: 26, rx: 5 }], ['path', { d: 'M36 23 L46 23 M42 18 L47 23 L42 28' }]],
      click: [['rect', { x: 3, y: 8, width: 19, height: 26, rx: 4 }], ['rect', { x: 34, y: 8, width: 19, height: 26, rx: 4 }], ['path', { d: 'M8 17 L17 17 M8 23 L15 23 M39 17 L48 17 M39 23 L46 23' }],
        ['path', { d: 'M40 24 L40 44 L44.5 39.5 L48 46.5 L51 45 L47.5 38 L53 38 Z', fill: '#ffffff', stroke: '#0a1a2c', 'stroke-width': 1.6 }]],
      swipe: [['path', { d: 'M4 10 L17 10 M9 5 L4 10 L9 15 M39 10 L52 10 M47 5 L52 10 L47 15' }],
        ['path', { d: 'M23 35 L23 16 C23 12.5 28 12.5 28 16 L28 28 C28 25.5 32 25.5 32 28 L32 30 C32 27.5 36 27.5 36 30 L36 32 C36 29.5 40 29.5 40 32 L40 38 C40 42.5 37 45.5 32.5 45.5 L27 45.5 C24 45.5 22 43.5 20 40.5 L15.5 34 C14 31.5 17 29 19 31 L23 35', fill: HAND_FILL }]],
      tap: [['rect', { x: 3, y: 8, width: 19, height: 26, rx: 4 }], ['rect', { x: 34, y: 8, width: 19, height: 26, rx: 4 }], ['circle', { cx: 12.5, cy: 21, r: 4, fill: HAND_FILL }], ['circle', { cx: 12.5, cy: 21, r: 8, opacity: 0.5 }], ['circle', { cx: 43.5, cy: 21, r: 4, fill: HAND_FILL }], ['circle', { cx: 43.5, cy: 21, r: 8, opacity: 0.5 }]]
    };
    var touchFirst = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);   // 손가락이 주 입력인 기기
    (touchFirst ? ['swipe', 'tap'] : ['keys', 'click']).forEach(function (k) {
      var r = el('div', 'th-guide-row');
      r.appendChild(svg('0 0 56 48', '', icons[k]));
      r.appendChild(el('p', '', UI_TEXT.guideRows[k]));
      rows.appendChild(r);
    });
    gp.appendChild(rows);
    gp.appendChild(el('p', 'th-guide-note', UI_TEXT.guideNote));
    var gbtn = el('button', 'th-btn', UI_TEXT.guideStart);
    gbtn.type = 'button';
    gp.appendChild(gbtn);
    guide.appendChild(gp);
    root.appendChild(guide);

    var demo = el('div', 'th-demo-layer');   // 튜토리얼 시범(강조 테두리·키·손가락)이 그려지는 층
    demo.setAttribute('aria-hidden', 'true');
    root.appendChild(demo);

    var white = el('div', 'th-white');
    root.appendChild(white);

    container.appendChild(root);
    S.els = { root: root, canvas: canvas, ctx: canvas.getContext('2d'), timer: timer, ticks: Array.prototype.slice.call(timer.querySelectorAll('.th-tick')), tori: tori, toriWrap: toriWrap, bubble: bubble, btext: btext,
      optL: optL, optR: optR, banner: banner, tutbox: tutbox, tutnote: tutnote, guidebox: gbox, gcols: gcols, gstart: gstart, bTitle: bTitle, bNote: bNote, cardget: cardget, slots: slots, guide: guide, gbtn: gbtn, white: white, demo: demo, hud: hud, toriBox: toriBox };

    // 입력
    on(window, 'keydown', onKey);
    on(root, 'pointerdown', onPointerDown);
    on(root, 'pointerup', onPointerUp);
    on(root, 'pointercancel', function () { S.pointer = null; });
    on(root, 'touchmove', function (e) { e.preventDefault(); }, { passive: false });   // iOS 에서 끌기로 화면이 움직이지 않게
    on(root, 'contextmenu', function (e) { e.preventDefault(); });
    on(optL.btn, 'click', function () { onOptClick('left'); });
    on(optR.btn, 'click', function () { onOptClick('right'); });
    on(gbtn, 'click', startFromGuide);
    on(gstart, 'click', function () { tryOpeningTap(true); });   // 조작법 안내 팝업의 시작 버튼 (지금 단계가 이 팝업일 때만 열려 있음)

    // 크기
    if (window.ResizeObserver) {
      S.ro = new ResizeObserver(resize);
      S.ro.observe(root);
    } else {
      on(window, 'resize', resize);
    }
    resize();
    setTori('default');
    draw();
  }

  function resize() {
    if (!S) return;
    var r = S.els.root.getBoundingClientRect();
    var w = S.els.root.clientWidth || r.width, h = S.els.root.clientHeight || r.height;
    var shown = w ? Math.min(1, r.width / w) : 1;   // 앱이 1920 무대를 축소해 보여 줄 때 실제로 보이는 크기 비율: 그만큼 캔버스 해상도를 줄여 가볍게
    S.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_DPR) * Math.max(0.25, shown);
    S.w = w; S.h = h;
    S.els.canvas.width = Math.max(1, Math.round(w * S.dpr));
    S.els.canvas.height = Math.max(1, Math.round(h * S.dpr));
    if (S.phase === 'idle') draw();
    if (S.phase === 'opening') fitBubble();
    if (S.phase === 'explain') fitTutNote(S.els.tutnote);   // 안내 상자는 처음 그릴 때와 같은 방식으로 다시 맞춤(두 줄 기준으로 줄이면 화면을 돌릴 때 급히 작아짐)
    if (S.demoFocus) layoutDemo(S.demoFocus);   // 튜토리얼 시범은 크기가 바뀌면 다시 배치
  }

  /* ---------------- 토리 말풍선 ---------------- */
  function setTori(pose) {
    var url = src('images/tori/tori_' + pose + '.webp');
    if (imgFailed[url]) { S.els.tori.style.visibility = 'hidden'; return; }
    S.els.tori.style.visibility = '';
    if (S.els.tori.getAttribute('src') !== url) S.els.tori.src = url;
  }
  // 오프닝·튜토리얼 대사는 글자 크기를 줄여서라도 항상 두 줄 안에 들어가게 함
  function fitBubble(node, maxLines) {
    var t = node || S.els.btext;
    t.style.fontSize = '';
    if (!node) {   // 무전 대사는 글자 크기를 대사마다 바꾸지 않음(긴 대사는 줄 수가 늘고 무전창이 아래로 커짐). 세로 화면의 오프닝 대사만: 세 줄 이상이 되면(대사가 길거나 코드네임이 길 때) 글자를 15% 줄임
      S.els.bubble.classList.remove('th-3l');
      if (S.phase === 'opening' && S.els.root.clientWidth < S.els.root.clientHeight) {
        var lh0 = parseFloat(getComputedStyle(t).lineHeight) || (parseFloat(getComputedStyle(t).fontSize) || 20) * 1.4;
        if (t.clientHeight / lh0 > 2.5) { t.style.fontSize = (parseFloat(getComputedStyle(t).fontSize) * 0.85) + 'px'; S.els.bubble.classList.add('th-3l'); }   // 3줄: 글자 15% 축소 + 위·아래 여백 추가
      }
      return;
    }
    var lh, n = 0, fs = parseFloat(getComputedStyle(t).fontSize) || 20;
    while (n++ < 14 && fs > 10) {
      lh = parseFloat(getComputedStyle(t).lineHeight) || fs * 1.4;
      if (t.clientHeight / lh < (maxLines || (S.els.root.clientWidth < S.els.root.clientHeight ? 3.5 : 2.5))) break;   // 오프닝 대사: 가로는 두 줄, 세로(폭이 좁음)는 세 줄까지 허용
      fs *= 0.92;
      t.style.fontSize = fs + 'px';
    }
  }
  // 안내 상자 글: 줄바꿈 표시대로 한 줄씩 보이게 글자 크기를 줄여 맞춤(너무 작아지면 자동 줄바꿈 허용)
  function fitTutNote(t) {
    t.style.fontSize = '';
    if (S.els.root.clientWidth < S.els.root.clientHeight) { t.style.whiteSpace = ''; fitBubble(t, 6.5); return; }   // 세로 화면: 폭이 좁아 한 줄 맞춤은 글자가 너무 작아지므로, 크기는 그대로 두고 자동 줄바꿈(균형 맞춤)
    t.style.whiteSpace = 'pre';
    var base = parseFloat(getComputedStyle(t).fontSize) || 20, fs = base, n = 0;
    while (n++ < 30 && t.scrollWidth > t.clientWidth + 1 && fs > base * 0.7) { fs *= 0.96; t.style.fontSize = fs + 'px'; }
    if (t.scrollWidth > t.clientWidth + 1) { t.style.whiteSpace = ''; t.style.fontSize = ''; fitBubble(t, 6.5); }
  }
  // 글 속의 ← → 는 평면 방향키 아이콘으로 바꿔 넣음
  function fillArrows(node, text) {
    String(text).split(/(\{y\}.*?\{\/y\}|\{c\}.*?\{\/c\}|\{k\}.*?\{\/k\}|\{n\}.*?\{\/n\}|\{g\}.*?\{\/g\}|[←→])/).forEach(function (seg) {
      if (seg === '←' || seg === '→') {
        node.appendChild(svg('0 0 24 24', 'th-kbd', [['rect', { x: 1.5, y: 1.5, width: 21, height: 21, rx: 4.5 }],
          ['path', { d: seg === '←' ? 'M17 12 H7.5 M11 8.5 L7.5 12 L11 15.5' : 'M7 12 H16.5 M13 8.5 L16.5 12 L13 15.5' }]]));
      } else if (seg.indexOf('{y}') === 0) {
        node.appendChild(el('span', 'th-hl-y', seg.slice(3, -4)));   // 노란 글씨 강조
      } else if (seg.indexOf('{g}') === 0) {
        node.appendChild(el('span', 'th-note-g', seg.slice(3, -4)));   // 회색 반투명 보조 안내 (따로 한 줄)
      } else if (seg.indexOf('{k}') === 0) {
        node.appendChild(el('span', 'th-hl-k', seg.slice(3, -4)));   // 하늘색 강조 (타임홀 이름)
      } else if (seg.indexOf('{n}') === 0) {
        node.appendChild(el('span', 'th-hl-n', seg.slice(3, -4)));   // 파란색 강조 (코드네임)
      } else if (seg.indexOf('{c}') === 0) {
        node.appendChild(el('span', 'th-hl-c', seg.slice(3, -4)));   // 하늘색 강조
      } else if (seg) node.appendChild(document.createTextNode(seg));
    });
    return node;
  }
  function fillSay(t, text, cls) {   // 대사 내용을 무전 글자 칸에 채움
    t.textContent = '';
    if (Array.isArray(text)) {
      text.forEach(function (part, i) {
        if (i && !part.inline) t.appendChild(document.createTextNode('\n'));
        t.appendChild(fillArrows(el('span', (part.cls || '') + (part.glitch ? ' th-garble' : ''), ''), part.text));
      });
    } else {
      t.appendChild(fillArrows(el('span', cls || '', ''), text));
    }
  }
  function openingParts(ln) {
    var who = String(S.codename || '패트롤').replace(/[{}]/g, '');   // 코드네임 속 {} 는 마크업으로 읽히지 않게 뺌
    return ln.parts.map(function (p) { return { text: p.text.replace('{이름}', who), cls: p.cls, inline: p.inline, glitch: p.glitch }; });
  }
  function glideBubbleH(h0, h1) {   // 무전창 높이가 h0 에서 h1 로 부드럽게 바뀜
    var bb = S.els.bubble;
    bb.style.height = h0 + 'px'; void bb.offsetHeight;
    bb.style.transition = 'height .25s ease'; bb.style.height = h1 + 'px';
    var sq = S.hSeq = (S.hSeq || 0) + 1;
    setTimeout(function () { if (S && S.hSeq === sq) { bb.style.transition = ''; bb.style.height = ''; } }, 320);
  }
  function releaseBubbleH() {   // 오프닝이 끝나 안내 글 자리·고정 높이를 풀 때 창이 뚝 줄지 않고 부드럽게 줄어듦
    var bb = S.els.bubble, h0 = bb.offsetHeight;
    bb.classList.remove('th-hinted'); bb.style.minHeight = ''; bb.style.transition = 'none'; bb.style.height = '';
    var h1 = bb.offsetHeight;
    if (h0 && h1 && Math.abs(h1 - h0) > 2) glideBubbleH(h0, h1); else bb.style.transition = '';
  }
  function say(text, pose, cls) {
    var t = S.els.btext, bb0 = S.els.bubble, h0 = bb0.offsetHeight;   // 대사가 바뀌기 전 무전창 높이
    bb0.style.transition = 'none'; bb0.style.height = '';
    fillSay(t, text, cls);
    if (pose) { S.curPose = pose; setTori(pose); }
    fitBubble();
    var h1 = bb0.offsetHeight;   // 새 대사에 맞는 높이: 줄 수가 달라지면 무전창이 아래로 늘었다 줄어듦
    if (h0 && h1 && Math.abs(h1 - h0) > 2 && !bb0.classList.contains('th-crt-off')) {   // 어지러움 방지 모드와 상관없이 항상 부드럽게 늘었다 줄어듦
      glideBubbleH(h0, h1);
    } else bb0.style.transition = '';
    // 새 대사가 들어올 때: 꼬리표의 신호 막대만 움직임 (말풍선은 깜빡이지 않음)
    var bb = S.els.bubble;
    bb.classList.add('th-speaking');
    S.speakSeq = (S.speakSeq || 0) + 1;
    var seq = S.speakSeq;
    after(1500, function () { if (S && S.speakSeq === seq) bb.classList.remove('th-speaking'); });
  }

  /* ---------------- 게임 흐름 ---------------- */
  function start(opts) {
    if (!S) return;
    opts = opts || {};
    S.onComplete = typeof opts.onComplete === 'function' ? opts.onComplete : null;
    S.onExit = typeof opts.onExit === 'function' ? opts.onExit : null;   // 출구가 하얗게 밝아지기 시작하는 순간 (바깥 화면도 같이 하얘지게)
    clearTimers();
    S.queue = ['tutorial'].concat(makeOrder());
    S.obtained = [];
    S.current = null;
    S.exit = null;
    S.reduced = reducedMotion();
    S.els.slots.forEach(function (s) { s.className = 'th-slot'; s.textContent = ''; });
    S.els.white.classList.remove('th-on');
    S.els.root.classList.remove('th-exiting');
    preloadAll();
    S.codename = typeof opts.codename === 'string' ? opts.codename.slice(0, 20) : '';   // 화면에 보여 주기만 함 (저장·전송 없음)
    S.phase = 'opening';
    S.openIdx = -1; S.openReady = false; S.openAt = 0;
    S.seq = TORI_LINES.opening;   // 오프닝 대사 → 첫 문제(수도원)가 뜨면 가운데 무전창으로 화면·조작법 설명
    S.tutDone = false; S.steps = null;
    S.els.tutbox.classList.remove('th-on', 'th-off', 'th-await');
    S.els.guidebox.classList.remove('th-on', 'th-off');
    clearDemo();
    S.targetSpeed = CONFIG.CRUISE_SPEED;
    S.els.bubble.classList.remove('th-crt-on', 'th-crt-closing', 'th-await');
    S.els.bubble.style.minHeight = ''; S.els.bubble.style.height = '';
    S.els.bubble.classList.add('th-hinted');   // 오프닝 동안: 무전창 아래에 '진행해 주세요' 안내 글 자리를 따로 둠
    S.els.bubble.classList.add('th-crt-off');   // 처음엔 말풍선이 꺼진 화면
    S.els.guide.classList.remove('th-on');
    // 흰 화면에서 시작해 서서히 걷힘
    var wh = S.els.white;
    wh.classList.remove('th-slow');
    wh.classList.add('th-on', 'th-snap');
    void wh.offsetWidth;
    wh.classList.remove('th-snap');
    wh.classList.add('th-slow');
    wh.classList.remove('th-on');
    if (!S.raf) { S.lastT = 0; S.raf = requestAnimationFrame(frame); }
    after(CONFIG.OPENING_FADE_MS + CONFIG.FIRST_BUBBLE_DELAY_MS, function () {
      S.els.bubble.classList.remove('th-crt-off');
      S.els.bubble.classList.add('th-crt-on');   // 브라운관 TV 켜지듯
      S.els.white.classList.remove('th-slow');
      openingNext();
    });
  }

  // 오프닝 대사: 터치(클릭·Enter·Space)할 때마다 한 줄씩. 다 끝나면 '달리는 법' 안내 → [출발!]
  function openingNext() {
    if (!S || S.phase !== 'opening') return;
    S.openIdx++;
    var lines = S.seq;
    if (S.openIdx >= lines.length) {
      S.openReady = false;
      S.els.bubble.classList.remove('th-await'); releaseBubbleH();
      clearDemo();
      if (!CONFIG.SHOW_GUIDE) { S.phase = 'approach'; nextQuestion(); return; }   // 안내 패널 없이 바로 첫 문제
      S.phase = 'guide';
      S.guideAt = performance.now();
      S.els.guide.classList.add('th-on');
      S.els.gbtn.focus({ preventScroll: true });
      return;
    }
    var ln = lines[S.openIdx];
    say(openingParts(ln), ln.pose);
    if (ln.focus) applyFocus(ln.focus);   // 튜토리얼 단계: 강조 테두리·시범
    sfx('advance');
    if (ln.parts.some(function (p) { return p.glitch; })) garbleSfx(S.speakSeq, 1000);   // 글자가 처음 깨지는 시점(1초 뒤)에 작은 글리치 소리 한 번
    S.openReady = true;
    S.openAt = performance.now();
    S.openLock = ln.parts.some(function (p) { return p.glitch; }) ? CONFIG.OPENING_GLITCH_LOCK_MS : CONFIG.OPENING_LOCK_MS;
    var seqNow = S.speakSeq;
    after(S.openLock, function () { if (S && S.speakSeq === seqNow && S.phase === 'opening') S.els.bubble.classList.add('th-await'); });   // 넘길 수 있게 되는 순간부터 ▼·안내 글이 보임
  }
  function garbleSfx(seq, delay) {
    after(delay, function () {
      if (!S || S.speakSeq !== seq || S.phase !== 'opening') return;
      sfx('holeGlitch', 0.5);   // 한 번만 (글자는 계속 깨져도 소리는 반복하지 않음)
    });
  }
  function tryOpeningTap(solid) {   // solid: Enter·Space·시작 버튼처럼 뜻을 가지고 한 입력 (화면 아무 데나 닿은 터치는 아님)
    if (S && S.phase === 'explain' && S.expReady && performance.now() - S.expAt >= CONFIG.OPENING_TAP_LOCK_MS) {
      var cur = S.steps && S.steps[S.expIdx];
      if (cur && cur.focus === 'guide' && !solid) return false;   // 조작법 안내 팝업은 화면을 아무 데나 눌러서는 넘어가지 않고, 시작 버튼(또는 Enter·Space)으로만 시작
      explainNext(); return true;
    }
    if (S && S.phase === 'opening' && S.openReady && performance.now() - S.openAt >= (S.openLock || CONFIG.OPENING_LOCK_MS)) { openingNext(); return true; }
    return false;
  }

  function startFromGuide() {
    if (!S || S.phase !== 'guide') return;
    if (performance.now() - (S.guideAt || 0) < 400) return;   // 대사를 넘기던 터치가 그대로 [출발!] 을 누르지 않게
    S.els.guide.classList.remove('th-on');
    sfx('accept');
    S.els.gbtn.blur();
    S.els.root.focus && S.els.root.focus({ preventScroll: true });
    nextQuestion();
  }

  // 수도원 문제가 뜬 채로, 가운데 무전창에서 한 단계씩(터치·Enter) 화면 구성·조작법을 설명. 끝나면 제한 시간이 시작됨
  function startExplain() {
    S.phase = 'explain';
    S.targetSpeed = CONFIG.CRUISE_SPEED;
    S.steps = tutorialSequence();
    S.expIdx = -1; S.expReady = false;
    explainNext();
  }
  function explainNext() {
    if (!S || S.phase !== 'explain') return;
    var e = S.els;
    S.expIdx++;
    if (S.expIdx >= S.steps.length) {
      S.expReady = false;
      [e.tutbox, e.guidebox].forEach(function (tb) {   // 떠 있는 안내 상자(설명 상자 또는 조작법 팝업)를 TV 꺼지듯 닫음
        if (!tb.classList.contains('th-on')) return;
        tb.classList.remove('th-await');
        tb.classList.add('th-off');
        after(500, function () { tb.classList.remove('th-on', 'th-off'); });
      });
      sfx('holeGlitchOut', 1);
      try { e.gstart.blur(); } catch (_) { /* 포커스를 못 풀어도 계속 */ }   // 눌렀던 시작 버튼에 포커스가 남지 않게
      clearDemo(true);
      bgmDuck(false);   // 안내 상자가 사라질 때 원래 크기로 (종료)
      S.phase = 'question';
      S.qElapsed = 0; S.tickIdx = 0;
      setTimer(0);
      e.timer.classList.add('th-on');
      e.optL.btn.classList.toggle('th-aura', !!S.sides.left);   // 이제 직접 고르는 타이밍: 정답 쪽 노란 아우라
      e.optR.btn.classList.toggle('th-aura', !!S.sides.right);
      return;
    }
    var st = S.steps[S.expIdx];
    if (st.focus === 'guide') { showGuide(); return; }
    e.tutnote.textContent = '';
    fillArrows(e.tutnote, st.parts[0].text);
    if (S.expIdx === 0) {   // 글리치는 처음 나타날 때 한 번만
      e.tutbox.classList.remove('th-on', 'th-off');
      void e.tutbox.offsetWidth;
      sfx('holeGlitchSoft', 1);   // 안내 상자용: 오류 글리치보다 부드러운 소리
      bgmDuck(true);   // 어두운 남색 안내 상자가 떠 있는 동안만 배경음을 낮춤 (시작)
    }
    e.tutbox.classList.add('th-on', 'th-await');
    fitTutNote(e.tutnote);   // 안내 상자는 위·아래 폭이 넉넉하므로 글자를 줄이지 않고 여러 줄로 둠
    applyFocus(st.focus);
    if (S.expIdx > 0) sfx('advance');   // 첫 단계는 글리치 소리가 이미 울리므로 블립을 겹치지 않음
    S.expReady = true;
    S.expAt = performance.now();
  }

  // 조작법 안내 팝업: 설명 상자를 닫고 화면 거의 전체를 덮는 글리치 창을 엶. 세 칸에 키보드 · 클릭(터치) · 슬라이드 시범이 반복되고, 아래 버튼을 누르면 바로 시작
  function showGuide() {
    var e = S.els;
    e.tutbox.classList.remove('th-on', 'th-off', 'th-await');
    fillGuide();
    e.guidebox.classList.remove('th-on', 'th-off');
    void e.guidebox.offsetWidth;
    e.guidebox.classList.add('th-on');
    sfx('holeGlitchSoft', 1);
    applyFocus('guide');   // 위 선택지 쪽은 어둡게 덮고 눈금은 끔
    S.expReady = true;
    S.expAt = performance.now();
  }
  function guideMini(side) {   // 시범용 작은 선택지 상자
    var b = el('div', 'th-gbox th-gbox-' + side);
    b.appendChild(el('i'));
    b.appendChild(el('i'));
    return b;
  }
  function fillGuide() {
    var pc = CONFIG.TUTORIAL_PC_CURSOR && !isTouchFirst();   // PC 는 터치 대신 마우스 커서 클릭을 보여 주고, 슬라이드 칸에는 회색 보조 안내를 붙임
    var cols = [
      { kind: 'keys', cap: '키보드 ← → 키' },
      { kind: pc ? 'click' : 'tap', cap: pc ? '글을 {y}클릭{/y}하기' : '글을 {y}터치{/y}하기' },
      { kind: 'swipe', cap: '좌우로 {y}슬라이드{/y}' + (pc ? '{g}※ PC에서는 지원하지 않아요{/g}' : '') }
    ];
    S.els.gcols.textContent = '';
    cols.forEach(function (c) {
      var col = el('div', 'th-gcol');
      var stage = el('div', 'th-gstage th-gstage-' + (c.kind === 'click' ? 'tap' : c.kind));
      stage.setAttribute('data-kind', c.kind);
      stage.setAttribute('aria-hidden', 'true');
      stage.appendChild(guideMini('l'));
      stage.appendChild(guideMini('r'));
      if (c.kind === 'keys') {
        stage.appendChild(keyIconEl('left'));
        stage.appendChild(keyIconEl('right'));
      } else {
        if (c.kind !== 'swipe') { stage.appendChild(el('span', 'th-ripple th-ripple-l')); stage.appendChild(el('span', 'th-ripple th-ripple-r')); }
        stage.appendChild(pointerEl(c.kind === 'click' ? 'cursor' : 'finger', c.kind === 'swipe'));
      }
      col.appendChild(stage);
      col.appendChild(fillArrows(el('p', 'th-gcap'), c.cap));
      S.els.gcols.appendChild(col);
    });
  }
  function layoutGuide() {   // 칸 안 손가락·커서가 움직일 자리를 칸 크기에 맞춰 잡음
    Array.prototype.forEach.call(S.els.gcols.querySelectorAll('.th-gstage'), function (st) {
      var w = st.clientWidth, h = st.clientHeight, kind = st.getAttribute('data-kind');
      if (!w || !h) return;
      var bt = kind === 'keys' ? 0.12 : 0.34, bw = w * 0.42, bh = h * 0.38;   // CSS 의 상자 자리(.th-gbox)와 같은 비율
      var lx = w * 0.04 + bw / 2, rx = w * 0.96 - bw / 2, ly = h * bt + bh / 2;
      st.style.setProperty('--lx', lx + 'px'); st.style.setProperty('--rx', rx + 'px');
      st.style.setProperty('--ly', ly + 'px'); st.style.setProperty('--ry', ly + 'px');
      st.style.setProperty('--cx', ((lx + rx) / 2) + 'px'); st.style.setProperty('--cy', ly + 'px');
      st.style.setProperty('--pw', (kind === 'click' ? Math.max(16, bh * 0.4) : Math.max(28, bh * (kind === 'tap' ? 0.66 : 0.8))) + 'px');
      Array.prototype.forEach.call(st.querySelectorAll('.th-ripple'), function (rp) {
        rp.style.left = (rp.classList.contains('th-ripple-l') ? lx : rx) + 'px'; rp.style.top = ly + 'px';
      });
    });
  }

  /* ---------------- 튜토리얼: 첫 문제 전에 화면 구성·조작법 설명 ---------------- */
  // 설명글은 전부 토리 말풍선에 뜨고, 화면에는 강조 테두리·아이콘 시범이 나옴. 터치(클릭·Enter·Space)로 한 단계씩 넘김
  function isTouchFirst() { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); }
  function tutorialSequence() {
    var sec = Math.round(CONFIG.QUESTION_TIME_MS / 1000);
    var T = {
      radio: { pose: 'hint', text: '먼저 위를 봐 주세요!\n여기서는 문제를 확인할 수 있어요.' },
      slots: { pose: 'default', text: '아래는 사료 카드 보관함이에요.\n맞힐 때마다 카드가 한 장씩 채워져요!' },
      timer: { pose: 'what', text: '여기 보이는 눈금은 제한시간으로,\n문제마다 {y}' + sec + '초{/y}예요.\n눈금이 꺼지기 전에 길을 골라 주세요!' },
      guide: { pose: 'hint', text: '' }   // 선택지·키보드·클릭(터치)·슬라이드 안내는 한 장의 조작법 팝업(showGuide)에 3칸으로 모아 보여 줌
    };
    var order = ['radio', 'slots', 'timer', 'guide'];
    return order.map(function (k) { return { pose: T[k].pose, parts: [{ text: T[k].text }], focus: k }; });
  }

  function relRect(node) {   // 게임 화면(root) 안에서의 위치·크기 (화면이 확대·축소돼 있어도 맞게)
    var rr = S.els.root.getBoundingClientRect(), r = node.getBoundingClientRect();
    var k = rr.width / (S.els.root.clientWidth || rr.width) || 1;
    return { x: (r.left - rr.left) / k, y: (r.top - rr.top) / k, w: r.width / k, h: r.height / k };
  }
  function demoRing(node, pad, round) {   // 강조 테두리
    var r = relRect(node), d = el('div', 'th-focus' + (round ? ' th-focus-round' : ''));
    d.style.left = (r.x - pad) + 'px'; d.style.top = (r.y - pad) + 'px';
    d.style.width = (r.w + pad * 2) + 'px'; d.style.height = (r.h + pad * 2) + 'px';
    S.els.demo.appendChild(d);
    demoHole(r, pad, round);
  }
  // 강조하는 곳만 뚫린 어두운 남색 반투명 막 (나머지는 덮어서 시선을 모음). 겹치는 구멍은 하나로 합침
  var demoHoles = [];
  function demoHole(r, pad, round) {
    demoHoles.push({ x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2, round: !!round });
  }
  function holePath(o) {
    var x = o.x, y = o.y, w = o.w, h = o.h, q = o.round ? Math.min(w, h) / 2 : 16;
    q = Math.min(q, w / 2, h / 2);
    return 'M' + (x + q) + ' ' + y + 'H' + (x + w - q) + 'A' + q + ' ' + q + ' 0 0 1 ' + (x + w) + ' ' + (y + q) +
      'V' + (y + h - q) + 'A' + q + ' ' + q + ' 0 0 1 ' + (x + w - q) + ' ' + (y + h) + 'H' + (x + q) +
      'A' + q + ' ' + q + ' 0 0 1 ' + x + ' ' + (y + h - q) + 'V' + (y + q) + 'A' + q + ' ' + q + ' 0 0 1 ' + (x + q) + ' ' + y + 'Z';
  }
  function demoDim() {
    var hs = demoHoles.slice(), merged = true, i, j, a, b, x0, y0, x1, y1;
    while (merged) {   // 겹치는 구멍끼리 하나의 큰 구멍으로
      merged = false;
      for (i = 0; i < hs.length && !merged; i++) for (j = i + 1; j < hs.length && !merged; j++) {
        a = hs[i]; b = hs[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
          x0 = Math.min(a.x, b.x); y0 = Math.min(a.y, b.y);
          x1 = Math.max(a.x + a.w, b.x + b.w); y1 = Math.max(a.y + a.h, b.y + b.h);
          hs.splice(j, 1); hs[i] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, round: false };
          merged = true;
        }
      }
    }
    var W = S.els.root.clientWidth, H = S.els.root.clientHeight;
    var fresh = !S.dimEl;
    if (fresh) S.dimEl = el('div', 'th-veil');
    S.dimEl.style.clipPath = "path(evenodd, 'M0 0H" + W + 'V' + H + 'H0Z' + hs.map(holePath).join('') + "')";
    S.els.demo.insertBefore(S.dimEl, S.els.demo.firstChild);
    if (fresh) { void S.dimEl.offsetWidth; S.dimEl.classList.add('th-veil-on'); }   // 서서히 어두워짐
    else S.dimEl.classList.add('th-veil-on');
  }
  function svgAdd(parent, shapes) {
    shapes.forEach(function (sh) {
      var n = document.createElementNS(SVGNS, sh[0]);
      Object.keys(sh[1]).forEach(function (k) { n.setAttribute(k, sh[1][k]); });
      parent.appendChild(n);
    });
  }
  function keyIconEl(dir) {   // 선으로 그린 입체 키캡 (눌리면 윗면이 내려감)
    var s = svg('0 0 72 72', 'th-key th-key-' + dir, [['rect', { x: 8, y: 22, width: 56, height: 42, rx: 11, 'class': 'k-side' }]]);
    var g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'k-top');
    svgAdd(g, [['rect', { x: 10, y: 10, width: 52, height: 44, rx: 10, 'class': 'k-face' }],
      ['path', { d: dir === 'left' ? 'M41 24 L29 32 L41 40' : 'M31 24 L43 32 L31 40', 'class': 'k-arrow' }]]);
    s.appendChild(g);
    return s;
  }
  var HAND_PATH = 'M23 35 L23 16 C23 12.5 28 12.5 28 16 L28 28 C28 25.5 32 25.5 32 28 L32 30 C32 27.5 36 27.5 36 30 L36 32 C36 29.5 40 29.5 40 32 L40 38 C40 42.5 37 45.5 32.5 45.5 L27 45.5 C24 45.5 22 43.5 20 40.5 L15.5 34 C14 31.5 17 29 19 31 L23 35';
  function pointerEl(kind, trails) {   // 손가락(터치) 또는 마우스 커서. 끝점이 (0,0) 에 오게 놓음
    var w = el('div', 'th-pointer th-pointer-' + kind);
    if (kind === 'cursor') w.appendChild(svg('0 0 24 28', 'th-pointer-svg', [['path', { d: 'M2 2 L2 22 L7 17.5 L10.5 25 L13.5 23.6 L10 16.4 L16.5 16.4 Z', fill: 'rgba(8,24,44,0.55)', stroke: '#8ff0fa', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }]]));
    else w.appendChild(svg('0 0 56 48', 'th-pointer-svg', [['path', { d: HAND_PATH, fill: 'rgba(8,24,44,0.55)', stroke: '#8ff0fa', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }]]));
    if (trails) { w.appendChild(el('span', 'th-trail th-trail-l')); w.appendChild(el('span', 'th-trail th-trail-r')); }   // 슬라이드할 때 손가락 끝의 네모난 그라데이션 잔상
    return w;
  }

  // 튜토리얼 한 단계의 강조를 그림 (크기가 바뀌면 다시 호출). 조작법 안내 팝업 단계는 선택지까지 어둡게 덮고, 시범은 팝업 안 칸에서 보여 줌
  function layoutDemo(f) {
    var e = S.els, d = e.demo;
    d.textContent = '';
    demoHoles = [];
    if (f === 'radio') demoRing(e.bubble, 10, false);
    else if (f === 'slots') demoRing(e.hud, 6, false);
    else if (f === 'timer') demoRing(e.toriBox, relRect(e.toriBox).w * 0.2, true);
    else if (f === 'guide') layoutGuide();
    demoDim();
  }
  function applyFocus(f) {
    var e = S.els;
    S.demoFocus = null; S.demoTimer = false;
    e.timer.classList.remove('th-on', 'th-warn', 'th-hurry');
    resetTimerStage();
    e.root.classList.add('th-demo');   // 시범 동안 선택지는 보이기만 하고 눌리지 않음
    [e.optL.btn, e.optR.btn].forEach(function (b) { b.classList.remove('th-picked', 'th-dim'); b.classList.add('th-on'); });
    if (f === 'timer') { S.demoTimer = true; S.demoT0 = S.clock; e.timer.classList.add('th-on'); }
    S.demoFocus = f;
    layoutDemo(f);
  }
  function clearDemo(keepOpts) {
    var e = S.els;
    S.demoFocus = null; S.demoTimer = false;
    var dm = S.dimEl;
    S.dimEl = null;
    e.demo.textContent = '';
    if (dm) {   // 막은 서서히 걷힘
      e.demo.appendChild(dm);
      dm.classList.remove('th-veil-on');
      setTimeout(function () { if (dm.parentNode) dm.parentNode.removeChild(dm); }, 900);
    }
    e.root.classList.remove('th-demo');
    if (!keepOpts) [e.optL.btn, e.optR.btn].forEach(function (b) { b.classList.remove('th-on'); });
    e.timer.classList.remove('th-on', 'th-warn', 'th-hurry');
    setTimer(0);
  }

  function nextQuestion() {
    if (!S.queue.length) { finish(); return; }
    S.current = qById(S.queue.shift());
    S.phase = 'approach';
    S.targetSpeed = CONFIG.CRUISE_SPEED;
    S.lightTarget = 0.05;
    S.els.root.classList.toggle('th-tutorial', !!S.current.tutorial);
    if (!S.current.tutorial) {   // 수도원(튜토리얼) 문제 직전에는 대사 없음
      var lines = TORI_LINES.beforeQuestion;
      say(lines[Math.floor(Math.random() * lines.length)], 'default');
    }
    after(CONFIG.APPROACH_MS, askQuestion);
  }

  function askQuestion() {
    var q = S.current;
    var leftCorrect = Math.random() < 0.5;   // 문제마다·재출제마다 좌우 무작위
    S.sides = { left: leftCorrect, right: !leftCorrect };
    S.els.optL.text.textContent = leftCorrect ? q.answer : q.wrong;
    S.els.optR.text.textContent = leftCorrect ? q.wrong : q.answer;
    S.els.optL.btn.setAttribute('aria-label', '왼쪽: ' + S.els.optL.text.textContent);
    S.els.optR.btn.setAttribute('aria-label', '오른쪽: ' + S.els.optR.text.textContent);
    // 수도원(튜토리얼) 문제에서만 정답 쪽에 노란 아우라가 계속 퍼짐
    var explain = !!q.tutorial && !S.tutDone;   // 설명 중에는 아우라를 끄고, 직접 고르는 때부터 켬
    var help = !!q.tutorial || ((S.wrongBy && S.wrongBy[q.id]) || 0) >= 2;   // 같은 문제를 두 번 틀렸으면 세 번째부터는 정답 쪽에 노란 아우라 (수도원처럼)
    S.els.optL.btn.classList.toggle('th-aura', help && !explain && S.sides.left);
    S.els.optR.btn.classList.toggle('th-aura', help && !explain && S.sides.right);
    [S.els.optL.btn, S.els.optR.btn].forEach(function (b) {
      b.classList.remove('th-picked', 'th-dim', 'th-pop');
      void b.offsetWidth;
      b.classList.add('th-on', 'th-pop');   // 뜰 때 가벼운 팝 (한 번만)
      after(450, function () { b.classList.remove('th-pop'); });
    });
    say(q.text, 'what', 'th-q');
    sfx('select', 0.6);   // 선택지가 뜰 때 가볍게
    if (q.tutorial && !S.tutDone) { S.tutDone = true; startExplain(); return; }   // 수도원 문제: 먼저 설명, 끝나면 타이머 시작
    S.phase = 'question';
    S.qElapsed = 0; S.tickIdx = 0;
    S.targetSpeed = CONFIG.CRUISE_SPEED;   // 문제가 떠 있어도 속도는 그대로 (감속 없음)
    setTimer(0);
    S.els.timer.classList.add('th-on');
  }

  function choose(side) {   // side: 'left' | 'right' | null(시간 초과)
    if (!S || S.phase !== 'question') return;
    S.phase = 'resolve';
    var correct = !!side && S.sides[side];
    S.els.timer.classList.remove('th-on', 'th-warn', 'th-hurry');
    resetTimerStage();
    var picked = side === 'left' ? S.els.optL.btn : side === 'right' ? S.els.optR.btn : null;
    if (correct && CARDS[S.current.card] && CARDS[S.current.card].open) {   // 카드 그림을 팝 직전에 다시 decode 해 두어, 오래돼 버려진 디코딩 캐시 때문에 팝 순간 버벅이지 않게
      var cim = imgCache[src(CARDS[S.current.card].image)];
      if (cim && cim.decode) cim.decode().catch(function () { /* 실패해도 그냥 진행 */ });
    }
    S.els.optL.btn.classList.remove('th-aura'); S.els.optR.btn.classList.remove('th-aura');
    [S.els.optL.btn, S.els.optR.btn].forEach(function (b) { b.classList.add(b === picked ? 'th-picked' : 'th-dim'); });
    S.lightTarget = 0.05;
    // 고르면 정답·오답 상관없이 갈림길까지 가속 (속도로 정답이 미리 드러나지 않게). 시간 초과는 평소 속도로 직진
    try { S.els.optL.btn.blur(); S.els.optR.btn.blur(); } catch (_) { /* 포커스를 못 풀어도 계속 */ }   // 눌렀던 선택지에 포커스·강조가 남지 않게
    S.targetSpeed = side ? boostSpeed() : CONFIG.CRUISE_SPEED;   // 고르면 바로 확 가속 (시간 초과는 평소 속도로 직진)
    if (side) sfx('holeBoost', 1);   // 가속하며 빨려 들어가는 소리 (정답·오답 같은 소리: 소리로 정답이 드러나지 않게)
    if (side) {
      // 터널 끝 너머에 T자 교차로가 생겨 다가옴 → 도착하면 고른 쪽으로 90도 돌아 들어감 → 돌고 나면 결과 (advance 에서 처리)
      startJunction(side === 'left' ? -1 : 1, correct);
    } else {
      after(CONFIG.TURN_MS, function () { showResult(false, true); });   // 시간 초과: 갈림길 없이 직진
    }
  }

  function setTimer(p) {   // p: 0(시작) ~ 1(끝). 지난 만큼 12시부터 시계방향으로 눈금이 꺼짐
    var ticks = S.els.ticks, n = ticks.length, gone = p * n;
    for (var i = 0; i < n; i++) {
      var lit = clamp(i + 1 - gone, 0, 1);   // 지금 꺼지는 눈금은 서서히
      ticks[i].style.opacity = (0.12 + 0.88 * lit).toFixed(2);
    }
    var stage = p > 0.75 ? 2 : p > 0.5 ? 1 : 0;   // 0 하늘색 / 1 노랑(주황) / 2 빨강
    if (stage !== S.timerStage) { S.timerStage = stage; applyTimerStage(); }
    if (S.phase === 'question') {   // (소리 높이는 그대로 크기만 키움) 눈금이 두 개 꺼질 때마다(1초에 한 번) 작은 똑 소리 (절반 지나면 조금 크게, 마지막 구간은 높고 또렷하게). 튜토리얼 시범 눈금에서는 울리지 않음
      var gi = Math.floor(gone);
      if (gi > (S.tickIdx || 0)) { S.tickIdx = gi; if (gi % 2 === 0 || stage >= 1) sfx(stage === 2 ? 'holeTickHurry' : 'holeTick', stage === 1 ? 2.5 : 1.9); }
    }
    S.els.timer.setAttribute('aria-valuenow', String(Math.round((1 - p) * 100)));
    S.els.timer.classList.toggle('th-warn', p > 0.5 && p <= 0.75);   // 절반 지나면 노랑
    S.els.timer.classList.toggle('th-hurry', p > 0.75);                // 1/4 남으면 빨강
  }

  // 시간이 지나 눈금이 노랑(절반 지남)·빨강(1/4 남음)이 되면 토리 표정과 무전칸 색도 함께 바뀜 (색은 CSS 가 서서히 전환)
  function applyTimerStage() {
    var st = S.timerStage, b = S.els.bubble;
    b.classList.toggle('th-t-warn', st === 1);
    b.classList.toggle('th-t-hurry', st === 2);
    setTori(st === 2 ? 'sup' : st === 1 ? 'roading' : (S.curPose || 'default'));
  }
  function resetTimerStage() { S.timerStage = 0; applyTimerStage(); }

  function showResult(correct, timeout) {
    [S.els.optL.btn, S.els.optR.btn].forEach(function (b) { b.classList.remove('th-on'); });
    if (correct) onCorrect(); else onWrong(timeout);
  }

  function onCorrect() {
    var q = S.current;
    S.obtained.push(q.card);
    S.targetSpeed = CONFIG.CRUISE_SPEED;   // 카드가 가운데 떠 있는 동안 원래 속도로 (다음 문제 직전에 느려지지 않게)
    S.phase = 'card';
    sfx('correct');
    var cg = S.els.cardget;
    cg.textContent = '';
    cg.classList.remove('th-out');
    var open = !!CARDS[q.card].open;
    cg.appendChild(open ? openCardEl(q.card) : hiddenCardEl());
    cg.appendChild(burstEl());   // 팝! 하고 터지는 빛과 파티클 (짧은 한 번짜리라 '움직임 줄이기'여도 보여 줌)
    cg.classList.add('th-on');
    after(450, function () { say(TORI_LINES.cardGet, 'happy'); });
    after(CONFIG.CARD_SHOW_MS, function () { flyCardToSlot(cg, S.obtained.length - 1); });
    after(CONFIG.CARD_SHOW_MS + CONFIG.CARD_FLY_MS, function () {
      cg.classList.remove('th-on', 'th-out', 'th-fly');
      cg.textContent = '';
      fillSlot(S.obtained.length - 1, q.card);
    });
    after(CONFIG.CARD_SHOW_MS + CONFIG.CARD_FLY_MS + 350, nextQuestion);
  }

  // 얻은 카드가 가운데에서 아래 칸으로 빠르게 쇽! 내려감 (점점 빨라지다가 칸에 닿으면 바로 칸이 채워짐)
  function flyCardToSlot(cg, idx) {
    var card = cg.querySelector('.th-card'), slot = S.els.slots[idx];
    sfx('holeSwoosh', 1);
    cg.classList.add('th-fly');   // 빛·파티클은 바로 사라짐
    if (!card || !slot || !card.animate) { cg.classList.add('th-out'); return; }
    var a = relRect(card), b = relRect(slot);
    var dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.h / 2) - (a.y + a.h / 2), sc = b.w / a.w;
    card.animate([{ transform: 'none' }, { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')' }],
      { duration: CONFIG.CARD_FLY_MS, easing: 'cubic-bezier(.6, 0, 1, .5)', fill: 'forwards' });
  }

  function burstEl() {
    var fx = el('div', 'th-fx');
    fx.setAttribute('aria-hidden', 'true');
    fx.appendChild(el('span', 'th-flash'));
    fx.appendChild(el('span', 'th-cardglow'));
    for (var i = 0; i < 26; i++) {
      var pt = el('span', 'th-particle' + (i % 3 === 0 ? ' th-p-gold' : i % 3 === 1 ? ' th-p-cyan' : ' th-p-white'));
      var a = (i / 26) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      var dist = 120 + Math.random() * 160;
      pt.style.setProperty('--dx', (Math.cos(a) * dist * 0.12).toFixed(1) + 'px');
      pt.style.setProperty('--dy', (Math.sin(a) * dist).toFixed(1) + 'px');
      pt.style.setProperty('--sz', (4 + Math.random() * 7).toFixed(1) + 'px');
      pt.style.setProperty('--dl', (Math.random() * 0.08).toFixed(3) + 's');
      fx.appendChild(pt);
    }
    return fx;
  }

  function fillSlot(i, cardId) {
    var s = S.els.slots[i];
    if (!s) return;
    s.textContent = '';
    if (CARDS[cardId].open) {
      var im = cardImage(CARDS[cardId].image, '');
      if (im) { im.alt = CARDS[cardId].name; s.appendChild(im); }
    } else {
      s.appendChild(questionArt());
      s.setAttribute('aria-label', UI_TEXT.hiddenLabel);
    }
    s.classList.add('th-filled');
    sfx('snap');
  }

  function onWrong(timeout) {
    var q = S.current;
    S.phase = 'wrong';
    S.targetSpeed = CONFIG.CRUISE_SPEED;   // 안내가 떠 있는 동안 평소 속도로 서서히 돌아옴
    say([{ text: timeout ? TORI_LINES.timeout : TORI_LINES.wrong, cls: 'th-w' }], 'sad');
    S.els.bTitle.textContent = timeout ? UI_TEXT.timeoutTitle : UI_TEXT.wrongTitle;
    S.els.bNote.textContent = UI_TEXT.wrongRetry;   // 문제 해설은 일단 띄우지 않음 (q.wrongNote 데이터는 남겨 둠)
    S.wrongBy = S.wrongBy || {};
    S.wrongBy[q.id] = (S.wrongBy[q.id] || 0) + 1;   // 문제별로 틀린 횟수 (시간 초과 포함)
    requeue(q.id);
    S.wrongOpen = false;
    after(CONFIG.WRONG_NOTE_DELAY_MS, function () {   // 바로 띄우지 않고 잠깐 뒤에 지지직
      S.els.banner.classList.add('th-on');
      S.wrongOpen = true;
      sfx('holeGlitch', 1);
    });
    S.wrongAuto = after(CONFIG.WRONG_NOTE_DELAY_MS + CONFIG.WRONG_NOTE_MS, closeWrong);
  }

  // 오답 안내 닫기: 시간이 다 되면 저절로. 브라운관 TV 꺼지듯 선으로 줄어들며 사라지고 다음 문제로
  function closeWrong() {
    if (!S || !S.wrongOpen) return;
    S.wrongOpen = false;
    sfx('holeGlitchOut', 1);
    S.timers = S.timers.filter(function (x) { return x !== S.wrongAuto; });
    S.els.banner.classList.add('th-off');
    nextQuestion();
    after(500, function () { S.els.banner.classList.remove('th-on', 'th-off'); });
  }

  function finish() {
    S.phase = 'exit';
    S.els.root.classList.remove('th-tutorial');
    say(TORI_LINES.tunnelEnd, 'happy');
    S.targetSpeed = CONFIG.CRUISE_SPEED;          // 평소 속도로 출구에 다가감
    // 터널 끝에 진짜 출구가 생김. 처음 화면 크기가 지금 보이는 끝 빛과 똑같은 거리에 놓아 툭 커지지 않게 함
    var d0 = CONFIG.EXIT_DIST;
    if (S.lastK && S.lastLightPx) d0 = Math.max(d0, EXIT_HALO * S.lastK / S.lastLightPx);
    S.exit = { z: S.cam.z + d0, d0: d0, white: false };   // 도착 처리는 advance 에서
  }

  function exitReached() {   // 출구에 거의 닿음: 하얗게 밝아진 뒤 끝
    S.exit.white = true;
    S.els.bubble.classList.remove('th-crt-on', 'th-crt-off');
    S.els.bubble.classList.add('th-crt-closing');   // 무전창 닫는 연출: 브라운관 TV 꺼지듯
    sfx('holeGlitchSoft', 1);
    S.els.root.classList.add('th-exiting');   // 말풍선·카드 칸도 흰 빛과 함께 바로 사라짐
    S.els.white.style.transition = 'opacity 1.4s ease-out';   // 천천히 하얘짐 (바깥 창의 흰 화면과 같은 시간)
    S.els.white.classList.add('th-on');
    sfx('holeBoost', 0.8);   // 출구가 하얗게 밝아지는 순간에 가속음 (위로 솟는 음은 쓰지 않음)
    if (S.onExit) { try { S.onExit(); } catch (_) { /* 바깥 연출이 실패해도 계속 */ } }
    var st = S, fired = false;
    function complete() {   // 흰 화면이 충분히 덮인 뒤 넘김 (한 번만)
      if (fired || S !== st) return;
      fired = true;
      S.phase = 'done';
      var cb = S.onComplete, ids = S.obtained.slice();
      if (cb) cb(ids);
    }
    after(1700, complete);
    setTimeout(complete, 3500);   // 게임 시계가 멈춰도(화면 회전 등) 흰 화면에서 영영 멈추지 않게 실제 시간으로도 한 번 더 걸어 둠
  }

  /* ---------------- 입력 ---------------- */
  function onKey(e) {
    if (!S) return;
    if (S.phase === 'opening' || S.phase === 'explain') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) tryOpeningTap(true); }   // Enter·Space 로 넘김 (꾹 눌러도 한 번만)
      else if (e.key.indexOf('Arrow') === 0) e.preventDefault();   // 방향키는 넘기지 않고, 페이지만 움직이지 않게 막음
      return;
    }
    if (S.phase === 'question') {
      if (e.repeat) { e.preventDefault(); return; }   // 키를 계속 누르고 있어도 자동 반복은 무시: 다음 문제에서도 떼었다가 다시 눌러야 선택됨
      if (e.key === 'ArrowLeft') { e.preventDefault(); choose('left'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); choose('right'); }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') {
      if (S.phase !== 'guide' && S.phase !== 'idle') e.preventDefault();   // 게임 중 화살표·스페이스로 페이지가 움직이지 않게
    }
  }
  function onPointerDown(e) {
    if (S.phase === 'opening' || S.phase === 'explain') { tryOpeningTap(); return; }
    if (e.pointerType === 'mouse') return;   // 슬라이드는 터치·펜만. PC 는 키보드·클릭
    S.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    var p = S.pointer;
    S.pointer = null;
    if (!p || p.id !== e.pointerId) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.abs(dx) >= CONFIG.SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
      S.swallowClickUntil = performance.now() + 400;   // 슬라이드 끝에 따라오는 click 은 무시
      choose(dx < 0 ? 'left' : 'right');
    }
  }
  function onOptClick(side) {
    if (performance.now() < S.swallowClickUntil) return;
    choose(side);
  }

  /* ---------------- 그리기 ---------------- */
  function frame(t) {
    if (!S) return;
    S.raf = requestAnimationFrame(frame);
    if (S.paused) { S.lastT = 0; return; }   // 일시정지: 시계·시간 제한·움직임 모두 멈춤 (다시 시작하면 그 자리에서 이어짐)
    var dt = S.lastT ? Math.min((t - S.lastT) / 1000, 0.25) : 0.016;   // 느린 기기에서도 실제 시간대로 흐르게 (탭이 숨으면 rAF 가 멈춰 시계도 멈춤)
    S.lastT = t;
    S.clock += dt * 1000;

    // 예약 실행
    if (S.timers.length) {
      var due = S.timers.filter(function (x) { return x.at <= S.clock; });
      if (due.length) {
        S.timers = S.timers.filter(function (x) { return x.at > S.clock; });
        due.forEach(function (x) { try { x.fn(); } catch (_) { /* 예약 하나가 실패해도 나머지는 계속 */ } });
        if (!S) return;
      }
    }

    // 튜토리얼: 시간 눈금이 꺼지는 모습을 반복해서 보여 줌
    if (S.demoTimer) setTimer(((S.clock - S.demoT0) % CONFIG.DEMO_TIMER_MS) / CONFIG.DEMO_TIMER_MS);

    // 제한 시간
    if (S.phase === 'question') {
      S.qElapsed += dt * 1000;
      var p = clamp(S.qElapsed / CONFIG.QUESTION_TIME_MS, 0, 1);
      setTimer(p);
      if (S.qElapsed >= CONFIG.QUESTION_TIME_MS + CONFIG.GRACE_MS) choose(null);   // 시계는 끝난 것처럼 보여도 유예 시간 뒤에야 시간 초과
    }

    // 속도 (스프링):
    //  가속: 확 빨라지고 관성처럼 살짝 지나쳤다가 자리 잡음
    //  감속: 브레이크처럼 확 줄고 그대로 유지 (줄었다가 다시 올라가는 되튐 없음)
    var steps = Math.ceil(dt / 0.01), h = dt / steps;
    var tgt = S.targetSpeed;
    for (var st0 = 0; st0 < steps; st0++) {
      var braking = tgt < S.speed;
      var om = braking ? CONFIG.BRAKE_SPRING : (calm() ? 4 : CONFIG.SPEED_SPRING), zt = braking ? 1 : CONFIG.SPEED_DAMP;
      S.speedVel += (om * om * (tgt - S.speed) - 2 * zt * om * S.speedVel) * h;
      S.speed += S.speedVel * h;
    }
    if (S.speed < 0.6) { S.speed = 0.6; if (S.speedVel < 0) S.speedVel = 0; }
    S.bank += (S.bankTarget - S.bank) * Math.min(1, dt * 6);
    S.zoom += (S.zoomTarget - S.zoom) * Math.min(1, dt * 6);
    S.light += (S.lightTarget - S.light) * Math.min(1, dt * (S.phase === 'question' ? 6 : 2.5));
    var move = S.speed * dt * CONFIG.SPEED_SCALE;
    S.dist += move;
    if (!S.reduced) S.sway += dt;
    advance(move);
    draw();
  }

  /* =====================================================================
     3D 터널 (Canvas 2D 원근 투영, 외부 라이브러리 없음)
     세계 좌표: x 오른쪽, y 아래, z 앞. 터널 반지름 1, 링 간격 1.
     카메라 S.cam = { x, z, yaw }  (yaw 0 = +z 를 봄, 양수 = 오른쪽으로 돈 상태)
     평소: 곧은 터널(z 축)을 따라 달림.
     갈림길: 앞쪽 Jz 에 T자 교차로(좌우로 뻗은 통로)가 생겨 다가옴 → 고른 쪽으로 90도 돌아 들어감
             → 다 돌고 나면 좌표를 다시 맞춰(재기준) 고른 통로가 새 '곧은 터널'이 됨
     ===================================================================== */
  var RING_SEGS = 36;                    // 링 하나를 그리는 점 수 (방사선은 2개마다 하나 = 18개)
  var RCOS = [], RSIN = [];
  for (var rs0 = 0; rs0 < RING_SEGS; rs0++) { RCOS.push(Math.cos(rs0 / RING_SEGS * Math.PI * 2)); RSIN.push(Math.sin(rs0 / RING_SEGS * Math.PI * 2)); }
  var NEAR = 0.3;
  var EXIT_HALO = 1.6;                    // 출구 둘레 빛의 실제 반지름 (터널 반지름 = 1)                        // 카메라 바로 앞 이보다 가까운 점은 그리지 않음
  var BRANCH_DRAW = 70;                  // 갈래 통로를 그리는 길이

  function camToWorld(xc, yc, zc) {
    var c = S.cam, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
    return { x: c.x + xc * cs + zc * sn, y: yc, z: c.z - xc * sn + zc * cs };
  }
  function worldToCamZ(px, pz) {          // 카메라 앞쪽 거리만 빠르게
    var c = S.cam;
    return (px - c.x) * Math.sin(c.yaw) + (pz - c.z) * Math.cos(c.yaw);
  }

  function newStar(zMin, zMax) {          // 터널 바깥 우주 공간의 별 (카메라 앞쪽에 흩뿌림)
    var a = Math.random() * Math.PI * 2, r = 2.2 + Math.pow(Math.random(), 0.7) * 40;
    var p = camToWorld(Math.cos(a) * r, Math.sin(a) * r, zMin + Math.random() * (zMax - zMin));
    p.b = 0.4 + Math.random() * 0.6;
    p.tint = Math.random();
    return p;
  }
  function branchTheta() { return CONFIG.BRANCH_ANGLE * Math.PI / 180; }

  // 갈래 곡선 표: 곧은 상태에서 서서히 휘기 시작해 BRANCH_ANGLE 에서 서서히 곧아짐 (꺾임 없는 완만한 곡선)
  var BT = null;
  function branchTable() {
    var th = branchTheta(), Lc = CONFIG.BRANCH_CURVE_LEN;
    if (BT && BT.th === th && BT.Lc === Lc) return BT;
    var N = 240, ds = Lc / N, xs = [0], zs = [0], x = 0, z = 0, crotch = Lc;
    for (var i = 1; i <= N; i++) {
      var e = (i - 0.5) / N, phi = th * e * e * (3 - 2 * e);
      x += Math.sin(phi) * ds; z += Math.cos(phi) * ds;
      xs.push(x); zs.push(z);
      if (crotch === Lc && x >= 1) crotch = i * ds;   // 두 갈래 중심이 2 이상 벌어져 안쪽 벽이 갈라지는 지점
    }
    BT = { th: th, Lc: Lc, N: N, xs: xs, zs: zs, crotch: crotch, crotchZ: zs[Math.round(crotch / Lc * N)] };
    return BT;
  }
  // 갈래(side: +1 고른 쪽, -1 다른 쪽) 위 거리 s 지점의 중심과 진행 방향
  function branchAt(br, side, s) {
    var T = branchTable(), d = br.dir * side;
    if (s <= 0) return { x: 0, z: br.jz + s, ax: 0, az: 1 };
    if (s < T.Lc) {
      var f = s / T.Lc * T.N, i = Math.floor(f), w = f - i, e = s / T.Lc, phi = T.th * e * e * (3 - 2 * e);
      return { x: d * (T.xs[i] + (T.xs[i + 1] - T.xs[i]) * w), z: br.jz + T.zs[i] + (T.zs[i + 1] - T.zs[i]) * w, ax: d * Math.sin(phi), az: Math.cos(phi) };
    }
    var u = s - T.Lc, sn = Math.sin(T.th), cs = Math.cos(T.th);
    return { x: d * (T.xs[T.N] + sn * u), z: br.jz + T.zs[T.N] + cs * u, ax: d * sn, az: cs };
  }

  // 빛줄기: 터널 위 위치(곧은 터널이면 z, 갈래면 갈래 위 거리 s) + 벽 둘레 각도로 기억 → 곡선 구간에선 곡선을 따라 휘어 그려짐
  function newStreak(aMin, aMax) {
    var a = Math.random() * Math.PI * 2, r = 0.55 + Math.random() * 0.4;
    var br = S.branch, c = S.cam, warm = Math.random() < 0.2;
    var ahead = aMin + Math.random() * (aMax - aMin);
    var st = { ca: Math.cos(a), sa: Math.sin(a), r: r, warm: warm, br: null, s: 0, z: 0 };
    if (br && (br.s - br.L1) + ahead > 0) { st.br = br; st.s = Math.max(0.5, (br.s - br.L1) + ahead); }   // 고른 갈래 안
    else st.z = c.z + ahead;                                                                              // 곧은 터널 안
    return st;
  }
  function streakPos(st, ds) {   // 빛줄기 위치에서 터널을 따라 ds 만큼 앞의 실제 점
    if (st.br && S.branch === st.br) {
      var q = branchAt(st.br, 1, st.s + ds);
      return { x: q.x + q.az * st.ca * st.r, y: st.sa * st.r, z: q.z - q.ax * st.ca * st.r };
    }
    return { x: st.ca * st.r, y: st.sa * st.r, z: st.z + ds };
  }

  // 고르면: 터널 끝 너머(SPLIT_FAR)에서 갈림길이 시작됨
  function startJunction(dir, correct) {
    var jz = S.cam.z + CONFIG.SPLIT_FAR;
    S.branch = { dir: dir, correct: correct, jz: jz, z0: S.cam.z, s: 0, L1: jz - S.cam.z, done: false, optsHidden: false };
  }

  // 카메라를 고른 갈래의 중심 곡선 위에 놓음 (보는 방향 = 곡선의 진행 방향)
  function placeOnPath(br) {
    var c = S.cam, sb = br.s - br.L1, T = branchTable();
    if (sb < 0) { c.x = 0; c.z = br.z0 + br.s; c.yaw = 0; return; }
    var q = branchAt(br, 1, sb);
    var e = clamp(sb / T.Lc, 0, 1), sd = Math.sin(Math.PI * e), drift = CONFIG.TURN_DRIFT * (S.reduced ? 0.5 : 1) * sd * sd;   // 원심력: 곡선 가운데서 바깥쪽으로 살짝
    c.x = q.x - br.dir * q.az * drift;
    c.z = q.z + br.dir * q.ax * drift;
    c.yaw = Math.atan2(q.ax, q.az);
  }

  // 갈래에 들어선 뒤 좌표를 다시 맞춤: 고른 갈래가 새 z 축이 되도록 모든 점을 돌림 (화면은 그대로 이어짐)
  function rebaseAfterTurn(br) {
    var c = S.cam, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
    function tf(p) { var dx = p.x - c.x, dz = p.z - c.z; p.x = dx * cs - dz * sn; p.z = dx * sn + dz * cs; }
    S.stars.forEach(tf);
    var sc = br.s - br.L1, GAP = CONFIG.RING_GAP;
    // 빛줄기: 고른 갈래 안의 것은 새 곧은 터널 위치로 (갈래 거리 s → 새 z = s - sc), 나머지는 뒤쪽이라 새로 만들게 함
    S.streaks.forEach(function (st) { if (st.br === br) { st.z = st.s - sc; st.br = null; } else st.z = -999; });            // 갈래 위 카메라 거리. 갈래 링(s = GAP*m) → 새 z = s - sc
    S.ringPhase = ((-sc % GAP) + GAP) % GAP;
    S.ringBase = Math.round((sc + S.ringPhase) / GAP);       // 밝은 링 무늬(4칸마다)가 끊기지 않게
    c.x = 0; c.z = 0; c.yaw = 0;
    S.branch = null;
  }

  // 매 프레임 이동
  function advance(move) {
    var br = S.branch, c = S.cam;
    if (S.exit && !S.exit.white && S.exit.z - c.z < CONFIG.EXIT_FADE_AT) exitReached();
    if (!br) { c.z += move; }
    else {
      br.s += move;
      placeOnPath(br);
      var Lc = branchTable().Lc, sb = br.s - br.L1, d = br.dir;
      var inArc = sb >= 0 && sb < Lc;
      if (sb >= 0 && !br.optsHidden) {   // 갈래로 들어서면 선택지는 사라짐
        br.optsHidden = true;
        [S.els.optL.btn, S.els.optR.btn].forEach(function (b) { b.classList.remove('th-on'); });
      }
      // 속도: 고른 순간 확 빨라짐 → 그 속도 그대로 곡선을 빠져나갈 때까지 유지 → 빠져나오면 평소 속도로 돌아옴
      S.targetSpeed = sb < Lc * CONFIG.BRAKE_AT ? boostSpeed() : CONFIG.CRUISE_SPEED;
      S.corner = inArc ? Math.sin(Math.PI * sb / Lc) : 0;
      S.bankTarget = d * CONFIG.TURN_BANK * S.corner * (S.reduced ? 0.5 : 1);
      S.zoomTarget = (S.reduced ? 0 : CONFIG.TURN_ZOOM) * S.corner;
      if (!br.done && sb >= Lc + 1) { br.done = true; showResult(br.correct, false); }
      if (sb >= Lc + 6) {
        rebaseAfterTurn(br);
        S.corner = 0; S.bankTarget = 0; S.zoomTarget = 0;
        S.targetSpeed = CONFIG.CRUISE_SPEED;
      }
    }
    // 별·빛줄기: 너무 가까워지거나 멀어지면 앞쪽에 새로 만듦
    for (var sj = 0; sj < S.stars.length; sj++) {
      var sr = S.stars[sj], zc = worldToCamZ(sr.x, sr.z);
      if (zc < 0.4 || zc > 75) S.stars[sj] = newStar(CONFIG.STAR_DEPTH - 8, CONFIG.STAR_DEPTH);
    }
    for (var si = 0; si < S.streaks.length; si++) {
      var sp0 = streakPos(S.streaks[si], 0), zs = worldToCamZ(sp0.x, sp0.z);
      if (zs < NEAR || zs > 30) S.streaks[si] = newStreak(CONFIG.RING_COUNT - 4, CONFIG.RING_COUNT);
    }
  }

  // 멀리 있는 성운·작은 별 배경은 크기가 바뀔 때만 한 번 그려 두고 매 프레임 붙여 씀 (가볍게)
  function buildBackdrop(W, H) {
    var c = S.backdrop || (S.backdrop = document.createElement('canvas'));
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = '#01030a';
    g.fillRect(0, 0, W, H);
    var big = Math.max(W, H);
    var clouds = [
      [0.18, 0.30, 0.55, 'rgba(110,50,190,0.30)'],
      [0.82, 0.25, 0.50, 'rgba(30,120,190,0.28)'],
      [0.70, 0.85, 0.60, 'rgba(170,50,150,0.20)'],
      [0.25, 0.85, 0.45, 'rgba(30,170,170,0.18)'],
      [0.50, 0.60, 0.70, 'rgba(60,40,140,0.25)']
    ];
    clouds.forEach(function (cl) {
      var x = W * (cl[0] + (Math.random() - 0.5) * 0.12), y = H * (cl[1] + (Math.random() - 0.5) * 0.12), r = big * cl[2];
      var rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, cl[3]);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    });
    var n = Math.round(W * H / 2600);   // 화면 넓이에 맞춘 작은 별 수
    for (var i = 0; i < n; i++) {
      var a = 0.25 + Math.random() * 0.6, s = Math.random() < 0.08 ? 1.8 : 1;
      g.fillStyle = Math.random() < 0.15 ? 'rgba(255,225,180,' + a + ')' : 'rgba(200,225,255,' + a + ')';
      g.fillRect(Math.random() * W, Math.random() * H, s * S.dpr, s * S.dpr);
    }
  }

  function draw() {
    // 실제 캔버스 픽셀 크기(정수)를 씀 (화면 배율에서 배경을 매 프레임 새로 그리던 문제 방지)
    var ctx = S.els.ctx, dpr = S.dpr, W = S.els.canvas.width, H = S.els.canvas.height;
    if (!W || !H) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    var cx = W / 2, cy = H * CONFIG.VANISH_Y;
    var boost = clamp((S.speed - CONFIG.CRUISE_SPEED) / (boostSpeed() - CONFIG.CRUISE_SPEED), 0, 1);
    var pace = clamp(S.speed / CONFIG.CRUISE_SPEED, 0, 1);
    var K = Math.max(W, H) * 0.62 * (1 - (S.reduced ? 0 : CONFIG.FOV_KICK) * boost);   // 가속하면 시야가 넓어짐
    K *= 1 - CONFIG.ACCEL_KICK * (S.reduced ? 0.5 : 1) * clamp(S.speedVel / 50, -1, 1);   // 관성: 급감속은 앞으로 쏠림, 급가속은 뒤로 밀림
    var big = Math.max(W, H), minS = Math.min(W, H), TAU = Math.PI * 2, FAR = CONFIG.RING_COUNT;
    S.lastK = K; S.lastLightPx = Math.max(4 * dpr, minS * S.light);   // 마지막 출구를 지금 빛 크기에 맞춰 놓을 때 씀

    // 투영: 카메라 위치·방향 + 아주 작은 흔들림(살아 있는 느낌)
    var swayYaw = (S.reduced || H > W) ? 0 : Math.sin(S.sway * 0.35) * 0.012;   // 세로 화면은 시야 기준이 긴 변(높이)이라 좌우 흔들림이 크게 보여 터널 끝 빛이 가운데 칸에서 벗어남 → 세로에서는 좌우 흔들림을 끔
    var swayPitch = S.reduced ? 0 : Math.sin(S.sway * 0.27 + 1) * 0.006;
    var c = S.cam, yawP = c.yaw + swayYaw, cY = Math.cos(yawP), sY = Math.sin(yawP), camx = c.x, camz = c.z;
    var P = { x: 0, y: 0, z: 0 };   // 투영 결과 재사용
    function project(px, py, pz) {
      var dx = px - camx, dz = pz - camz;
      var zc = dx * sY + dz * cY;
      P.z = zc;
      if (zc < NEAR) return false;
      var xc = dx * cY - dz * sY, yc = py + swayPitch * zc;
      P.x = cx + xc * K / zc; P.y = cy + yc * K / zc;
      return true;
    }
    function fade(zc) { return clamp(1.2 - zc / FAR, 0, 1); }

    // 터널 끝 빛 = 그 터널의 끝(출구)을 그린 것. 세계에 고정된 자리라 카메라가 돌면 화면에서의 위치만 바뀜
    //   평소: 곧은 터널의 먼 끝 / 갈림길: 두 갈래 각자의 먼 끝 (갈래가 나타나면서 본 터널 끝 빛은 사라짐)
    //   마지막: 진짜 출구 (다가올수록 실제 크기로 커짐)
    var br = S.branch, lights = [];
    function addLight(lx, lz, a, isExit) {
      if (a <= 0.01 || !project(lx, 0, lz)) return;
      lights.push({ x: P.x, y: P.y, zc: P.z, a: a, exit: !!isExit });
    }
    if (br) {
      var apL = clamp((camz + FAR + 2 - br.jz) / 6, 0, 1);   // 갈래가 나타나는 정도
      var LcL = branchTable().Lc;
      var otherL = br.s > br.L1 ? clamp(1 - (br.s - br.L1) / (LcL + 4), 0, 1) : 1;
      var E1 = branchAt(br, 1, 90), E2 = branchAt(br, -1, 90);
      addLight(0, br.jz + 200, 1 - apL);                                       // 본 터널 끝 (갈래가 보이면 사라짐)
      addLight(E1.x, E1.z, apL);                                               // 고른 갈래의 끝
      addLight(E2.x, E2.z, apL * otherL);                                      // 다른 갈래의 끝
    } else if (S.exit) {
      addLight(0, Math.max(S.exit.z, camz + NEAR + 0.01), 1, true);             // 출구
    } else {
      addLight(camx + Math.sin(c.yaw) * 60, camz + Math.cos(c.yaw) * 60, 1);  // 곧은 터널의 끝
    }

    // 1) 먼 우주 배경
    if (!S.backdrop || S.backdrop.width !== W || S.backdrop.height !== H) buildBackdrop(W, H);
    ctx.drawImage(S.backdrop, 0, 0);
    lights.forEach(function (L) {
      var glow = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, big * 0.5);
      glow.addColorStop(0, 'rgba(120,90,220,' + (0.18 * L.a).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(120,90,220,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    });

    // 코너: 화면 기울기 + 흔들림
    var shake = S.reduced ? 0 : CONFIG.TURN_SHAKE_PX * dpr * S.corner * Math.min(1, S.speed / CONFIG.CRUISE_SPEED);
    if (Math.abs(S.bank) > 0.0005 || S.zoom > 0.0005 || shake > 0.01) {
      var ang0 = -S.bank, sc = 1 + S.zoom + (shake ? 0.02 : 0);   // 확대는 기울기와 따로 (TURN_ZOOM)
      var co = Math.cos(ang0) * sc, so = Math.sin(ang0) * sc;
      var jx = (Math.random() - 0.5) * 2 * shake, jy = (Math.random() - 0.5) * 2 * shake;
      ctx.setTransform(co, so, -so, co, cx - (co * cx - so * cy) + jx, cy - (so * cx + co * cy) + jy);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // 2) 터널 바깥 별 (가까울수록 크고 길게)
    var slen = 0.1 + S.speed * 0.05, hx = Math.sin(c.yaw), hz = Math.cos(c.yaw);
    for (var si = 0; si < S.stars.length; si++) {
      var sr = S.stars[si];
      if (!project(sr.x, sr.y, sr.z)) continue;
      var x1 = P.x, y1 = P.y, z1 = P.z;
      if (x1 < -60 || y1 < -60 || x1 > W + 60 || y1 > H + 60) continue;
      if (!project(sr.x + hx * slen, sr.y, sr.z + hz * slen)) continue;
      var sa = clamp(1.2 - z1 / CONFIG.STAR_DEPTH, 0, 1) * sr.b;
      ctx.strokeStyle = sr.tint < 0.15 ? 'rgba(255,215,170,' + sa.toFixed(3) + ')' : sr.tint < 0.35 ? 'rgba(190,170,255,' + sa.toFixed(3) + ')' : 'rgba(215,235,255,' + sa.toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.7, 9 / z1) * dpr;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(P.x + 0.01, P.y); ctx.stroke();
    }

    // 3) 반투명 터널: 통로 목록 만들기
    //    통로 = 축 위의 링 위치들(t 값) + 축 방향. 링 점 = 중심 + u*cos + y*sin (u: 축에 수직인 수평 방향)
    var corridors = [];
    var mainEnd = br ? br.jz : S.exit ? Math.min(S.exit.z, camz + FAR) : camz + FAR;
    var ph = S.ringPhase, mts = [];
    var GAP = CONFIG.RING_GAP;
    for (var k = Math.floor((camz - 3 - ph) / GAP); k * GAP + ph <= mainEnd + 1e-6; k++) {
      var tt = k * GAP + ph;
      if (tt < camz - 3) continue;
      if (tt > camz + FAR + 1) break;
      mts.push({ t: tt, n: k + S.ringBase });
    }
    if (br && br.jz > camz - 3) mts.push({ t: br.jz, n: null });   // 갈림점까지 방사선을 이음
    corridors.push({ at: function (t) { return { x: 0, z: t, ax: 0, az: 1 }; }, ts: mts, alpha: 1, main: true });
    if (br) {
      // Y자 갈래 두 개: 터널 끝 너머에서 서서히 나타나고, 들어선 뒤 다른 갈래는 서서히 사라짐
      var appear = clamp((camz + FAR + 2 - br.jz) / 6, 0, 1);
      var BTb = branchTable();
      var otherFade = br.s > br.L1 ? clamp(1 - (br.s - br.L1) / (BTb.Lc + 4), 0, 1) : 1;
      [1, -1].forEach(function (side) {
        var bts = [], bsm = [];
        for (var tb = 1; tb * GAP <= BRANCH_DRAW; tb++) bts.push({ t: tb * GAP, n: tb });
        for (var q = 0; q <= BRANCH_DRAW; q += (q < BTb.Lc ? 0.5 : 1)) bsm.push(q);   // 곡선 구간은 촘촘히
        corridors.push({ at: (function (sd) { return function (t) { return branchAt(br, sd, t); }; })(side), ts: bts, samples: bsm,
          alpha: appear * (side < 0 ? otherFade : 1), branch: true, outer: br.dir * side, crotch: BTb.crotch });
      });
    }

    var RX = new Float64Array(RING_SEGS), RY = new Float64Array(RING_SEGS), RZ = new Float64Array(RING_SEGS), RV = new Uint8Array(RING_SEGS);
    function ringPoints(cor, t) {   // 링 점들을 투영해 RX/RY/RZ/RV 에 담고, 모두 보이면 true
      var q = cor.at(t), ux = q.az, uz = -q.ax, all = true;
      var inCrotch = cor.branch && t < cor.crotch;   // 두 갈래가 겹치는 자리: 바깥쪽 절반만 그림
      for (var i = 0; i < RING_SEGS; i++) {
        var ok = !(inCrotch && RCOS[i] * cor.outer < -0.2) && project(q.x + ux * RCOS[i], RSIN[i], q.z + uz * RCOS[i]);
        RV[i] = ok ? 1 : 0; RX[i] = P.x; RY[i] = P.y; RZ[i] = P.z;
        if (!ok) all = false;
      }
      return all;
    }
    function ringZc(cor, t) { var q = cor.at(t); return worldToCamZ(q.x, q.z); }

    corridors.forEach(function (cor) {
      if (cor.alpha <= 0.01) return;
      var prev = null;   // 바로 앞 링(유리 띠 그리기용)
      // 링
      cor.ts.forEach(function (rt) {
        if (rt.n === null) { prev = null; return; }
        var zc0 = ringZc(cor, rt.t);
        if (zc0 > FAR + 1 || zc0 < -2) { prev = null; return; }
        var all = ringPoints(cor, rt.t);
        var oa = cor.alpha;
        var a = fade(Math.max(zc0, 0.5)) * oa * (0.6 + 0.4 * pace);
        var accent = rt.n % 4 === 0;
        ctx.strokeStyle = accent ? 'rgba(170,240,255,' + (a * 0.75).toFixed(3) + ')' : 'rgba(80,200,230,' + (a * 0.42).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.6, (accent ? 3.4 : 1.8) / Math.max(zc0, 0.5)) * dpr;
        ctx.beginPath();
        for (var i = 0; i <= RING_SEGS; i++) {
          var j = i % RING_SEGS, pj = (i + RING_SEGS - 1) % RING_SEGS;
          if (!RV[j]) continue;
          if (i === 0 || !RV[pj]) ctx.moveTo(RX[j], RY[j]); else ctx.lineTo(RX[j], RY[j]);
        }
        ctx.stroke();
        // 유리 띠: 한 칸씩 건너, 앞뒤 링이 다 보일 때만
        var cur = all ? { x: Array.prototype.slice.call(RX), y: Array.prototype.slice.call(RY), n: rt.n } : null;
        if (cur && prev && Math.abs(cur.n - prev.n) === 1 && (Math.min(cur.n, prev.n) % 2 === 0)) {
          ctx.fillStyle = 'rgba(60,150,230,' + (0.045 * a).toFixed(3) + ')';
          ctx.beginPath();
          [prev, cur].forEach(function (rg) {
            ctx.moveTo(rg.x[0], rg.y[0]);
            for (var b = 1; b < RING_SEGS; b++) ctx.lineTo(rg.x[b], rg.y[b]);
            ctx.closePath();
          });
          ctx.fill('evenodd');
        }
        prev = cur;
      });
      // 방사선: 통로를 따라 길게 (갈래의 안쪽 벽은 두 갈래가 겹치는 갈라짐 자리를 비움)
      ctx.strokeStyle = 'rgba(80,200,230,' + (0.16 * cor.alpha).toFixed(3) + ')';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      var samples = cor.samples || cor.ts.map(function (r) { return r.t; });
      for (var sp = 0; sp < RING_SEGS; sp += 2) {
        var open = false;
        var innerWall = cor.branch && RCOS[sp] * cor.outer < -0.3;   // 다른 갈래를 마주 보는 쪽 벽
        for (var si2 = 0; si2 < samples.length; si2++) {
          var tq = samples[si2];
          if (innerWall && tq < cor.crotch) { open = false; continue; }   // 두 갈래가 겹치는 자리
          var qq = cor.at(tq), px = qq.x + qq.az * RCOS[sp], pz = qq.z - qq.ax * RCOS[sp];
          var zq = worldToCamZ(px, pz);
          if (zq > FAR + 2 || !project(px, RSIN[sp], pz)) { open = false; continue; }
          if (!open) { ctx.moveTo(P.x, P.y); open = true; } else ctx.lineTo(P.x, P.y);
        }
      }
      ctx.stroke();
    });

    // 3-1) 갈라지는 곳의 방향 표시: 고른 쪽을 가리키는 노란 화살표(>>>)가 그쪽으로 흐름
    if (br && Math.abs(c.yaw) < branchTheta() * 0.7) {
      var flow = (S.clock / 600) % 1, wz = br.jz + branchTable().crotchZ;
      var appear2 = clamp((camz + FAR - br.jz) / 8, 0, 1) * clamp(1 - Math.abs(c.yaw) / (branchTheta() * 0.7), 0, 1);
      for (var ch = 0; ch < 4; ch++) {
        var ph2 = (ch + flow) / 4;
        var xm = br.dir * (-0.5 + ph2 * 1.0);
        var ca2 = appear2 * Math.sin(Math.PI * ph2);
        if (ca2 < 0.02) continue;
        var ok1 = project(xm - br.dir * 0.11, -0.24, wz), ax2 = P.x, ay2 = P.y, zc2 = P.z;
        var ok2 = ok1 && project(xm + br.dir * 0.11, 0, wz), bx2 = P.x, by2 = P.y;
        var ok3 = ok2 && project(xm - br.dir * 0.11, 0.24, wz);
        if (!ok3) continue;
        ctx.strokeStyle = 'rgba(255,213,74,' + (0.9 * ca2).toFixed(3) + ')';
        ctx.lineWidth = Math.max(1.5, 7 / zc2) * dpr;
        ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(ax2, ay2); ctx.lineTo(bx2, by2); ctx.lineTo(P.x, P.y); ctx.stroke();
      }
    }

    // 4) 빛줄기: 지금 달리는 통로의 벽을 스쳐 지나감 (빠를수록 꼬리가 김)
    var len = 0.2 + S.speed * 0.08;
    // 보이는 빛줄기 수: 평소 속도면 STREAK_COUNT_CRUISE, 가속할수록 STREAK_COUNT 까지 (경계의 것은 반투명이라 서서히 늘고 줆)
    var sb = clamp((S.speed - CONFIG.CRUISE_SPEED) / (boostSpeed() - CONFIG.CRUISE_SPEED), 0, 1);
    var nVis = (S.reduced ? 10 : CONFIG.STREAK_COUNT_CRUISE) + (S.streaks.length - (S.reduced ? 10 : CONFIG.STREAK_COUNT_CRUISE)) * sb;
    for (var ti = 0; ti < S.streaks.length && ti < nVis; ti++) {
      var st = S.streaks[ti], p0 = streakPos(st, 0);
      if (!project(p0.x, p0.y, p0.z)) continue;
      var z1s = P.z;
      if (z1s > FAR) continue;
      var la = fade(z1s) * (0.45 + 0.55 * pace) * Math.min(1, nVis - ti);
      ctx.strokeStyle = st.warm ? 'rgba(255,215,120,' + la.toFixed(3) + ')' : 'rgba(170,240,255,' + la.toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, 3.2 / z1s) * dpr;
      ctx.beginPath(); ctx.moveTo(P.x, P.y);
      for (var sg = 1; sg <= 4; sg++) {   // 터널을 따라 4토막으로 나눠 그림 → 곡선 구간에선 함께 휨
        var pp = streakPos(st, len * sg / 4);
        if (!project(pp.x, pp.y, pp.z)) break;
        ctx.lineTo(P.x, P.y);
      }
      ctx.stroke();
    }

    // 5) 터널 끝 빛
    lights.forEach(function (L) {
      var lr = Math.max(4 * dpr, minS * S.light);
      if (L.exit) {
        // 출구: 실제 크기(세계 고정)라 다가올수록 원근으로 자연스럽게 커짐. 둘레 빛 + 터널 지름만 한 밝은 구멍
        lr = EXIT_HALO * K / L.zc;
        var dr = 1.0 * K / L.zc;                                             // 터널 반지름 = 출구 구멍
        var near = clamp((S.exit.d0 - L.zc) / (S.exit.d0 * 0.6), 0, 1);      // 다가올수록 구멍이 또렷해짐
        if (near > 0) {
          var hole = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, dr);
          hole.addColorStop(0, 'rgba(255,253,244,' + (0.8 * near).toFixed(3) + ')');
          hole.addColorStop(0.85, 'rgba(255,246,220,' + (0.7 * near).toFixed(3) + ')');
          hole.addColorStop(1, 'rgba(255,236,190,0)');
          ctx.fillStyle = hole;
          ctx.beginPath(); ctx.arc(L.x, L.y, dr, 0, TAU); ctx.fill();
        }
      }
      var g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, lr);
      g.addColorStop(0, 'rgba(255,252,236,' + (0.72 * L.a).toFixed(3) + ')');
      g.addColorStop(0.25, 'rgba(255,234,165,' + (0.38 * L.a).toFixed(3) + ')');
      g.addColorStop(0.6, 'rgba(255,213,74,' + (0.1 * L.a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,213,74,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(L.x, L.y, lr, 0, TAU); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 6) 가장자리만 아주 살짝 어둡게 (글자가 잘 보이게)
    var vig = ctx.createRadialGradient(W / 2, H / 2, big * 0.4, W / 2, H / 2, big * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------------- 정리 ---------------- */
  function destroyGame() {
    if (!S) return;
    bgmDuck(false);
    if (S.raf) cancelAnimationFrame(S.raf);
    S.timers.length = 0;
    S.listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    if (S.ro) S.ro.disconnect();
    if (S.els && S.els.root.parentNode) S.els.root.parentNode.removeChild(S.els.root);
    S = null;
  }
  function destroyReveal() {
    if (!R) return;
    R.timeouts.forEach(clearTimeout);
    unlockInput();
    R = null;
  }
  function destroy() { destroyGame(); destroyReveal(); }

  /* =====================================================================
     타임라인 공개 연출: 2초 뒤 "?" 카드가 한꺼번에 뒤집혀 실제 카드가 나타남.
     연출이 끝날 때까지 모든 입력을 막는다.
     ===================================================================== */
  var lockEl = null;
  var LOCK_EVENTS = ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchmove', 'touchend', 'wheel', 'contextmenu'];
  function blockEvent(e) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
  function lockInput() {
    if (lockEl) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    lockEl = el('div', 'th-lock');
    lockEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(lockEl);
    LOCK_EVENTS.forEach(function (t) { window.addEventListener(t, blockEvent, { capture: true, passive: false }); });
  }
  function unlockInput() {
    if (!lockEl) return;
    LOCK_EVENTS.forEach(function (t) { window.removeEventListener(t, blockEvent, { capture: true, passive: false }); });
    if (lockEl.parentNode) lockEl.parentNode.removeChild(lockEl);
    lockEl = null;
  }

  function reveal(container, cardIds, opts) {
    if (!container) return;
    destroyReveal();
    opts = opts || {};
    if (typeof opts.assetBase === 'string') CONFIG.ASSET_BASE = opts.assetBase;   // mount 없이 부를 때를 위해
    R = { timeouts: [] };
    var reduced = reducedMotion();
    var row = el('div', 'th-tl' + (reduced ? ' th-reduced' : ''));
    var flips = [];
    (cardIds || []).forEach(function (id) {
      if (!CARDS[id]) return;
      var item = el('div', 'th-tl-item');
      if (CARDS[id].open) {
        item.appendChild(openCardEl(id));
      } else {
        var inner = el('div', 'th-flip-inner');
        var front = el('div', 'th-face th-face-front');
        front.appendChild(hiddenCardEl());
        var back = el('div', 'th-face th-face-back');
        back.setAttribute('aria-hidden', 'true');
        inner.appendChild(front);
        inner.appendChild(back);
        item.appendChild(inner);
        flips.push({ id: id, inner: inner, back: back, front: front });
      }
      row.appendChild(item);
    });
    container.textContent = '';
    container.appendChild(row);
    lockInput();

    R.timeouts.push(setTimeout(function () {
      // 뒤집기 직전에야 실제 카드 내용을 넣음 (미리 decode 해 둔 이미지 사용)
      flips.forEach(function (fp) {
        fp.back.appendChild(openCardEl(fp.id));
        fp.back.removeAttribute('aria-hidden');
        fp.front.setAttribute('aria-hidden', 'true');
        if (!reduced) fp.inner.classList.add('th-will');
      });
      void row.offsetWidth;
      row.classList.add('th-flipped');
      R.timeouts.push(setTimeout(function () {
        flips.forEach(function (fp) { fp.inner.classList.remove('th-will'); });
        unlockInput();
        var cb = opts.onDone;
        R = null;
        if (typeof cb === 'function') cb();
      }, CONFIG.FLIP_MS + 80));
    }, CONFIG.REVEAL_DELAY_MS));
  }

  // 일시정지·이어하기 (앱의 설정 창이 열리고 닫힐 때 부름). 타임 홀이 없을 때 불러도 아무 일 없음
  function pause() {
    if (!S) return;
    S.paused = true; S.els.root.classList.add('th-paused');
    S.pausedAnims = (S.els.root.getAnimations ? S.els.root.getAnimations({ subtree: true }) : []).filter(function (a) { return a.playState === 'running'; });
    S.pausedAnims.forEach(function (a) { try { a.pause(); } catch (_) { /* 멈추지 못해도 계속 */ } });   // 카드 날기·글리치 같은 연출도 같이 멈춤
  }
  function resume() {
    if (!S) return;
    S.paused = false; S.lastT = 0; S.reduced = reducedMotion(); S.els.root.classList.remove('th-paused');
    (S.pausedAnims || []).forEach(function (a) { try { a.play(); } catch (_) { /* 이어 가지 못해도 계속 */ } });
    S.pausedAnims = [];
  }

  function refit() { if (S) resize(); }   // 앱이 무대 크기(축소 비율)를 바꿨을 때 부름

  window.TimeHole = { mount: mount, start: start, destroy: destroy, reveal: reveal, pause: pause, resume: resume, refit: refit };
})();
