// Keep the hero name "सुदर्शनास्त्र | SUDARSHANASHTRA" on one line: shrink it a little only if the fonts on this computer make it too wide.
(function () {
  function fit() {
    var n = document.querySelector('.hp-name'); if (!n || !n.offsetParent) return;
    n.style.zoom = '';
    var w = n.parentElement.clientWidth, s = n.scrollWidth;
    var kids = n.children, used = 0;
    for (var i = 0; i < kids.length; i++) used += kids[i].getBoundingClientRect().width;
    used += 12 * (kids.length - 1);
    if (getComputedStyle(n).flexWrap === 'nowrap' && used > w) n.style.zoom = Math.max(0.7, (w - 4) / used).toFixed(3);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  setTimeout(fit, 300);
})();
