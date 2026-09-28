using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace DotApps.d3check.ViewModels.Base;

/// <summary>
/// Base ViewModel implementing INotifyPropertyChanged. Use SetProperty for backing fields.
/// Per .NET UI spec: ViewModels in ViewModels/Base/ for MVVM.
/// </summary>
public abstract class BaseViewModel : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    /// <summary>Raises PropertyChanged for the given property name.</summary>
    protected void RaisePropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    /// <summary>Sets the backing field and raises PropertyChanged if the value changed. Returns true if set.</summary>
    protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
            return false;
        field = value;
        RaisePropertyChanged(propertyName);
        return true;
    }
}
