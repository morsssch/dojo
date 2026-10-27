---
title: Анимированные схемы
minutes: 5
---

# Путь HTTP-запроса

Анимированная схема — это узлы на сетке и шаги. На каждом шаге можно отправить «пакет» по стрелке, подсветить узлы и поменять подписи. Листай кнопкой «Дальше» или нажми ▶.

```anim
title: Что происходит, когда фронт дёргает API
nodes:
  - { id: browser, label: Браузер, x: 0, y: 1, kind: actor }
  - { id: dns, label: DNS, x: 1, y: 0, kind: cloud }
  - { id: server, label: Go-сервер, x: 2, y: 1, sub: "слушает :8080" }
  - { id: db, label: Postgres, x: 3, y: 1, kind: db }
edges:
  - [browser, dns]
  - [browser, server]
  - [server, db]
steps:
  - text: Пользователь нажал «Войти». Браузер знает только адрес `api.team.dev`, а не IP-адрес.
    highlight: [browser]
  - text: Сначала браузер спрашивает у **DNS**, какой IP у этого имени.
    send: { from: browser, to: dns, label: "api.team.dev?" }
  - text: DNS отвечает IP-адресом. Теперь можно открыть TCP-соединение.
    send: { from: dns, to: browser, label: "95.163.1.10" }
  - text: Браузер отправляет HTTP-запрос `POST /api/login` с JSON в теле.
    send: { from: browser, to: server, label: "POST /login" }
    set: { server: "обрабатывает запрос" }
  - text: Хендлер в Go идёт в базу за пользователем.
    send: { from: server, to: db, label: "SELECT" }
  - text: База возвращает строку, сервер сверяет хэш пароля.
    send: { from: db, to: server, label: "1 row" }
    set: { server: "bcrypt.Compare ✓" }
  - text: Сервер отвечает `200 OK` и токеном. Всё это заняло ~40 мс.
    send: { from: server, to: browser, label: "200 + JWT", color: "#4fb477" }
    set: { server: "слушает :8080" }
```

# Горутины и канал

Схемой можно показывать не только сеть, но и то, что происходит внутри программы. Узлы, перечисленные в `show`, появляются только на нужном шаге.

```anim
title: Горутина пишет в канал, main читает
nodes:
  - { id: main, label: main, x: 0, y: 0, sub: "запущена" }
  - { id: ch, label: "chan int", x: 1, y: 0, kind: queue, sub: "пусто" }
  - { id: worker, label: worker, x: 2, y: 0, sub: "ещё не создана" }
edges:
  - [main, ch]
  - [worker, ch]
steps:
  - text: Программа стартует с одной горутины — `main`. Она создаёт небуферизованный канал.
    highlight: [main, ch]
  - text: "`go worker(ch)` запускает вторую горутину. Это дёшево: ~2 КБ стека."
    set: { worker: "запущена" }
    highlight: [worker]
  - text: "`main` делает `<-ch` и **блокируется**: в канале пусто."
    set: { main: "ждёт <-ch" }
  - text: worker кладёт в канал число. Небуферизованный канал = рукопожатие, значение передаётся из рук в руки.
    send: { from: worker, to: ch, label: "42" }
    set: { ch: "42" }
  - text: main просыпается и забирает значение.
    send: { from: ch, to: main, label: "42" }
    set: { ch: "пусто", main: "получила 42" }
```

> [!TIP]
> Анимация уважает системную настройку «уменьшить движение»: пакеты тогда не летят, а просто появляются.
