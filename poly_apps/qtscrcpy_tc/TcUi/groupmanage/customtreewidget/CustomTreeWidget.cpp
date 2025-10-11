/*******************************************************************************
 * @brief m_nodeDataList用于列表显示，devicegroups->groupTree用于列表配置数据的临时
 *          存储，jsonDoc用于读取和保存json配置文件
 *******************************************************************************/

#include <QDebug>
#include <QAction>
#include <QMenu>
#include <QInputDialog>

#include "CustomTreeWidget.h"
#include "devicegroups.h"
#include "ui_mainwindow.h"
#include "mainwindow.h"

/*==================================侧边栏部分==================================*/
#if 1 // for test
QString g_phoneSerialName;
void CustomTreeWidget::addMyDevice()
{
    DeviceManage *myDeviceManage = new DeviceManage(nullptr);
    Device::DeviceParams params;
    params.serial = g_phoneSerialName;
    myDeviceManage->connectDevice(params);
}
#endif

QList<NodeDataStruct> CustomTreeWidget::m_nodeDataList;
CustomTreeWidget::CustomTreeWidget(QWidget *parent)
    : QWidget(parent)
    , m_refreshIndex(0)
{
    loadJsonConfig();

    connect(&m_adb, &AdbProcess::adbProcessResult, this, [this](AdbProcess::ADB_EXEC_RESULT processResult) {
        QString log = "";
        bool newLine = true;
        QStringList args = m_adb.arguments();

        switch (processResult) {
        case AdbProcess::AER_ERROR_START:
            break;
        case AdbProcess::AER_SUCCESS_START:
            log = "adb run";
            newLine = false;
            break;
        case AdbProcess::AER_ERROR_EXEC:
            log = m_adb.getErrorOut();
            if (args.contains("ifconfig") && args.contains("wlan0")) {
//                getIPbyIp();
            }
            break;
        case AdbProcess::AER_ERROR_MISSING_BINARY:
            log = "adb not find";
            break;
        case AdbProcess::AER_SUCCESS_EXEC:
//            log = m_adb.getStdOut();
            if (args.contains("devices")) {
                log = "get phone";
                QStringList devices = m_adb.getDevicesSerialFromStdOut();
//                    std::sort(devices.begin(), devices.end(), [](const QString &s1, const QString &s2){
//                        return Config::getInstance().getNickName(s1) <= Config::getInstance().getNickName(s2);
//                    });
                for (auto &item : devices) {
                    g_phoneSerialName = item;
                    if (!devicegroups->checkDevice(item)) {
                        DeviceGroups::DeviceItem device = {"defaultName",
                            item, true, true, false, false, nullptr};
                        devicegroups->groupTree[devicegroups->allGroupOrder].deviceTree.append(device);
                    } else {
                        devicegroups->setDeviceExist(item);
                    }
                }
                int ratio = 3; // 3竖屏，1横屏
                Config::columnNum = sqrt(devices.size() * ratio);
                qDebug() << "columnNum" << Config::columnNum;
                if (Config::columnNum < 8) {
                    Config::columnNum = 8;
                }
                on_startServerBtn_clicked();
                initWidget();
//            } else if (args.contains("show") && args.contains("wlan0")) {
//                QString ip = m_adb.getDeviceIPFromStdOut();
//                if (ip.isEmpty()) {
//                    log = "ip not find, connect to wifi?";
//                    break;
//                }
//                ui->deviceIpEdt->setText(ip);
//            } else if (args.contains("ifconfig") && args.contains("wlan0")) {
//                QString ip = m_adb.getDeviceIPFromStdOut();
//                if (ip.isEmpty()) {
//                    log = "ip not find, connect to wifi?";
//                    break;
//                }
//                ui->deviceIpEdt->setText(ip);
//            } else if (args.contains("ip -o a")) {
//                QString ip = m_adb.getDeviceIPByIpFromStdOut();
//                if (ip.isEmpty()) {
//                    log = "ip not find, connect to wifi?";
//                    break;
//                }
//                ui->deviceIpEdt->setText(ip);
            }
            break;
        }
        if (!log.isEmpty()) {
//            outLog(log, newLine);
        }
    });

    on_updateDevice_clicked();

    this->setMinimumSize(QSize(250, 300));
    this->setStyleSheet("*{font-family:Microsoft YaHei;}\
           QScrollBar::vertical {\
              background:rgb(226,222,221);\
              border:none;\
              width: 5px;\
              margin:0px;\
           }\
           QScrollBar::handle:vertical {\
              background: rgb(192,192,192);\
              border-radius:1px;\
              min-height: 20px;\
              width:5px;\
          }\
          QScrollBar::add-line:vertical {\
              height:0px;\
          }\
          QScrollBar::sub-line:vertical {\
              height:0px;\
          }\
          QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {\
             background:transparent;\
          }");

    // m_refreshTimer.setInterval(2000);
    // connect(&m_refreshTimer, &QTimer::timeout, this, &CustomTreeWidget::onUpdateData);
    // m_refreshTimer.start();
}

