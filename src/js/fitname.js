// Hero name "सुदर्शनास्त्र | SUDARSHANASHTRA":
// 1) if the Utsaah font is installed, size the Hindi so its letter height matches the English capitals;
// 2) keep it on one line: shrink a little only if the fonts on this computer make it too wide.
(function () {
  var cv = document.createElement('canvas').getContext('2d');
  function wid(f) { cv.font = '100px ' + f; return cv.measureText('सुदर्शनास्त्र').width; }
  var hasU = false;
  function detect() {
    if (hasU) return;
    try { hasU = wid('Utsaah, monospace') !== wid('monospace') && wid('Utsaah, serif') !== wid('serif'); } catch (e) {}
    if (hasU) document.documentElement.classList.add('has-utsaah');
  }
  detect();
  function asc(font, txt) { cv.font = font; var m = cv.measureText(txt); return m.actualBoundingBoxAscent || 0; }
  function fit() {
    detect();
    var n = document.querySelector('.hp-name'); if (!n || !n.offsetParent) return;
    var hi = n.querySelector('.hp-nhi'), en = n.querySelector('.hp-nen');
    n.style.zoom = ''; if (hi) hi.style.fontSize = '';
    if (hasU && hi && en) {
      var es = getComputedStyle(en), cap = asc(es.fontWeight + ' 100px ' + es.fontFamily, 'SUDARSH');
      var hs = getComputedStyle(hi), body = asc(hs.fontWeight + ' 100px ' + hs.fontFamily, 'दनस');
      if (cap > 0 && body > 0) hi.style.setProperty('font-size', (parseFloat(es.fontSize) * cap / body * 1.08).toFixed(1) + 'px', 'important');
    }
    var w = n.parentElement.clientWidth, kids = n.children, used = 12 * (kids.length - 1);
    for (var i = 0; i < kids.length; i++) used += kids[i].getBoundingClientRect().width;
    if (getComputedStyle(n).flexWrap === 'nowrap' && used > w) n.style.zoom = Math.max(0.7, (w - 4) / used).toFixed(3);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  setTimeout(fit, 300);
})();
