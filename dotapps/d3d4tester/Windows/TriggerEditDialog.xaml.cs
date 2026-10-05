// PY-REF: none (DOT-only)
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Monitor;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services.Monitor;
using Microsoft.Win32;

namespace DotApps.d3d4tester.Windows;

/// <summary>Create / edit one trigger (RBAssist trigger window: CREATEEVENTCONTROLS / CREATEACTIONCONTROLS / SAVETRIGGER).</summary>
public partial class TriggerEditDialog : Window
{
    private readonly ArgSlot[] _eventSlots;
    private readonly ArgSlot[] _actionSlots;
    private bool _loading;

    /// <summary>The edited trigger after Save (DialogResult true).</summary>
    public TriggerDefinition Result { get; private set; }

    public TriggerEditDialog(TriggerDefinition? source)
    {
        InitializeComponent();
        Result = source?.Clone() ?? new TriggerDefinition();
        _eventSlots = new[] { new ArgSlot(RowE1, LblE1, TxtE1, CmbE1, BtnE1), new ArgSlot(RowE2, LblE2, TxtE2, CmbE2, BtnE2) };
        _actionSlots = new[] { new ArgSlot(RowA1, LblA1, TxtA1, CmbA1, BtnA1), new ArgSlot(RowA2, LblA2, TxtA2, CmbA2, BtnA2) };
        foreach (var slot in _eventSlots.Concat(_actionSlots))
            slot.Browse.Click += (_, _) => BrowseFor(slot);
        var p = D3D4TesterI18n.Provider;
        Title = p.GetUiText(I18nKeys.MonitorEditorTitle);
        TxtHeader.Text = Title;
        LblEvent.Text = p.GetUiText(I18nKeys.MonitorEditorEvent);
        LblAction.Text = p.GetUiText(I18nKeys.MonitorEditorAction);
        ChkEnabled.Content = p.GetUiText(I18nKeys.MonitorEditorEnabled);
        ChkLog.Content = p.GetUiText(I18nKeys.MonitorEditorLog);
        BtnSave.Content = p.GetUiText(I18nKeys.MonitorSave);
        BtnCancel.Content = p.GetUiText(I18nKeys.MonitorCancel);
        TxtEventNoOptions.Text = TxtActionNoOptions.Text = p.GetUiText(I18nKeys.MonitorNoOptions);

        _loading = true;
        ComboEvent.ItemsSource = MonitorEvents.All.Select(id => new Choice(id, TriggerCatalog.EventName(id))).ToList();
        ComboAction.ItemsSource = MonitorActions.All.Select(id => new Choice(id, TriggerCatalog.ActionName(id))).ToList();
        ComboEvent.DisplayMemberPath = ComboAction.DisplayMemberPath = nameof(Choice.Name);
        ComboEvent.SelectedValuePath = ComboAction.SelectedValuePath = nameof(Choice.Id);
        ComboEvent.SelectedValue = Result.Event;
        ComboAction.SelectedValue = Result.Action;
        ChkEnabled.IsChecked = Result.Enabled;
        ChkLog.IsChecked = Result.Log;
        ApplyEvent(Result.EventArg, Result.EventArg2);
        ApplyAction(Result.ActionArg, Result.ActionArg2);
        _loading = false;
        ComboEvent.SelectionChanged += (_, _) => { if (!_loading) ApplyEvent("", ""); };
        ComboAction.SelectionChanged += (_, _) => { if (!_loading) ApplyAction("", ""); };
    }

    private string SelectedEvent => ComboEvent.SelectedValue as string ?? MonitorEvents.LogMatch;

    private string SelectedAction => ComboAction.SelectedValue as string ?? MonitorActions.WriteLog;

    private void ApplyEvent(string a1, string a2)
    {
        TxtEventDesc.Text = TriggerCatalog.EventDescription(SelectedEvent);
        TxtEventNoOptions.Visibility = ApplySlots(_eventSlots, TriggerCatalog.GetEventArgs(SelectedEvent), a1, a2);
    }

    private void ApplyAction(string a1, string a2)
    {
        TxtActionDesc.Text = TriggerCatalog.ActionDescription(SelectedAction);
        TxtActionNoOptions.Visibility = ApplySlots(_actionSlots, TriggerCatalog.GetActionArgs(SelectedAction), a1, a2);
    }