void CustomTreeWidget::saveDiviceList()
{
    devicegroups->saveJsonFile();
}

void CustomTreeWidget::loadJsonConfig()
{
    devicegroups = new DeviceGroups();

    devicegroups->loadDeviceGroups();
    int groupCount = devicegroups->getGroupCount();
    if (!groupCount) {
        qWarning("json config num error!");
    }
    // devicegroups->clearExistState();
}

void CustomTreeWidget::initWidget()
{
    showWidget();
}

// 使用hMainLayout
void CustomTreeWidget::showWidget()
{
    // 整个左侧边栏的滚动区域
    m_scrollArea = new QScrollArea;
    m_scrollArea->setFixedWidth(250);
    m_scrollArea->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    m_scrollArea->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    m_scrollArea->setStyleSheet(".QScrollArea{background:white;}");

    // 左侧菜单栏的右键弹出新建分组
    m_scrollArea->installEventFilter(this);
    // 测试该空间实际中的区域，鼠标经过时整个区域变成紫色
//    /*forTest*/m_scrollArea->setStyleSheet(".QScrollArea{border-bottom:1px solid yellow;}\
//                                        .QScrollArea:hover{background:rgba(200, 0, 200, 200);}");

    /**
     * @brief 按devicegroups->groupTree中配置数据初始化显示用的
     *           m_nodeDataList（包含每个组和组中每个设备）
     */
    int groupCount = devicegroups->groupTree.size();
    for (int i = 0; i < groupCount; i++)
    {
        DeviceGroups::Group *group = &devicegroups->groupTree[i];
        NodeDataStruct nodeData;
        if (group->groupConnectStatus)
            nodeData.numberColor = Qt::green;
        else
            nodeData.numberColor = Qt::gray;
        nodeData.strNodeCount = devicegroups->groupTree[i].deviceTree.size();
        nodeData.strNodeName = group->groupName;
        nodeData.choose = group->groupSelect;
        nodeData.group = group; //TODO: add parent

        int deviceCount = devicegroups->groupTree[i].deviceTree.size();
        for (int j = 0; j < deviceCount; j ++)
        {
            DeviceGroups::DeviceItem *device = &devicegroups->groupTree[i].deviceTree[j];
            DeviceDataStruct deviceData;
            if (device->deviceConnectStatus)
                deviceData.connectColor = Qt::green;
            else
                deviceData.connectColor = Qt::gray;
            deviceData.deviceName = device->deviceName;
            deviceData.deviceNumber = device->deviceSerialNumber;
            deviceData.choose = device->deviceSelect;
            deviceData.device = device; //TODO: add parent
            deviceData.index = j;
            nodeData.deviceDataList.append(deviceData);
        }
        m_nodeDataList.append(nodeData);
    }

    /**
     * @brief 按m_nodeDataList列表数据信息添加具体的布局
     */
    m_deviceBackWidget = new QWidget;
    m_deviceBackWidget->setFixedWidth(250);
    m_deviceBackWidget->setStyleSheet(".QWidget{background:white;}");

    // 整个左侧边栏的实际内容区域
    vBackWidget = new QVBoxLayout(m_deviceBackWidget);
    vBackWidget->setSpacing(0);
    vBackWidget->setMargin(0);
    // 根据已经造好的数据布局界面;
    int deviceCount = m_nodeDataList.size();
    for (int i = 0; i < deviceCount; i++)
    {
        NodeDataStruct *nodeData = &m_nodeDataList[i];
        nodeData->deviceListWidget = new DeviceListWidget;
        nodeData->deviceListWidget->groupIndex = i;
        // 组展开或收起后改变整个左侧栏的高度
        connect(nodeData->deviceListWidget, &DeviceListWidget::signalNodeFoldChanged, this, &CustomTreeWidget::onNodeFoldChanged);
        connect(nodeData->deviceListWidget, &DeviceListWidget::signalDeleteGroup, this, &CustomTreeWidget::onDeleteGroup);
        connect(nodeData->deviceListWidget, &DeviceListWidget::signalDeviceAddToGroup, this, &CustomTreeWidget::onDeviceAddToGroup);
        connect(nodeData->deviceListWidget, &DeviceListWidget::signalGroupNameChanged, this, &CustomTreeWidget::onGroupNameChanged);
        connect(nodeData->deviceListWidget, &DeviceListWidget::signalDeviceNameChangedWithGroup, this, &CustomTreeWidget::onDeviceNameChangedWithGroup);
        connect(nodeData->deviceListWidget, &DeviceListWidget::signalDeviceCheckboxChangeFromGroup, this, &CustomTreeWidget::onDeviceCheckboxChangeFromGroup);
        connect(nodeData->deviceListWidget, &DeviceListWidget::signalGroupChooseChanged, this, &CustomTreeWidget::onGroupChooseChanged);

        // 先设置组标题信息;
        nodeData->deviceListWidget->setTitleInfo(nodeData->strNodeName, nodeData->strNodeCount, nodeData->numberColor, nodeData->choose);
        // 为每个组添加数据;
        for (int j = 0; j < nodeData->deviceDataList.count(); j++)
        {
            DeviceDataStruct deviceData = nodeData->deviceDataList[j];
            // 为该组添加每个设备
            nodeData->deviceListWidget->addDeviceItem(&deviceData, deviceData.connectColor, deviceData.deviceName, deviceData.deviceNumber, deviceData.choose);
        }

        // 显示一个组
        vBackWidget->addWidget(nodeData->deviceListWidget);
        m_nodeWidgetList.append(nodeData->deviceListWidget);
    }

    m_scrollArea->setWidget(m_deviceBackWidget);

    // 整个左侧边栏布局
    hMainLayout = new QHBoxLayout(this);
    hMainLayout->addWidget(m_scrollArea);
    hMainLayout->setMargin(0);
}

