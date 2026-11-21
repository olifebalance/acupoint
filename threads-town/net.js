// 스친 마을의 "함께" 기능: 서로 보이기, 손 흔들기, 집마다 하트.
// Firebase(무료 Spark 요금제)에 올렸을 때만 켜진다. 연결이 안 되면 null을 돌려주고,
// 마을은 지금처럼 혼자 돌아다니는 마을로 그대로 동작한다.
//
//   const net = await TownNet.connect();      // 안 되면 null
//   net.uid                                    이 기기의 익명 아이디
//   net.setPresence({ n, c, g, x, y, f, w })   내 모습과 위치 알리기
//   net.onPeers(fn)   fn(uid, data|null)       다른 손님이 들어오거나 움직이거나 나갈 때
//   net.onHearts(fn)  fn({ 집열쇠: 개수 })     집마다 받은 하트
//   net.lastGiven(key)                         내가 그 집에 마지막으로 하트를 준 시각(ms) 또는 0
//   net.giveHeart(key) -> 'ok' | 'cooldown' | 'error'   (warm/집열쇠 에 마지막 하트 시각도 남긴다)
//   net.onWarm(fn)    fn({ 집열쇠: 마지막으로 하트를 받은 시각 })
//   net.visit(key) -> 'ok' | 'already' | 'error'   오늘(한국 날짜) 이 집에 들른 손님 수를 1 올린다. 기기마다 하루 한 번.
//   net.onVisits(fn)  fn({ 집열쇠: 오늘 다녀간 손님 수 })   날짜가 바뀌면 새 날짜로 다시 듣는다
//   net.onSnowmen(fn) fn({ 집열쇠: { n: 만든 사람, c: 목도리 색, t: 만든 시각 } })
//   net.buildSnowman(key, { n, c }) -> 'ok' | 'taken' | 'error'   집마다 하나, 만든 지 25시간이 지나야 새로 만들 수 있다
(() => {
  const COOLDOWN = 20 * 60 * 60 * 1000; // 한 집에 하트는 20시간에 한 번 (database.rules.json과 같은 값)
  const SDK = '10.12.2';
  const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
  const SNOWMAN_LIFE = 25 * 60 * 60 * 1000; // database.rules.json의 90000000과 같은 값
  const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
  const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  async function firebaseNet() {
    // Firebase 호스팅은 /__/firebase/ 아래에서 SDK와 이 프로젝트의 설정을 내려 준다.
    // 다른 곳에 올릴 때는 firebase-config.js에서 window.TOWN_FIREBASE_CONFIG를 정해 두면 된다.
    const base = window.TOWN_FIREBASE_CONFIG ? `https://www.gstatic.com/firebasejs/${SDK}` : `/__/firebase/${SDK}`;
    for (const part of ['app', 'auth', 'database']) await load(`${base}/firebase-${part}-compat.js`);
    if (window.TOWN_FIREBASE_CONFIG) firebase.initializeApp(window.TOWN_FIREBASE_CONFIG);
    else await load('/__/firebase/init.js');
    if (!window.firebase || !firebase.apps.length) return null;
    const { user } = await firebase.auth().signInAnonymously();
    const uid = user.uid, db = firebase.database(), SV = firebase.database.ServerValue;
    const meRef = db.ref(`presence/${uid}`);
    let mine = null;
    // 연결이 끊겼다 돌아오면 내 자리를 다시 알린다. 창을 닫으면 서버가 지운다.
    db.ref('.info/connected').on('value', (s) => { if (s.val()) meRef.onDisconnect().remove().then(() => { if (mine) meRef.set(mine); }); });
    const given = {}, seen = {};
    try { Object.assign(given, (await db.ref(`given/${uid}`).once('value')).val() || {}); } catch (e) {}
    try { Object.assign(seen, (await db.ref(`seen/${uid}`).once('value')).val() || {}); } catch (e) {}
    let snowmen = {};
    return {
      uid,
      setPresence(p) { mine = { ...p, t: SV.TIMESTAMP }; meRef.set(mine).catch(() => {}); },
      onPeers(fn) {
        const ref = db.ref('presence');
        const up = (s) => { if (s.key !== uid) fn(s.key, s.val()); };
        ref.on('child_added', up); ref.on('child_changed', up);
        ref.on('child_removed', (s) => { if (s.key !== uid) fn(s.key, null); });
      },
      onHearts(fn) { db.ref('hearts').on('value', (s) => fn(s.val() || {})); },
      lastGiven: (key) => given[key] || 0,
      async giveHeart(key) {
        if (Date.now() - (given[key] || 0) < COOLDOWN) return 'cooldown';
        try {
          await db.ref().update({ [`given/${uid}/${key}`]: SV.TIMESTAMP, [`hearts/${key}`]: SV.increment(1), [`warm/${key}`]: SV.TIMESTAMP });
          given[key] = Date.now();
          return 'ok';
        } catch (e) { return 'error'; }
      },
      onWarm(fn) { db.ref('warm').on('value', (s) => fn(s.val() || {})); },
      async visit(key) {
        const day = today();
        if (seen[key] === day) return 'already';
        try {
          await db.ref().update({ [`visits/${day}/${key}`]: SV.increment(1), [`seen/${uid}/${key}`]: day });
          seen[key] = day;
          return 'ok';
        } catch (e) { return 'error'; }
      },
      onVisits(fn) {
        let day = '', ref = null;
        const listen = () => {
          if (today() === day) return;
          if (ref) ref.off();
          day = today(); ref = db.ref(`visits/${day}`);
          ref.on('value', (s) => fn(s.val() || {}));
        };
        listen(); setInterval(listen, 60000);
      },
      onSnowmen(fn) { db.ref('snowmen').on('value', (s) => { snowmen = s.val() || {}; fn(snowmen); }); },
      async buildSnowman(key, who) {
        const old = snowmen[key];
        if (old && Date.now() - old.t < SNOWMAN_LIFE) return 'taken';
        try { await db.ref(`snowmen/${key}`).set({ n: who.n, c: who.c, t: SV.TIMESTAMP }); return 'ok'; } catch (e) { return 'error'; }
      },
    };
  }

  // 시험용: 주소에 ?mock 을 붙이면 같은 브라우저의 창끼리만 이어진다 (서버 없음).
  function mockNet() {
    const uid = 'm' + Math.random().toString(36).slice(2, 9);
    const ch = new BroadcastChannel('town-mock');
    const peersFn = [], heartsFn = [], given = {};
    const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } };
    const hearts = () => read('town-mock-hearts');
    // 바뀐 값을 알림에 같이 실어 보낸다(다른 창의 저장소가 늦게 맞춰져도 같은 값을 보도록)
    const send = (sets) => ch.postMessage({ type: 'h', sets });
    const write = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); send([[k, JSON.stringify(v)]]); refresh(); };
    const warmFn = [], visitFn = [], snowFn = [], seen = {};
    const refresh = () => { warmFn.forEach((fn) => fn(read('town-mock-warm'))); visitFn.forEach((fn) => fn(read('town-mock-visits-' + today()))); snowFn.forEach((fn) => fn(read('town-mock-snowmen'))); };
    let mine = null;
    ch.onmessage = ({ data }) => {
      if (data.type === 'p' && data.uid !== uid) peersFn.forEach((fn) => fn(data.uid, data.p));
      if (data.type === 'hello' && mine) ch.postMessage({ type: 'p', uid, p: mine });
      if (data.type === 'h') { (data.sets || []).forEach(([k, v]) => localStorage.setItem(k, v)); heartsFn.forEach((fn) => fn(hearts())); refresh(); }
    };
    addEventListener('pagehide', () => ch.postMessage({ type: 'p', uid, p: null }));
    return {
      uid,
      setPresence(p) { mine = p; ch.postMessage({ type: 'p', uid, p }); },
      onPeers(fn) { peersFn.push(fn); ch.postMessage({ type: 'hello' }); },
      onHearts(fn) { heartsFn.push(fn); fn(hearts()); },
      lastGiven: (key) => given[key] || 0,
      async giveHeart(key) {
        if (Date.now() - (given[key] || 0) < COOLDOWN) return 'cooldown';
        const h = hearts(); h[key] = (h[key] || 0) + 1;
        localStorage.setItem('town-mock-hearts', JSON.stringify(h));
        given[key] = Date.now();
        const w = read('town-mock-warm'); w[key] = Date.now(); localStorage.setItem('town-mock-warm', JSON.stringify(w));
        send([['town-mock-hearts', JSON.stringify(h)], ['town-mock-warm', JSON.stringify(w)]]); heartsFn.forEach((fn) => fn(h)); refresh();
        return 'ok';
      },
      onWarm(fn) { warmFn.push(fn); fn(read('town-mock-warm')); },
      async visit(key) {
        if (seen[key] === today()) return 'already';
        seen[key] = today();
        const k = 'town-mock-visits-' + today(), v = read(k); v[key] = (v[key] || 0) + 1; write(k, v);
        return 'ok';
      },
      onVisits(fn) { visitFn.push(fn); fn(read('town-mock-visits-' + today())); },
      onSnowmen(fn) { snowFn.push(fn); fn(read('town-mock-snowmen')); },
      async buildSnowman(key, who) {
        const s = read('town-mock-snowmen');
        if (s[key] && Date.now() - s[key].t < SNOWMAN_LIFE) return 'taken';
        s[key] = { n: who.n, c: who.c, t: Date.now() }; write('town-mock-snowmen', s);
        return 'ok';
      },
    };
  }

  window.TownNet = {
    COOLDOWN,
    async connect() {
      if (new URLSearchParams(location.search).has('mock')) return mockNet();
      try { return await timeout(firebaseNet(), 12000); } catch (e) { return null; }
    },
  };
})();
