// PY-REF: none (DOT-only)
using System.Reflection.PortableExecutable;
using System.Text;

namespace DotCore.Decompile;

public enum BinaryKind { Missing, Managed, AutoIt, Native }

/// <summary>What a PE file is: .NET assembly (ILSpy / de4dot), compiled AutoIt script (autoit-ripper), or other native code; plus UPX packing.</summary>
public sealed record BinaryInfo(BinaryKind Kind, bool UpxPacked);

public static class BinaryInspector
{
    private static readonly byte[][] AutoItMarkers = { Encoding.ASCII.GetBytes("AU3!EA06"), Encoding.ASCII.GetBytes("AU3!EA05"), Encoding.ASCII.GetBytes("AutoIt v3") };
    private static readonly string[] UpxSectionNames = { "UPX0", "UPX1" };

    public static BinaryInfo Inspect(string path)
    {
        if (!File.Exists(path)) return new BinaryInfo(BinaryKind.Missing, false);
        bool upx = false;
        try
        {
            using var stream = File.OpenRead(path);
            using var pe = new PEReader(stream);
            var headers = pe.PEHeaders;
            upx = headers.SectionHeaders.Any(s => UpxSectionNames.Contains(s.Name));
            if (headers.CorHeader != null) return new BinaryInfo(BinaryKind.Managed, upx);
        }
        catch (BadImageFormatException)
        {
            return new BinaryInfo(BinaryKind.Native, false);
        }
        var bytes = File.ReadAllBytes(path);
        bool autoIt = AutoItMarkers.Any(m => bytes.AsSpan().IndexOf(m) >= 0);
        return new BinaryInfo(autoIt ? BinaryKind.AutoIt : BinaryKind.Native, upx);
    }
}
