namespace DotCore.Utils.ImageColor;

/// <summary>HSV bounds for InRange. All in OpenCV convention: H 0–180, S 0–255, V 0–255.</summary>
public readonly struct HsvRange
{
    public byte HMin { get; }
    public byte HMax { get; }
    public byte SMin { get; }
    public byte SMax { get; }
    public byte VMin { get; }
    public byte VMax { get; }

    public HsvRange(byte hMin, byte hMax, byte sMin, byte sMax, byte vMin, byte vMax)
    {
        HMin = hMin;
        HMax = hMax;
        SMin = sMin;
        SMax = sMax;
        VMin = vMin;
        VMax = vMax;
    }

    /// <summary>Low bound as OpenCvSharp Scalar (HMin, SMin, VMin).</summary>
    public OpenCvSharp.Scalar Low => new(HMin, SMin, VMin);

    /// <summary>High bound as OpenCvSharp Scalar (HMax, SMax, VMax).</summary>
    public OpenCvSharp.Scalar High => new(HMax, SMax, VMax);
}
