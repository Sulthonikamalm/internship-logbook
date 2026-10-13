// Inline blocking script to prevent Flash of Unstyled Theme (FOUC).
// Runs synchronously in <head> before page renders.
export function ThemeScript() {
  const code = `(function() {
    try {
      var storageKey = 'internflow-theme';
      var theme = localStorage.getItem(storageKey);
      var mql = window.matchMedia('(prefers-color-scheme: dark)');
      var isDark = theme === 'dark' || ((!theme || theme === 'system') && mql.matches);
      var root = document.documentElement;
      if (isDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    } catch (e) {}
  })();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
