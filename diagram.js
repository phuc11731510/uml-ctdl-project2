'use strict';
/* Sơ đồ lớp: thẻ lớp đặt tự do, đường nối cong, chọn, chú thích, thứ tự đọc, nhảy giữa các lớp, khung chi tiết. */
(function (U) {
  const { $, $$, el, svgEl, rich, plain, S } = U;

  const CARD_W = 360;     // bề rộng thẻ
  const GAP = 56;         // khoảng cách tối thiểu giữa hai thẻ
  const PAD = 90;         // lề quanh sơ đồ
  U.CARD_W = CARD_W;
  U.cardEls = {};
  U.rects = {};
  U.routes = [];
  U.routeById = {};
  U.stageSize = { w: 0, h: 0 };
  U.lod = 0;
  U.pz = null;

  /* Bốn mức chi tiết: 0 tổng quan, 1 thành viên, 2 chữ ký đầy đủ (không mô tả), 3 chữ ký đầy đủ và mô tả. */
  const LOD_T = [0.62, 1.05, 1.5];
  const NARROW = window.matchMedia('(max-width: 1100px)'); // thanh bên là lớp phủ, mở bằng nút ☰
  const PHONE = window.matchMedia('(max-width: 700px)');   // khung chi tiết phủ nửa dưới màn hình
  const desiredLod = (k) => {
    if (S.lodMode !== 'auto') return Number(S.lodMode);
    return k < LOD_T[0] ? 0 : (k < LOD_T[1] ? 1 : (k < LOD_T[2] ? 2 : 3));
  };

  const pkgColor = (c) => U.D.pkgById[c.package].color;
  const PRIMITIVES = ['int', 'bool', 'char', 'void', 'string'];

  /* ================= xây thẻ ================= */
  function memberRow(c, kind, m) {
    const vis = U.visOf(m, kind);
    const full = kind === 'attr' ? U.signature.attr(m) : U.signature.methodFull(m);
    const compact = [];
    if (vis) compact.push(el('span', { class: 'vis' }, vis));
    if (kind === 'attr') {
      compact.push(el('span', { class: 'mname' }, m.name), el('span', { class: 'ret' }, U.typeSpans(': ' + m.type)));
    } else {
      compact.push(el('span', { class: 'mname' }, U.signature.methodCompact(m)));
      if (!m.ctor) compact.push(el('span', { class: 'ret' }, U.typeSpans(': ' + m.returns)));
    }
    const cls = 'member ' + (kind === 'attr' ? 'attr' : 'method') + (m.static ? ' static' : '') + (m.abstract ? ' abstract' : '') + (m.ctor ? ' ctor' : '');
    return el('div', { class: cls, tabindex: '0', role: 'button', dataset: { cls: c.id, kind, name: m.name } },
      el('div', { class: 'msig' },
        el('span', { class: 'sig-compact' }, compact),
        el('span', { class: 'sig-full' }, U.typeSpans(full))),
      el('div', { class: 'msum' }, plain(m.summary)));
  }

  function buildCard(c) {
    const isTypes = c.stereotype === 'types';
    const nA = (c.attributes || []).length;
    const nM = (c.methods || []).length;
    const nV = (c.values || []).length;
    const counts = isTypes ? nA + ' kiểu' : (c.stereotype === 'enum' ? nV + ' giá trị' : nA + ' thuộc tính · ' + nM + ' phương thức');
    const badge = c.status === 'core' ? null : el('span', { class: 'badge ' + c.status }, U.STATUS_LABEL[c.status]);
    const members = el('div', { class: 'members' });
    if (nA) {
      members.append(el('div', { class: 'sect' }, isTypes ? 'Các kiểu' : 'Thuộc tính'));
      c.attributes.forEach(a => members.append(memberRow(c, 'attr', a)));
    }
    if (nM) {
      members.append(el('div', { class: 'sect' }, 'Phương thức'));
      c.methods.forEach(m => members.append(memberRow(c, 'method', m)));
    }
    const title = U.displayName(c);
    const tparam = c.tparams ? el('span', { class: 'tparam', title: 'Tham số template' }, c.tparams.join(', ')) : null;
    return el('div', { class: 'card st-' + c.stereotype + ' status-' + c.status, dataset: { id: c.id },
      vars: { '--pk': pkgColor(c), '--l0name': Math.min(38, Math.floor(326 / (0.62 * title.length))) + 'px' } },
      el('div', { class: 'card-head', tabindex: '0', role: 'button', dataset: { cls: c.id } },
        el('div', { class: 'toprow' }, el('span', { class: 'rnum', title: 'Bước đọc ' + c.read }, String(c.read)), (badge || tparam) ? el('span', { class: 'tr-right' }, badge, tparam) : null),
        el('div', { class: 'name' }, title)),
      el('div', { class: 'card-summary' }, plain(c.summary)),
      el('div', { class: 'card-role' }, plain(c.role)),
      el('div', { class: 'card-counts' }, counts),
      (nA || nM) ? members : null,
      nV ? el('div', { class: 'values' },
        el('div', { class: 'sect' }, 'Giá trị'),
        c.values.map(v => el('div', { class: 'vrow', dataset: { cls: c.id, value: v.name } },
          el('span', { class: 'mname' }, v.name),
          el('div', { class: 'vmean' }, plain(v.meaning))))) : null);
  }

  function markers() {
    const mk = (id, vb, ref, body, cls) => svgEl('marker', {
      id, viewBox: vb, refX: ref[0], refY: ref[1], markerWidth: vb.split(' ')[2], markerHeight: vb.split(' ')[3],
      orient: 'auto', markerUnits: 'userSpaceOnUse', overflow: 'visible'
    }, svgEl('path', { d: body, class: cls }));
    const defs = svgEl('defs');
    defs.append(
      mk('m-tri', '0 0 16 14', [16, 7], 'M0,0 L16,7 L0,14 Z', 'mk-hollow'),
      mk('m-diaF', '0 0 18 12', [0, 6], 'M0,6 L9,0 L18,6 L9,12 Z', 'mk-filled'),
      mk('m-diaH', '0 0 18 12', [0, 6], 'M0,6 L9,0 L18,6 L9,12 Z', 'mk-hollow'),
      mk('m-open', '0 0 12 12', [12, 6], 'M1,1 L12,6 L1,11', 'mk-open'),
      mk('m-tri-hi', '0 0 16 14', [16, 7], 'M0,0 L16,7 L0,14 Z', 'mk-hi-hollow'),
      mk('m-diaF-hi', '0 0 18 12', [0, 6], 'M0,6 L9,0 L18,6 L9,12 Z', 'mk-hi-filled'),
      mk('m-diaH-hi', '0 0 18 12', [0, 6], 'M0,6 L9,0 L18,6 L9,12 Z', 'mk-hi-hollow'),
      mk('m-open-hi', '0 0 12 12', [12, 6], 'M1,1 L12,6 L1,11', 'mk-hi-open'));
    return defs;
  }
  U.markerDefs = markers;

  const MARKER = {
    inheritance: { end: 'tri' }, realization: { end: 'tri' }, composition: { start: 'diaF' },
    aggregation: { start: 'diaH' }, association: { end: 'open' }, dependency: { end: 'open' }
  };
  const DASHED = { realization: true, dependency: true };

  /* ================= bố cục tự do ================= */
  /* ids: danh sách lớp; size[id] = {w,h}; seed[id] = [tâm x, tâm y] ở kích thước chuẩn (ref).
     Đặt các tâm theo seed (co giãn theo kích thước hiện tại), rồi đẩy các thẻ chồng nhau ra xa nhau. */
  U.freeLayout = function (ids, size, seed, ref, gap, pad, uniform) {
    const n = ids.length;
    let sw = 0, sh = 0;
    ids.forEach(id => { sw += size[id].w; sh += size[id].h; });
    const sx = ref ? (sw / n) / ref.w : 1;
    let sy = ref ? (sh / n) / ref.meanH : 1;
    if (uniform) sy = Math.max(sx, sy);   // giữ tỉ lệ khung hình khi xuất ảnh
    const P = ids.map(id => [seed[id][0] * sx, seed[id][1] * sy]);
    const S0 = P.map(p => p.slice());
    const W = ids.map(id => size[id].w);
    const H = ids.map(id => size[id].h);
    for (let it = 0; it < 900; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = P[j][0] - P[i][0];
          const dy = P[j][1] - P[i][1];
          const ox = (W[i] + W[j]) / 2 + gap - Math.abs(dx);
          const oy = (H[i] + H[j]) / 2 + gap - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            moved = true;
            if (ox < oy) {
              const s = dx === 0 ? 1 : Math.sign(dx);
              P[i][0] -= s * (ox / 2 + 0.01); P[j][0] += s * (ox / 2 + 0.01);
            } else {
              const s = dy === 0 ? 1 : Math.sign(dy);
              P[i][1] -= s * (oy / 2 + 0.01); P[j][1] += s * (oy / 2 + 0.01);
            }
          }
        }
      }
      if (it < 500) {
        for (let i = 0; i < n; i++) {
          P[i][0] += (S0[i][0] - P[i][0]) * 0.03;
          P[i][1] += (S0[i][1] - P[i][1]) * 0.03;
        }
      } else if (!moved) break;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, P[i][0] - W[i] / 2); maxX = Math.max(maxX, P[i][0] + W[i] / 2);
      minY = Math.min(minY, P[i][1] - H[i] / 2); maxY = Math.max(maxY, P[i][1] + H[i] / 2);
    }
    const rects = {};
    ids.forEach((id, i) => { rects[id] = { x: P[i][0] - W[i] / 2 - minX + pad, y: P[i][1] - H[i] / 2 - minY + pad, w: W[i], h: H[i] }; });
    return { rects, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
  };

  /* ================= đường nối cong ================= */
  const NORMAL = { r: [1, 0], l: [-1, 0], b: [0, 1], t: [0, -1] };
  const fmt = (p) => Math.round(p[0] * 10) / 10 + ',' + Math.round(p[1] * 10) / 10;

  /* rects: id -> {x,y,w,h}. Mỗi đường nối là một đường cong Bézier đi từ một điểm trên cạnh thẻ này tới cạnh thẻ kia. */
  U.routeAll = function (rects, rels) {
    const items = [];
    for (const r of rels) {
      const a = rects[r.from], b = rects[r.to];
      if (!a || !b || r.from === r.to) continue;
      const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
      const dy = (b.y + b.h / 2) - (a.y + a.h / 2);
      const nx = dx / ((a.w + b.w) / 2);
      const ny = dy / ((a.h + b.h) / 2);
      let sa, sb;
      if (Math.abs(nx) >= Math.abs(ny)) { sa = dx >= 0 ? 'r' : 'l'; sb = dx >= 0 ? 'l' : 'r'; }
      else { sa = dy >= 0 ? 'b' : 't'; sb = dy >= 0 ? 't' : 'b'; }
      items.push({ rel: r, a, b, sa, sb, pa: null, pb: null });
    }
    const slots = {};
    const add = (id, side, it, end, other) => { const k = id + '|' + side; (slots[k] = slots[k] || []).push({ it, end, other }); };
    items.forEach(it => { add(it.rel.from, it.sa, it, 'a', it.b); add(it.rel.to, it.sb, it, 'b', it.a); });
    Object.keys(slots).forEach(k => {
      const parts = k.split('|');
      const rc = rects[parts[0]];
      const side = parts[1];
      const vertSide = side === 'l' || side === 'r';
      const list = slots[k];
      const key = (s) => vertSide ? s.other.y + s.other.h / 2 : s.other.x + s.other.w / 2;
      list.sort((p, q) => key(p) - key(q) || p.it.rel.id.localeCompare(q.it.rel.id));
      list.forEach((s, i) => {
        const t = (i + 1) / (list.length + 1);
        const pt = vertSide
          ? [side === 'r' ? rc.x + rc.w : rc.x, rc.y + t * rc.h]
          : [rc.x + t * rc.w, side === 'b' ? rc.y + rc.h : rc.y];
        if (s.end === 'a') s.it.pa = pt; else s.it.pb = pt;
      });
    });
    const multPos = (p, n) => ({
      x: p[0] + n[0] * 12 + (n[0] === 0 ? 10 : 0),
      y: p[1] + n[1] * 14 + (n[1] === 0 ? -8 : 0),
      anchor: n[0] < 0 ? 'end' : 'start'
    });
    return items.map(it => {
      const p1 = it.pa, p2 = it.pb;
      const n1 = NORMAL[it.sa], n2 = NORMAL[it.sb];
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const d = Math.max(40, Math.min(170, dist * 0.4));
      const c1 = [p1[0] + n1[0] * d, p1[1] + n1[1] * d];
      const c2 = [p2[0] + n2[0] * d, p2[1] + n2[1] * d];
      return {
        rel: it.rel,
        d: 'M' + fmt(p1) + ' C' + fmt(c1) + ' ' + fmt(c2) + ' ' + fmt(p2),
        label: [(p1[0] + 3 * c1[0] + 3 * c2[0] + p2[0]) / 8, (p1[1] + 3 * c1[1] + 3 * c2[1] + p2[1]) / 8],
        multA: multPos(p1, n1),
        multB: multPos(p2, n2),
        p1, p2
      };
    });
  };

  /* ================= bố cục ================= */
  function fallbackSeeds(ids) {
    const seed = {};
    ids.forEach((id, i) => { seed[id] = [(i % 6) * (CARD_W + GAP + 40), Math.floor(i / 6) * 520]; });
    return seed;
  }

  function layout() {
    const D = U.D;
    const stage = $('#stage');
    U.tip.hide();
    D.classes.forEach(c => { U.cardEls[c.id].style.display = S.hiddenPackages.has(c.package) ? 'none' : ''; });
    const visible = D.classes.filter(c => !S.hiddenPackages.has(c.package));
    visible.forEach(c => { const e = U.cardEls[c.id]; e.style.width = CARD_W + 'px'; e.style.left = '0px'; e.style.top = '0px'; });
    const size = {};
    visible.forEach(c => { size[c.id] = { w: CARD_W, h: U.cardEls[c.id].offsetHeight }; });
    const ids = visible.map(c => c.id);
    const fb = fallbackSeeds(ids);
    const seed = {};
    ids.forEach(id => { seed[id] = D.byId[id].pos || fb[id]; });
    const res = U.freeLayout(ids, size, seed, D.layoutRef, GAP, PAD);
    visible.forEach(c => {
      const r = res.rects[c.id];
      const e = U.cardEls[c.id];
      e.style.left = r.x + 'px';
      e.style.top = r.y + 'px';
    });
    U.rects = res.rects;
    U.stageSize = { w: res.w, h: res.h };
    stage.style.width = res.w + 'px';
    stage.style.height = res.h + 'px';
    ['#edges-under', '#edges-over'].forEach(sel => {
      const s = $(sel);
      s.setAttribute('width', res.w);
      s.setAttribute('height', res.h);
      s.setAttribute('viewBox', '0 0 ' + res.w + ' ' + res.h);
    });
    drawEdges();
    U.applySelection();
  }
  U.layout = layout;

  function drawEdges() {
    const under = $('#edges-under');
    under.replaceChildren(markers());
    const all = U.D.relations.filter(r => U.rects[r.from] && U.rects[r.to]);
    U.routes = U.routeAll(U.rects, all);
    U.routeById = {};
    for (const rt of U.routes) {
      U.routeById[rt.rel.id] = rt;
      if (!S.showDeps && rt.rel.kind === 'dependency') continue;
      const m = MARKER[rt.rel.kind] || {};
      const g = svgEl('g', { dataset: { rel: rt.rel.id }, class: 'edge-g' });
      g.append(svgEl('path', { d: rt.d, class: 'edge-hit', dataset: { rel: rt.rel.id } }));
      const p = svgEl('path', { d: rt.d, class: 'edge' + (DASHED[rt.rel.kind] ? ' dash' : ''), dataset: { rel: rt.rel.id } });
      if (m.start) p.setAttribute('marker-start', 'url(#m-' + m.start + ')');
      if (m.end) p.setAttribute('marker-end', 'url(#m-' + m.end + ')');
      g.append(p);
      under.append(g);
    }
  }

  /* ================= chọn và làm nổi bật ================= */
  function searchMatches() {
    const q = S.search.trim().toLowerCase();
    if (!q) return null;
    const out = new Set();
    for (const c of U.D.classes) {
      const hit = c.id.toLowerCase().includes(q)
        || (c.attributes || []).some(a => a.name.toLowerCase().includes(q))
        || (c.methods || []).some(m => m.name.toLowerCase().includes(q))
        || (c.values || []).some(v => v.name.toLowerCase().includes(q));
      if (hit) out.add(c.id);
    }
    return out;
  }

  U.applySelection = function () {
    const sel = S.selected;
    const D = U.D;
    const hiRels = new Set();
    const related = new Set();
    let main = null;
    if (sel) {
      if (sel.type === 'relation') {
        const r = D.relById[sel.id];
        if (r) { hiRels.add(r.id); related.add(r.from); related.add(r.to); }
      } else {
        main = sel.id;
        for (const r of D.relsOf[main] || []) { hiRels.add(r.id); related.add(r.from); related.add(r.to); }
        related.delete(main);
      }
    }
    const matches = sel ? null : searchMatches();
    for (const c of D.classes) {
      const e = U.cardEls[c.id];
      const isRel = !!sel && sel.type === 'relation';
      e.classList.toggle('sel', !isRel && main === c.id);
      e.classList.toggle('rel', !!sel && related.has(c.id) && main !== c.id);
      e.classList.toggle('match', !!matches && matches.has(c.id));
      let dim = false;
      if (sel) dim = !(main === c.id || related.has(c.id));
      else if (matches) dim = !matches.has(c.id);
      e.classList.toggle('dim', dim);
    }
    $$('.member.sel', $('#stage')).forEach(m => m.classList.remove('sel'));
    if (sel && sel.type === 'member') {
      const card = U.cardEls[sel.id];
      const row = card && Array.from(card.querySelectorAll('.member')).find(m => m.dataset.kind === sel.kind && m.dataset.name === sel.name);
      if (row) row.classList.add('sel');
    }
    $$('#read-list button').forEach(b => b.classList.toggle('sel', !!main && b.dataset.cls === main));
    const over = $('#edges-over');
    over.replaceChildren();
    $$('.edge', $('#edges-under')).forEach(p => { p.classList.toggle('faint', !!sel && !hiRels.has(p.dataset.rel)); });
    if (sel) {
      for (const id of hiRels) {
        const rt = U.routeById[id];
        if (!rt) continue;
        const m = MARKER[rt.rel.kind] || {};
        const p = svgEl('path', { d: rt.d, class: 'edge hi' + (DASHED[rt.rel.kind] ? ' dash' : '') });
        if (m.start) p.setAttribute('marker-start', 'url(#m-' + m.start + '-hi)');
        if (m.end) p.setAttribute('marker-end', 'url(#m-' + m.end + '-hi)');
        over.append(p);
        if (rt.rel.label) over.append(svgEl('text', { x: rt.label[0], y: rt.label[1] - 4, class: 'elabel', 'text-anchor': 'middle' }, rt.rel.label));
        if (rt.rel.fromMult) over.append(svgEl('text', { x: rt.multA.x, y: rt.multA.y, class: 'emult', 'text-anchor': rt.multA.anchor }, rt.rel.fromMult));
        if (rt.rel.toMult) over.append(svgEl('text', { x: rt.multB.x, y: rt.multB.y, class: 'emult', 'text-anchor': rt.multB.anchor }, rt.rel.toMult));
      }
    }
  };

  function setHash(id) {
    try { history.replaceState(null, '', id ? '#' + id : location.pathname + location.search); } catch (e) { /* bỏ qua */ }
  }

  /* Đổi lựa chọn hiện tại; lựa chọn cũ được cất vào lịch sử để nút «Quay lại» dùng. */
  function commit(sel, opts) {
    const prev = S.selected;
    const same = prev && sel && prev.type === sel.type && prev.id === sel.id && prev.kind === sel.kind && prev.name === sel.name;
    if (prev && !same && !(opts && opts.noHistory)) {
      S.history.push(prev);
      if (S.history.length > 60) S.history.shift();
    }
    S.selected = sel;
  }

  U.selectClass = function (id, opts) {
    opts = opts || {};
    if (!U.D.byId[id]) return;
    commit({ type: 'class', id }, opts);
    setHash(id);
    U.applySelection();
    U.showDetail();
    if (opts.focus) U.focusClass(id);
  };
  U.selectMember = function (clsId, kind, name, opts) {
    opts = opts || {};
    commit({ type: 'member', id: clsId, kind, name }, opts);
    setHash(clsId);
    U.applySelection();
    U.showDetail();
    if (opts.focus) U.focusClass(clsId);
  };
  U.selectRelation = function (relId) {
    commit({ type: 'relation', id: relId });
    U.applySelection();
    U.showDetail();
  };
  U.clearSelection = function () {
    S.selected = null;
    S.history = [];
    setHash(null);
    U.applySelection();
    U.showDetail();
  };
  /* Quay lại lựa chọn trước đó (khi đã nhảy sang lớp khác và quên ngữ cảnh). */
  U.goBack = function () {
    const prev = S.history.pop();
    if (!prev) return;
    if (prev.type === 'class') U.selectClass(prev.id, { focus: true, noHistory: true });
    else if (prev.type === 'member') U.selectMember(prev.id, prev.kind, prev.name, { focus: true, noHistory: true });
    else { commit(prev, { noHistory: true }); U.applySelection(); U.showDetail(); }
  };

  /* Nhảy tới nơi một tên được định nghĩa: lớp, hoặc một dòng trong thẻ kiểu cơ bản; có thể kèm tên thành viên. */
  U.jumpTo = function (token, member, fromId) {
    const ref = U.D.refs[token];
    if (!ref) return;
    // nhảy từ một thẻ chưa được chọn: nhớ thẻ đó để nút «Quay lại» đưa về
    if (fromId && U.D.byId[fromId] && !(S.selected && S.selected.id === fromId)) {
      const top = S.history[S.history.length - 1];
      if (!(top && top.type === 'class' && top.id === fromId)) {
        if (S.selected) S.history.push(S.selected);
        S.history.push({ type: 'class', id: fromId });
      }
    }
    if (ref.kind === 'type') { U.selectMember('BasicTypes', 'attr', ref.name, { focus: true }); return; }
    const c = U.D.byId[ref.id];
    if (member) {
      if ((c.methods || []).some(x => x.name === member)) { U.selectMember(c.id, 'method', member, { focus: true }); return; }
      if ((c.attributes || []).some(x => x.name === member)) { U.selectMember(c.id, 'attr', member, { focus: true }); return; }
    }
    U.selectClass(c.id, { focus: true });
  };

  /* ================= phóng, thu, mức chi tiết ================= */
  function setLod(l) {
    if (U.lod === l && $('#stage').classList.contains('lod-' + l)) return;
    const pz = U.pz;
    let anchor = null;
    const vp = $('#canvas').getBoundingClientRect();
    if (pz && Object.keys(U.rects).length) {
      const cx = (vp.width / 2 - pz.x) / pz.k;
      const cy = (vp.height / 2 - pz.y) / pz.k;
      let best = null, bd = Infinity;
      Object.keys(U.rects).forEach(id => {
        const r = U.rects[id];
        const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w));
        const dy = Math.max(r.y - cy, 0, cy - (r.y + r.h));
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = id; }
      });
      if (best) {
        const r = U.rects[best];
        anchor = { id: best, fx: Math.min(1, Math.max(0, (cx - r.x) / r.w)), fy: Math.min(1, Math.max(0, (cy - r.y) / r.h)) };
      }
    }
    U.lod = l;
    const st = $('#stage');
    st.classList.remove('lod-0', 'lod-1', 'lod-2', 'lod-3');
    st.classList.add('lod-' + l);
    layout();
    if (anchor && pz && U.rects[anchor.id]) {
      const r = U.rects[anchor.id];
      pz.x = vp.width / 2 - (r.x + anchor.fx * r.w) * pz.k;
      pz.y = vp.height / 2 - (r.y + anchor.fy * r.h) * pz.k;
      pz.apply();
    }
  }
  U.setLod = setLod;

  function onZoom(pz) {
    const info = $('#zinfo');
    if (info) info.textContent = Math.round(pz.k * 100) + '% · mức ' + U.lod;
    const want = desiredLod(pz.k);
    if (want !== U.lod) {
      setLod(want);
      if (info) info.textContent = Math.round(pz.k * 100) + '% · mức ' + U.lod;
    }
  }

  U.fitAll = function () {
    if (S.lodMode === 'auto') setLod(0);
    else setLod(Number(S.lodMode));
    const s = U.stageSize;
    U.pz.fitRect(0, 0, s.w, s.h, 16, 1);
  };

  U.focusClass = function (id) {
    if (!U.rects[id]) return;
    const forced = S.lodMode === 'auto' ? 1 : Number(S.lodMode);
    setLod(forced);
    const r = U.rects[id];
    const vp = $('#canvas').getBoundingClientRect();
    // điện thoại: khung chi tiết phủ lên nửa dưới sơ đồ, nên chỉ phần còn lại phía trên là chỗ nhìn thấy
    const view = $('#view-diagram');
    const covered = (PHONE.matches && !view.classList.contains('nopanel')) ? $('#detail').getBoundingClientRect().height : 0;
    const vh = Math.max(120, vp.height - covered);
    const cap = S.lodMode === 'auto' ? LOD_T[1] - 0.05 : 1.2;
    const k = Math.min(cap, (vh - 60) / r.h, (vp.width - 60) / r.w);
    const kk = S.lodMode === 'auto' ? Math.max(LOD_T[0] + 0.03, k) : Math.max(0.3, k);
    const cx = r.x + r.w / 2;
    const top = r.y + Math.min(r.h / 2, (vh / 2 - 30) / kk);
    U.pz.set(kk, vp.width / 2 - cx * kk, vh / 2 - top * kk);
  };

  /* ================= chú thích khi rê chuột ================= */
  const kindOf = (c) => U.KIND_INFO[c.stereotype] || U.KIND_INFO.class;
  const typeEntry = (ref) => U.D.basic.attributes.find(a => a.name === ref.name);

  function classTip(c, hint) {
    const k = kindOf(c);
    return el('div', null,
      el('div', { class: 'tt-title' }, c.id === 'BasicTypes' ? 'Kiểu cơ bản (BasicTypes)' : U.displayName(c)),
      el('div', { class: 'tt-sub' }, 'Loại: ' + k.label + '. ' + k.text),
      el('div', null, rich(c.summary)),
      el('div', { class: 'tt-sub' }, rich(c.role.length > 240 ? c.role.slice(0, 237) + '...' : c.role)),
      el('div', { class: 'tt-sub' }, (c.read > 0 ? 'Bước đọc ' + c.read + '/' + U.D.total + ' · ' : '') + U.D.pkgById[c.package].name + ' · ' + U.STATUS_LABEL[c.status] + ' · ' + (hint || 'bấm để xem đầy đủ')));
  }
  function typeTip(ref) {
    const t = typeEntry(ref);
    const parts = [el('div', { class: 'tt-title' }, t.name + ': ' + t.type), el('div', null, rich(t.summary))];
    if (t.example) parts.push(el('div', { class: 'tt-sub' }, 'Ví dụ: ', rich(t.example)));
    if (t.cpp) parts.push(el('div', { class: 'tt-sub' }, 'C++: ', rich(t.cpp)));
    parts.push(el('div', { class: 'tt-sub' }, 'Kiểu cơ bản, không phải lớp · bấm để nhảy tới dòng này'));
    return el('div', null, parts);
  }
  function refTip(token) {
    const ref = U.D.refs[token];
    if (!ref) return null;
    if (ref.kind === 'type') return typeTip(ref);
    return classTip(U.D.byId[ref.id], 'bấm để nhảy tới lớp này');
  }
  function memberTip(c, kind, m) {
    const full = kind === 'attr' ? U.signature.attr(m) : U.signature.methodFull(m);
    const parts = [el('div', { class: 'tt-title' }, full), el('div', null, rich(m.summary))];
    if (kind === 'method') {
      if (m.pre && m.pre.length) parts.push(el('div', { class: 'tt-sub' }, 'Tiền điều kiện: ', rich(m.pre.slice(0, 2).join(' '))));
      if (m.post && m.post.length) parts.push(el('div', { class: 'tt-sub' }, 'Hậu điều kiện: ', rich(m.post.slice(0, 2).join(' '))));
      if (m.complexity) parts.push(el('div', { class: 'tt-sub' }, 'Độ phức tạp: ', rich(m.complexity)));
    } else if (m.example) {
      parts.push(el('div', { class: 'tt-sub' }, 'Ví dụ: ', rich(m.example)));
    }
    parts.push(el('div', { class: 'tt-sub' }, c.id + ' · bấm để xem đầy đủ'));
    return el('div', null, parts);
  }
  function relTip(r) {
    const mult = (r.fromMult || r.toMult) ? ' (' + (r.fromMult || '') + ' → ' + (r.toMult || '') + ')' : '';
    return el('div', null,
      el('div', { class: 'tt-title' }, r.from + ' → ' + r.to),
      el('div', null, U.KIND_LABEL[r.kind] + (r.label ? ': ' + r.label : '') + mult),
      el('div', { class: 'tt-sub' }, rich(r.explain)));
  }
  function valueTip(c, v) {
    return el('div', null, el('div', { class: 'tt-title' }, c.id + '.' + v.name), el('div', null, rich(v.meaning)));
  }

  function hoverContent(target) {
    const D = U.D;
    const tr = target.closest('.tref, .xref');
    if (tr) {
      const ref = D.refs[tr.dataset.ref];
      if (ref && tr.dataset.member && ref.kind === 'class') {
        const c = D.byId[ref.id];
        const m = (c.methods || []).find(x => x.name === tr.dataset.member);
        if (m) return memberTip(c, 'method', m);
        const a = (c.attributes || []).find(x => x.name === tr.dataset.member);
        if (a) return memberTip(c, 'attr', a);
      }
      return refTip(tr.dataset.ref);
    }
    const mem = target.closest('.member');
    if (mem) {
      const c = D.byId[mem.dataset.cls];
      const list = mem.dataset.kind === 'attr' ? c.attributes : c.methods;
      const m = list.find(x => x.name === mem.dataset.name);
      if (!m) return null;
      return c.stereotype === 'types' ? typeTip({ name: m.name }) : memberTip(c, mem.dataset.kind, m);
    }
    const vr = target.closest('.vrow');
    if (vr) {
      const c = D.byId[vr.dataset.cls];
      const v = c.values.find(x => x.name === vr.dataset.value);
      return v ? valueTip(c, v) : null;
    }
    const head = target.closest('.card-head');
    if (head) return classTip(D.byId[head.dataset.cls]);
    const hit = target.closest('.edge-hit');
    if (hit) return relTip(D.relById[hit.dataset.rel]);
    return null;
  }

  /* ================= khung chi tiết ================= */
  const linkClass = (id, label) => el('button', { class: 'linkish', onclick: () => U.selectClass(id, { focus: true }) }, label || id);

  function pillStatus(c) {
    return el('span', { class: 'badge ' + c.status, style: { marginLeft: '0' } }, U.STATUS_LABEL[c.status]);
  }

  function relationList(c) {
    const rels = U.D.relsOf[c.id] || [];
    if (!rels.length) return null;
    return el('ul', null, rels.map(r => {
      const out = r.from === c.id;
      const other = out ? r.to : r.from;
      return el('li', null,
        el('button', { class: 'linkish', onclick: () => U.selectRelation(r.id) }, U.KIND_LABEL[r.kind]),
        ' ' + (out ? '→' : '←') + ' ', linkClass(other),
        r.label ? ' (' + r.label + ')' : '');
    }));
  }

  /* Danh sách thành viên trong khung chi tiết: mỗi mục là chữ ký đầy đủ (tên kiểu bấm được) và một dòng mô tả. */
  function memberTable(c, kind) {
    const list = kind === 'attr' ? c.attributes : c.methods;
    if (!list || !list.length) return null;
    return el('div', { class: 'mlist' }, list.map(m => {
      const full = kind === 'attr' ? U.signature.attr(m) : U.signature.methodFull(m);
      const open = (e) => { if (e.target.closest('.tref, .xref')) return; U.selectMember(c.id, kind, m.name); };
      return el('div', { class: 'mitem', tabindex: '0', role: 'button', onclick: open, onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) U.selectMember(c.id, kind, m.name); } },
        el('div', { class: 'sigline' }, U.typeSpans(full)),
        el('div', { class: 'msumline' }, rich(m.summary)));
    }));
  }

  function listBlock(title, items) {
    if (!items || !items.length) return null;
    return [el('h3', null, title), el('ul', null, items.map(t => el('li', null, rich(t))))];
  }

  function implBlock(cpp) {
    if (!cpp) return null;
    return el('div', { class: 'implbox' }, el('div', { class: 'lang' }, 'C++'), rich(cpp));
  }

  /* Thanh thứ tự đọc: bước hiện tại, lý do, nút sang lớp trước và lớp sau. */
  function readNav(c) {
    const D = U.D;
    const i = D.byRead.indexOf(c);
    const prev = D.byRead[i - 1];
    const next = D.byRead[i + 1];
    const st = D.stages.find(s => s.id === c.stage);
    const btn = (cls, label) => el('button', { onclick: () => U.selectClass(cls.id, { focus: true, noHistory: true }), title: cls.read > 0 ? 'Bước ' + cls.read : 'Kiểu cơ bản' }, label);
    const nameOf = U.displayName;
    return el('div', { class: 'readnav' },
      el('div', { class: 'rn-top' }, el('span', { class: 'rnum', vars: { '--pk': pkgColor(c) } }, String(c.read)),
        el('span', null, (c.read > 0 ? 'Bước ' + c.read + '/' + D.total + ' · ' : '') + 'Chặng ' + st.id + ': ' + st.title)),
      el('div', { class: 'rn-why' }, c.readWhy),
      el('div', { class: 'rn-btns' }, prev ? btn(prev, '← ' + nameOf(prev)) : el('span'), next ? btn(next, nameOf(next) + ' →') : el('span')));
  }

  function detailClass(c) {
    const D = U.D;
    const k = kindOf(c);
    const isTypes = c.stereotype === 'types';
    return el('div', null,
      el('div', { class: 'crumbs' }, D.pkgById[c.package].name + ' · ', pillStatus(c)),
      el('h2', null, isTypes ? 'Kiểu cơ bản (BasicTypes)' : U.displayName(c)),
      readNav(c),
      el('div', { class: 'kindline' }, 'Loại: ' + k.label + '. ' + k.text),
      el('p', null, rich(c.summary)),
      el('div', { class: 'callout' }, el('div', { class: 'ct' }, 'Vai trò'), rich(c.role)),
      c.spec ? el('div', { class: 'callout' }, el('div', { class: 'ct' }, 'Ứng với yêu cầu của đề'), rich(c.spec)) : null,
      listBlock('Cần biết từ lớp khác', c.uses),
      listBlock('Bất biến', c.invariants),
      (c.values && c.values.length) ? [el('h3', null, 'Giá trị'),
        el('table', { class: 'mtable' }, el('tbody', null, c.values.map(v => el('tr', null, el('td', null, v.name), el('td', null, rich(v.meaning))))))] : null,
      (c.attributes && c.attributes.length) ? [el('h3', null, isTypes ? 'Các kiểu' : 'Thuộc tính'), memberTable(c, 'attr')] : null,
      (c.methods && c.methods.length) ? [el('h3', null, 'Phương thức'), memberTable(c, 'method')] : null,
      relationList(c) ? [el('h3', null, 'Quan hệ'), relationList(c)] : null,
      (c.impl && c.impl.cpp) ? [el('h3', null, 'Cài đặt C++'), implBlock(c.impl.cpp)] : null,
      listBlock('Ghi chú', c.notes));
  }

  function memberFacts(m, kind) {
    const parts = [];
    if (m.ctor) parts.push(el('span', { class: 'chip' }, 'hàm dựng'));
    if (m.static) parts.push(el('span', { class: 'chip' }, 'static'));
    if (m.abstract) parts.push(el('span', { class: 'chip' }, 'thuần ảo (= 0)'));
    if (m.override) parts.push(el('span', { class: 'chip' }, 'override'));
    if (m.readonly) parts.push(el('span', { class: 'chip' }, 'chỉ đọc'));
    const v = U.visOf(m, kind);
    if (v) parts.push(el('span', { class: 'chip' }, { '+': 'public', '-': 'private', '#': 'protected' }[v]));
    return parts.length ? el('div', null, parts) : null;
  }

  function detailMember(c, kind, m) {
    const isTypes = c.stereotype === 'types';
    const full = kind === 'attr' ? U.signature.attr(m) : U.signature.methodFull(m);
    return el('div', null,
      el('div', { class: 'crumbs' }, linkClass(c.id, isTypes ? 'Kiểu cơ bản' : c.id), ' · ' + (isTypes ? 'kiểu' : (kind === 'attr' ? 'thuộc tính' : (m.ctor ? 'hàm dựng' : 'phương thức')))),
      el('div', { class: 'sig-big' }, U.typeSpans(full)),
      memberFacts(m, kind),
      el('p', null, rich(m.summary)),
      m.role ? el('div', { class: 'callout' }, el('div', { class: 'ct' }, 'Vai trò'), rich(m.role)) : null,
      m.detail ? [].concat(m.detail).map(t => el('p', null, rich(t))) : null,
      listBlock('Tiền điều kiện', m.pre),
      listBlock('Hậu điều kiện', m.post),
      m.errors ? [el('h3', null, 'Lỗi'), el('p', null, rich(m.errors))] : null,
      m.complexity ? [el('h3', null, 'Độ phức tạp'), el('p', null, rich(m.complexity))] : null,
      m.perf ? [el('h3', null, 'Hiệu năng'), el('p', null, rich(m.perf))] : null,
      m.example ? [el('h3', null, 'Ví dụ'), el('div', { class: 'ex' }, rich(m.example))] : null,
      m.cpp ? [el('h3', null, 'Cài đặt C++'),
        m.implNote ? el('div', { class: 'callout warn' }, el('div', { class: 'ct' }, 'Lưu ý'), rich(m.implNote)) : null,
        implBlock(m.cpp)] : null);
  }

  function detailRelation(r) {
    const mult = (r.fromMult || r.toMult) ? el('p', null, 'Bội số: ' + (r.fromMult || '?') + ' → ' + (r.toMult || '?')) : null;
    return el('div', null,
      el('div', { class: 'crumbs' }, 'Quan hệ · ', U.KIND_LABEL[r.kind]),
      el('h2', null, r.from + ' → ' + r.to),
      el('p', null, linkClass(r.from), ' → ', linkClass(r.to)),
      r.label ? el('p', null, 'Nhãn: ', rich(r.label)) : null,
      mult,
      el('div', { class: 'callout' }, el('div', { class: 'ct' }, 'Giải thích'), rich(r.explain)));
  }

  /* Biến tên lớp và tên kiểu trong khung chi tiết thành liên kết nhảy tới nơi định nghĩa:
     (1) đoạn mã như `Account`, `HrSystem.login`, `string`; (2) tên xuất hiện trong câu chữ thường. */
  function linkify(root, selfId) {
    const codeRe = /^([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z_][A-Za-z0-9_]*))?(?:\(.*\))?$/;
    const mark = (node, token, member) => {
      node.classList.add('xref');
      node.dataset.ref = token;
      if (member) node.dataset.member = member;
      node.tabIndex = 0;
      node.setAttribute('role', 'link');
    };
    $$('code', root).forEach(code => {
      if (code.closest('.tref, .xref, button')) return;
      const m = codeRe.exec(code.textContent.trim());
      if (!m || PRIMITIVES.includes(m[1]) || m[1] === selfId) return;
      if (!U.D.refs[m[1]]) return;
      mark(code, m[1], m[2]);
    });
    const words = Object.keys(U.D.refs).filter(w => !PRIMITIVES.includes(w) && w !== selfId).sort((a, b) => b.length - a.length);
    if (!words.length) return;
    const wordRe = new RegExp('\\b(' + words.join('|') + ')\\b', 'g');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest('button, code, .sig-big, h2, h3, .xref, .tref, .readnav, .kindline, .detail-bar')) return NodeFilter.FILTER_REJECT;
        wordRe.lastIndex = 0;
        return wordRe.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const text = n.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      wordRe.lastIndex = 0;
      while ((m = wordRe.exec(text)) !== null) {
        if (m.index > last) frag.append(document.createTextNode(text.slice(last, m.index)));
        const sp = el('span', null, m[1]);
        mark(sp, m[1]);
        frag.append(sp);
        last = m.index + m[1].length;
      }
      if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
      n.replaceWith(frag);
    });
  }

  function selLabel(sel) {
    if (sel.type === 'relation') { const r = U.D.relById[sel.id]; return r ? r.from + ' → ' + r.to : 'quan hệ'; }
    return sel.type === 'member' ? sel.id + '.' + sel.name : sel.id;
  }

  U.showDetail = function () {
    const box = $('#detail');
    const sel = S.selected;
    if (!sel) {
      box.replaceChildren();
      U.setPanel(false);
      return;
    }
    let node;
    if (sel.type === 'class') node = detailClass(U.D.byId[sel.id]);
    else if (sel.type === 'member') {
      const c = U.D.byId[sel.id];
      const list = sel.kind === 'attr' ? c.attributes : c.methods;
      const m = list.find(x => x.name === sel.name);
      node = m ? detailMember(c, sel.kind, m) : detailClass(c);
    } else node = detailRelation(U.D.relById[sel.id]);
    linkify(node, sel.type === 'relation' ? null : sel.id);
    const prev = S.history[S.history.length - 1];
    const bar = el('div', { class: 'detail-bar' },
      prev ? el('button', { onclick: () => U.goBack(), title: 'Quay lại lựa chọn trước' }, '← Quay lại: ' + selLabel(prev)) : el('span'),
      el('button', { onclick: () => U.clearSelection() }, 'Đóng'));
    box.replaceChildren(bar, node);
    U.setPanel(true);
    box.scrollTop = 0;
  };

  /* Sang lớp trước hoặc sau theo thứ tự đọc. */
  U.stepRead = function (delta) {
    const sel = S.selected;
    if (!sel || sel.type === 'relation') return;
    const c = U.D.byId[sel.id];
    const target = U.D.byRead[U.D.byRead.indexOf(c) + delta];
    if (target) U.selectClass(target.id, { focus: true, noHistory: true });
  };

  /* ================= thanh bên ================= */
  function buildSide() {
    const D = U.D;
    const pf = $('#pk-filter');
    pf.replaceChildren(...D.packages.map(p => {
      const id = 'pk-' + p.id;
      return el('label', { class: 'pk-line', for: id, title: p.description },
        el('input', { type: 'checkbox', id, checked: true, dataset: { pk: p.id } }),
        el('span', { class: 'pk-dot', style: { background: p.color } }),
        el('span', null, p.name));
    }));
    pf.addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-pk]');
      if (!cb) return;
      if (cb.checked) S.hiddenPackages.delete(cb.dataset.pk); else S.hiddenPackages.add(cb.dataset.pk);
      layout();
      if (S.selected && S.selected.type !== 'relation' && S.hiddenPackages.has(D.byId[S.selected.id].package)) U.clearSelection();
    });

    // danh sách thứ tự đọc
    const rl = $('#read-list');
    rl.replaceChildren();
    D.stages.forEach(st => {
      rl.append(el('div', { class: 'stage-h' }, 'Chặng ' + st.id + ': ' + st.title), el('div', { class: 'stage-t' }, st.text));
      D.byRead.filter(c => c.stage === st.id).forEach(c => {
        rl.append(el('button', { dataset: { cls: c.id }, vars: { '--pk': pkgColor(c) }, title: c.readWhy, onclick: () => U.selectClass(c.id, { focus: true }) },
          el('span', { class: 'n' }, String(c.read)), el('span', null, U.displayName(c))));
      });
    });

    // chú giải
    const lg = $('#legend');
    const row = (label, svgBody) => el('div', { class: 'row' },
      (() => { const s = svgEl('svg', { width: 54, height: 16, viewBox: '0 0 54 16' }); s.append(...svgBody); return s; })(),
      el('span', null, label));
    const line = (dash, markerPath, atStart) => {
      const els = [svgEl('line', { x1: atStart ? 14 : 2, y1: 8, x2: atStart ? 52 : 40, y2: 8, stroke: 'var(--edge)', 'stroke-width': 1.6, 'stroke-dasharray': dash ? '5 3' : null })];
      if (markerPath) els.push(svgEl('path', { d: markerPath.d, class: markerPath.cls }));
      return els;
    };
    lg.replaceChildren(
      row('kế thừa', line(false, { d: 'M40,2 L52,8 L40,14 Z', cls: 'mk-hollow' })),
      row('cài đặt giao diện', line(true, { d: 'M40,2 L52,8 L40,14 Z', cls: 'mk-hollow' })),
      row('sở hữu (composition)', line(false, { d: 'M2,8 L8,3 L14,8 L8,13 Z', cls: 'mk-filled' }, true)),
      row('kết hợp lỏng', line(false, { d: 'M2,8 L8,3 L14,8 L8,13 Z', cls: 'mk-hollow' }, true)),
      row('liên kết', line(false, { d: 'M34,3 L40,8 L34,13', cls: 'mk-open' })),
      row('phụ thuộc', line(true, { d: 'M34,3 L40,8 L34,13', cls: 'mk-open' })),
      el('div', { style: { marginTop: '8px' } },
        el('div', { class: 'row' }, el('span', { class: 'rnum', style: { background: 'var(--accent)' } }, '5'), el('span', null, 'số thứ tự đọc')),
        el('div', { class: 'row' }, el('span', { class: 'tref', style: { cursor: 'default' } }, 'string'), el('span', null, 'tên kiểu: rê chuột xem định nghĩa (máy tính), bấm hoặc chạm để nhảy tới')),
        el('div', { class: 'row' }, el('span', { class: 'status-dot', style: { color: '#0d9488', borderColor: '#0d9488' } }, 'Hỗ trợ'), el('span', null, 'hạ tầng dùng chung (chuỗi, file, khung menu)')),
        el('div', { class: 'row' }, el('span', { class: 'tparam' }, 'T'), el('span', null, 'tham số của lớp template')),
        el('div', { class: 'row', style: { color: 'var(--muted)', fontSize: '12px' } }, 'Thẻ không có nhãn là phần làm trực tiếp chức năng của đề. Màu mép trái thẻ là gói.')));

    // tìm kiếm
    const input = $('#search');
    const results = $('#search-results');
    const closeResults = () => { results.hidden = true; };
    input.addEventListener('input', () => {
      S.search = input.value;
      results.replaceChildren();
      const q = S.search.trim().toLowerCase();
      results.hidden = !q;
      if (q) {
        const found = [];
        D.classes.forEach(c => {
          if (c.id.toLowerCase().includes(q)) found.push({ label: c.id, cls: c.id });
          (c.attributes || []).forEach(a => { if (a.name.toLowerCase().includes(q)) found.push({ label: c.id + '.' + a.name, cls: c.id, kind: 'attr', name: a.name }); });
          (c.methods || []).forEach(m => { if (m.name.toLowerCase().includes(q)) found.push({ label: c.id + '.' + m.name + '()', cls: c.id, kind: 'method', name: m.name }); });
          (c.values || []).forEach(v => { if (v.name.toLowerCase().includes(q)) found.push({ label: c.id + '.' + v.name, cls: c.id }); });
        });
        found.slice(0, 14).forEach(f => results.append(el('button', {
          onclick: () => {
            closeResults();
            if (f.kind) U.selectMember(f.cls, f.kind, f.name, { focus: true }); else U.selectClass(f.cls, { focus: true });
          }
        }, f.label)));
        if (!found.length) results.append(el('div', { class: 'sr-note' }, 'Không tìm thấy'));
        if (found.length > 14) results.append(el('div', { class: 'sr-note' }, '... còn ' + (found.length - 14) + ' kết quả, gõ thêm để thu hẹp'));
      }
      U.applySelection();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); }
      if (e.key === 'Enter') { const b = results.querySelector('button'); if (b) b.click(); }
    });
    input.addEventListener('focus', () => { if (input.value.trim()) results.hidden = false; });
    document.addEventListener('click', (e) => { if (!e.target.closest('#search-box')) closeResults(); });

    $('#chk-deps').addEventListener('change', (e) => { S.showDeps = e.target.checked; layout(); });
    $('#lod-select').addEventListener('change', (e) => {
      S.lodMode = e.target.value;
      if (S.lodMode === 'auto') onZoom(U.pz); else setLod(Number(S.lodMode));
      onZoom(U.pz);
    });
  }

  U.setPanel = function (on) { $('#view-diagram').classList.toggle('nopanel', !on); };

  /* ================= khởi tạo ================= */
  U.initDiagram = function () {
    const D = U.D;
    const stage = $('#stage');
    const canvas = $('#canvas');
    const detail = $('#detail');
    D.classes.forEach(c => {
      const card = buildCard(c);
      U.cardEls[c.id] = card;
      stage.append(card);
    });
    buildSide();

    U.pz = new U.PanZoom(canvas, stage, { minK: 0.1, maxK: 3, onChange: onZoom, onDragStart: () => U.tip.hide() });

    // chú thích khi rê chuột (trên sơ đồ và trong khung chi tiết)
    // Trên màn hình cảm ứng, sau mỗi lần chạm trình duyệt còn sinh thêm sự kiện «rê chuột» giả; bỏ qua để chú thích không dính lại trên màn hình.
    let touchInput = false;
    const noteInput = (e) => { touchInput = e.pointerType === 'touch'; if (touchInput) U.tip.hide(); };
    document.addEventListener('pointerdown', noteInput, true);
    document.addEventListener('pointermove', noteInput, true);
    const hover = (e) => {
      if (touchInput) return;
      if (U.pz.drag && U.pz.drag.moved) return;
      const content = hoverContent(e.target);
      if (content) U.tip.show(content, e.clientX, e.clientY); else U.tip.hide();
    };
    stage.addEventListener('mouseover', hover);
    stage.addEventListener('mousemove', (e) => U.tip.move(e.clientX, e.clientY));
    stage.addEventListener('mouseleave', () => U.tip.hide());
    detail.addEventListener('mouseover', (e) => {
      if (touchInput) return;
      const content = e.target.closest('.tref, .xref') ? hoverContent(e.target) : null;
      if (content) U.tip.show(content, e.clientX, e.clientY); else U.tip.hide();
    });
    detail.addEventListener('mousemove', (e) => U.tip.move(e.clientX, e.clientY));
    detail.addEventListener('mouseleave', () => U.tip.hide());
    canvas.addEventListener('wheel', () => U.tip.hide(), { passive: true });

    // bấm: tên kiểu hoặc tên lớp trong chữ ký nhảy tới nơi định nghĩa
    detail.addEventListener('click', (e) => {
      const x = e.target.closest('.tref, .xref');
      if (x) U.jumpTo(x.dataset.ref, x.dataset.member);
    });
    detail.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const x = e.target.closest('.xref');
      if (x) U.jumpTo(x.dataset.ref, x.dataset.member);
    });
    stage.addEventListener('click', (e) => {
      if (U.pz.justDragged) return;
      const tr = e.target.closest('.tref');
      if (tr) { U.tip.hide(); const src = tr.closest('.card'); U.jumpTo(tr.dataset.ref, undefined, src ? src.dataset.id : undefined); return; }
      const mem = e.target.closest('.member');
      if (mem) { U.selectMember(mem.dataset.cls, mem.dataset.kind, mem.dataset.name); return; }
      const head = e.target.closest('.card-head, .vrow');
      if (head) { U.selectClass(head.dataset.cls); return; }
      const card = e.target.closest('.card');
      if (card) { U.selectClass(card.dataset.id); return; }
      const hit = e.target.closest('.edge-hit');
      if (hit) { U.selectRelation(hit.dataset.rel); return; }
      if (S.selected) U.clearSelection();
    });
    stage.addEventListener('dblclick', (e) => {
      if (e.target.closest('.tref')) return;
      const card = e.target.closest('.card');
      if (card) { U.selectClass(card.dataset.id, { focus: true }); }
    });
    stage.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const t = e.target;
      if (t.classList.contains('member') || t.classList.contains('card-head')) { e.preventDefault(); t.click(); }
    });
    canvas.addEventListener('click', (e) => {
      if (e.target === canvas && !U.pz.justDragged && S.selected) U.clearSelection();
      // màn hình hẹp: thanh bên là lớp phủ, chạm vào sơ đồ thì đóng nó lại
      if (!U.pz.justDragged && NARROW.matches && !e.target.closest('.canvas-controls')) $('#view-diagram').classList.remove('showside');
    });
    // màn hình hẹp: chọn một lớp trong thanh bên xong thì đóng thanh bên để thấy kết quả
    $('#side').addEventListener('click', (e) => {
      if (NARROW.matches && e.target.closest('#read-list button')) $('#view-diagram').classList.remove('showside');
    });
    // mũi tên trái và phải: sang lớp trước hoặc sau theo thứ tự đọc
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight') U.stepRead(1);
      else if (e.key === 'ArrowLeft') U.stepRead(-1);
    });

    if (window.matchMedia('(pointer: coarse)').matches) {
      const h = $('#canvas-hint');
      if (h) h.textContent = 'Kéo một ngón tay để di chuyển, hai ngón tay để phóng to hoặc thu nhỏ. Số trên mỗi thẻ là thứ tự đọc. Chạm vào một lớp hoặc một thành viên để xem đầy đủ; nút ☰ mở danh sách.';
    }
    const hideHint = () => { const h = $('#canvas-hint'); if (h) h.remove(); };
    canvas.addEventListener('pointerdown', hideHint, { once: true });
    canvas.addEventListener('wheel', hideHint, { once: true, passive: true });
    $('#btn-zoomin').addEventListener('click', () => U.pz.zoomCenter(1.25));
    $('#btn-zoomout').addEventListener('click', () => U.pz.zoomCenter(0.8));
    $('#btn-fit').addEventListener('click', () => U.fitAll());
    $('#btn-side').addEventListener('click', () => {
      const v = $('#view-diagram');
      if (NARROW.matches) { v.classList.toggle('showside'); } else { v.classList.toggle('noside'); }
    });

    U.tip.init();
    layout();
    U.showDetail();
  };

})(window.UML);
