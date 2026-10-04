using System.Collections.ObjectModel;
using System.IO;
using System.ComponentModel;
using System.Windows;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using DotCore.Foundations;
using DotCore.VocAnnotator;
using static DotCore.VocAnnotatorUI.AnnotatorI18n;
using K = DotCore.VocAnnotatorUI.AnnotatorI18nKeys;

namespace DotCore.VocAnnotatorUI;

/// <summary>
/// Annotator state and operations: image list (filter, search, sort, labeled status), current image boxes with undo/redo,
/// project classes (add/rename/delete/reorder/color, propagated to every annotation), AI pre-labeling and saving.
/// Classes come from the project dir (annotator_config.json / project_config.json); annotations are saved in AnnotationDir.
/// </summary>
public sealed class AnnotatorViewModel : ObservableObject, IDisposable
{
    private const string LogTag = "[Annotator]";
    private const double DuplicateOffset = 10;
    private const double NudgeStep = 1;
    private const double NudgeFastStep = 10;

    private readonly IAnnotatorDialogs _dialogs;
    private readonly Dispatcher _dispatcher;
    private readonly AutoLabelService _autoLabel = new();
    private readonly UndoHistory _history = new();
    private readonly Dictionary<string, Dictionary<string, int>> _labelsByImage = new(StringComparer.OrdinalIgnoreCase);
    private ProjectConfig.ProjectConfigData _project = new();
    private List<AnnotationBox> _clipboard = new();
    private CancellationTokenSource? _taskCts;
    private AnnotatorImageItem? _currentImage;
    private BitmapSource? _bitmap;
    private int _selectedBoxIndex = -1;
    private AnnotatorClassItem? _selectedClass;
    private string _currentLabel = ProjectConfig.DefaultClassName;
    private bool _isDrawMode;
    private bool _isDirty;
    private bool _isBusy;
    private string _filter = AnnotatorSettings.FilterAll;
    private string _searchText = "";
    private string _statusMessage = "";
    private string _taskText = "";
    private string? _imagesDir;
    private string? _annotationDir;
    private string? _projectDir;

    public AnnotatorViewModel(IAnnotatorDialogs dialogs)
    {
        _dialogs = dialogs;
        _dispatcher = Dispatcher.CurrentDispatcher;
        Settings = VocAnnotatorConfig.Load();
        _filter = Settings.ImageFilter;
        ImagesView = CollectionViewSource.GetDefaultView(Images);
        ImagesView.Filter = o => o is AnnotatorImageItem item && PassesFilter(item);
        Boxes.CollectionChanged += (_, _) => RebuildBoxItems();

        OpenImagesDirCommand = new AnnotatorCommand(OpenImagesDir);
        SetSaveDirCommand = new AnnotatorCommand(SetSaveDir);
        PrevImageCommand = new AnnotatorCommand(() => Step(-1), () => HasImage);
        NextImageCommand = new AnnotatorCommand(() => Step(1), () => HasImage);
        NextUnlabeledCommand = new AnnotatorCommand(NextUnlabeled, () => Images.Count > 0);
        ToggleDrawModeCommand = new AnnotatorCommand(() => IsDrawMode = !IsDrawMode, () => HasImage);
        DeleteBoxCommand = new AnnotatorCommand(DeleteSelected, () => HasSelection);
        DuplicateBoxCommand = new AnnotatorCommand(DuplicateSelected, () => HasSelection);
        CopyBoxesCommand = new AnnotatorCommand(CopyBoxes, () => Boxes.Count > 0);
        PasteBoxesCommand = new AnnotatorCommand(PasteBoxes, () => HasImage && _clipboard.Count > 0);
        CopyPreviousCommand = new AnnotatorCommand(() => CopyFromPrevious(showMessage: true), () => HasImage);
        UndoCommand = new AnnotatorCommand(Undo, () => _history.CanUndo);
        RedoCommand = new AnnotatorCommand(Redo, () => _history.CanRedo);
        SaveCommand = new AnnotatorCommand(() => Save(), () => HasImage);
        ClearBoxesCommand = new AnnotatorCommand(ClearBoxes, () => Boxes.Count > 0);
        ResetAnnotationCommand = new AnnotatorCommand(ResetAnnotation, () => CurrentImage?.IsLabeled == true);
        ToggleDifficultCommand = new AnnotatorCommand(ToggleDifficult, () => HasSelection);
        AutoLabelCommand = new AnnotatorCommand(() => _ = AutoLabelCurrentAsync(), () => HasImage && !IsBusy);
        AutoLabelAllCommand = new AnnotatorCommand(() => _ = AutoLabelAllAsync(), () => Images.Count > 0 && !IsBusy && _annotationDir != null);
        CancelTaskCommand = new AnnotatorCommand(() => _taskCts?.Cancel(), () => IsBusy);
        AddClassCommand = new AnnotatorCommand(AddClass, () => _projectDir != null);
        RenameClassCommand = new AnnotatorCommand(RenameClass, () => _projectDir != null && SelectedClass != null);
        DeleteClassCommand = new AnnotatorCommand(DeleteClass, () => _projectDir != null && SelectedClass != null);
        MoveClassUpCommand = new AnnotatorCommand(() => MoveClass(-1), () => SelectedClass is { Index: > 0 });
        MoveClassDownCommand = new AnnotatorCommand(() => MoveClass(1), () => SelectedClass != null && SelectedClass.Index < Classes.Count - 1);
        ToggleLabelsCommand = new AnnotatorCommand(() => UpdateSettings(s => s.ShowLabels = !s.ShowLabels));
        SettingsCommand = new AnnotatorCommand(EditSettings);
        HelpCommand = new AnnotatorCommand(() => _dialogs.ShowHelp(T(K.HelpTitle), T(K.HelpText)));
    }

