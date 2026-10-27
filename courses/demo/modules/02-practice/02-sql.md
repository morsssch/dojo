---
title: SQL на настоящем Postgres
minutes: 10
---

# Запрос на выборку

У SQL-задачи есть `setup` (создаёт таблицы и данные) и эталонное `solution`. Платформа выполняет оба запроса в чистой базе и сравнивает результаты. Порядок строк важен, только если указано `ordered: true`.

```task
id: select
lang: sql
title: Кто в топ-3
prompt: |
  В таблице `teams` — команды и места на хакатоне. Выведи **названия** трёх лучших команд,
  от первого места к третьему.
setup: |
  CREATE TABLE teams (id serial PRIMARY KEY, name text NOT NULL, place int NOT NULL);
  INSERT INTO teams (name, place) VALUES
    ('gophers', 7), ('rivals', 1), ('newbies', 12), ('pivo-driven', 2), ('null-pointer', 3);
starter: |
  SELECT
solution: |
  SELECT name FROM teams ORDER BY place LIMIT 3;
ordered: true
hints:
  - Сортировка — `ORDER BY`, ограничение количества — `LIMIT`.
```

# Агрегаты

```task
id: group
lang: sql
title: Сколько людей в каждой роли
prompt: |
  Выведи для каждой роли (`role`) количество участников. Колонки: роль и количество.
setup: |
  CREATE TABLE members (id serial PRIMARY KEY, name text, role text);
  INSERT INTO members (name, role) VALUES
    ('Аня', 'design'), ('Боря', 'backend'), ('Вика', 'frontend'), ('Гоша', 'backend'), ('Даша', 'devops');
solution: |
  SELECT role, count(*) FROM members GROUP BY role;
```

# Изменение данных

Для `INSERT`/`UPDATE`/`DELETE` задаётся `check` — запрос, который выполняется после кода ученика. Сравнивается его результат с результатом после эталона.

```task
id: update
lang: sql
title: Бэкендер ушёл в девопс
prompt: |
  Боря переходит в девопс. Обнови его роль на `devops`.
setup: |
  CREATE TABLE members (id serial PRIMARY KEY, name text, role text);
  INSERT INTO members (name, role) VALUES ('Аня', 'design'), ('Боря', 'backend'), ('Гоша', 'backend');
starter: |
  UPDATE members
solution: |
  UPDATE members SET role = 'devops' WHERE name = 'Боря';
check: |
  SELECT name, role FROM members ORDER BY id;
ordered: true
hints:
  - "Не забудь `WHERE`, иначе в девопс уйдут все."
```
