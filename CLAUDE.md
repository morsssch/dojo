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
npm run build:cs-runtime   # один раз: собирает C# (Roslyn + .NET 10 в wasm) в public/runtimes/cs (нужен .NET SDK 10)
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
- `src/runtime/executors.ts` — исполнители в браузере: Go (yaegi wasm в воркере), C# (.NET + Roslyn в модульном воркере), JS (воркер), Python (pyodide CDN), SQL (PGlite).
- `runtimes/cs/` — C#-раннер (`Runner.cs`: Roslyn компилирует файлы в памяти, код проверки оборачивается в свою точку входа) и `build.sh`;
  воркер — `public/runtimes/cs/cs-worker.js`; в `npm run check` C# идёт через `tools/cs-host.mjs` (отдельный процесс, убивается по таймауту).
  Пролог проверки `Dojo.Check/Assert/Throws` и разбор ответа раннера — `src/core/runners/cssrc.ts`.
- `src/components/blocks/` — UI блоков: Quiz (+OrderList), Task, Git, Anim, Project, Cards, Written, Playground, Mermaid, Needs. Рендер — `Segments.tsx`.
- `src/components/Workspace.tsx` — полноэкранный режим задач; `DbView.tsx` — ER-диаграмма и данные БД (интроспекция — `src/runtime/sqlSchema.ts`).
- `src/core/runners/explain.ts` — объяснения ошибок Go/Postgres по-русски, `require`/`forbid`.
- `src/state/progress.ts` — прогресс в localStorage, экспорт/импорт; `achievements.ts` — ачивки.
- `src/pages/` — Home, Course (дашборд), Lesson (плеер шагов), Roadmap (@xyflow/react), Sandbox, Settings.
- `runtimes/go/` — исходник Go-рантайма (`main.go`) и `build.sh` (список пакетов stdlib).
- Статьи: `articles/<id>/` (`index.md` или `index.html`, `script` с `mount(root, ctx)`, `style` на токенах Dojo); рантайм —
  `src/articles/runtime.ts` (ctx, область CSS), формулы — `src/articles/math.ts` (KaTeX), страница — `src/pages/Article.tsx`.
- Личные курсы: `owners` в course.yaml — курс виден на сайте только после входа синхронизацией под этим логином (`src/content.ts`).

## Добавить новый тип блока

1. Схема в `src/core/schema.ts` + запись в `BLOCK_SCHEMAS`.
2. Если блок «обязательный» (засчитывается) — проверь логику `required` в `parse.ts`.
3. Компонент в `src/components/blocks/`, подключить в `Segments.tsx`, иконку/подпись — в `ui/icons.tsx` (`KindIcon`, `KIND_LABEL`).
4. Проверки контента — в `tools/check.ts`.
5. Пример в `courses/demo/` и раздел в `docs/AUTHORING.md`.

## Правила

- Текст интерфейса — по-русски, на «ты», без канцелярита.
- Стили — только через CSS-переменные из `src/styles/app.css` (светлая и тёмная тема).
- Дизайн строгий и монохромный: основное действие — цветом текста, цвет только смысловой (ok/bad/warn/deep, цвета поясов). Шрифты — IBM Plex Sans / Mono. Без эмодзи в интерфейсе — только SVG-иконки из `ui/icons.tsx`.
- После изменений: `npx tsc -p tsconfig.json`, `npm run check`, глазами в `npm run dev`.
- Обнови `BACKLOG.md` в конце сессии: что сделано, что дальше.
- Репозиторий публичный: никаких имён, названий команд и личного контекста в файлах и коммитах.
- Коммиты — без подписей ИИ (без `Co-Authored-By` и ссылок на сессии).
