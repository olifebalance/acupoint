(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // 작품 목록. 영문판을 만들 때는 이 목록과 index.html의 글만 바꾸면 된다.
  const WORKS = [
    { id: 'burger', title: '한입의 상상', client: '버거스테이지', cat: '음식 · 제품 광고', len: '00:15', color: '#FFB23E', alt: '통새우와 채소가 층층이 쌓인 버거' },
    { id: 'andz', title: '새로운 시즌의 시작', client: 'ANDZ', cat: '패션 · 스토어 오픈', len: '00:26', color: '#E8975A', alt: '가을 햇빛 속 정장을 입은 ANDZ 모델' },
    { id: 'bakery', title: '빵이 건네는 온기', client: '밤가시베이커리', cat: '베이커리 · 브랜드 영상', len: '00:17', color: '#F2CF85', alt: '창가의 햇빛 아래 놓인 밤가시베이커리 빵' },
    { id: 'book', title: '책에서, 일상으로', client: '오라이프밸런스', cat: '협업 브랜드 · 도서 소개', len: '00:49', color: '#4FD1C1', alt: '오라이프밸런스 도서 소개 영상의 한 장면' },
    { id: 'wuxia', title: '상상이 장면이 될 때', client: '창작 콘셉트', cat: '무협 · 스토리 영상', len: '00:39', color: '#FF4D5E', alt: '무협 세계를 표현한 창작 영상의 한 장면' },
  ];
  const N = WORKS.length;
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>';
  const pad2 = (n) => String(n).padStart(2, '0');

  // 글자 쪼개기: 단어는 줄바꿈 단위로 묶고, 글자마다 순서 번호를 준다.
  function split(el) {
    const text = el.textContent.trim();
    let i = 0;
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(' ').map((word) =>
      `<span class="w" aria-hidden="true">${[...word].map((ch) => `<span class="c" style="--i:${i++}">${ch}</span>`).join('')}</span>`
    ).join(' ');
  }

  // 영상 하나만 재생하고 나머지는 멈춘다. (폰 발열·데이터 아끼기)
  function playOnly(videos, idx, srcOf) {
    videos.forEach((v, i) => {
      if (i === idx) return;
      v.pause();
      v.classList.remove('is-playing');
    });
    const v = videos[idx];
    if (!v || RM) return;
    if (!v.getAttribute('src')) v.src = srcOf(idx);
    const p = v.play();
    if (p) p.then(() => v.classList.add('is-playing')).catch(() => {});
  }

  /* ───────── 로더 ───────── */
  const loader = $('.loader');
  const ready = () => root.classList.add('is-ready');
  if (RM || root.classList.contains('seen')) {
    requestAnimationFrame(ready);
  } else {
    const num = $('#loader-num');
    const t0 = performance.now();
    const DUR = 1100;
    (function count(t) {
      const k = clamp((t - t0) / DUR);
      num.textContent = Math.round(easeOut(k) * 100);
      if (k < 1) return requestAnimationFrame(count);
      loader.classList.add('is-done');
      setTimeout(ready, 250);
      setTimeout(() => loader.remove(), 1200);
      try { sessionStorage.setItem('mimo-seen', '1'); } catch (e) {}
    })(t0);
  }

  /* ───────── 히어로: 바뀌는 단어 ───────── */
  const rot = $('.rot');
  const rotWords = $$('.rot-word', rot);
  let rotIdx = 0;
  const rotFit = () => { rot.style.width = rotWords[rotIdx].offsetWidth + 'px'; };
  rotFit();
  if (document.fonts) document.fonts.ready.then(rotFit);
  addEventListener('resize', rotFit);
  if (!RM) setInterval(() => {
    if (document.hidden) return;
    const prev = rotWords[rotIdx];
    rotIdx = (rotIdx + 1) % rotWords.length;
    prev.classList.remove('is-on');
    prev.classList.add('is-out');
    rotWords[rotIdx].classList.add('is-on');
    rotFit();
    setTimeout(() => {
      prev.style.transition = 'none';
      prev.classList.remove('is-out');
      void prev.offsetWidth;
      prev.style.transition = '';
    }, 750);
  }, 2600);

  /* ───────── 히어로: 작품 카드 덱 ───────── */
  const deck = $('#deck');
  const cards = WORKS.map((w, i) => {
    const el = document.createElement('button');
    el.className = 'deck-card';
    el.style.setProperty('--c', w.color);
    el.setAttribute('aria-label', `${w.title} — ${w.client}`);
    el.innerHTML = `<img src="assets/${w.id}.webp" alt="" width="540" height="960" draggable="false"><video muted loop playsinline preload="none"></video><span class="badge">${w.len}</span><span class="play">${PLAY}</span>`;
    deck.appendChild(el);
    return el;
  });
  const deckVideos = cards.map((c) => $('video', c));
  const deckTitle = $('#deck-title');
  const deckClient = $('#deck-client');
  let cur = 0, target = 0, active = -1, drag = null, deckOn = true, deckRaf = 0;
  let lastAuto = performance.now(), deckHover = false, playerOpen = false, activeTimer = 0;
  const STEP = 0.64;

  function deckLayout() {
    const cw = cards[0].offsetWidth;
    cards.forEach((el, i) => {
      let d = (((i - cur) % N) + N) % N;
      if (d > N / 2) d -= N;
      const a = Math.abs(d);
      el.style.transform = `translate3d(${d * cw * STEP}px,0,${-a * 130}px) rotateY(${d * -22}deg) scale(${1 - a * 0.06})`;
      el.style.opacity = clamp(1.6 - a * 0.64);
      el.style.zIndex = 100 - Math.round(a * 10);
    });
  }
  function deckActive(a) {
    active = a;
    const w = WORKS[a];
    cards.forEach((c, i) => c.classList.toggle('is-active', i === a));
    root.style.setProperty('--glow', w.color);
    deckTitle.textContent = w.title;
    deckClient.textContent = `${w.client} · ${w.cat}`;
    clearTimeout(activeTimer);
    deckVideos.forEach((v) => { v.pause(); v.classList.remove('is-playing'); });
    activeTimer = setTimeout(() => {
      if (active === a && deckOn && !playerOpen) playOnly(deckVideos, a, (i) => `assets/${WORKS[i].id}.mp4`);
    }, 420);
  }
  function deckTick(t) {
    if (!drag && !RM && !deckHover && !playerOpen && !document.hidden && t - lastAuto > 4200) {
      target = Math.round(target) + 1;
      lastAuto = t;
    }
    cur += (target - cur) * (drag ? 0.4 : 0.1);
    deckLayout();
    const a = ((Math.round(cur) % N) + N) % N;
    if (a !== active) deckActive(a);
    deckRaf = deckOn ? requestAnimationFrame(deckTick) : 0;
  }
  const deckGo = (n) => { target = Math.round(target) + n; lastAuto = performance.now(); };
  $('#deck-prev').addEventListener('click', () => deckGo(-1));
  $('#deck-next').addEventListener('click', () => deckGo(1));
  deck.addEventListener('pointerenter', () => { deckHover = true; });
  deck.addEventListener('pointerleave', () => { deckHover = false; lastAuto = performance.now(); });
  deck.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    drag = { x: e.clientX, start: target, moved: 0, lastX: e.clientX, lastT: e.timeStamp, v: 0, id: e.pointerId };
  });
  addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    if (drag.moved > 6) deck.classList.add('is-drag');
    const cw = cards[0].offsetWidth * STEP;
    target = drag.start - dx / cw;
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.v = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX; drag.lastT = e.timeStamp;
  });
  const dragEnd = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    deck.classList.remove('is-drag');
    lastAuto = performance.now();
    if (d.moved <= 6 && e.type === 'pointerup') {
      const card = document.elementFromPoint(e.clientX, e.clientY)?.closest('.deck-card');
      const i = cards.indexOf(card);
      if (i < 0) return;
      if (i === active) return openPlayer(i);
      let diff = (((i - Math.round(cur)) % N) + N) % N;
      if (diff > N / 2) diff -= N;
      target = Math.round(cur) + diff;
      return;
    }
    target = Math.round(target - clamp(d.v * 0.35, -1, 1));
  };
  addEventListener('pointerup', dragEnd);
  addEventListener('pointercancel', dragEnd);
  cards.forEach((c, i) => c.addEventListener('click', (e) => {
    if (e.detail !== 0) return; // 키보드로 누른 경우만 여기서 처리
    if (i === active) openPlayer(i); else deckGo(i - active);
  }));
  new IntersectionObserver(([en]) => {
    deckOn = en.isIntersecting;
    if (deckOn) { if (!deckRaf) { active = -1; deckRaf = requestAnimationFrame(deckTick); } }
    else deckVideos.forEach((v) => v.pause());
  }, { threshold: 0.15 }).observe($('.hero'));
  deckLayout();

  /* ───────── 마키 ───────── */
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/></svg>';
  const WORDS = ['광고 영상', '상세페이지', '스토어 사진', '메뉴판', '릴스', '브랜드 콘텐츠'];
  const rows = $$('.marquee-row').map((row, r) => {
    const track = $('.marquee-track', row);
    const list = r ? [...WORDS].reverse() : WORDS;
    const set = list.map((w) => `<span>${w}${STAR}</span>`).join('');
    track.innerHTML = set + set + set + set;
    return { track, dir: +row.dataset.dir, x: 0, half: 0 };
  });
  let marqueeOn = false, marqueeRaf = 0, scrollVel = 0;
  const marqueeMeasure = () => rows.forEach((r) => { r.half = r.track.scrollWidth / 4; });
  function marqueeTick() {
    scrollVel *= 0.9;
    rows.forEach((r) => {
      if (!r.half) return;
      r.x += r.dir * (0.7 + Math.abs(scrollVel) * 0.12);
      r.x = ((r.x % r.half) + r.half) % r.half;
      r.track.style.transform = `translate3d(${-r.x}px,0,0) skewX(${clamp(scrollVel * -0.12, -8, 8)}deg)`;
    });
    marqueeRaf = marqueeOn ? requestAnimationFrame(marqueeTick) : 0;
  }
  marqueeMeasure();
  if (document.fonts) document.fonts.ready.then(marqueeMeasure);
  addEventListener('resize', marqueeMeasure);
  if (!RM) new IntersectionObserver(([en]) => {
    marqueeOn = en.isIntersecting;
    if (marqueeOn && !marqueeRaf) marqueeRaf = requestAnimationFrame(marqueeTick);
  }).observe($('.marquee'));

  /* ───────── 작업물 장면 ───────── */
  const scenesEl = $('#scenes');
  const scenes = WORKS.map((w, i) => {
    const el = document.createElement('article');
    el.className = 'scene';
    el.dataset.t = i % 5;
    el.style.setProperty('--c', w.color);
    el.innerHTML = `
      <div class="scene-inner">
        <span class="scene-ghost" aria-hidden="true">${pad2(i + 1)}</span>
        <div class="scene-card" data-cursor="재생" role="button" tabindex="0" aria-label="${w.title} 영상을 소리와 함께 보기">
          <img src="assets/${w.id}.webp" alt="${w.alt}" width="540" height="960" loading="lazy">
          <video muted loop playsinline preload="none"></video>
          <span class="len">${w.len}</span>
        </div>
        <div class="scene-text">
          <p class="scene-idx"><b>${pad2(i + 1)}</b> / ${pad2(N)}</p>
          <h3>${w.title}</h3>
          <p class="scene-info"><b>${w.client}</b>${w.cat}</p>
          <button class="scene-btn"><i>${PLAY}</i>소리와 함께 보기</button>
        </div>
      </div>`;
    scenesEl.appendChild(el);
    split($('h3', el));
    const open = () => openPlayer(i);
    $('.scene-card', el).addEventListener('click', open);
    $('.scene-card', el).addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    $('.scene-btn', el).addEventListener('click', open);
    return { el, video: $('video', el), p: -1, o: -1, on: false };
  });
  const sceneVideos = scenes.map((s) => s.video);
  let sceneActive = -1;

  /* ───────── 영상 보기 창 ───────── */
  const player = $('#player');
  const playerVideo = $('#player-video');
  function openPlayer(i) {
    const w = WORKS[i];
    playerOpen = true;
    [...deckVideos, ...sceneVideos].forEach((v) => v.pause());
    $('#player-title').textContent = w.title;
    $('#player-client').textContent = `${w.client} · ${w.cat}`;
    playerVideo.poster = `assets/${w.id}.webp`;
    playerVideo.src = `assets/${w.id}.mp4`;
    player.showModal();
    playerVideo.play().catch(() => {});
  }
  player.addEventListener('close', () => {
    playerVideo.pause();
    playerVideo.removeAttribute('src');
    playerVideo.load();
    playerOpen = false;
    active = -1; sceneActive = -1;
    lastAuto = performance.now();
    update();
  });
  $('#player-close').addEventListener('click', () => player.close());
  player.addEventListener('click', (e) => { if (e.target === player) player.close(); });

  /* ───────── 스크롤에 따라 바뀌는 것들 ───────── */
  const bar = $('.progress i');
  const nav = $('.nav');
  const soloText = $('#solo-text');
  const steps = $('#steps');
  const stepItems = $$('li', steps);
  let lastY = scrollY, ticking = false;

  // 1인 스튜디오 문단: 단어마다 감싸서 스크롤하면 차례로 밝아지게 한다.
  (function wrapWords(node) {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part.trim()) return frag.appendChild(document.createTextNode(part));
          const s = document.createElement('span');
          s.className = 'sw';
          s.textContent = part;
          frag.appendChild(s);
        });
        n.replaceWith(frag);
      } else wrapWords(n);
    });
  })(soloText);
  const soloWords = $$('.sw', soloText);
  let soloLit = -1;

  function update() {
    ticking = false;
    const y = scrollY, vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle('is-solid', y > 40);
    nav.classList.toggle('is-hidden', y > 400 && y > lastY + 2);
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    scrollVel += (y - lastY) * 0.5;
    lastY = y;

    // 장면: s는 "몇 번째 장면까지 넘어왔나"
    const s = -scenesEl.getBoundingClientRect().top / vh;
    scenes.forEach((sc, i) => {
      const p = RM ? 1 : easeOut(clamp((clamp(s - (i - 1)) - 0.12) / 0.8));
      const o = i < N - 1 ? clamp(s - i) : 0;
      if (Math.abs(p - sc.p) > 0.002) { sc.p = p; sc.el.style.setProperty('--p', p.toFixed(3)); }
      if (Math.abs(o - sc.o) > 0.002) { sc.o = o; sc.el.style.setProperty('--o', o.toFixed(3)); }
      const on = p > 0.55;
      if (on !== sc.on) { sc.on = on; sc.el.classList.toggle('is-on', on); }
    });
    const a = s > -0.45 && s < N - 0.45 ? clamp(Math.round(s), 0, N - 1) : -1;
    if (a !== sceneActive && !playerOpen) {
      sceneActive = a;
      if (a < 0) sceneVideos.forEach((v) => v.pause());
      else playOnly(sceneVideos, a, (i) => `assets/${WORKS[i].id}.mp4`);
    }

    // 1인 스튜디오 문단
    const sr = soloText.getBoundingClientRect();
    const lit = RM ? soloWords.length : Math.floor(clamp((vh * 0.82 - sr.top) / (sr.height + vh * 0.3)) * soloWords.length * 1.12);
    if (lit !== soloLit) {
      soloLit = lit;
      soloWords.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
    }

    // 진행 순서 선
    const pr = steps.getBoundingClientRect();
    const wide = innerWidth >= 900;
    const prog = RM ? 1 : clamp((vh * 0.72 - pr.top) / (wide ? vh * 0.5 : pr.height));
    steps.style.setProperty('--prog', prog.toFixed(3));
    stepItems.forEach((li, i) => {
      const at = wide ? li.offsetLeft / steps.offsetWidth : li.offsetTop / steps.offsetHeight;
      li.classList.toggle('is-done', prog > at + 0.03 || (i === 0 && prog > 0.02));
    });
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();

  /* ───────── 등장 효과 ───────── */
  $$('[data-split]').forEach(split);
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    io.unobserve(en.target);
  }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  $$('[data-split],[data-reveal]').forEach((el) => io.observe(el));

  /* ───────── 서비스 카드: 빛이 손가락·마우스를 따라온다 ───────── */
  $$('.card').forEach((card) => card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));

  /* ───────── 마우스가 있는 기기에서만: 커서·자석 버튼 ───────── */
  if (FINE && !RM) {
    const cursor = $('.cursor');
    const dot = $('span', cursor);
    let cx = 0, cy = 0, tx = 0, ty = 0, moving = false;
    const follow = () => {
      cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22;
      cursor.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      if (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.3) requestAnimationFrame(follow); else moving = false;
    };
    addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      cursor.classList.add('is-on');
      const lab = e.target.closest?.('[data-cursor]');
      cursor.classList.toggle('is-label', !!lab);
      dot.textContent = lab ? lab.dataset.cursor : '';
      if (!moving) { moving = true; requestAnimationFrame(follow); }
    });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-on'));
    $$('.magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px,${(e.clientY - r.top - r.height / 2) * 0.32}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ───────── 미모 소개 영상 ───────── */
  const mimo = $('#mimo-video');
  const mimoBtns = $$('.about-actions button');
  const mimoIdle = () => {
    mimoBtns.forEach((b) => b.classList.remove('is-on'));
    mimo.muted = true; mimo.loop = true;
    mimo.src = 'assets/mimo-idle.mp4';
    if (!RM) mimo.play().catch(() => {});
  };
  mimoBtns.forEach((btn) => btn.addEventListener('click', () => {
    mimoBtns.forEach((b) => b.classList.toggle('is-on', b === btn));
    mimo.loop = false;
    mimo.muted = !btn.dataset.sound;
    mimo.src = `assets/mimo-${btn.dataset.clip}.mp4`;
    mimo.play().catch(() => {});
  }));
  mimo.addEventListener('ended', mimoIdle);
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { if (!mimo.getAttribute('src')) mimoIdle(); else if (!RM) mimo.play().catch(() => {}); }
    else mimo.pause();
  }, { threshold: 0.25 }).observe(mimo);

  /* ───────── 푸터: 글자 속 영상 ───────── */
  const vt = $('#vtext video');
  new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return vt.pause();
    if (RM) return;
    if (!vt.getAttribute('src')) vt.src = 'assets/dessert.mp4';
    vt.play().catch(() => {});
  }, { threshold: 0.1 }).observe(vt);

  /* ───────── 문의 내용 만들기 (전송하지 않고 정리·복사만) ───────── */
  const brief = $('#brief');
  const out = $('#brief-out');
  const outText = $('#brief-output');
  brief.addEventListener('submit', (e) => {
    e.preventDefault();
    const story = brief.story;
    if (!story.value.trim()) { story.focus(); story.reportValidity(); return; }
    const lines = [
      '[MIMO 제작 문의]',
      `필요한 작업: ${brief.service.value}`,
      `스토어와 만들고 싶은 이야기: ${story.value.trim()}`,
    ];
    if (brief.channel.value.trim()) lines.push(`사용할 곳: ${brief.channel.value.trim()}`);
    if (brief.deadline.value.trim()) lines.push(`희망 일정: ${brief.deadline.value.trim()}`);
    outText.value = lines.join('\n');
    out.hidden = false;
    outText.focus();
  });
  $('#brief-copy').addEventListener('click', async (e) => {
    const label = $('span', e.currentTarget);
    try { await navigator.clipboard.writeText(outText.value); }
    catch (err) { outText.select(); document.execCommand('copy'); }
    label.textContent = '복사했어요';
    setTimeout(() => { label.textContent = '문의 내용 복사'; }, 2000);
  });
})();
