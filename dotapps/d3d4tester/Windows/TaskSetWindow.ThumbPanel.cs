// PY-REF: none (DOT-only)
using System.Collections.Specialized;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Virtualizing wrap panel for fixed-size thumbnail cells: only the rows inside the viewport get containers, so pools with
/// hundreds of resources stay responsive. Needs ScrollViewer.CanContentScroll=True on the owning ListBox.
/// </summary>
public sealed class TaskSetThumbPanel : VirtualizingPanel, IScrollInfo
{
    public static readonly DependencyProperty ItemWidthProperty = DependencyProperty.Register(nameof(ItemWidth), typeof(double), typeof(TaskSetThumbPanel),
        new FrameworkPropertyMetadata(116.0, FrameworkPropertyMetadataOptions.AffectsMeasure));

    public static readonly DependencyProperty ItemHeightProperty = DependencyProperty.Register(nameof(ItemHeight), typeof(double), typeof(TaskSetThumbPanel),
        new FrameworkPropertyMetadata(132.0, FrameworkPropertyMetadataOptions.AffectsMeasure));

    private const double LineStep = 24;
    private const int WheelLines = 3;

    private Size _extent;
    private Size _viewport;
    private Point _offset;
    private int _columns = 1;

    public double ItemWidth { get => (double)GetValue(ItemWidthProperty); set => SetValue(ItemWidthProperty, value); }

    public double ItemHeight { get => (double)GetValue(ItemHeightProperty); set => SetValue(ItemHeightProperty, value); }

    public bool CanHorizontallyScroll { get; set; }

    public bool CanVerticallyScroll { get; set; }

    public double ExtentWidth => _extent.Width;

    public double ExtentHeight => _extent.Height;

    public double ViewportWidth => _viewport.Width;

    public double ViewportHeight => _viewport.Height;

    public double HorizontalOffset => _offset.X;

    public double VerticalOffset => _offset.Y;

    public ScrollViewer? ScrollOwner { get; set; }

    private int ItemCount => ItemsControl.GetItemsOwner(this)?.Items.Count ?? 0;

    protected override Size MeasureOverride(Size availableSize)
    {
        _ = InternalChildren;
        var generator = ItemContainerGenerator;
        int count = ItemCount;
        double width = double.IsInfinity(availableSize.Width) ? ItemWidth * Math.Max(1, count) : availableSize.Width;
        _columns = Math.Max(1, (int)Math.Floor(width / ItemWidth));
        int rows = (count + _columns - 1) / _columns;
        double height = double.IsInfinity(availableSize.Height) ? rows * ItemHeight : availableSize.Height;
        UpdateScrollInfo(new Size(width, height), new Size(_columns * ItemWidth, rows * ItemHeight));

        int first = Math.Min(count, (int)Math.Floor(_offset.Y / ItemHeight) * _columns);
        int last = Math.Min(count - 1, (int)Math.Ceiling((_offset.Y + _viewport.Height) / ItemHeight) * _columns - 1);
        if (generator != null && count > 0 && first <= last)
        {
            var start = generator.GeneratorPositionFromIndex(first);
            int childIndex = start.Offset == 0 ? start.Index : start.Index + 1;
            using (generator.StartAt(start, GeneratorDirection.Forward, true))
            {
                for (int i = first; i <= last; i++, childIndex++)
                {
                    if (generator.GenerateNext(out bool isNew) is not UIElement child) break;
                    if (isNew)
                    {
                        if (childIndex >= InternalChildren.Count) AddInternalChild(child);
                        else InsertInternalChild(childIndex, child);
                        generator.PrepareItemContainer(child);
                    }
                    child.Measure(new Size(ItemWidth, ItemHeight));
                }
            }
        }
        CleanUp(first, last);
        return new Size(width, height);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        var generator = ItemContainerGenerator;
        for (int i = 0; i < InternalChildren.Count; i++)
        {
            int index = generator.IndexFromGeneratorPosition(new GeneratorPosition(i, 0));
            if (index < 0) continue;
            int row = index / _columns, column = index % _columns;
            InternalChildren[i].Arrange(new Rect(column * ItemWidth - _offset.X, row * ItemHeight - _offset.Y, ItemWidth, ItemHeight));
        }
        return finalSize;
    }

    protected override void OnItemsChanged(object sender, ItemsChangedEventArgs args)
    {
        switch (args.Action)
        {
            case NotifyCollectionChangedAction.Remove:
            case NotifyCollectionChangedAction.Replace:
            case NotifyCollectionChangedAction.Move:
                RemoveInternalChildRange(args.Position.Index, args.ItemUICount);
                break;
        }
        base.OnItemsChanged(sender, args);
    }

    protected override void BringIndexIntoView(int index)
    {
        if (index < 0 || _columns <= 0) return;
        double top = index / _columns * ItemHeight;
        if (top < _offset.Y) SetVerticalOffset(top);
        else if (top + ItemHeight > _offset.Y + _viewport.Height) SetVerticalOffset(top + ItemHeight - _viewport.Height);
    }

    private void CleanUp(int first, int last)
    {
        var generator = ItemContainerGenerator;
        if (generator == null) return;
        for (int i = InternalChildren.Count - 1; i >= 0; i--)
        {
            var position = new GeneratorPosition(i, 0);
            int index = generator.IndexFromGeneratorPosition(position);
            if (index >= first && index <= last) continue;
            generator.Remove(position, 1);
            RemoveInternalChildRange(i, 1);
        }
    }

    private void UpdateScrollInfo(Size viewport, Size extent)
    {
        bool changed = viewport != _viewport || extent != _extent;
        _viewport = viewport;
        _extent = extent;
        double maxY = Math.Max(0, _extent.Height - _viewport.Height);
        if (_offset.Y > maxY)
        {
            _offset.Y = maxY;
            changed = true;
        }
        if (changed) ScrollOwner?.InvalidateScrollInfo();
    }

    public void LineUp() => SetVerticalOffset(_offset.Y - LineStep);

    public void LineDown() => SetVerticalOffset(_offset.Y + LineStep);

    public void LineLeft()
    {
    }

    public void LineRight()
    {
    }

    public void PageUp() => SetVerticalOffset(_offset.Y - _viewport.Height);

    public void PageDown() => SetVerticalOffset(_offset.Y + _viewport.Height);

    public void PageLeft()
    {
    }

    public void PageRight()
    {
    }

    public void MouseWheelUp() => SetVerticalOffset(_offset.Y - LineStep * WheelLines);

    public void MouseWheelDown() => SetVerticalOffset(_offset.Y + LineStep * WheelLines);

    public void MouseWheelLeft()
    {
    }

    public void MouseWheelRight()
    {
    }

    public void SetHorizontalOffset(double offset)
    {
    }

    public void SetVerticalOffset(double offset)
    {
        offset = Math.Clamp(offset, 0, Math.Max(0, _extent.Height - _viewport.Height));
        if (offset == _offset.Y) return;
        _offset.Y = offset;
        ScrollOwner?.InvalidateScrollInfo();
        InvalidateMeasure();
    }

    public Rect MakeVisible(Visual visual, Rect rectangle)
    {
        for (int i = 0; i < InternalChildren.Count; i++)
        {
            if (!ReferenceEquals(InternalChildren[i], visual)) continue;
            BringIndexIntoView(ItemContainerGenerator.IndexFromGeneratorPosition(new GeneratorPosition(i, 0)));
            break;
        }
        return rectangle;
    }
}
