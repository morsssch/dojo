# Dojo — инструкции для ИИ-ассистентов

Dojo — статическая платформа интерактивных курсов (Vite + React + TS, GitHub Pages).
Первый курс — «Go Backend с нуля» (`courses/go-backend`).

## Прежде чем что-то делать

1. Прочитай `BACKLOG.md` — там целевая аудитория, принятые решения, ограничения и текущий план.
2. Если задача — **писать контент курса**: читай `docs/AUTHORING.md`. Код платформы трогать не нужно.
   Образцы всех блоков — `courses/demo/`.
3. Если задача — **менять платформу**: читай раздел «Архитектура» ниже.

## Команды

```bash
npm install
npm run build:go-runtime   # один раз: собирает Go-интерпретатор в public/runtimes/go (нужен Go 1.22+)
npm run dev                # http://localhost:5173
npm run check              # валидирует курсы и прогоняет эталонные решения всех задач
npm run build              # check + tsc + vite build → dist/
```

## Архитектура

- `src/core/` — чистая логика без браузера (используется и сайтом, и `tools/check.ts`):
  - `schema.ts` — zod-схемы всех YAML (курс, модуль, урок, роадмап, блоки). **Новый блок или поле — начни отсюда.**
  - `parse.ts` — разбор курса и урока: шаги по `# `, fenced-блоки → сегменты.
  - `manifest.ts` — лёгкое описание курсов (строится при сборке Vite-плагином `tools/vite-plugin-dojo.ts`).
  - `runners/check.ts` — проверка задач (io-тесты, харнесс `@@PASS/@@FAIL`, сравнение SQL-таблиц); `runners/gosrc.ts` — склейка Go-исходников.
  - `git/` — MemFS, эмулятор оболочки с isomorphic-git, проверки целей.
- `src/runtime/executors.ts` — исполнители в браузере: Go (yaegi wasm в воркере), JS (воркер), Python (pyodide CDN), SQL (PGlite).
- `src/components/blocks/` — UI блоков: Quiz, Task, Git, Anim, Project, Playground, Mermaid. Рендер — `Segments.tsx`.
- `src/state/progress.ts` — прогресс в localStorage, экспорт/импорт; `achievements.ts` — ачивки.
- `src/pages/` — Home, Course (дашборд), Lesson (плеер шагов), Roadmap (@xyflow/react), Sandbox, Settings.
- `runtimes/go/` — исходник Go-рантайма (`main.go`) и `build.sh` (список пакетов stdlib).

## Добавить новый тип блока

1. Схема в `src/core/schema.ts` + запись в `BLOCK_SCHEMAS`.
2. Если блок «обязательный» (засчитывается) — проверь логику `required` в `parse.ts`.
3. Компонент в `src/components/blocks/`, подключить в `Segments.tsx`, иконку/подпись — в `ui/icons.tsx` (`KindIcon`, `KIND_LABEL`).
4. Проверки контента — в `tools/check.ts`.
5. Пример в `courses/demo/` и раздел в `docs/AUTHORING.md`.

## Правила

- Текст интерфейса — по-русски, на «ты», без канцелярита.
- Стили — только через CSS-переменные из `src/styles/app.css` (светлая и тёмная тема).
- После изменений: `npx tsc -p tsconfig.json`, `npm run check`, глазами в `npm run dev`.
- Обнови `BACKLOG.md` в конце сессии: что сделано, что дальше.
- Репозиторий публичный: никаких имён, названий команд и личного контекста в файлах и коммитах.
- Коммиты — без подписей ИИ (без `Co-Authored-By` и ссылок на сессии).