    /// <summary>Class colors changed (canvas must redraw).</summary>
    public event EventHandler? ColorsChanged;

    /// <summary>The selected box should be scrolled into view.</summary>
    public event EventHandler? SelectionRevealRequested;

    public AnnotatorSettings Settings { get; private set; }

    public ObservableCollection<AnnotatorImageItem> Images { get; } = new();

    public ICollectionView ImagesView { get; }

    public ObservableCollection<AnnotationBox> Boxes { get; } = new();

    public ObservableCollection<AnnotatorBoxItem> BoxItems { get; } = new();

    public ObservableCollection<AnnotatorClassItem> Classes { get; } = new();

    public ICommand OpenImagesDirCommand { get; }
    public ICommand SetSaveDirCommand { get; }
    public ICommand PrevImageCommand { get; }
    public ICommand NextImageCommand { get; }
    public ICommand NextUnlabeledCommand { get; }
    public ICommand ToggleDrawModeCommand { get; }
    public ICommand DeleteBoxCommand { get; }
    public ICommand DuplicateBoxCommand { get; }
    public ICommand CopyBoxesCommand { get; }
    public ICommand PasteBoxesCommand { get; }
    public ICommand CopyPreviousCommand { get; }
    public ICommand UndoCommand { get; }
    public ICommand RedoCommand { get; }
    public ICommand SaveCommand { get; }
    public ICommand ClearBoxesCommand { get; }
    public ICommand ResetAnnotationCommand { get; }
    public ICommand ToggleDifficultCommand { get; }
    public ICommand AutoLabelCommand { get; }
    public ICommand AutoLabelAllCommand { get; }
    public ICommand CancelTaskCommand { get; }
    public ICommand AddClassCommand { get; }
    public ICommand RenameClassCommand { get; }
    public ICommand DeleteClassCommand { get; }
    public ICommand MoveClassUpCommand { get; }
    public ICommand MoveClassDownCommand { get; }
    public ICommand ToggleLabelsCommand { get; }
    public ICommand SettingsCommand { get; }
    public ICommand HelpCommand { get; }

    public string? ImagesDir { get => _imagesDir; private set => Set(ref _imagesDir, value); }

    public string? AnnotationDir { get => _annotationDir; private set => Set(ref _annotationDir, value); }

    public string? ProjectDir { get => _projectDir; private set => Set(ref _projectDir, value); }

    public bool HasImage => _currentImage != null && _bitmap != null;

    public bool HasSelection => _selectedBoxIndex >= 0 && _selectedBoxIndex < Boxes.Count;

    public BitmapSource? Bitmap { get => _bitmap; private set { if (Set(ref _bitmap, value)) OnPropertyChanged(nameof(HasImage)); } }

    public AnnotatorImageItem? CurrentImage
    {
        get => _currentImage;
        set
        {
            if (ReferenceEquals(value, _currentImage)) return;
            if (!TryLeaveCurrentImage())
            {
                _dispatcher.BeginInvoke(() => OnPropertyChanged(nameof(CurrentImage)));
                return;
            }
            _currentImage = value;
            OnPropertyChanged();
            LoadCurrentImage();
        }
    }

    public int SelectedBoxIndex
    {
        get => _selectedBoxIndex;
        set
        {
            value = value >= 0 && value < Boxes.Count ? value : -1;
            if (!Set(ref _selectedBoxIndex, value)) return;
            OnPropertyChanged(nameof(SelectedBoxItem));
            OnPropertyChanged(nameof(SelectedBoxLabel));
            OnPropertyChanged(nameof(SelectedBoxDifficult));
            OnPropertyChanged(nameof(HasSelection));
        }
    }

    public AnnotatorBoxItem? SelectedBoxItem
    {
        get => HasSelection && _selectedBoxIndex < BoxItems.Count ? BoxItems[_selectedBoxIndex] : null;
        set
        {
            SelectedBoxIndex = value?.Index ?? -1;
            if (value != null) SelectionRevealRequested?.Invoke(this, EventArgs.Empty);
        }
    }

    /// <summary>Class of the selected box (setting it relabels the box).</summary>
    public string? SelectedBoxLabel
    {
        get => HasSelection ? Boxes[_selectedBoxIndex].Label : null;
        set { if (value != null) SetSelectedLabel(value); }
    }

    public bool SelectedBoxDifficult
    {
        get => HasSelection && Boxes[_selectedBoxIndex].Difficult;
        set
        {
            if (HasSelection && Boxes[_selectedBoxIndex].Difficult != value) ToggleDifficult();
        }
    }

    public AnnotatorClassItem? SelectedClass
    {
        get => _selectedClass;
        set
        {
            if (!Set(ref _selectedClass, value) || value == null) return;
            CurrentLabel = value.Name;
        }
    }

