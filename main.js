'use strict';
/* Khởi động: đọc dữ liệu, dựng sơ đồ lớp, giao diện sáng tối. */
(function (U) {
  const { $, el } = U;

  function setupTheme() {
    const btn = $('#btn-theme');
    const modes = ['auto', 'light', 'dark'];
    const labels = { auto: 'Giao diện: tự động', light: 'Giao diện: sáng', dark: 'Giao diện: tối' };
    let mode = U.store.get('uml-theme') || 'auto';
    if (!modes.includes(mode)) mode = 'auto';
    const apply = () => {
      if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', mode);
      btn.textContent = labels[mode];
    };
    btn.addEventListener('click', () => {
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
      U.store.set('uml-theme', mode);
      apply();
    });
    apply();
  }

  function showLoadError(err) {
    const main = $('#main');
    main.replaceChildren(el('div', { class: 'errbox' },
      el('h2', null, 'Không đọc được dữ liệu của sơ đồ'),
      el('p', null, 'Lỗi: ' + (err && err.message ? err.message : String(err))),
      el('p', null, 'Trình duyệt thường không cho một trang mở bằng cách bấm đúp (địa chỉ bắt đầu bằng file://) đọc các file JSON đi kèm. Cách khắc phục: mở PowerShell, vào thư mục uml và chạy một máy chủ cục bộ, rồi mở địa chỉ bên dưới trong trình duyệt:'),
      el('pre', null, 'cd "D:\\Project 2 ctdl\\uml"\npy -m http.server 8000'),
      el('p', null, 'Mở: http://localhost:8000 . Muốn dừng máy chủ thì nhấn Ctrl + C trong cửa sổ PowerShell.')));
  }

  async function start() {
    setupTheme();
    try {
      await U.loadData();
    } catch (err) {
      showLoadError(err);
      return;
    }
    const D = U.D;
    document.title = 'UML Quản lý nhân sự (bản gọn)';
    U.tip.init();
    U.initDiagram();
    U.fitAll();
    const h = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (h && D.byId[h]) U.selectClass(h, { focus: true });
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { U.layout(); }); } catch (e) { /* bỏ qua */ }
    window.UML_READY = true;
  }

  start();

})(window.UML);
