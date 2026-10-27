---
title: Git-терминал
minutes: 15
---

# Первый коммит

Git-задача — это терминал с настоящим git (в браузере), граф коммитов и список целей. Цели отмечаются сами, как только состояние репозитория им соответствует. Файлы можно править во вкладке «Файлы» — без vim.

```git
id: first-commit
title: Создай репозиторий и закоммить README
prompt: |
  Ты в пустой папке `~`. Создай проект `app`, внутри — git-репозиторий и файл `README.md`
  с любым текстом. Закоммить его.
goals:
  - text: Есть репозиторий (`git init` в папке `app`)
    check: { repo: true }
  - text: В репозитории есть `README.md`
    check: { file: README.md }
  - text: Сделан хотя бы один коммит
    check: { commits: 1 }
  - text: Рабочая папка чистая
    check: { clean: true }
setup:
  - mkdir app
solution:
  - cd app
  - git init
  - echo "# app" > README.md
  - git add README.md
  - git commit -m "add readme"
hints:
  - Сначала `cd app`, потом `git init`.
  - "`echo \"текст\" > README.md` создаст файл."
```

# Ветка и конфликт

`setup` готовит состояние: здесь уже есть репозиторий с двумя ветками, которые поменяли одну и ту же строку.

```git
id: conflict
title: Разреши конфликт слияния
prompt: |
  В репозитории `~/api` ветка `feature` и `main` по-разному поменяли `config.txt`.
  Влей `feature` в `main` и разреши конфликт: в файле должна остаться строка `port=9090`.
setup:
  - mkdir api && cd api && git init
  - echo "port=8080" > config.txt && git add . && git commit -m "init"
  - 'git checkout -b feature && echo "port=9090" > config.txt && git commit -am "feature: new port"'
  - 'git checkout main && echo "port=3000" > config.txt && git commit -am "main: other port"'
goals:
  - text: "`feature` влита в `main`"
    check: { merged: feature, into: main }
  - text: "В `config.txt` строка `port=9090`"
    check: { file: config.txt, contains: "port=9090" }
  - text: Нет незавершённого слияния и незакоммиченных изменений
    check: { clean: true }
solution:
  - cd api
  - git merge feature
  - echo "port=9090" > config.txt
  - git add config.txt
  - git commit -m "merge feature"
hints:
  - "`cd api`, затем `git merge feature` покажет конфликт. Посмотри файл: `cat config.txt`."
  - Перепиши файл без маркеров `<<<<<<<`, затем `git add` и `git commit`.
explain: |
  Конфликт — это не ошибка, а вопрос git к тебе: «обе стороны поменяли одно и то же, что оставить?».
  После правки файла `git add` говорит git: «я разрешил», а `commit` создаёт merge-коммит с двумя родителями.
```

# Remote и тиммейт

«Удалённый» репозиторий здесь — просто папка `/srv/origin.git`. В `setup` тиммейт Петя успел запушить свой коммит.

```git
id: push
title: Запушь, не потеряв коммит тиммейта
prompt: |
  В `~/bot` есть твой коммит, который ещё не на сервере. Но Петя уже запушил свой.
  Сделай так, чтобы на сервере (`origin`) были оба коммита.
setup:
  - git init --bare /srv/origin.git
  - mkdir /tmp && cd /tmp && git clone /srv/origin.git seed && cd seed && echo "bot" > README.md && git add . && git commit -m "init" && git push origin main
  - cd /home/student && git clone /srv/origin.git bot
  - mkdir /petya && cd /petya && git clone /srv/origin.git bot && cd bot && git config user.name Петя && echo "token=..." > .env.example && git add . && git commit -m "add env example" && git push
  - cd /home/student/bot && echo "func main() {}" > main.go && git add . && git commit -m "add main"
goals:
  - text: Ветка `main` запушена на `origin` и совпадает с локальной
    check: { remote: origin, branch: main }
  - text: Коммит Пети есть в истории
    check: { file: .env.example }
solution:
  - cd bot
  - git pull
  - git push
hints:
  - "Зайди в папку: `cd bot`. Попробуй `git push` и прочитай, что ответит git."
  - Сначала забери чужие изменения — `git pull`.
```

# Свободная песочница

Блок с `sandbox: true` — без целей и проверки, просто поиграться. На прохождение урока не влияет.

```git
sandbox: true
title: Поиграйся с ветками
setup:
  - mkdir play && cd play && git init && echo hi > a.txt && git add . && git commit -m "start"
```
