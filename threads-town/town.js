// 스친 마을: 위에서 내려다보는 마을을 작은 손님이 걸어 다닌다.
// 가고 싶은 집을 누르면 길을 따라 걸어가고, 문 앞에 서면 소개 카드가 열린다.
(() => {
  const { HOUSES, DECOR, lightsOf } = window.TOWN_ART;
  const RESIDENTS = window.RESIDENTS;
  const $ = (s, r = document) => r.querySelector(s);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* ───── 마을 지도 ─────
     집은 모두 아래(남쪽)를 보고 선다. 집 앞 40 아래에 길이 지나간다.
     자리가 모자라면 SLOTS에 줄을 더하고 ROADS를 늘리면 마을이 바깥으로 커진다. */
  const COLS = 9, ROWS = 7, GX = 300, GY = 430, DX = 250, DY = 370, ROAD = 40;
  const W = 3150, H = 2850;
  const cx = (i) => GX + i * DX, cy = (j) => GY + j * DY;
  const MC = 4, MR = 3;                       // 미모 집: 가운데 칸
  const MIMO = [cx(MC), cy(MR)], PLAZA = [cx(MC), cy(MR - 1)], TEMPLE = [2800, 1510];
  const L_X = 170, R_X = 2430, V1 = 925, V2 = 1675;   // 세로 길
  // 길: [x1, y1, x2, y2] (가로 또는 세로 직선). 가운뎃줄 길은 동쪽 쉼터까지 이어진다.
  const ROADS = [];
  for (let j = 0; j < ROWS; j++) ROADS.push([L_X, cy(j) + ROAD, j === MR ? TEMPLE[0] : R_X, cy(j) + ROAD]);
  [L_X, V1, V2, R_X].forEach((x) => ROADS.push([x, cy(0) + ROAD, x, cy(ROWS - 1) + ROAD]));

  // 자리: 미모 집에서 가까운 칸부터 목록 순서대로 채운다 (같은 줄을 조금 더 가깝게 친다)
  const cells = [];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    if ((i === MC && j === MR) || (i === MC && j === MR - 1)) continue;
    cells.push({ slot: `r${j + 1}c${i + 1}`, x: cx(i), y: cy(j), name: `${j + 1}번길 ${i + 1}호`, d: Math.hypot(cx(i) - MIMO[0], (cy(j) - MIMO[1]) * 1.2) });
  }
  cells.sort((a, b) => a.d - b.d);
  const SLOT_NAME = { center: '한가운데', temple: '동쪽 쉼터' };
  const special = (house) => RESIDENTS.find((q) => q.house === house) || null;
  const others = RESIDENTS.filter((q) => q.house !== 'mimo' && q.house !== 'temple');
  const lots = [
    { slot: 'center', x: MIMO[0], y: MIMO[1], r: special('mimo'), door: [MIMO[0], MIMO[1] + ROAD], w: 280 },
    { slot: 'temple', x: TEMPLE[0], y: TEMPLE[1], r: special('temple'), door: [TEMPLE[0], cy(MR) + ROAD], w: 300 },
    ...cells.map((c, k) => { SLOT_NAME[c.slot] = c.name; return { slot: c.slot, x: c.x, y: c.y, r: others[k] || null, door: [c.x, c.y + ROAD], w: 200 }; }),
  ];

  /* ───── 길 그래프: 교차점과 문 앞을 점으로, 길을 따라 이웃한 점끼리 잇는다 ───── */
  const nodes = [], edges = [];
  const nodeAt = (x, y) => { let n = nodes.find((p) => Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1); if (!n) { n = { x, y, id: nodes.length, adj: [] }; nodes.push(n); } return n; };
  ROADS.forEach(([x1, y1, x2, y2]) => {
    const horiz = y1 === y2;
    const pts = [[x1, y1], [x2, y2]];
    ROADS.forEach(([a1, b1, a2, b2]) => { // 다른 길과 만나는 곳
      if (horiz && a1 === a2 && a1 >= x1 && a1 <= x2 && y1 >= b1 && y1 <= b2) pts.push([a1, y1]);
      if (!horiz && b1 === b2 && b1 >= y1 && b1 <= y2 && x1 >= a1 && x1 <= a2) pts.push([x1, b1]);
    });
    if (horiz) lots.forEach((l) => { if (l.door[1] === y1 && l.door[0] >= x1 && l.door[0] <= x2) pts.push(l.door); });
    const sorted = pts.map(([x, y]) => nodeAt(x, y)).sort((p, q) => (horiz ? p.x - q.x : p.y - q.y));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (a === b) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      a.adj.push([b, d]); b.adj.push([a, d]); edges.push([a, b]);
    }
  });
  const project = (px, py) => { // 가장 가까운 길 위의 점
    let best = null;
    edges.forEach(([a, b]) => {
      const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      const x = a.x + dx * t, y = a.y + dy * t, d = Math.hypot(px - x, py - y);
      if (!best || d < best.d) best = { x, y, d, a, b };
    });
    return best;
  };
  function route(from, to) { // 길을 따라가는 가장 짧은 경로 (점 목록)
    const s = project(from[0], from[1]), e = project(to[0], to[1]);
    if ((s.a === e.a && s.b === e.b) || (s.a === e.b && s.b === e.a)) return [[s.x, s.y], [e.x, e.y]];
    const dist = new Map(), prev = new Map(), todo = new Set(nodes);
    nodes.forEach((n) => dist.set(n, Infinity));
    [s.a, s.b].forEach((n) => dist.set(n, Math.hypot(n.x - s.x, n.y - s.y)));
    while (todo.size) {
      let u = null;
      todo.forEach((n) => { if (!u || dist.get(n) < dist.get(u)) u = n; });
      todo.delete(u);
      u.adj.forEach(([v, d]) => { if (dist.get(u) + d < dist.get(v)) { dist.set(v, dist.get(u) + d); prev.set(v, u); } });
    }
    const endN = dist.get(e.a) + Math.hypot(e.a.x - e.x, e.a.y - e.y) <= dist.get(e.b) + Math.hypot(e.b.x - e.x, e.b.y - e.y) ? e.a : e.b;
    const path = [[e.x, e.y]];
    for (let n = endN; n; n = prev.get(n)) path.unshift([n.x, n.y]);
    path.unshift([s.x, s.y]);
    return path;
  }

  /* ───── 그리기 ───── */
  const svg = $('#town');
  const at = (x, y, inner, o = '') => `<g transform="translate(${x} ${y})" ${o}>${inner}</g>`;
  let seed = 7;
  const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + ((seed - 1) / 2147483646) * (b - a); };
  let ground = `<rect x="-3000" y="-3000" width="${W + 6000}" height="${H + 6000}" fill="#dbe7c3"/>`;
  // 풀밭 얼룩
  for (let k = 0; k < 16; k++) ground += `<ellipse cx="${rnd(0, W).toFixed(0)}" cy="${rnd(120, H).toFixed(0)}" rx="${rnd(180, 320).toFixed(0)}" ry="${rnd(70, 120).toFixed(0)}" fill="#cfdfb2"/>`;
  // 쉼터 마당
  ground += `<ellipse cx="${TEMPLE[0]}" cy="${TEMPLE[1] + 30}" rx="300" ry="250" fill="#e9e2cc"/><ellipse cx="${TEMPLE[0]}" cy="${TEMPLE[1] + 30}" rx="284" ry="236" fill="none" stroke="#cdbf9c" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>`;
  // 길: 어두운 테두리를 먼저, 밝은 길을 위에
  const roadLines = ROADS.map(([x1, y1, x2, y2]) => `M${x1} ${y1} L${x2} ${y2}`).join(' ');
  const roadPath = roadLines + lots.map((l) => ` M${l.x} ${l.y - 4} L${l.door[0]} ${l.door[1]}`).join('');
  ground += `<path d="${roadPath}" fill="none" stroke="#cbbd9a" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/><path d="${roadPath}" fill="none" stroke="#f4ecd8" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>`;
  ground += `<path d="${roadLines}" fill="none" stroke="#e2d6b8" stroke-width="3" stroke-dasharray="14 18" stroke-linecap="round"/>`;
  ground += at(TEMPLE[0] - 230, TEMPLE[1] + 160, DECOR.pond()) + at(PLAZA[0], PLAZA[1] - 130, DECOR.fountain());

  // 세워 놓는 것들: 집과 꾸밈. y(발 위치)가 클수록 앞에 그린다.
  const things = [], lightItems = [];
  const light = (x, y, kind) => { const h = lightsOf(kind); if (h) lightItems.push({ x, y, html: at(x, y, h) }); };
  lots.forEach((l) => {
    const kind = l.r ? (l.r.house || 'kit') : 'vacant';
    const label = l.r ? `${l.r.name} 방문하기` : `빈 터 ${SLOT_NAME[l.slot]} 보기`;
    light(l.x, l.y, kind);
    things.push({ x: l.x, y: l.y, html: at(l.x, l.y, HOUSES[kind](l.r) + `<rect x="${-l.w / 2 - 10}" y="-200" width="${l.w + 20}" height="216" fill="transparent"/>`, `class="lot" data-slot="${l.slot}" tabindex="0" role="button" aria-label="${label.replace(/"/g, '')}"`) });
  });
  const put = (x, y, html) => things.push({ x, y, html: at(x, y, html) });
  put(PLAZA[0], PLAZA[1] - 32, DECOR.welcome());
  // 마을 둘레의 나무와 꽃
  for (let x = 120; x < R_X + 120; x += 190) { put(x + rnd(-40, 40), 300 + rnd(-50, 20), DECOR.tree(rnd(0.9, 1.25), x % 380 < 190 ? '#8fbb6a' : '#7fae5e')); put(x + rnd(-40, 40), H - 60 + rnd(-30, 20), DECOR.tree(rnd(0.9, 1.2), '#7fae5e')); }
  for (let y = 520; y < H - 200; y += 230) { put(70 + rnd(-20, 20), y + rnd(-40, 40), DECOR.tree(rnd(0.9, 1.2), '#8fbb6a')); if (Math.abs(y - (cy(MR) + ROAD)) > 260) put(R_X + 100 + rnd(-20, 30), y + rnd(-40, 40), DECOR.tree(rnd(0.9, 1.2), '#7fae5e')); }
  for (let k = 0; k < 14; k++) put(rnd(100, R_X + 60), [300, H - 110][k % 2] + rnd(20, 70), k % 2 ? DECOR.bush(k % 4 === 1 ? '#9cc57a' : '#8fbb6a') : DECOR.flowers(['#ff9aa2', '#ffd166', '#b8a5e3'][k % 3]));
  // 가로등: 세로 길과 가로 길이 만나는 모퉁이마다
  for (let j = 0; j < ROWS; j++) [V1 + 58, V2 + 58].forEach((x) => { const y = cy(j) + ROAD + 52; put(x, y, DECOR.lamp()); light(x, y, 'lamp'); });
  // 쉼터: 소나무, 석등, 탑, 긴 의자
  [[-200, -110, 1.2], [190, -70, 1.3], [150, 210, 1.1], [-150, -210, 1]].forEach(([dx, dy, s]) => put(TEMPLE[0] + dx, TEMPLE[1] + dy, DECOR.pine(s)));
  [[-110, 30], [110, 30]].forEach(([dx, dy]) => { put(TEMPLE[0] + dx, TEMPLE[1] + dy, DECOR.stoneLamp()); light(TEMPLE[0] + dx, TEMPLE[1] + dy, 'stoneLamp'); });
  put(TEMPLE[0] + 90, TEMPLE[1] + 180, DECOR.pagoda()); put(TEMPLE[0] - 100, TEMPLE[1] + 230, DECOR.bench()); put(TEMPLE[0] + 10, TEMPLE[1] + 240, DECOR.bench());
  things.sort((a, b) => a.y - b.y);
  const lights = lightItems.map((l) => l.html).join('');

  svg.innerHTML = `<defs><linearGradient id="t-iris" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#57e3d0"/><stop offset=".5" stop-color="#8b7cf6"/><stop offset="1" stop-color="#ff7ab8"/></linearGradient><radialGradient id="t-glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>`
    + `<g id="ground">${ground}</g><g id="marker"></g><g id="things">${things.map((t) => t.html).join('')}</g>`
    + `<rect id="dark" x="-3000" y="-3000" width="${W + 6000}" height="${H + 6000}" fill="#0d1746" opacity="0" pointer-events="none"/><g id="lights" opacity="0" pointer-events="none">${lights}</g>`;
  const thingsG = $('#things'), thingEls = [...thingsG.children];
  const lightEls = [...$('#lights').children];
  const shown = new Map(); // 화면 밖의 집과 불빛은 그리지 않는다
  const marker = $('#marker');

  /* ───── 손님 캐릭터 ───── */
  const NS = 'http://www.w3.org/2000/svg';
  const me = document.createElementNS(NS, 'g');
  me.setAttribute('id', 'me');
  const esc = (t) => String(t).replace(/[<&>"]/g, '');
  const HAIR = {
    m: 'M-13 -50 a13 13 0 0 1 26 0 q-13 -8 -26 0Z',
    f: 'M-14 -34 q-3 -30 14 -29 q17 -1 14 29 q-3 -4 -4 -14 q-10 -9 -20 0 q-1 10 -4 14Z',
  };
  /** 손님 한 명의 그림. 나와 다른 손님이 같이 쓴다. */
  const charHTML = (color, name, look, mine) => `<ellipse cx="0" cy="2" rx="15" ry="5" fill="rgba(60,50,30,.22)"/>`
    + `<g class="legs"><rect class="leg l" x="-9" y="-13" width="7" height="14" rx="3" fill="#3d4650"/><rect class="leg r" x="2" y="-13" width="7" height="14" rx="3" fill="#3d4650"/></g>`
    + `<g class="body"><rect class="arm" x="9" y="-37" width="7" height="17" rx="3.5" fill="${esc(color)}"/><rect x="-13" y="-38" width="26" height="28" rx="10" fill="${esc(color)}"/><circle cx="0" cy="-48" r="13" fill="#ffe0bd"/><path d="${HAIR[look] || HAIR.m}" fill="#4a3728"/>`
    + `<circle cx="-4.5" cy="-47" r="1.7" fill="#3d4650"/><circle cx="4.5" cy="-47" r="1.7" fill="#3d4650"/></g>`
    + `<g transform="translate(0 -74)"><rect x="${-(name.length * 7 + 12)}" y="-11" width="${name.length * 14 + 24}" height="22" rx="11" fill="${mine ? '#fff' : '#fffbe6'}" stroke="#3d4650" stroke-width="2"/><text x="0" y="0.5" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="800" fill="#3d4650">${esc(name)}</text></g>`;
  const drawMe = (color, name, look) => { me.innerHTML = charHTML(color, name, look, true); };
  const placeChar = (el, x, y) => {
    el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    // 발 위치가 더 아래인 것 앞에 끼워 넣어, 집 뒤로 가면 가려지게 한다
    const before = thingEls[things.findIndex((t) => t.y > y)] || null;
    if (el.nextSibling !== before) thingsG.insertBefore(el, before);
  };
  thingsG.appendChild(me);
  const pos = { x: MIMO[0], y: MIMO[1] + ROAD + 2 };
  let path = [], goal = null, walking = false, faceLeft = false, step = 0;
  const placeMe = () => placeChar(me, pos.x, pos.y);

  /* ───── 화면(카메라) ───── */
  const cam = { x: MIMO[0], y: MIMO[1] - 48, w: 1000, overview: false };
  const viewW = () => (cam.overview ? Math.max(W + 120, (H + 160) * (innerWidth / innerHeight)) : clamp(innerWidth * 0.82, 680, 1250));
  function frame(now) {
    const vw = viewW(), vh = vw * (innerHeight / innerWidth);
    const tx = cam.overview ? W / 2 : pos.x, ty = cam.overview ? H / 2 + 20 : pos.y - 90;
    const k = RM ? 1 : 0.12;
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.w += (vw - cam.w) * k;
    const h = cam.w * (innerHeight / innerWidth);
    svg.setAttribute('viewBox', `${(cam.x - cam.w / 2).toFixed(1)} ${(cam.y - h / 2).toFixed(1)} ${cam.w.toFixed(1)} ${h.toFixed(1)}`);
    const cull = (el, x, y) => {
      const on = Math.abs(x - cam.x) < cam.w / 2 + 280 && y > cam.y - h / 2 - 60 && y < cam.y + h / 2 + 300;
      if (shown.get(el) !== on) { shown.set(el, on); el.style.display = on ? '' : 'none'; }
    };
    things.forEach((t, i) => cull(thingEls[i], t.x, t.y));
    lightItems.forEach((l, i) => cull(lightEls[i], l.x, l.y));
  }

  /* ───── 걷기 ───── */
  const SPEED = 230; // 1초에 가는 거리
  const keys = new Set();
  const blocked = (x, y) => x < 40 || x > W - 40 || y < 120 || y > H - 40 || lots.some((l) => Math.abs(x - l.x) < l.w / 2 + 12 && y > l.y - 76 && y < l.y + 6);
  function walkTo(target, lot) {
    path = route([pos.x, pos.y], target);
    goal = lot || null;
    marker.innerHTML = `<g transform="translate(${target[0]} ${target[1]})"><ellipse rx="20" ry="8" fill="none" stroke="#ff7a59" stroke-width="4"/><ellipse rx="7" ry="3" fill="#ff7a59"/></g>`;
    hint.done();
  }
  function arrive() {
    marker.innerHTML = '';
    if (goal) { const l = goal; goal = null; openCard(l); }
  }
  // 밤: 마을 위에 어두운 막을 덮고, 그 위에 창문·가로등 불빛을 켠다
  const darkEl = $('#dark'), lightsEl = $('#lights');
  let night = 0, nightTarget = 0;
  let last = performance.now(), near = null;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let moved = false;
    const kx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
    const ky = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
    if ((kx || ky) && !dialog.open) {
      path = []; goal = null; marker.innerHTML = '';
      const n = Math.hypot(kx, ky), dx = (kx / n) * SPEED * dt, dy = (ky / n) * SPEED * dt;
      if (!blocked(pos.x + dx, pos.y)) { pos.x += dx; moved = true; }
      if (!blocked(pos.x, pos.y + dy)) { pos.y += dy; moved = true; }
      if (kx) faceLeft = kx < 0;
    } else if (path.length) {
      let left = SPEED * dt;
      while (left > 0 && path.length) {
        const [tx, ty] = path[0], d = Math.hypot(tx - pos.x, ty - pos.y);
        if (d <= left) { pos.x = tx; pos.y = ty; left -= d; path.shift(); }
        else { if (Math.abs(tx - pos.x) > 1) faceLeft = tx < pos.x; pos.x += ((tx - pos.x) / d) * left; pos.y += ((ty - pos.y) / d) * left; left = 0; }
      }
      moved = true;
      if (!path.length) arrive();
    }
    if (moved !== walking) { walking = moved; me.classList.toggle('walking', walking && !RM); }
    me.querySelector('.body')?.setAttribute('transform', faceLeft ? 'scale(-1 1)' : '');
    placeMe();
    // 가까운 문 앞이면 "방문하기" 버튼을 띄운다
    let best = null;
    lots.forEach((l) => { const d = Math.hypot(l.door[0] - pos.x, l.door[1] - pos.y); if (d < 70 && (!best || d < best.d)) best = { l, d }; });
    const n = best ? best.l : null;
    if (n !== near) {
      near = n;
      visitBtn.hidden = !n;
      if (n) visitBtn.textContent = n.r ? `${n.r.name} 방문하기` : '빈 터 둘러보기';
    }
    if (Math.abs(nightTarget - night) > 0.001) {
      night = RM ? nightTarget : night + (nightTarget - night) * Math.min(1, dt * 1.6);
      darkEl.setAttribute('opacity', (night * 0.66).toFixed(3));
      lightsEl.setAttribute('opacity', clamp((night - 0.3) / 0.5, 0, 1).toFixed(3));
    }
    // 다른 손님들: 받은 위치로 부드럽게 따라간다
    peers.forEach((q) => {
      const d = Math.hypot(q.tx - q.x, q.ty - q.y);
      if (d > 600) { q.x = q.tx; q.y = q.ty; } else if (d > 0.5) { const k = Math.min(1, dt * 7); q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; }
      const moving = d > 3;
      if (moving !== q.moving) { q.moving = moving; q.el.classList.toggle('walking', moving && !RM); }
      placeChar(q.el, q.x, q.y);
    });
    // 내 위치 알리기: 움직이는 동안 0.25초마다, 멈추면 한 번 더
    if (net && (moved || tellSoon) && now - told > 250) { told = now; tellSoon = moved; tell(); }
    frame(now);
    requestAnimationFrame(tick);
  }

  /* ───── 누르기 ───── */
  const toWorld = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };
  const lotOf = (el) => { const g = el.closest?.('.lot'); return g ? lots.find((l) => l.slot === g.dataset.slot) : null; };
  let down = null;
  svg.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  svg.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 12) return;
    const lot = lotOf(e.target);
    if (cam.overview) setOverview(false);
    if (lot) walkTo(lot.door, lot); else walkTo(toWorld(e), null);
  });
  svg.addEventListener('keydown', (e) => {
    const lot = lotOf(e.target);
    if (lot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (cam.overview) setOverview(false); walkTo(lot.door, lot); }
  });
  addEventListener('keydown', (e) => {
    if (e.target.matches?.('input,textarea')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); if (k.startsWith('Arrow')) e.preventDefault(); hint.done(); }
    if (k === 'Enter' && near && !dialog.open && document.activeElement === document.body) openCard(near);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  addEventListener('blur', () => keys.clear());

  /* ───── 화면 위 버튼들 ───── */
  const hintN = $('#hint');
  const hint = { done() { hintN.classList.add('gone'); } };
  const visitBtn = $('#visit');
  visitBtn.addEventListener('click', () => { if (near) openCard(near); });
  const nightBtn = $('#night');
  function setNight(on) { nightTarget = on ? 1 : 0; nightBtn.textContent = on ? '낮 보기' : '밤 보기'; nightBtn.setAttribute('aria-pressed', on); }
  nightBtn.addEventListener('click', () => setNight(!nightTarget));
  const mapBtn = $('#map');
  function setOverview(on) { cam.overview = on; mapBtn.textContent = on ? '내 자리로' : '전체 보기'; mapBtn.setAttribute('aria-pressed', on); }
  mapBtn.addEventListener('click', () => setOverview(!cam.overview));
  const filled = lots.filter((l) => l.r).length;

  /* ───── 소개 카드 ───── */
  const dialog = $('#card');
  function openCard(l) {
    $('#c-addr').textContent = `스친 마을 · ${SLOT_NAME[l.slot]}`;
    const go = $('#c-go');
    if (l.r) {
      $('#c-name').textContent = l.r.name;
      $('#c-handle').textContent = `@${l.r.handle}`;
      $('#c-intro').textContent = l.r.intro;
      go.href = l.r.link || `https://www.threads.com/@${l.r.handle}`;
      go.textContent = l.r.linkLabel || '스레드 보러 가기';
      go.hidden = false;
      dialog.style.setProperty('--c', l.r.color);
      cardLot = l; showHearts();
    } else {
      $('#c-name').textContent = '빈 터';
      $('#c-handle').textContent = '';
      $('#c-intro').textContent = '아직 준비 중인 자리예요.';
      go.hidden = true;
      dialog.style.setProperty('--c', '#ff7a59');
      cardLot = null; showHearts();
    }
    keys.clear();
    dialog.showModal();
  }
  $('#c-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  /* ───── 들어오기: 닉네임과 옷 색 (이 기기에만 저장) ───── */
  const COLORS = ['#ff7a59', '#3f7fd1', '#5fb28a', '#e58fb0', '#8b7cf6', '#f2b93b'];
  const gate = $('#gate'), nameIn = $('#g-name'), swatches = $('#g-colors');
  let color = store.get('town-color') || COLORS[0];
  swatches.innerHTML = COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === color ? 'checked' : ''}><span style="background:${c}"></span><b class="sr">옷 색 ${c}</b></label>`).join('');
  nameIn.value = store.get('town-name') || '';
  let look = store.get('town-look') || 'f';
  document.querySelectorAll('#g-form input[name=look]').forEach((r) => { r.checked = r.value === look; });
  let myName = store.get('town-name') || '손님';
  const enter = (name) => { myName = name; drawMe(color, name, look); placeMe(); tellSoon = true; };
  $('#g-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (nameIn.value.trim() || '손님').slice(0, 8);
    const f = new FormData(e.target);
    color = f.get('color') || color; look = f.get('look') || look;
    store.set('town-name', name); store.set('town-color', color); store.set('town-look', look);
    enter(name);
    gate.close();
  });
  $('#rename').addEventListener('click', () => gate.showModal());

  /* ───── 출석: 이 기기에서 며칠째 들렀는지 (한국 시간 기준) ───── */
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() + 9 * 3600e3 - 864e5).toISOString().slice(0, 10);
  let days = { last: '', streak: 0, total: 0 };
  try { days = Object.assign(days, JSON.parse(store.get('town-days') || '{}')); } catch (e) {}
  if (days.last !== today) { days = { last: today, streak: days.last === yesterday ? days.streak + 1 : 1, total: days.total + 1 }; store.set('town-days', JSON.stringify(days)); }
  $('#count').textContent = `입점 ${filled}곳 · 출석 ${days.streak}일째`;

  /* ───── 손 흔들기 ───── */
  let waveAt = 0;
  const waveEl = (el) => { el.classList.remove('waving'); void el.getBBox(); el.classList.add('waving'); setTimeout(() => el.classList.remove('waving'), 1700); };
  $('#wave').addEventListener('click', () => { waveAt = Date.now(); waveEl(me); tellSoon = true; hint.done(); });

  /* ───── 함께: 다른 손님 보이기, 집마다 하트 (연결이 안 되면 혼자 다니는 마을 그대로) ───── */
  let net = null, told = 0, tellSoon = false;
  const peers = new Map();
  const tell = () => net.setPresence({ n: myName, c: color, g: look, x: Math.round(pos.x), y: Math.round(pos.y), f: faceLeft, w: waveAt });
  const onlineEl = $('#online');
  const showOnline = () => { onlineEl.hidden = !net; if (net) onlineEl.textContent = `지금 ${peers.size + 1}명`; };
  function onPeer(uid, d) {
    let q = peers.get(uid);
    if (!d || typeof d.x !== 'number' || typeof d.y !== 'number') { if (q) { q.el.remove(); peers.delete(uid); showOnline(); } return; }
    if (!q) {
      if (peers.size >= 60) return; // 너무 많으면 더 그리지 않는다
      q = { el: document.createElementNS(NS, 'g'), x: d.x, y: d.y, tx: d.x, ty: d.y, w: d.w || 0, sig: '', moving: false };
      q.el.setAttribute('class', 'peer');
      q.el.setAttribute('pointer-events', 'none');
      peers.set(uid, q); showOnline();
    }
    const name = String(d.n || '손님').slice(0, 8), col = /^#[0-9a-f]{6}$/i.test(d.c) ? d.c : '#8a8f96', lk = d.g === 'm' ? 'm' : 'f';
    const sig = name + col + lk;
    if (sig !== q.sig) { q.sig = sig; q.el.innerHTML = charHTML(col, name, lk, false); }
    q.tx = clamp(d.x, 0, W); q.ty = clamp(d.y, 0, H);
    q.el.querySelector('.body')?.setAttribute('transform', d.f ? 'scale(-1 1)' : '');
    if (d.w && d.w !== q.w) { q.w = d.w; if (Date.now() - d.w < 8000) waveEl(q.el); }
  }

  const TIERS = [10, 30, 100];
  const keyOf = (r) => r.handle.replace(/\./g, ',');
  let hearts = {}, cardLot = null;
  const perkEls = new Map();
  function showPerks() {
    lots.forEach((l) => {
      if (!l.r) return;
      const n = hearts[keyOf(l.r)] || 0, tier = TIERS.filter((t) => n >= t).length;
      if ((perkEls.get(l.slot)?.tier || 0) === tier) return;
      let p = perkEls.get(l.slot);
      if (!p) { p = { g: document.createElementNS(NS, 'g'), tier: 0 }; p.g.setAttribute('pointer-events', 'none'); thingEls[things.findIndex((t) => t.x === l.x && t.y === l.y)].appendChild(p.g); perkEls.set(l.slot, p); }
      p.tier = tier; p.g.innerHTML = window.TOWN_ART.perks(tier, l.w);
    });
  }
  const heartBox = $('#c-hearts'), heartBtn = $('#c-heart'), heartNum = $('#c-heart-n');
  function showHearts() {
    heartBox.hidden = !(net && cardLot);
    if (!net || !cardLot) return;
    const key = keyOf(cardLot.r), n = hearts[key] || 0;
    const wait = Date.now() - net.lastGiven(key) < window.TownNet.COOLDOWN;
    heartNum.textContent = `하트 ${n}개`;
    heartBtn.disabled = wait;
    heartBtn.textContent = wait ? '오늘은 하트를 줬어요' : '하트 주기';
  }
  heartBtn.addEventListener('click', async () => {
    if (!net || !cardLot) return;
    heartBtn.disabled = true;
    const res = await net.giveHeart(keyOf(cardLot.r));
    if (res === 'error') { heartBtn.textContent = '지금은 하트를 줄 수 없어요'; return; }
    showHearts();
  });

  enter(myName);
  if (!store.get('town-name') && !new URLSearchParams(location.search).has('skip')) gate.showModal();
  window.TownNet.connect().then((n) => {
    if (!n) return;
    net = n; tellSoon = true; showOnline();
    net.onPeers(onPeer);
    net.onHearts((h) => { hearts = h; showPerks(); showHearts(); });
  });

  window.__town = { pos, lots, walkTo, route, cam, setOverview, setNight, nodes, peers, get net() { return net; }, get hearts() { return hearts; } };
  requestAnimationFrame(tick);
})();
