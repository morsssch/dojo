// Настройки синхронизации через GitHub Gist.
import { useState } from 'react';
import { connect, disconnect, syncNow, useSync } from '../state/sync';
import { I } from './ui/icons';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Dojo';

const ago = (t?: number) => {
  if (!t) return 'ещё не было';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'только что';
  if (s < 3600) return `${Math.round(s / 60)} мин назад`;
  return new Date(t).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function SyncPanel() {
  const st = useSync();
  const [token, setToken] = useState('');
  const cfg = st.config;
  return (
    <section className="panel">
      <h2>Синхронизация</h2>
      {cfg ? (
        <>
          <p>
            Вход как <b>{cfg.login ?? 'GitHub'}</b>. Прогресс, заметки и черновики кода лежат в твоём секретном гисте и сливаются между устройствами сами: через
            20 секунд после изменений и при открытии сайта.
          </p>
          <p className="muted" style={{ fontSize: 14 }}>
            Последняя синхронизация: {ago(cfg.last)}
            {cfg.gistId && (
              <>
                {' · '}
                <a href={`https://gist.github.com/${cfg.gistId}`} target="_blank" rel="noreferrer">
                  гист
                </a>
              </>
            )}
          </p>
          <div className="row-btns">
            <button className="btn primary" onClick={() => void syncNow()} disabled={st.busy}>
              {st.busy ? <span className="spinner" /> : <I.reset />} Синхронизировать сейчас
            </button>
            <button className="btn ghost" onClick={() => confirm('Выйти? Прогресс в этом браузере останется.') && disconnect()}>
              Выйти
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Чтобы прогресс был на всех твоих устройствах, войди своим токеном GitHub. Нужен токен с одним правом — <b>gist</b>:{' '}
            <a href={TOKEN_URL} target="_blank" rel="noreferrer">
              создать токен
            </a>{' '}
            (срок — на твой выбор). Токен хранится только в этом браузере, на другом устройстве введи его ещё раз.
          </p>
          <form
            className="sync-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (token.trim()) void connect(token).then(() => setToken(''));
            }}
          >
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_… или github_pat_…"
              aria-label="Токен GitHub"
              autoComplete="off"
            />
            <button className="btn primary" disabled={st.busy || !token.trim()}>
              {st.busy ? <span className="spinner" /> : null} Войти
            </button>
          </form>
        </>
      )}
      {st.error && (
        <p className="sync-error" role="alert">
          {st.error}
        </p>
      )}
    </section>
  );
}
