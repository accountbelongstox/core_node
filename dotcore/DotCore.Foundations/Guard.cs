using System.Diagnostics.CodeAnalysis;
using System.Runtime.CompilerServices;

namespace DotCore.Foundations;

/// <summary>
/// Argument and state checks. BCL only; no third-party dependencies.
/// </summary>
public static class Guard
{
    /// <summary>
    /// Throws <see cref="ArgumentNullException"/> if <paramref name="value"/> is null.
    /// </summary>
    public static T NotNull<T>([NotNull] T? value, [CallerArgumentExpression(nameof(value))] string? name = null)
        where T : class
    {
        if (value is null)
            throw new ArgumentNullException(name ?? nameof(value));
        return value;
    }

    /// <summary>
    /// Throws <see cref="ArgumentException"/> if <paramref name="value"/> is null or whitespace.
    /// </summary>
    public static string NotNullOrWhiteSpace([NotNull] string? value, [CallerArgumentExpression(nameof(value))] string? name = null)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Value cannot be null or whitespace.", name ?? nameof(value));
        return value;
    }
}
