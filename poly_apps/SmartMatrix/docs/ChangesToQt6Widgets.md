Changes to Qt Widgets
Qt 6 is a result of the conscious effort to make the framework more efficient and easy to use.

We try to maintain binary and source compatibility for all the public APIs in each release. But some changes were inevitable in an effort to make Qt a better framework.

In this topic we summarize those changes in Qt Widgets, and provide guidance to handle them.

Kernel classes
The QWidget class
The virtual QWidget::enterEvent() handler now receives a QEnterEvent* parameter which has information about the pointer position, rather than a plain QEvent*.

QDesktopWidget and QApplication::desktop()
QDesktopWidget was already deprecated in Qt 5, and has been removed in Qt 6, together with QApplication::desktop().

QScreen provides equivalent functionality to query for information about available screens, screen that form a virtual desktop, and screen geometries.

Use QWidget::setScreen() to create a QWidget on a specific display; note that this does not move a widget to a screen in a virtual desktop setup.

QAction, QActionGroup
These classes have been moved into the QtGui module. Member functions that depend on types defined in QtWidgets (such as QAction::menu() and QAction::setMenu()) are implemented as templates that will be instantiated only when called.

Widgets
The QAbstractButton class
The default timeout parameter for QAbstractButton::animateClick() is removed to allow modern connection syntax without the need for qOverload.

The QComboBox class
The QComboBox::setModel() function is now virtual.

The QDateTimeEdit class
When QDateTimeEdit::setDateTime() is called with a date-time whose time-spec doesn't match that of the QDateTimeEdit instance, the date-time is converted to the time-spec of the QDateTimeEdit. This gives a date-time that describes the same instant in time, but does so in the same terms as the QDateTimeEdit uses. Previously, the date and time from the passed date-time were combined with the time-spec of the widget, ignoring the time-spec of the date-time; this could describe a different point in time than the one described by the date-time passed.

ItemViews
The QAbstractItemView class
The virtual viewOptions() method that previously returned a QStyleOptionViewItem object has been renamed to initViewItemOption, and initializes a QStyleOptionViewItem object that's passed in through a pointer.

Styling Classes and related APIs
All versioned QStyleOption subclasses are consolidated, and the version numbers are reset to 1.

The various initStyleOption() methods in widget classes are now virtual.

Style sheet changes
Styling a widget by its property in Qt 5 vs Qt 6 is different, especially if the property is an enum. In Qt 5, the selector value for such a property is the integer equivalent of the enum value, while in Qt 6 the string value is used. The following example demonstrates this difference:

// Qt 5 style sheet
QToolButton[popupMode="1"] {
    padding-right: 20px;
}

// Qt 6 style sheet
QToolButton[popupMode=MenuButtonPopup] {
    padding-right: 20px;
}

Utility Classes
QUndoCommand, QUndoStack, and QUndoGroup
The widget independent classes of the Undo/Redo framework have been moved into the QtGui module.

Graphics View FrameworkTutorials© 2025 The Qt Company Ltd. Documentation contributions included herein are the copyrights of their respective owners. The documentation provided herein is licensed under the terms of the GNU Free Documentation License version 1.3 as published by the Free Software Foundation. Qt and respective logos are trademarks of The Qt Company Ltd. in Finland and/or other countries worldwide. All other trademarks are property of their respective owners.


Changes to Qt Widgets Qt 6 is a result of the conscious effort to make the framework more efficient and easy to use. We try to maintain binary and source compatibility for all the public APIs in each release. But some changes were inevitable in an effort to make Qt a better framework. In this topic we summarize those changes in Qt Widgets, and provide guidance to handle them. Kernel classes The QWidget class The virtual QWidget::enterEvent() handler now receives a QEnterEvent* parameter which has information about the pointer position, rather than a plain QEvent*. QDesktopWidget and QApplication::desktop() QDesktopWidget was already deprecated in Qt 5, and has been removed in Qt 6, together with QApplication::desktop(). QScreen provides equivalent functionality to query for information about available screens, screen that form a virtual desktop, and screen geometries. Use QWidget::setScreen() to create a QWidget on a specific display; note that this does not move a widget to a screen in a virtual desktop setup. QAction, QActionGroup These classes have been moved into the QtGui module. Member functions that depend on types defined in QtWidgets (such as QAction::menu() and QAction::setMenu()) are implemented as templates that will be instantiated only when called. Widgets The QAbstractButton class The default timeout parameter for QAbstractButton::animateClick() is removed to allow modern connection syntax without the need for qOverload. The QComboBox class The QComboBox::setModel() function is now virtual. The QDateTimeEdit class When QDateTimeEdit::setDateTime() is called with a date-time whose time-spec doesn't match that of the QDateTimeEdit instance, the date-time is converted to the time-spec of the QDateTimeEdit. This gives a date-time that describes the same instant in time, but does so in the same terms as the QDateTimeEdit uses. Previously, the date and time from the passed date-time were combined with the time-spec of the widget, ignoring the time-spec of the date-time; this could describe a different point in time than the one described by the date-time passed. ItemViews The QAbstractItemView class The virtual viewOptions() method that previously returned a QStyleOptionViewItem object has been renamed to initViewItemOption, and initializes a QStyleOptionViewItem object that's passed in through a pointer. Styling Classes and related APIs All versioned QStyleOption subclasses are consolidated, and the version numbers are reset to 1. The various initStyleOption() methods in widget classes are now virtual. Style sheet changes Styling a widget by its property in Qt 5 vs Qt 6 is different, especially if the property is an enum. In Qt 5, the selector value for such a property is the integer equivalent of the enum value, while in Qt 6 the string value is used. The following example demonstrates this difference: // Qt 5 style sheet QToolButton[popupMode="1"] { padding-right: 20px; } // Qt 6 style sheet QToolButton[popupMode=MenuButtonPopup] { padding-right: 20px; } Utility Classes QUndoCommand, QUndoStack, and QUndoGroup The widget independent classes of the Undo/Redo framework have been moved into the QtGui module. Graphics View FrameworkTutorials© 2025 The Qt Company Ltd. Documentation contributions included herein are the copyrights of their respective owners. The documentation provided herein is licensed under the terms of the GNU Free Documentation License version 1.3 as published by the Free Software Foundation. Qt and respective logos are trademarks of The Qt Company Ltd. in Finland and/or other countries worldwide. All other trademarks are property of their respective owners.