void CustomTreeWidget::onGroupNameChanged(int srcGroup, QString name)
{
    devicegroups->groupTree[srcGroup].groupName = name;
    m_nodeDataList[srcGroup].strNodeName = name;
}

void CustomTreeWidget::onGroupChooseChanged(int srcGroup, bool choose)
{
    devicegroups->groupTree[srcGroup].groupSelect = choose;
    m_nodeDataList[srcGroup].choose = choose;
}

void CustomTreeWidget::onDeviceNameChangedWithGroup(int srcGroup, int srcDevice, QString name)
{
    devicegroups->groupTree[srcGroup].deviceTree[srcDevice].deviceName = name;
    m_nodeDataList[srcGroup].deviceDataList[srcDevice].deviceName = name;
}

void CustomTreeWidget::onDeviceCheckboxChangeFromGroup(int groupIndex, int deviceIndex, bool choose)
{
    devicegroups->groupTree[groupIndex].deviceTree[deviceIndex].deviceSelect = choose;
    m_nodeDataList[groupIndex].deviceDataList[deviceIndex].choose = choose;
}

void CustomTreeWidget::onDeviceAddToGroup(int dstGroup, int srcGroup, int srcDevice)
{
    // 更新数据结构
    int test = m_nodeDataList[srcGroup].deviceDataList.size();
    qDebug() << test;
    DeviceDataStruct deviceData = m_nodeDataList[srcGroup].deviceDataList[srcDevice];
    m_nodeDataList[srcGroup].deviceDataList.removeAt(srcDevice);
    m_nodeDataList[dstGroup].deviceDataList.append(deviceData);
    DeviceGroups::DeviceItem item = m_nodeDataList[srcGroup].group->deviceTree[srcDevice];
    m_nodeDataList[srcGroup].group->deviceTree.removeAt(srcDevice);
    m_nodeDataList[dstGroup].group->deviceTree.append(item);

    // 更新UI
    m_nodeDataList[dstGroup].deviceListWidget->addDeviceItem(&deviceData, deviceData.connectColor, deviceData.deviceName, deviceData.deviceNumber, deviceData.choose);
    QString cnt = QString::number(m_nodeDataList[dstGroup].group->deviceTree.size());
    m_nodeDataList[dstGroup].deviceListWidget->m_numberLabel->setText(cnt);

    m_nodeDataList[srcGroup].deviceListWidget->onDeleteDevice(srcDevice);
    cnt = QString::number(m_nodeDataList[srcGroup].group->deviceTree.size());
    m_nodeDataList[srcGroup].deviceListWidget->m_numberLabel->setText(cnt);

    for (int i = 0 ; i < m_nodeDataList[srcGroup].deviceDataList.size(); i++)
    {
        m_nodeWidgetList[srcGroup]->updateDeviceIndex(i);
        // m_nodeDataList[srcGroup].deviceDataList[i].itemWidget->deviceIndex = i;
    }
    for (int i = 0 ; i < m_nodeDataList[dstGroup].deviceDataList.size(); i++)
    {
        m_nodeWidgetList[dstGroup]->updateDeviceIndex(i);
        // m_nodeDataList[dstGroup].deviceDataList[i].itemWidget->deviceIndex = i;
    }

    onNodeFoldChanged();
}

