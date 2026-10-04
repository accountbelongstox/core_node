using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;
using DotCore.Common;
using DotCore.VocAnnotator;
using static DotCore.VocAnnotatorUI.AnnotatorI18n;
using K = DotCore.VocAnnotatorUI.AnnotatorI18nKeys;

namespace DotCore.VocAnnotatorUI;

/// <summary>Full annotator UI hosted by AnnotatorWindow (or any window). Keyboard shortcuts are listed in ui.voc_annotator.help_text.</summary>
public partial class AnnotatorView : UserControl, IAnnotatorDialogs
{
    private const double ZoomStep = 1.25;
    private const double SwatchSize = 14;

    private readonly AnnotatorSession _session;
    private bool _loaded;

    public AnnotatorView(AnnotatorSession session)
    {
        _session = session;
        InitializeComponent();
        ViewModel = new AnnotatorViewModel(this);
        DataContext = ViewModel;
        Canvas.LabelColor = ViewModel.ColorOf;
        Canvas.BoxDrawn += (_, box) => ViewModel.AddBox(box);
        Canvas.BoxEdited += (_, e) => ViewModel.ReplaceBox(e.Index, e.Box);
        Canvas.ViewChanged += (_, _) => TxtZoom.Text = T(K.StatusZoom).Replace("{zoom}", Math.Round(Canvas.Zoom * 100).ToString(CultureInfo.InvariantCulture));
        Canvas.PointerMoved += (_, p) => TxtCursor.Text = p is { } pt
            ? T(K.StatusCursor).Replace("{x}", ((int)pt.X).ToString(CultureInfo.InvariantCulture)).Replace("{y}", ((int)pt.Y).ToString(CultureInfo.InvariantCulture))
            : "";
        ViewModel.ColorsChanged += (_, _) => Canvas.Refresh();
        ViewModel.SelectionRevealRequested += (_, _) =>
        {
            if (ViewModel.HasSelection) Canvas.BringIntoView(ViewModel.Boxes[ViewModel.SelectedBoxIndex]);
        };
        ViewModel.PropertyChanged += (_, e) =>
        {
            if (e.PropertyName is nameof(AnnotatorViewModel.IsDrawMode)) UpdateDrawButton();
            if (e.PropertyName is nameof(AnnotatorViewModel.HasImage)) TxtNoImage.Visibility = ViewModel.HasImage ? Visibility.Collapsed : Visibility.Visible;
            if (e.PropertyName is nameof(AnnotatorViewModel.CurrentImage) && LstImages.SelectedItem != null) LstImages.ScrollIntoView(LstImages.SelectedItem);
        };
        PreviewKeyDown += OnPreviewKeyDown;
        PreviewKeyUp += OnPreviewKeyUp;
        Loaded += OnLoaded;
        Unloaded += (_, _) => Provider.LanguageChanged -= OnLanguageChanged;
    }

    public AnnotatorViewModel ViewModel { get; }

    /// <summary>Save or confirm pending edits; false keeps the window open.</summary>
    public bool TryClose()
    {
        if (!ViewModel.TryLeaveCurrentImage()) return false;
        ViewModel.Dispose();
        return true;
    }

    bool IAnnotatorDialogs.Confirm(string message) =>
        MessageBox.Show(Owner(), message, T(K.ConfirmTitle), MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes;

    bool? IAnnotatorDialogs.ConfirmSave(string message) =>
        MessageBox.Show(Owner(), message, T(K.ConfirmTitle), MessageBoxButton.YesNoCancel, MessageBoxImage.Question) switch
        {
            MessageBoxResult.Yes => true,
            MessageBoxResult.No => false,
            _ => null,
        };

    string? IAnnotatorDialogs.Prompt(string title, string label, string initial) => AnnotatorInputDialog.Ask(Owner(), title, label, initial);

    string? IAnnotatorDialogs.PickFolder(string title, string? initial)
    {
        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = title };
        if (!string.IsNullOrWhiteSpace(initial) && System.IO.Directory.Exists(initial)) dlg.InitialDirectory = initial;
        return dlg.ShowDialog(Owner()) == true ? dlg.FolderName : null;
    }

    AnnotatorSettings? IAnnotatorDialogs.EditSettings(AnnotatorSettings current)
    {
        var dlg = new AnnotatorSettingsWindow(current) { Owner = Owner() };
        return dlg.ShowDialog() == true ? dlg.Result : null;
    }

    void IAnnotatorDialogs.ShowMessage(string message, bool isError) =>
        MessageBox.Show(Owner(), message, T(isError ? K.ErrorTitle : K.WarningTitle), MessageBoxButton.OK, isError ? MessageBoxImage.Error : MessageBoxImage.Information);

    void IAnnotatorDialogs.ShowHelp(string title, string text) =>
        MessageBox.Show(Owner(), text, title, MessageBoxButton.OK, MessageBoxImage.Information);