    public string CurrentLabel { get => _currentLabel; set => Set(ref _currentLabel, value); }

    public IEnumerable<string> ClassNames => Classes.Select(c => c.Name);

    public bool IsDrawMode { get => _isDrawMode; set => Set(ref _isDrawMode, value); }

    public bool IsDirty { get => _isDirty; private set { if (Set(ref _isDirty, value)) OnPropertyChanged(nameof(DirtyText)); } }

    public string DirtyText => _isDirty ? T(K.StatusDirty) : "";

    public bool IsBusy { get => _isBusy; private set => Set(ref _isBusy, value); }

    public string TaskText { get => _taskText; private set => Set(ref _taskText, value); }

    public string StatusMessage { get => _statusMessage; private set => Set(ref _statusMessage, value); }

    public string Filter
    {
        get => _filter;
        set
        {
            if (!Set(ref _filter, value)) return;
            UpdateSettings(s => s.ImageFilter = value);
            ImagesView.Refresh();
        }
    }

    public string SearchText
    {
        get => _searchText;
        set
        {
            if (Set(ref _searchText, value ?? "")) ImagesView.Refresh();
        }
    }

    public string ProgressText => T(K.ProgressFormat)
        .Replace("{labeled}", Images.Count(i => i.IsLabeled).ToString())
        .Replace("{total}", Images.Count.ToString());

    public string ImageIndexText
    {
        get
        {
            var visible = VisibleImages();
            int idx = _currentImage == null ? -1 : visible.IndexOf(_currentImage);
            return idx < 0 ? "" : T(K.StatusIndex).Replace("{index}", (idx + 1).ToString()).Replace("{count}", visible.Count.ToString());
        }
    }

    public string ImageSizeText => _bitmap == null ? "" : T(K.StatusSize)
        .Replace("{width}", _bitmap.PixelWidth.ToString()).Replace("{height}", _bitmap.PixelHeight.ToString());

    public string BoxCountText => T(K.StatusBoxes).Replace("{count}", Boxes.Count.ToString());

    public bool ShowLabels => Settings.ShowLabels;

    public bool ShowCrosshair => Settings.ShowCrosshair;

    public double FillOpacity => Settings.FillOpacity;

    public double LineWidth => Settings.LineWidth;

    public double MinBoxSize => Settings.MinBoxSize;

    public bool FitOnOpen => Settings.FitOnOpen;

    public Color ColorOf(string label)
    {
        var cls = Classes.FirstOrDefault(c => c.Name == label);
        return cls?.Color ?? ClassPalette.Unknown;
    }

    /// <summary>Open a session: folders, classes, image list (annotation statistics are scanned in the background).</summary>
    public void Load(AnnotatorSession session)
    {
        var images = Existing(session.ImagesDir) ?? VocAnnotatorConfig.GetLastImagesDir();
        var annotations = Existing(session.AnnotationDir) ?? (session.ImagesDir != null ? images : VocAnnotatorConfig.GetLastSaveDir()) ?? images;
        ProjectDir = Existing(session.ProjectDir) ?? annotations;
        AnnotationDir = annotations;
        ReloadClasses();
        OpenFolder(images, session.StartImage);
    }

    /// <summary>Save or discard pending edits before leaving the image; false = stay (user cancelled or save failed).</summary>
    public bool TryLeaveCurrentImage()
    {
        if (!_isDirty || _currentImage == null) return true;
        if (Settings.AutoSave) return Save();
        var answer = _dialogs.ConfirmSave(T(K.ConfirmUnsaved));
        if (answer == null) return false;
        if (answer == true) return Save();
        IsDirty = false;
        return true;
    }

    public void AddBox(AnnotationBox drawn)
    {
        var label = string.IsNullOrWhiteSpace(CurrentLabel) ? ProjectConfig.DefaultClassName : CurrentLabel.Trim();
        EnsureClass(label);
        Edit(() =>
        {
            Boxes.Add(drawn with { Label = label });
            SelectedBoxIndex = Boxes.Count - 1;
        });
    }

    public void ReplaceBox(int index, AnnotationBox box)
    {
        if (index < 0 || index >= Boxes.Count) return;
        Edit(() => Boxes[index] = box);
        SelectedBoxIndex = index;
    }

    public void Nudge(double dx, double dy, bool fast)
    {
        if (!HasSelection || _bitmap == null) return;
        double step = fast ? NudgeFastStep : NudgeStep;
        var b = Boxes[_selectedBoxIndex];
        dx = Math.Clamp(dx * step, -b.XMin, _bitmap.PixelWidth - b.XMax);
        dy = Math.Clamp(dy * step, -b.YMin, _bitmap.PixelHeight - b.YMax);
        if (dx == 0 && dy == 0) return;
        ReplaceBox(_selectedBoxIndex, b.Offset(dx, dy));
    }

    /// <summary>Hotkey 1-9: relabel the selected box, else pick the class for new boxes.</summary>
    public void PickClassByIndex(int index)
    {
        if (index < 0 || index >= Classes.Count) return;
        if (HasSelection) SetSelectedLabel(Classes[index].Name);
        SelectedClass = Classes[index];
    }

