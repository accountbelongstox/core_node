// PY-REF: none (DOT-only)
using AsmResolver.DotNet;

namespace DotCore.Decompile.Dynamic;

public sealed class ManagedMethodCatalogEntry
{
    public int Token { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Signature { get; set; } = string.Empty;
    public bool IsStatic { get; set; }
    public bool HasGenericParameters { get; set; }
    public bool IsProtected { get; set; }
}

public static class ManagedMethodCatalog
{
    public static IReadOnlyList<ManagedMethodCatalogEntry> Inspect(string path)
    {
        ModuleDefinition module = ModuleDefinition.FromFile(Path.GetFullPath(path));
        return module.GetAllTypes().SelectMany(type => type.Methods).Select(method =>
            new ManagedMethodCatalogEntry
            {
                Token = method.MetadataToken.ToInt32(),
                TypeName = method.DeclaringType?.FullName ?? string.Empty,
                Name = method.Name?.ToString() ?? string.Empty,
                Signature = method.Signature?.ToString() ?? string.Empty,
                IsStatic = method.IsStatic,
                HasGenericParameters = method.GenericParameters.Count != 0
                    || method.DeclaringType?.GenericParameters.Count != 0,
                IsProtected = method.CilMethodBody != null
                    && DnGuardMethodBodyClassifier.IsPlaceholder(method.CilMethodBody)
            }).ToArray();
    }
}
