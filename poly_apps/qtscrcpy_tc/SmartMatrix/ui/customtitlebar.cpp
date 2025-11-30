#include "customtitlebar.h"
#include <QApplication>
#include <QWindow>

CustomTitleBar::CustomTitleBar(QWidget *parent)
    : QWidget(parent)
    , m_titleLabel(nullptr)
    , m_minimizeButton(nullptr)
    , m_maximizeButton(nullptr)
    , m_restartButton(nullptr)
    , m_closeButton(nullptr)
    , m_isDragging(false)
{
    setupUI();
    setupConnections();
    applyStyles();
}

CustomTitleBar::~CustomTitleBar()
{
}

void CustomTitleBar::setTitle(const QString &title)
{
    if (m_titleLabel) {
        m_titleLabel->setText(title);
    }
}

void CustomTitleBar::updateMaximizeButton(bool isMaximized)
{
    if (m_maximizeButton) {
        if (isMaximized) {
            m_maximizeButton->setText("❐");  // 还原图标
            m_maximizeButton->setToolTip("还原");
        } else {
            m_maximizeButton->setText("□");  // 最大化图标
            m_maximizeButton->setToolTip("最大化");
        }
    }
}

void CustomTitleBar::setupUI()
{
    // 设置固定高度
    setFixedHeight(40);
    setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);

    // 创建主布局
    QHBoxLayout *layout = new QHBoxLayout(this);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(0);

    // 创建标题标签
    m_titleLabel = new QLabel("灿烂传媒-智云矩阵", this);
    m_titleLabel->setObjectName("titleLabel");
    m_titleLabel->setAlignment(Qt::AlignLeft | Qt::AlignVCenter);

    // 创建按钮
    m_minimizeButton = new QPushButton("—", this);
    m_minimizeButton->setObjectName("minimizeButton");
    m_minimizeButton->setToolTip("最小化");
    m_minimizeButton->setFixedSize(40, 40);

    m_maximizeButton = new QPushButton("□", this);
    m_maximizeButton->setObjectName("maximizeButton");
    m_maximizeButton->setToolTip("最大化");
    m_maximizeButton->setFixedSize(40, 40);

    m_restartButton = new QPushButton("⟲", this);
    m_restartButton->setObjectName("restartButton");
    m_restartButton->setToolTip("重启应用");
    m_restartButton->setFixedSize(40, 40);

    m_closeButton = new QPushButton("✕", this);
    m_closeButton->setObjectName("closeButton");
    m_closeButton->setToolTip("关闭");
    m_closeButton->setFixedSize(40, 40);

    // 添加到布局
    layout->addWidget(m_titleLabel);
    layout->addStretch();  // 弹性空间
    layout->addWidget(m_minimizeButton);
    layout->addWidget(m_maximizeButton);
    layout->addWidget(m_restartButton);
    layout->addWidget(m_closeButton);

    setLayout(layout);
}

void CustomTitleBar::setupConnections()
{
    // 连接按钮信号
    connect(m_minimizeButton, &QPushButton::clicked,
            this, &CustomTitleBar::minimizeClicked);
    connect(m_maximizeButton, &QPushButton::clicked,
            this, &CustomTitleBar::maximizeClicked);
    connect(m_restartButton, &QPushButton::clicked,
            this, &CustomTitleBar::restartClicked);
    connect(m_closeButton, &QPushButton::clicked,
            this, &CustomTitleBar::closeClicked);
}

void CustomTitleBar::applyStyles()
{
    QString styleSheet = R"(
        CustomTitleBar {
            background-color: #2c3e50;
            min-height: 40px;
            max-height: 40px;
        }

        QLabel#titleLabel {
            color: #ecf0f1;
            font-size: 14pt;
            font-weight: bold;
            padding-left: 15px;
        }

        QPushButton {
            background-color: transparent;
            color: #ecf0f1;
            border: none;
            font-size: 16pt;
        }

        QPushButton:hover {
            background-color: #34495e;
        }

        QPushButton:pressed {
            background-color: #1abc9c;
        }

        QPushButton#closeButton:hover {
            background-color: #e74c3c;
        }

        QPushButton#closeButton:pressed {
            background-color: #c0392b;
        }

        QPushButton#restartButton:hover {
            background-color: #f39c12;
        }

        QPushButton#restartButton:pressed {
            background-color: #e67e22;
        }
    )";

    setStyleSheet(styleSheet);
}

void CustomTitleBar::mousePressEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton) {
        // 检查是否点击在按钮上
        QWidget *childWidget = childAt(event->pos());
        if (childWidget && qobject_cast<QPushButton*>(childWidget)) {
            // 点击在按钮上，不处理拖动
            QWidget::mousePressEvent(event);
            return;
        }

        m_isDragging = true;
        // Qt 6: 使用 globalPosition() 替代 globalPos()
        m_dragPosition = event->globalPosition().toPoint() - window()->frameGeometry().topLeft();
        event->accept();
    }
}

void CustomTitleBar::mouseMoveEvent(QMouseEvent *event)
{
    if (m_isDragging && (event->buttons() & Qt::LeftButton)) {
        // 防止在最大化状态下拖动
        if (window()->isMaximized()) {
            return;
        }
        // Qt 6: 使用 globalPosition() 替代 globalPos()
        window()->move(event->globalPosition().toPoint() - m_dragPosition);
        event->accept();
    }
}

void CustomTitleBar::mouseReleaseEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton) {
        m_isDragging = false;
        event->accept();
    }
}

void CustomTitleBar::mouseDoubleClickEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton) {
        // 检查是否双击在按钮上
        QWidget *childWidget = childAt(event->pos());
        if (childWidget && qobject_cast<QPushButton*>(childWidget)) {
            // 双击在按钮上，不处理最大化
            QWidget::mouseDoubleClickEvent(event);
            return;
        }

        emit maximizeClicked();
        event->accept();
    }
}
