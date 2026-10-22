'use strict';
/* Tiện ích dùng chung: tạo phần tử, đọc dữ liệu, chú thích nổi, kéo và phóng to. */
window.UML = window.UML || {};
(function (U) {

  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* Tạo phần tử HTML. attrs: class, text, vars (biến CSS), dataset, onXxx, còn lại là thuộc tính. */
  U.el = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'vars') { for (const [n, val] of Object.entries(v)) e.style.setProperty(n, val); }
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return e;
  };

  const SVGNS = 'http://www.w3.org/2000/svg';
  U.svgEl = function (tag, attrs, ...kids) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') e.setAttribute('class', v);
        else if (k === 'text') e.textContent = v;
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else e.setAttribute(k, String(v));
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return e;
  };

  /* Văn bản có đoạn mã đặt trong dấu huyền: `code`. Không dùng innerHTML. */
  U.rich = function (text) {
    const frag = document.createDocumentFragment();
    String(text === undefined || text === null ? '' : text).split('`').forEach((part, i) => {
      if (!part) return;
      if (i % 2) frag.append(U.el('code', null, part));
      else frag.append(document.createTextNode(part));
    });
    return frag;
  };

  /* Bỏ dấu huyền để dùng trong chú thích hoặc xuất ảnh. */
  U.plain = (text) => String(text === undefined || text === null ? '' : text).replace(/`/g, '');

  U.store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } }
  };

  /* ---------- nhãn tiếng Việt ---------- */
  U.STATUS_LABEL = { core: 'Cốt lõi', support: 'Hỗ trợ', optional: 'Tùy chọn' };
  U.KIND_INFO = {
    class: { label: 'lớp thông thường', text: 'Có dữ liệu và các hàm làm việc trên dữ liệu đó.' },
    interface: { label: 'giao diện (interface)', text: 'Chỉ khai báo các hàm mà lớp khác phải có, không tự viết phần thân. Tên được in nghiêng.' },
    abstract: { label: 'lớp trừu tượng (abstract)', text: 'Không tạo trực tiếp một đối tượng từ lớp này; các lớp con kế thừa rồi viết nốt phần còn thiếu. Tên được in nghiêng.' },
    value: { label: 'kiểu giá trị (value)', text: 'Chỉ chứa dữ liệu, không có hành vi phức tạp; hai đối tượng cùng nội dung dùng thay nhau được và được sao chép khi cần.' },
    enum: { label: 'kiểu liệt kê (enumeration)', text: 'Chỉ nhận một trong vài giá trị có tên cố định; các giá trị được liệt kê ngay trong thẻ.' },
    utility: { label: 'lớp tiện ích (utility)', text: 'Chỉ gồm các hàm tĩnh gọi thẳng qua tên lớp; không tạo đối tượng.' },
    immutable: { label: 'lớp bất biến (immutable)', text: 'Sau khi tạo thì nội dung không bao giờ đổi.' },
    types: { label: 'bảng kiểu cơ bản', text: 'Không phải lớp: là bảng tra các kiểu có sẵn của C++ (string, vector, ...) dùng trong chữ ký.' },
    template: { label: 'lớp template (lớp mẫu)', text: 'Viết một lần với tham số kiểu T (ô nét đứt ở góc thẻ); khi dùng thì thay T bằng một kiểu cụ thể, ví dụ AccountList<Employee>. Toàn bộ mã nằm trong file .h.' },
    exception: { label: 'ngoại lệ (exception)', text: 'Một lỗi được ném ra khi có chuyện sai, để nơi gọi xử lý.' }
  };
  U.KIND_LABEL = {
    inheritance: 'kế thừa',
    realization: 'cài đặt giao diện',
    composition: 'sở hữu (composition)',
    aggregation: 'kết hợp lỏng (aggregation)',
    association: 'liên kết (association)',
    dependency: 'phụ thuộc (dependency)'
  };

  /* Tên hiển thị của một thẻ: thẻ kiểu cơ bản có tên riêng, lớp template kèm tham số. */
  U.displayName = (c) => (c.id === 'BasicTypes' ? 'Kiểu cơ bản' : c.id + (c.tparams ? '<' + c.tparams.join(', ') + '>' : ''));

  /* ---------- dữ liệu ---------- */
  U.D = { loaded: false };
  U.S = {
    selected: null,         // { type: 'class'|'member'|'relation', id, kind, name }
    lodMode: 'auto',
    hiddenPackages: new Set(),
    history: [],
    showDeps: false,
    search: ''
  };

  const FILES = ['meta', 'classes_types', 'classes_util', 'classes_model', 'classes_storage', 'classes_logic',
    'classes_ui', 'relations'];

  U.loadData = async function () {
    const out = {};
    for (const f of FILES) {
      const res = await fetch('data/' + f + '.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('Không đọc được data/' + f + '.json (HTTP ' + res.status + ')');
      out[f] = await res.json();
    }
    const D = U.D;
    D.meta = out.meta.meta;
    D.packages = out.meta.packages;
    D.stages = out.meta.readingStages;
    D.layoutRef = out.meta.layoutRef || null;
    D.classes = [].concat(out.classes_types.classes, out.classes_util.classes, out.classes_model.classes, out.classes_storage.classes,
      out.classes_logic.classes, out.classes_ui.classes);
    D.byId = {};
    D.classes.forEach(c => { D.byId[c.id] = c; });
    D.byRead = D.classes.slice().sort((a, b) => a.read - b.read);
    D.total = D.byRead.filter(c => c.read > 0).length;
    /* refs: tên -> nơi nhảy tới (lớp, hoặc một dòng của thẻ BasicTypes) */
    D.refs = {};
    D.basic = D.byId.BasicTypes;
    D.classes.forEach(c => { if (c.id !== 'BasicTypes') D.refs[c.id] = { kind: 'class', id: c.id }; });
    (D.basic ? D.basic.attributes : []).forEach(t => { D.refs[t.token || t.name] = { kind: 'type', id: 'BasicTypes', name: t.name }; });
    D.pkgById = {};
    D.packages.forEach(p => { D.pkgById[p.id] = p; });
    D.relations = out.relations.relations;
    D.relById = {};
    D.relations.forEach(r => { D.relById[r.id] = r; });
    D.relsOf = {};
    D.classes.forEach(c => { D.relsOf[c.id] = []; });
    D.relations.forEach(r => { D.relsOf[r.from].push(r); if (r.to !== r.from) D.relsOf[r.to].push(r); });
    D.loaded = true;
    return D;
  };

  U.visOf = (m, kind) => (m.vis === undefined ? (kind === 'attr' ? '-' : '+') : m.vis);
  U.signature = {
    attr(a) { const v = U.visOf(a, 'attr'); return (v ? v + ' ' : '') + a.name + ': ' + a.type; },
    methodFull(m) {
      const head = U.visOf(m, 'method') + ' ' + m.name + '(' + (m.params || []).join(', ') + ')';
      return m.ctor ? head : head + ': ' + m.returns;
    },
    methodCompact(m) {
      const names = (m.params || []).map(p => p.split(':')[0].split('=')[0].trim());
      return m.name + '(' + names.join(', ') + ')';
    }
  };

  /* Chia một chữ ký thành các đoạn; tên kiểu đã biết (lớp hoặc kiểu cơ bản) nằm sau dấu «:» hoặc «(» đầu tiên
     được bọc trong span.tref để rê chuột xem định nghĩa và bấm để nhảy tới. */
  const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g;
  U.typeSpans = function (text) {
    const frag = document.createDocumentFragment();
    const str = String(text);
    const cut = (() => { const a = str.indexOf(':'), b = str.indexOf('('); const c = [a, b].filter(x => x >= 0); return c.length ? Math.min.apply(null, c) : str.length; })();
    let last = 0;
    IDENT.lastIndex = cut;
    let m;
    while ((m = IDENT.exec(str)) !== null) {
      const w = m[0];
      if (!U.D.refs[w]) continue;
      if (m.index > last) frag.append(document.createTextNode(str.slice(last, m.index)));
      frag.append(U.el('span', { class: 'tref', dataset: { ref: w } }, w));
      last = m.index + w.length;
    }
    if (last < str.length) frag.append(document.createTextNode(str.slice(last)));
    return frag;
  };

  /* ---------- chú thích nổi ---------- */
  U.tip = {
    node: null,
    init() { this.node = U.$('#tooltip'); },
    show(content, clientX, clientY) {
      const t = this.node;
      if (!t) return;
      t.replaceChildren(content);
      t.style.display = 'block';
      const pad = 14;
      const r = t.getBoundingClientRect();
      let x = clientX + pad;
      let y = clientY + pad;
      if (x + r.width > window.innerWidth - 8) x = Math.max(8, clientX - r.width - pad);
      if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8);
      t.style.left = x + 'px';
      t.style.top = y + 'px';
    },
    move(clientX, clientY) {
      const t = this.node;
      if (!t || t.style.display !== 'block') return;
      const pad = 14;
      const r = t.getBoundingClientRect();
      let x = clientX + pad;
      let y = clientY + pad;
      if (x + r.width > window.innerWidth - 8) x = Math.max(8, clientX - r.width - pad);
      if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8);
      t.style.left = x + 'px';
      t.style.top = y + 'px';
    },
    hide() { if (this.node) this.node.style.display = 'none'; }
  };

  /* ---------- kéo và phóng to ---------- */
  U.PanZoom = class {
    constructor(viewport, stage, opts) {
      opts = opts || {};
      this.vp = viewport;
      this.stage = stage;
      this.k = 1; this.x = 0; this.y = 0;
      this.minK = opts.minK || 0.08;
      this.maxK = opts.maxK || 3;
      this.onChange = opts.onChange || function () { };
      this.onDragStart = opts.onDragStart || function () { };
      this.drag = null;        // thao tác kéo bằng một ngón hoặc chuột
      this.ptrs = new Map();   // các điểm chạm đang đặt trên khung: id -> {x, y}
      this.pinch = null;       // thao tác hai ngón: phóng, thu và di chuyển cùng lúc
      this._dragEnd = -1e9;    // thời điểm kết thúc lần kéo hoặc véo gần nhất (để bỏ qua cú bấm theo sau)
      viewport.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
      viewport.addEventListener('pointerdown', (e) => this._down(e));
      viewport.addEventListener('pointermove', (e) => this._move(e));
      viewport.addEventListener('pointerup', (e) => this._up(e));
      viewport.addEventListener('pointercancel', (e) => this._up(e));
      // Safari trên iPhone và iPad có thêm sự kiện «gesture» riêng cho thao tác véo
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => viewport.addEventListener(t, (e) => e.preventDefault()));
      // chặn việc trình duyệt bôi đen chữ hoặc kéo chữ khi kéo sơ đồ
      viewport.addEventListener('selectstart', (e) => e.preventDefault());
      viewport.addEventListener('dragstart', (e) => e.preventDefault());
    }
    apply() {
      this.stage.style.transform = 'translate(' + this.x + 'px,' + this.y + 'px) scale(' + this.k + ')';
      this.onChange(this);
    }
    set(k, x, y) {
      this.k = Math.min(this.maxK, Math.max(this.minK, k));
      this.x = x; this.y = y;
      this.apply();
    }
    zoomAt(clientX, clientY, factor) {
      const r = this.vp.getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      const k2 = Math.min(this.maxK, Math.max(this.minK, this.k * factor));
      const f = k2 / this.k;
      this.x = px - (px - this.x) * f;
      this.y = py - (py - this.y) * f;
      this.k = k2;
      this.apply();
    }
    zoomCenter(factor) {
      const r = this.vp.getBoundingClientRect();
      this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
    }
    /* Đặt khung nhìn sao cho hình chữ nhật (x, y, w, h) của stage vừa khung, tối đa phóng maxFit. */
    fitRect(x, y, w, h, margin, maxFit) {
      const r = this.vp.getBoundingClientRect();
      const vw = Math.max(50, r.width);
      const vh = Math.max(50, r.height);
      const m = margin === undefined ? 24 : margin;
      let k = Math.min((vw - 2 * m) / w, (vh - 2 * m) / h);
      k = Math.min(k, maxFit || 1);
      k = Math.min(this.maxK, Math.max(this.minK, k));
      this.k = k;
      this.x = (vw - w * k) / 2 - x * k;
      this.y = (vh - h * k) / 2 - y * k;
      this.apply();
    }
    _wheel(e) {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
      this.zoomAt(e.clientX, e.clientY, factor);
    }
    /* Đúng trong khoảng ngắn sau khi vừa kéo hoặc véo xong: cú «bấm» sinh ra ngay sau đó không được tính là chọn. */
    get justDragged() { return performance.now() - this._dragEnd < 350; }

    _capture(id) { try { this.vp.setPointerCapture(id); } catch (err) { /* bỏ qua */ } }

    /* Bắt đầu thao tác hai ngón: nhớ điểm của sơ đồ đang nằm dưới trung điểm hai ngón và khoảng cách ban đầu. */
    _startPinch() {
      const ps = Array.from(this.ptrs.entries());
      const [a, b] = [ps[0][1], ps[1][1]];
      const r = this.vp.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left;
      const my = (a.y + b.y) / 2 - r.top;
      this.pinch = { ids: [ps[0][0], ps[1][0]], d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), k0: this.k, wx: (mx - this.x) / this.k, wy: (my - this.y) / this.k };
      if (this.drag) this.drag.moved = true;
      ps.forEach(p => this._capture(p[0]));
      this.vp.classList.add('grabbing');
      this.onDragStart();
    }
    _down(e) {
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        // chuột chỉ có một con trỏ: bỏ trạng thái cũ nếu lần nhả chuột trước đã xảy ra ngoài cửa sổ
        this.ptrs.clear();
        this.pinch = null;
      }
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.ptrs.size === 1) {
        this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: this.x, oy: this.y, moved: false, touch: e.pointerType !== 'mouse' };
      } else if (this.ptrs.size === 2 && !this.pinch) {
        this._startPinch();
      }
    }
    _move(e) {
      const p = this.ptrs.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (this.pinch) {
        const [a, b] = this.pinch.ids.map(id => this.ptrs.get(id));
        if (!a || !b) return;
        const r = this.vp.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - r.left;
        const my = (a.y + b.y) / 2 - r.top;
        const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
        this.k = Math.min(this.maxK, Math.max(this.minK, this.pinch.k0 * d / this.pinch.d0));
        this.x = mx - this.pinch.wx * this.k;
        this.y = my - this.pinch.wy * this.k;
        this.apply();
        return;
      }
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      // ngón tay rung nhiều hơn chuột, nên ngưỡng bắt đầu kéo lớn hơn
      if (!d.moved && Math.abs(dx) + Math.abs(dy) > (d.touch ? 9 : 5)) {
        d.moved = true;
        this._capture(e.pointerId);
        this.vp.classList.add('grabbing');
        this.onDragStart();
      }
      if (d.moved) {
        this.x = d.ox + dx;
        this.y = d.oy + dy;
        this.apply();
      }
    }
    _up(e) {
      if (!this.ptrs.has(e.pointerId)) return;
      this.ptrs.delete(e.pointerId);
      const wasMoved = (this.drag && this.drag.moved) || !!this.pinch;
      if (this.pinch) {
        // một ngón nhấc lên: ngón còn lại tiếp tục kéo sơ đồ, không bị giật
        this.pinch = null;
        const rest = Array.from(this.ptrs.entries())[0];
        if (rest) {
          this.drag = { id: rest[0], sx: rest[1].x, sy: rest[1].y, ox: this.x, oy: this.y, moved: true, touch: true };
        } else {
          this.drag = null;
        }
        this._dragEnd = performance.now();
        if (!this.ptrs.size) this.vp.classList.remove('grabbing');
        return;
      }
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      this.vp.classList.remove('grabbing');
      if (wasMoved) this._dragEnd = performance.now();
    }
  };

})(window.UML);
