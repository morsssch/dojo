import { useRef, useState } from 'react';
import { progress, useProgress } from '../state/progress';
import { I } from '../components/ui/icons';

export function SettingsPage() {
  const p = useProgress();
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
          <h2>Тема</h2>
          <p>По умолчанию — как в системе.</p>
          <div className="seg" role="radiogroup" aria-label="Тема">
            {(
              [
                ['system', 'Как в системе'],
                ['light', 'Светлая'],
                ['dark', 'Тёмная'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} role="radio" aria-checked={(p.theme ?? 'system') === v} className={(p.theme ?? 'system') === v ? 'on' : ''} onClick={() => progress.setTheme(v)}>
                {l}
              </button>
            ))}
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
