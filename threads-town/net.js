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
//   net.giveHeart(key) -> 'ok' | 'cooldown' | 'error'
(() => {
  const COOLDOWN = 20 * 60 * 60 * 1000; // 한 집에 하트는 20시간에 한 번 (database.rules.json과 같은 값)
  const SDK = '10.12.2';
  const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
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
    const given = {};
    try { Object.assign(given, (await db.ref(`given/${uid}`).once('value')).val() || {}); } catch (e) {}
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
          await db.ref().update({ [`given/${uid}/${key}`]: SV.TIMESTAMP, [`hearts/${key}`]: SV.increment(1) });
          given[key] = Date.now();
          return 'ok';
        } catch (e) { return 'error'; }
      },
    };
  }

  // 시험용: 주소에 ?mock 을 붙이면 같은 브라우저의 창끼리만 이어진다 (서버 없음).
  function mockNet() {
    const uid = 'm' + Math.random().toString(36).slice(2, 9);
    const ch = new BroadcastChannel('town-mock');
    const peersFn = [], heartsFn = [], given = {};
    const hearts = () => { try { return JSON.parse(localStorage.getItem('town-mock-hearts') || '{}'); } catch (e) { return {}; } };
    let mine = null;
    ch.onmessage = ({ data }) => {
      if (data.type === 'p' && data.uid !== uid) peersFn.forEach((fn) => fn(data.uid, data.p));
      if (data.type === 'hello' && mine) ch.postMessage({ type: 'p', uid, p: mine });
      if (data.type === 'h') heartsFn.forEach((fn) => fn(hearts()));
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
        ch.postMessage({ type: 'h' }); heartsFn.forEach((fn) => fn(h));
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
