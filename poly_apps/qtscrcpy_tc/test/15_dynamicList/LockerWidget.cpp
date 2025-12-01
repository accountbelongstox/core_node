#include "LockerWidget.h"

#include <QLineEdit>
#include <QDoubleValidator>
#include <QPixmap>
#include <QHBoxLayout>
#include <QGridLayout>
#include <QDoubleSpinBox>

LockerWidget::LockerWidget(QWidget* parent)
    : QWidget(parent), m_sizeList(0), m_positionList(0)
{
    SetUpUI();
}

void LockerWidget::SetUpUI()
{
    this->resize(300, 600);

    m_sizeButton = new LockerButton;
    m_sizeButton->setObjectName("LockerButton");
    m_sizeButton->SetTextLabel(u8"大小");
    m_sizeButton->SetImageLabel(QPixmap(":/Dialog/Resources/Collapse.png"));
    m_sizeButton->setStyleSheet("#LockerButton{background-color:transparent}"
        "#LockerButton:hover{background-color:rgba(195,195,195,0.4)}"
        "#LockerButton:pressed{background-color:rgba(127,127,127,0.4)}");

    m_positionButton = new LockerButton;
    m_positionButton->setObjectName("LockerButton");
    m_positionButton->SetTextLabel(u8"替换文字");
    m_positionButton->SetImageLabel(QPixmap(":/Dialog/Resources/Collapse.png"));
    m_positionButton->setStyleSheet("#LockerButton{background-color:transparent}"
        "#LockerButton:hover{background-color:rgba(195,195,195,0.4)}"
        "#LockerButton:pressed{background-color:rgba(127,127,127,0.4)}");

    // Size Widget
    m_sizeWidget = new QWidget;
    m_sizeWidget->setParent(this);
    m_sizeWidget->setFixedHeight(100);
    m_sizeWidget->setVisible(false);

    QLabel* sizeLabel = m_sizeButton->GetTextHandle();
    sizeLabel->setStyleSheet("QLabel{color:rgba(183,71,42,1)}");
    sizeLabel->setFont(QFont("大小", 10, QFont::Black));

    QLabel* heightLabel = new QLabel(u8"高度");
    QLabel* spinLabel = new QLabel(u8"旋转");

    QDoubleSpinBox* heightSpinBox = new QDoubleSpinBox;
    heightSpinBox->setSuffix(u8"厘米");
    heightSpinBox->setFixedWidth(120);
    QDoubleSpinBox* spinSpinBox = new QDoubleSpinBox;
    spinSpinBox->setSuffix(u8"°");
    spinSpinBox->setFixedWidth(120);

    // Position Widget
    m_positionWidget = new QWidget;
    m_positionWidget->setParent(this);
    m_positionWidget->setFixedHeight(100);
    m_positionWidget->setVisible(false);

    QLabel* positionLabel = m_positionButton->GetTextHandle();
    positionLabel->setStyleSheet("QLabel{color:rgba(183,71,42,1)}");
    positionLabel->setFont(QFont("大小", 10, QFont::Black));

    QLabel* titleLabel = new QLabel(u8"标题");
    QLabel* descriptionLabel = new QLabel(u8"说明");

    QLineEdit* titleEdit = new QLineEdit;
    QLineEdit* descriptionEdit = new QLineEdit;

    QGridLayout* sizeLayout = new QGridLayout;
    sizeLayout->addWidget(heightLabel, 0, 0);
    sizeLayout->addWidget(heightSpinBox, 0, 1);
    sizeLayout->addWidget(spinLabel, 1, 0);
    sizeLayout->addWidget(spinSpinBox, 1, 1);
    m_sizeWidget->setLayout(sizeLayout);

    QVBoxLayout* positionLayout = new QVBoxLayout;
    positionLayout->addWidget(titleLabel);
    positionLayout->addWidget(titleEdit);
    positionLayout->addWidget(descriptionLabel);
    positionLayout->addWidget(descriptionEdit);
    m_positionWidget->setLayout(positionLayout);

    QVBoxLayout* vlayout = new QVBoxLayout;
    vlayout->addWidget(m_sizeButton);
    vlayout->addWidget(m_sizeWidget);
    vlayout->addWidget(m_positionButton);
    vlayout->addWidget(m_positionWidget);
    vlayout->addStretch();
    vlayout->setMargin(0);
    vlayout->setSpacing(0);
    this->setLayout(vlayout);

    connect(m_sizeButton, &LockerButton::clicked, [this](bool) {
        if (m_sizeList % 2)
        {
            m_sizeButton->SetImageLabel(QPixmap(":/Dialog/Resources/Collapse.png"));
            //m_sizeList偶数屏蔽Size列表界面，奇数显示Size列表界面
            m_sizeWidget->setVisible(false);
        }
        else
        {
            m_sizeButton->SetImageLabel(QPixmap(":/Dialog/Resources/Expand.png"));
            m_sizeWidget->setVisible(true);
        }
        m_sizeList++; });

    connect(m_positionButton, &LockerButton::clicked, [this](bool) {
        if (m_positionList % 2)
        {
            m_positionButton->SetImageLabel(QPixmap(":/Dialog/Resources/Collapse.png"));
            m_positionWidget->setVisible(false);
        }
        else
        {
            m_positionButton->SetImageLabel(QPixmap(":/Dialog/Resources/Expand.png"));
            m_positionWidget->setVisible(true);
        }
        m_positionList++; });
}
