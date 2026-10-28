// C#: код ученика и код проверки компилируются отдельными файлами (runtimes/cs/Runner.cs), поэтому номера строк
// в ошибках уже совпадают со строками ученика. Здесь — пролог проверки и превращение результата раннера в ExecResult.

/** Пролог проверки: Dojo.Check / Dojo.Assert / Dojo.Throws печатают строки @@PASS / @@FAIL. */
export const CS_HARNESS_PRELUDE = `
public static class Dojo
{
    static string Show(object v) => v switch
    {
        null => "null",
        string s => "\\"" + s + "\\"",
        char c => "'" + c + "'",
        bool b => b ? "true" : "false",
        System.Collections.IDictionary d => "{" + string.Join(", ", System.Linq.Enumerable.Select(System.Linq.Enumerable.Cast<System.Collections.DictionaryEntry>(d), e => Show(e.Key) + ": " + Show(e.Value))) + "}",
        System.Collections.IEnumerable e => "[" + string.Join(", ", System.Linq.Enumerable.Select(System.Linq.Enumerable.Cast<object>(e), Show)) + "]",
        System.IFormattable f => f.ToString(null, System.Globalization.CultureInfo.CurrentCulture),
        _ => v.ToString(),
    };

    static bool Same(object a, object b)
    {
        if (a is null || b is null) return a is null && b is null;
        if (a is string || b is string) return Equals(a, b);
        if (a is System.Collections.IDictionary da && b is System.Collections.IDictionary db)
        {
            if (da.Count != db.Count) return false;
            foreach (System.Collections.DictionaryEntry e in da)
                if (!db.Contains(e.Key) || !Same(e.Value, db[e.Key])) return false;
            return true;
        }
        if (a is System.Collections.IEnumerable ea && b is System.Collections.IEnumerable eb)
        {
            var la = System.Linq.Enumerable.ToList(System.Linq.Enumerable.Cast<object>(ea));
            var lb = System.Linq.Enumerable.ToList(System.Linq.Enumerable.Cast<object>(eb));
            if (la.Count != lb.Count) return false;
            for (var i = 0; i < la.Count; i++) if (!Same(la[i], lb[i])) return false;
            return true;
        }
        if (a is double || a is float || b is double || b is float)
            return System.Math.Abs(System.Convert.ToDouble(a) - System.Convert.ToDouble(b)) < 1e-9;
        return Equals(a, b);
    }

    static void Report(string name, bool ok, string msg)
    {
        System.Console.Out.Flush();
        System.Console.WriteLine(ok ? "\\n@@PASS " + name : "\\n@@FAIL " + name + "\\u001f" + msg);
    }

    public static void Check<T>(string name, T got, T want) => Report(name, Same(got, want), "получено: " + Show(got) + "\\u001fожидалось: " + Show(want));

    public static void Assert(string name, bool ok, string msg = "условие не выполнено") => Report(name, ok, msg);

    /** Вызов должен бросить исключение TEx. */
    public static void Throws<TEx>(string name, System.Action act) where TEx : System.Exception
    {
        try { act(); Report(name, false, "исключение " + typeof(TEx).Name + " не брошено"); }
        catch (TEx) { Report(name, true, ""); }
        catch (System.Exception e) { Report(name, false, "брошено " + e.GetType().Name + " вместо " + typeof(TEx).Name + ": " + e.Message); }
    }

    /** Проверка без падения всей проверки: исключение внутри — провал этого пункта. */
    public static void Try(string name, System.Action act)
    {
        try { act(); }
        catch (System.Exception e) { Report(name, false, e.GetType().Name + ": " + e.Message); }
    }
}
`;

export interface CsRunResult {
  output: string;
  errors: { id: string; message: string; line: number; col: number }[];
  exception?: { type: string; message: string; where?: string | null } | null;
  crashed?: boolean;
}

/** Ответ раннера → текст ошибки в формате, который понимают объяснялка и интерфейс. */
export function csError(r: CsRunResult): string | undefined {
  // код ученика компилируется, но проверка не находит в нём нужных членов — одна понятная строка вместо стены ошибок
  const missing = r.errors.filter((e) => !e.line && /^CS(1061|0117|0103|0246|0234)$/.test(e.id));
  if (r.errors.length && missing.length === r.errors.length) {
    const names = [...new Set(missing.map((e) => e.message.match(/"([^"]+)"/g)?.at(e.id === 'CS1061' || e.id === 'CS0117' ? 1 : 0)?.replace(/"/g, '')).filter(Boolean))];
    return `Проверка не нашла в твоём коде: ${names.map((n) => `«${n}»`).join(', ')}. Проверь имена, регистр и что члены объявлены public.`;
  }
  if (r.errors.length)
    return r.errors
      .map((e) => (e.line ? `строка ${e.line}, позиция ${e.col}: ${e.id}: ${e.message}` : `[код проверки] ${e.id}: ${e.message}`))
      .join('\n');
  if (r.crashed) {
    if (/stack ?overflow/i.test(r.exception?.message ?? '') || /exit\(1\)/.test(r.exception?.message ?? ''))
      return 'System.StackOverflowException: стек переполнен — скорее всего, бесконечная рекурсия (метод или свойство вызывает сам себя).';
    return `Рантайм C# аварийно завершился: ${r.exception?.message ?? ''}`;
  }
  if (r.exception) return `Необработанное исключение ${r.exception.type}: ${r.exception.message}${r.exception.where ? ` (в ${r.exception.where})` : ''}`;
  return undefined;
}