    public void SetSelectedLabel(string label)
    {
        if (!HasSelection || Boxes[_selectedBoxIndex].Label == label) return;
        EnsureClass(label);
        ReplaceBox(_selectedBoxIndex, Boxes[_selectedBoxIndex] with { Label = label });
    }

    public void SetClassColor(AnnotatorClassItem item, Color color)
    {
        if (_projectDir == null) return;
        _project.ClassColors[item.Name] = ClassPalette.ToRgb(color);
        if (!ProjectConfig.SaveToProjectDir(_projectDir, _project))
            _dialogs.ShowMessage(T(K.ClassOperationFailed), true);
        ReloadClasses();
    }

    public void ClearSelection()
    {
        if (IsDrawMode) IsDrawMode = false;
        else SelectedBoxIndex = -1;
    }

    public void Dispose()
    {
        _taskCts?.Cancel();
        _autoLabel.Dispose();
    }

    private static string? Existing(string? dir) => !string.IsNullOrWhiteSpace(dir) && Directory.Exists(dir) ? Path.GetFullPath(dir) : null;

    private void OpenImagesDir()
    {
        var dir = _dialogs.PickFolder(T(K.OpenImagesDir), ImagesDir);
        if (dir == null || !TryLeaveCurrentImage()) return;
        IsDirty = false;
        if (AnnotationDir == null || AnnotationDir == ImagesDir) AnnotationDir = dir;
        if (ProjectDir == null || ProjectDir == ImagesDir) ProjectDir = AnnotationDir;
        ReloadClasses();
        OpenFolder(dir, null);
    }

    private void SetSaveDir()
    {
        var dir = _dialogs.PickFolder(T(K.SetSaveDir), AnnotationDir);
        if (dir == null || !TryLeaveCurrentImage()) return;
        IsDirty = false;
        if (ProjectDir == null || ProjectDir == AnnotationDir) ProjectDir = dir;
        AnnotationDir = dir;
        UpdateSettings(s => s.LastSaveDir = dir);
        ReloadClasses();
        OpenFolder(ImagesDir, _currentImage?.Path);
    }

    private void OpenFolder(string? dir, string? startImage)
    {
        _currentImage = null;
        Bitmap = null;
        Boxes.Clear();
        _history.Reset();
        _labelsByImage.Clear();
        Images.Clear();
        ImagesDir = dir;
        OnPropertyChanged(nameof(CurrentImage));
        if (dir == null)
        {
            RefreshStatus();
            return;
        }
        UpdateSettings(s => s.LastImagesDir = dir);
        IEnumerable<AnnotatorImageItem> items = AnnotationIo.ListImages(dir).Select(p => new AnnotatorImageItem(p, SafeModified(p)));
        items = Settings.ImageSort == AnnotatorSettings.SortByModified ? items.OrderBy(i => i.ModifiedUtc) : items;
        var annotationDir = AnnotationDir ?? dir;
        foreach (var item in items)
        {
            item.IsLabeled = AnnotationIo.HasAnnotation(item.Path, annotationDir);
            Images.Add(item);
        }
        var start = Images.FirstOrDefault(i => string.Equals(i.Path, startImage, StringComparison.OrdinalIgnoreCase))
            ?? VisibleImages().FirstOrDefault();
        CurrentImage = start;
        RefreshStatus();
        _ = ScanAnnotationsAsync(annotationDir);
    }

    private async Task ScanAnnotationsAsync(string annotationDir)
    {
        StatusMessage = T(K.Scanning);
        var snapshot = Images.Select(i => i.Path).ToList();
        var result = await Task.Run(() => snapshot.ToDictionary(p => p, p =>
        {
            var ann = AnnotationIo.Load(p, annotationDir);
            return ann?.Boxes.GroupBy(b => b.Label).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
        }, StringComparer.OrdinalIgnoreCase));
        if (annotationDir != AnnotationDir) return;
        foreach (var item in Images)
        {
            if (!result.TryGetValue(item.Path, out var labels) || labels == null) continue;
            if (ReferenceEquals(item, _currentImage) && _isDirty) continue;
            _labelsByImage[item.Path] = labels;
            item.BoxCount = labels.Values.Sum();
        }
        var unknown = _labelsByImage.Values.SelectMany(l => l.Keys).Distinct()
            .Where(l => l.Length > 0 && !_project.Classes.Contains(l, StringComparer.Ordinal)).ToList();
        if (unknown.Count > 0 && _projectDir != null)
        {
            foreach (var l in unknown) ProjectConfig.EnsureClassInProjectDir(_projectDir, l);
            ReloadClasses();
            StatusMessage = T(K.StatusClassesAdded).Replace("{count}", unknown.Count.ToString());
        }
        else
        {
            StatusMessage = "";
        }
        UpdateClassCounts();
    }

