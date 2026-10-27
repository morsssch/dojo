// Человеческие объяснения частых ошибок: что значит сообщение и что обычно делать.
// Добавляй сюда паттерны по мере того, как ученики на них натыкаются.

interface Rule {
  re: RegExp;
  text: (m: RegExpMatchArray) => string;
}

const GO: Rule[] = [
  { re: /undefined: (\w+)/, text: (m) => `Имя «${m[1]}» не объявлено. Частые причины: опечатка или регистр (\`Println\` ≠ \`println\`), переменная объявлена внутри другого блока \`{ }\`, забыт импорт пакета.` },
  { re: /undefined selector:? (\w+)|has no field or method (\w+)/, text: (m) => `У значения нет поля или метода «${m[1] ?? m[2]}». Проверь имя и регистр: снаружи пакета видны только имена с заглавной буквы.` },
  { re: /mismatched types|invalid operation.*mismatched/, text: () => 'Операция над значениями разных типов. Go не приводит типы сам — приведи явно, например `float64(n)` или `int(x)`.' },
  { re: /cannot use .* as .* (value|type)/, text: () => 'Тип значения не совпадает с ожидаемым (в присваивании, аргументе или return). Посмотри, какой тип ждут, и приведи явно или поменяй объявление.' },
  { re: /cannot convert .* to/, text: () => 'Такое преобразование типов в Go невозможно. Строку в число переводят через `strconv.Atoi`, число в строку — `strconv.Itoa` или `fmt.Sprint`.' },
  { re: /missing return/, text: () => 'Функция объявлена с результатом, но не на всех путях есть `return`. Добавь `return` в конце функции.' },
  { re: /expected .*found|unexpected|syntax error/i, text: () => 'Синтаксическая ошибка: Go не смог разобрать код. Проверь парные скобки `()` `{}`, запятые в списках и что `{` стоит на той же строке, что `if`/`for`/`func`.' },
  { re: /redeclared|already declared/, text: () => 'Имя объявлено дважды в одной области видимости. Внутри функции `:=` создаёт новую переменную — для повторного присваивания используй `=`.' },
  { re: /too many arguments|not enough arguments/, text: () => 'Число аргументов при вызове не совпадает с объявлением функции.' },
  { re: /index out of range \[(\d+)\] with length (\d+)/, text: (m) => `Обращение к элементу ${m[1]}, а в слайсе всего ${m[2]} элемент(ов). Индексы идут от 0 до len-1.` },
  { re: /index out of range/, text: () => 'Выход за границы слайса или массива. Индексы идут от 0 до len(s)-1.' },
  { re: /assignment to entry in nil map/, text: () => 'Запись в nil-мапу. Мапу нужно создать перед использованием: `m := make(map[string]int)` или `m := map[string]int{}`.' },
  { re: /nil pointer dereference|invalid memory address/, text: () => 'Обращение через nil-указатель: значение ещё не создано. Проверь, где указатель должен был получить `&T{...}` или результат конструктора, и не вернулась ли ошибка.' },
  { re: /integer divide by zero|division by zero/, text: () => 'Деление на ноль. Проверь делитель перед делением.' },
  { re: /send on closed channel/, text: () => 'Запись в закрытый канал. Закрывает канал только тот, кто в него пишет, и только когда писать больше нечего.' },
  { re: /close of closed channel/, text: () => 'Канал закрыт дважды. Закрывать канал должен ровно один отправитель.' },
  { re: /non-boolean condition|non-bool/, text: () => 'В `if`/`for` нужно условие типа bool. В Go нет «правдивых» чисел: пиши `if n != 0`, а не `if n`.' },
  { re: /cannot assign/, text: () => 'Сюда нельзя присвоить: например, элемент строки (строки неизменяемы) или поле структуры внутри мапы. Создай новое значение и присвой целиком.' },
  { re: /os\.Exit/, text: () => 'Программа вызвала os.Exit — в задачах лучше просто выйти из main.' },
];

const SQL: Rule[] = [
  { re: /relation "([^"]+)" does not exist/, text: (m) => `Таблицы «${m[1]}» нет. Проверь имя — список таблиц и их колонки видны в блоке «База данных».` },
  { re: /column "([^"]+)" does not exist/, text: (m) => `Колонки «${m[1]}» нет. Если это строка-значение — бери её в одинарные кавычки: 'текст'. Двойные кавычки в SQL — для имён.` },
  { re: /must appear in the GROUP BY clause/, text: () => 'В SELECT с GROUP BY можно выводить только колонки из GROUP BY и агрегаты (count, sum, avg…). Добавь колонку в GROUP BY или оберни в агрегат.' },
  { re: /aggregate functions are not allowed in WHERE/, text: () => 'Агрегаты нельзя использовать в WHERE — он фильтрует строки до группировки. Условия на агрегаты пишут в HAVING.' },
  { re: /column reference "([^"]+)" is ambiguous/, text: (m) => `Колонка «${m[1]}» есть в нескольких таблицах запроса. Уточни таблицу: \`t.${m[1]}\`.` },
  { re: /syntax error at or near "([^"]*)"/, text: (m) => `Синтаксическая ошибка рядом с «${m[1]}». Частые причины: лишняя или пропущенная запятая, порядок частей (SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT).` },
  { re: /syntax error at end of input/, text: () => 'Запрос оборвался: чего-то не хватает в конце (например, FROM или закрывающей скобки).' },
  { re: /violates foreign key constraint/, text: () => 'Нарушен внешний ключ: ссылаешься на строку, которой нет, или удаляешь строку, на которую ссылаются.' },
  { re: /violates not-null constraint/, text: () => 'В колонку с NOT NULL пытаешься записать пустое значение.' },
  { re: /violates unique constraint|duplicate key/, text: () => 'Такое значение уже есть, а колонка уникальная (UNIQUE или PRIMARY KEY).' },
  { re: /operator does not exist/, text: () => 'Сравниваешь или складываешь несовместимые типы (например, число со строкой). Приведи тип: `x::int` или `CAST(x AS text)`.' },
  { re: /division by zero/, text: () => 'Деление на ноль. Можно защититься через NULLIF(делитель, 0).' },
];

export function explainError(lang: string, msg: string | undefined): string | null {
  if (!msg) return null;
  const rules = lang === 'sql' ? SQL : lang === 'go' ? GO : [];
  for (const r of rules) {
    const m = msg.match(r.re);
    if (m) return r.text(m);
  }
  return null;
}

/** Убирает комментарии перед проверкой require/forbid. */
export function stripComments(lang: string, code: string): string {
  if (lang === 'python') return code.replace(/#[^\n]*/g, '');
  if (lang === 'sql') return code.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1');
}
