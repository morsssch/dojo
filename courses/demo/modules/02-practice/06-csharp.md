---
title: Задачи на C#
minutes: 20
---

# C# прямо в браузере

C# компилирует настоящий компилятор Roslyn, запущенный в браузере вместе с .NET. Первый запуск загружает около 15 МБ, дальше всё из кэша. Культура — русская: `1.5` печатается как `1,5`, даты по-русски.

Как в проекте Visual Studio, подключены неявные `using` (`System`, `System.Linq`, `System.Collections.Generic` и др.), а программу можно писать операторами верхнего уровня — без класса `Program` и `Main`.

```cs run
var nums = new[] { 5, 3, 8, 1 };
Console.WriteLine(string.Join(", ", nums.OrderBy(x => x)));
Console.WriteLine($"Среднее: {nums.Average()}");
```

# Ввод и вывод

```task
id: cs-sum
lang: cs
title: Сумма двух чисел
prompt: |
  В одной строке два целых числа через пробел. Выведи их сумму.
starter: |
  var parts = Console.ReadLine()!.Split(' ');
  // твой код
solution: |
  var parts = Console.ReadLine()!.Split(' ');
  Console.WriteLine(int.Parse(parts[0]) + int.Parse(parts[1]));
tests:
  - { stdin: "2 3", stdout: "5" }
  - { stdin: "-10 4", stdout: "-6" }
  - { stdin: "1000000000 1000000000", stdout: "2000000000", hidden: true }
hints:
  - "`int.Parse` переводит строку в число."
  - Сумма двух миллиардов не влезает в `int` — подумай про `long`.
```

# Класс с проверкой

Ученик пишет только тип, а код проверки вызывает его через `Dojo.Check(имя, получено, ожидалось)`. `Dojo.Throws<Исключение>(имя, () => ...)` проверяет, что вызов бросает исключение. Коллекции сравниваются поэлементно.

```task
id: cs-stack
lang: cs
title: Стек на массиве
prompt: |
  Напиши класс `IntStack`: методы `Push(int)`, `Pop()` и свойство `Count`.
  `Pop()` у пустого стека бросает `InvalidOperationException`.
starter: |
  public class IntStack
  {
  }
solution: |
  public class IntStack
  {
      private int[] _items = new int[4];
      public int Count { get; private set; }

      public void Push(int x)
      {
          if (Count == _items.Length) Array.Resize(ref _items, _items.Length * 2);
          _items[Count++] = x;
      }

      public int Pop()
      {
          if (Count == 0) throw new InvalidOperationException("Стек пуст");
          return _items[--Count];
      }
  }
harness: |
  var s = new IntStack();
  for (var i = 1; i <= 10; i++) s.Push(i);
  Dojo.Check("Count после 10 Push", s.Count, 10);
  Dojo.Check("Pop возвращает последний", s.Pop(), 10);
  Dojo.Check("Count после Pop", s.Count, 9);
  Dojo.Throws<InvalidOperationException>("Pop у пустого", () => new IntStack().Pop());
hints:
  - Храни элементы в массиве и счётчик `Count`; когда массив заполнен — увеличь его через `Array.Resize`.
```

# Особые тесты

У каждого теста может быть свой код проверки (`harness`), а вывод можно сверять регуляркой (`match`) или ждать исключения (`throws`).

```task
id: cs-safe-div
lang: cs
title: Безопасное деление
prompt: |
  Напиши статический метод `Calc.Div(int a, int b)`, который возвращает `a / b` строкой с двумя знаками после запятой.
  Если `b == 0` — бросает `DivideByZeroException`.
starter: |
  public static class Calc
  {
      public static string Div(int a, int b) => "";
  }
solution: |
  public static class Calc
  {
      public static string Div(int a, int b)
      {
          if (b == 0) throw new DivideByZeroException();
          return ((double)a / b).ToString("F2");
      }
  }
tests:
  - name: 7 / 2
    harness: Console.WriteLine(Calc.Div(7, 2));
    stdout: "3,50"
  - name: формат с двумя знаками
    harness: Console.WriteLine(Calc.Div(1, 3));
    match: '^0,33\s*$'
  - name: деление на ноль
    harness: Console.WriteLine(Calc.Div(1, 0));
    throws: DivideByZeroException
```

# Лаба на C#

Этапы лабы на C# проверяются внутри всей программы. Если у этапа есть код проверки, он становится точкой входа, а `Main` шаблона компилятор пропускает — поэтому шаблон лабы на C# пишут с классом `Program` и `Main`, а не операторами верхнего уровня.

```task
id: cs-lab-parse
lab: cs-grades
part: parse
lang: cs
title: Разобрать оценки
prompt: |
  Напиши `static List<int> Parse(string line)` внутри `Grades`: числа через пробел → список.
starter: |
  public static List<int> Parse(string line)
  {
      return new List<int>();
  }
solution: |
  public static List<int> Parse(string line) =>
      line.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList();
harness: |
  Dojo.Check("Parse", Grades.Parse("5 4  3"), new List<int> { 5, 4, 3 });
```

```task
id: cs-lab-avg
lab: cs-grades
part: avg
lang: cs
title: Средний балл
prompt: |
  Напиши `static double Avg(List<int> xs)`: среднее, у пустого списка — 0.
starter: |
  public static double Avg(List<int> xs) => 0;
solution: |
  public static double Avg(List<int> xs) => xs.Count == 0 ? 0 : xs.Average();
harness: |
  Dojo.Check("Avg", Grades.Avg(new List<int> { 5, 4 }), 4.5);
  Dojo.Check("пустой", Grades.Avg(new List<int>()), 0.0);
```

```lab
id: cs-grades
title: Средний балл
lang: cs
intro: Программа читает оценки одной строкой и печатает средний балл с одним знаком после запятой.
template: |
  public static class Grades
  {
      {{parse}}

      {{avg}}
  }

  class Program
  {
      static void Main()
      {
          var xs = Grades.Parse(Console.ReadLine() ?? "");
          Console.WriteLine(Grades.Avg(xs).ToString("F1"));
      }
  }
stubs:
  parse: |
    public static List<int> Parse(string line) => new List<int>();
  avg: |
    public static double Avg(List<int> xs) => 0;
tests:
  - { stdin: "5 4 4 3", stdout: "4,0" }
  - { stdin: "5 5 4", stdout: "4,7" }
```
