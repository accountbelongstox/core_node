# Qt 6 Mouse Event API Fixes

## Summary

Fixed Qt 5 → Qt 6 migration errors related to deprecated mouse and wheel event APIs.

## Errors Fixed

All compilation errors from build attempt:
- ✅ `inputconvertgame.cpp(402)`: QMouseEvent::localPos() → position()
- ✅ `inputconvertgame.cpp(430)`: QMouseEvent::localPos() → position()
- ✅ `inputconvertgame.cpp(462)`: QMouseEvent::globalPos() → globalPosition().toPoint()
- ✅ `inputconvertnormal.cpp(38)`: QMouseEvent::localPos() → position()
- ✅ `inputconvertnormal.cpp(67)`: QWheelEvent::posF() → position()
- ✅ `inputconvertnormal.cpp(135)`: Qt::MidButton → Qt::MiddleButton

## Files Modified

### 1. device/controller/inputconvert/inputconvertgame.cpp

**Line 402-403:** Mouse move delta calculation
```cpp
// Before:
QPointF distance_raw{from->localPos() - m_ctrlMouseMove.lastPos};

// After:
// Qt 6: localPos() replaced with position()
QPointF distance_raw{from->position() - m_ctrlMouseMove.lastPos};
```

**Line 431-432:** Update last mouse position
```cpp
// Before:
m_ctrlMouseMove.lastPos = from->localPos();

// After:
// Qt 6: localPos() replaced with position()
m_ctrlMouseMove.lastPos = from->position();
```

**Line 464-465:** Get global cursor position
```cpp
// Before:
QPoint globalPos = from->globalPos();

// After:
// Qt 6: globalPos() replaced with globalPosition().toPoint()
QPoint globalPos = from->globalPosition().toPoint();
```

### 2. device/controller/inputconvert/inputconvertnormal.cpp

**Line 38-39:** Get mouse event position
```cpp
// Before:
QPointF pos = from->localPos();

// After:
// Qt 6: localPos() replaced with position()
QPointF pos = from->position();
```

**Line 68-69:** Get wheel event position
```cpp
// Before:
QPointF pos = from->posF();

// After:
// Qt 6: posF() replaced with position()
QPointF pos = from->position();
```

**Line 137-139:** Check for middle mouse button
```cpp
// Before:
if (buttonState & Qt::MidButton) {
    buttons |= AMOTION_EVENT_BUTTON_TERTIARY;
}

// After:
// Qt 6: MidButton renamed to MiddleButton
if (buttonState & Qt::MiddleButton) {
    buttons |= AMOTION_EVENT_BUTTON_TERTIARY;
}
```

## API Changes Reference

| Qt 5 API | Qt 6 Replacement | Return Type | Notes |
|----------|------------------|-------------|-------|
| `QMouseEvent::localPos()` | `position()` | QPointF | Unified API |
| `QMouseEvent::globalPos()` | `globalPosition().toPoint()` | QPointF → QPoint | Need .toPoint() conversion |
| `QWheelEvent::posF()` | `position()` | QPointF | Unified with mouse events |
| `Qt::MidButton` | `Qt::MiddleButton` | Enum | Renamed for clarity |

## Testing

To verify these fixes:
1. Run the build script: `scripts\build-windows.bat`
2. Check that compilation succeeds without errors
3. All mouse and wheel event handling should work correctly

## Documentation Updated

- ✅ QT6_MIGRATION_NOTES.md - Added section 10 for Mouse and Wheel Event API Changes
- ✅ Migration statistics updated (16 files modified, 11 API categories)
- ✅ Quick Reference Table updated with new API changes

---

Date: 2025-12-19
Qt Version: 6.10.1
Compiler: MSVC 2022 (19.34.31948) 64-bit
Status: ✅ Code fixes complete - Ready for build verification
