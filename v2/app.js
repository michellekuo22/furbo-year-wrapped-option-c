(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const stage = $('#stage');
  const screens = $$('.screen');
  const TOTAL = screens.length;               // 12
  const STORY_FIRST = 2, STORY_LAST = 10;     // screens with the story chrome
  const chrome = $('#chrome');
  const sbPlain = $('#sbPlain');
  const pill = $('#pill');
  let cur = 0;                                 // 0-based index
  let busy = false;

  /* ---------- scale the 390x844 stage to the window ---------- */
  function fit() {
    const vv = window.visualViewport;
    const w = Math.round((vv && vv.width) || innerWidth), h = Math.round((vv && vv.height) || innerHeight);
    const root = document.documentElement;
    const phoneLike = w <= 520 || h <= 520 || matchMedia('(pointer:coarse)').matches;   // phones / tablets: fill the screen, no device frame
    root.classList.toggle('fullscreen', phoneLike);
    if (!phoneLike) {
      const s = Math.min((h - 90) / 844, (w - 40) / 390, 1.2);
      root.style.setProperty('--scale', Math.max(.3, s).toFixed(4));
      root.style.setProperty('--lift', 0);
      return;
    }
    // Phones: scale exactly to the screen WIDTH so the design touches both edges.
    // The 54px strip at the top (status bar) is empty in the design, so the visible window starts around y=52.
    // If the screen is a little shorter than the design, only the Share button is lifted so it stays on screen.
    const sw = w / 390, Hw = h / sw;                       // design height that fits when scaled to width
    let s, y0, lift = 0;
    if (Hw >= 700) {
      s = sw;
      y0 = Hw >= 844 ? (844 - Hw) / 2 : Math.min((844 - Hw) / 2, 52);
      if (Hw < 844) lift = Math.max(0, 786 - (y0 + Hw));
    } else {                                               // very wide screens (landscape / tablets): fit by height, sides get the page colours
      s = h / 730; y0 = 56;
    }
    root.style.setProperty('--scale', Math.max(.3, s).toFixed(4));
    root.style.setProperty('--sy', (-y0 * s).toFixed(2));
    root.style.setProperty('--lift', lift.toFixed(1));
  }
  if (window.visualViewport) visualViewport.addEventListener('resize', () => fit());
  addEventListener('orientationchange', () => setTimeout(fit, 250));
  addEventListener('resize', fit); fit();

  /* ---------- firework bursts (cover) ---------- */
  $$('[data-burst]').forEach(svg => {
    const [r2, r1, n, color] = svg.dataset.burst.split(',');
    let out = '';
    for (let i = 0; i < +n; i++) {
      const a = (i / n) * Math.PI * 2;
      const long = i % 2 ? 1 : .72;
      const x1 = Math.cos(a) * +r1, y1 = Math.sin(a) * +r1;
      const x2 = Math.cos(a) * (+r1 + (+r2 - +r1) * long), y2 = Math.sin(a) * (+r1 + (+r2 - +r1) * long);
      out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${i % 2 ? 4 : 3}" stroke-linecap="round" opacity="${i % 2 ? .75 : .5}"/>`;
    }
    svg.innerHTML = out;
  });

  /* ---------- progress segments ---------- */
  const progress = $('#progress');
  const segCount = STORY_LAST - STORY_FIRST + 1;
  progress.innerHTML = Array.from({ length: segCount }, () => '<i><b></b></i>').join('');

  function setProgress(n) {                    // n = 1-based screen number
    $$('i', progress).forEach((seg, i) => {
      const idx = STORY_FIRST + i;
      seg.classList.toggle('done', idx < n);
      seg.classList.remove('cur');
      if (idx === n) { void seg.offsetWidth; seg.classList.add('cur'); }
    });
  }

  /* ---------- odometer numbers (rolling digits, same as the v6 reference) ---------- */
  const fmt = n => n.toLocaleString('en-US');
  class Odo {                      // rolling reels with soft-faded edges (same approach as the A prototype)
    constructor(el) { this.el = el; this.target = +el.dataset.to; this.timers = []; this.build(); }
    build() {
      const str = fmt(this.target);
      this.el.innerHTML = ''; this.cells = [];
      [...str].forEach(ch => {
        if (ch === ',') { const c = document.createElement('span'); c.className = 'c'; c.textContent = ','; c.style.setProperty('--k', this.cells.length); this.el.appendChild(c); return; }
        const d = document.createElement('span'); d.className = 'd';
        const r = document.createElement('span'); r.className = 'reel';
        r.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(x => `<i>${x}</i>`).join('');   // extra 0 so a 0 rolls forward
        d.style.setProperty('--k', this.cells.length); r.style.setProperty('--k', this.cells.length);
        r.style.transition = 'none'; r.style.transform = 'translateY(1.6em)';   // start below the window: nothing visible until the roll begins
        d.appendChild(r); this.el.appendChild(d); this.cells.push(r);
      });
      this.grad();
      void this.el.offsetWidth;
      this.cells.forEach(r => { r.style.transition = ''; });
    }
    grad() {                       // each cell is as wide as its own digit; one gradient runs across all digits
      const mc = (Odo.mc = Odo.mc || document.createElement('canvas').getContext('2d'));
      mc.font = '700 100px Poppins, sans-serif';
      const digs = [...fmt(this.target).replace(/,/g, '')];
      $$('.d', this.el).forEach((d, i) => { d.style.width = (mc.measureText(digs[i]).width / 100 * 1.15 * (this.el.closest('.s4, .s9, .s10') ? 0.97 : 1) - 0.03).toFixed(3) + 'em'; });
      const W = this.el.offsetWidth, pad = parseFloat(getComputedStyle(this.el).fontSize) * 0.3;
      $$('.d', this.el).forEach(d => {
        d.style.setProperty('--W', W + 'px');
        d.style.setProperty('--ox', -(d.offsetLeft + pad) + 'px');
      });
      $$('.c', this.el).forEach(c => {            // comma uses the same continuous gradient, so it matches the digits
        c.style.setProperty('--W', W + 'px');
        c.style.setProperty('--ox', -c.offsetLeft + 'px');
      });
    }
    show() {
      this.grad();
      const digs = [...fmt(this.target).replace(/,/g, '')];
      this.cells.forEach((r, i) => { r.style.transform = `translateY(${-(+digs[i] === 0 ? 10 : +digs[i]) * 1.6}em)`; });
      $$('.c', this.el).forEach(c => c.classList.add('on'));          // comma arrives together with the digits
      this.clear();
      this.capT = setTimeout(() => { const st = this.el.closest('.stat'); if (st) st.classList.add('cap-in'); }, 1050 + this.cells.length * 70);   // grey caption follows the number quickly
      this.doneT = setTimeout(() => { const sc = this.el.closest('.screen'); if (sc) sc.classList.add('nums-done'); }, 1500 + this.cells.length * 90 + 150);   // labels (Top 4%...) appear after the numbers finish
      this.landT = setTimeout(() => { this.pulse(); this.idleT = setInterval(() => this.pulse(), 4200); }, 1500 + this.cells.length * 90 + 120);
    }
    pulse() { this.el.classList.remove('hop'); void this.el.offsetWidth; this.el.classList.add('hop'); }
    clear() { this.timers.forEach(t => { clearInterval(t); clearTimeout(t); }); this.timers = []; clearTimeout(this.landT); clearTimeout(this.capT); clearTimeout(this.doneT); clearInterval(this.idleT); }
    reset() { clearTimeout(this.showT); this.clear(); this.el.classList.remove('hop'); const st = this.el.closest('.stat'); if (st) st.classList.remove('cap-in'); const sc = this.el.closest('.screen'); if (sc) sc.classList.remove('nums-done'); this.build(); }
  }
  $$('.count').forEach(el => { el.classList.add('odo'); el._odo = new Odo(el); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => $$('.count').forEach(el => el._odo.grad()));
  function countUp(root) {
    $$('.count', root).forEach(el => { const o = el._odo; o.reset(); o.showT = setTimeout(() => o.show(), 750); });
  }
  function stopCounts(root) { $$('.count', root).forEach(el => el._odo.reset()); }

  /* ---------- navigation ---------- */
  function go(i, dir = 1, mode) {
    if (i < 0 || i >= TOTAL || i === cur || busy) return;
    busy = true; setTimeout(() => busy = false, 380);
    const from = screens[cur], to = screens[i];
    if (from) {
      from.classList.remove('active'); from.classList.add('leaving'); stopCounts(from);
      setTimeout(() => { from.classList.remove('leaving'); }, 850);
    }
    // restart CSS animations on the incoming screen
    if (mode === 'up') {                       // swipe-up transition: new screen slides in from below
      from.classList.add('exit-up');
      setTimeout(() => {                       // reset the old screen silently (no flash)
        from.style.cssText = 'transition:none;opacity:0;visibility:hidden';
        from.classList.remove('exit-up', 'leaving'); void from.offsetWidth; from.style.cssText = '';
      }, 1150);
      to.classList.remove('active'); to.classList.add('enter-up'); void to.offsetWidth;
      to.classList.remove('enter-up'); to.classList.add('sliding', 'active');
      setTimeout(() => to.classList.remove('sliding'), 1150);
    } else {
      to.classList.remove('active'); void to.offsetWidth;
      to.classList.add('active');
    }
    cur = i;
    const n = i + 1;
    const story = n >= STORY_FIRST && n <= STORY_LAST;
    chrome.classList.toggle('on', story);
    sbPlain.classList.toggle('on', !story);
    if (story) {
      pill.src = to.dataset.pillSrc;
      pill.dataset.k = to.dataset.pillSrc.replace(/.*\//, '').replace('.svg', '');
      pill.classList.remove('pop-in'); void pill.offsetWidth; pill.classList.add('pop-in');
      setProgress(n);
    }
    countUp(to);
    if (n === 1) { $('.s11').classList.remove('revealing'); }
    buzz(8);
    syncSides(n);
    history.replaceState(null, '', '#' + n);
  }
  const next = () => cur === 10 ? reveal() : go(cur + 1);
  const prev = () => go(cur - 1, -1);

  function reveal() {
    if (busy || cur !== 10) return;
    buzz([20, 40, 30]);
    go(11, 1, 'up');
  }

  /* ---------- input ---------- */
  let down = null;
  stage.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: Date.now(), target: e.target }; });
  stage.addEventListener('pointerup', e => {
    if (!down) return;
    const d = down; down = null;
    if (d.target.closest('button, .sheet')) return;
    const s = +getComputedStyle(document.documentElement).getPropertyValue('--scale') || 1;
    const dx = (e.clientX - d.x) / s, dy = (e.clientY - d.y) / s;
    const rect = stage.getBoundingClientRect();
    const px = (e.clientX - rect.left) / s, py = (e.clientY - rect.top) / s;
    if (dy < -60 && Math.abs(dx) < 80) { if (cur === 10) reveal(); else if (cur < 10) next(); return; }
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60) { dx < 0 ? next() : prev(); return; }
    if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
      if (cur === 11) { burstAt(px, py, 8); return; }       // final screen: sparkle only
      burstAt(px, py, 7);
      if (px < 110 && cur > 0) prev(); else next();
    }
  });
  addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (cur < 11) next(); }
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowUp' && cur === 10) reveal();
    if (e.key === 'Escape') closeSheet();
  });
  $('[data-next]').addEventListener('click', e => { e.stopPropagation(); burstAt(195, 750, 12); go(1); });
  $('#swipeBtn').addEventListener('click', e => { e.stopPropagation(); reveal(); });
  $('#exitBtn').addEventListener('click', e => { e.stopPropagation(); go(0, -1); });
  $('#replayBtn').addEventListener('click', e => { e.stopPropagation(); go(0, -1); });

  /* ---------- tap sparkles ---------- */
  const fx = $('#tapfx');
  const COLORS = ['#F7CD3D', '#9B75FB', '#5197D8', '#FFB58A', '#DFB2FF'];
  function burstAt(x, y, n = 7) {
    return; // tap sparkles removed
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 44;
      const sp = document.createElement('i');
      sp.className = 'spark';
      sp.style.cssText = `left:${x}px;top:${y}px;--x:${Math.cos(a) * r}px;--y:${Math.sin(a) * r}px;--c:${COLORS[i % COLORS.length]}`;
      fx.appendChild(sp);
      setTimeout(() => sp.remove(), 750);
    }
  }
  function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (_) {} }

  /* ---------- confetti ---------- */
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  let parts = [], raf = 0;
  const CC = ['#F7CD3D', '#9B75FB', '#5197D8', '#FFB58A', '#DFB2FF', '#FAE18B', '#A1D0FB', '#ff9fc4'];
  function confetti(small) {
    const cx = 195, cy = small ? 420 : 300, n = small ? 60 : 110;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - .5) * (small ? 2.6 : 3.1), v = (small ? 7 : 10) + Math.random() * (small ? 7 : 9);
      parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .22 + Math.random() * .1, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5,
        r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: CC[(Math.random() * CC.length) | 0], life: 1, shape: Math.random() < .25 ? 'c' : 'r' });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop() {
    ctx.clearRect(0, 0, 390, 844);
    parts = parts.filter(p => p.life > 0 && p.y < 880);
    for (const p of parts) {
      p.vy += p.g; p.vx *= .992; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= .004;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.shape === 'c') { ctx.beginPath(); ctx.arc(0, 0, p.h / 1.5, 0, 6.3); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(loop) : 0;
    if (!raf) ctx.clearRect(0, 0, 390, 844);
  }

  /* ---------- share sheet ---------- */
  const sheet = $('#sheet');
  let shareTitle = 'Your Furbo 2026 Wrapped';
  function openSheet() {
    const s = screens[cur];
    shareTitle = s.dataset.title || 'Your Furbo 2026 Wrapped';
    $('#sheetTitle').textContent = shareTitle;
    sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
  }
  function closeSheet() { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); }
  // Use the phone's own share sheet (iOS / Android) when available; fall back to the in-page sheet elsewhere.
  async function nativeShare() {
    const s = screens[cur];
    const title = s.dataset.title || 'Your Furbo 2026 Wrapped';
    const url = location.href.split('#')[0];
    const data = { title: 'Furbo 2026 Wrapped', text: title, url };
    if (!navigator.share) { openSheet(); return; }
    try {
      try {
        const blob = await makeImage();
        const file = new File([blob], 'furbo-2026-wrapped.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
      } catch (_) {}
      await navigator.share(data);
    } catch (err) {
      if (err && err.name === 'AbortError') return;   // user closed the sheet
      openSheet();
    }
  }
  $$('[data-share]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); shareTitle = screens[cur].dataset.title || shareTitle; nativeShare(); }));
  $$('[data-close-sheet]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); closeSheet(); }));
  const toast = $('#toast'); let tt;
  function say(msg) { toast.textContent = msg; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('show'), 2200); }

  function makeImage() {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 1080, 1920);
    bg.addColorStop(0, '#FCEBB1'); bg.addColorStop(.55, '#E7D7FB'); bg.addColorStop(1, '#BCD8FB');
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1920);
    g.textAlign = 'center'; g.fillStyle = '#434343';
    g.font = '700 54px Poppins, sans-serif'; g.fillText('Archie & Teddy’s 2026 wrapped', 540, 300);
    g.font = '800 120px Poppins, sans-serif';
    const words = shareTitle.split(' '); let line = '', y = 820; const lines = [];
    words.forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > 900 && line) { lines.push(line); line = w; } else line = t; });
    lines.push(line); lines.forEach((l, i) => g.fillText(l, 540, y + i * 140));
    g.font = '600 44px Poppins, sans-serif'; g.fillStyle = '#696969'; g.fillText('Wrapped by Furbo Nanny', 540, 1640);
    return new Promise(r => c.toBlob(r, 'image/png'));
  }
  $('.sheet-row').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    e.stopPropagation();
    const act = b.dataset.act;
    if (act === 'story') { say('Opening Instagram Stories… (prototype)'); }
    if (act === 'save') {
      const blob = await makeImage(), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'furbo-2026-wrapped.png'; a.click(); say('Image saved');
    }
    if (act === 'copy') {
      try { await navigator.clipboard.writeText(location.href.split('#')[0]); say('Link copied'); } catch (_) { say('Link copied'); }
    }
    if (act === 'more') {
      if (navigator.share) { try { await navigator.share({ title: 'Furbo 2026 Wrapped', text: shareTitle, url: location.href.split('#')[0] }); } catch (_) {} }
      else say('Share sheet is available on mobile');
    }
    closeSheet(); burstAt(195, 700, 10);
  });

  /* ---------- parallax on the result screen ---------- */
  stage.addEventListener('pointermove', e => {
    if (cur !== 11) return;
    const r = stage.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
    $('.r-mascot').style.setProperty('translate', `${nx * -10}px ${ny * -8}px`);
    $('#resultCard').style.transform = `translate(${nx * 6}px,${ny * 4}px)`;
  });

  /* ---------- entrance transitions: objects glide / pop into each screen ---------- */
  const ENTER = {   // screen -> [selector, kind, delay(s)]   kinds: pop | l | r | u | d
    1: [['.mascot', 'pop', .75], ['.s1 .shadow-blob', 'pop', .95]],
    2: [['.ring-img', 'pop', .1], ['.calendar', 'l', .35], ['.s2 .shadow-blob', 'pop', .6]],
    3: [['.s3 .crop', 'u', .3], ['.mascot-wrap', 'l', .4], ['.s3 .shadow-blob', 'pop', .7]],
    4: [['.note-img', 'pop', .5], ['.s4 .mascot-png', 'l', .45], ['.s4 .shadow-blob', 'pop', .8]],
    5: [['.chipL', 'l', .5], ['.chipR', 'r', .7]],
    6: [['.s6 .mascot-png', 'r', .65], ['.s6 .shadow-blob', 'pop', .9]],
    8: [['.phone-img', 'l', .3], ['.app-icon', 'l', .5], ['.s8 .mascot', 'r', .45]],
    9: [['.ghost.g1', 'l', .7], ['.ghost.g2', 'r', .85], ['.mascot-glass', 'pop', .5], ['.s9 .mascot-png', 'pop', .6]],
    10: [['.heart-bub', 'l', .5], ['.device', 'l', .4], ['.wave', 'pop', .75]],
    11: [['.reveal-avatar', 'r', .4]]
  };
  function wrapEnter(el, kind, delay, scr) {
    if (!el || el.parentNode.classList.contains('enw')) return;
    const w = document.createElement('div');
    w.className = 'enw en-' + kind;
    w.style.setProperty('--ed', delay + 's');
    w.style.transformOrigin = (el.offsetLeft + el.offsetWidth / 2) + 'px ' + (el.offsetTop + el.offsetHeight / 2) + 'px';
    el.parentNode.insertBefore(w, el); w.appendChild(el);
  }
  Object.keys(ENTER).forEach(n => {
    const scr = document.querySelector('.screen[data-id="' + n + '"]');
    ENTER[n].forEach(([sel, kind, d]) => $$(sel, scr).forEach((el, i) => wrapEnter(el, kind === 'u' && i % 2 ? 'r' : kind, +(d + i * .12).toFixed(2), scr)));
  });
  $$('.screen').forEach(scr => $$('.star', scr).forEach((el, i) => wrapEnter(el, 'pop', +(.35 + i * .13).toFixed(2), scr)));


  /* ---------- full-screen phones: soft side fills so the page reaches the screen edges (no white columns) ---------- */
  const EDGE = {"1": {"l": ["#fae290", "#fadf82", "#f8e6ab", "#ccbaa6", "#e6dcb2", "#fdf9e7", "#f7faf6", "#dbedfd", "#cee6fd", "#d0e6fd"], "r": ["#e5f2f7", "#dfeefb", "#cfe7fb", "#b49f81", "#edeced", "#faf9ff", "#fbf6ad", "#efd9ff", "#f1dcff", "#f3e1ff"]}, "2": {"l": ["#fdf3cf", "#fdeebd", "#fdefc1", "#fcecbd", "#fcf3e5", "#f6eafd", "#ded7fe", "#f7ebff", "#f9f1ff", "#fdf9ff"], "r": ["#fffdf9", "#fdf9fb", "#faf1fd", "#f2e0ff", "#efd8ff", "#f7edfd", "#ececd7", "#fdf7e1", "#fefaec", "#fefdfa"]}, "3": {"l": ["#fdf5e6", "#fbf2eb", "#f6eaf5", "#f2dffc", "#f2e0ff", "#fcc3fc", "#fafaf9", "#fdfcf3", "#fffdf4", "#fffdf7"], "r": ["#fefefd", "#fffffe", "#fdfeff", "#f3f9ff", "#d7e7fc", "#d5e7fb", "#eaf3f6", "#f9f6e9", "#fdf6e0", "#fef9e4"]}, "4": {"l": ["#f2e0ff", "#f2e1ff", "#f6e9ff", "#faf5ff", "#fcf8ff", "#f7f3fe", "#d9f3fe", "#f8fbff", "#f9fcff", "#fcfeff"], "r": ["#faf4ff", "#fdfaff", "#f8edfe", "#eef7fe", "#ecf6fe", "#e7eefe", "#e2e7fe", "#edf4fe", "#f7fbfe", "#f7fbfe"]}, "5": {"l": ["#fdf2ce", "#fdf1c6", "#fcf2ca", "#fcf2cf", "#fceebe", "#fcedc7", "#fefaef", "#fffdfa", "#fffefd", "#ffffff"], "r": ["#fffefb", "#fefaf0", "#fef2e2", "#fee3c8", "#ffd0b0", "#ffceac", "#ffe0c8", "#fef2e4", "#fffaf5", "#fffdfd"]}, "6": {"l": ["#fdf6db", "#fdf1cc", "#fdf2d1", "#fdf2d3", "#fbf6f1", "#f8effe", "#f8eeff", "#fdfaff", "#fffeff", "#ffffff"], "r": ["#fffefb", "#fefcfb", "#fdf9fd", "#f8efff", "#f5e6ff", "#f3e3ff", "#f6e8ff", "#fcf7ff", "#fefdff", "#fffeff"]}, "7": {"l": ["#ffe5d7", "#ffdfcd", "#ffd5c0", "#fdd9ca", "#f8dee4", "#f2def7", "#f1dcfe", "#f5e5fc", "#f9f0fe", "#fdfbff"], "r": ["#f6e6fa", "#f5e3f6", "#f7e7eb", "#fefcf6", "#fef4d4", "#fdefc3", "#fdf1cd", "#fef9ea", "#fefcf5", "#fffefc"]}, "8": {"l": ["#fef4d6", "#fdf1cf", "#fde8c5", "#fedec0", "#ffe6d5", "#fffcfa", "#f1eefe", "#fcf0fc", "#fefeff", "#ffffff"], "r": ["#fef9ea", "#fef8e3", "#fef8e4", "#fefbf0", "#fbf0ed", "#f8f5fb", "#f8efff", "#fbf4ff", "#fdfbff", "#fefeff"]}, "9": {"l": ["#f5e7ff", "#f3e3ff", "#f3e4ff", "#f5ecff", "#f2f5ff", "#e6eefe", "#f6efff", "#fbf6ff", "#fdfcff", "#ffffff"], "r": ["#fefeff", "#fffeff", "#ffffff", "#ffffff", "#f4c6fc", "#fcfeff", "#f7fbff", "#ffffff", "#ffffff", "#ffffff"]}, "10": {"l": ["#ffefdf", "#ffe8d5", "#fee8d7", "#fdeee9", "#fdf6f8", "#faf3ff", "#f9f0ff", "#fefcff", "#fffeff", "#fffeff"], "r": ["#faf4ff", "#f5e7ff", "#f2e0ff", "#f3e3ff", "#f6e8ff", "#fdf9ff", "#fdfdff", "#ffffff", "#ffffff", "#ffffff"]}, "11": {"l": ["#fef8d8", "#fef2c6", "#ffe6c4", "#fecdc9", "#fee0c2", "#fef1e4", "#fefefe", "#ffffff", "#fefdff", "#fdfaff"], "r": ["#cbe4fd", "#bedefc", "#b3d6fd", "#d8c6fc", "#e5d1fd", "#fef4c8", "#fdfcfe", "#fbf8fe", "#fdf9fe", "#fefefe"]}, "12": {"l": ["#fef2c9", "#fdf2c8", "#fef1c7", "#feddb7", "#ffd8c5", "#feeace", "#feebe2", "#fee6c3", "#fee0b7", "#fedbb6"], "r": ["#bddafe", "#aed2fd", "#cadefd", "#fdefa4", "#debcfd", "#efe3fe", "#feede7", "#faf4da", "#fbedbb", "#fae6a0"]}};
  const EDGE_Y = [2, 70, 140, 230, 330, 440, 560, 680, 760, 840];
  const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const med3 = (a, b, c) => [a, b, c].sort((x, y) => x - y)[1];
  function smooth(col) {                          // median of neighbours removes photo / sticker pixels from the edge sample
    const rgb = col.map(hex2);
    return rgb.map((p, i) => { const q = rgb[Math.max(0, i - 1)], r = rgb[Math.min(rgb.length - 1, i + 1)]; return '#' + [0, 1, 2].map(k => med3(q[k], p[k], r[k]).toString(16).padStart(2, '0')).join(''); });
  }
  const sides = $('#sides');
  if (sides) {
    Object.keys(EDGE).forEach(n => {
      const wrap = document.createElement('div'); wrap.className = 'sf'; wrap.dataset.n = n;
      ['l', 'r'].forEach(sd => {
        const d = document.createElement('div'); d.className = sd;
        const stops = smooth(EDGE[n][sd]).map((c, i) => c + ' ' + (EDGE_Y[i] / 844 * 100).toFixed(1) + '%').join(',');
        d.style.background = 'linear-gradient(180deg,' + stops + ')';
        wrap.appendChild(d);
      });
      sides.appendChild(wrap);
    });
  }
  function syncSides(n) { $$('.sf', sides || document).forEach(e => e.classList.toggle('on', +e.dataset.n === n)); }

  /* ---------- boot ---------- */
  const start = Math.min(TOTAL, Math.max(1, parseInt(location.hash.slice(1), 10) || 1)) - 1;
  cur = -1; busy = false;
  go(start);
  addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n <= TOTAL && n - 1 !== cur) { busy = false; go(n - 1); } });
})();