    private void LoadCurrentImage()
    {
        IsDrawMode = IsDrawMode && _currentImage != null;
        _history.Reset();
        Boxes.Clear();
        SelectedBoxIndex = -1;
        IsDirty = false;
        Bitmap = null;
        if (_currentImage is not { } item)
        {
            RefreshStatus();
            return;
        }
        try
        {
            var bmp = new BitmapImage();
            bmp.BeginInit();
            bmp.CacheOption = BitmapCacheOption.OnLoad;
            bmp.CreateOptions = BitmapCreateOptions.IgnoreColorProfile;
            bmp.UriSource = new Uri(item.Path, UriKind.Absolute);
            bmp.EndInit();
            bmp.Freeze();
            Bitmap = bmp;
        }
        catch (Exception ex) when (ex is IOException or NotSupportedException or UnauthorizedAccessException or ArgumentException or InvalidOperationException)
        {
            StatusMessage = T(K.LoadFailed) + ex.Message;
            RefreshStatus();
            return;
        }
        var ann = AnnotationDir == null ? null : AnnotationIo.Load(item.Path, AnnotationDir);
        foreach (var b in ann?.Boxes ?? new List<AnnotationBox>()) Boxes.Add(b);
        if (ann == null && Settings.CopyPreviousWhenEmpty) CopyFromPrevious(showMessage: false);
        RefreshStatus();
        if (ann == null && Settings.AutoLabelOnOpen && !IsBusy) _ = AutoLabelCurrentAsync();
    }

    private bool Save()
    {
        if (_currentImage is not { } item || _bitmap == null) return true;
        if (AnnotationDir == null)
        {
            _dialogs.ShowMessage(T(K.SaveNeedDir), true);
            return false;
        }
        var boxes = Boxes.Select(b => b.ClampTo(_bitmap.PixelWidth, _bitmap.PixelHeight)).Where(b => b.IsValid(1)).ToList();
        foreach (var label in boxes.Select(b => b.Label).Distinct()) EnsureClass(label);
        try
        {
            AnnotationIo.Save(new ImageAnnotation(item.Path, _bitmap.PixelWidth, _bitmap.PixelHeight, boxes), AnnotationDir,
                new AnnotationSaveOptions(Settings.WriteVocXml, Settings.WriteYoloTxt, _project.Classes));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _dialogs.ShowMessage(T(K.SaveFailed) + ex.Message, true);
            return false;
        }
        item.IsLabeled = true;
        item.BoxCount = boxes.Count;
        _labelsByImage[item.Path] = boxes.GroupBy(b => b.Label).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
        IsDirty = false;
        StatusMessage = T(K.StatusSaved).Replace("{file}", item.FileName);
        UpdateClassCounts();
        RefreshStatus();
        return true;
    }

    private void Edit(Action change)
    {
        _history.Push(Boxes);
        change();
        IsDirty = true;
        RefreshStatus();
    }

    private void SetBoxes(IEnumerable<AnnotationBox> boxes)
    {
        Boxes.Clear();
        foreach (var b in boxes) Boxes.Add(b);
        SelectedBoxIndex = -1;
        IsDirty = true;
        RefreshStatus();
    }

    private void Undo()
    {
        if (_history.Undo(Boxes) is { } prev) SetBoxes(prev);
    }

    private void Redo()
    {
        if (_history.Redo(Boxes) is { } next) SetBoxes(next);
    }

    private void DeleteSelected()
    {
        if (!HasSelection) return;
        int idx = _selectedBoxIndex;
        Edit(() => Boxes.RemoveAt(idx));
        SelectedBoxIndex = Math.Min(idx, Boxes.Count - 1);
    }

    private void DuplicateSelected()
    {
        if (!HasSelection || _bitmap == null) return;
        var b = Boxes[_selectedBoxIndex];
        double dx = Math.Min(DuplicateOffset, _bitmap.PixelWidth - b.XMax), dy = Math.Min(DuplicateOffset, _bitmap.PixelHeight - b.YMax);
        Edit(() => Boxes.Add(b.Offset(dx, dy)));
        SelectedBoxIndex = Boxes.Count - 1;
    }

    private void CopyBoxes() => _clipboard = HasSelection ? new List<AnnotationBox> { Boxes[_selectedBoxIndex] } : Boxes.ToList();

    private void PasteBoxes()
    {
        if (_bitmap == null || _clipboard.Count == 0) return;
        var pasted = _clipboard.Select(b => b.ClampTo(_bitmap.PixelWidth, _bitmap.PixelHeight)).Where(b => b.IsValid(1)).ToList();
        Edit(() => { foreach (var b in pasted) Boxes.Add(b); });
        SelectedBoxIndex = Boxes.Count - 1;
    }

    private void CopyFromPrevious(bool showMessage)
    {
        if (_currentImage == null || AnnotationDir == null || _bitmap == null) return;
        int idx = Images.IndexOf(_currentImage);
        var previous = idx > 0 ? AnnotationIo.Load(Images[idx - 1].Path, AnnotationDir) : null;
        if (previous == null || previous.Boxes.Count == 0)
        {
            if (showMessage) StatusMessage = T(K.NoPrevious);
            return;
        }
        var boxes = previous.Boxes.Select(b => b.ClampTo(_bitmap.PixelWidth, _bitmap.PixelHeight)).Where(b => b.IsValid(1)).ToList();
        Edit(() => { foreach (var b in boxes) Boxes.Add(b); });
        StatusMessage = T(K.CopiedPrevious).Replace("{count}", boxes.Count.ToString());
    }