    private Window? Owner() => Window.GetWindow(this);

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        Provider.LanguageChanged += OnLanguageChanged;
        if (_loaded) return;
        _loaded = true;
        ApplyTexts();
        ViewModel.Load(_session);
        TxtNoImage.Visibility = ViewModel.HasImage ? Visibility.Collapsed : Visibility.Visible;
        UpdateDrawButton();
        Focus();
    }

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e) => Dispatcher.InvokeAsync(() =>
    {
        ApplyTexts();
        ViewModel.RefreshTexts();
    });

    private void ApplyTexts()
    {
        void Tip(FrameworkElement el, string key) => el.ToolTip = T(key);
        Tip(BtnOpenDir, K.OpenImagesDir);
        Tip(BtnSaveDir, K.SetSaveDir);
        Tip(BtnSave, K.Save);
        Tip(BtnPrev, K.PrevImage);
        Tip(BtnNext, K.NextImage);
        Tip(BtnNextUnlabeled, K.NextUnlabeled);
        Tip(BtnDraw, K.DrawMode);
        Tip(BtnDelete, K.DeleteBox);
        Tip(BtnDuplicate, K.DuplicateBox);
        Tip(BtnCopyPrevious, K.CopyPrevious);
        Tip(BtnUndo, K.Undo);
        Tip(BtnRedo, K.Redo);
        Tip(BtnClear, K.ClearBoxes);
        Tip(BtnReset, K.ResetAnnotation);
        Tip(BtnAutoLabel, K.AutoLabel);
        Tip(BtnAutoLabelAll, K.AutoLabelAll);
        Tip(BtnCancelTask, K.CancelTask);
        Tip(BtnFit, K.ZoomFit);
        Tip(BtnActual, K.ZoomActual);
        Tip(BtnZoomIn, K.ZoomIn);
        Tip(BtnZoomOut, K.ZoomOut);
        Tip(BtnLabels, K.ToggleLabels);
        Tip(BtnSettings, K.Settings);
        Tip(BtnHelp, K.Help);
        Tip(BtnClassAdd, K.ClassAdd);
        Tip(BtnClassRename, K.ClassRename);
        Tip(BtnClassDelete, K.ClassDelete);
        Tip(BtnClassColor, K.ClassColor);
        Tip(BtnClassUp, K.ClassUp);
        Tip(BtnClassDown, K.ClassDown);
        Tip(BtnBoxDelete, K.DeleteBox);
        LblImages.Text = T(K.Images);
        LblClasses.Text = T(K.Classes);
        LblCurrentClass.Text = T(K.CurrentClass);
        LblBoxes.Text = T(K.Boxes);
        LblBoxClass.Text = T(K.BoxClass);
        ChkDifficult.Content = T(K.BoxDifficult);
        TxtNoImage.Text = T(K.NoImage);
        TxtSearch.SetValue(DotCore.UITheme.ControlAssist.PlaceholderProperty, T(K.SearchPlaceholder));
        MiSetClass.Header = T(K.MenuSetClass);
        MiDifficult.Header = T(K.MenuDifficult);
        MiDuplicate.Header = T(K.MenuDuplicate);
        MiDelete.Header = T(K.MenuDelete);
        var filters = new[] { K.FilterAll, K.FilterLabeled, K.FilterUnlabeled };
        int selected = Math.Max(0, AnnotatorSettings.FilterModes.ToList().IndexOf(ViewModel.Filter));
        CboFilter.ItemsSource = filters.Select(T).ToList();
        CboFilter.SelectedIndex = selected;
    }

    private void UpdateDrawButton() =>
        BtnDraw.SetResourceReference(ForegroundProperty, ViewModel.IsDrawMode ? "AccentTextBrush" : "TextPrimaryBrush");

    private void CboFilter_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (CboFilter.SelectedIndex >= 0 && CboFilter.SelectedIndex < AnnotatorSettings.FilterModes.Count)
            ViewModel.Filter = AnnotatorSettings.FilterModes[CboFilter.SelectedIndex];
    }

    private void BtnFit_Click(object sender, RoutedEventArgs e) => Canvas.FitToView();

    private void BtnActual_Click(object sender, RoutedEventArgs e) => Canvas.SetZoom(1);

    private void BtnZoomIn_Click(object sender, RoutedEventArgs e) => Canvas.ZoomBy(ZoomStep);

    private void BtnZoomOut_Click(object sender, RoutedEventArgs e) => Canvas.ZoomBy(1 / ZoomStep);

    private void BtnClassColor_Click(object sender, RoutedEventArgs e)
    {
        if (ViewModel.SelectedClass is not { } cls) return;
        var menu = new ContextMenu { PlacementTarget = BtnClassColor };
        foreach (var color in ClassPalette.Colors)
        {
            var item = new MenuItem
            {
                Header = $"#{color.R:X2}{color.G:X2}{color.B:X2}",
                Icon = new Rectangle { Width = SwatchSize, Height = SwatchSize, Fill = ClassPalette.Freeze(new SolidColorBrush(color)) },
                IsChecked = color == cls.Color,
            };
            item.Click += (_, _) => ViewModel.SetClassColor(cls, color);
            menu.Items.Add(item);
        }
        menu.IsOpen = true;
    }

    private void CanvasMenu_Opened(object sender, RoutedEventArgs e)
    {
        MiSetClass.Items.Clear();
        bool has = ViewModel.HasSelection;
        MiSetClass.IsEnabled = has;
        MiDifficult.IsEnabled = has;
        MiDifficult.IsChecked = ViewModel.SelectedBoxDifficult;
        foreach (var cls in ViewModel.Classes)
        {
            var item = new MenuItem
            {
                Header = string.IsNullOrEmpty(cls.Hotkey) ? cls.Name : $"{cls.Hotkey}  {cls.Name}",
                Icon = new Rectangle { Width = SwatchSize, Height = SwatchSize, Fill = cls.Brush },
                IsChecked = cls.Name == ViewModel.SelectedBoxLabel,
            };
            var name = cls.Name;
            item.Click += (_, _) => ViewModel.SetSelectedLabel(name);
            MiSetClass.Items.Add(item);
        }
    }

    private void MiDifficult_Click(object sender, RoutedEventArgs e) => ViewModel.ToggleDifficultCommand.Execute(null);

    private void OnPreviewKeyUp(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Space) Canvas.PanKeyDown = false;
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        var mods = Keyboard.Modifiers;
        bool ctrl = (mods & ModifierKeys.Control) != 0, shift = (mods & ModifierKeys.Shift) != 0;
        if (ctrl && e.Key == Key.S) { Run(ViewModel.SaveCommand, e); return; }
        if (Keyboard.FocusedElement is TextBox) return;
        var vm = ViewModel;
        switch (e.Key)
        {
            case Key.Z when ctrl && shift:
            case Key.Y when ctrl: Run(vm.RedoCommand, e); return;
            case Key.Z when ctrl: Run(vm.UndoCommand, e); return;
            case Key.V when ctrl && shift: Run(vm.CopyPreviousCommand, e); return;
            case Key.V when ctrl: Run(vm.PasteBoxesCommand, e); return;
            case Key.C when ctrl: Run(vm.CopyBoxesCommand, e); return;
            case Key.D when ctrl: Run(vm.DuplicateBoxCommand, e); return;
            case Key.L when ctrl: Run(vm.AutoLabelCommand, e); return;
            case Key.D1 when ctrl:
            case Key.NumPad1 when ctrl: Canvas.SetZoom(1); e.Handled = true; return;
        }
        if (ctrl) return;
        switch (e.Key)
        {
            case Key.A: Run(vm.PrevImageCommand, e); return;
            case Key.D: Run(vm.NextImageCommand, e); return;
            case Key.N: Run(vm.NextUnlabeledCommand, e); return;
            case Key.W: Run(vm.ToggleDrawModeCommand, e); return;
            case Key.E: Run(vm.ToggleDifficultCommand, e); return;
            case Key.H: Run(vm.ToggleLabelsCommand, e); return;
            case Key.F: Canvas.FitToView(); e.Handled = true; return;
            case Key.F1: Run(vm.HelpCommand, e); return;
            case Key.Delete:
            case Key.Back: Run(vm.DeleteBoxCommand, e); return;
            case Key.Escape: vm.ClearSelection(); e.Handled = true; return;
            case Key.OemPlus:
            case Key.Add: Canvas.ZoomBy(ZoomStep); e.Handled = true; return;
            case Key.OemMinus:
            case Key.Subtract: Canvas.ZoomBy(1 / ZoomStep); e.Handled = true; return;
            case Key.Space:
                if (Keyboard.FocusedElement is ButtonBase or ListBoxItem or ComboBox or CheckBox) return;
                Canvas.PanKeyDown = true;
                e.Handled = true;
                return;
            case Key.Left: Arrow(-1, 0, vm.PrevImageCommand, shift, e); return;
            case Key.Right: Arrow(1, 0, vm.NextImageCommand, shift, e); return;
            case Key.Up: if (vm.HasSelection) { vm.Nudge(0, -1, shift); e.Handled = true; } return;
            case Key.Down: if (vm.HasSelection) { vm.Nudge(0, 1, shift); e.Handled = true; } return;
        }
        int digit = e.Key is >= Key.D1 and <= Key.D9 ? e.Key - Key.D1 : e.Key is >= Key.NumPad1 and <= Key.NumPad9 ? e.Key - Key.NumPad1 : -1;
        if (digit >= 0)
        {
            vm.PickClassByIndex(digit);
            e.Handled = true;
        }
    }

    private void Arrow(int dx, int dy, ICommand navigate, bool shift, KeyEventArgs e)
    {
        if (Keyboard.FocusedElement is ListBoxItem or ListBox && !ViewModel.HasSelection) return;
        if (ViewModel.HasSelection) ViewModel.Nudge(dx, dy, shift);
        else navigate.Execute(null);
        e.Handled = true;
    }

    private static void Run(ICommand command, KeyEventArgs e)
    {
        if (command.CanExecute(null)) command.Execute(null);
        e.Handled = true;
    }
}
