namespace DotCore.Utils.ImageMorphology;

/// <summary>
/// Constants for morphology options (Canny, dilation, erosion). No magic literals in public API defaults; use these names.
/// </summary>
public static class MorphologyConstants
{
    /// <summary>Default Canny edge low threshold.</summary>
    public const double DefaultCannyThreshold1 = 50;

    /// <summary>Default Canny edge high threshold.</summary>
    public const double DefaultCannyThreshold2 = 150;

    /// <summary>Default dilation kernel size (width and height).</summary>
    public const int DefaultDilationKernelSize = 2;

    /// <summary>Default erosion kernel size; 0 means skip erosion.</summary>
    public const int DefaultErosionKernelSize = 0;
}
