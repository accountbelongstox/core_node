// PY-REF: none (DOT-only)
namespace DotCore.Utils;

/// <summary>One protobuf wire field: number, wire type, varint value (wire type 0) or payload bytes (wire type 2).</summary>
public readonly record struct ProtobufField(int Number, int WireType, ulong Varint, ReadOnlyMemory<byte> Bytes)
{
    public string AsString() => System.Text.Encoding.UTF8.GetString(Bytes.Span);
}

/// <summary>
/// Schema-less protobuf wire reader for reading a few known fields from third-party files (e.g. Battle.net product.db) without
/// generated code. Fixed 32/64-bit fields are skipped; group wire types or truncated data end the read.
/// </summary>
public static class ProtobufWire
{
    private const int WireVarint = 0;
    private const int WireFixed64 = 1;
    private const int WireLengthDelimited = 2;
    private const int WireFixed32 = 5;
    private const int Fixed64Size = 8;
    private const int Fixed32Size = 4;

    public static List<ProtobufField> Read(ReadOnlyMemory<byte> data)
    {
        var fields = new List<ProtobufField>();
        int pos = 0;
        var span = data.Span;
        while (pos < span.Length)
        {
            if (!TryVarint(span, ref pos, out ulong tag)) break;
            int number = (int)(tag >> 3), wire = (int)(tag & 7);
            switch (wire)
            {
                case WireVarint:
                    if (!TryVarint(span, ref pos, out ulong value)) return fields;
                    fields.Add(new ProtobufField(number, wire, value, ReadOnlyMemory<byte>.Empty));
                    break;
                case WireLengthDelimited:
                    if (!TryVarint(span, ref pos, out ulong length) || length > (ulong)(span.Length - pos)) return fields;
                    fields.Add(new ProtobufField(number, wire, 0, data.Slice(pos, (int)length)));
                    pos += (int)length;
                    break;
                case WireFixed64:
                    pos += Fixed64Size;
                    break;
                case WireFixed32:
                    pos += Fixed32Size;
                    break;
                default:
                    return fields;
            }
        }
        return fields;
    }

    private static bool TryVarint(ReadOnlySpan<byte> span, ref int pos, out ulong value)
    {
        value = 0;
        for (int shift = 0; shift < 64 && pos < span.Length; shift += 7)
        {
            byte b = span[pos++];
            value |= (ulong)(b & 0x7F) << shift;
            if ((b & 0x80) == 0) return true;
        }
        return false;
    }
}
