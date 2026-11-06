(function () {
  // 标签页（对阵页的小场切换）；支持 #g3 深链
  document.querySelectorAll('[data-tabs]').forEach(function (root) {
    var tabs = root.querySelectorAll('[data-tab]'), panels = root.querySelectorAll('[data-panel]');
    function show(id, push) {
      var ok = false;
      tabs.forEach(function (t) { var on = t.dataset.tab === id; t.classList.toggle('on', on); if (on) ok = true; });
      if (!ok) return false;
      panels.forEach(function (p) { p.classList.toggle('on', p.dataset.panel === id); });
      if (push) history.replaceState(null, '', '#' + id);
      return true;
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab, true); }); });
    var h = location.hash.replace('#', '');
    if (!h || !show(h, false)) show(root.dataset.default || tabs[0].dataset.tab, false);
    window.addEventListener('hashchange', function () { show(location.hash.replace('#', ''), false); });
  });
  // 筛选
  document.querySelectorAll('[data-filter]').forEach(function (root) {
    var chips = root.querySelectorAll('[data-f]'), items = root.querySelectorAll('[data-i]');
    var state = {};
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var g = c.dataset.g; state[g] = c.dataset.f;
        root.querySelectorAll('[data-g="' + g + '"]').forEach(function (x) { x.classList.toggle('on', x === c); });
        items.forEach(function (it) {
          var vis = true;
          Object.keys(state).forEach(function (k) { var v = state[k]; if (v && v !== 'all' && (it.dataset[k] || '').split(' ').indexOf(v) < 0) vis = false; });
          it.style.display = vis ? '' : 'none';
        });
        root.querySelectorAll('[data-day]').forEach(function (d) { d.style.display = d.querySelector('[data-i]:not([style*="none"])') ? '' : 'none'; });
      });
    });
  });
  // 倒计时
  var cds = document.querySelectorAll('[data-countdown]');
  function tick() {
    cds.forEach(function (el) {
      var t = new Date(el.dataset.countdown).getTime() - Date.now();
      if (t <= 0) { el.textContent = '已到开赛时间'; return; }
      var d = Math.floor(t / 864e5), h = Math.floor(t % 864e5 / 36e5), m = Math.floor(t % 36e5 / 6e4), s = Math.floor(t % 6e4 / 1e3);
      el.textContent = (d ? d + '天 ' : '') + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    });
  }
  if (cds.length) { tick(); setInterval(tick, 1000); }
})();
