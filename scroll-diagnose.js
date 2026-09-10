/* PASS 1 — which of the two suspects costs frames: the embed, or the videos?
   Paste into the DevTools console on https://www.lindaxiaodesign.com in Chrome,
   window maximised. Navigates the iframe at most once, so it will not trip
   Chrome's navigation throttling. ~40s. Don't scroll or switch tabs while it runs.
   Reload the page afterwards to restore everything. */
(async () => {
  const iframe = [...document.querySelectorAll('iframe')].find(f => f.src.includes('portfolio-landing'));
  const videos = [...document.querySelectorAll('video')];
  if (!iframe) return console.error('No embed iframe — widen the window; below Framer\'s breakpoint it is a static PNG.');
  console.log('embed:', iframe.clientWidth + 'x' + iframe.clientHeight, '| videos:', videos.length);

  // If a previous run left a ?debug= variant loaded, reset once and wait it out.
  const clean = iframe.src.split('?')[0];
  if (iframe.src !== clean) {
    console.log('resetting embed to the default build…');
    iframe.src = clean;
    await new Promise(r => setTimeout(r, 5000));
  }

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
  const stats = (t) => {
    const s = [...t].sort((a, b) => a - b);
    return { frames: t.length,
             median: +s[s.length >> 1].toFixed(1),
             p95:    +s[Math.floor(s.length * .95)].toFixed(1),
             worst:  +s[s.length - 1].toFixed(1),
             'janky %': +(100 * t.filter(x => x > 16.7).length / t.length).toFixed(1),
             'bad %':   +(100 * t.filter(x => x > 33).length   / t.length).toFixed(1) };
  };

  const RUNS = [
    ['as-is',           () => () => {}],
    ['embed hidden',    () => { const d = iframe.style.visibility; iframe.style.visibility = 'hidden';
                                return () => { iframe.style.visibility = d; }; }],
    ['videos removed',  () => { videos.forEach(v => v.pause());
                                const o = videos.map(v => v.style.visibility);
                                videos.forEach(v => v.style.visibility = 'hidden');
                                return () => videos.forEach((v, i) => v.style.visibility = o[i]); }],
    ['both',            () => { const a = iframe.style.visibility; iframe.style.visibility = 'hidden';
                                videos.forEach(v => v.pause());
                                const o = videos.map(v => v.style.visibility);
                                videos.forEach(v => v.style.visibility = 'hidden');
                                return () => { iframe.style.visibility = a;
                                               videos.forEach((v, i) => v.style.visibility = o[i]); }; }],
  ];

  scrollTo(0, 0); await new Promise(r => setTimeout(r, 600));
  await Promise.all([frames(1500), scroll(1500)]);        // warm-up, discarded

  const rows = [];
  for (const [name, apply] of RUNS) {
    scrollTo(0, 0); await new Promise(r => setTimeout(r, 900));
    const undo = apply();
    await new Promise(r => setTimeout(r, 600));
    const [t] = await Promise.all([frames(4000), scroll(4000)]);
    undo();
    rows.push({ run: name, ...stats(t) });
    console.log('done:', name);
  }
  scrollTo(0, 0);
  console.table(rows);
  const base = rows[0]['janky %'];
  console.log('change in janky frames vs as-is (negative = smoother):');
  for (const r of rows.slice(1)) {
    const d = (r['janky %'] - base).toFixed(1);
    console.log('  ' + r.run.padEnd(16) + (d > 0 ? '+' : '') + d + ' pp');
  }
  console.log('\nReload to restore. If "embed hidden" is what helps, run pass 2.');
})();
