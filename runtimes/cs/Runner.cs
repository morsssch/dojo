// Компиляция и запуск кода ученика. Вызывается из JS: Run(files, stdin) → JSON.
// files[0] — код ученика (Program.cs), остальные — код проверки. Операторы верхнего уровня в коде проверки
// оборачиваются в отдельный класс __DojoCheck, и точкой входа становится он, а не Main ученика — так проверяются
// и отдельные классы, и этапы лабы внутри целой программы (в шаблоне может быть свой class Program).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Loader;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Emit;

public static partial class Runner
{
    // неявные using, как в консольном проекте Visual Studio
    const string GlobalUsings = "global using System; global using System.Collections.Generic; global using System.IO; global using System.Linq; global using System.Net.Http; global using System.Threading; global using System.Threading.Tasks;";

    static List<MetadataReference> refs;
    static readonly CSharpParseOptions Parse = new(LanguageVersion.Latest);

    public static void Main()
    {
        var ru = new CultureInfo("ru-RU");
        CultureInfo.DefaultThreadCurrentCulture = ru;
        CultureInfo.DefaultThreadCurrentUICulture = ru;
        CultureInfo.CurrentCulture = ru;
        CultureInfo.CurrentUICulture = ru;
    }

    // async: ученик может написать async Main с await — в однопоточном wasm задачу нельзя ждать блокирующе
    [JSExport]
    public static async Task<string> Run(string[] files, string stdin)
    {
        refs ??= Basic.Reference.Assemblies.Net100.References.All.Cast<MetadataReference>().ToList();
        var trees = new List<SyntaxTree> { CSharpSyntaxTree.ParseText(GlobalUsings, Parse, "_usings.cs", Encoding.UTF8) };
        string mainType = null;
        for (var i = 0; i < files.Length; i++)
        {
            var src = files[i];
            if (i > 0 && WrapTopLevel(src, out var wrapped))
            {
                src = wrapped;
                mainType = "__DojoCheck";
            }
            trees.Add(CSharpSyntaxTree.ParseText(src, Parse, i == 0 ? "Program.cs" : $"Check{i}.cs", Encoding.UTF8));
        }
        var comp = CSharpCompilation.Create(
            "UserCode",
            trees,
            refs,
            new CSharpCompilationOptions(OutputKind.ConsoleApplication, optimizationLevel: OptimizationLevel.Debug, allowUnsafe: true, nullableContextOptions: NullableContextOptions.Disable, concurrentBuild: false, mainTypeName: mainType));
        // без pdb: контрольные суммы исходников Roslyn считает в Task.Run, а дождаться его в однопоточном wasm нельзя
        using var pe = new MemoryStream();
        var emit = comp.Emit(pe);
        var errors = emit.Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error).Select(Diag).ToList();
        if (!emit.Success) return Json(new { output = "", errors });

        var outW = new StringWriter();
        var oldOut = Console.Out;
        var oldErr = Console.Error;
        object exception = null;
        var alc = new AssemblyLoadContext("user", isCollectible: true);
        try
        {
            Console.SetOut(outW);
            Console.SetError(outW);
            Console.SetIn(new StringReader(stdin ?? ""));
            pe.Position = 0;
            var asm = alc.LoadFromStream(pe);
            var entry = asm.EntryPoint;
            // async Main: точка входа — синхронная обёртка <Main>, которая ждёт задачу блокирующе; зовём сам async-метод
            if (entry.Name == "<Main>")
                entry = entry.DeclaringType.GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
                    .FirstOrDefault(x => (x.Name == "Main" || x.Name == "<Main>$") && typeof(System.Threading.Tasks.Task).IsAssignableFrom(x.ReturnType)) ?? entry;
            var args = entry.GetParameters().Length == 0 ? null : new object[] { Array.Empty<string>() };
            var ret = entry.Invoke(null, args);
            if (ret is System.Threading.Tasks.Task t) await t;
        }
        catch (Exception e)
        {
            var ex = e is TargetInvocationException { InnerException: { } inner } ? inner : e;
            exception = new { type = ex.GetType().FullName, message = ex.Message, where = UserFrame(ex) };
        }
        finally
        {
            Console.Out.Flush();
            Console.SetOut(oldOut);
            Console.SetError(oldErr);
            alc.Unload();
        }
        return Json(new { output = outW.ToString(), errors, exception });
    }

    // операторы верхнего уровня → static class __DojoCheck { static async Task Main() { ... } }, остальное как есть
    static bool WrapTopLevel(string src, out string wrapped)
    {
        wrapped = src;
        var root = CSharpSyntaxTree.ParseText(src, Parse).GetCompilationUnitRoot();
        var stmts = root.Members.OfType<Microsoft.CodeAnalysis.CSharp.Syntax.GlobalStatementSyntax>().ToList();
        if (stmts.Count == 0) return false;
        var sb = new StringBuilder();
        foreach (var u in root.Usings) sb.AppendLine(u.ToFullString().Trim());
        sb.AppendLine("static class __DojoCheck { static async System.Threading.Tasks.Task Main() { await System.Threading.Tasks.Task.CompletedTask;");
        foreach (var st in stmts) sb.AppendLine(st.ToFullString());
        sb.AppendLine("} }");
        foreach (var m in root.Members) if (m is not Microsoft.CodeAnalysis.CSharp.Syntax.GlobalStatementSyntax) sb.AppendLine(m.ToFullString());
        wrapped = sb.ToString();
        return true;
    }

    static object Diag(Diagnostic d)
    {
        var span = d.Location.GetLineSpan();
        var user = d.Location.SourceTree?.FilePath == "Program.cs";
        // line = 0 — ошибка в коде проверки, а не у ученика
        return new { id = d.Id, message = d.GetMessage(CultureInfo.CurrentUICulture), line = user ? span.StartLinePosition.Line + 1 : 0, col = user ? span.StartLinePosition.Character + 1 : 0 };
    }

    // метод из кода ученика, где вылетело исключение (номеров строк нет — без pdb)
    static string UserFrame(Exception e)
    {
        var st = new System.Diagnostics.StackTrace(e, false);
        foreach (var f in st.GetFrames() ?? Array.Empty<System.Diagnostics.StackFrame>())
        {
            var m = f.GetMethod();
            if (m?.DeclaringType?.Assembly.GetName().Name != "UserCode") continue;
            var t = m.DeclaringType;
            while (t.DeclaringType != null && t.Name.StartsWith("<")) t = t.DeclaringType; // лямбды и итераторы → внешний тип
            var name = m.Name.StartsWith("<") ? m.Name.Split('>')[0].TrimStart('<') : m.Name;
            if (m.Name.StartsWith("<Main>$") || (t.Name == "Program" && name == "Main" && m.Name.StartsWith("<"))) return "основная программа";
            return $"{t.Name}.{name}";
        }
        return null;
    }

    static readonly JsonSerializerOptions JsonOpts = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    static string Json(object o) => JsonSerializer.Serialize(o, JsonOpts);
}
