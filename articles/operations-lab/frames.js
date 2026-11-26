const columns = ['Базис', 'x₁', 'x₂', 'x₃', 'x₄', 'x₅', 'δ'];
const initialRows = [
  ['x₃', 1, 1, 1, 0, 0, 4],
  ['x₄', 1, 0, 0, 1, 0, 2],
  ['x₅', 0, 1, 0, 0, 1, 3],
  ['Δ', -3, -2, 0, 0, 0, 0],
];
const firstPivotRows = [
  ['x₃', 0, 1, 1, -1, 0, 2],
  ['x₁', 1, 0, 0, 1, 0, 2],
  ['x₅', 0, 1, 0, 0, 1, 3],
  ['Δ', 0, -2, 0, 3, 0, 6],
];

const simplex = {
  source: 'simplex',
  frames: [
    {
      title: 'Подписываем стартовый базис',
      paper: 'Добавь x₃, x₄, x₅ к трём неравенствам. Их столбцы образуют единичную матрицу. Правые части 4, 2, 3 неотрицательны.',
      code: 'createTableau добавляет столбцы с ценой 0. Номера базисных столбцов хранятся отдельно. На старте x₁ и x₂ свободны.',
      at: ['createTableau', 'appendColumn(name, rowIndex, coefficient)', 'basic[rowIndex] = column'],
      grid: [columns, initialRows, ['0:3', '1:4', '2:5']],
      values: [['basic', '[2, 3, 4]'], ['nonbasic', '[0, 1]'], ['right', '[4, 2, 3]']],
    },
    {
      title: 'Оценка −3 выбирает x₁',
      paper: 'Базисные цены равны нулю. Поэтому Δ₁ = 0 − 3 = −3, а Δ₂ = 0 − 2 = −2. Выбирай x₁ по меньшей оценке.',
      code: 'Сохраняем только свободные столбцы с отрицательным знаком оценки. Сортировка ставит индекс x₁ первым.',
      at: ['primalSimplex', 'const estimates = table.estimates()', 'estimates[column].sign < 0'],
      grid: [columns, initialRows, ['3:1', '3:2']],
      values: [['estimates', '[-3, -2, 0, 0, 0]'], ['enteringOptions', '[0, 1]'], ['entering', '0 → x₁']],
    },
    {
      title: 'Отношение 2 выбирает строку x₄',
      paper: 'Делим δ только на положительные элементы ведущего столбца. Для трёх строк получаем 4/1, 2/1 и прочерк. Минимум 2.',
      code: 'ratios хранит [4, 2, null]. После сортировки допустимых строк leaving равен 1. Пересечение строки 1 и столбца 0 даёт pivot = 1.',
      at: ['primalSimplex', 'const coefficient = row[entering]', 'return coefficient.sign > 0'],
      grid: [[...columns, 'δ/a'], initialRows.map((row, index) => [...row, [4, 2, '—', ''][index]]), ['1:1', '1:7']],
      values: [['ratios', '[4, 2, null]'], ['leaving', '1 → x₄'], ['pivot', '1']],
    },
    {
      title: 'Делим ведущую строку',
      paper: 'Реши ведущую строку относительно x₁. Здесь делитель 1, поэтому коэффициенты остаются прежними. При делителе 2 они и правая часть разделились бы на 2.',
      code: 'pivotRow и pivotRight получаются из старой ведущей строки. Остальные строки ещё не изменены.',
      at: ['exchange', 'const pivotRow =', 'const pivotRight ='],
      grid: [columns, initialRows, ['1:1', '1:4', '1:6']],
      values: [['pivotRow', '[1, 0, 0, 1, 0]'], ['pivotRight', '2']],
    },
    {
      title: 'Обнуляем ведущий столбец в остальных строках',
      paper: 'Из строки x₃ вычти одну копию ведущей строки. Новый коэффициент при x₄ равен 0 − 1·1 = −1, правая часть равна 4 − 1·2 = 2.',
      code: 'scale берётся из старого коэффициента при x₁. При нулевом scale строка x₅ пропускается. После пересчёта переставляются номера x₄ и x₁.',
      at: ['exchange', 'this.matrix[rowIndex] = row.map', 'this.right[rowIndex] = this.right[rowIndex].minus'],
      grid: [columns, firstPivotRows, ['0:1', '0:4', '0:6', '1:0']],
      values: [['scale для x₃', '1'], ['scale для x₅', '0'], ['basic', '[2, 0, 4]'], ['nonbasic', '[3, 1]']],
    },
    {
      title: 'Второй раз выбираем колонку и строку',
      paper: 'Δ₂ = −2. В столбце x₂ положительные коэффициенты в строках x₃ и x₅. Отношение 2 меньше 3, поэтому выходит x₃.',
      code: 'Тот же цикл смотрит на уже изменённую матрицу. Входящий индекс теперь 1, а выходящая строка имеет индекс 0.',
      at: ['primalSimplex', 'const leaving = leavingOptions[0]', 'const pivot ='],
      grid: [[...columns, 'δ/a'], firstPivotRows.map((row, index) => [...row, [2, '—', 3, ''][index]]), ['3:2', '0:2', '0:7']],
      values: [['entering', '1 → x₂'], ['leaving', '0 → x₃'], ['pivot', '1']],
    },
    {
      title: 'Считываем оптимум из итоговой таблицы',
      paper: 'В компактной таблице остались свободные x₄ и x₃. Их оценки 1 и 2, а правые части 2, 2, 1. Все неотрицательны, значит дальнейшего улучшения нет.',
      code: 'Список enteringOptions пуст. point() пишет правые части на места базисных столбцов, остальные координаты остаются нулевыми. linearResult берёт первые две координаты и пересчитывает исходную цель.',
      at: ['point', 'const point = this.prices.map', 'point[column] = this.right[row]'],
      grid: [['Базис', 'x₄', 'x₃', 'δ'], [
        ['x₂', -1, 1, 2], ['x₁', 1, 0, 2], ['x₅', 1, -1, 1], ['Δ', 1, 2, 10],
      ], ['0:3', '1:3', '3:1', '3:2', '3:3']],
      values: [['point()', '[2, 2, 0, 0, 1]'], ['point в ответе', '[2, 2]'], ['value', '10']],
    },
  ],
};

