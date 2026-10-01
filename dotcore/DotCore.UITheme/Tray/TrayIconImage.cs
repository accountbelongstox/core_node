using System.Runtime.InteropServices;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace DotCore.UITheme.Tray;

/// <summary>
/// Converts WPF images to native HICON handles (32-bit BGRA with alpha) for the notification area.
/// Callers own the returned handle and release it with <see cref="Destroy"/>.
/// </summary>
public static class TrayIconImage
{
    private const int SmCxSmIcon = 49;
    private const int DefaultSmallIconSize = 16;
    private const int BytesPerPixel = 4;
    private const int ColorBitsPerPixel = 32;
    private const int MaskBitsPerPixel = 1;

    [StructLayout(LayoutKind.Sequential)]
    private struct IconInfo
    {
        public bool FIcon;
        public int XHotspot;
        public int YHotspot;
        public IntPtr HbmMask;
        public IntPtr HbmColor;
    }

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int index);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr CreateIconIndirect(ref IconInfo info);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool DestroyIcon(IntPtr hIcon);

    [DllImport("gdi32.dll", SetLastError = true)]
    private static extern IntPtr CreateBitmap(int width, int height, uint planes, uint bitsPerPixel, byte[] bits);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr hObject);

    /// <summary>System small-icon edge in pixels (tray icon size).</summary>
    public static int SmallIconSize
    {
        get
        {
            try
            {
                var size = GetSystemMetrics(SmCxSmIcon);
                return size > 0 ? size : DefaultSmallIconSize;
            }
            catch (DllNotFoundException)
            {
                return DefaultSmallIconSize;
            }
        }
    }

    /// <summary>Picks the frame closest to <paramref name="size"/> from a multi-frame image (e.g. .ico decoder).</summary>
    public static BitmapSource? PickFrame(BitmapDecoder decoder, int size)
    {
        if (decoder.Frames.Count == 0) return null;
        return decoder.Frames
            .OrderBy(f => Math.Abs(f.PixelWidth - size))
            .ThenByDescending(f => f.Format.BitsPerPixel)
            .First();
    }

    /// <summary>Creates an HICON of size x size from the image. Returns IntPtr.Zero on failure.</summary>
    public static IntPtr CreateHIcon(ImageSource image, int size)
    {
        if (size <= 0) size = SmallIconSize;
        var source = image as BitmapSource ?? Render(image, size);
        if (source == null) return IntPtr.Zero;

        BitmapSource scaled = source.PixelWidth == size && source.PixelHeight == size
            ? source
            : new TransformedBitmap(source, new ScaleTransform(size / (double)source.PixelWidth, size / (double)source.PixelHeight));
        var bgra = new FormatConvertedBitmap(scaled, PixelFormats.Bgra32, null, 0);
        int stride = size * BytesPerPixel;
        var pixels = new byte[stride * size];
        bgra.CopyPixels(pixels, stride, 0);

        int maskStride = (size + 15) / 16 * 2;
        var mask = new byte[maskStride * size];
        IntPtr hbmColor = IntPtr.Zero;
        IntPtr hbmMask = IntPtr.Zero;
        try
        {
            hbmColor = CreateBitmap(size, size, 1, ColorBitsPerPixel, pixels);
            hbmMask = CreateBitmap(size, size, 1, MaskBitsPerPixel, mask);
            if (hbmColor == IntPtr.Zero || hbmMask == IntPtr.Zero) return IntPtr.Zero;
            var info = new IconInfo { FIcon = true, HbmColor = hbmColor, HbmMask = hbmMask };
            return CreateIconIndirect(ref info);
        }
        catch (DllNotFoundException)
        {
            return IntPtr.Zero;
        }
        finally
        {
            if (hbmColor != IntPtr.Zero) DeleteObject(hbmColor);
            if (hbmMask != IntPtr.Zero) DeleteObject(hbmMask);
        }
    }

    /// <summary>Releases an HICON created by <see cref="CreateHIcon"/>.</summary>
    public static void Destroy(IntPtr hIcon)
    {
        if (hIcon == IntPtr.Zero) return;
        try { DestroyIcon(hIcon); }
        catch (DllNotFoundException) { }
    }

    private static BitmapSource? Render(ImageSource image, int size)
    {
        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
            dc.DrawImage(image, new System.Windows.Rect(0, 0, size, size));
        var bitmap = new RenderTargetBitmap(size, size, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(visual);
        bitmap.Freeze();
        return bitmap;
    }
}
