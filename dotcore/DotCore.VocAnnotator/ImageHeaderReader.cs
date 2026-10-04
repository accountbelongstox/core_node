using System.Buffers.Binary;

namespace DotCore.VocAnnotator;

/// <summary>Reads pixel size from PNG, JPEG, BMP, GIF and WebP headers without decoding the image (cross-platform).</summary>
public static class ImageHeaderReader
{
    private const int HeaderProbeBytes = 64;
    private const int JpegMaxScanBytes = 1 << 20;

    public static (int Width, int Height)? ReadSize(string imagePath)
    {
        try
        {
            using var stream = File.OpenRead(imagePath);
            Span<byte> head = stackalloc byte[HeaderProbeBytes];
            var read = stream.Read(head);
            if (read < 26) return null;
            head = head[..read];
            if (head[0] == 0x89 && head[1] == (byte)'P' && head[2] == (byte)'N' && head[3] == (byte)'G')
                return Valid(BinaryPrimitives.ReadInt32BigEndian(head[16..]), BinaryPrimitives.ReadInt32BigEndian(head[20..]));
            if (head[0] == (byte)'B' && head[1] == (byte)'M')
                return Valid(BinaryPrimitives.ReadInt32LittleEndian(head[18..]), Math.Abs(BinaryPrimitives.ReadInt32LittleEndian(head[22..])));
            if (head[0] == (byte)'G' && head[1] == (byte)'I' && head[2] == (byte)'F')
                return Valid(BinaryPrimitives.ReadUInt16LittleEndian(head[6..]), BinaryPrimitives.ReadUInt16LittleEndian(head[8..]));
            if (head[0] == (byte)'R' && head[1] == (byte)'I' && head[2] == (byte)'F' && head[3] == (byte)'F' && read >= 30
                && head[8] == (byte)'W' && head[9] == (byte)'E' && head[10] == (byte)'B' && head[11] == (byte)'P')
                return ReadWebP(head);
            if (head[0] == 0xFF && head[1] == 0xD8)
            {
                stream.Position = 2;
                return ReadJpeg(stream);
            }
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        return null;
    }

    private static (int, int)? ReadWebP(ReadOnlySpan<byte> head)
    {
        var chunk = System.Text.Encoding.ASCII.GetString(head.Slice(12, 4));
        switch (chunk)
        {
            case "VP8 ":
                return Valid(BinaryPrimitives.ReadUInt16LittleEndian(head[26..]) & 0x3FFF, BinaryPrimitives.ReadUInt16LittleEndian(head[28..]) & 0x3FFF);
            case "VP8L":
                var bits = BinaryPrimitives.ReadUInt32LittleEndian(head[21..]);
                return Valid((int)(bits & 0x3FFF) + 1, (int)((bits >> 14) & 0x3FFF) + 1);
            case "VP8X":
                return Valid((head[24] | head[25] << 8 | head[26] << 16) + 1, (head[27] | head[28] << 8 | head[29] << 16) + 1);
            default:
                return null;
        }
    }

    private static (int, int)? ReadJpeg(Stream stream)
    {
        Span<byte> buf = stackalloc byte[7];
        while (stream.Position < Math.Min(stream.Length, JpegMaxScanBytes))
        {
            int b = stream.ReadByte();
            if (b != 0xFF) continue;
            int marker;
            do { marker = stream.ReadByte(); } while (marker == 0xFF);
            if (marker < 0) return null;
            if (marker is 0xD8 or 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue;
            if (stream.Read(buf[..2]) < 2) return null;
            int length = BinaryPrimitives.ReadUInt16BigEndian(buf);
            bool isFrame = marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
            if (isFrame)
            {
                if (stream.Read(buf[..5]) < 5) return null;
                return Valid(BinaryPrimitives.ReadUInt16BigEndian(buf[3..]), BinaryPrimitives.ReadUInt16BigEndian(buf[1..]));
            }
            stream.Position += length - 2;
        }
        return null;
    }

    private static (int, int)? Valid(int width, int height) => width > 0 && height > 0 ? (width, height) : null;
}
