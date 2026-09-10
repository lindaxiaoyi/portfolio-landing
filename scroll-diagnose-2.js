/* PASS 2 — only if pass 1 showed "embed hidden" is what helps.
   Which part of the embed costs frames: the riso filters, or the cat's walk cycle?
   This one has to reload the iframe, so navigations are spaced ~7s apart to stay
   under Chrome's flooding protection (crbug.com/1038223). ~70s total.
   Paste into the DevTools console on https://www.lindaxiaodesign.com in Chrome. */
(async () => {
  const iframe = [...document.querySelectorAll('iframe')].find(f => f.src.includes('portfolio-landing'));
  if (!iframe) return console.error('No embed iframe — widen the window.');
  const base = iframe.src.split('?')[0];

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
    return { median: +s[s.length >> 1].toFixed(1),
             p95:    +s[Math.floor(s.length * .95)].toFixed(1),
             worst:  +s[s.length - 1].toFixed(1),
             'janky %': +(100 * t.filter(x => x > 16.7).length / t.length).toFixed(1) };
  };
  // one navigation, then a long settle — deliberately unhurried
  const load = async (src) => {
    let done = false;
    const p = new Promise(r => iframe.addEventListener('load', () => { done = true; r(); }, { once: true }));
    iframe.src = src;
    await Promise.race([p, new Promise(r => setTimeout(r, 7000))]);
    if (!done) console.warn('  (load event never fired — Chrome may be throttling; result may be unreliable)');
    await new Promise(r => setTimeout(r, 2500));
  };

  const VARIANTS = [
    ['as-is',             base],
    ['riso filters off',  base + '?debug=nofilter'],
    ['cat animation off', base + '?debug=nocat'],
    ['both off',          base + '?debug=nofilter,nocat'],
  ];

  const rows = [];
  for (const [name, src] of VARIANTS) {
    scrollTo(0, 0);
    await load(src);
    const [t] = await Promise.all([frames(4000), scroll(4000)]);
    rows.push({ run: name, ...stats(t) });
    console.log('done:', name);
  }
  scrollTo(0, 0); await load(base);
  console.table(rows);
  const b = rows[0]['janky %'];
  console.log('change in janky frames vs as-is (negative = smoother):');
  for (const r of rows.slice(1)) {
    const d = (r['janky %'] - b).toFixed(1);
    console.log('  ' + r.run.padEnd(18) + (d > 0 ? '+' : '') + d + ' pp');
  }
})();
