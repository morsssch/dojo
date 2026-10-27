---
title: Проверь себя
checkpoint: true
pass: 0.66
minutes: 3
---

# Мини-тест

Урок с `checkpoint: true` — это тест по модулю. Если решить не меньше доли `pass` заданий (здесь 2 из 3), появится кнопка «Отметить модуль как пройденный». Так можно быстро пропустить то, что уже знаешь.

```quiz
id: c1
question: Где хранятся задачи курса?
options:
  - text: В Markdown-файлах уроков, в fenced-блоках
    correct: true
  - text: В базе данных на сервере
    why: Сервера нет — это статический сайт на GitHub Pages.
```

```quiz
id: c2
kind: number
question: Сколько видов квизов поддерживает платформа?
answer: 5
```

```quiz
id: c3
kind: text
question: Как называется блок, который нужно сделать на своём компьютере?
answer: [project]
```
