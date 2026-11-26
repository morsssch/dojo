globalThis.labOptimality = (() => {
  const { zero, one, number } = labMath;
  const { parseProblem } = labProblem;
  const { linear, optimalityReport, response, canonicalForm, tableauSnapshot } = labReports;
  const limit = 300;

  function run(data) {
    const problem = parseProblem(data);
    if (!Array.isArray(data.plan) || data.plan.length !== problem.objective.length) {
      throw new Error('Введите заданный план. Длина плана должна совпадать с числом переменных.');
    }

    const plan = data.plan.map((value, index) => number(value, `Заданный план, x${index + 1}`));
    const result = checkPlan(problem, plan);
    return response(result.status, messages[result.status], optimalityReport(problem, result), {
      y: result.point?.map(String),
      value: result.status === 'optimal' ? String(result.primalValue) : null,
    });
  }

  function checkPlan(problem, plan) {
    const model = dualModel(problem);
    const primal = problem.constraints.map((row, index) => {
      const left = dot(row, plan);
      const right = problem.bounds[index];
      const relation = problem.relations[index];
      return { left, right, relation, valid: satisfies(left, relation, right) };
    });
    const negative = plan.flatMap((value, index) => value.sign < 0 ? [index] : []);
    const result = { model, plan, primal, negative };
    if (negative.length || primal.some(item => !item.valid)) {
      return {
        ...result,
        status: 'basis_infeasible',
        reason: 'Заданный план недопустим.',
      };
    }

    const positive = plan.flatMap((value, index) => value.sign > 0 ? [index] : []);
    const strict = primal.flatMap(({ left, right }, index) =>
      left.compare(right) !== 0 ? [index] : [],
    );

    const tightDualConstraints = positive.map(index =>
      [...model.columns[index], problem.objective[index]],
    );
    const zeroDualVariables = strict.map(index => {
      const unitRow = model.names.map((_, column) => index === column ? one : zero);
      return [...unitRow, zero];
    });
    const equations = [...tightDualConstraints, ...zeroDualVariables];
    const system = solveEquations(equations, model.names.length);
    const primalValue = dot(problem.objective, plan);
    const details = { ...result, positive, strict, equations, system, primalValue };

    if (!system.consistent) {
      return {
        ...details,
        status: 'basis_not_optimal',
        reason: 'Система условий дополняющей нежёсткости несовместна.',
      };
    }

    let point = system.solution;
    let verification = inspectDual(problem, model, point);
    const hasFreeVariables = system.pivots.length < model.names.length;
    const familySearch = hasFreeVariables && !verification.valid;

    if (familySearch) {
      const candidate = findDualPoint(problem, model, equations);
      if (candidate.status === 'limit') {
        return {
          ...details,
          familySearch,
          status: 'limit',
          reason: 'Достигнут предел поиска допустимого двойственного плана.',
        };
      }
      if (candidate.status !== 'optimal') {
        return {
          ...details,
          familySearch,
          point,
          verification,
          status: 'basis_not_optimal',
          reason: 'Ни одно решение системы не удовлетворяет всем условиям двойственной задачи.',
        };
      }

      point = candidate.point;
      verification = inspectDual(problem, model, point);
    }

    const dualValue = dot(problem.bounds, point);
    const equalObjectives = primalValue.compare(dualValue) === 0;
    const optimal = verification.valid && equalObjectives;
    const reason = optimal
      ? 'План допустим, двойственные условия выполнены и значения целей равны.'
      : 'Найденный двойственный вектор нарушает условия двойственной задачи.';

    return {
      ...details,
      familySearch,
      point,
      verification,
      dualValue,
      status: optimal ? 'optimal' : 'basis_not_optimal',
      reason,
    };
  }

  function findDualPoint(problem, model, equations) {
    const parts = model.domains.flatMap((sign, row) => {
      const positive = { row, factor: one };
      const negative = { row, factor: one.negate() };
      if (sign === null) return [positive, negative];
      return [sign === '>=' ? positive : negative];
    });

    const convertRow = row => parts.map(({ row: index, factor }) => row[index].times(factor));
    const equalityBounds = equations.map(row => row[row.length - 1]);
    const dualRelations = model.columns.map(() => model.relation);
    const { table, status } = artificialBasis({
      objective: parts.map(() => zero),
      constraints: [...model.columns, ...equations].map(convertRow),
      bounds: [...problem.objective, ...equalityBounds],
      relations: [...dualRelations, ...equations.map(() => '=')],
      sense: 'max',
    });
    if (status !== 'optimal') return { status };

    const point = model.names.map(() => zero);
    const values = table.point();
    for (const [index, { row, factor }] of parts.entries()) {
      const contribution = values[index].times(factor);
      point[row] = point[row].plus(contribution);
    }
    return { status, point };
  }

  function reduceRows(rows, width) {
    const matrix = rows.map(row => row.slice());
    const pivots = [];

    for (let column = 0; column < width; column += 1) {
      const nextRow = pivots.length;
      const source = matrix.findIndex((row, index) => index >= nextRow && row[column].sign !== 0);
      if (source === -1) continue;

      [matrix[nextRow], matrix[source]] = [matrix[source], matrix[nextRow]];
      const pivot = matrix[nextRow][column];
      const normalized = matrix[nextRow].map(value => value.over(pivot));
      matrix[nextRow] = normalized;

      for (const [index, row] of matrix.entries()) {
        const scale = row[column];
        if (index === nextRow || !scale.sign) continue;

        matrix[index] = row.map((value, position) =>
          value.minus(scale.times(normalized[position])),
        );
      }
      pivots.push(column);
    }
    return { matrix, pivots };
  }

  function solveEquations(rows, width) {
    const { matrix, pivots } = reduceRows(rows, width);
    const consistent = matrix.slice(pivots.length).every(row => !row[width].sign);
    const solution = indices(width).map(() => zero);
    for (const [index, column] of pivots.entries()) {
      solution[column] = matrix[index][width];
    }
    return { matrix, pivots, consistent, solution };
  }

  function dualModel(problem) {
    const maximum = problem.sense === 'max';
    const columns = problem.objective.map((_, index) => problem.constraints.map(row => row[index]));
    const names = problem.bounds.map((_, index) => `y${index + 1}`);
    const relation = maximum ? '>=' : '<=';
    const domains = problem.relations.map(sign => {
      if (sign === '=') return null;
      return (sign === '<=') === maximum ? '>=' : '<=';
    });

    const inequalities = columns.map((column, index) => {
      const left = linear(column, names);
      return `${left} ${relation} ${problem.objective[index]}`;
    });
    const signConditions = domains.map((sign, index) => {
      const condition = sign ? sign + ' 0' : 'любого знака';
      return `${names[index]} ${condition}`;
    });

    const statement = [
      `g(y) = ${linear(problem.bounds, names)} → ${maximum ? 'min' : 'max'}`,
      ...inequalities,
      signConditions.join(', '),
    ];
    return { columns, domains, relation, names, statement };
  }

  function satisfies(left, relation, right) {
    const order = left.compare(right);
    if (relation === '=') return order === 0;
    return relation === '<=' ? order <= 0 : order >= 0;
  }

  function inspectDual(problem, model, point) {
    const constraints = model.columns.map((column, index) => {
      const left = dot(column, point);
      const right = problem.objective[index];
      return { left, right, relation: model.relation, valid: satisfies(left, model.relation, right) };
    });
    const signs = point.map((value, index) => {
      const relation = model.domains[index];
      return { value, relation, valid: relation === null || satisfies(value, relation, zero) };
    });
    const valid = constraints.every(item => item.valid) && signs.every(item => item.valid);
    return { constraints, signs, valid };
  }

  function artificialBasis(problem) {
    const table = createFeasibleTableau(problem);
    const originalPrices = table.prices.slice();

    if (!table.artificial.size) {
      const status = optimizeFeasibleBasis(table, 'Искусственные переменные не нужны. Начальная таблица');
      return { table, status };
    }

    table.prices = table.prices.map((_, column) =>
      table.artificial.has(column) ? one.negate() : zero,
    );
    const phaseOneStatus = optimizeFeasibleBasis(
      table,
      'Фаза I: f(x, w) → max',
      'Все Δ ≥ 0 и δ ≥ 0: фаза I завершена.',
    );
    if (phaseOneStatus !== 'optimal') {
      return { table, status: 'limit' };
    }

    const auxiliaryValue = table.objective();
    if (auxiliaryValue.sign) {
      table.note('Фаза I завершена', `f(x, w) = ${auxiliaryValue} < 0: допустимого плана нет.`);
      return { table, status: 'infeasible' };
    }

    let row = 0;
    while (row < table.basic.length) {
      const current = table.basic[row];
      if (table.artificial.has(current)) {
        const candidates = table.nonbasic.filter(column =>
          !table.artificial.has(column) && table.matrix[row][column].sign !== 0,
        );
        const entering = candidates.sort((first, second) => first - second)[0];

        if (entering === undefined) {
          const originalRowNumber = table.originalRows[row] + 1;
          table.note(
            `Удаляем зависимое ограничение №${originalRowNumber}`,
            'Строка нулевая по настоящим переменным.',
          );
          table.dropRow(row);
          continue;
        }
        const leavingName = table.variableNames[current];
        const enteringName = table.variableNames[entering];

        table.exchange(row, entering);
        table.record(
          `Убираем ${leavingName} из базиса`,
          `${leavingName} заменяется на ${enteringName}.`,
        );
      }
      row += 1;
    }

    table.finishPhaseOne(originalPrices);
    const status = optimizeFeasibleBasis(table, 'Фаза II: таблица без W, Δ по исходной целевой функции');
    return { table, status };
  }

  function optimizeFeasibleBasis(
    table,
    title = 'Начальная таблица',
    finalNote = 'Все Δ ≥ 0 и δ ≥ 0: решение найдено.',
  ) {
    if (table.right.some(value => value.sign < 0)) {
      throw new Error('Для прямого симплекса нужен допустимый начальный план.');
    }

    const visited = new Set();
    let useBland = false;

    for (let iteration = 0; iteration <= limit; iteration += 1) {
      const estimates = table.estimates();
      const enteringOptions = table.nonbasic.filter(column =>
        !table.artificial.has(column) && estimates[column].sign < 0,
      );

      if (!enteringOptions.length) {
        table.record(title, finalNote);
        return 'optimal';
      }
      if (iteration === limit) break;

      const key = table.basic.slice().sort((first, second) => first - second).join(',');
      if (!useBland && visited.has(key)) {
        useBland = true;
        table.note('Переход к правилу Бланда', 'Базис повторился. Дальше выбираем по индексам.');
      }
      visited.add(key);

      enteringOptions.sort((first, second) => {
        const byEstimate = useBland ? 0 : estimates[first].compare(estimates[second]);
        return byEstimate || first - second;
      });

      const entering = enteringOptions[0];
      const enteringName = table.variableNames[entering];
      const ratios = table.matrix.map((row, index) => {
        const coefficient = row[entering];
        return coefficient.sign > 0 ? table.right[index].over(coefficient) : null;
      });
      const leavingOptions = [];

      for (const [row, ratio] of ratios.entries()) {
        if (ratio !== null) {
          leavingOptions.push(row);
        }
      }

      if (!leavingOptions.length) {
        const explanation =
          `В столбце ${enteringName} нет положительных элементов: целевая функция не ограничена.`;
        table.record(title, explanation, { columnRatios: ratios });
        return 'unbounded';
      }

      leavingOptions.sort((first, second) => {
        const byRatio = ratios[first].compare(ratios[second]);
        return byRatio || table.basic[first] - table.basic[second];
      });

      const leaving = leavingOptions[0];
      const leavingName = table.variableNames[table.basic[leaving]];
      const pivot = table.matrix[leaving][entering];
      const reason = useBland ? 'правило Бланда' : `наименьшая Δ = ${estimates[entering]}`;
      const explanation =
        `Ведущий столбец ${enteringName} (${reason}). ` +
        `Ведущая строка ${leavingName} (min δ/a = ${ratios[leaving]}). ` +
        `Ведущий элемент ${pivot}.`;

      table.record(title, explanation, {
        columnRatios: ratios,
        pivot: [leaving, entering],
      });
      table.exchange(leaving, entering);
      title = `Пересчёт: ${enteringName} ↔ ${leavingName}`;
    }

    table.record(title, 'Достигнут предел пересчётов.');
    return 'limit';
  }

  const flipped = { '<=': '>=', '>=': '<=', '=': '=' };

  class Tableau {
    constructor({
      matrix, right, prices, variableNames, basic, artificial,
    }) {
      this.matrix = matrix;
      this.right = right;
      this.prices = prices;
      this.variableNames = variableNames;
      this.basic = basic;
      this.nonbasic = indices(prices.length).filter(column => !basic.includes(column));
      this.artificial = artificial;

      this.originalRows = indices(right.length);
      this.steps = [];
      this.canonical = canonicalForm(this);
    }

    basicPrices() {
      return this.basic.map(column => this.prices[column]);
    }

    estimates() {
      const basicPrices = this.basicPrices();
      return this.prices.map((price, column) => {
        const coefficients = this.matrix.map(row => row[column]);
        const impliedPrice = dot(basicPrices, coefficients);
        return impliedPrice.minus(price);
      });
    }

    objective() {
      return dot(this.basicPrices(), this.right);
    }

    note(title, explanation) {
      this.steps.push({ title, explanation });
    }

    record(title, explanation, options = {}) {
      const estimates = this.estimates();
      const value = this.objective();
      this.steps.push(tableauSnapshot(this, title, explanation, estimates, value, options));
    }

    exchange(leavingRow, enteringColumn) {
      const pivot = this.matrix[leavingRow][enteringColumn];
      if (!pivot.sign) {
        throw new Error('Нулевой разрешающий элемент.');
      }

      const pivotRow = this.matrix[leavingRow].map(value => value.over(pivot));
      const pivotRight = this.right[leavingRow].over(pivot);

      for (const [rowIndex, row] of this.matrix.entries()) {
        const scale = row[enteringColumn];
        if (rowIndex === leavingRow || !scale.sign) {
          continue;
        }

        this.matrix[rowIndex] = row.map((value, column) =>
          value.minus(scale.times(pivotRow[column])),
        );
        this.right[rowIndex] = this.right[rowIndex].minus(scale.times(pivotRight));
      }

      this.matrix[leavingRow] = pivotRow;
      this.right[leavingRow] = pivotRight;

      const freePosition = this.nonbasic.indexOf(enteringColumn);
      this.nonbasic[freePosition] = this.basic[leavingRow];
      this.basic[leavingRow] = enteringColumn;
    }

    point() {
      const point = this.prices.map(() => zero);
      for (const [row, column] of this.basic.entries()) {
        point[column] = this.right[row];
      }
      return point;
    }

    dropRow(index) {
      this.matrix.splice(index, 1);
      this.right.splice(index, 1);
      this.basic.splice(index, 1);
      this.originalRows.splice(index, 1);
    }

    finishPhaseOne(originalPrices) {
      const kept = indices(this.prices.length).filter(column => !this.artificial.has(column));
      const positions = new Map(kept.map((column, index) => [column, index]));

      this.matrix = this.matrix.map(row => kept.map(column => row[column]));
      this.prices = kept.map(column => originalPrices[column]);
      this.variableNames = kept.map(column => this.variableNames[column]);

      this.basic = this.basic.map(column => positions.get(column));
      this.nonbasic = this.nonbasic
        .filter(column => positions.has(column))
        .map(column => positions.get(column));
      this.artificial.clear();
    }
  }

  function createFeasibleTableau(problem) {
    const { objective, constraints, bounds, relations, sense } = problem;
    const rowCount = bounds.length;
    const originalWidth = objective.length;
    const variableNames = objective.map((_, column) => `x${column + 1}`);
    const prices = objective.map(value => sense === 'max' ? value : value.negate());
    const basic = bounds.map(() => -1);

    const rowSigns = bounds.map(value => value.sign < 0 ? one.negate() : one);
    const matrix = constraints.map((row, index) => row.map(value => value.times(rowSigns[index])));
    const right = bounds.map((value, index) => value.times(rowSigns[index]));

    const artificial = new Set();

    function appendColumn(name, rowIndex, entry) {
      const column = variableNames.length;
      variableNames.push(name);
      prices.push(zero);
      matrix.forEach((row, index) => row.push(index === rowIndex ? entry : zero));
      return column;
    }

    for (const [rowIndex, relation] of relations.entries()) {
      const sign = rowSigns[rowIndex].sign < 0 ? flipped[relation] : relation;
      if (sign === '=') continue;

      const name = `x${variableNames.length + 1}`;
      const coefficient = sign === '<=' ? one : one.negate();
      const column = appendColumn(name, rowIndex, coefficient);
      if (sign === '<=') basic[rowIndex] = column;
    }

    for (let row = 0; row < rowCount; row += 1) {
      if (basic[row] !== -1) continue;

      for (let column = 0; column < originalWidth; column += 1) {
        const pivot = matrix[row][column];
        const isBasicColumn = pivot.sign > 0 && matrix.every((line, index) =>
          index === row || !line[column].sign,
        );
        if (!isBasicColumn) continue;

        matrix[row] = matrix[row].map(value => value.over(pivot));
        right[row] = right[row].over(pivot);
        basic[row] = column;
        break;
      }

      if (basic[row] !== -1) continue;

      const column = appendColumn(`W${artificial.size + 1}`, row, one);
      basic[row] = column;
      artificial.add(column);
    }

    return new Tableau({
      matrix, right, prices, variableNames, basic, artificial,
    });
  }

  function dot(left, right) {
    let total = zero;
    for (const [index, value] of left.entries()) {
      total = total.plus(value.times(right[index]));
    }
    return total;
  }

  const indices = length => Array.from({ length }, (_, index) => index);

  const messages = {
    optimal: 'Заданный план оптимален.',
    basis_infeasible: 'Заданный план недопустим.',
    basis_not_optimal: 'Заданный план допустим, но не оптимален.',
    limit: 'Оптимальность плана не установлена.',
  };

  return { run };
})();
