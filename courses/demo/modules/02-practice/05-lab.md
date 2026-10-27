---
title: Лаба по этапам
minutes: 25
---

# Что такое лаба

Большую программу удобно писать по кускам. **Лаба** — это шаблон программы с дырками, а каждая дырка — отдельный этап-задача. Пока этап не решён, вместо него стоит заглушка: программа компилируется, но ничего не умеет.

Каждый этап проверяется **внутри целой программы**: предыдущие этапы берутся из твоих решений, следующие — заглушки. В конце блок лабы собирает всё вместе, прогоняет общие тесты и даёт скопировать или скачать готовый файл — например, чтобы сдать.

Пишем счётчик слов: программа читает текст и печатает три самых частых слова.

# Этап 1. Разбить на слова

```task
id: lab-words
lab: freq
part: words
lang: go
title: Разбить текст на слова
prompt: |
  Напиши функцию `Words(text string) []string`: слова в нижнем регистре, без знаков препинания.
  Словом считаем подряд идущие буквы (`unicode.IsLetter`).
starter: |
  func Words(text string) []string {
  	return nil
  }
solution: |
  func Words(text string) []string {
  	return strings.FieldsFunc(strings.ToLower(text), func(r rune) bool { return !unicode.IsLetter(r) })
  }
harness: |
  package main

  func main() {
  	dojoCheck("Words(\"Кот, кот и пёс!\")", Words("Кот, кот и пёс!"), []string{"кот", "кот", "и", "пёс"})
  	dojoCheck("пустая строка", len(Words("")), 0)
  }
hints:
  - "`strings.FieldsFunc` режет строку по символам, для которых функция вернула true."
```

# Этап 2. Посчитать

```task
id: lab-count
lab: freq
part: count
lang: go
title: Посчитать слова
prompt: |
  Напиши `Count(words []string) map[string]int` — сколько раз встречается каждое слово.
starter: |
  func Count(words []string) map[string]int {
  	return map[string]int{}
  }
solution: |
  func Count(words []string) map[string]int {
  	m := map[string]int{}
  	for _, w := range words {
  		m[w]++
  	}
  	return m
  }
harness: |
  package main

  func main() {
  	dojoCheck("Count([a b a])", Count([]string{"a", "b", "a"}), map[string]int{"a": 2, "b": 1})
  }
```

# Этап 3. Топ слов

```task
id: lab-top
lab: freq
part: top
lang: go
title: Самые частые
prompt: |
  Напиши `Top(m map[string]int, n int) []string`: `n` самых частых слов по убыванию частоты,
  при равенстве — по алфавиту. Если слов меньше `n` — сколько есть.
starter: |
  func Top(m map[string]int, n int) []string {
  	return nil
  }
solution: |
  func Top(m map[string]int, n int) []string {
  	keys := make([]string, 0, len(m))
  	for k := range m {
  		keys = append(keys, k)
  	}
  	sort.Slice(keys, func(i, j int) bool {
  		if m[keys[i]] != m[keys[j]] {
  			return m[keys[i]] > m[keys[j]]
  		}
  		return keys[i] < keys[j]
  	})
  	if len(keys) > n {
  		keys = keys[:n]
  	}
  	return keys
  }
harness: |
  package main

  func main() {
  	dojoCheck("Top", Top(map[string]int{"b": 2, "a": 2, "c": 5, "d": 1}, 3), []string{"c", "a", "b"})
  	dojoCheck("слов меньше n", Top(map[string]int{"x": 1}, 3), []string{"x"})
  }
```

# Сборка

```lab
id: freq
title: Счётчик слов
lang: go
intro: |
  Вся программа: читает текст со стандартного ввода (по словам через `fmt.Scan`) и печатает три самых частых слова с количеством.
template: |
  package main

  import (
  	"fmt"
  	"sort"
  	"strings"
  	"unicode"
  )

  var _ = sort.Ints
  var _ = strings.ToLower
  var _ = unicode.IsLetter

  {{words}}

  {{count}}

  {{top}}

  func main() {
  	var all []string
  	var w string
  	for {
  		if _, err := fmt.Scan(&w); err != nil {
  			break
  		}
  		all = append(all, Words(w)...)
  	}
  	m := Count(all)
  	for _, w := range Top(m, 3) {
  		fmt.Println(w, m[w])
  	}
  }
stubs:
  words: |
    func Words(text string) []string { return nil }
  count: |
    func Count(words []string) map[string]int { return map[string]int{} }
  top: |
    func Top(m map[string]int, n int) []string { return nil }
tests:
  - name: короткий текст
    stdin: "Кот и пёс. Кот, кот! Пёс?"
    stdout: |
      кот 3
      пёс 2
      и 1
  - name: скрытый
    hidden: true
    stdin: "b a c a b a"
    stdout: |
      a 3
      b 2
      c 1
checklist:
  - Программа собирается из моих трёх этапов
  - Я понимаю, зачем нужна сортировка при равной частоте
```

# Задание по варианту

Если в курсе объявлены **варианты** (`variants` в course.yaml), ученик выбирает свой на странице курса, а содержимое в блоке `variant` видит только он. Задания чужих вариантов не входят в прогресс.

````variant v1
**Вариант 1.** Посчитай, сколько чётных чисел во вводе.

```task
id: var-even
lang: go
title: Чётные
prompt: |
  В первой строке `n`, дальше `n` целых чисел. Выведи, сколько из них чётных.
starter: |
  package main

  func main() {
  }
solution: |
  package main

  import "fmt"

  func main() {
  	var n, x, c int
  	fmt.Scan(&n)
  	for i := 0; i < n; i++ {
  		fmt.Scan(&x)
  		if x%2 == 0 {
  			c++
  		}
  	}
  	fmt.Println(c)
  }
tests:
  - { stdin: "4\n1 2 3 4", stdout: "2" }
  - { stdin: "3\n-2 0 7", stdout: "2", hidden: true }
```
````

````variant v2
**Вариант 2.** Посчитай, сколько нечётных чисел во вводе.

```task
id: var-odd
lang: go
title: Нечётные
prompt: |
  В первой строке `n`, дальше `n` целых чисел. Выведи, сколько из них нечётных.
starter: |
  package main

  func main() {
  }
solution: |
  package main

  import "fmt"

  func main() {
  	var n, x, c int
  	fmt.Scan(&n)
  	for i := 0; i < n; i++ {
  		fmt.Scan(&x)
  		if x%2 != 0 {
  			c++
  		}
  	}
  	fmt.Println(c)
  }
tests:
  - { stdin: "4\n1 2 3 4", stdout: "2" }
  - { stdin: "3\n-3 0 7", stdout: "2", hidden: true }
```
````
