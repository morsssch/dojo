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

# Связанные таблицы

У SQL-задач над условием есть блок **«База данных»**: ER-диаграмма (таблицы, ключи, связи) и вкладки с данными каждой таблицы. Наведи на таблицу — подсветятся её связи.

```task
id: join
lang: sql
title: Кто в какой команде
prompt: |
  Выведи имя участника и название его команды. Участников без команды не выводи.
setup: |
  CREATE TABLE teams (id serial PRIMARY KEY, name text NOT NULL UNIQUE);
  CREATE TABLE users (id serial PRIMARY KEY, name text NOT NULL, email text);
  CREATE TABLE memberships (
    user_id int NOT NULL REFERENCES users(id),
    team_id int NOT NULL REFERENCES teams(id),
    role text NOT NULL,
    PRIMARY KEY (user_id, team_id)
  );
  INSERT INTO teams (name) VALUES ('gophers'), ('rivals');
  INSERT INTO users (name, email) VALUES ('Аня', 'a@x.dev'), ('Боря', NULL), ('Вика', 'v@x.dev'), ('Гоша', NULL);
  INSERT INTO memberships VALUES (1, 1, 'design'), (2, 1, 'backend'), (3, 2, 'frontend');
starter: |
  SELECT
solution: |
  SELECT u.name, t.name
  FROM memberships m
  JOIN users u ON u.id = m.user_id
  JOIN teams t ON t.id = m.team_id;
hints:
  - Нужно соединить три таблицы — `memberships` связывает `users` и `teams`.
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
