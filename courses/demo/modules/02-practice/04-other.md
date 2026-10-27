---
title: JS, Python и проекты
minutes: 10
---

# JavaScript

Платформа не привязана к Go: задачи можно писать на JS и Python. Вывод — `console.log`, ввод — `input()`.

```task
id: js-max
lang: js
title: Максимум
prompt: Напиши функцию `max(xs)`, которая возвращает максимальный элемент массива.
starter: |
  function max(xs) {
  }
solution: |
  function max(xs) {
    return Math.max(...xs);
  }
harness: |
  dojoCheck('max([1, 5, 3])', max([1, 5, 3]), 5);
  dojoCheck('max([-2, -7])', max([-2, -7]), -2);
```

# Python

Python запускается через Pyodide — первый запуск скачает интерпретатор (~10 МБ).

```task
id: py-words
lang: python
title: Счётчик слов
prompt: Прочитай строку и выведи количество слов в ней.
starter: |
  line = input()
solution: |
  line = input()
  print(len(line.split()))
tests:
  - { stdin: "привет мир", stdout: "2" }
  - { stdin: "  много   пробелов   тут ", stdout: "3" }
```

# Задание на своём компьютере

Некоторые вещи в браузере не сделать: Docker, настоящий `go build`, подключение к реальной базе. Для них — блок `project`: инструкция, команды и чек-лист, который ученик отмечает сам.

```project
id: install-go
title: Поставь Go и запусти hello world
prompt: |
  Установи Go с [go.dev/dl](https://go.dev/dl/) и проверь, что всё работает.
commands:
  - go version
  - mkdir hello && cd hello
  - go mod init hello
  - go run .
checklist:
  - "`go version` показывает 1.22 или новее"
  - Создан модуль командой `go mod init`
  - "`go run .` печатает приветствие"
hints:
  - Если `go` не находится — перезапусти терминал, чтобы подхватился PATH.
```
