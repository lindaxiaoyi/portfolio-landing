/* Paste into the DevTools console on https://www.lindaxiaodesign.com in CHROME,
   at desktop width (the embed is swapped for a static PNG on narrow screens).
   Don't scroll or switch tabs while it runs — that skews the numbers.

   Scripted-scrolls the page six times, measuring real frame intervals, with a
   different suspect neutralised each run. Whichever run gets markedly smoother
   is the cause. Nothing persists; reload to restore. */
(async () => {
  const EMBED  = 'portfolio-landing';
  const iframe = [...document.querySelectorAll('iframe')].find(f => f.src.includes(EMBED));
  const videos = [...document.querySelectorAll('video')];
  if (!iframe) return console.error('Embed iframe not found — are you at desktop width?');
  const baseSrc = iframe.src.split('?')[0];

  const frames = (ms) => new Promise(res => {
    const t = []; let last = performance.now(); const stop = last + ms;
    requestAnimationFrame(function step(now) {
      t.push(now - last); last = now;
      if (now < stop) requestAnimationFrame(step); else res(t.slice(1));
    });
  });
  const scroll = (ms) => new Promise(res => {
    const top = document.body.scrollHeight - innerHeight, t0 = performance.now();
    (function step() {
      const p = (performance.now() - t0) / ms;
      scrollTo(0, (p < .5 ? p * 2 : (1 - p) * 2) * top);
      p < 1 ? requestAnimationFrame(step) : res();
    })();
  });
  const reload = (src) => new Promise(res => {
    iframe.addEventListener('load', res, { once: true });
    iframe.src = src;
    setTimeout(res, 4000);                     // don't hang if load never fires
  });
  const stats = (t) => {
    const s = [...t].sort((a, b) => a - b);
    return { median: +s[s.length >> 1].toFixed(1),
             p95:    +s[Math.floor(s.length * .95)].toFixed(1),
             worst:  +s[s.length - 1].toFixed(1),
             'janky %': +(100 * t.filter(x => x > 16.7).length / t.length).toFixed(1),
             'bad %':   +(100 * t.filter(x => x > 33).length   / t.length).toFixed(1) };
  };

  const RUNS = [
    ['as-is',              async () => { await reload(baseSrc); return () => {}; }],
    ['riso filters off',   async () => { await reload(baseSrc + '?debug=nofilter'); return () => {}; }],
    ['cat animation off',  async () => { await reload(baseSrc + '?debug=nocat'); return () => {}; }],
    ['both off',           async () => { await reload(baseSrc + '?debug=nofilter,nocat'); return () => {}; }],
    ['whole embed hidden', async () => { await reload(baseSrc);
                                         const d = iframe.style.display; iframe.style.display = 'none';
                                         return () => { iframe.style.display = d; }; }],
    ['videos removed',     async () => { await reload(baseSrc);
                                         videos.forEach(v => v.pause());
                                         const o = videos.map(v => v.style.display);
                                         videos.forEach(v => v.style.display = 'none');
                                         return () => videos.forEach((v, i) => v.style.display = o[i]); }],
  ];

  const rows = [];
  for (const [name, setup] of RUNS) {
    scrollTo(0, 0);
    const undo = await setup();
    await new Promise(r => setTimeout(r, 1200));          // let it settle + paint
    const [t] = await Promise.all([frames(3000), scroll(3000)]);
    undo();
    rows.push({ run: name, ...stats(t) });
    console.log('✓', name);
  }
  scrollTo(0, 0); iframe.src = baseSrc;
  console.table(rows);

  const base = rows[0]['janky %'];
  console.log('\nchange in janky frames vs as-is (negative = smoother):');
  for (const r of rows.slice(1)) {
    const d = (r['janky %'] - base).toFixed(1);
    console.log('  ' + r.run.padEnd(20) + (d > 0 ? '+' : '') + d + ' pp');
  }
  console.log('\nReload the page to restore everything.');
})();
