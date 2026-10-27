// Применение пользовательских настроек оформления к <html data-*>.
import type { Prefs } from './progress';

const FONT_URLS: Partial<Record<Prefs['font'], string>> = {
  golos: 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap',
  serif: 'https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400&display=swap',
};

export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  if (p.theme === 'system') delete el.dataset.theme;
  else el.dataset.theme = p.theme;
  el.dataset.font = p.font;
  el.dataset.size = p.size;
  el.dataset.accent = p.accent;
  if (p.eyeCare) el.dataset.eyecare = '';
  else delete el.dataset.eyecare;
  const url = FONT_URLS[p.font];
  if (url && !document.querySelector(`link[data-font="${p.font}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.font = p.font;
    document.head.appendChild(link);
  }
}

export const isDarkNow = (p: Prefs) => p.theme === 'dark' || (p.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
