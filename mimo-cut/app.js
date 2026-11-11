(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
  const mmss = (s) => `${pad2(s / 60)}:${pad2(s % 60)}`;

  // 작품 목록. 영문판은 이 목록과 index.html의 글만 바꾸면 된다.
  // bg·ink: 재생 막대가 이 작품에 들어서면 화면 전체가 이 색으로 바뀐다.
  const WORKS = [
    { id: 'burger', lines: ['한입의', '상상'], client: '버거스테이지', cat: '음식 · 제품 광고', secs: 15, bg: '#FFC21A', ink: '#1A1200', alt: '통새우와 채소가 층층이 쌓인 버거' },
    { id: 'andz', lines: ['새로운', '시즌의', '시작'], client: 'ANDZ', cat: '패션 · 스토어 오픈', secs: 26, bg: '#DAD3C8', ink: '#1E1B17', alt: '가을 햇빛 속 정장을 입은 ANDZ 모델' },
    { id: 'bakery', lines: ['빵이', '건네는', '온기'], client: '밤가시베이커리', cat: '베이커리 · 브랜드 영상', secs: 17, bg: '#6B3F1D', ink: '#FFE9C9', alt: '창가의 햇빛 아래 놓인 밤가시베이커리 빵' },
    { id: 'book', lines: ['책에서,', '일상으로'], client: '오라이프밸런스', cat: '협업 브랜드 · 도서 소개', secs: 49, bg: '#0C3A40', ink: '#E8D9A8', alt: '오라이프밸런스 도서 소개 영상의 한 장면' },
    { id: 'wuxia', lines: ['상상이', '장면이', '될 때'], client: '창작 콘셉트', cat: '무협 · 스토리 영상', secs: 39, bg: '#A4121F', ink: '#FFE6E0', alt: '무협 세계를 표현한 창작 영상의 한 장면' },
  ];
  const N = WORKS.length;
  const TOTAL = WORKS.reduce((s, w) => s + w.secs, 0); // 다섯 편 길이의 합 = 146초
  const FPS = 24;

  /* ───── 작업물 구간 만들기 ───── */
  const clipsEl = $('#clips');
  const clips = WORKS.map((w, i) => {
    const title = w.lines.join(' ');
    const el = document.createElement('section');
    el.className = 'clip seg';
    el.id = `clip-${i + 1}`;
    Object.assign(el.dataset, { label: pad2(i + 1), name: `${pad2(i + 1)} · ${title}`, bg: w.bg, ink: w.ink, c: w.bg, t: w.ink });
    el.setAttribute('aria-label', title);
    el.innerHTML = `
      <div class="clip-head">
        <p class="mono tag">CLIP ${pad2(i + 1)} / ${pad2(N)} · ${w.id}.mp4</p>
        <h2 aria-label="${title}">${w.lines.map((l) => `<span aria-hidden="true"><b>${l}</b></span>`).join('')}</h2>
      </div>
      <div class="viewer">
        <img src="assets/${w.id}.webp" alt="${w.alt}" width="540" height="960" loading="lazy">
        <video muted loop playsinline preload="none"></video>
        <div class="viewer-foot mono"><span class="vt">00:00</span><span>${mmss(w.secs)}</span></div>
        <div class="viewer-prog"><i></i></div>
      </div>
      <div class="clip-side">
        <dl class="spec"><dt>CLIENT</dt><dd>${w.client}</dd><dt>TYPE</dt><dd>${w.cat}</dd><dt>FORMAT</dt><dd>9:16 세로 · ${mmss(w.secs)}</dd></dl>
        <button class="btn snd" aria-pressed="false">소리 켜고 보기</button>
      </div>`;
    clipsEl.appendChild(el);
    const video = $('video', el), vt = $('.vt', el), bar = $('.viewer-prog i', el), snd = $('.snd', el);
    video.addEventListener('timeupdate', () => {
      vt.textContent = mmss(video.currentTime);
      if (video.duration) bar.style.transform = `scaleX(${video.currentTime / video.duration})`;
    });
    snd.addEventListener('click', () => {
      const on = video.muted;
      video.muted = !on;
      if (on) { video.currentTime = 0; play(i); }
      snd.textContent = on ? '소리 끄기' : '소리 켜고 보기';
      snd.setAttribute('aria-pressed', on);
    });
    return { el, video, snd };
  });
  let playing = -1;
  function play(i) {
    clips.forEach((c, k) => {
      if (k === i) return;
      c.video.pause();
      if (!c.video.muted) { c.video.muted = true; c.snd.textContent = '소리 켜고 보기'; c.snd.setAttribute('aria-pressed', false); }
    });
    playing = i;
    if (i < 0 || RM) return;
    const v = clips[i].video;
    if (!v.getAttribute('src')) v.src = `assets/${WORKS[i].id}.mp4`;
    const p = v.play();
    if (p) p.then(() => v.classList.add('is-playing')).catch(() => {});
  }

  /* ───── 인트로: 컷이 넘어가는 미리보기 ───── */
  const monitor = $('#monitor');
  const cutsEl = $('#cuts');
  const shots = WORKS.map((w, i) => {
    const img = document.createElement('img');
    img.src = `assets/${w.id}.webp`; img.alt = ''; img.width = 540; img.height = 960;
    monitor.prepend(img);
    const seg = document.createElement('i');
    seg.style.setProperty('--c', w.bg);
    cutsEl.appendChild(seg);
    return { img, seg };
  });
  let shot = -1, shotTimer = 0;
  function cut(i) {
    shot = i;
    shots.forEach((s, k) => {
      s.img.classList.remove('is-on');
      s.seg.classList.remove('is-on');
      s.seg.classList.toggle('is-done', k < i);
    });
    void monitor.offsetWidth; // 같은 컷이 다시 와도 움직임을 처음부터
    shots[i].img.classList.add('is-on');
    shots[i].seg.classList.add('is-on');
    $('#monitor-file').textContent = `${WORKS[i].id}.mp4`;
    $('#monitor-cap').textContent = WORKS[i].lines.join(' ');
  }
  cut(0);
  function montage(on) {
    clearInterval(shotTimer);
    if (on && !RM) shotTimer = setInterval(() => cut((shot + 1) % N), 1900);
  }

  /* ───── 타임라인 ───── */
  const segs = $$('.seg');
  const track = $('#track');
  const playhead = $('#playhead');
  const tc = $('#tc');
  const dockName = $('#dock-name');
  const themeMeta = $('meta[name=theme-color]');
  const marks = segs.map((seg) => {
    const a = document.createElement('a');
    a.href = `#${seg.id}`;
    a.textContent = seg.dataset.label;
    a.setAttribute('aria-label', seg.dataset.name || seg.dataset.label);
    if (seg.dataset.c) { a.style.setProperty('--c', seg.dataset.c); a.style.setProperty('--t', seg.dataset.t); }
    a.addEventListener('click', (e) => { if (e.detail !== 0) e.preventDefault(); }); // 손가락·마우스는 아래 '밀기'가 처리
    track.appendChild(a);
    return a;
  });
  let max = 1, bounds = [], current = -1;
  function measure() {
    const vh = innerHeight;
    max = Math.max(1, document.documentElement.scrollHeight - vh);
    const tops = segs.map((s) => s.getBoundingClientRect().top + scrollY);
    bounds = segs.map((s, i) => {
      const a = i === 0 ? 0 : clamp((tops[i] - vh / 2) / max);
      const b = i === segs.length - 1 ? 1 : clamp((tops[i + 1] - vh / 2) / max);
      marks[i].style.left = `${a * 100}%`;
      marks[i].style.width = `calc(${(b - a) * 100}% - 2px)`;
      return [a, b];
    });
    update();
  }
  function setCurrent(i) {
    current = i;
    const seg = segs[i];
    document.body.style.setProperty('--bg', seg.dataset.bg);
    document.body.style.setProperty('--ink', seg.dataset.ink);
    themeMeta.content = seg.dataset.bg;
    dockName.textContent = seg.dataset.name || seg.dataset.label;
    marks.forEach((m, k) => m.classList.toggle('is-on', k === i));
    const ci = clips.findIndex((c) => c.el === seg);
    if (ci !== playing) play(ci);
    montage(i === 0);
  }

  const subs = $$('#subs li');
  const noteEl = $('#note');
  let subOn = -1, ticking = false;
  function update() {
    ticking = false;
    const p = clamp(scrollY / max);
    playhead.style.transform = `translate3d(${p * track.clientWidth}px,0,0)`;
    const t = p * TOTAL;
    tc.textContent = `00:${pad2(t / 60)}:${pad2(t % 60)}:${pad2((t % 1) * FPS)}`;
    let i = bounds.findIndex(([a, b]) => p >= a && p < b);
    if (i < 0) i = segs.length - 1;
    if (i !== current) setCurrent(i);

    // 자막 트랙: 화면 가운데에 가장 가까운 한 줄만 밝게
    const nr = noteEl.getBoundingClientRect();
    if (nr.bottom > 0 && nr.top < innerHeight) {
      const mid = innerHeight * 0.46;
      let best = 0, bestD = Infinity;
      subs.forEach((li, k) => {
        const r = li.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = k; }
      });
      if (best !== subOn) { subOn = best; subs.forEach((li, k) => li.classList.toggle('is-on', k === best)); }
    }
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure);
  new ResizeObserver(measure).observe($('#main'));
  measure();

  // 타임라인 밀기: 손가락·마우스가 있는 자리로 재생 막대와 화면이 같이 간다.
  let scrubbing = false;
  const scrubTo = (e) => {
    const r = track.getBoundingClientRect();
    scrollTo({ top: clamp((e.clientX - r.left) / r.width) * max, behavior: 'instant' });
  };
  track.addEventListener('pointerdown', (e) => { scrubbing = true; track.setPointerCapture(e.pointerId); scrubTo(e); });
  track.addEventListener('pointermove', (e) => { if (scrubbing) scrubTo(e); });
  const scrubEnd = () => { scrubbing = false; };
  track.addEventListener('pointerup', scrubEnd);
  track.addEventListener('pointercancel', scrubEnd);

  /* ───── 등장 ───── */
  $$('#blocks li').forEach((li, i) => li.style.setProperty('--i', i));
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    io.unobserve(en.target);
  }), { threshold: 0.3 });
  $$('.reveal,.clip,#blocks').forEach((el) => io.observe(el));

  /* ───── 미모 소개 영상 ───── */
  const mimo = $('#mimo-video');
  const mimoBtns = $$('.stage-btns button');
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
    if (!en.isIntersecting) return mimo.pause();
    if (!mimo.getAttribute('src')) mimoIdle(); else if (!RM) mimo.play().catch(() => {});
  }, { threshold: 0.25 }).observe(mimo);

  /* ───── 문의 내용 만들기 (전송하지 않고 정리·복사만) ───── */
  const brief = $('#brief');
  const render = $('#render');
  const out = $('#brief-out');
  const outText = $('#brief-output');
  brief.addEventListener('submit', (e) => {
    e.preventDefault();
    const story = brief.story;
    if (!story.value.trim()) { story.focus(); story.reportValidity(); return; }
    const lines = ['[MIMO 제작 문의]', `필요한 작업: ${brief.service.value}`, `가게와 만들고 싶은 이야기: ${story.value.trim()}`];
    if (brief.channel.value.trim()) lines.push(`사용할 곳: ${brief.channel.value.trim()}`);
    if (brief.deadline.value.trim()) lines.push(`희망 일정: ${brief.deadline.value.trim()}`);
    outText.value = lines.join('\n');
    const done = () => { render.hidden = true; out.hidden = false; outText.focus(); };
    if (RM) return done();
    out.hidden = true; render.hidden = false;
    const fill = $('i', render), pct = $('#render-pct');
    const t0 = performance.now();
    (function step(t) {
      const k = clamp((t - t0) / 900);
      fill.style.transform = `scaleX(${k})`;
      pct.textContent = `${Math.round(k * 100)}%`;
      if (k < 1) requestAnimationFrame(step); else setTimeout(done, 150);
    })(t0);
  });
  $('#brief-copy').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(outText.value); }
    catch (err) { outText.select(); document.execCommand('copy'); }
    btn.textContent = '복사했어요';
    setTimeout(() => { btn.textContent = '문의 내용 복사'; }, 2000);
  });
})();