const primalColumns = ['i', 'Левая часть', 'Знак', 'bᵢ', 'Запас'];
const primal44 = [[1, -8, '≤', 3, 11], [2, 0, '≤', 1, 1], [3, 4, '≤', 4, 0]];
const primal01 = [[1, -3, '≤', 3, 6], [2, 1, '≤', 1, 0], [3, 2, '≤', 4, 2]];
const yColumns = ['Строка', 'y₁', 'y₂', 'y₃', 'Правая часть'];
const equations44 = [
  ['j = 1', 1, -1, -1, -1], ['j = 2', -3, 1, 2, 2],
  ['i = 1', 1, 0, 0, 0], ['i = 2', 0, 1, 0, 0],
];
const y44Steps = [
  [['1', 1, -1, -1, -1], ['2', 0, -2, -1, -1], ['3', 0, 1, 1, 1], ['4', 0, 1, 0, 0]],
  [['1', 1, 0, '-1/2', '-1/2'], ['2', 0, 1, '1/2', '1/2'],
    ['3', 0, 0, '1/2', '1/2'], ['4', 0, 0, '-1/2', '-1/2']],
  [['1', 1, 0, 0, 0], ['2', 0, 1, 0, 0], ['3', 0, 0, 1, 1], ['4', 0, 0, 0, 0]],
];