void CustomTreeWidget::addNewGroupList()
{
    //m_nodeDataList
    DeviceGroups::Group group;
    QString str = QString("%1%2").arg("defaultName").arg(devicegroups->groupTree.size());
    group.groupName = str;
    group.groupScript = false;
    group.groupSelect = false;
    group.groupConnectStatus = false;
    devicegroups->groupTree.append(group);

    int cnt = devicegroups->groupTree.size() - 1;
    if (cnt < 0)
        cnt = 0;
    DeviceGroups::Group *pgroup = &devicegroups->groupTree[cnt];
    NodeDataStruct inNodeData;
    if (pgroup->groupConnectStatus)
        inNodeData.numberColor = Qt::green;
    else
        inNodeData.numberColor = Qt::gray;
    inNodeData.strNodeCount = devicegroups->groupTree[cnt].deviceTree.size();
    inNodeData.strNodeName = pgroup->groupName;
    inNodeData.choose = pgroup->groupSelect;
    inNodeData.group = pgroup;
    m_nodeDataList.append(inNodeData);

    cnt = m_nodeDataList.size() - 1;
    if (cnt < 0)
        cnt = 0;
    NodeDataStruct nodeData = m_nodeDataList[cnt];
    nodeData.deviceListWidget = new DeviceListWidget;
    m_nodeDataList[cnt].deviceListWidget = nodeData.deviceListWidget;
    nodeData.deviceListWidget->groupIndex = m_nodeDataList.size();
    // 组展开或收起后改变整个左侧栏的高度
    connect(nodeData.deviceListWidget, &DeviceListWidget::signalNodeFoldChanged, this, &CustomTreeWidget::onNodeFoldChanged);
    connect(nodeData.deviceListWidget, &DeviceListWidget::signalDeviceAddToGroup, this, &CustomTreeWidget::onDeviceAddToGroup);

    connect(nodeData.deviceListWidget, &DeviceListWidget::signalDeleteGroup, this, &CustomTreeWidget::onDeleteGroup);
    connect(nodeData.deviceListWidget, &DeviceListWidget::signalGroupNameChanged, this, &CustomTreeWidget::onGroupNameChanged);
    connect(nodeData.deviceListWidget, &DeviceListWidget::signalDeviceNameChangedWithGroup, this, &CustomTreeWidget::onDeviceNameChangedWithGroup);
    connect(nodeData.deviceListWidget, &DeviceListWidget::signalDeviceCheckboxChangeFromGroup, this, &CustomTreeWidget::onDeviceCheckboxChangeFromGroup);

    // 先设置组标题信息;
    nodeData.deviceListWidget->setTitleInfo(nodeData.strNodeName, nodeData.strNodeCount, nodeData.numberColor, nodeData.choose);
    // 为每个组添加数据;
    for (int j = 0; j < nodeData.deviceDataList.count(); j++)
    {
        DeviceDataStruct deviceData = nodeData.deviceDataList[j];
        // 为该组添加每个设备
        nodeData.deviceListWidget->addDeviceItem(&deviceData, deviceData.connectColor, deviceData.deviceName, deviceData.deviceNumber, deviceData.choose);
    }

    // 显示一个组
    vBackWidget->addWidget(nodeData.deviceListWidget);
    m_nodeWidgetList.append(nodeData.deviceListWidget);
    // onNodeFoldChanged();
    int height = 0;
    for (int i = 0; i < m_nodeWidgetList.count() - 1; i++)
    {
        height += m_nodeWidgetList[i]->height();
    }
    height += ITEM_HEIGHT;
    m_deviceBackWidget->setFixedHeight(height);
    onNodeFoldChanged();
}

// 左侧菜单栏的右键弹出新建分组
bool CustomTreeWidget::eventFilter(QObject *watched, QEvent *event)
{
    if (watched == m_scrollArea)
    {
        if (event->type() == QEvent::MouseButtonRelease)
        {
            QMouseEvent* mouseEvent = static_cast<QMouseEvent*>(event);
            if (mouseEvent->button() == Qt::RightButton)
            {
                QMenu *buttonMenu = new QMenu(this);
                QAction *buttonAction1 = new QAction(QString::fromLocal8Bit("新建分组"), this);
                buttonMenu->addAction(buttonAction1);
                connect(buttonAction1, &QAction::triggered, [=]()
                {
                    addNewGroupList();
//                    onNodeFoldChanged();
                });
                buttonMenu->exec(QCursor::pos());
            }
        }
    }

    return __super::eventFilter(watched, event);
}

// 改变一个组展开时整个左侧栏所占据的大小
void CustomTreeWidget::onNodeFoldChanged()
{
    int height = 0;
    for (int i = 0; i < m_nodeWidgetList.count(); i++)
    {
        height += m_nodeWidgetList[i]->height();
    }
    m_deviceBackWidget->setFixedHeight(height);
}

void CustomTreeWidget::onDeleteGroup()
{
    int i;
    DeviceListWidget *group = (DeviceListWidget *)sender();
    for (i = 0; i < m_nodeDataList.size(); i++)
    {
        if (m_nodeDataList[i].deviceListWidget == group)
        {
            m_nodeDataList.removeAt(i);
            break;
        }
    }
    devicegroups->groupTree.removeAt(i);

    vBackWidget->removeWidget(group);
    m_nodeWidgetList.removeOne(m_nodeWidgetList[i]);
    group->setParent(nullptr);
    group->deleteLater();

    for (i = 0; i < m_nodeWidgetList.size(); i++)
    {
        m_nodeWidgetList[i]->groupIndex = i;
    }

    onNodeFoldChanged();
}

