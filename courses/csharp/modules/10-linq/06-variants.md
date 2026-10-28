---
title: Варианты лабораторной 2
minutes: 25
---

# Варианты функциональной лабораторной

Вариант 2 — `TextPipeline` — уже разбит выше на этапы с автопроверкой. Остальные варианты ниже перенесены из методички; для них нужен такой же этапный план перед добавлением автоматических тестов.

````variant v1
**Вариант 1. Система обработки финансовых транзакций.**

```project
id: lab2-v1
title: TransactionProcessor
prompt: |
   Создай `record Transaction` и `TransactionProcessor` с событиями добавления и превышения дневного порога. Реализуй FilterTransactions и ProcessTransactions без LINQ, ApplyOperation через делегат, затем LINQ-методы группировки, топ расходов, среднее и группировку по дате. В демо добавь минимум 10 транзакций.
checklist:
   - Transaction и события процессора реализованы
   - Методы без LINQ действительно обходят коллекцию вручную
   - LINQ-методы возвращают суммы, топ и группировки
   - Демо показывает обработку событий и ошибок
```
````

````variant v2
**Вариант 2. Конвейер обработки текстовых данных.**

Вариант разбит на этапы в уроке выше: делегаты, `TextPipeline`, расширения, фабрики обработчиков, анализатор и демонстрация.
````

````variant v3
**Вариант 3. Система оповещений с приоритетами.**

```project
id: lab2-v3
title: NotificationManager
prompt: |
   Реализуй иерархию records `Notification`, `EmailNotification`, `SmsNotification`, `PushNotification`, менеджер подписчиков по приоритетам, события отправки и фильтр. Добавь `NotificationUtils` с pattern matching, LINQ-аналитику истории и фабрики уведомлений.
checklist:
   - Records и приоритеты описаны
   - Subscribe/Unsubscribe/Send и события работают
   - Форматирование и адрес получателя используют pattern matching
   - Есть LINQ-аналитика и фабрики
```
````

````variant v4
**Вариант 4. Калькулятор математических выражений.**

```project
id: lab2-v4
title: Calculator
prompt: |
   Реализуй делегаты `UnaryOperation`, `BinaryOperation`, `ComplexOperation`, `Calculator` с регистрацией и событиями, `MathOperations`, композицию функций и расширения статистики без LINQ.
checklist:
   - Унарные, бинарные и сложные операции регистрируются
   - Ошибки деления и недопустимых результатов обрабатываются событиями
   - Compose, Chain и Partial работают
   - Sum, Mean, Variance и StandardDeviation написаны без LINQ
```
````

````variant v5
**Вариант 5. Система обработки заказов.**

```project
id: lab2-v5
title: OrderProcessor
prompt: |
   Реализуй records `OrderItem`, `Order`, `OrderEvent`, workflow-этапы, `OrderProcessor`, обработчики статусов, валидаторы и функции шагов. Добавь LINQ-статистику по заказам и консольное меню.
checklist:
   - Статусы и records описаны
   - WorkflowStep поддерживает проверку, успех и ошибку
   - Процессор меняет статусы и поднимает события
   - Статистика по заказам и обработка ошибок работают
```
````
