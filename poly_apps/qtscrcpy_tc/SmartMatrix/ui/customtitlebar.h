#ifndef CUSTOMTITLEBAR_H
#define CUSTOMTITLEBAR_H

#include <QWidget>
#include <QLabel>
#include <QPushButton>
#include <QHBoxLayout>
#include <QMouseEvent>
#include <QPoint>

class CustomTitleBar : public QWidget
{
    Q_OBJECT

public:
    explicit CustomTitleBar(QWidget *parent = nullptr);
    ~CustomTitleBar();

    // 设置标题
    void setTitle(const QString &title);

    // 更新最大化按钮图标
    void updateMaximizeButton(bool isMaximized);

signals:
    // 按钮点击信号
    void minimizeClicked();
    void maximizeClicked();
    void restartClicked();
    void closeClicked();

protected:
    // 鼠标事件处理 - 实现窗口拖动
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
    void mouseDoubleClickEvent(QMouseEvent *event) override;

private:
    void setupUI();
    void setupConnections();
    void applyStyles();

private:
    QLabel *m_titleLabel;
    QPushButton *m_minimizeButton;
    QPushButton *m_maximizeButton;
    QPushButton *m_restartButton;
    QPushButton *m_closeButton;

    QPoint m_dragPosition;
    bool m_isDragging;
};

#endif // CUSTOMTITLEBAR_H