const optimal = {
  source: 'optimality',
  frames: [
    {
      title: 'Подставляем (4; 4) во все строки',
      paper: 'Левые части −8, 0 и 4 не превосходят 3, 1 и 4. Обе координаты неотрицательны.',
      code: 'dot(row, plan) вычисляет левую часть. В primal остаётся по записи с left, right, relation и valid для каждой строки.',
      at: ['checkPlan', 'const left = dot(row, plan)', 'valid: satisfies(left, relation, right)'],
      grid: [primalColumns, primal44, ['0:1', '1:1', '2:1']],
      values: [['plan', '[4, 4]'], ['primal.valid', '[true, true, true]'], ['negative', '[]']],
    },
    {
      title: 'Выбираем J и I',
      paper: 'Оба x положительны, значит J = {1, 2}. Запас есть у первых двух ограничений, значит I = {1, 2}.',
      code: 'positive и strict равны [0, 1] из-за нумерации с нуля. strict вычисляется после проверки допустимости.',
      at: ['checkPlan', 'const positive = plan.flatMap', 'left.compare(right) !== 0'],
      grid: [primalColumns, primal44, ['0:4', '1:4']],
      values: [['positive', '[0, 1] → J = {1, 2}'], ['strict', '[0, 1] → I = {1, 2}']],
    },
    {
      title: 'Переносим два набора условий в матрицу',
      paper: 'У обеих двойственных строк вместо ≥ пишем =. К ним дописываем y₁ = 0 и y₂ = 0.',
      code: 'Для j берём столбец A и дописываем cⱼ. Для i создаём единичную строку и дописываем 0. Последний элемент каждой строки — правая часть.',
      at: ['checkPlan', 'const tightDualConstraints', 'const equations ='],
      grid: [yColumns, equations44, ['0:4', '1:4', '2:1', '3:2']],
      values: [['equations.length', '4'], ['width', '3 неизвестных']],
    },
    {
      title: 'Гаусс обнуляет столбец y₁',
      paper: 'Ведущий коэффициент 1 уже в первой строке. Ко второй прибавь 3 первых строки, из третьей вычти первую.',
      code: 'matrix[nextRow] — нормированная строка. Для каждой другой строки берём её scale и вычитаем scale × normalized сразу по всем позициям.',
      at: ['reduceRows', 'const scale = row[column]', 'value.minus(scale.times(normalized[position]))'],
      grid: [yColumns, y44Steps[0], ['0:1', '1:1', '2:1']],
      values: [['column', '0 → y₁'], ['pivots после шага', '[0]'], ['scale второй строки', '−3']],
    },
    {
      title: 'Гаусс обнуляет столбец y₂',
      paper: 'Делим вторую строку на −2. Вычитаем нужную кратность из трёх остальных строк. Появляются точные половины.',
      code: 'Ненулевой элемент −2 становится 1. over(pivot) работает с объектами Fraction, поэтому половины сохраняются точно.',
      at: ['reduceRows', 'const pivot = matrix[nextRow][column]', 'matrix[nextRow] = normalized'],
      grid: [yColumns, y44Steps[1], ['1:2', '1:3', '2:3', '3:3']],
      values: [['column', '1 → y₂'], ['pivot', '−2'], ['pivots после шага', '[0, 1]']],
    },
    {
      title: 'Из приведённой матрицы читаем y',
      paper: 'Разрешающий элемент 1/2 в третьей строке. После пересчёта справа стоят 0, 0, 1. Четвёртая строка стала 0 = 0.',
      code: 'У solveEquations три ведущих столбца. Оставшаяся строка имеет нулевую правую часть, consistent равен true.',
      at: ['solveEquations', 'const consistent =', 'solution[column] = matrix[index][width]'],
      grid: [yColumns, y44Steps[2], ['0:4', '1:4', '2:4', '3:4']],
      values: [['pivots', '[0, 1, 2]'], ['consistent', 'true'], ['solution', '[0, 0, 1]']],
    },
    {
      title: 'Проверяем все двойственные условия',
      paper: 'При y = (0; 0; 1) получаем −1 ≥ −1 и 2 ≥ 2. Все y ≥ 0. Значения целей равны 4, план оптимален.',
      code: 'inspectDual сверяет все ограничения и знаки. Затем checkPlan подтверждает равенство f(x) и g(y).',
      at: ['checkPlan', 'const dualValue =', 'const optimal = verification.valid'],
      grid: [['j', 'Aⱼᵀy', 'Знак', 'cⱼ', 'Выполнено'], [[1, -1, '≥', -1, 'Да'], [2, 2, '≥', 2, 'Да']], ['0:4', '1:4']],
      values: [['point', '[0, 0, 1]'], ['verification.valid', 'true'], ['primalValue = dualValue', '4'], ['status', 'optimal']],
    },
  ],
};