// 刷新数据; not used now
void CustomTreeWidget::onUpdateData()
{
    if (m_refreshIndex >= m_nodeDataList.count())
    {
        m_refreshIndex = 0;
    }

    // 这里500ms更新一个节点的数据;
    DeviceListWidget* deviceListWidget = m_nodeWidgetList[m_refreshIndex];
    NodeDataStruct nodeData = m_nodeDataList[m_refreshIndex];
    nodeData.numberColor = QColor(rand() % 256, rand() % 256, rand() % 256);
    deviceListWidget->setTitleInfo(nodeData.strNodeName, nodeData.strNodeCount, nodeData.numberColor, nodeData.choose);

    int count = nodeData.deviceDataList.size();
    for (int j = 0; j < count; j++)
    {
        DeviceDataStruct deviceData = nodeData.deviceDataList[j];
        deviceData.connectColor = nodeData.numberColor = QColor(rand() % 256, rand() % 256, rand() % 256);
        deviceListWidget->updateDeviceItem(j, deviceData.connectColor, deviceData.deviceName, deviceData.deviceNumber);
    }

    m_refreshIndex++;
}

bool CustomTreeWidget::checkAdbRun()
{
    if (m_adb.isRuning()) {
        // outLog("wait for the end of the current command to run");
    }
    return m_adb.isRuning();
}

void CustomTreeWidget::on_updateDevice_clicked()
{
    if (checkAdbRun()) {
        return;
    }
    m_adb.execute("", QStringList() << "devices");
}

void CustomTreeWidget::on_startServerBtn_clicked()
{
    QString absFilePath;
#if 0
    if (ui->recordScreenCheck->isChecked()) {
        QString fileDir(ui->recordPathEdt->text().trimmed());
        if (!fileDir.isEmpty()) {
            QDateTime dateTime = QDateTime::currentDateTime();
            QString fileName = dateTime.toString("_yyyyMMdd_hhmmss_zzz");
            QString ext = ui->formatBox->currentText().trimmed();
            fileName = windowTitle() + fileName + "." + ext;
            QDir dir(fileDir);
            absFilePath = dir.absoluteFilePath(fileName);
        }
    }
#endif

#if 0
    quint32 bitRate = ui->bitRateBox->currentText().trimmed().toUInt();
    // this is ok that "native" toUshort is 0
    quint16 videoSize = ui->maxSizeBox->currentText().trimmed().toUShort();
#endif

#if 0
    params.maxSize = videoSize;
    params.bitRate = bitRate;
    // on devices with Android >= 10, the capture frame rate can be limited
    params.maxFps = static_cast<quint32>(Config::getInstance().getMaxFps());
    params.recordFileName = absFilePath;
    params.closeScreen = ui->closeScreenCheck->isChecked();
    params.useReverse = ui->useReverseCheck->isChecked();
    params.display = !ui->notDisplayCheck->isChecked();
    params.renderExpiredFrames = Config::getInstance().getRenderExpiredFrames();
    params.lockVideoOrientation = ui->lockOrientationBox->currentIndex() - 1;
    params.stayAwake = ui->stayAwakeCheck->isChecked();
    params.framelessWindow = ui->framelessCheck->isChecked();
    params.recordPath = ui->recordPathEdt->text().trimmed();
#endif

    for (int i = 0; i < devicegroups->groupTree.size(); i++) {
        bool groupFlag = false;
        DeviceGroups::Group *group = &devicegroups->groupTree[i];
        for (int j = 0; j < group->deviceTree.size(); j++) {
            DeviceGroups::DeviceItem *device = &group->deviceTree[j];
            if (device->deviceExist)
                groupFlag = true;
        }
        bool hostflag = false;
        QString hostdevice;
        if (groupFlag) {
            group->m_deviceManage = new DeviceManage(nullptr);
            for (int j = 0; j < group->deviceTree.size(); j++) {
                if (group->deviceTree[j].deviceExist) {
                    Device::DeviceParams params;
                    params.serial = group->deviceTree[j].deviceSerialNumber;
                    params.nickname = group->deviceTree[j].deviceName;
                    if (!hostflag) {
                        hostdevice = group->deviceTree[j].deviceSerialNumber;
                        hostflag = true;
                    }
                    group->m_deviceManage->connectDevice(params);
                    group->deviceTree[j].m_device = group->m_deviceManage->m_devices[params.serial];
                    group->deviceTree[j].deviceConnectStatus = true;
                    group->groupConnectStatus = true;
                }
            }
            Ui::MainWindow *ui = MainWindow::mainwin->ui;
            ui->shortcutwidget->setGroup(group, hostdevice);
        }
    }

#if 0
    if (ui->alwaysTopCheck->isChecked()) {
        m_deviceManage.staysOnTop(params.serial);
    }
    m_deviceManage.showFPS(params.serial, ui->fpsCheck->isChecked());
#endif
}

