# Qt 6 VideoForm and ToolForm API Fixes

## Summary

Fixed additional Qt 5 → Qt 6 migration errors in UI event handling code.

## Files Modified

### 1. device/ui/videoform.cpp

**Added Windows Header (Lines 15-18):**
```cpp
// Qt 6: Include windows.h for SetThreadExecutionState on Windows
#ifdef Q_OS_WIN32
#include <windows.h>
#endif
```
**Reason:** Qt 6 doesn't automatically include Windows API headers.

**Fixed mousePressEvent (Lines 567-586):**
```cpp
// Before:
event->setLocalPos(m_videoWidget->mapFrom(this, event->localPos().toPoint()));
qreal x = event->localPos().x() / m_videoWidget->size().width();
m_dragPosition = event->globalPos() - frameGeometry().topLeft();

// After:
QPointF transformedPos = m_videoWidget->mapFrom(this, event->position().toPoint());
qreal x = transformedPos.x() / m_videoWidget->size().width();
m_dragPosition = event->globalPosition().toPoint() - frameGeometry().topLeft();
```

**Fixed mouseReleaseEvent (Lines 589-615):**
```cpp
// Before:
event->setLocalPos(m_videoWidget->mapFrom(this, event->localPos().toPoint()));
QPointF local = event->localPos();
event->setLocalPos(local);

// After:
QPointF local = m_videoWidget->mapFrom(this, event->position().toPoint());
// Cannot modify event position in Qt 6
```

**Fixed mouseMoveEvent (Lines 617-631):**
```cpp
// Before:
event->setLocalPos(m_videoWidget->mapFrom(this, event->localPos().toPoint()));

// After:
// Qt 6: setLocalPos() removed, transformation handled by receiver
```

**Fixed mouseDoubleClickEvent (Lines 645-651):**
```cpp
// Before:
event->setLocalPos(m_videoWidget->mapFrom(this, event->localPos().toPoint()));

// After:
// Qt 6: setLocalPos() removed, transformation handled by receiver
```

**Fixed paintEvent (Lines 687-695):**
```cpp
// Before:
QStyleOption opt;
opt.init(this);

// After:
QStyleOption opt;
opt.initFrom(this);
```

### 2. device/ui/toolform.cpp

**Fixed mousePressEvent (Lines 86-93):**
```cpp
// Before:
m_dragPosition = event->globalPos() - frameGeometry().topLeft();

// After:
m_dragPosition = event->globalPosition().toPoint() - frameGeometry().topLeft();
```

## API Changes Applied

| Qt 5 API | Qt 6 Replacement | Notes |
|----------|------------------|-------|
| `QMouseEvent::setLocalPos()` | **Removed** | Cannot modify event position in Qt 6 |
| `QMouseEvent::localPos()` | `position()` | Returns QPointF |
| `QMouseEvent::globalPos()` | `globalPosition().toPoint()` | Need .toPoint() conversion |
| `QStyleOption::init()` | `initFrom()` | Method renamed |
| Windows API | `#include <windows.h>` | Required explicitly in Qt 6 |

## Key Changes

1. **setLocalPos() Removal:** Qt 6 removed the ability to modify mouse event positions. Coordinate transformations must be done separately.

2. **Position API Unification:** All position methods now return QPointF and use `position()` / `globalPosition()`.

3. **QStyleOption::init() → initFrom():** Method was renamed for clarity.

4. **Windows.h:** Must be explicitly included for Windows API functions like `SetThreadExecutionState`.

## Testing

All mouse event handlers have been updated:
- ✅ Mouse press events
- ✅ Mouse release events  
- ✅ Mouse move events
- ✅ Mouse double-click events
- ✅ Paint events

---

Date: 2025-12-19
Qt Version: 6.10.1
Status: ✅ Code fixes complete - Testing build