const rejected = {
  source: 'optimality',
  frames: [
    {
      title: 'Проверяем допустимость плана (0; 1)',
      paper: 'Все исходные ограничения выполнены. Строгими оказались первое и третье. Положительна только вторая координата.',
      code: 'Отсюда positive = [1] и strict = [0, 2]. Нулевая x₁ не заставляет первую двойственную строку обращаться в равенство.',
      at: ['checkPlan', 'const positive = plan.flatMap', 'left.compare(right) !== 0'],
      grid: [primalColumns, primal01, ['0:4', '2:4']],
      values: [['plan', '[0, 1]'], ['positive', '[1] → J = {2}'], ['strict', '[0, 2] → I = {1, 3}']],
    },
    {
      title: 'Из трёх равенств получаем кандидата',
      paper: 'Пишем −3y₁ + y₂ + 2y₃ = 2, y₁ = 0, y₃ = 0. Отсюда y₂ = 2.',
      code: 'Система совместна и имеет три ведущих столбца. solveEquations возвращает [0, 2, 0]. Продолжаем проверку.',
      at: ['checkPlan', 'const equations =', 'const system = solveEquations'],
      grid: [yColumns, [['j = 2', -3, 1, 2, 2], ['i = 1', 1, 0, 0, 0], ['i = 3', 0, 0, 1, 0]], ['0:2', '0:4']],
      values: [['consistent', 'true'], ['point', '[0, 2, 0]']],
    },
    {
      title: 'Первое двойственное неравенство нарушено',
      paper: 'При подстановке выходит −2 ≥ −1. Это неверно. Хотя x допустим и кандидат y решает выбранные равенства, x неоптимален.',
      code: 'inspectDual проверяет обе строки, включая ту, которой не было в системе. f(x) и g(y) здесь даже совпадают, но verification.valid равен false.',
      at: ['inspectDual', 'const left = dot(column, point)', 'valid: satisfies(left, model.relation, right)'],
      grid: [['j', 'Aⱼᵀy', 'Знак', 'cⱼ', 'Выполнено'], [[1, -2, '≥', -1, 'Нет'], [2, 2, '≥', 2, 'Да']], ['0:1', '0:4']],
      values: [['verification.valid', 'false'], ['f(x) = g(y)', '2'], ['status', 'basis_not_optimal']],
    },
  ],
};

const family = {
  source: 'optimality',
  frames: [
    {
      title: 'Два ограничения фиксируют x = 1',
      paper: 'Возьмём максимум x при x ≥ 1 и x ≤ 1. Для x = 1 оба исходных ограничения обращаются в равенства, а x положителен.',
      code: 'positive = [0], strict = []. Из дополняющей нежёсткости выходит единственная строка y₁ + y₂ = 1. Знаки переменных остаются y₁ ≤ 0 и y₂ ≥ 0.',
      at: ['checkPlan', 'const tightDualConstraints', 'const equations ='],
      grid: [['Условие', 'y₁', 'y₂', 'Правая часть'], [['j = 1', 1, 1, 1]], ['0:1', '0:2']],
      values: [['equations', '[[1, 1, 1]]'], ['model.domains', '["<=", ">="]']],
    },
    {
      title: 'Первый кандидат не проходит по знаку',
      paper: 'Положи свободное y₂ = 0. Получится y₁ = 1, хотя для первого ограничения нужно y₁ ≤ 0.',
      code: 'solveEquations оставляет свободную координату нулевой. Поскольку ведущих столбцов меньше, чем переменных, ошибка кандидата включает familySearch.',
      at: ['checkPlan', 'const hasFreeVariables =', 'const familySearch ='],
      grid: [['Компонента', 'Значение', 'Требование'], [['y₁', 1, '≤ 0'], ['y₂', 0, '≥ 0']], ['0:1', '0:2']],
      values: [['system.pivots', '[0]'], ['system.solution', '[1, 0]'], ['familySearch', 'true']],
    },
    {
      title: 'Заменяем переменные перед поиском',
      paper: 'Запиши y₁ = −z₁, y₂ = z₂, где z₁,z₂ ≥ 0. Равенство превращается в −z₁ + z₂ = 1.',
      code: 'parts хранит [{row: 0, factor: −1}, {row: 1, factor: 1}]. convertRow меняет знак первого коэффициента. Цель равна нулю, потому что нужна любая допустимая точка.',
      at: ['findDualPoint', 'const convertRow =', 'objective: parts.map'],
      grid: [['Строка', 'z₁', 'z₂', 'Правая часть'], [['y₁ + y₂ = 1', -1, 1, 1]], ['0:1', '0:2']],
      values: [['parts[0].factor', '−1'], ['parts[1].factor', '+1'], ['objective', '[0, 0]']],
    },
    {
      title: 'Возвращаемся от z к y',
      paper: 'Подходит z₁ = 0 и z₂ = 1. Значит y = (0; 1), знаки соблюдены, значение обеих целей равно 1.',
      code: 'findDualPoint умножает компоненты нового плана на factor и складывает по исходным строкам. checkPlan снова вызывает inspectDual и подтверждает ответ.',
      at: ['findDualPoint', 'const contribution =', 'point[row] ='],
      grid: [['Координата', 'z', 'Множитель', 'y'], [[1, 0, -1, 0], [2, 1, 1, 1]], ['0:3', '1:3']],
      values: [['values', '[0, 1, …]'], ['point', '[0, 1]'], ['status', 'optimal']],
    },
  ],
};

export const traces = { simplex, optimal, rejected, family };
