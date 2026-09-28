namespace DotCore.Foundations;

/// <summary>
/// Simple result type for operations that can fail. BCL only.
/// </summary>
public readonly struct Result
{
    public bool IsSuccess { get; }
    public string? ErrorMessage { get; }

    private Result(bool isSuccess, string? errorMessage)
    {
        IsSuccess = isSuccess;
        ErrorMessage = errorMessage;
    }

    public static Result Ok() => new(true, null);
    public static Result Fail(string message) => new(false, message);

    public void ThrowOnFailure()
    {
        if (!IsSuccess)
            throw new InvalidOperationException(ErrorMessage ?? "Operation failed.");
    }
}