    private void ClearBoxes()
    {
        if (Boxes.Count == 0 || !_dialogs.Confirm(T(K.ConfirmClear).Replace("{count}", Boxes.Count.ToString()))) return;
        Edit(Boxes.Clear);
        SelectedBoxIndex = -1;
    }

    private void ResetAnnotation()
    {
        if (_currentImage is not { } item || AnnotationDir == null || !_dialogs.Confirm(T(K.ConfirmReset))) return;
        AnnotationIo.Delete(item.Path, AnnotationDir);
        item.IsLabeled = false;
        item.BoxCount = 0;
        _labelsByImage.Remove(item.Path);
        UpdateClassCounts();
        LoadCurrentImage();
    }

    private void ToggleDifficult()
    {
        if (!HasSelection) return;
        var b = Boxes[_selectedBoxIndex];
        ReplaceBox(_selectedBoxIndex, b with { Difficult = !b.Difficult });
        OnPropertyChanged(nameof(SelectedBoxDifficult));
    }

    private void Step(int delta)
    {
        var visible = VisibleImages();
        if (visible.Count == 0) return;
        int idx = _currentImage == null ? -1 : visible.IndexOf(_currentImage);
        int next = idx < 0 ? 0 : Math.Clamp(idx + delta, 0, visible.Count - 1);
        if (next != idx) CurrentImage = visible[next];
    }

    private void NextUnlabeled()
    {
        int start = _currentImage == null ? -1 : Images.IndexOf(_currentImage);
        for (int k = 1; k <= Images.Count; k++)
        {
            var item = Images[(start + k + Images.Count) % Images.Count];
            if (item.IsLabeled || ReferenceEquals(item, _currentImage)) continue;
            if (!PassesFilter(item))
            {
                _filter = AnnotatorSettings.FilterAll;
                OnPropertyChanged(nameof(Filter));
                ImagesView.Refresh();
            }
            CurrentImage = item;
            return;
        }
    }

    private async Task AutoLabelCurrentAsync()
    {
        if (_currentImage is not { } item || _bitmap == null) return;
        var model = AutoLabelService.ResolveModel(Settings.AutoLabelModelPath, ProjectDir);
        if (model == null)
        {
            _dialogs.ShowMessage(T(K.AutoLabelNoModel), true);
            return;
        }
        IsBusy = true;
        TaskText = T(K.AutoLabel);
        try
        {
            var detected = await Task.Run(() => _autoLabel.Detect(model, item.Path, Settings.AutoLabelConfidence, Settings.AutoLabelIou));
            if (!ReferenceEquals(item, _currentImage)) return;
            var mapped = MapDetections(detected, out int dropped);
            var merged = AutoLabelService.Merge(Boxes.ToList(), mapped, Settings.AutoLabelMode);
            int added = merged.Count - merged.Intersect(Boxes).Count();
            Edit(() =>
            {
                Boxes.Clear();
                foreach (var b in merged) Boxes.Add(b);
            });
            StatusMessage = T(K.AutoLabelDone).Replace("{count}", added.ToString())
                + (dropped > 0 ? " " + T(K.AutoLabelDropped).Replace("{count}", dropped.ToString()) : "");
        }
        catch (Exception ex) when (ex is IOException or InvalidOperationException or Microsoft.ML.OnnxRuntime.OnnxRuntimeException or OpenCvSharp.OpenCVException)
        {
            _dialogs.ShowMessage(T(K.AutoLabelFailed) + ex.Message, true);
        }
        finally
        {
            IsBusy = false;
            TaskText = "";
        }
    }

    private async Task AutoLabelAllAsync()
    {
        var annotationDir = AnnotationDir;
        if (annotationDir == null || !TryLeaveCurrentImage()) return;
        var model = AutoLabelService.ResolveModel(Settings.AutoLabelModelPath, ProjectDir);
        if (model == null)
        {
            _dialogs.ShowMessage(T(K.AutoLabelNoModel), true);
            return;
        }
        var targets = Images.Where(i => !i.IsLabeled).ToList();
        _taskCts = new CancellationTokenSource();
        var ct = _taskCts.Token;
        IsBusy = true;
        int done = 0, boxesTotal = 0, droppedTotal = 0;
        try
        {
            foreach (var item in targets)
            {
                ct.ThrowIfCancellationRequested();
                TaskText = T(K.AutoLabelRunning).Replace("{done}", done.ToString()).Replace("{total}", targets.Count.ToString());
                var detected = await Task.Run(() => _autoLabel.Detect(model, item.Path, Settings.AutoLabelConfidence, Settings.AutoLabelIou), ct);
                var mapped = MapDetections(detected, out int dropped);
                droppedTotal += dropped;
                var size = ImageHeaderReader.ReadSize(item.Path);
                done++;
                if (mapped.Count == 0 || size == null) continue;
                var (w, h) = size.Value;
                var boxes = mapped.Select(b => b.ClampTo(w, h)).Where(b => b.IsValid(1)).ToList();
                AnnotationIo.Save(new ImageAnnotation(item.Path, w, h, boxes), annotationDir,
                    new AnnotationSaveOptions(Settings.WriteVocXml, Settings.WriteYoloTxt, _project.Classes));
                item.IsLabeled = true;
                item.BoxCount = boxes.Count;
                _labelsByImage[item.Path] = boxes.GroupBy(b => b.Label).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
                boxesTotal += boxes.Count;
            }
            StatusMessage = T(K.AutoLabelAllDone).Replace("{images}", done.ToString()).Replace("{boxes}", boxesTotal.ToString())
                + (droppedTotal > 0 ? " " + T(K.AutoLabelDropped).Replace("{count}", droppedTotal.ToString()) : "");
        }
        catch (OperationCanceledException)
        {
            StatusMessage = T(K.Cancelled);
        }
        catch (Exception ex) when (ex is IOException or InvalidOperationException or Microsoft.ML.OnnxRuntime.OnnxRuntimeException or OpenCvSharp.OpenCVException)
        {
            _dialogs.ShowMessage(T(K.AutoLabelFailed) + ex.Message, true);
        }
        finally
        {
            IsBusy = false;
            TaskText = "";
            _taskCts.Dispose();
            _taskCts = null;
            UpdateClassCounts();
            LoadCurrentImage();
        }
    }

