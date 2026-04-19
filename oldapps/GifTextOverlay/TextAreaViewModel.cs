using System.ComponentModel;

namespace GifTextOverlay;

public class TextAreaViewModel : INotifyPropertyChanged
{
    private string _text = "pot.4xey";
    private int _presetIndex = 0;
    private string _customFill = "white";
    private string? _customShadowColor = "black";
    private int _customShadowDx = 6, _customShadowDy = 6, _customShadowRadius = 2;
    private string? _customOutlineColor = "black";
    private int _customOutlineWidth = 3;
    private float _posLeft = 5, _posTop = 5, _posRight = 5, _posBottom = 5;
    private int _hAlign = 1, _vAlign = 1; // 0=Start, 1=Center, 2=End
    private string? _fontPath;
    private bool _autoFontSize = true;
    private int _manualFontSize = 48;
    private float _letterSpacing = 0;
    private float _fontStretch = 1f;

    public string Text { get => _text; set { _text = value; OnPropertyChanged(nameof(Text)); } }
    public int PresetIndex { get => _presetIndex; set { _presetIndex = value; OnPropertyChanged(nameof(PresetIndex)); } }
    public string CustomFill { get => _customFill; set { _customFill = value; OnPropertyChanged(nameof(CustomFill)); } }
    public string? CustomShadowColor { get => _customShadowColor; set { _customShadowColor = value; OnPropertyChanged(nameof(CustomShadowColor)); } }
    public int CustomShadowDx { get => _customShadowDx; set { _customShadowDx = value; OnPropertyChanged(nameof(CustomShadowDx)); } }
    public int CustomShadowDy { get => _customShadowDy; set { _customShadowDy = value; OnPropertyChanged(nameof(CustomShadowDy)); } }
    public int CustomShadowRadius { get => _customShadowRadius; set { _customShadowRadius = value; OnPropertyChanged(nameof(CustomShadowRadius)); } }
    public string? CustomOutlineColor { get => _customOutlineColor; set { _customOutlineColor = value; OnPropertyChanged(nameof(CustomOutlineColor)); } }
    public int CustomOutlineWidth { get => _customOutlineWidth; set { _customOutlineWidth = value; OnPropertyChanged(nameof(CustomOutlineWidth)); } }
    public float PosLeft { get => _posLeft; set { _posLeft = value; OnPropertyChanged(nameof(PosLeft)); } }
    public float PosTop { get => _posTop; set { _posTop = value; OnPropertyChanged(nameof(PosTop)); } }
    public float PosRight { get => _posRight; set { _posRight = value; OnPropertyChanged(nameof(PosRight)); } }
    public float PosBottom { get => _posBottom; set { _posBottom = value; OnPropertyChanged(nameof(PosBottom)); } }
    public int HAlign { get => _hAlign; set { _hAlign = value; OnPropertyChanged(nameof(HAlign)); } }
    public int VAlign { get => _vAlign; set { _vAlign = value; OnPropertyChanged(nameof(VAlign)); } }
    public string? FontPath { get => _fontPath; set { _fontPath = value; OnPropertyChanged(nameof(FontPath)); } }
    public bool AutoFontSize { get => _autoFontSize; set { _autoFontSize = value; OnPropertyChanged(nameof(AutoFontSize)); } }
    public int ManualFontSize { get => _manualFontSize; set { _manualFontSize = value; OnPropertyChanged(nameof(ManualFontSize)); } }
    public float LetterSpacing { get => _letterSpacing; set { _letterSpacing = value; OnPropertyChanged(nameof(LetterSpacing)); } }
    public float FontStretch { get => _fontStretch; set { _fontStretch = value; OnPropertyChanged(nameof(FontStretch)); } }

    public TextAreaItem ToItem()
    {
        CustomEffectOptions? custom = null;
        if (PresetIndex == Presets.CustomPresetIndex)
        {
            var fills = (CustomFill ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            custom = new CustomEffectOptions(fills.Length > 0 ? fills : ["white"], CustomShadowColor, CustomShadowDx, CustomShadowDy, CustomShadowRadius, CustomOutlineColor, CustomOutlineWidth);
        }
        return new TextAreaItem(Text, PresetIndex, custom,
            new TextPositionOptions(PosLeft, PosTop, PosRight, PosBottom, HAlign, VAlign),
            string.IsNullOrEmpty(FontPath) ? null : FontPath,
            AutoFontSize, AutoFontSize ? null : ManualFontSize,
            LetterSpacing, FontStretch);
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged(string name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
