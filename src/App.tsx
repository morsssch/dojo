import { useEffect, useState } from 'react';
import { HashRouter, Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { findCourse, manifest } from './content';
import { allAchievements, evaluateAchievements } from './state/achievements';
import { AchBadge, StreakButton } from './components/Activity';
import { AchievementsPage } from './pages/Achievements';
import { prefsOf, progress, useProgress } from './state/progress';
import { applyPrefs, isDarkNow } from './state/prefs';
import { I } from './components/ui/icons';
import { Home } from './pages/Home';
import { CoursePage } from './pages/Course';
import { LessonPage } from './pages/Lesson';
import { RoadmapPage } from './pages/Roadmap';
import { SandboxPage } from './pages/Sandbox';
import { SettingsPage } from './pages/Settings';

export function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--text)" />
      <rect x="5" y="13" width="22" height="5" rx="1" fill="var(--bg)" />
      <path d="M14 18l-3 8M18 18l3 8" stroke="var(--bg)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function ThemeToggle() {
  const p = useProgress();
  const prefs = prefsOf(p);
  const dark = isDarkNow(prefs);
  useEffect(() => applyPrefs(prefs), [prefs.theme, prefs.font, prefs.size, prefs.accent]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button className="icon-btn" onClick={() => progress.setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Светлая тема' : 'Тёмная тема'} title={dark ? 'Светлая тема' : 'Тёмная тема'}>
      {dark ? <I.sun /> : <I.moon />}
    </button>
  );
}

function Topbar() {
  const p = useProgress();
  const loc = useLocation();
  const m = loc.pathname.match(/^\/c\/([^/]+)/);
  const course = findCourse(m?.[1]);
  return (
    <header className="topbar">
      <Link to="/" className="logo" aria-label="Dojo — на главную">
        <Logo />
        <span>Dojo</span>
      </Link>
      {course && (
        <nav className="crumbs" aria-label="Навигация">
          <span aria-hidden>/</span>
          <Link to={`/c/${course.id}`}>{course.meta.title}</Link>
        </nav>
      )}
      <span className="spacer" />
      {course?.roadmap && (
        <Link className="btn ghost small" to={`/c/${course.id}/roadmap`} title="Роадмап курса">
          <I.map /> <span className="hide-sm">Роадмап</span>
        </Link>
      )}
      <Link className="btn ghost small" to="/sandbox" title="Песочница: Go, SQL, Git">
        <I.sandbox /> <span className="hide-sm">Песочница</span>
      </Link>
      <StreakButton />
      <ThemeToggle />
      <Link className="icon-btn" to="/settings" aria-label="Настройки и прогресс" title="Настройки и прогресс">
        <I.settings />
      </Link>
    </header>
  );
}

function Toasts() {
  const p = useProgress();
  const [toasts, setToasts] = useState<string[]>([]);
  useEffect(() => {
    const fresh = progress.grant(evaluateAchievements(p, manifest));
    if (fresh.length) {
      setToasts((t) => [...t, ...fresh]);
      setTimeout(() => setToasts((t) => t.filter((x) => !fresh.includes(x))), 5000);
    }
  }, [p]);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((id) => {
        const a = allAchievements(manifest).find((x) => x.id === id);
        if (!a) return null;
        return (
          <div key={id} className="toast">
            <AchBadge a={a} got />
            <div>
              <b>{a.title}</b>
              <span>{a.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFound() {
  const params = useParams();
  return (
    <div className="page empty">
      <h1 className="display">Здесь пусто</h1>
      <p>Такой страницы нет{params['*'] ? `: ${params['*']}` : ''}.</p>
      <Link className="btn primary" to="/">
        На главную
      </Link>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <ScrollTop />
      <Topbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/c/:course" element={<CoursePage />} />
        <Route path="/c/:course/roadmap" element={<RoadmapPage />} />
        <Route path="/c/:course/:module/:lesson" element={<LessonPage />} />
        <Route path="/c/:course/:module/:lesson/:step" element={<LessonPage />} />
        <Route path="/sandbox" element={<SandboxPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toasts />
    </HashRouter>
  );
}