    /// <summary>Show one slot per spec with its value; returns the "no options" label visibility.</summary>
    private static Visibility ApplySlots(ArgSlot[] slots, IReadOnlyList<TriggerArgSpec> specs, string a1, string a2)
    {
        var values = new[] { a1, a2 };
        for (int i = 0; i < slots.Length; i++)
            slots[i].Show(i < specs.Count ? specs[i] : null, values[i]);
        return specs.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
    }

    private void BrowseFor(ArgSlot slot)
    {
        if (slot.Spec?.Kind == TriggerArgKind.Folder)
        {
            var dlg = new OpenFolderDialog { Title = slot.Label.Text };
            if (dlg.ShowDialog(this) == true) slot.Text.Text = dlg.FolderName;
            return;
        }
        var file = new OpenFileDialog { Title = slot.Label.Text, CheckFileExists = true };
        if (file.ShowDialog(this) == true) slot.Text.Text = file.FileName;
    }

    private void BtnSave_Click(object sender, RoutedEventArgs e)
    {
        var ev = _eventSlots.Select(s => s.Value).ToArray();
        if (_eventSlots[0].Spec?.Kind == TriggerArgKind.TimeOfDay)
        {
            string? time = TriggerCatalog.TimeFromDisplay(ev[0]);
            if (time == null)
            {
                _eventSlots[0].Text.Focus();
                return;
            }
            ev[0] = time;
        }
        var act = _actionSlots.Select(s => s.Value).ToArray();
        Result = new TriggerDefinition
        {
            Event = SelectedEvent,
            EventArg = ev[0],
            EventArg2 = ev[1],
            Action = SelectedAction,
            ActionArg = act[0],
            ActionArg2 = act[1],
            Enabled = ChkEnabled.IsChecked == true,
            Log = ChkLog.IsChecked == true
        };
        DialogResult = true;
    }

    private sealed record Choice(string Id, string Name);

    /// <summary>One label + text / combo + browse row bound to an argument spec.</summary>
    private sealed class ArgSlot
    {
        private readonly Grid _row;
        public TextBlock Label { get; }
        public TextBox Text { get; }
        public ComboBox Combo { get; }
        public Button Browse { get; }
        public TriggerArgSpec? Spec { get; private set; }

        public ArgSlot(Grid row, TextBlock label, TextBox text, ComboBox combo, Button browse)
        {
            _row = row;
            Label = label;
            Text = text;
            Combo = combo;
            Browse = browse;
            Combo.DisplayMemberPath = nameof(Choice.Name);
            Combo.SelectedValuePath = nameof(Choice.Id);
        }

        public void Show(TriggerArgSpec? spec, string value)
        {
            Spec = spec;
            _row.Visibility = spec == null ? Visibility.Collapsed : Visibility.Visible;
            if (spec == null) return;
            Label.Text = TriggerCatalog.ArgLabel(spec);
            var choices = Choices(spec.Kind);
            bool combo = choices != null;
            Combo.Visibility = combo ? Visibility.Visible : Visibility.Collapsed;
            Text.Visibility = combo ? Visibility.Collapsed : Visibility.Visible;
            Browse.Visibility = spec.Kind is TriggerArgKind.File or TriggerArgKind.Folder ? Visibility.Visible : Visibility.Collapsed;
            if (combo)
            {
                Combo.ItemsSource = choices;
                Combo.SelectedValue = string.IsNullOrEmpty(value) ? choices![0].Id : value;
                if (Combo.SelectedIndex < 0) Combo.SelectedIndex = 0;
            }
            else
            {
                Text.Text = spec.Kind == TriggerArgKind.TimeOfDay ? TriggerCatalog.TimeToDisplay(value) : value;
            }
        }

        public string Value => Spec == null ? "" : Combo.Visibility == Visibility.Visible ? Combo.SelectedValue as string ?? "" : Text.Text.Trim();

        private static List<Choice>? Choices(TriggerArgKind kind) => kind switch
        {
            TriggerArgKind.Weekday => Enumerable.Range(TriggerCatalog.WeekdayAll, TriggerCatalog.WeekdayCount + 1)
                .Select(d => new Choice(d.ToString(CultureInfo.InvariantCulture), TriggerCatalog.WeekdayName(d))).ToList(),
            TriggerArgKind.Channel => MonitorNotifyChannels.Values.Select(c => new Choice(c, TriggerCatalog.ChannelName(c))).ToList(),
            _ => null
        };
    }
}
