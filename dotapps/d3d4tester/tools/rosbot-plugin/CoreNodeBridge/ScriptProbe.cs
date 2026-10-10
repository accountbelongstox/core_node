// PY-REF: none (DOT-only)
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// Research command "script_scope" (read only, nothing is executed): ROSBOT hosts IronPython in a static class (a ScriptEngine and a
/// ScriptScope field). Find every static ScriptEngine / ScriptScope field in ROSBOT's assembly by reflection (no compile reference to
/// the DLR) and write to script_scope.txt next to the plugin: the declaring type's token and static methods (signatures), the engine's
/// language and search paths, and every scope variable with its value type (PythonFunction / PythonType entries are ROSBOT's script
/// functions and classes, the candidates for its combat routines).
/// </summary>
internal static class ScriptProbe
{
    public const string Action = "script_scope";
    public const string FileName = "script_scope.txt";
    private const string ScopeTypeName = "Microsoft.Scripting.Hosting.ScriptScope";
    private const string EngineTypeName = "Microsoft.Scripting.Hosting.ScriptEngine";
    private const BindingFlags StaticAll = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    public static CommandResult Run(CommandResult result, string dir)
    {
        var sb = new StringBuilder();
        int scopes = 0, engines = 0, variables = 0;
        foreach (var type in Types(typeof(Context).Assembly))
        {
            var fields = WorldScanner.Safe(() => type.GetFields(StaticAll), Array.Empty<FieldInfo>())
                .Where(f => f.FieldType.FullName is ScopeTypeName or EngineTypeName).ToList();
            if (fields.Count == 0) continue;
            sb.Append("== type 0x").Append(type.MetadataToken.ToString("X8")).Append(' ').Append(Printable(type.FullName)).Append('\n');
            foreach (var m in WorldScanner.Safe(() => type.GetMethods(StaticAll), Array.Empty<MethodInfo>()))
                sb.Append("  method 0x").Append(m.MetadataToken.ToString("X8")).Append(' ').Append(m.ReturnType.Name).Append(" (")
                    .Append(string.Join(", ", m.GetParameters().Select(p => p.ParameterType.Name))).Append(")\n");
            foreach (var field in fields)
            {
                object value = WorldScanner.Safe(() => field.GetValue(null), null);
                sb.Append("  field ").Append(field.FieldType.Name).Append(value == null ? " = null\n" : "\n");
                if (value == null) continue;
                if (field.FieldType.FullName == EngineTypeName)
                {
                    engines++;
                    sb.Append("    language ").Append(Call(value, "get_LanguageVersion")).Append('\n');
                    if (Call(value, "GetSearchPaths") is IEnumerable paths)
                        foreach (var searchPath in paths) sb.Append("    search path ").Append(searchPath).Append('\n');
                    continue;
                }
                scopes++;
                if (Call(value, "GetVariableNames") is not IEnumerable names) continue;
                foreach (var name in names.Cast<object>().Select(n => n?.ToString() ?? "").OrderBy(n => n, StringComparer.Ordinal))
                {
                    variables++;
                    object variable = Call(value, "GetVariable", name);
                    sb.Append("    var ").Append(name).Append(" : ").Append(variable?.GetType().FullName ?? "null").Append('\n');
                }
            }
        }
        string path = Path.Combine(dir, FileName);
        File.WriteAllText(path, sb.Length == 0 ? "no static ScriptEngine / ScriptScope field found\n" : sb.ToString(), new UTF8Encoding(false));
        result.Ok = scopes + engines > 0;
        result.Message = $"{engines} engine(s), {scopes} scope(s), {variables} variable(s) -> {FileName}";
        return result;
    }

    /// <summary>Every loadable type of an assembly (shared by the reflection probes).</summary>
    internal static IEnumerable<Type> Types(Assembly assembly)
    {
        try
        {
            return assembly.GetTypes();
        }
        catch (ReflectionTypeLoadException ex)
        {
            return ex.Types.Where(t => t != null);
        }
    }

    /// <summary>Invoke a public instance method by name (first overload with that many parameters); null on any failure.</summary>
    private static object Call(object target, string name, params object[] args) => WorldScanner.Safe(() =>
        target.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .FirstOrDefault(m => m.Name == name && m.GetParameters().Length == args.Length && !m.IsGenericMethodDefinition)
            ?.Invoke(target, args), null);

    /// <summary>Obfuscated names are zero-width characters: write them as \uXXXX so the file stays readable.</summary>
    internal static string Printable(string text) =>
        string.Concat((text ?? "").Select(c => c is >= ' ' and <= '~' ? c.ToString() : $"\\u{(int)c:x4}"));
}