QtMsgType covertLogLevel(const QString &logLevel)
{
    if ("debug" == logLevel) {
        return QtDebugMsg;
    }

    if ("info" == logLevel) {
        return QtInfoMsg;
    }

    if ("warn" == logLevel) {
        return QtWarningMsg;
    }

    if ("error" == logLevel) {
        return QtCriticalMsg;
    }

#ifdef QT_NO_DEBUG
    return QtInfoMsg;
#else
    return QtDebugMsg;
#endif
}

/*==================================设备组部分==================================*/
void DeviceListWidget::initTitleBackWidget()
{
    m_titleBackWidget = new QWidget;
    m_titleBackWidget->setFixedSize(QSize(250, 40));
    m_titleBackWidget->installEventFilter(this);
    // 鼠标经过时改变设备栏颜色
    m_titleBackWidget->setStyleSheet(".QWidget{border-bottom:1px solid gray;}\
                                        .QWidget:hover{background:rgba(200, 200, 200, 200);}");

    m_foldStateLabel = new QLabel;
    m_foldStateLabel->setFixedSize(QSize(20, 20));
    m_foldStateLabel->setPixmap(QIcon(":/qss/psblack/branch_open.png").pixmap(m_foldStateLabel->size()));

    m_titleLabel = new QLabel;
    m_titleLabel->setStyleSheet("font-size:16px;font-weight:bold;");

    m_numberLabel = new QLabel;
    m_numberLabel->setFixedSize(QSize(16, 16));
    m_numberLabel->setAlignment(Qt::AlignCenter);

    QHBoxLayout* hButtonLayout = new QHBoxLayout;
    hButtonLayout->addWidget(m_numberLabel);
    hButtonLayout->setContentsMargins(0, 0, 0, 10);

    m_foldTagCheck = new QCheckBox;
    m_foldTagCheck->setFixedSize(QSize(20, 20));
    connect(m_foldTagCheck, SIGNAL(clicked()), this, SLOT(onGroupCheckboxTextGet()));

    QHBoxLayout* hTitleLayout = new QHBoxLayout(m_titleBackWidget);
    hTitleLayout->addWidget(m_foldStateLabel);
    hTitleLayout->addWidget(m_titleLabel);
    hTitleLayout->addLayout(hButtonLayout);
    hTitleLayout->addStretch();
    hTitleLayout->addWidget(m_foldTagCheck);
    hTitleLayout->setSpacing(5);
    hTitleLayout->setContentsMargins(5, 0, 25, 0);
}

void DeviceListWidget::onGroupCheckboxTextGet()
{
    QCheckBox *checkbox = (QCheckBox *)sender();
    qDebug() << (checkbox->isChecked() ? "choosed" : "not choosed");
    emit signalGroupChooseChanged(groupIndex, checkbox->isChecked());
}

void DeviceListWidget::initWidget()
{
    initTitleBackWidget();

    m_listWidget = new QListWidget;
    m_listWidget->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    m_listWidget->setVerticalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    m_listWidget->setVisible(false);

    QVBoxLayout* vMainLayout = new QVBoxLayout(this);
    vMainLayout->addWidget(m_titleBackWidget);
    vMainLayout->addWidget(m_listWidget);
    vMainLayout->addStretch();
    vMainLayout->setSpacing(0);
    vMainLayout->setMargin(0);
}

bool DeviceListWidget::eventFilter(QObject *watched, QEvent *event)
{
    if (watched == m_titleBackWidget)
    {
        if (event->type() == QEvent::MouseButtonRelease)
        {
            QMouseEvent* mouseEvent = static_cast<QMouseEvent*>(event);
            if (mouseEvent->button() == Qt::LeftButton)
            {
                // 节点点击进行展开收缩;
                if (m_isFolded)
                {
                    m_foldStateLabel->setPixmap(QIcon(":/qss/psblack/branch_close.png").pixmap(m_foldStateLabel->size()));
                    m_listWidget->setVisible(true);
                    m_listWidget->setFixedHeight(m_listWidget->count() * ITEM_HEIGHT + 10);
                    this->setFixedHeight(m_titleBackWidget->height() + m_listWidget->height());
                    emit signalNodeFoldChanged(m_titleBackWidget->height() + m_listWidget->height());
                }
                else
                {
                    m_foldStateLabel->setPixmap(QIcon(":/qss/psblack/branch_open.png").pixmap(m_foldStateLabel->size()));
                    m_listWidget->setVisible(false);
                    this->setFixedHeight(m_titleBackWidget->height());
                    emit signalNodeFoldChanged(m_titleBackWidget->height() + m_listWidget->height());
                }
                m_isFolded = !m_isFolded;
            }
            if (mouseEvent->button() == Qt::RightButton)
            {
                QMenu *buttonMenu = new QMenu(this);
                QAction *buttonAction1 = new QAction(QString::fromLocal8Bit("删除分组"), this);
                QAction *buttonAction2 = new QAction(QString::fromLocal8Bit("修改组名"), this);
                buttonMenu->addAction(buttonAction1);
                buttonMenu->addAction(buttonAction2);
                connect(buttonAction1, &QAction::triggered, [=]()
                {
                    emit signalDeleteGroup();
                    emit signalNodeFoldChanged(m_titleBackWidget->height() + m_listWidget->height());
                });
                connect(buttonAction2, &QAction::triggered, [=]()
                {
                    bool inputOk;
                    QString text = QInputDialog::getText(NULL, "Input Dialog",
                                           "Please input your comment",
                                           QLineEdit::Normal,
                                           m_titleLabel->text(),
                                           &inputOk);
                    if (inputOk) {
                        m_titleLabel->setText(text);
                        m_titleLabel->adjustSize();
                        emit signalGroupNameChanged(groupIndex, text);
                    }
                });
                buttonMenu->exec(QCursor::pos());
            }
        }
    }

    return __super::eventFilter(watched, event);
}

