/* =========================================================
   Góc giữa hai vectơ – Hoạt động tương tác Toán 10 (Hình 5.41)
   Make by Nguyễn Thành Khoa
   Chuẩn hóa: Dùng \overrightarrow, parse toán học và tiếng Việt chuẩn xác
   ========================================================= */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* =========================================================
     BỘ RENDER TOÁN HỌC KATEX CHUẨN XÁC
     Không bao giờ đưa nguyên câu tiếng Việt vào KaTeX!
     ========================================================= */
  function renderLatex(latex, displayMode = false) {
    if (window.katex && typeof window.katex.renderToString === 'function') {
      try {
        return window.katex.renderToString(latex, {
          displayMode: displayMode,
          throwOnError: false
        });
      } catch (err) {
        console.warn('KaTeX render error:', err);
      }
    }
    return `<span class="tex-fallback">${latex}</span>`;
  }

  // Tách và render chuỗi văn bản hỗn hợp (Tiếng Việt xen kẽ $...$ và $$...$$)
  function formatMathText(str) {
    if (!str) return '';
    // 1. Thay thế block math $$...$$
    let out = str.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
      return renderLatex(expr.trim(), true);
    });
    // 2. Thay thế inline math $...$
    out = out.replace(/\$([^$]+?)\$/g, (_, expr) => {
      return renderLatex(expr.trim(), false);
    });
    return out;
  }

  // Quét và render các phần tử .math-render trên trang
  function renderAllMathInPage(container = document) {
    const elements = container.querySelectorAll('.math-render');
    elements.forEach(elem => {
      const raw = elem.dataset.math || elem.textContent.trim();
      if (raw) {
        elem.innerHTML = renderLatex(raw, false);
      }
    });
  }

  /* =========================================================
     ÂM THANH TƯƠNG TÁC (WEB AUDIO API)
     ========================================================= */
  const sfx = (() => {
    let ctx = null, on = true;
    function tone(f, d = 0.12, type = 'sine', vol = 0.08, delay = 0) {
      if (!on) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        const t = ctx.currentTime + delay;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + d + 0.03);
      } catch (_) { /* */ }
    }
    return {
      click: () => tone(520, 0.08, 'triangle', 0.05),
      pick: () => tone(520, 0.08, 'triangle', 0.045),
      snap: () => { tone(660, 0.09, 'triangle', 0.06); tone(880, 0.12, 'triangle', 0.06, 0.06); },
      miss: () => tone(240, 0.16, 'sawtooth', 0.04),
      win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.09)),
      wrong: () => tone(220, 0.22, 'sawtooth', 0.06),
      step: () => { tone(440, 0.08, 'sine', 0.05); tone(660, 0.1, 'sine', 0.05, 0.06); },
      toggle() { on = !on; return on; },
      isOn() { return on; }
    };
  })();

  /* =========================================================
     CÔNG CỤ ANIMATION & HÌNH HỌC TƯƠNG TÁC
     ========================================================= */
  const ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };

  function tween(dur, fn, easing = ease.outCubic) {
    if (dur <= 16) {
      fn(1);
      return Promise.resolve();
    }
    return new Promise((res) => {
      const t0 = performance.now();
      let done = false;
      function finish() {
        if (!done) {
          done = true;
          fn(1);
          res();
        }
      }
      const frame = (now) => {
        if (done) return;
        const current = (typeof now === 'number') ? now : performance.now();
        const t = Math.min(1, Math.max(0, (current - t0) / dur));
        fn(easing(t));
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          finish();
        }
      };
      requestAnimationFrame(frame);
      // Timeout dự phòng khi tab chạy nền hoặc môi trường headless
      setTimeout(finish, dur + 40);
    });
  }

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  /* =========================================================
     TOAST THÔNG BÁO
     ========================================================= */
  let toastTimer;
  function toast(msgHtml, type = 'info') {
    const t = $('#toast');
    if (!t) return;
    t.innerHTML = msgHtml;
    t.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = `toast ${type}`; }, 2800);
  }

  /* =========================================================
     CONFETTI HIỆU ỨNG CHIẾN THẮNG
     ========================================================= */
  const confetti = (() => {
    const cv = $('#confetti'), ctx2 = cv ? cv.getContext('2d') : null;
    let parts = [], running = false, dpr = 1;
    function resize() {
      if (!cv) return;
      dpr = window.devicePixelRatio || 1;
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    }
    window.addEventListener('resize', resize); resize();
    const cols = ['#1E9BE6', '#36BD96', '#F25C45', '#F39A1E', '#FFD54F', '#8E44AD'];
    function burst(n = 140) {
      if (!cv || !ctx2) return;
      for (let i = 0; i < n; i++) {
        const fromLeft = i % 2 === 0;
        parts.push({
          x: fromLeft ? -10 : innerWidth + 10, y: innerHeight * (0.5 + Math.random() * 0.3),
          vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 10), vy: -(9 + Math.random() * 13),
          s: 6 + Math.random() * 8, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35,
          c: cols[i % cols.length], round: Math.random() < 0.3, life: 0,
        });
      }
      if (!running) { running = true; requestAnimationFrame(loop); }
    }
    function loop() {
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter(p => {
        p.life++; p.x += p.vx; p.y += p.vy; p.vy += 0.42; p.r += p.vr;
        ctx2.save(); ctx2.translate(p.x, p.y); ctx2.rotate(p.r);
        ctx2.fillStyle = p.c;
        if (p.round) {
          ctx2.beginPath(); ctx2.arc(0, 0, p.s * 0.5, 0, Math.PI * 2); ctx2.fill();
        } else {
          ctx2.fillRect(-p.s * 0.5, -p.s * 0.5, p.s, p.s * 0.6);
        }
        ctx2.restore();
        return p.y < innerHeight + 40 && p.life < 180;
      });
      if (parts.length > 0) requestAnimationFrame(loop);
      else { running = false; ctx2.clearRect(0, 0, innerWidth, innerHeight); }
    }
    return { burst };
  })();

    /* =========================================================
     HỆ THỐNG LƯỚI Ô VUÔNG & VẼ SVG THEO CHUẨN FILE GỐC
     - Lưới ô vuông với viền bo góc board-wrap và đường kẻ .grid-line
     - Vectơ: makeArrow (shaft + polyline head nét 6px bo tròn), bộ lọc feDropShadow
     - Nhãn vectơ: makeVecLabel + drawSmallArrow kèm paint-order stroke trắng 6px
     - Điểm O: pt-dot + pt-label + hint-ring hiệu ứng sóng gợn ripple vàng cam
     ========================================================= */
  const CELL = 40;
  const COLS = 21;
  const ROWS = 13;
  const W = 840;
  const H = 520;

  function toScreen(gx, gy) {
    return { x: gx * CELL, y: H - gy * CELL };
  }
  function toGrid(sx, sy) {
    return {
      x: sx / CELL,
      y: (H - sy) / CELL
    };
  }

  function calcVectorAngle(vx1, vy1, vx2, vy2) {
    const dot = vx1 * vx2 + vy1 * vy2;
    const len1 = Math.hypot(vx1, vy1);
    const len2 = Math.hypot(vx2, vy2);
    if (len1 === 0 || len2 === 0) return 0;
    let cos = dot / (len1 * len2);
    cos = Math.max(-1, Math.min(1, cos));
    const rad = Math.acos(cos);
    return Math.round((rad * 180) / Math.PI * 10) / 10;
  }

  /* Vẽ lưới ô vuông chuẩn file gốc */
  function drawBoardGrid(svg, showGrid = true) {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = el('defs', {}, svg);
      defs.innerHTML = `
        <filter id="shadow" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
          <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#0b3b33" flood-opacity=".22"/>
        </filter>
        <filter id="lift" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
          <feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#0b3b33" flood-opacity=".3"/>
        </filter>`;
    }

    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }, svg);

    if (showGrid) {
      const gGrid = el('g', { class: 'grid-layer' }, svg);
      for (let x = 0; x <= COLS; x++) {
        el('line', { class: 'grid-line', x1: x * CELL, y1: 0, x2: x * CELL, y2: H }, gGrid);
      }
      for (let y = 0; y <= ROWS; y++) {
        el('line', { class: 'grid-line', x1: 0, y1: y * CELL, x2: W, y2: y * CELL }, gGrid);
      }
    }
  }

  /* Tạo mũi tên makeArrow chuẩn file gốc (shaft + head polyline nét dày 6px bo góc) */
  function makeArrow(parent, color, width = 6) {
    const shaft = el('line', { class: 'shaft', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' }, parent);
    const head = el('polyline', { class: 'head', fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
    return {
      shaft, head,
      set(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
        shaft.setAttribute('x1', x1); shaft.setAttribute('y1', y1);
        shaft.setAttribute('x2', x2); shaft.setAttribute('y2', y2);
        if (L < 2) { head.setAttribute('points', ''); return; }
        const ang = Math.atan2(dy, dx), hl = Math.min(18, L * 0.6), sp = 0.52;
        const p1 = [x2 - hl * Math.cos(ang - sp), y2 - hl * Math.sin(ang - sp)];
        const p2 = [x2 - hl * Math.cos(ang + sp), y2 - hl * Math.sin(ang + sp)];
        head.setAttribute('points', `${p1} ${x2},${y2} ${p2}`);
      },
    };
  }

  /* Vẽ mũi tên nhỏ trên đầu nhãn vectơ chuẩn file gốc (drawSmallArrow) */
  function drawSmallArrow(g, x1, x2, y, color) {
    // Viền trắng bảo vệ giúp mũi tên luôn nổi bật trên nền lưới
    el('line', { x1, y1: y, x2, y2: y, stroke: '#fff', 'stroke-width': 5.5, 'stroke-linecap': 'round' }, g);
    el('polyline', { points: `${x2 - 5},${y - 4} ${x2},${y} ${x2 - 5},${y + 4}`, fill: 'none', stroke: '#fff', 'stroke-width': 5.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    // Thân và đầu mũi tên màu vectơ
    el('line', { x1, y1: y, x2, y2: y, stroke: color, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, g);
    el('polyline', { points: `${x2 - 5},${y - 4} ${x2},${y} ${x2 - 5},${y + 4}`, fill: 'none', stroke: color, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  }

  /* Tạo nhãn vectơ makeVecLabel chuẩn file gốc với chữ nghiêng serif và viền trắng stroke */
  function makeVecLabel(parent, letter, color, size = 30) {
    const g = el('g', { class: 'vlabel' }, parent);
    const t = el('text', {
      x: 0, y: 0,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      fill: color, 'font-size': size
    }, g);
    t.textContent = letter;
    const isMulti = letter.length >= 2;
    const x1 = isMulti ? -18 : -12;
    const x2 = isMulti ? 18 : 13;
    drawSmallArrow(g, x1, x2, -size * 0.62, color);
    return g;
  }

  /* Vẽ vectơ hoàn chỉnh có bóng đổ, nhãn và vùng cảm ứng nhạy bén (hit-area) */
  function drawVector(svgParent, x1, y1, x2, y2, color, labelName = '', options = {}) {
    const g = el('g', { class: 'vector', filter: 'url(#shadow)' }, svgParent);

    // Vùng cảm ứng rộng 54px với alpha > 0 để chạm hoặc click chuột cực nhạy
    if (options.interactive !== false) {
      el('line', {
        class: 'vector-hit-area',
        x1, y1, x2, y2,
        stroke: 'rgba(0,0,0,0.001)',
        'stroke-width': 54,
        'stroke-linecap': 'round'
      }, g);
    }

    const arrow = makeArrow(g, color, options.width || 6);
    arrow.set(x1, y1, x2, y2);

    if (labelName) {
      const dx = x2 - x1, dy = y2 - y1;
      const l = Math.hypot(dx, dy) || 1;
      let nx = -dy / l, ny = dx / l;
      if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
      const offset = options.labelOffset !== undefined ? options.labelOffset : 28;
      const side = options.labelSide || 1;
      const midX = (x1 + x2) / 2 + nx * offset * side;
      const midY = (y1 + y2) / 2 + ny * offset * side;

      const lbl = makeVecLabel(g, labelName, color, options.fontSize || 30);
      lbl.setAttribute('transform', `translate(${midX},${midY})`);
    }

    return g;
  }

  /* Vẽ bóng mờ vectơ ở vị trí ban đầu (ghost vector) */
  function drawGhostVector(parent, x1, y1, x2, y2, color, labelName = '') {
    const g = el('g', { class: 'ghost show' }, parent);
    const arrow = makeArrow(g, color, 4);
    arrow.shaft.setAttribute('stroke-dasharray', '8 6');
    arrow.set(x1, y1, x2, y2);
    if (labelName) {
      const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
      let nx = -dy / l, ny = dx / l;
      if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
      const midX = (x1 + x2) / 2 + nx * 24;
      const midY = (y1 + y2) / 2 + ny * 24;
      const lbl = makeVecLabel(g, labelName, color, 24);
      lbl.setAttribute('transform', `translate(${midX},${midY})`);
    }
    return g;
  }

  /* Vẽ điểm gốc O với vòng ripple gợn sóng màu vàng cam hint-ring chuẩn file gốc */
  function drawPointWithHalo(parent, x, y, name, options = {}) {
    const g = el('g', { class: 'point-group' }, parent);
    if (options.id) g.id = options.id;

    // Vòng tròn gợn sóng vàng cam ripple (ảnh 2)
    if (!options.hideRing) {
      const gRing = el('g', { class: `ring-layer${options.isNear ? ' near' : ''}` }, g);
      el('circle', { class: 'hint-ring', r: 14, cx: x, cy: y }, gRing);
      el('circle', { class: 'hint-ring r2', r: 14, cx: x, cy: y }, gRing);
    }

    // Chấm tâm đen viền trắng
    el('circle', { class: 'pt-dot', cx: x, cy: y, r: options.r || 7.5 }, g);

    // Tên điểm bằng chữ nghiêng lớn viền trắng stroke 6px
    if (name) {
      const offX = options.labelOffsetX !== undefined ? options.labelOffsetX : -18;
      const offY = options.labelOffsetY !== undefined ? options.labelOffsetY : -18;
      const t = el('text', {
        class: 'pt-label',
        x: x + offX, y: y + offY,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': options.fontSize || '28px'
      }, g);
      t.textContent = name;
    }

    if (options.draggable) {
      el('circle', { cx: x, cy: y, r: 28, fill: 'transparent', class: 'svg-point-draggable', style: 'cursor: grab;' }, g);
    }

    return g;
  }

  /* Vẽ điểm mút terminal A, B */
  function drawPointDot(parent, x, y, name, color, options = {}) {
    const g = el('g', { class: 'point-group' }, parent);
    el('circle', { class: 'pt-dot', cx: x, cy: y, r: 6.5, fill: color || '#1f2a37' }, g);
    if (name) {
      const offX = options.labelOffsetX !== undefined ? options.labelOffsetX : 16;
      const offY = options.labelOffsetY !== undefined ? options.labelOffsetY : -16;
      const t = el('text', {
        class: 'pt-label',
        x: x + offX, y: y + offY,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': '26px',
        fill: color || '#1f2a37'
      }, g);
      t.textContent = name;
    }
    if (options.draggable) {
      el('circle', { cx: x, cy: y, r: 24, fill: 'transparent', style: 'cursor: grab;' }, g);
    }
    return g;
  }

  /* Hộp badge nhãn vectơ màu trắng bo góc nổi trên lưới (như web gốc) */
  function drawAngleArc(svgParent, ox, oy, ax, ay, bx, by, angleDeg, options = {}) {
    const g = el('g', { class: 'angle-arc-group' }, svgParent);
    if (angleDeg < 0.2) {
      // 0 độ (cùng hướng)
      const r = 26;
      const a1 = Math.atan2(ay - oy, ax - ox);
      const arcX = ox + r * Math.cos(a1);
      const arcY = oy + r * Math.sin(a1);
      el('circle', {
        cx: arcX, cy: arcY, r: 4, fill: '#f59e0b', stroke: '#fff', 'stroke-width': 1.5
      }, g);

      const lx = ox + (r + 26) * Math.cos(a1);
      const ly = oy + (r + 26) * Math.sin(a1);
      el('rect', {
        x: lx - 20, y: ly - 11, width: 40, height: 22, rx: 6,
        fill: '#fef3c7', stroke: '#f59e0b', 'stroke-width': 1.4,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))'
      }, g);
      const txt = el('text', {
        x: lx, y: ly + 1, class: 'svg-angle-text', 'font-size': '12px'
      }, g);
      txt.textContent = '0°';
      return g;
    }

    const r = options.radius || 38;
    const a1 = Math.atan2(ay - oy, ax - ox);
    const a2 = Math.atan2(by - oy, bx - ox);

    // Kí hiệu vuông góc 90 độ
    if (Math.abs(angleDeg - 90) < 0.5 && options.drawSquareFor90) {
      const sq = 18;
      const u1x = Math.cos(a1), u1y = Math.sin(a1);
      const u2x = Math.cos(a2), u2y = Math.sin(a2);
      const p1x = ox + u1x * sq, p1y = oy + u1y * sq;
      const p2x = ox + u2x * sq, p2y = oy + u2y * sq;
      const pCornerX = ox + (u1x + u2x) * sq, pCornerY = oy + (u1y + u2y) * sq;

      el('polygon', {
        points: `${ox},${oy} ${p1x},${p1y} ${pCornerX},${pCornerY} ${p2x},${p2y}`,
        fill: 'rgba(243, 156, 18, 0.28)',
        stroke: '#f39c12',
        'stroke-width': 2.2
      }, g);

      const lblX = ox + (u1x + u2x) * (sq * 1.35);
      const lblY = oy + (u1y + u2y) * (sq * 1.35);

      el('rect', {
        x: lblX - 18, y: lblY - 11, width: 36, height: 22, rx: 6,
        fill: '#fef3c7', stroke: '#f59e0b', 'stroke-width': 1.4,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))'
      }, g);
      const txt = el('text', {
        x: lblX, y: lblY + 1, class: 'svg-angle-text', 'font-size': '12px'
      }, g);
      txt.textContent = '90°';
      return g;
    }

    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    const sweepFlag = diff > 0 ? 1 : 0;
    const startX = ox + r * Math.cos(a1);
    const startY = oy + r * Math.sin(a1);
    const endX = ox + r * Math.cos(a2);
    const endY = oy + r * Math.sin(a2);
    const largeArc = Math.abs(diff) > Math.PI ? 1 : 0;

    const pathData = `M ${ox} ${oy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${endX} ${endY} Z`;

    el('path', { d: pathData, class: 'svg-angle-sector' }, g);

    const midAngle = a1 + diff / 2;
    const labelR = r + 18;
    const lx = ox + labelR * Math.cos(midAngle);
    const ly = oy + labelR * Math.sin(midAngle);

    el('rect', {
      x: lx - 22, y: ly - 11, width: 44, height: 22, rx: 6,
      fill: '#fef3c7', stroke: '#f59e0b', 'stroke-width': 1.4,
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))'
    }, g);

    const txt = el('text', {
      x: lx, y: ly + 1, class: 'svg-angle-text', 'font-size': '12px'
    }, g);
    txt.textContent = `${Math.round(angleDeg)}°`;

    return g;
  }

  // Vẽ thước đo độ ảo với thiết kế acrylic sắc nét và animation quét góc
  function drawProtractor(svgParent, ox, oy, ax, ay, bx, by, animState = null) {
    const a1 = Math.atan2(ay - oy, ax - ox);
    const a2 = Math.atan2(by - oy, bx - ox);

    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff <= -Math.PI) diff += 2 * Math.PI;

    const dir = diff >= 0 ? 1 : -1;
    const targetDeg = Math.round((Math.abs(diff) * 180) / Math.PI * 10) / 10;

    const rad = (deg) => a1 + dir * ((deg * Math.PI) / 180);

    const R = 132;
    const Rin = 38;

    const gProtractor = el('g', {
      class: 'protractor-group',
      id: 'svg-protractor'
    }, svgParent);

    // Áp dụng scale và opacity nếu đang animation
    if (animState && animState.scale !== undefined) {
      const s = animState.scale;
      const op = animState.opacity !== undefined ? animState.opacity : 1;
      gProtractor.setAttribute('transform', `translate(${ox}, ${oy}) scale(${s}) translate(${-ox}, ${-oy})`);
      gProtractor.setAttribute('opacity', op);
    }

    // 1. Thân thước bán nguyệt nhựa acrylic trong suốt (annular semicircle)
    const p0Out = { x: ox + R * Math.cos(a1), y: oy + R * Math.sin(a1) };
    const p90Out = { x: ox + R * Math.cos(rad(90)), y: oy + R * Math.sin(rad(90)) };
    const p180Out = { x: ox + R * Math.cos(rad(180)), y: oy + R * Math.sin(rad(180)) };
    const p180In = { x: ox + Rin * Math.cos(rad(180)), y: oy + Rin * Math.sin(rad(180)) };
    const p90In = { x: ox + Rin * Math.cos(rad(90)), y: oy + Rin * Math.sin(rad(90)) };
    const p0In = { x: ox + Rin * Math.cos(a1), y: oy + Rin * Math.sin(a1) };

    const sweepFlagOut = dir > 0 ? 1 : 0;
    const sweepFlagIn = dir > 0 ? 0 : 1;

    const bodyPath = `M ${p0Out.x} ${p0Out.y} ` +
      `A ${R} ${R} 0 0 ${sweepFlagOut} ${p90Out.x} ${p90Out.y} ` +
      `A ${R} ${R} 0 0 ${sweepFlagOut} ${p180Out.x} ${p180Out.y} ` +
      `L ${p180In.x} ${p180In.y} ` +
      `A ${Rin} ${Rin} 0 0 ${sweepFlagIn} ${p90In.x} ${p90In.y} ` +
      `A ${Rin} ${Rin} 0 0 ${sweepFlagIn} ${p0In.x} ${p0In.y} Z`;

    el('path', {
      d: bodyPath,
      class: 'svg-protractor-body',
      fill: 'rgba(240, 249, 255, 0.9)',
      stroke: '#0284c7',
      'stroke-width': 2,
      filter: 'drop-shadow(0 4px 10px rgba(2, 132, 199, 0.22))'
    }, gProtractor);

    // 2. Vành thước phía đáy thước (thanh thẳng đáy thước nối tâm ngắm)
    const baseP1 = { x: ox + (R + 6) * Math.cos(a1), y: oy + (R + 6) * Math.sin(a1) };
    const baseP2 = { x: ox + (R + 6) * Math.cos(rad(180)), y: oy + (R + 6) * Math.sin(rad(180)) };
    el('line', {
      x1: baseP1.x, y1: baseP1.y, x2: baseP2.x, y2: baseP2.y,
      stroke: '#0284c7', 'stroke-width': 2.2, 'stroke-linecap': 'round'
    }, gProtractor);

    // Vạch chuẩn 0° và 180° ở hai đầu đáy thước
    const lbl0X = ox + (R + 18) * Math.cos(a1);
    const lbl0Y = oy + (R + 18) * Math.sin(a1);
    const t0 = el('text', {
      x: lbl0X, y: lbl0Y,
      class: 'svg-protractor-base-lbl',
      'text-anchor': 'middle', 'dominant-baseline': 'central'
    }, gProtractor);
    t0.textContent = '0°';

    const lbl180X = ox + (R + 20) * Math.cos(rad(180));
    const lbl180Y = oy + (R + 20) * Math.sin(rad(180));
    const t180 = el('text', {
      x: lbl180X, y: lbl180Y,
      class: 'svg-protractor-base-lbl',
      'text-anchor': 'middle', 'dominant-baseline': 'central'
    }, gProtractor);
    t180.textContent = '180°';

    // 3. Tâm thước ngắm chữ thập tại gốc O
    el('circle', { cx: ox, cy: oy, r: 4.5, fill: '#fff', stroke: '#0284c7', 'stroke-width': 1.8 }, gProtractor);
    el('circle', { cx: ox, cy: oy, r: 1.6, fill: '#0284c7' }, gProtractor);
    const perpAng = a1 + (dir > 0 ? 1 : -1) * (Math.PI / 2);
    el('line', {
      x1: ox, y1: oy,
      x2: ox + Rin * Math.cos(perpAng), y2: oy + Rin * Math.sin(perpAng),
      stroke: 'rgba(2, 132, 199, 0.55)', 'stroke-width': 1.4, 'stroke-dasharray': '3 2'
    }, gProtractor);

    // 4. Các vạch chia độ và chữ số trên vành thước
    const gTicks = el('g', { class: 'protractor-ticks' }, gProtractor);
    for (let d = 0; d <= 180; d++) {
      const a = rad(d);
      const isMajor = d % 10 === 0;
      const isMed = !isMajor && d % 5 === 0;
      const isTarget = Math.abs(d - targetDeg) < 0.5;

      // Không vẽ vạch 1 độ cho tất cả nếu dày quá, vẽ mỗi 2 độ hoặc 1 độ
      if (!isMajor && !isMed && d % 2 !== 0) continue;

      let len = isMajor ? 13 : (isMed ? 8 : 4.5);
      if (isTarget) len = 17;

      const pOuter = { x: ox + R * Math.cos(a), y: oy + R * Math.sin(a) };
      const pInner = { x: ox + (R - len) * Math.cos(a), y: oy + (R - len) * Math.sin(a) };

      let strokeColor = '#0369a1';
      let strokeW = 1.6;
      if (isTarget) {
        strokeColor = '#ea580c';
        strokeW = 3;
      } else if (isMed) {
        strokeColor = '#0284c7';
        strokeW = 1.2;
      } else if (!isMajor) {
        strokeColor = '#94a3b8';
        strokeW = 0.8;
      }

      el('line', {
        x1: pOuter.x, y1: pOuter.y, x2: pInner.x, y2: pInner.y,
        stroke: strokeColor, 'stroke-width': strokeW, 'stroke-linecap': 'round'
      }, gTicks);

      // Chữ số đo độ mỗi 10 độ
      if (isMajor && d > 0 && d < 180) {
        const rText = R - 23;
        const tx = ox + rText * Math.cos(a);
        const ty = oy + rText * Math.sin(a);
        const t = el('text', {
          x: tx, y: ty,
          class: isTarget ? 'svg-protractor-text target' : 'svg-protractor-text',
          'text-anchor': 'middle', 'dominant-baseline': 'central'
        }, gTicks);
        t.textContent = `${d}°`;
      }
    }

    // 5. CUNG QUÉT ĐỘ ĐỘNG (NẾU ĐANG ANIMATION HOẶC ĐÃ ĐO XONG)
    const isScanning = animState && animState.isScanning;
    const currentAngle = animState ? animState.sweepAngle : (hd1State.step >= 2 ? targetDeg : 0);

    if (currentAngle > 0.5) {
      const gScan = el('g', { class: 'protractor-scan-layer' }, gProtractor);
      const sweepRad = rad(currentAngle);

      // Sector quét màu vàng cam hổ phách
      const scanP0 = { x: ox + R * Math.cos(a1), y: oy + R * Math.sin(a1) };
      const scanPend = { x: ox + R * Math.cos(sweepRad), y: oy + R * Math.sin(sweepRad) };
      const scanPendIn = { x: ox + Rin * Math.cos(sweepRad), y: oy + Rin * Math.sin(sweepRad) };
      const scanP0In = { x: ox + Rin * Math.cos(a1), y: oy + Rin * Math.sin(a1) };

      let scanPath = '';
      if (currentAngle >= 179.5) {
        const scanP90 = { x: ox + R * Math.cos(rad(90)), y: oy + R * Math.sin(rad(90)) };
        const scanP90In = { x: ox + Rin * Math.cos(rad(90)), y: oy + Rin * Math.sin(rad(90)) };
        scanPath = `M ${scanP0.x} ${scanP0.y} ` +
          `A ${R} ${R} 0 0 ${sweepFlagOut} ${scanP90.x} ${scanP90.y} ` +
          `A ${R} ${R} 0 0 ${sweepFlagOut} ${scanPend.x} ${scanPend.y} ` +
          `L ${scanPendIn.x} ${scanPendIn.y} ` +
          `A ${Rin} ${Rin} 0 0 ${sweepFlagIn} ${scanP90In.x} ${scanP90In.y} ` +
          `A ${Rin} ${Rin} 0 0 ${sweepFlagIn} ${scanP0In.x} ${scanP0In.y} Z`;
      } else {
        scanPath = `M ${scanP0.x} ${scanP0.y} ` +
          `A ${R} ${R} 0 0 ${sweepFlagOut} ${scanPend.x} ${scanPend.y} ` +
          `L ${scanPendIn.x} ${scanPendIn.y} ` +
          `A ${Rin} ${Rin} 0 0 ${sweepFlagIn} ${scanP0In.x} ${scanP0In.y} Z`;
      }

      el('path', {
        d: scanPath,
        fill: 'rgba(245, 158, 11, 0.28)',
        stroke: 'none'
      }, gScan);

      // Kim quét góc (Scanner Ray)
      const rayEnd = { x: ox + (R + 4) * Math.cos(sweepRad), y: oy + (R + 4) * Math.sin(sweepRad) };
      el('line', {
        x1: ox, y1: oy, x2: rayEnd.x, y2: rayEnd.y,
        stroke: '#f59e0b', 'stroke-width': 2.6, 'stroke-linecap': 'round'
      }, gScan);

      el('circle', {
        cx: rayEnd.x, cy: rayEnd.y, r: 4.5,
        fill: '#ea580c', stroke: '#fff', 'stroke-width': 1.6
      }, gScan);

      // Huy hiệu số đo góc chạy theo kim quét
      if (isScanning || animState?.isLocked) {
        const badgeR = R + 24;
        const bx = ox + badgeR * Math.cos(sweepRad);
        const by = oy + badgeR * Math.sin(sweepRad);
        const gBadge = el('g', { class: 'protractor-live-badge', transform: `translate(${bx}, ${by})` }, gScan);
        el('rect', {
          x: -22, y: -12, width: 44, height: 24, rx: 7,
          fill: '#fef3c7', stroke: '#f59e0b', 'stroke-width': 1.6,
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))'
        }, gBadge);
        const txt = el('text', {
          x: 0, y: 1, class: 'svg-angle-text', 'font-size': '12.5px', 'font-weight': '800', fill: '#b45309'
        }, gBadge);
        txt.textContent = `${Math.round(currentAngle)}°`;
      }
    }

    // 6. Điểm nhấn nổi bật tại vạch góc đích (Target Angle Indicator) khi đã hoàn thành
    if (hd1State.step >= 2 || (animState && animState.sweepAngle >= targetDeg - 0.5)) {
      const gTarget = el('g', { class: 'protractor-target-indicator' }, gProtractor);
      const tRad = rad(targetDeg);
      const tipX = ox + (R + 1) * Math.cos(tRad);
      const tipY = oy + (R + 1) * Math.sin(tRad);

      el('circle', {
        cx: tipX, cy: tipY, r: 6.5,
        fill: '#ea580c', stroke: '#fff', 'stroke-width': 2.2,
        class: 'pulse-target'
      }, gTarget);
    }

    return gProtractor;
  }

  /* =========================================================
     DỮ LIỆU 4 TRƯỜNG HỢP HÌNH 5.41 (SGK TOÁN 10)
     CÔNG THỨC DÙNG \overrightarrow VÀ CÂU VĂN TIẾNG VIỆT CHUẨN
     ========================================================= */
  const CASES_DATA = {
    1: {
      id: 1,
      name: "Trường hợp 1 (Hình 5.41a)",
      angleDeg: 135,
      kindText: "Góc tù (135°)",
      kindClass: "tag-obtuse",
      initA: { start: { x: 2, y: 4 }, end: { x: 7, y: 9 } },
      initB: { start: { x: 8, y: 9 }, end: { x: 8, y: 4 } },
      defaultO: { x: 13, y: 6 },
      explanation: "Vectơ $\\overrightarrow{OA}$ nghiêng góc $45^\\circ$ so với phương ngang, vectơ $\\overrightarrow{OB}$ thẳng đứng hướng xuống (góc $90^\\circ$). Khi vẽ từ chung gốc $O$, góc $\\widehat{AOB} = 45^\\circ + 90^\\circ = 135^\\circ$ (góc tù)."
    },
    2: {
      id: 2,
      name: "Trường hợp 2 (Hình 5.41b)",
      angleDeg: 90,
      kindText: "Vuông góc (90°)",
      kindClass: "tag-right",
      triangle: { p: { x: 6, y: 9 }, q: { x: 2, y: 3 }, r: { x: 10, y: 3 } },
      initA: { start: { x: 6, y: 9 }, end: { x: 6, y: 3 } },
      initB: { start: { x: 6, y: 3 }, end: { x: 10, y: 3 } },
      defaultO: { x: 14, y: 7 },
      explanation: "Trong tam giác cân, đường trung tuyến xuất phát từ đỉnh đồng thời là đường cao nên vuông góc với cạnh đáy. Do đó $\\overrightarrow{a} \\perp \\overrightarrow{b}$ và $(\\overrightarrow{a}, \\overrightarrow{b}) = 90^\\circ$."
    },
    3: {
      id: 3,
      name: "Trường hợp 3 (Hình 5.41c)",
      angleDeg: 0,
      kindText: "Cùng hướng (0°)",
      kindClass: "tag-collinear",
      initA: { start: { x: 2, y: 8 }, end: { x: 7, y: 8 } },
      initB: { start: { x: 2, y: 5 }, end: { x: 8, y: 5 } },
      defaultO: { x: 12, y: 6 },
      explanation: "Hai vectơ $\\overrightarrow{a}$ và $\\overrightarrow{b}$ cùng hướng, khi vẽ từ chung điểm gốc $O$ thì hai tia $OA$ và $OB$ trùng nhau. Do đó góc giữa hai vectơ bằng $0^\\circ$: $(\\overrightarrow{a}, \\overrightarrow{b}) = 0^\\circ$."
    },
    4: {
      id: 4,
      name: "Trường hợp 4 (Hình 5.41d)",
      angleDeg: 180,
      kindText: "Ngược hướng (180°)",
      kindClass: "tag-opposite",
      initA: { start: { x: 2, y: 8 }, end: { x: 7, y: 8 } },
      initB: { start: { x: 8, y: 5 }, end: { x: 2, y: 5 } },
      defaultO: { x: 14, y: 6 },
      explanation: "Hai vectơ $\\overrightarrow{a}$ và $\\overrightarrow{b}$ ngược hướng, khi vẽ từ chung điểm gốc $O$ thì hai tia $OA$ và $OB$ là hai tia đối nhau. Do đó góc giữa hai vectơ bằng $180^\\circ$: $(\\overrightarrow{a}, \\overrightarrow{b}) = 180^\\circ$."
    }
  };

  /* =========================================================
     HOẠT ĐỘNG 1: KHÁM PHÁ HÌNH 5.41
     HỌC SINH TỰ TAY KÉO DỜI VECTƠ VỀ ĐIỂM GỐC O
     ========================================================= */
  const hd1State = {
    currentCase: 1,
    step: 0,
    pointO: { x: 13, y: 6 },
    showGrid: true,
    showLabels: true,
    showProtractor: false,
    protractorAnim: null,
    placedA: false,
    placedB: false,
    drag: null,
    isBusy: false
  };

  function initHD1() {
    loadCase(1);
    setupHD1Events();
  }

  function loadCase(caseId) {
    hd1State.currentCase = caseId;
    hd1State.step = 0;
    hd1State.placedA = false;
    hd1State.placedB = false;
    hd1State.drag = null;
    hd1State.isBusy = false;
    hd1State.showProtractor = false;
    hd1State.protractorAnim = null;
    const btnProtractor = $('#btn-toggle-protractor');
    if (btnProtractor) btnProtractor.classList.remove('active');

    const data = CASES_DATA[caseId];
    hd1State.pointO = { ...data.defaultO };

    $$('.case-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.case, 10) === caseId);
    });

    updateStepButtons();
    updateAnalysisPanel();
    renderHD1Board();
  }

  function updateStepButtons() {
    const btn1 = $('#btn-step1');
    const btn2 = $('#btn-step2');
    const badge = $('#step-hint-badge');
    const stepCounter = $('#step-counter-badge');
    const legendAngleChip = $('#legend-angle-chip');

    if (btn1) btn1.className = 'btn-step';
    if (btn2) btn2.className = 'btn-step';

    const placedCount = (hd1State.placedA ? 1 : 0) + (hd1State.placedB ? 1 : 0);

    if (hd1State.step >= 2) {
      if (btn1) btn1.classList.add('done-step');
      if (btn2) { btn2.disabled = false; btn2.classList.add('done-step'); }
      const curData = CASES_DATA[hd1State.currentCase];
      if (badge) badge.innerHTML = `🎉 Hoàn thành! Số đo góc giữa hai vectơ là <b>${curData.angleDeg}°</b>`;
      if (stepCounter) stepCounter.textContent = 'Đã đo góc';
      if (legendAngleChip) legendAngleChip.hidden = false;
    } else if (hd1State.step === 1 || placedCount === 2) {
      hd1State.step = 1;
      if (btn1) btn1.classList.add('done-step');
      if (btn2) { btn2.disabled = false; btn2.classList.add('active-step'); }
      if (badge) badge.innerHTML = formatMathText('🌟 Hoàn thành Bước 1! Đã đưa về chung gốc $O$. Nhấn <b>Bước 2</b> để xác định số đo góc $\\widehat{AOB}$!');
      if (stepCounter) stepCounter.textContent = 'Bước 2/2';
      if (legendAngleChip) legendAngleChip.hidden = true;
    } else {
      if (btn1) btn1.classList.add('active-step');
      if (btn2) btn2.disabled = true;
      if (placedCount === 1) {
        const nextVec = hd1State.placedA ? '\\overrightarrow{b}' : '\\overrightarrow{a}';
        const doneVec = hd1State.placedA ? '\\overrightarrow{OA} = \\overrightarrow{a}' : '\\overrightarrow{OB} = \\overrightarrow{b}';
        if (badge) badge.innerHTML = formatMathText(`👍 Đã xong $${doneVec}$! Tiếp tục <b>kéo hoặc click vectơ $${nextVec}$</b> về điểm gốc $O$ nhé.`);
        if (stepCounter) stepCounter.textContent = 'Đã kéo 1/2';
      } else {
        if (badge) badge.innerHTML = formatMathText('💡 <b>Bước 1:</b> Em hãy <b>kéo hoặc click trực tiếp</b> vectơ $\\overrightarrow{a}$ và $\\overrightarrow{b}$ về điểm gốc $O$ (hoặc nhấn nút Bước 1 để tự động dời).');
        if (stepCounter) stepCounter.textContent = 'Bước 1/2';
      }
      if (legendAngleChip) legendAngleChip.hidden = true;
    }
  }

  function updateAnalysisPanel() {
    const data = CASES_DATA[hd1State.currentCase];
    const angleBadge = $('#angle-val-badge');
    const textFormula = $('#text-angle-formula');
    const textKind = $('#text-angle-kind');
    const comment = $('#analysis-comment');

    const placedCount = (hd1State.placedA ? 1 : 0) + (hd1State.placedB ? 1 : 0);

    if (hd1State.step >= 2) {
      if (angleBadge) angleBadge.textContent = `${data.angleDeg}°`;
      if (textFormula) textFormula.innerHTML = formatMathText(`$\\widehat{AOB} = (\\overrightarrow{a}, \\overrightarrow{b}) = ${data.angleDeg}^\\circ$`);
      if (textKind) { textKind.className = `angle-kind-pill ${data.kindClass}`; textKind.textContent = data.kindText; }
      if (comment) { comment.innerHTML = formatMathText(data.explanation); comment.className = 'analysis-comment-card active-result'; }
    } else if (hd1State.step === 1 || placedCount === 2) {
      if (angleBadge) angleBadge.textContent = 'Đang chờ Bước 2...';
      if (textFormula) textFormula.innerHTML = formatMathText(`$\\widehat{AOB} = (\\overrightarrow{a}, \\overrightarrow{b}) = \\; ?$`);
      if (textKind) { textKind.className = 'angle-kind-pill'; textKind.textContent = 'Đã vẽ OA = a, OB = b'; }
      if (comment) { comment.innerHTML = formatMathText('Đã đưa hai vectơ về chung gốc $O$. Em hãy nhấn <b>Bước 2</b> để đo và kết luận số đo góc!'); comment.className = 'analysis-comment-card waiting-step'; }
    } else if (placedCount === 1) {
      if (angleBadge) angleBadge.textContent = '...';
      const doneVec = hd1State.placedA ? '\\overrightarrow{OA} = \\overrightarrow{a}' : '\\overrightarrow{OB} = \\overrightarrow{b}';
      const remVec = hd1State.placedA ? '\\overrightarrow{b}' : '\\overrightarrow{a}';
      if (textFormula) textFormula.innerHTML = formatMathText(`$\\widehat{AOB} = (\\overrightarrow{a}, \\overrightarrow{b}) = \\dots$`);
      if (textKind) { textKind.className = 'angle-kind-pill'; textKind.textContent = 'Đang tịnh tiến...'; }
      if (comment) { comment.innerHTML = formatMathText(`Đã đưa xong $${doneVec}$. Hãy <b>kéo hoặc click</b> tiếp vectơ $${remVec}$ về điểm gốc $O$!`); comment.className = 'analysis-comment-card'; }
    } else {
      if (angleBadge) angleBadge.textContent = '...';
      if (textFormula) textFormula.innerHTML = formatMathText(`$\\widehat{AOB} = (\\overrightarrow{a}, \\overrightarrow{b}) = \\dots$`);
      if (textKind) { textKind.className = 'angle-kind-pill'; textKind.textContent = 'Chưa xác định'; }
      if (comment) { comment.innerHTML = formatMathText('Em hãy <b>kéo hoặc click trực tiếp hai vectơ</b> $\\overrightarrow{a}, \\overrightarrow{b}$ về chung điểm gốc $O$ (hoặc nhấn <b>Bước 1</b>).'); comment.className = 'analysis-comment-card'; }
    }
  }

  // =========================================================
  // BỘ ĐIỀU KHIỂN TƯƠNG TÁC VECTƠ TRỰC TIẾP (CLICK HOẶC KÉO THẢ)
  // =========================================================
  function getSvgCoords(e) {
    const svgBoard = $('#board-hd1');
    if (!svgBoard) return { x: 0, y: 0 };
    const pt = svgBoard.createSVGPoint();
    let cx = 0, cy = 0;
    if (e.touches && e.touches.length > 0) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else if (e.clientX !== undefined) {
      cx = e.clientX;
      cy = e.clientY;
    }
    pt.x = cx;
    pt.y = cy;
    const ctm = svgBoard.getScreenCTM();
    if (!ctm) return { x: cx, y: cy };
    return pt.matrixTransform(ctm.inverse());
  }

  // Khóa vectơ cố định tại gốc O và hoàn thành bước
  function lockVectorAtO(type) {
    sfx.snap();
    if (type === 'a') hd1State.placedA = true;
    if (type === 'b') hd1State.placedB = true;

    const allPlaced = hd1State.placedA && hd1State.placedB;
    if (allPlaced) {
      hd1State.step = 1;
      sfx.win();
      confetti.burst(65);
      toast(formatMathText('🎉 <b>Tuyệt vời!</b> Cả hai vectơ đã chung gốc $O$. Nhấn <b>Bước 2</b> để xác định góc!'), 'success');
    } else {
      const vName = type === 'a' ? '\\overrightarrow{OA} = \\overrightarrow{a}' : '\\overrightarrow{OB} = \\overrightarrow{b}';
      const nextVec = type === 'a' ? '\\overrightarrow{b}' : '\\overrightarrow{a}';
      toast(formatMathText(`👍 Đã vẽ xong $${vName}$! Tiếp tục kéo hoặc click vectơ $${nextVec}$ nhé.`), 'info');
    }

    updateStepButtons();
    updateAnalysisPanel();
    renderHD1Board();
  }

  // Tịnh tiến mượt mà vectơ về điểm gốc O khi học sinh click vào vectơ
  async function glideVectorToO(type) {
    if (hd1State.isBusy) return;
    if (type === 'a' && hd1State.placedA) return;
    if (type === 'b' && hd1State.placedB) return;

    hd1State.isBusy = true;
    sfx.pick();

    const data = CASES_DATA[hd1State.currentCase];
    const initVec = type === 'a' ? data.initA : data.initB;
    const fromTail = toScreen(initVec.start.x, initVec.start.y);
    const toTail = toScreen(hd1State.pointO.x, hd1State.pointO.y);

    await tween(460, (k) => {
      hd1State.drag = {
        type: type,
        currentTail: {
          x: fromTail.x + (toTail.x - fromTail.x) * k,
          y: fromTail.y + (toTail.y - fromTail.y) * k
        },
        snapped: k > 0.85
      };
      renderHD1Board();
    }, ease.inOut);

    hd1State.drag = null;
    hd1State.isBusy = false;
    lockVectorAtO(type);
  }

  // Bắt đầu kéo thả hoặc click từ chính phần tử vectơ
  function onVectorPointerDown(e, type) {
    if (hd1State.isBusy) return;
    if (type === 'a' && hd1State.placedA) return;
    if (type === 'b' && hd1State.placedB) return;

    e.stopPropagation();
    e.preventDefault();

    const data = CASES_DATA[hd1State.currentCase];
    const initVec = type === 'a' ? data.initA : data.initB;
    const startTail = toScreen(initVec.start.x, initVec.start.y);
    const p = getSvgCoords(e);

    sfx.pick();
    hd1State.drag = {
      type: type,
      pointerId: e.pointerId,
      startMouse: { x: p.x, y: p.y },
      startTail: { ...startTail },
      currentTail: { ...startTail },
      hasMoved: false,
      snapped: false
    };

    renderHD1Board();
  }

  // Bắt đầu kéo điểm gốc O
  function onPointOPointerDown(e) {
    if (hd1State.isBusy) return;
    e.stopPropagation();
    e.preventDefault();

    sfx.pick();
    hd1State.drag = {
      type: 'O',
      pointerId: e.pointerId,
      hasMoved: false
    };
    renderHD1Board();
  }

  // Theo dõi di chuyển toàn cục trên window
  function onGlobalPointerMove(e) {
    if (!hd1State.drag || hd1State.isBusy) return;
    const p = getSvgCoords(e);
    const drag = hd1State.drag;

    if (drag.type === 'O') {
      const g = toGrid(p.x, p.y);
      const data = CASES_DATA[hd1State.currentCase];
      const sa = data.initA.start, ea = data.initA.end;
      const sb = data.initB.start, eb = data.initB.end;
      const vAdx = ea.x - sa.x, vAdy = ea.y - sa.y;
      const vBdx = eb.x - sb.x, vBdy = eb.y - sb.y;

      const minX = Math.max(2, 1 - Math.min(0, vAdx, vBdx));
      const maxX = Math.min(COLS - 2, COLS - 1 - Math.max(0, vAdx, vBdx));
      const minY = Math.max(2, 1 - Math.min(0, vAdy, vBdy));
      const maxY = Math.min(ROWS - 2, ROWS - 1 - Math.max(0, vAdy, vBdy));

      const snapX = Math.max(minX, Math.min(maxX, Math.round(g.x)));
      const snapY = Math.max(minY, Math.min(maxY, Math.round(g.y)));
      if (snapX !== hd1State.pointO.x || snapY !== hd1State.pointO.y) {
        drag.hasMoved = true;
        hd1State.pointO = { x: snapX, y: snapY };
        renderHD1Board();
      }
      return;
    }

    if (drag.type === 'a' || drag.type === 'b') {
      const dx = p.x - drag.startMouse.x;
      const dy = p.y - drag.startMouse.y;
      const distFromStart = Math.hypot(dx, dy);

      if (distFromStart > 8) {
        drag.hasMoved = true;
      }

      let tx = drag.startTail.x + dx;
      let ty = drag.startTail.y + dy;

      const ptO = toScreen(hd1State.pointO.x, hd1State.pointO.y);
      const distToO = Math.hypot(tx - ptO.x, ty - ptO.y);

      // Nam châm hút vào điểm O trong bán kính 55px
      if (distToO < 55) {
        tx = ptO.x;
        ty = ptO.y;
        drag.snapped = true;
      } else {
        drag.snapped = false;
      }

      drag.currentTail = { x: tx, y: ty };
      renderHD1Board();
    }
  }

  // Thả chuột / chạm ngón tay toàn cục trên window
  async function onGlobalPointerUp(e) {
    if (!hd1State.drag || hd1State.isBusy) return;
    const drag = hd1State.drag;
    hd1State.drag = null;

    if (drag.type === 'O') {
      sfx.snap();
      // Nếu cả 2 vectơ đã xong mà nhấn vào O thì kích hoạt Bước 2
      if (hd1State.placedA && hd1State.placedB && hd1State.step < 2 && !drag.hasMoved) {
        const btn2 = $('#btn-step2');
        if (btn2) btn2.click();
      } else {
        renderHD1Board();
      }
      return;
    }

    const type = drag.type; // 'a' or 'b'
    const ptO = toScreen(hd1State.pointO.x, hd1State.pointO.y);

    // 1. NẾU HỌC SINH CHỈ CLICK / CHẠM VÀO VECTƠ (KHÔNG KÉO ĐI XA):
    // "bản thân học sinh click vecto kéo đi luôn" -> TỰ ĐỘNG DỜI VỀ O NGAY LẬP TỨC!
    const distMoved = Math.hypot(drag.currentTail.x - drag.startTail.x, drag.currentTail.y - drag.startTail.y);
    if (!drag.hasMoved || distMoved < 14) {
      await glideVectorToO(type);
      return;
    }

    // 2. NẾU HỌC SINH KÉO VÀ THẢ GẦN GỐC O (HOẶC ĐÃ HÚT NAM CHÂM):
    const distToO = Math.hypot(drag.currentTail.x - ptO.x, drag.currentTail.y - ptO.y);
    if (drag.snapped || distToO < 55) {
      lockVectorAtO(type);
      return;
    }

    // 3. NẾU KÉO LƯNG CHỪNG RA XA O -> TRƯỢT MƯỢT VỀ LẠI VỊ TRÍ CŨ
    sfx.miss();
    toast(formatMathText('💡 Em hãy kéo điểm đầu của vectơ đặt trùng vào điểm gốc $O$ màu cam nhé (hoặc click để dời nhanh)!'), 'warning');

    hd1State.isBusy = true;
    const fromTail = { ...drag.currentTail };
    const toTail = { ...drag.startTail };
    await tween(380, (k) => {
      hd1State.drag = {
        type: type,
        currentTail: {
          x: fromTail.x + (toTail.x - fromTail.x) * k,
          y: fromTail.y + (toTail.y - fromTail.y) * k
        },
        snapped: false
      };
      renderHD1Board();
    }, ease.outBack);
    hd1State.drag = null;
    hd1State.isBusy = false;
    renderHD1Board();
  }

  // Xử lý khi nhấn trực tiếp trên nền bảng SVG (fallback)
  function onCanvasPointerDown(e) {
    if (hd1State.isBusy || hd1State.drag) return;
    const p = getSvgCoords(e);
    const data = CASES_DATA[hd1State.currentCase];
    const ptO = toScreen(hd1State.pointO.x, hd1State.pointO.y);

    // 1. Kiểm tra bấm vào điểm O
    if (Math.hypot(p.x - ptO.x, p.y - ptO.y) < 36) {
      onPointOPointerDown(e);
      return;
    }

    // 2. Kiểm tra bấm gần vectơ A
    if (!hd1State.placedA) {
      const sa1 = toScreen(data.initA.start.x, data.initA.start.y);
      const ea1 = toScreen(data.initA.end.x, data.initA.end.y);
      if (distToSegment(p.x, p.y, sa1.x, sa1.y, ea1.x, ea1.y) < 48) {
        onVectorPointerDown(e, 'a');
        return;
      }
    }

    // 3. Kiểm tra bấm gần vectơ B
    if (!hd1State.placedB) {
      const sb1 = toScreen(data.initB.start.x, data.initB.start.y);
      const eb1 = toScreen(data.initB.end.x, data.initB.end.y);
      if (distToSegment(p.x, p.y, sb1.x, sb1.y, eb1.x, eb1.y) < 48) {
        onVectorPointerDown(e, 'b');
        return;
      }
    }

    // 4. Nếu đã đưa cả 2 về O mà click vào góc -> Kích hoạt Bước 2
    if (hd1State.placedA && hd1State.placedB && hd1State.step < 2) {
      if (Math.hypot(p.x - ptO.x, p.y - ptO.y) < 60) {
        const btn2 = $('#btn-step2');
        if (btn2) btn2.click();
        return;
      }
    }

    // 5. Bấm vào một vị trí trống trên lưới để chuyển nhanh điểm O đến đó
    const g = toGrid(p.x, p.y);
    const sa = data.initA.start, ea = data.initA.end;
    const sb = data.initB.start, eb = data.initB.end;
    const vAdx = ea.x - sa.x, vAdy = ea.y - sa.y;
    const vBdx = eb.x - sb.x, vBdy = eb.y - sb.y;

    const minX = Math.max(2, 1 - Math.min(0, vAdx, vBdx));
    const maxX = Math.min(COLS - 2, COLS - 1 - Math.max(0, vAdx, vBdx));
    const minY = Math.max(2, 1 - Math.min(0, vAdy, vBdy));
    const maxY = Math.min(ROWS - 2, ROWS - 1 - Math.max(0, vAdy, vBdy));

    const snapX = Math.max(minX, Math.min(maxX, Math.round(g.x)));
    const snapY = Math.max(minY, Math.min(maxY, Math.round(g.y)));
    const newPtO = toScreen(snapX, snapY);
    if (Math.hypot(p.x - newPtO.x, p.y - newPtO.y) < 24) {
      hd1State.pointO = { x: snapX, y: snapY };
      sfx.snap();
      renderHD1Board();
    }
  }

  function renderHD1Board() {
    const svg = $('#board-hd1');
    if (!svg) return;
    svg.innerHTML = '';

    const data = CASES_DATA[hd1State.currentCase];

    // 1. Lưới ô vuông chuẩn file gốc
    drawBoardGrid(svg, hd1State.showGrid);

    // 2. Tam giác cân (TH 2)
    if (data.triangle) {
      const gTri = el('g', { class: 'triangle-layer' }, svg);
      const sp = toScreen(data.triangle.p.x, data.triangle.p.y);
      const sq = toScreen(data.triangle.q.x, data.triangle.q.y);
      const sr = toScreen(data.triangle.r.x, data.triangle.r.y);
      el('polygon', {
        points: `${sp.x},${sp.y} ${sq.x},${sq.y} ${sr.x},${sr.y}`,
        fill: 'rgba(54, 189, 150, 0.08)',
        stroke: '#475569',
        'stroke-width': 2.4,
        'stroke-dasharray': '6 4'
      }, gTri);

      const mLeftX = (sp.x + sq.x) / 2, mLeftY = (sp.y + sq.y) / 2;
      const mRightX = (sp.x + sr.x) / 2, mRightY = (sp.y + sr.y) / 2;
      el('line', { x1: mLeftX - 5, y1: mLeftY - 3, x2: mLeftX + 5, y2: mLeftY + 3, stroke: '#334155', 'stroke-width': 2.4 }, gTri);
      el('line', { x1: mRightX - 5, y1: mRightY + 3, x2: mRightX + 5, y2: mRightY - 3, stroke: '#334155', 'stroke-width': 2.4 }, gTri);
    }

    // Tọa độ các điểm ban đầu
    const sa1 = toScreen(data.initA.start.x, data.initA.start.y);
    const ea1 = toScreen(data.initA.end.x, data.initA.end.y);
    const sb1 = toScreen(data.initB.start.x, data.initB.start.y);
    const eb1 = toScreen(data.initB.end.x, data.initB.end.y);

    const vecAdx = ea1.x - sa1.x;
    const vecAdy = ea1.y - sa1.y;
    const vecBdx = eb1.x - sb1.x;
    const vecBdy = eb1.y - sb1.y;

    const ptO = toScreen(hd1State.pointO.x, hd1State.pointO.y);
    const ptA = { x: ptO.x + vecAdx, y: ptO.y + vecAdy };
    const ptB = { x: ptO.x + vecBdx, y: ptO.y + vecBdy };

    // Layer chứa các đường gióng tịnh tiến (guides)
    const gGuides = el('g', { class: 'guides-layer' }, svg);

    // Layer chứa các bóng mờ (ghosts) ở vị trí ban đầu
    const gGhosts = el('g', { class: 'ghosts-layer' }, svg);

    // 3. VECTƠ A (Màu xanh dương #1E9BE6)
    const isDraggingA = hd1State.drag && hd1State.drag.type === 'a';
    if (hd1State.placedA) {
      // Đã đặt tại O thành OA
      drawGhostVector(gGhosts, sa1.x, sa1.y, ea1.x, ea1.y, '#1E9BE6', 'a');
      el('line', { x1: sa1.x, y1: sa1.y, x2: ptO.x, y2: ptO.y, class: 'svg-ghost-line' }, gGuides);
      el('line', { x1: ea1.x, y1: ea1.y, x2: ptA.x, y2: ptA.y, class: 'svg-ghost-line' }, gGuides);
      drawVector(svg, ptO.x, ptO.y, ptA.x, ptA.y, '#1E9BE6', hd1State.showLabels ? 'OA' : '', {
        width: 6, labelOffset: (data.id === 1 || data.id === 2) ? -28 : 28
      });
      drawPointDot(svg, ptA.x, ptA.y, hd1State.showLabels ? 'A' : '', '#1E9BE6', { labelOffsetX: 16, labelOffsetY: -16 });
    } else if (isDraggingA) {
      // Học sinh đang kéo vectơ A
      drawGhostVector(gGhosts, sa1.x, sa1.y, ea1.x, ea1.y, '#1E9BE6', 'a');
      const curTail = hd1State.drag.currentTail;
      const curHead = { x: curTail.x + vecAdx, y: curTail.y + vecAdy };
      el('line', { x1: sa1.x, y1: sa1.y, x2: curTail.x, y2: curTail.y, class: 'guide' }, gGuides);
      el('line', { x1: ea1.x, y1: ea1.y, x2: curHead.x, y2: curHead.y, class: 'guide' }, gGuides);
      const gVec = drawVector(svg, curTail.x, curTail.y, curHead.x, curHead.y, '#1E9BE6', hd1State.showLabels ? 'a' : '', {
        width: 7.5, labelOffset: (data.id === 1 || data.id === 2) ? -28 : 28
      });
      gVec.classList.add('dragging');
      gVec.setAttribute('filter', 'url(#lift)');
    } else {
      // Vectơ A ở vị trí ban đầu, sẵn sàng để kéo hoặc click dời đi luôn
      const gA = drawVector(svg, sa1.x, sa1.y, ea1.x, ea1.y, '#1E9BE6', hd1State.showLabels ? 'a' : '', {
        width: 6, labelOffset: (data.id === 1 || data.id === 2) ? -28 : 28
      });
      gA.classList.add('can-drag');
      gA.setAttribute('data-vec', 'a');
      gA.style.cursor = 'grab';
      el('title', {}, gA).textContent = 'Nhấn hoặc kéo vectơ a về điểm gốc O';
      gA.addEventListener('pointerdown', (e) => onVectorPointerDown(e, 'a'));
    }

    // 4. VECTƠ B (Màu xanh ngọc #36BD96)
    const isDraggingB = hd1State.drag && hd1State.drag.type === 'b';
    if (hd1State.placedB) {
      // Đã đặt tại O thành OB
      drawGhostVector(gGhosts, sb1.x, sb1.y, eb1.x, eb1.y, '#36BD96', 'b');
      el('line', { x1: sb1.x, y1: sb1.y, x2: ptO.x, y2: ptO.y, class: 'svg-ghost-line' }, gGuides);
      el('line', { x1: eb1.x, y1: eb1.y, x2: ptB.x, y2: ptB.y, class: 'svg-ghost-line' }, gGuides);
      drawVector(svg, ptO.x, ptO.y, ptB.x, ptB.y, '#36BD96', hd1State.showLabels ? 'OB' : '', {
        width: 6, labelOffset: (data.id === 2 || data.id === 4) ? -28 : 28
      });
      drawPointDot(svg, ptB.x, ptB.y, hd1State.showLabels ? 'B' : '', '#36BD96', { labelOffsetX: 16, labelOffsetY: 16 });
    } else if (isDraggingB) {
      // Học sinh đang kéo vectơ B
      drawGhostVector(gGhosts, sb1.x, sb1.y, eb1.x, eb1.y, '#36BD96', 'b');
      const curTail = hd1State.drag.currentTail;
      const curHead = { x: curTail.x + vecBdx, y: curTail.y + vecBdy };
      el('line', { x1: sb1.x, y1: sb1.y, x2: curTail.x, y2: curTail.y, class: 'guide' }, gGuides);
      el('line', { x1: eb1.x, y1: eb1.y, x2: curHead.x, y2: curHead.y, class: 'guide' }, gGuides);
      const gVec = drawVector(svg, curTail.x, curTail.y, curHead.x, curHead.y, '#36BD96', hd1State.showLabels ? 'b' : '', {
        width: 7.5, labelOffset: (data.id === 2 || data.id === 4) ? -28 : 28
      });
      gVec.classList.add('dragging');
      gVec.setAttribute('filter', 'url(#lift)');
    } else {
      // Vectơ B ở vị trí ban đầu, sẵn sàng để kéo hoặc click dời đi luôn
      const gB = drawVector(svg, sb1.x, sb1.y, eb1.x, eb1.y, '#36BD96', hd1State.showLabels ? 'b' : '', {
        width: 6, labelOffset: (data.id === 2 || data.id === 4) ? -28 : 28
      });
      gB.classList.add('can-drag');
      gB.setAttribute('data-vec', 'b');
      gB.style.cursor = 'grab';
      el('title', {}, gB).textContent = 'Nhấn hoặc kéo vectơ b về điểm gốc O';
      gB.addEventListener('pointerdown', (e) => onVectorPointerDown(e, 'b'));
    }

    // 5. ĐIỂM GỐC O với vòng ripple gợn sóng vàng cam
    const isNearSnap = hd1State.drag && hd1State.drag.snapped;
    const hideRing = (hd1State.placedA && hd1State.placedB && hd1State.step >= 2);
    const handleO = drawPointWithHalo(svg, ptO.x, ptO.y, hd1State.showLabels ? 'O' : '', {
      draggable: true,
      id: 'svg-handle-o',
      hideRing: hideRing,
      isNear: isNearSnap
    });
    handleO.style.cursor = 'grab';
    handleO.addEventListener('pointerdown', onPointOPointerDown);

    // 6. THƯỚC ĐO ĐỘ ẢO
    if (hd1State.placedA && hd1State.placedB && hd1State.showProtractor) {
      drawProtractor(svg, ptO.x, ptO.y, ptA.x, ptA.y, ptB.x, ptB.y, hd1State.protractorAnim);
    }

    // 7. BƯỚC 2: Cung đo góc AOB
    if (hd1State.placedA && hd1State.placedB && hd1State.step >= 2) {
      drawAngleArc(svg, ptO.x, ptO.y, ptA.x, ptA.y, ptB.x, ptB.y, data.angleDeg, {
        drawSquareFor90: true,
        radius: 52
      });
    }
  }

  /* =========================================================
     HIỆU ỨNG THƯỚC ĐO ĐỘ ANIMATION ĐO GÓC GIỮA HAI VECTƠ
     1. Thước đo độ xuất hiện (fade-in & scale-in) đặt tâm tại O, xoay khớp theo tia OA
     2. Kim quét (Scanner needle) & cung màu vàng hổ phách quét từ 0° -> góc đích
     3. Nhảy số góc trực tiếp sinh động + âm thanh tích tắc nhịp nhàng
     4. Khóa góc, vạch số phát sáng, mở cung đo góc hoàn thiện, confetti & win sound
     ========================================================= */
  async function animateProtractorMeasurement() {
    if (hd1State.isBusy) return;
    if (!hd1State.placedA || !hd1State.placedB) {
      toast(formatMathText('💡 Em hãy kéo hoặc click cả hai vectơ về chung gốc $O$ trước nhé!'), 'warning');
      return;
    }

    hd1State.isBusy = true;
    hd1State.step = 1; // Ẩn cung đo góc hoàn thành cũ nếu đang bấm đo lại
    hd1State.showProtractor = true;
    const btnProtractor = $('#btn-toggle-protractor');
    if (btnProtractor) btnProtractor.classList.add('active');

    const curData = CASES_DATA[hd1State.currentCase];
    const targetAngle = curData.angleDeg;

    // Giai đoạn 1: Thước đo độ xuất hiện mượt mà tại điểm gốc O
    sfx.snap();
    await tween(420, (k) => {
      hd1State.protractorAnim = {
        scale: 0.5 + 0.5 * k,
        opacity: k,
        sweepAngle: 0,
        targetAngle: targetAngle,
        isScanning: false
      };
      renderHD1Board();
    }, ease.outBack);

    await wait(120);

    // Giai đoạn 2: Kim quét góc quét từ 0° đến targetAngle
    const sweepDuration = targetAngle === 0 ? 350 : Math.max(750, Math.min(1350, targetAngle * 8.5));
    let lastSoundTick = -1;

    await tween(sweepDuration, (k) => {
      const currentDeg = k * targetAngle;
      hd1State.protractorAnim = {
        scale: 1,
        opacity: 1,
        sweepAngle: currentDeg,
        targetAngle: targetAngle,
        isScanning: true
      };

      // Phát âm thanh nhịp gõ nhẹ khi kim lướt qua mỗi 15°
      const tickStep = Math.floor(currentDeg / 15);
      if (tickStep !== lastSoundTick && targetAngle > 0) {
        lastSoundTick = tickStep;
        sfx.step();
      }

      // Cập nhật số đo góc trực tiếp trên bảng phân tích bên phải
      const angleBadge = $('#angle-val-badge');
      if (angleBadge) angleBadge.textContent = `${Math.round(currentDeg)}°`;

      renderHD1Board();
    }, ease.inOut);

    // Giai đoạn 3: Khóa góc & Bùng nổ thành quả
    hd1State.step = 2;
    hd1State.protractorAnim = {
      scale: 1,
      opacity: 1,
      sweepAngle: targetAngle,
      targetAngle: targetAngle,
      isScanning: false,
      isLocked: true
    };

    sfx.win();
    confetti.burst(110);
    updateStepButtons();
    updateAnalysisPanel();
    renderHD1Board();

    toast(formatMathText(`🎉 <b>Tuyệt vời!</b> Thước đo độ xác định: $(\\overrightarrow{a}, \\overrightarrow{b}) = ${targetAngle}^\\circ$!`), 'success');
    hd1State.isBusy = false;
  }

  let hd1EventsBound = false;
  function setupHD1Events() {
    $$('.case-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (hd1State.isBusy) return;
        const id = parseInt(btn.dataset.case, 10);
        sfx.click();
        loadCase(id);
      });
    });

    const btn1 = $('#btn-step1');
    if (btn1) {
      btn1.addEventListener('click', async () => {
        if (hd1State.isBusy) return;
        if (hd1State.placedA && hd1State.placedB) {
          toast(formatMathText('Đã đưa hai vectơ về chung gốc $O$! Hãy nhấn <b>Bước 2</b> để đo góc.'), 'info');
          return;
        }

        if (!hd1State.placedA) {
          await glideVectorToO('a');
          await wait(180);
        }
        if (!hd1State.placedB) {
          await glideVectorToO('b');
        }
      });
    }

    const btn2 = $('#btn-step2');
    if (btn2) {
      btn2.addEventListener('click', async () => {
        if (hd1State.isBusy) return;
        if (!hd1State.placedA || !hd1State.placedB) {
          toast(formatMathText('💡 Em hãy kéo hoặc click cả hai vectơ về chung gốc $O$ trước nhé!'), 'warning');
          return;
        }
        await animateProtractorMeasurement();
      });
    }

    const btnReset = $('#btn-reset-hd1');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (hd1State.isBusy) return;
        sfx.click();
        loadCase(hd1State.currentCase);
        toast('Đã đặt lại hoạt động!', 'info');
      });
    }

    const btnDemo = $('#btn-auto-demo');
    if (btnDemo) {
      btnDemo.addEventListener('click', async () => {
        if (hd1State.isBusy) return;
        sfx.click();
        loadCase(hd1State.currentCase);
        toast('🎬 Đang chiếu hoạt họa mẫu...', 'info');
        await wait(500);

        if (!hd1State.placedA) {
          await glideVectorToO('a');
          await wait(350);
        }
        if (!hd1State.placedB) {
          await glideVectorToO('b');
        }

        setTimeout(() => {
          if (btn2 && !btn2.disabled) {
            btn2.click();
          }
        }, 300);
      });
    }

    const btnGrid = $('#btn-toggle-grid');
    if (btnGrid) {
      btnGrid.addEventListener('click', () => {
        hd1State.showGrid = !hd1State.showGrid;
        btnGrid.classList.toggle('active', hd1State.showGrid);
        sfx.click();
        renderHD1Board();
      });
    }

    const btnLabels = $('#btn-toggle-labels');
    if (btnLabels) {
      btnLabels.addEventListener('click', () => {
        hd1State.showLabels = !hd1State.showLabels;
        btnLabels.classList.toggle('active', hd1State.showLabels);
        sfx.click();
        renderHD1Board();
      });
    }

    const btnProtractor = $('#btn-toggle-protractor');
    if (btnProtractor) {
      btnProtractor.addEventListener('click', async () => {
        if (hd1State.isBusy) return;
        hd1State.showProtractor = !hd1State.showProtractor;
        btnProtractor.classList.toggle('active', hd1State.showProtractor);
        sfx.click();
        if (hd1State.showProtractor && hd1State.placedA && hd1State.placedB && hd1State.step < 2) {
          await animateProtractorMeasurement();
        } else {
          renderHD1Board();
        }
      });
    }

    // Gắn sự kiện bảng và toàn cục đúng 1 lần
    if (!hd1EventsBound) {
      hd1EventsBound = true;
      const svgBoard = $('#board-hd1');
      if (svgBoard) {
        svgBoard.addEventListener('pointerdown', onCanvasPointerDown);
      }
      window.addEventListener('pointermove', onGlobalPointerMove, { passive: false });
      window.addEventListener('pointerup', onGlobalPointerUp, { passive: false });
      window.addEventListener('pointercancel', onGlobalPointerUp, { passive: false });
    }
  }
  function setupFullscreen() {
    const btn = $('#btn-fullscreen');
    if (!btn) return;
    btn.addEventListener('click', () => {
      sfx.click();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        document.body.classList.add('is-fullscreen');
      } else {
        document.exitFullscreen().catch(() => {});
        document.body.classList.remove('is-fullscreen');
      }
    });
    document.addEventListener('fullscreenchange', () => {
      document.body.classList.toggle('is-fullscreen', !!document.fullscreenElement);
    });
  }

  function setupSoundToggle() {
    const btn = $('#btn-sound');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const state = sfx.toggle();
      btn.classList.toggle('muted', !state);
      toast(state ? 'Đã bật âm thanh tương tác' : 'Đã tắt âm thanh', 'info');
    });
  }

  /* =========================================================
     KHỞI TẠO TRANG
     ========================================================= */
  window.addEventListener('DOMContentLoaded', () => {
    // 1. Render tất cả các phần tử toán học tĩnh ban đầu
    renderAllMathInPage(document.body);

    // 2. Khởi tạo hoạt động khám phá góc giữa hai vectơ (Hình 5.41 SGK)
    initHD1();
    setupFullscreen();
    setupSoundToggle();
  });
})();
