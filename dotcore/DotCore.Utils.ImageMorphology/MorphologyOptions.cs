namespace DotCore.Utils.ImageMorphology;

/// <summary>Options for Canny edge and dilation/erosion (text-region detection).</summary>
public sealed class MorphologyOptions
{
    /// <summary>Canny low threshold. Default <see cref="MorphologyConstants.DefaultCannyThreshold1"/>.</summary>
    public double CannyThreshold1 { get; set; } = MorphologyConstants.DefaultCannyThreshold1;

    /// <summary>Canny high threshold. Default <see cref="MorphologyConstants.DefaultCannyThreshold2"/>.</summary>
    public double CannyThreshold2 { get; set; } = MorphologyConstants.DefaultCannyThreshold2;

    /// <summary>Dilation kernel size (width and height). Default <see cref="MorphologyConstants.DefaultDilationKernelSize"/>.</summary>
    public int DilationKernelSize { get; set; } = MorphologyConstants.DefaultDilationKernelSize;

    /// <summary>Erosion kernel size; 0 = skip erosion. Default <see cref="MorphologyConstants.DefaultErosionKernelSize"/>.</summary>
    public int ErosionKernelSize { get; set; } = MorphologyConstants.DefaultErosionKernelSize;
}