    /// <summary>Keep detections of project classes; unknown model classes are added (setting) or dropped.</summary>
    private List<AnnotationBox> MapDetections(IReadOnlyList<AnnotationBox> detected, out int dropped)
    {
        var result = new List<AnnotationBox>();
        dropped = 0;
        foreach (var d in detected)
        {
            if (_project.Classes.Contains(d.Label, StringComparer.Ordinal)) result.Add(d);
            else if (Settings.AutoLabelAddClasses && d.Label.Length > 0)
            {
                EnsureClass(d.Label);
                result.Add(d);
            }
            else dropped++;
        }
        return result;
    }

    private void EnsureClass(string label)
    {
        if (label.Length == 0 || _project.Classes.Contains(label, StringComparer.Ordinal)) return;
        if (_projectDir != null) ProjectConfig.EnsureClassInProjectDir(_projectDir, label);
        else _project.Classes.Add(label);
        ReloadClasses();
    }

    private void AddClass()
    {
        if (_projectDir == null) return;
        var name = _dialogs.Prompt(T(K.ClassAddTitle), T(K.ClassNamePrompt), "")?.Trim();
        if (string.IsNullOrEmpty(name)) return;
        if (_project.Classes.Contains(name, StringComparer.Ordinal))
        {
            _dialogs.ShowMessage(T(K.ClassExists).Replace("{name}", name), false);
            return;
        }
        ProjectConfig.EnsureClassInProjectDir(_projectDir, name);
        ReloadClasses();
        SelectedClass = Classes.FirstOrDefault(c => c.Name == name);
    }

    private void RenameClass()
    {
        if (_projectDir == null || SelectedClass is not { } cls) return;
        var name = _dialogs.Prompt(T(K.ClassRenameTitle), T(K.ClassNamePrompt), cls.Name)?.Trim();
        if (string.IsNullOrEmpty(name) || name == cls.Name) return;
        if (_project.Classes.Contains(name, StringComparer.Ordinal))
        {
            _dialogs.ShowMessage(T(K.ClassExists).Replace("{name}", name), false);
            return;
        }
        if (!TryLeaveCurrentImage()) return;
        int changed = ProjectConfig.RenameClass(_projectDir, cls.Name, name);
        AfterProjectWideChange(changed, K.ClassRenamed, name);
    }

    private void DeleteClass()
    {
        if (_projectDir == null || SelectedClass is not { } cls) return;
        int used = AnnotationIo.CountLabels(_projectDir, recursive: true).GetValueOrDefault(cls.Name);
        if (!_dialogs.Confirm(T(K.ConfirmDeleteClass).Replace("{name}", cls.Name).Replace("{count}", used.ToString()))) return;
        if (!TryLeaveCurrentImage()) return;
        int removed = ProjectConfig.RemoveClass(_projectDir, cls.Name);
        AfterProjectWideChange(removed, K.ClassDeleted, null);
    }

    private void AfterProjectWideChange(int count, string messageKey, string? select)
    {
        if (count < 0)
        {
            _dialogs.ShowMessage(T(K.ClassOperationFailed), true);
            return;
        }
        ColorPrinter.Blue($"{LogTag} {messageKey} count={count}");
        StatusMessage = T(messageKey).Replace("{count}", count.ToString());
        ReloadClasses();
        if (select != null) SelectedClass = Classes.FirstOrDefault(c => c.Name == select);
        LoadCurrentImage();
        if (AnnotationDir != null) _ = ScanAnnotationsAsync(AnnotationDir);
    }

    private void MoveClass(int delta)
    {
        if (_projectDir == null || SelectedClass is not { } cls) return;
        int from = _project.Classes.IndexOf(cls.Name), to = from + delta;
        if (from < 0 || to < 0 || to >= _project.Classes.Count) return;
        (_project.Classes[from], _project.Classes[to]) = (_project.Classes[to], _project.Classes[from]);
        if (!ProjectConfig.SaveToProjectDir(_projectDir, _project)) _dialogs.ShowMessage(T(K.ClassOperationFailed), true);
        ReloadClasses();
        SelectedClass = Classes.FirstOrDefault(c => c.Name == cls.Name);
    }