DeviceListWidget::DeviceListWidget(QWidget* parent)
    : QWidget(parent)
    , m_isFolded(true)
{
    initWidget();
    this->setWindowFlags(Qt::FramelessWindowHint);
    this->setStyleSheet("QListWidget{border:none;border-bottom:1px solid gray;}");
}

// 设置组标题栏信息;
void DeviceListWidget::setTitleInfo(QString strTitle, int count, QColor numberColor, bool choose)
{
    m_titleLabel->setText(strTitle);
    m_numberLabel->setText(QString::number(count));
    m_numberLabel->setStyleSheet(QString("color:white;border-radius:8px;background:rgb(%1, %2, %3);").arg(numberColor.red()).arg(numberColor.green()).arg(numberColor.blue()));
    m_foldTagCheck->setChecked(choose);
}

// 添加设备子项;
void DeviceListWidget::addDeviceItem(DeviceDataStruct* deviceData, QColor connectColor, QString deviceName, QString deviceNumber, bool choose)
{
    QListWidgetItem* item = new QListWidgetItem;
    item->setSizeHint(QSize(250, ITEM_HEIGHT));
    m_listWidget->addItem(item);

    deviceData->itemWidget = new DeviceItemWidget;
    deviceData->itemWidget->deviceIndex = deviceData->index;
    connect(deviceData->itemWidget, &DeviceItemWidget::signalDeleteDevice, this, &DeviceListWidget::onDeleteDevice);
    connect(deviceData->itemWidget, &DeviceItemWidget::signalAddToGroup, this, &DeviceListWidget::onAddToGroup);
    connect(deviceData->itemWidget, &DeviceItemWidget::signalDeviceNameChanged, this, &DeviceListWidget::onDeviceNameChanged);
    connect(deviceData->itemWidget, &DeviceItemWidget::signalCheckboxChangeFromDevice, this, &DeviceListWidget::onCheckboxChangeFromDevice);
    deviceData->itemWidget->setDeviceInfo(connectColor, deviceName, deviceNumber, choose);
    m_listWidget->setItemWidget(item, deviceData->itemWidget);
}

void DeviceListWidget::onDeleteDevice(int deviceIndex)
{
    QListWidgetItem* item = m_listWidget->item(deviceIndex);
    m_listWidget->removeItemWidget(item);
    delete item;
    m_listWidget->setFixedHeight(m_listWidget->count() * ITEM_HEIGHT + 10);
    // 删除一个设备，或者移动一个设备后，当前组显示大小是否改变
    this->setFixedHeight(m_titleBackWidget->height() + m_listWidget->height());

    m_numberLabel->setText(QString::number(m_listWidget->count()));
    emit signalDeviceDeleteFromGoup(groupIndex, deviceIndex);
}

void DeviceListWidget::onDeviceNameChanged(int srcDevice, QString name)
{
    emit signalDeviceNameChangedWithGroup(groupIndex, srcDevice, name);
}

void DeviceListWidget::onCheckboxChangeFromDevice(int deviceIndex, bool choose)
{
    emit signalDeviceCheckboxChangeFromGroup(groupIndex, deviceIndex, choose);
}

void DeviceListWidget::onAddToGroup(int dstGroup, int srcDevice)
{
    emit signalDeviceAddToGroup(dstGroup, groupIndex, srcDevice);
}

// 更新设备某一项状态;
void DeviceListWidget::updateDeviceItem(int rowCount, QColor connectColor, QString deviceName, QString deviceNumber)
{
    QListWidgetItem* item = m_listWidget->item(rowCount);
    if (item != NULL)
    {
        DeviceItemWidget* itemWidget = static_cast<DeviceItemWidget*>(m_listWidget->itemWidget(item));
        itemWidget->setDeviceInfo(connectColor, deviceName, deviceNumber, true);
    }
}

