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
    const w = innerWidth, h = innerHeight;
    const s = w <= 520 ? Math.min(w / 390, h / 844) : Math.min((h - 90) / 844, (w - 40) / 390, 1.2);
    document.documentElement.style.setProperty('--scale', Math.max(.3, s).toFixed(4));
  }
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
        if (ch === ',') { const c = document.createElement('span'); c.className = 'c'; c.textContent = ','; this.el.appendChild(c); return; }
        const d = document.createElement('span'); d.className = 'd';
        const r = document.createElement('span'); r.className = 'reel';
        r.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(x => `<i>${x}</i>`).join('');   // extra 0 so a 0 rolls forward
        d.style.setProperty('--k', this.cells.length); r.style.setProperty('--k', this.cells.length);
        r.style.transition = 'none'; r.style.transform = 'translateY(0)';
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
      $$('.d', this.el).forEach((d, i) => { d.style.width = (mc.measureText(digs[i]).width / 100 - 0.03).toFixed(3) + 'em'; });
      const W = this.el.offsetWidth, pad = parseFloat(getComputedStyle(this.el).fontSize) * 0.1;
      $$('.d', this.el).forEach(d => {
        d.style.setProperty('--W', W + 'px');
        d.style.setProperty('--ox', -(d.offsetLeft + pad) + 'px');
      });
    }
    show() {
      this.grad();
      const digs = [...fmt(this.target).replace(/,/g, '')];
      this.cells.forEach((r, i) => { r.style.transform = `translateY(${-(+digs[i] === 0 ? 10 : +digs[i]) * 1.6}em)`; });
      this.clear();
      this.landT = setTimeout(() => { this.pulse(); this.idleT = setInterval(() => this.pulse(), 4200); }, 1500 + this.cells.length * 90 + 120);
    }
    pulse() { this.el.classList.remove('hop'); void this.el.offsetWidth; this.el.classList.add('hop'); }
    clear() { this.timers.forEach(t => { clearInterval(t); clearTimeout(t); }); this.timers = []; clearTimeout(this.landT); clearInterval(this.idleT); }
    reset() { clearTimeout(this.showT); this.clear(); this.el.classList.remove('hop'); this.build(); }
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
      }, 800);
      to.classList.remove('active'); to.classList.add('enter-up'); void to.offsetWidth;
      to.classList.remove('enter-up'); to.classList.add('sliding', 'active');
      setTimeout(() => to.classList.remove('sliding'), 800);
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
  $$('[data-share]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openSheet(); }));
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

  /* ---------- boot ---------- */
  const start = Math.min(TOTAL, Math.max(1, parseInt(location.hash.slice(1), 10) || 1)) - 1;
  cur = -1; busy = false;
  go(start);
  addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n <= TOTAL && n - 1 !== cur) { busy = false; go(n - 1); } });
})();
