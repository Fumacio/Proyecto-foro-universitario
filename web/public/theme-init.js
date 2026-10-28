// Aplica el tema guardado antes del primer paint para evitar el "flash".
(function () {
  try {
    var stored = localStorage.getItem('foro:theme');
    var theme = stored ? JSON.parse(stored) : 'system';
    var dark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (dark) root.classList.add('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#09090b' : '#fafafa');
  } catch (e) {}
})();
