// PY-REF: none (DOT-only)
using OpenCvSharp;

namespace DotCore.MinimapPath;

/// <summary>Zhang-Suen thinning of a binary mask to a one-pixel skeleton (equivalent of cv2.ximgproc.thinning / skimage skeletonize).</summary>
public static class SkeletonThinning
{
    /// <summary>Skeleton of a binary 8UC1 mask (non-zero = foreground) as a new 0/255 mask. Caller disposes.</summary>
    public static Mat Thin(Mat binary)
    {
        int w = binary.Cols, h = binary.Rows;
        using var src = binary.Clone();
        src.GetArray(out byte[] data);
        var px = new byte[data.Length];
        for (int i = 0; i < data.Length; i++) px[i] = data[i] != 0 ? (byte)1 : (byte)0;

        var remove = new List<int>();
        bool changed = true;
        while (changed)
        {
            changed = false;
            for (int step = 0; step < 2; step++)
            {
                remove.Clear();
                for (int y = 1; y < h - 1; y++)
                {
                    for (int x = 1; x < w - 1; x++)
                    {
                        int i = y * w + x;
                        if (px[i] == 0) continue;
                        int p2 = px[i - w], p3 = px[i - w + 1], p4 = px[i + 1], p5 = px[i + w + 1];
                        int p6 = px[i + w], p7 = px[i + w - 1], p8 = px[i - 1], p9 = px[i - w - 1];
                        int b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                        if (b < 2 || b > 6) continue;
                        int a = (p2 == 0 && p3 == 1 ? 1 : 0) + (p3 == 0 && p4 == 1 ? 1 : 0) + (p4 == 0 && p5 == 1 ? 1 : 0) +
                                (p5 == 0 && p6 == 1 ? 1 : 0) + (p6 == 0 && p7 == 1 ? 1 : 0) + (p7 == 0 && p8 == 1 ? 1 : 0) +
                                (p8 == 0 && p9 == 1 ? 1 : 0) + (p9 == 0 && p2 == 1 ? 1 : 0);
                        if (a != 1) continue;
                        bool keep = step == 0
                            ? p2 * p4 * p6 != 0 || p4 * p6 * p8 != 0
                            : p2 * p4 * p8 != 0 || p2 * p6 * p8 != 0;
                        if (!keep) remove.Add(i);
                    }
                }
                foreach (int i in remove) px[i] = 0;
                if (remove.Count > 0) changed = true;
            }
        }

        for (int i = 0; i < px.Length; i++) px[i] = px[i] != 0 ? (byte)255 : (byte)0;
        var result = new Mat(h, w, MatType.CV_8UC1);
        result.SetArray(px);
        return result;
    }
}