void DeviceListWidget::updateDeviceIndex(int deviceIndex)
{
    QListWidgetItem* item = m_listWidget->item(deviceIndex);
    if (item != NULL)
    {
        DeviceItemWidget* itemWidget = static_cast<DeviceItemWidget*>(m_listWidget->itemWidget(item));
        itemWidget->deviceIndex = deviceIndex;
    }
}

/*==================================设备项部分==================================*/
DeviceItemWidget::DeviceItemWidget(QWidget* parent)
    : QWidget(parent)
{
    initWidget();
    this->setFixedSize(QSize(250, ITEM_HEIGHT));
    // 鼠标经过时改变设备栏颜色
    this->setStyleSheet(".QWidget:hover{background:rgba(200, 200, 200, 150);}");
    QList<NodeDataStruct> *aaa = &CustomTreeWidget::m_nodeDataList;
    qDebug() << aaa->size();
}

void DeviceItemWidget::setDeviceInfo(QColor connectColor, QString deviceName, QString deviceNumber, bool choose)
{
    m_colorWidget->setStyleSheet(QString("QWidget{border-radius:6px;background:rgb(%1, %2, %3);}").arg(connectColor.red()).arg(connectColor.green()).arg(connectColor.blue()));
    m_deviceLabel->setText(deviceName);
    m_deviceLabel->setScaledContents(true);
    m_numberLabel->setText(deviceNumber);
    m_numberLabel->setScaledContents(true);
    m_deviceCheck->setChecked(choose);
}

void DeviceItemWidget::initWidget()
{
    m_colorWidget = new QWidget;
    m_colorWidget->setFixedSize(QSize(12, 12));
    m_deviceLabel = new QLabel;
    m_numberLabel = new QLabel;
    m_deviceCheck = new QCheckBox;

    QHBoxLayout* hLayout = new QHBoxLayout(this);
    hLayout->addWidget(m_colorWidget);
    hLayout->addWidget(m_deviceLabel);
    hLayout->addWidget(m_numberLabel);
    hLayout->addWidget(m_deviceCheck);
    hLayout->addStretch();
    hLayout->setSpacing(15);
    hLayout->setContentsMargins(20, 0, 0, 0);
    // 设备栏右键弹出删除设备、移动到分组
    this->installEventFilter(this);

    connect(m_deviceCheck, SIGNAL(clicked()), this, SLOT(onCheckboxTextGet()));
}

void DeviceItemWidget::onCheckboxTextGet()
{
    QCheckBox *checkbox = (QCheckBox *)sender();
    qDebug() << (checkbox->isChecked() ? "choosed" : "not choosed");
    emit signalCheckboxChangeFromDevice(deviceIndex, checkbox->isChecked());
}

bool DeviceItemWidget::eventFilter(QObject *watched, QEvent *event)
{
    if (watched == this)
    {
        if (event->type() == QEvent::MouseButtonRelease)
        {
            QMouseEvent* mouseEvent = static_cast<QMouseEvent*>(event);
            if (mouseEvent->button() == Qt::RightButton)
            {
                QMenu *buttonMenu = new QMenu(this);
                QAction *buttonAction1 = new QAction(QString::fromLocal8Bit("从分组内移除"), this);
                QAction *buttonAction2 = new QAction(QString::fromLocal8Bit("修改设备名"), this);
                buttonMenu->addAction(buttonAction1);
                buttonMenu->addAction(buttonAction2);
                connect(buttonAction1, &QAction::triggered, [=]()
                {
                    emit signalDeleteDevice(deviceIndex);
                });
                connect(buttonAction2, &QAction::triggered, [=]()
                {
                    bool inputOk;
                    QString text = QInputDialog::getText(NULL, "Input Dialog",
                                           "Please input your comment",
                                           QLineEdit::Normal,
                                           m_deviceLabel->text(),
                                           &inputOk);
                    if (inputOk)
                    {
                        m_deviceLabel->setText(text);
                        m_deviceLabel->adjustSize();
                        emit signalDeviceNameChanged(deviceIndex, text);
                    }
                });

                QMenu *groupList = buttonMenu->addMenu(QString::fromLocal8Bit("移动到分组"));
                int groupCnt = CustomTreeWidget::m_nodeDataList.size();
                for (int i = 0; i < groupCnt; i++)
                {
                    QString str1 = QString::fromLocal8Bit("添加到分组%1: %2")
                            .arg(i + 1).arg(CustomTreeWidget::m_nodeDataList[i].group->groupName);
                    QAction *groupAdd1 = new QAction(str1, this);
                    groupList->addAction(groupAdd1);
                    connect(groupAdd1, &QAction::triggered, [=]()
                    {
                        emit signalAddToGroup(i, deviceIndex);
                    });
                }
                buttonMenu->exec(QCursor::pos());
            }
        }
    }

    return __super::eventFilter(watched, event);
}
