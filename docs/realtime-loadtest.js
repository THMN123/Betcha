// Load test of Supabase Realtime broadcast for Betcha's live matches, against the real project.
// Each simulated player = its own Supabase client (own websocket), 2 players per match.
// OLD protocol: snake body every tick (~9.1 msg/s/player). NEW protocol: batched inputs + heartbeat.
const { chromium } = require('playwright');
// Point LIB at a copy of node_modules/@supabase/supabase-js/dist/umd/supabase.js
const LIB = process.env.SUPABASE_UMD || 'supabase.js';
const SCENARIOS = JSON.parse(process.argv[2] || '[]');
const DURATION_MS = Number(process.argv[3] || 20000);

(async () => {
  const b = await chromium.launch();
  for (const sc of SCENARIOS) {
    const page = await b.newPage();
    await page.goto('about:blank');
    await page.addScriptTag({ path: LIB });
    const r = await page.evaluate(async ({ matches, protocol, duration, joinGapMs }) => {
      const URL = 'https://krhtlurqdfkzbxwrdowt.supabase.co', KEY = 'sb_publishable_KhKwagFYjzyzh8fSg7mlEA_4ze5wKUw';
      const run = Math.random().toString(36).slice(2, 8);
      const players = [];
      const lat = []; let sent = 0, received = 0, sendErrors = 0; const statuses = {}; const systemMsgs = [];
      const t0 = performance.now();
      for (let m = 0; m < matches; m++) {
        if (joinGapMs) await new Promise((res) => setTimeout(res, joinGapMs * 2));
        for (let p = 0; p < 2; p++) {
          const client = supabase.createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 1000 } } });
          const ch = client.channel(`lt-${run}-${m}`, { config: { broadcast: { self: false, ack: false } } });
          ch.on('broadcast', { event: 'r' }, ({ payload }) => { received++; lat.push(Date.now() - payload.ts); });
          ch.on('system', {}, (msg) => { if (systemMsgs.length < 5) systemMsgs.push(JSON.stringify(msg).slice(0, 160)); });
          players.push({ client, ch, subscribed: new Promise((res) => ch.subscribe((s) => { statuses[s] = (statuses[s] || 0) + 1; if (s !== 'SUBSCRIBED') return; res(true); })) });
        }
      }
      const joinTimeout = new Promise((res) => setTimeout(() => res('timeout'), 20000));
      await Promise.race([Promise.all(players.map((p) => p.subscribed)), joinTimeout]);
      const joinMs = performance.now() - t0;
      const snakeBody = Array.from({ length: 40 }, (_, i) => i % 18); // ~20-cell snake, flat [x,y,...]
      const timers = [];
      const send = (p, payload) => { sent++; p.ch.send({ type: 'broadcast', event: 'r', payload: { ...payload, ts: Date.now() } }).then((x) => { if (x !== 'ok') sendErrors++; }); };
      for (const p of players) {
        let tick = 0, lastSent = 0, pending = 0;
        if (protocol === 'old') {
          timers.push(setInterval(() => { tick++; send(p, { id: 'x', n: 'p', s: tick * 10, t: tick, st: 'p', g: snakeBody }); }, 110));
        } else {
          timers.push(setInterval(() => {
            tick += 2; // 200ms of snake ticks
            if (Math.random() < 0.3) pending++; // ~1.5 human turns/s
            const now = performance.now();
            if ((pending && now - lastSent >= 200) || now - lastSent >= 2000) {
              send(p, { id: 'x', n: 'p', t: tick, i: Array.from({ length: pending }, () => [tick, 1]) });
              pending = 0; lastSent = now;
            }
          }, 200));
        }
      }
      await new Promise((res) => setTimeout(res, duration));
      timers.forEach(clearInterval);
      await new Promise((res) => setTimeout(res, 1500)); // let in-flight messages land
      for (const p of players) p.client.removeAllChannels();
      lat.sort((a, b) => a - b);
      const q = (f) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * f))] : null;
      return {
        matches, players: players.length, protocol, joinMs: Math.round(joinMs), statuses,
        sent, received, delivered_pct: sent ? +(100 * received / sent).toFixed(1) : 0,
        sent_per_s: +(sent / (duration / 1000)).toFixed(0), p50_ms: q(0.5), p95_ms: q(0.95), max_ms: q(1), sendErrors, systemMsgs,
      };
    }, { joinGapMs: 0, ...sc, duration: DURATION_MS });
    console.log(JSON.stringify(r));
    await page.close();
    await new Promise((res) => setTimeout(res, 4000));
  }
  await b.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
