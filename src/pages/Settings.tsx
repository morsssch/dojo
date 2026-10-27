import { useRef, useState } from 'react';
import { Accent, ACCENTS, prefsOf, progress, useProgress } from '../state/progress';
import { I } from '../components/ui/icons';

const ACCENT_NAMES: Record<Accent, string> = {
  mono: 'Строгий (цвет текста)',
  blue: 'Синий',
  indigo: 'Индиго',
  violet: 'Фиолетовый',
  pink: 'Розовый',
  red: 'Красный',
  orange: 'Оранжевый',
  amber: 'Янтарный',
  green: 'Зелёный',
  teal: 'Бирюзовый',
  cyan: 'Голубой',
};

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
export function SettingsPage() {
  const p = useProgress();
  const prefs = prefsOf(p);
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const download = () => {
    const blob = new Blob([progress.export()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dojo-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Файл прогресса скачан.');
  };

  return (
    <main className="page">
      <h1 className="display" style={{ margin: '0 0 20px', fontSize: 32 }}>
        Настройки
      </h1>
      <div className="settings">
        <section className="panel">
          <h2>Оформление</h2>
          <p>Настройки сохраняются в этом браузере и попадают в файл прогресса.</p>
          <div className="pref-grid">
            <span className="pref-label">Тема</span>
            <Seg value={prefs.theme} onChange={(theme) => progress.setPrefs({ theme })} options={[['system', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']]} />
            <span className="pref-label">Защита зрения</span>
            <label className="switch">
              <input type="checkbox" checked={prefs.eyeCare} onChange={(e) => progress.setPrefs({ eyeCare: e.target.checked })} />
              <span className="switch-track" aria-hidden />
              <span className="muted" style={{ fontSize: 13.5 }}>
                Тёплый фильтр: меньше синего света, работает с любой темой
              </span>
            </label>
            <span className="pref-label">Шрифт</span>
            <Seg value={prefs.font} onChange={(font) => progress.setPrefs({ font })} options={[['plex', 'IBM Plex'], ['golos', 'Golos'], ['serif', 'С засечками для чтения'], ['system', 'Системный']]} />
            <span className="pref-label">Размер текста</span>
            <Seg value={prefs.size} onChange={(size) => progress.setPrefs({ size })} options={[['s', 'Меньше'], ['m', 'Обычный'], ['l', 'Крупнее'], ['xl', 'Крупный']]} />
            <span className="pref-label">Акцент</span>
            <div className="swatches" role="radiogroup" aria-label="Акцентный цвет">
              {ACCENTS.map((v) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={prefs.accent === v}
                  aria-label={ACCENT_NAMES[v]}
                  title={ACCENT_NAMES[v]}
                  className={`swatch${prefs.accent === v ? ' on' : ''}`}
                  style={{ ['--sw' as string]: v === 'mono' ? 'var(--text)' : `var(--acc-${v})` }}
                  onClick={() => progress.setPrefs({ accent: v })}
                />
              ))}
            </div>
          </div>
          <div className="pref-preview">
            <div className="md">
              <p>
                Так выглядит текст урока. В Go слайс — это <code>указатель + len + cap</code>, поэтому <b>append</b> иногда копирует массив.
              </p>
            </div>
            <div className="row-btns">
              <button className="btn primary small">Проверить</button>
              <div className="bar" style={{ width: 160, alignSelf: 'center' }}>
                <i style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        </section>
        <section className="panel">
          <h2>Прогресс</h2>
          <p>Прогресс хранится только в этом браузере. Чтобы перенести его на другое устройство, скачай файл и загрузи его там.</p>
          <div className="row-btns">
            <button className="btn primary" onClick={download}>
              <I.download /> Скачать прогресс
            </button>
            <button className="btn" onClick={() => file.current?.click()}>
              <I.upload /> Загрузить из файла
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  progress.import(await f.text());
                  setMsg('Прогресс загружен.');
                } catch (err) {
                  setMsg(`Не получилось загрузить: ${(err as Error).message}`);
                }
                e.target.value = '';
              }}
            />
          </div>
          {msg && (
            <p style={{ marginTop: 12, marginBottom: 0 }} role="status">
              {msg}
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Сброс</h2>
          <p>Удалит весь прогресс, черновики кода и достижения в этом браузере.</p>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm('Точно стереть весь прогресс? Это не отменить. Сначала можно скачать файл прогресса.')) {
                progress.resetAll();
                setMsg('Прогресс стёрт.');
              }
            }}
          >
            <I.reset /> Стереть весь прогресс
          </button>
        </section>
      </div>
    </main>
  );
}
