// PY-REF: none (DOT-only)
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4.Agent;

/// <summary>
/// Fixed-HUD reading with OpenCV (steadier than YOLO for fixed regions): health globe liquid level (red rows bottom-up, smoothed),
/// skill slot readiness (slot brightness against the brightest value seen for it; cooling slots are dimmed) and the grey death screen.
/// One instance per session (keeps the smoothing and the slot baselines).
/// </summary>
public sealed class D4VitalsReader
{
    private readonly double[] _slotBaseline = new double[D4AgentConstants.SkillSlotCount];
    private double? _health;
    private int _deathFrames;

    public D4Vitals Read(D4Frame frame)
    {
        var image = frame.Image;
        double? health = ReadHealth(image, frame.Scale(D4AgentConstants.HealthGlobe));
        if (health is { } h) _health = _health is { } prev ? prev + D4AgentConstants.HealthSmoothing * (h - prev) : h;
        else _health = null;

        var ready = ReadSkills(image, frame.Scale(D4AgentConstants.SkillBar));
        double saturation = MeanSaturation(image);
        bool deathLike = saturation <= D4AgentConstants.DeathMaxMeanSaturation && (_health ?? 0) <= D4AgentConstants.DeathMaxHealth;
        _deathFrames = deathLike ? _deathFrames + 1 : 0;
        return new D4Vitals(_health, ready, _deathFrames >= D4AgentConstants.DeathConfirmFrames, saturation);
    }

    /// <summary>Share of the globe height filled with red liquid; null when the region is empty (globe off screen).</summary>
    public static double? ReadHealth(Mat image, Rect region)
    {
        if (region.Width <= 0 || region.Height <= 0) return null;
        using var roi = new Mat(image, region);
        using var hsv = new Mat();
        Cv2.CvtColor(roi, hsv, ColorConversionCodes.BGR2HSV);
        using var low = new Mat();
        using var high = new Mat();
        Cv2.InRange(hsv, new Scalar(0, D4AgentConstants.HealthMinSaturation, D4AgentConstants.HealthMinValue),
            new Scalar(D4AgentConstants.HealthHueLow, 255, 255), low);
        Cv2.InRange(hsv, new Scalar(D4AgentConstants.HealthHueHigh, D4AgentConstants.HealthMinSaturation, D4AgentConstants.HealthMinValue),
            new Scalar(180, 255, 255), high);
        using var red = new Mat();
        Cv2.BitwiseOr(low, high, red);
        int top = -1;
        for (int y = red.Rows - 1; y >= 0; y--)
        {
            using var row = red.Row(y);
            if (Cv2.CountNonZero(row) < red.Cols * D4AgentConstants.HealthRowFillRatio) break;
            top = y;
        }
        return top < 0 ? 0.0 : (red.Rows - top) / (double)red.Rows;
    }

    private IReadOnlyList<bool> ReadSkills(Mat image, Rect bar)
    {
        var ready = new bool[D4AgentConstants.SkillSlotCount];
        if (bar.Width < D4AgentConstants.SkillSlotCount || bar.Height <= 0) return ready;
        int slotWidth = bar.Width / D4AgentConstants.SkillSlotCount;
        for (int i = 0; i < ready.Length; i++)
        {
            using var slot = new Mat(image, new Rect(bar.X + i * slotWidth, bar.Y, slotWidth, bar.Height));
            using var gray = new Mat();
            Cv2.CvtColor(slot, gray, ColorConversionCodes.BGR2GRAY);
            double brightness = Cv2.Mean(gray).Val0;
            _slotBaseline[i] = Math.Max(brightness, _slotBaseline[i] * D4AgentConstants.SkillBaselineDecay);
            ready[i] = _slotBaseline[i] <= 0 || brightness >= _slotBaseline[i] * D4AgentConstants.SkillReadyBrightnessRatio;
        }
        return ready;
    }

    private static double MeanSaturation(Mat image)
    {
        using var small = new Mat();
        Cv2.Resize(image, small, new Size(D4AgentConstants.SaturationSampleWidth, D4AgentConstants.SaturationSampleHeight), interpolation: InterpolationFlags.Area);
        using var hsv = new Mat();
        Cv2.CvtColor(small, hsv, ColorConversionCodes.BGR2HSV);
        return Cv2.Mean(hsv).Val1;
    }
}