    private void ReloadClasses()
    {
        var selected = SelectedClass?.Name ?? CurrentLabel;
        _project = ProjectConfig.LoadFromProjectDir(_projectDir);
        Classes.Clear();
        for (int i = 0; i < _project.Classes.Count; i++)
            Classes.Add(new AnnotatorClassItem(_project.Classes[i], i, ClassPalette.For(i, _project.ClassColors, _project.Classes[i])));
        _selectedClass = Classes.FirstOrDefault(c => c.Name == selected) ?? Classes.FirstOrDefault();
        OnPropertyChanged(nameof(SelectedClass));
        if (_selectedClass != null) CurrentLabel = _selectedClass.Name;
        OnPropertyChanged(nameof(ClassNames));
        UpdateClassCounts();
        RebuildBoxItems();
        ColorsChanged?.Invoke(this, EventArgs.Empty);
    }

    private void UpdateClassCounts()
    {
        var totals = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var (path, labels) in _labelsByImage)
        {
            if (_currentImage != null && string.Equals(path, _currentImage.Path, StringComparison.OrdinalIgnoreCase) && _isDirty) continue;
            foreach (var (label, n) in labels) totals[label] = totals.GetValueOrDefault(label) + n;
        }
        foreach (var c in Classes) c.Count = totals.GetValueOrDefault(c.Name);
        OnPropertyChanged(nameof(ProgressText));
    }

    private void RebuildBoxItems()
    {
        BoxItems.Clear();
        for (int i = 0; i < Boxes.Count; i++)
            BoxItems.Add(new AnnotatorBoxItem(i, Boxes[i], ClassPalette.Freeze(new SolidColorBrush(ColorOf(Boxes[i].Label)))));
        OnPropertyChanged(nameof(SelectedBoxItem));
        OnPropertyChanged(nameof(SelectedBoxLabel));
        OnPropertyChanged(nameof(SelectedBoxDifficult));
        OnPropertyChanged(nameof(HasSelection));
        OnPropertyChanged(nameof(BoxCountText));
    }

    private void EditSettings()
    {
        var edited = _dialogs.EditSettings(Settings.Clone());
        if (edited == null) return;
        bool resort = edited.ImageSort != Settings.ImageSort;
        UpdateSettings(s =>
        {
            s.AutoSave = edited.AutoSave;
            s.CopyPreviousWhenEmpty = edited.CopyPreviousWhenEmpty;
            s.MinBoxSize = edited.MinBoxSize;
            s.ShowLabels = edited.ShowLabels;
            s.ShowCrosshair = edited.ShowCrosshair;
            s.FillOpacity = edited.FillOpacity;
            s.LineWidth = edited.LineWidth;
            s.FitOnOpen = edited.FitOnOpen;
            s.ImageSort = edited.ImageSort;
            s.WriteVocXml = edited.WriteVocXml;
            s.WriteYoloTxt = edited.WriteYoloTxt;
            s.AutoLabelModelPath = edited.AutoLabelModelPath;
            s.AutoLabelConfidence = edited.AutoLabelConfidence;
            s.AutoLabelIou = edited.AutoLabelIou;
            s.AutoLabelMode = edited.AutoLabelMode;
            s.AutoLabelAddClasses = edited.AutoLabelAddClasses;
            s.AutoLabelOnOpen = edited.AutoLabelOnOpen;
        });
        if (resort && TryLeaveCurrentImage()) OpenFolder(ImagesDir, _currentImage?.Path);
    }

    private void UpdateSettings(Action<AnnotatorSettings> change)
    {
        var s = Settings.Clone();
        change(s);
        Settings = s.Normalized();
        VocAnnotatorConfig.Save(Settings);
        foreach (var name in new[] { nameof(ShowLabels), nameof(ShowCrosshair), nameof(FillOpacity), nameof(LineWidth), nameof(MinBoxSize), nameof(FitOnOpen) })
            OnPropertyChanged(name);
    }

    private bool PassesFilter(AnnotatorImageItem item)
    {
        if (_searchText.Length > 0 && item.FileName.IndexOf(_searchText, StringComparison.OrdinalIgnoreCase) < 0) return false;
        return _filter switch
        {
            AnnotatorSettings.FilterLabeled => item.IsLabeled,
            AnnotatorSettings.FilterUnlabeled => !item.IsLabeled || ReferenceEquals(item, _currentImage),
            _ => true,
        };
    }

    private List<AnnotatorImageItem> VisibleImages() => ImagesView.Cast<AnnotatorImageItem>().ToList();

    private void RefreshStatus()
    {
        OnPropertyChanged(nameof(ImageIndexText));
        OnPropertyChanged(nameof(ImageSizeText));
        OnPropertyChanged(nameof(BoxCountText));
        OnPropertyChanged(nameof(ProgressText));
        OnPropertyChanged(nameof(HasImage));
        CommandManager.InvalidateRequerySuggested();
    }

    private static DateTime SafeModified(string path)
    {
        try { return File.GetLastWriteTimeUtc(path); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { return DateTime.MinValue; }
    }

    /// <summary>Texts bound in XAML refresh after a language switch.</summary>
    public void RefreshTexts()
    {
        OnPropertyChanged(nameof(ProgressText));
        OnPropertyChanged(nameof(DirtyText));
        RefreshStatus();
    }
}
