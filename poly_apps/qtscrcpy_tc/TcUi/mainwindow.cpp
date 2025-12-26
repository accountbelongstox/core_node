#include <QDebug>
#include <QLocale>

#include "mainwindow.h"
#include "ui_mainwindow.h"
#include "toolform.h"
#include "dialog.h"
#include "config.h"
#include "languagemanager.h"

using namespace std;

static Dialog *g_mainDlg = Q_NULLPTR;
MainWindow* MainWindow::mainwin = nullptr;

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MainWindow)
{
    ui->setupUi(this);
    mainwin = this;
    m_hideIcon = new QSystemTrayIcon();
    m_hideIcon->setIcon(QIcon(":/image/tray/logo.png"));

    // Setup language UI and auto-detect system language
    setupLanguageUI();
    updateWindowTitle();

    qInfo("XingCan Cloud Matrix starting...");
}

MainWindow::~MainWindow()
{
    delete ui;
}

void MainWindow::on_configbutton_clicked()
{
    g_mainDlg = new Dialog;
    g_mainDlg->setWindowTitle(Config::getInstance().getTitle());
    g_mainDlg->hide();
    g_mainDlg->show();
}

void MainWindow::on_pushButton_clicked()
{
    ui->treewidget->addMyDevice();
}

void MainWindow::on_pushButton_2_clicked()
{
    ui->treewidget->saveDiviceList();
}

void MainWindow::on_languageComboBox_currentIndexChanged(int index)
{
    LanguageManager::Language lang;

    if (index == 0) {
        lang = LanguageManager::English;
    } else if (index == 1) {
        lang = LanguageManager::Chinese;
    } else {
        return;
    }

    LanguageManager::instance().switchLanguage(lang);
}

void MainWindow::setupLanguageUI()
{
    // Get current system language
    LanguageManager::Language currentLang = LanguageManager::instance().currentLanguage();

    // Set combobox to match current language
    if (currentLang == LanguageManager::Chinese) {
        ui->languageComboBox->setCurrentIndex(1);
    } else {
        ui->languageComboBox->setCurrentIndex(0);
    }

    // Connect language change signal
    connect(&LanguageManager::instance(), &LanguageManager::languageChanged,
            this, &MainWindow::retranslateUI);
}

void MainWindow::updateWindowTitle()
{
    LanguageManager::Language currentLang = LanguageManager::instance().currentLanguage();

    if (currentLang == LanguageManager::Chinese) {
        setWindowTitle(QString::fromUtf8("星灿传媒云矩阵"));
    } else {
        setWindowTitle("XingCan Cloud Matrix");
    }
}

void MainWindow::retranslateUI()
{
    qInfo() << "========================================";
    qInfo() << "[UI] Language change event received";
    qInfo() << "[UI] Current language:" << LanguageManager::instance().languageName(
                   LanguageManager::instance().currentLanguage());

    // Update window title when language changes
    qInfo() << "[UI] Updating window title...";
    updateWindowTitle();

    // Retranslate the UI
    qInfo() << "[UI] Retranslating all UI elements...";
    ui->retranslateUi(this);

    qInfo() << "[UI] ✓ UI update complete";
    qInfo() << "[UI] All text elements updated in real-time";
    qInfo() << "========================================";
}

void MainWindow::changeEvent(QEvent *event)
{
    if (event->type() == QEvent::LanguageChange) {
        qInfo() << "[EVENT] QEvent::LanguageChange detected!";
        qInfo() << "[EVENT] Triggering UI retranslation...";
        retranslateUI();
    }
    QMainWindow::changeEvent(event);
}
