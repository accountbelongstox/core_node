# Directory Tree: qtscrcpy_tc

**Path:** `D:\programing\core_node\poly_apps\qtscrcpy_tc`

```
qtscrcpy_tc/
├── SmartMatrix/
│   ├── adb/
│   │   ├── adb.pri
│   │   ├── adbprocess.cpp
│   │   └── adbprocess.h
│   ├── common/
│   │   ├── common.pri
│   │   └── qscrcpyevent.h
│   ├── config/
│   │   ├── config.ini
│   │   └── deviceGroups.json
│   ├── device/
│   │   ├── android/
│   │   │   ├── android.pri
│   │   │   ├── input.h
│   │   │   └── keycodes.h
│   │   ├── controller/
│   │   │   ├── inputconvert/
│   │   │   │   ├── keymap/
│   │   │   │   │   ├── keymap.cpp
│   │   │   │   │   ├── keymap.h
│   │   │   │   │   └── keymap.pri
│   │   │   │   ├── controlmsg.cpp
│   │   │   │   ├── controlmsg.h
│   │   │   │   ├── inputconvert.pri
│   │   │   │   ├── inputconvertbase.cpp
│   │   │   │   ├── inputconvertbase.h
│   │   │   │   ├── inputconvertgame.cpp
│   │   │   │   ├── inputconvertgame.h
│   │   │   │   ├── inputconvertnormal.cpp
│   │   │   │   └── inputconvertnormal.h
│   │   │   ├── receiver/
│   │   │   │   ├── devicemsg.cpp
│   │   │   │   ├── devicemsg.h
│   │   │   │   ├── receiver.cpp
│   │   │   │   ├── receiver.h
│   │   │   │   └── receiver.pri
│   │   │   ├── controller.cpp
│   │   │   ├── controller.h
│   │   │   └── controller.pri
│   │   ├── decoder/
│   │   │   ├── avframeconvert.cpp
│   │   │   ├── avframeconvert.h
│   │   │   ├── decoder.cpp
│   │   │   ├── decoder.h
│   │   │   ├── decoder.pri
│   │   │   ├── fpscounter.cpp
│   │   │   ├── fpscounter.h
│   │   │   ├── videobuffer.cpp
│   │   │   └── videobuffer.h
│   │   ├── filehandler/
│   │   │   ├── filehandler.cpp
│   │   │   ├── filehandler.h
│   │   │   └── filehandler.pri
│   │   ├── recorder/
│   │   │   ├── recorder.cpp
│   │   │   ├── recorder.h
│   │   │   └── recorder.pri
│   │   ├── render/
│   │   │   ├── qyuvopenglwidget.cpp
│   │   │   ├── qyuvopenglwidget.h
│   │   │   └── render.pri
│   │   ├── server/
│   │   │   ├── server.cpp
│   │   │   ├── server.h
│   │   │   ├── server.pri
│   │   │   ├── tcpserver.cpp
│   │   │   ├── tcpserver.h
│   │   │   ├── videosocket.cpp
│   │   │   └── videosocket.h
│   │   ├── stream/
│   │   │   ├── stream.cpp
│   │   │   ├── stream.h
│   │   │   └── stream.pri
│   │   ├── ui/
│   │   │   ├── toolform.cpp
│   │   │   ├── toolform.h
│   │   │   ├── toolform.ui
│   │   │   ├── ui.pri
│   │   │   ├── videoform.cpp
│   │   │   ├── videoform.h
│   │   │   └── videoform.ui
│   │   ├── device.cpp
│   │   ├── device.h
│   │   └── device.pri
│   ├── devicemanage/
│   │   ├── devicemanage.cpp
│   │   ├── devicemanage.h
│   │   └── devicemanage.pri
│   ├── fontawesome/
│   │   ├── fontawesome.pri
│   │   ├── iconhelper.cpp
│   │   └── iconhelper.h
│   ├── groupmanage/
│   │   ├── customtreewidget/
│   │   │   ├── CustomTreeWidget.cpp
│   │   │   ├── CustomTreeWidget.h
│   │   │   ├── CustomTreeWidget.ui
│   │   │   └── customtreewidget.pri
│   │   └── devicegroups/
│   │       ├── devicegroups.cpp
│   │       ├── devicegroups.h
│   │       └── devicegroups.pri
│   ├── keymap/
│   │   ├── FRAG.json
│   │   ├── gameforpeace.json
│   │   ├── identityv.json
│   │   ├── test.json
│   │   └── tiktok.json
│   ├── res/
│   │   ├── font/
│   │   │   ├── fontawesome-webfont.pdf
│   │   │   └── fontawesome-webfont.ttf
│   │   ├── i18n/
│   │   │   ├── QtScrcpy_en.qm
│   │   │   ├── QtScrcpy_en.ts
│   │   │   ├── QtScrcpy_zh.qm
│   │   │   ├── QtScrcpy_zh.ts
│   │   │   ├── myTc_zh_CN.qm
│   │   │   └── myTc_zh_CN.ts
│   │   ├── image/
│   │   │   └── tray/
│   │   │       └── logo.png
│   │   ├── qss/
│   │   │   ├── psblack/
│   │   │   │   ├── add_bottom.png
│   │   │   │   ├── add_left.png
│   │   │   │   ├── add_right.png
│   │   │   │   ├── add_top.png
│   │   │   │   ├── branch_close.png
│   │   │   │   ├── branch_open.png
│   │   │   │   ├── calendar_nextmonth.png
│   │   │   │   ├── calendar_prevmonth.png
│   │   │   │   ├── checkbox_checked.png
│   │   │   │   ├── checkbox_checked_disable.png
│   │   │   │   ├── checkbox_parcial.png
│   │   │   │   ├── checkbox_parcial_disable.png
│   │   │   │   ├── checkbox_unchecked.png
│   │   │   │   ├── checkbox_unchecked_disable.png
│   │   │   │   ├── radiobutton_checked.png
│   │   │   │   ├── radiobutton_checked_disable.png
│   │   │   │   ├── radiobutton_unchecked.png
│   │   │   │   └── radiobutton_unchecked_disable.png
│   │   │   └── psblack.css
│   │   ├── SmartMatrix.ico
│   │   ├── SmartMatrix.rc
│   │   └── res.qrc
│   ├── server/
│   │   ├── config/
│   │   │   └── android-checkstyle.gradle
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── aidl/
│   │   │   │   │   └── android/
│   │   │   │   │       ├── content/
│   │   │   │   │       │   └── IOnPrimaryClipChangedListener.aidl
│   │   │   │   │       └── view/
│   │   │   │   │           └── IRotationWatcher.aidl
│   │   │   │   ├── java/
│   │   │   │   │   └── com/
│   │   │   │   │       └── genymobile/
│   │   │   │   │           └── scrcpy/
│   │   │   │   │               ├── wrappers/
│   │   │   │   │               │   ├── ActivityManager.java
│   │   │   │   │               │   ├── ClipboardManager.java
│   │   │   │   │               │   ├── ContentProvider.java
│   │   │   │   │               │   ├── DisplayManager.java
│   │   │   │   │               │   ├── InputManager.java
│   │   │   │   │               │   ├── PowerManager.java
│   │   │   │   │               │   ├── ServiceManager.java
│   │   │   │   │               │   ├── StatusBarManager.java
│   │   │   │   │               │   ├── SurfaceControl.java
│   │   │   │   │               │   └── WindowManager.java
│   │   │   │   │               ├── CleanUp.java
│   │   │   │   │               ├── CodecOption.java
│   │   │   │   │               ├── ControlMessage.java
│   │   │   │   │               ├── ControlMessageReader.java
│   │   │   │   │               ├── Controller.java
│   │   │   │   │               ├── DesktopConnection.java
│   │   │   │   │               ├── Device.java
│   │   │   │   │               ├── DeviceMessage.java
│   │   │   │   │               ├── DeviceMessageSender.java
│   │   │   │   │               ├── DeviceMessageWriter.java
│   │   │   │   │               ├── DisplayInfo.java
│   │   │   │   │               ├── IO.java
│   │   │   │   │               ├── InvalidDisplayIdException.java
│   │   │   │   │               ├── KeyComposition.java
│   │   │   │   │               ├── Ln.java
│   │   │   │   │               ├── Options.java
│   │   │   │   │               ├── Point.java
│   │   │   │   │               ├── Pointer.java
│   │   │   │   │               ├── PointersState.java
│   │   │   │   │               ├── Position.java
│   │   │   │   │               ├── ScreenEncoder.java
│   │   │   │   │               ├── ScreenInfo.java
│   │   │   │   │               ├── Server.java
│   │   │   │   │               ├── Size.java
│   │   │   │   │               ├── StringUtils.java
│   │   │   │   │               └── Workarounds.java
│   │   │   │   └── AndroidManifest.xml
│   │   │   └── test/
│   │   │       └── java/
│   │   │           └── com/
│   │   │               └── genymobile/
│   │   │                   └── scrcpy/
│   │   │                       ├── CodecOptionsTest.java
│   │   │                       ├── ControlMessageReaderTest.java
│   │   │                       ├── DeviceMessageWriterTest.java
│   │   │                       └── StringUtilsTest.java
│   │   └── proguard-rules.pro
│   ├── third_party/
│   │   ├── adb/
│   │   │   ├── linux/
│   │   │   │   └── adb
│   │   │   └── mac/
│   │   │       └── adb
│   │   ├── ffmpeg/
│   │   │   ├── include/
│   │   │   │   ├── libavcodec/
│   │   │   │   │   ├── ac3_parser.h
│   │   │   │   │   ├── adts_parser.h
│   │   │   │   │   ├── avcodec.h
│   │   │   │   │   ├── avdct.h
│   │   │   │   │   ├── avfft.h
│   │   │   │   │   ├── d3d11va.h
│   │   │   │   │   ├── dirac.h
│   │   │   │   │   ├── dv_profile.h
│   │   │   │   │   ├── dxva2.h
│   │   │   │   │   ├── jni.h
│   │   │   │   │   ├── mediacodec.h
│   │   │   │   │   ├── qsv.h
│   │   │   │   │   ├── vaapi.h
│   │   │   │   │   ├── vdpau.h
│   │   │   │   │   ├── version.h
│   │   │   │   │   ├── videotoolbox.h
│   │   │   │   │   ├── vorbis_parser.h
│   │   │   │   │   └── xvmc.h
│   │   │   │   ├── libavformat/
│   │   │   │   │   ├── avformat.h
│   │   │   │   │   ├── avio.h
│   │   │   │   │   └── version.h
│   │   │   │   ├── libavutil/
│   │   │   │   │   ├── adler32.h
│   │   │   │   │   ├── aes.h
│   │   │   │   │   ├── aes_ctr.h
│   │   │   │   │   ├── attributes.h
│   │   │   │   │   ├── audio_fifo.h
│   │   │   │   │   ├── avassert.h
│   │   │   │   │   ├── avconfig.h
│   │   │   │   │   ├── avstring.h
│   │   │   │   │   ├── avutil.h
│   │   │   │   │   ├── base64.h
│   │   │   │   │   ├── blowfish.h
│   │   │   │   │   ├── bprint.h
│   │   │   │   │   ├── bswap.h
│   │   │   │   │   ├── buffer.h
│   │   │   │   │   ├── camellia.h
│   │   │   │   │   ├── cast5.h
│   │   │   │   │   ├── channel_layout.h
│   │   │   │   │   ├── common.h
│   │   │   │   │   ├── cpu.h
│   │   │   │   │   ├── crc.h
│   │   │   │   │   ├── des.h
│   │   │   │   │   ├── dict.h
│   │   │   │   │   ├── display.h
│   │   │   │   │   ├── downmix_info.h
│   │   │   │   │   ├── encryption_info.h
│   │   │   │   │   ├── error.h
│   │   │   │   │   ├── eval.h
│   │   │   │   │   ├── ffversion.h
│   │   │   │   │   ├── fifo.h
│   │   │   │   │   ├── file.h
│   │   │   │   │   ├── frame.h
│   │   │   │   │   ├── hash.h
│   │   │   │   │   ├── hdr_dynamic_metadata.h
│   │   │   │   │   ├── hmac.h
│   │   │   │   │   ├── hwcontext.h
│   │   │   │   │   ├── hwcontext_cuda.h
│   │   │   │   │   ├── hwcontext_d3d11va.h
│   │   │   │   │   ├── hwcontext_drm.h
│   │   │   │   │   ├── hwcontext_dxva2.h
│   │   │   │   │   ├── hwcontext_mediacodec.h
│   │   │   │   │   ├── hwcontext_qsv.h
│   │   │   │   │   ├── hwcontext_vaapi.h
│   │   │   │   │   ├── hwcontext_vdpau.h
│   │   │   │   │   ├── hwcontext_videotoolbox.h
│   │   │   │   │   ├── imgutils.h
│   │   │   │   │   ├── intfloat.h
│   │   │   │   │   ├── intreadwrite.h
│   │   │   │   │   ├── lfg.h
│   │   │   │   │   ├── log.h
│   │   │   │   │   ├── lzo.h
│   │   │   │   │   ├── macros.h
│   │   │   │   │   ├── mastering_display_metadata.h
│   │   │   │   │   ├── mathematics.h
│   │   │   │   │   ├── md5.h
│   │   │   │   │   ├── mem.h
│   │   │   │   │   ├── motion_vector.h
│   │   │   │   │   ├── murmur3.h
│   │   │   │   │   ├── opt.h
│   │   │   │   │   ├── parseutils.h
│   │   │   │   │   ├── pixdesc.h
│   │   │   │   │   ├── pixelutils.h
│   │   │   │   │   ├── pixfmt.h
│   │   │   │   │   ├── random_seed.h
│   │   │   │   │   ├── rational.h
│   │   │   │   │   ├── rc4.h
│   │   │   │   │   ├── replaygain.h
│   │   │   │   │   ├── ripemd.h
│   │   │   │   │   ├── samplefmt.h
│   │   │   │   │   ├── sha.h
│   │   │   │   │   ├── sha512.h
│   │   │   │   │   ├── spherical.h
│   │   │   │   │   ├── stereo3d.h
│   │   │   │   │   ├── tea.h
│   │   │   │   │   ├── threadmessage.h
│   │   │   │   │   ├── time.h
│   │   │   │   │   ├── timecode.h
│   │   │   │   │   ├── timestamp.h
│   │   │   │   │   ├── tree.h
│   │   │   │   │   ├── twofish.h
│   │   │   │   │   ├── tx.h
│   │   │   │   │   ├── version.h
│   │   │   │   │   └── xtea.h
│   │   │   │   ├── libswresample/
│   │   │   │   │   ├── swresample.h
│   │   │   │   │   └── version.h
│   │   │   │   └── libswscale/
│   │   │   │       ├── swscale.h
│   │   │   │       └── version.h
│   │   │   └── lib/
│   │   │       ├── x64/
│   │   │       │   ├── avcodec.lib
│   │   │       │   ├── avformat.lib
│   │   │       │   ├── avutil.lib
│   │   │       │   ├── swresample.lib
│   │   │       │   └── swscale.lib
│   │   │       ├── x86/
│   │   │       │   ├── avcodec.lib
│   │   │       │   ├── avformat.lib
│   │   │       │   ├── avutil.lib
│   │   │       │   ├── swresample.lib
│   │   │       │   └── swscale.lib
│   │   │       ├── libavcodec.a
│   │   │       ├── libavformat.a
│   │   │       ├── libavutil.a
│   │   │       ├── libswresample.a
│   │   │       └── libswscale.a
│   │   └── scrcpy-server
│   ├── ui/
│   │   ├── customtitlebar.cpp
│   │   └── customtitlebar.h
│   ├── uibase/
│   │   ├── keepratiowidget.cpp
│   │   ├── keepratiowidget.h
│   │   ├── magneticwidget.cpp
│   │   ├── magneticwidget.h
│   │   └── uibase.pri
│   ├── util/
│   │   ├── mousetap/
│   │   │   ├── cocoamousetap.h
│   │   │   ├── cocoamousetap.mm
│   │   │   ├── mousetap.cpp
│   │   │   ├── mousetap.h
│   │   │   ├── mousetap.pri
│   │   │   ├── winmousetap.cpp
│   │   │   ├── winmousetap.h
│   │   │   ├── xmousetap.cpp
│   │   │   └── xmousetap.h
│   │   ├── bufferutil.cpp
│   │   ├── bufferutil.h
│   │   ├── compat.h
│   │   ├── config.cpp
│   │   ├── config.h
│   │   ├── logout.cpp
│   │   ├── logout.h
│   │   └── util.pri
│   ├── .gitignore
│   ├── SmartMatrix.pro
│   ├── dialog.cpp
│   ├── dialog.h
│   ├── dialog.ui
│   ├── main.cpp
│   ├── mainwindow.cpp
│   ├── mainwindow.h
│   ├── mainwindow.ui
│   └── version.txt
├── config/
│   └── userdata.ini
├── dev_docs/
│   ├── 01_architecture_analysis.md
│   ├── 02_custom_titlebar_design.md
│   ├── 03_implementation_summary.md
│   └── README.md
├── docs/
│   ├── TC软件文档.md
│   ├── TC软件概要设计文档.docx
│   ├── TC软件详细设计文档.docx
│   ├── i18n_migration_plan.md
│   └── upFixCharNewQtScrapy.md
├── scripts/
│   └── README.md
├── test/
│   ├── 01_mainwindow/
│   │   ├── main.cpp
│   │   ├── mainwindow.cpp
│   │   ├── mainwindow.h
│   │   ├── mainwindow.ui
│   │   ├── qt_learn.pro
│   │   ├── qt_learn.pro.qt5_backup
│   │   ├── qt_learn_zh_CN.ts
│   │   └── readme.md
│   ├── 02_widget/
│   │   ├── .gitignore
│   │   ├── 02_widget.pro
│   │   ├── 02_widget.pro.qt5_backup
│   │   ├── 02_widget_zh_CN.ts
│   │   ├── main.cpp
│   │   ├── widget.cpp
│   │   ├── widget.h
│   │   └── widget.ui
│   ├── 03_dialog/
│   │   ├── .gitignore
│   │   ├── 03_dialog.pro
│   │   ├── 03_dialog.pro.qt5_backup
│   │   ├── dialog.cpp
│   │   ├── dialog.h
│   │   ├── dialog.ui
│   │   └── main.cpp
│   ├── 04_multWindow/
│   │   ├── 04_multWindow1.pro
│   │   ├── 04_multWindow1.pro.qt5_backup
│   │   ├── 04_multWindow1_zh_CN.ts
│   │   ├── main.cpp
│   │   ├── mywidget.cpp
│   │   ├── mywidget.h
│   │   └── mywidget.ui
│   ├── 05_quick/
│   │   ├── 05_quick.qml
│   │   ├── 05_quick.qmlproject
│   │   └── quick.qml
│   ├── 06_windowSwitch/
│   │   ├── 06_windowSwitch.pro
│   │   ├── 06_windowSwitch.pro.qt5_backup
│   │   ├── 06_windowSwitch_zh_CN.ts
│   │   ├── main.cpp
│   │   ├── mainwindow.cpp
│   │   ├── mainwindow.h
│   │   └── mainwindow.ui
│   ├── 07_dynamicWindow/
│   │   ├── 07_dynamicWindow.pro
│   │   ├── 07_dynamicWindow.pro.qt5_backup
│   │   ├── 07_dynamicWindow_zh_CN.ts
│   │   ├── main.cpp
│   │   ├── mainwindow.cpp
│   │   ├── mainwindow.h
│   │   └── mainwindow.ui
│   ├── 08_dynamicDialog_passed/
│   │   ├── 8_dynamicDialog.pro
│   │   ├── 8_dynamicDialog.pro.qt5_backup
│   │   ├── 8_dynamicDialog_zh_CN.ts
│   │   ├── dialog.cpp
│   │   ├── dialog.h
│   │   ├── dialog.ui
│   │   └── main.cpp
│   ├── 09_multiWindow/
│   │   ├── 09_multiWindow.pro
│   │   ├── 09_multiWindow.pro.qt5_backup
│   │   ├── 09_multiWindow_zh_CN.ts
│   │   ├── main.cpp
│   │   ├── mainwindow.cpp
│   │   ├── mainwindow.h
│   │   └── mainwindow.ui
│   ├── 10_verticalLayout/
│   │   ├── 10_verticalLayout.pro
│   │   ├── 10_verticalLayout.pro.qt5_backup
│   │   ├── 10_verticalLayout_zh_CN.ts
│   │   ├── main.cpp
│   │   ├── widget.cpp
│   │   ├── widget.h
│   │   └── widget.ui
│   ├── 11_mytc_dynamicWidget/
│   │   ├── main.cpp
│   │   ├── mytc.pro
│   │   ├── mytc.pro.qt5_backup
│   │   ├── mytc_zh_CN.ts
│   │   ├── mytcwindow.cpp
│   │   ├── mytcwindow.h
│   │   ├── mytcwindow.ui
│   │   ├── videopanel.cpp
│   │   └── videopanel.h
│   ├── 12_gridLayout/
│   │   ├── 12_gridLayout.pro
│   │   ├── 12_gridLayout.pro.qt5_backup
│   │   ├── main.cpp
│   │   ├── mainwindow.cpp
│   │   ├── mainwindow.h
│   │   └── mainwindow.ui
│   ├── 13_dynamicList/
│   │   ├── 13_dynamicList.pro
│   │   ├── 13_dynamicList.pro.qt5_backup
│   │   ├── main.cpp
│   │   ├── mainwindow.cpp
│   │   ├── mainwindow.h
│   │   └── mainwindow.ui
│   ├── 14_dynamicList_used/
│   │   ├── 14_dynamicList.pro
│   │   ├── 14_dynamicList.pro.qt5_backup
│   │   ├── CustomTreeWidget.cpp
│   │   ├── CustomTreeWidget.h
│   │   ├── CustomTreeWidget.ui
│   │   └── main.cpp
│   ├── 15_dynamicList/
│   │   ├── 15_dynamicList.pro
│   │   ├── 15_dynamicList.pro.qt5_backup
│   │   ├── LockerButton.cpp
│   │   ├── LockerButton.h
│   │   ├── LockerWidget.cpp
│   │   ├── LockerWidget.h
│   │   ├── LockerWidget.ui
│   │   └── main.cpp
│   ├── 16_myTc/
│   │   ├── adb/
│   │   │   ├── adb.pri
│   │   │   ├── adbprocess.cpp
│   │   │   └── adbprocess.h
│   │   ├── common/
│   │   │   ├── common.pri
│   │   │   └── qscrcpyevent.h
│   │   ├── config/
│   │   │   └── config.ini
│   │   ├── device/
│   │   │   ├── android/
│   │   │   │   ├── android.pri
│   │   │   │   ├── input.h
│   │   │   │   └── keycodes.h
│   │   │   ├── controller/
│   │   │   │   ├── inputconvert/
│   │   │   │   │   ├── keymap/
│   │   │   │   │   │   ├── keymap.cpp
│   │   │   │   │   │   ├── keymap.h
│   │   │   │   │   │   └── keymap.pri
│   │   │   │   │   ├── controlmsg.cpp
│   │   │   │   │   ├── controlmsg.h
│   │   │   │   │   ├── inputconvert.pri
│   │   │   │   │   ├── inputconvertbase.cpp
│   │   │   │   │   ├── inputconvertbase.h
│   │   │   │   │   ├── inputconvertgame.cpp
│   │   │   │   │   ├── inputconvertgame.h
│   │   │   │   │   ├── inputconvertnormal.cpp
│   │   │   │   │   └── inputconvertnormal.h
│   │   │   │   ├── receiver/
│   │   │   │   │   ├── devicemsg.cpp
│   │   │   │   │   ├── devicemsg.h
│   │   │   │   │   ├── receiver.cpp
│   │   │   │   │   ├── receiver.h
│   │   │   │   │   └── receiver.pri
│   │   │   │   ├── controller.cpp
│   │   │   │   ├── controller.h
│   │   │   │   └── controller.pri
│   │   │   ├── decoder/
│   │   │   │   ├── avframeconvert.cpp
│   │   │   │   ├── avframeconvert.h
│   │   │   │   ├── decoder.cpp
│   │   │   │   ├── decoder.h
│   │   │   │   ├── decoder.pri
│   │   │   │   ├── fpscounter.cpp
│   │   │   │   ├── fpscounter.h
│   │   │   │   ├── videobuffer.cpp
│   │   │   │   └── videobuffer.h
│   │   │   ├── filehandler/
│   │   │   │   ├── filehandler.cpp
│   │   │   │   ├── filehandler.h
│   │   │   │   └── filehandler.pri
│   │   │   ├── recorder/
│   │   │   │   ├── recorder.cpp
│   │   │   │   ├── recorder.h
│   │   │   │   └── recorder.pri
│   │   │   ├── render/
│   │   │   │   ├── qyuvopenglwidget.cpp
│   │   │   │   ├── qyuvopenglwidget.h
│   │   │   │   └── render.pri
│   │   │   ├── server/
│   │   │   │   ├── server.cpp
│   │   │   │   ├── server.h
│   │   │   │   ├── server.pri
│   │   │   │   ├── tcpserver.cpp
│   │   │   │   ├── tcpserver.h
│   │   │   │   ├── videosocket.cpp
│   │   │   │   └── videosocket.h
│   │   │   ├── stream/
│   │   │   │   ├── stream.cpp
│   │   │   │   ├── stream.h
│   │   │   │   └── stream.pri
│   │   │   ├── ui/
│   │   │   │   ├── toolform.cpp
│   │   │   │   ├── toolform.h
│   │   │   │   ├── toolform.ui
│   │   │   │   ├── ui.pri
│   │   │   │   ├── videoform.cpp
│   │   │   │   ├── videoform.h
│   │   │   │   └── videoform.ui
│   │   │   ├── device.cpp
│   │   │   ├── device.h
│   │   │   └── device.pri
│   │   ├── devicemanage/
│   │   │   ├── devicemanage.cpp
│   │   │   ├── devicemanage.h
│   │   │   └── devicemanage.pri
│   │   ├── fontawesome/
│   │   │   ├── fontawesome.pri
│   │   │   ├── iconhelper.cpp
│   │   │   └── iconhelper.h
│   │   ├── keymap/
│   │   │   ├── FRAG.json
│   │   │   ├── gameforpeace.json
│   │   │   ├── identityv.json
│   │   │   ├── test.json
│   │   │   └── tiktok.json
│   │   ├── res/
│   │   │   ├── font/
│   │   │   │   ├── fontawesome-webfont.pdf
│   │   │   │   └── fontawesome-webfont.ttf
│   │   │   ├── i18n/
│   │   │   │   ├── QtScrcpy_en.qm
│   │   │   │   ├── QtScrcpy_en.ts
│   │   │   │   ├── QtScrcpy_zh.qm
│   │   │   │   ├── QtScrcpy_zh.ts
│   │   │   │   └── myTc_zh_CN.ts
│   │   │   ├── image/
│   │   │   │   ├── tray/
│   │   │   │   │   └── logo.png
│   │   │   │   └── videoform/
│   │   │   │       ├── phone-h.png
│   │   │   │       └── phone-v.png
│   │   │   ├── qss/
│   │   │   │   ├── psblack/
│   │   │   │   │   ├── add_bottom.png
│   │   │   │   │   ├── add_left.png
│   │   │   │   │   ├── add_right.png
│   │   │   │   │   ├── add_top.png
│   │   │   │   │   ├── branch_close.png
│   │   │   │   │   ├── branch_open.png
│   │   │   │   │   ├── calendar_nextmonth.png
│   │   │   │   │   ├── calendar_prevmonth.png
│   │   │   │   │   ├── checkbox_checked.png
│   │   │   │   │   ├── checkbox_checked_disable.png
│   │   │   │   │   ├── checkbox_parcial.png
│   │   │   │   │   ├── checkbox_parcial_disable.png
│   │   │   │   │   ├── checkbox_unchecked.png
│   │   │   │   │   ├── checkbox_unchecked_disable.png
│   │   │   │   │   ├── radiobutton_checked.png
│   │   │   │   │   ├── radiobutton_checked_disable.png
│   │   │   │   │   ├── radiobutton_unchecked.png
│   │   │   │   │   └── radiobutton_unchecked_disable.png
│   │   │   │   └── psblack.css
│   │   │   ├── Info_Mac.plist
│   │   │   ├── QtScrcpy.icns
│   │   │   ├── QtScrcpy.ico
│   │   │   ├── QtScrcpy.rc
│   │   │   └── res.qrc
│   │   ├── server/
│   │   │   ├── config/
│   │   │   │   └── android-checkstyle.gradle
│   │   │   ├── src/
│   │   │   │   ├── main/
│   │   │   │   │   ├── aidl/
│   │   │   │   │   │   └── android/
│   │   │   │   │   │       ├── content/
│   │   │   │   │   │       │   └── IOnPrimaryClipChangedListener.aidl
│   │   │   │   │   │       └── view/
│   │   │   │   │   │           └── IRotationWatcher.aidl
│   │   │   │   │   ├── java/
│   │   │   │   │   │   └── com/
│   │   │   │   │   │       └── genymobile/
│   │   │   │   │   │           └── scrcpy/
│   │   │   │   │   │               ├── wrappers/
│   │   │   │   │   │               │   ├── ActivityManager.java
│   │   │   │   │   │               │   ├── ClipboardManager.java
│   │   │   │   │   │               │   ├── ContentProvider.java
│   │   │   │   │   │               │   ├── DisplayManager.java
│   │   │   │   │   │               │   ├── InputManager.java
│   │   │   │   │   │               │   ├── PowerManager.java
│   │   │   │   │   │               │   ├── ServiceManager.java
│   │   │   │   │   │               │   ├── StatusBarManager.java
│   │   │   │   │   │               │   ├── SurfaceControl.java
│   │   │   │   │   │               │   └── WindowManager.java
│   │   │   │   │   │               ├── CleanUp.java
│   │   │   │   │   │               ├── CodecOption.java
│   │   │   │   │   │               ├── ControlMessage.java
│   │   │   │   │   │               ├── ControlMessageReader.java
│   │   │   │   │   │               ├── Controller.java
│   │   │   │   │   │               ├── DesktopConnection.java
│   │   │   │   │   │               ├── Device.java
│   │   │   │   │   │               ├── DeviceMessage.java
│   │   │   │   │   │               ├── DeviceMessageSender.java
│   │   │   │   │   │               ├── DeviceMessageWriter.java
│   │   │   │   │   │               ├── DisplayInfo.java
│   │   │   │   │   │               ├── IO.java
│   │   │   │   │   │               ├── InvalidDisplayIdException.java
│   │   │   │   │   │               ├── KeyComposition.java
│   │   │   │   │   │               ├── Ln.java
│   │   │   │   │   │               ├── Options.java
│   │   │   │   │   │               ├── Point.java
│   │   │   │   │   │               ├── Pointer.java
│   │   │   │   │   │               ├── PointersState.java
│   │   │   │   │   │               ├── Position.java
│   │   │   │   │   │               ├── ScreenEncoder.java
│   │   │   │   │   │               ├── ScreenInfo.java
│   │   │   │   │   │               ├── Server.java
│   │   │   │   │   │               ├── Size.java
│   │   │   │   │   │               ├── StringUtils.java
│   │   │   │   │   │               └── Workarounds.java
│   │   │   │   │   └── AndroidManifest.xml
│   │   │   │   └── test/
│   │   │   │       └── java/
│   │   │   │           └── com/
│   │   │   │               └── genymobile/
│   │   │   │                   └── scrcpy/
│   │   │   │                       ├── CodecOptionsTest.java
│   │   │   │                       ├── ControlMessageReaderTest.java
│   │   │   │                       ├── DeviceMessageWriterTest.java
│   │   │   │                       └── StringUtilsTest.java
│   │   │   ├── proguard-rules.pro
│   │   │   └── proguard-rules.pro.qt5_backup
│   │   ├── third_party/
│   │   │   ├── adb/
│   │   │   │   ├── linux/
│   │   │   │   │   └── adb
│   │   │   │   └── mac/
│   │   │   │       └── adb
│   │   │   ├── ffmpeg/
│   │   │   │   ├── include/
│   │   │   │   │   ├── libavcodec/
│   │   │   │   │   │   ├── ac3_parser.h
│   │   │   │   │   │   ├── adts_parser.h
│   │   │   │   │   │   ├── avcodec.h
│   │   │   │   │   │   ├── avdct.h
│   │   │   │   │   │   ├── avfft.h
│   │   │   │   │   │   ├── d3d11va.h
│   │   │   │   │   │   ├── dirac.h
│   │   │   │   │   │   ├── dv_profile.h
│   │   │   │   │   │   ├── dxva2.h
│   │   │   │   │   │   ├── jni.h
│   │   │   │   │   │   ├── mediacodec.h
│   │   │   │   │   │   ├── qsv.h
│   │   │   │   │   │   ├── vaapi.h
│   │   │   │   │   │   ├── vdpau.h
│   │   │   │   │   │   ├── version.h
│   │   │   │   │   │   ├── videotoolbox.h
│   │   │   │   │   │   ├── vorbis_parser.h
│   │   │   │   │   │   └── xvmc.h
│   │   │   │   │   ├── libavformat/
│   │   │   │   │   │   ├── avformat.h
│   │   │   │   │   │   ├── avio.h
│   │   │   │   │   │   └── version.h
│   │   │   │   │   ├── libavutil/
│   │   │   │   │   │   ├── adler32.h
│   │   │   │   │   │   ├── aes.h
│   │   │   │   │   │   ├── aes_ctr.h
│   │   │   │   │   │   ├── attributes.h
│   │   │   │   │   │   ├── audio_fifo.h
│   │   │   │   │   │   ├── avassert.h
│   │   │   │   │   │   ├── avconfig.h
│   │   │   │   │   │   ├── avstring.h
│   │   │   │   │   │   ├── avutil.h
│   │   │   │   │   │   ├── base64.h
│   │   │   │   │   │   ├── blowfish.h
│   │   │   │   │   │   ├── bprint.h
│   │   │   │   │   │   ├── bswap.h
│   │   │   │   │   │   ├── buffer.h
│   │   │   │   │   │   ├── camellia.h
│   │   │   │   │   │   ├── cast5.h
│   │   │   │   │   │   ├── channel_layout.h
│   │   │   │   │   │   ├── common.h
│   │   │   │   │   │   ├── cpu.h
│   │   │   │   │   │   ├── crc.h
│   │   │   │   │   │   ├── des.h
│   │   │   │   │   │   ├── dict.h
│   │   │   │   │   │   ├── display.h
│   │   │   │   │   │   ├── downmix_info.h
│   │   │   │   │   │   ├── encryption_info.h
│   │   │   │   │   │   ├── error.h
│   │   │   │   │   │   ├── eval.h
│   │   │   │   │   │   ├── ffversion.h
│   │   │   │   │   │   ├── fifo.h
│   │   │   │   │   │   ├── file.h
│   │   │   │   │   │   ├── frame.h
│   │   │   │   │   │   ├── hash.h
│   │   │   │   │   │   ├── hdr_dynamic_metadata.h
│   │   │   │   │   │   ├── hmac.h
│   │   │   │   │   │   ├── hwcontext.h
│   │   │   │   │   │   ├── hwcontext_cuda.h
│   │   │   │   │   │   ├── hwcontext_d3d11va.h
│   │   │   │   │   │   ├── hwcontext_drm.h
│   │   │   │   │   │   ├── hwcontext_dxva2.h
│   │   │   │   │   │   ├── hwcontext_mediacodec.h
│   │   │   │   │   │   ├── hwcontext_qsv.h
│   │   │   │   │   │   ├── hwcontext_vaapi.h
│   │   │   │   │   │   ├── hwcontext_vdpau.h
│   │   │   │   │   │   ├── hwcontext_videotoolbox.h
│   │   │   │   │   │   ├── imgutils.h
│   │   │   │   │   │   ├── intfloat.h
│   │   │   │   │   │   ├── intreadwrite.h
│   │   │   │   │   │   ├── lfg.h
│   │   │   │   │   │   ├── log.h
│   │   │   │   │   │   ├── lzo.h
│   │   │   │   │   │   ├── macros.h
│   │   │   │   │   │   ├── mastering_display_metadata.h
│   │   │   │   │   │   ├── mathematics.h
│   │   │   │   │   │   ├── md5.h
│   │   │   │   │   │   ├── mem.h
│   │   │   │   │   │   ├── motion_vector.h
│   │   │   │   │   │   ├── murmur3.h
│   │   │   │   │   │   ├── opt.h
│   │   │   │   │   │   ├── parseutils.h
│   │   │   │   │   │   ├── pixdesc.h
│   │   │   │   │   │   ├── pixelutils.h
│   │   │   │   │   │   ├── pixfmt.h
│   │   │   │   │   │   ├── random_seed.h
│   │   │   │   │   │   ├── rational.h
│   │   │   │   │   │   ├── rc4.h
│   │   │   │   │   │   ├── replaygain.h
│   │   │   │   │   │   ├── ripemd.h
│   │   │   │   │   │   ├── samplefmt.h
│   │   │   │   │   │   ├── sha.h
│   │   │   │   │   │   ├── sha512.h
│   │   │   │   │   │   ├── spherical.h
│   │   │   │   │   │   ├── stereo3d.h
│   │   │   │   │   │   ├── tea.h
│   │   │   │   │   │   ├── threadmessage.h
│   │   │   │   │   │   ├── time.h
│   │   │   │   │   │   ├── timecode.h
│   │   │   │   │   │   ├── timestamp.h
│   │   │   │   │   │   ├── tree.h
│   │   │   │   │   │   ├── twofish.h
│   │   │   │   │   │   ├── tx.h
│   │   │   │   │   │   ├── version.h
│   │   │   │   │   │   └── xtea.h
│   │   │   │   │   ├── libswresample/
│   │   │   │   │   │   ├── swresample.h
│   │   │   │   │   │   └── version.h
│   │   │   │   │   └── libswscale/
│   │   │   │   │       ├── swscale.h
│   │   │   │   │       └── version.h
│   │   │   │   └── lib/
│   │   │   │       ├── x64/
│   │   │   │       │   ├── avcodec.lib
│   │   │   │       │   ├── avformat.lib
│   │   │   │       │   ├── avutil.lib
│   │   │   │       │   ├── swresample.lib
│   │   │   │       │   └── swscale.lib
│   │   │   │       ├── x86/
│   │   │   │       │   ├── avcodec.lib
│   │   │   │       │   ├── avformat.lib
│   │   │   │       │   ├── avutil.lib
│   │   │   │       │   ├── swresample.lib
│   │   │   │       │   └── swscale.lib
│   │   │   │       ├── libavcodec.a
│   │   │   │       ├── libavformat.a
│   │   │   │       ├── libavutil.a
│   │   │   │       ├── libswresample.a
│   │   │   │       └── libswscale.a
│   │   │   └── scrcpy-server
│   │   ├── uibase/
│   │   │   ├── keepratiowidget.cpp
│   │   │   ├── keepratiowidget.h
│   │   │   ├── magneticwidget.cpp
│   │   │   ├── magneticwidget.h
│   │   │   └── uibase.pri
│   │   ├── util/
│   │   │   ├── mousetap/
│   │   │   │   ├── cocoamousetap.h
│   │   │   │   ├── cocoamousetap.mm
│   │   │   │   ├── mousetap.cpp
│   │   │   │   ├── mousetap.h
│   │   │   │   ├── mousetap.pri
│   │   │   │   ├── winmousetap.cpp
│   │   │   │   ├── winmousetap.h
│   │   │   │   ├── xmousetap.cpp
│   │   │   │   └── xmousetap.h
│   │   │   ├── bufferutil.cpp
│   │   │   ├── bufferutil.h
│   │   │   ├── compat.h
│   │   │   ├── config.cpp
│   │   │   ├── config.h
│   │   │   └── util.pri
│   │   ├── .gitignore
│   │   ├── dialog.cpp
│   │   ├── dialog.h
│   │   ├── dialog.ui
│   │   ├── main.cpp
│   │   ├── mainwindow.cpp
│   │   ├── mainwindow.h
│   │   ├── mainwindow.ui
│   │   ├── myTc.pro
│   │   ├── myTc.pro.qt5_backup
│   │   └── version
│   ├── 18_jsonReadWrite/
│   │   ├── 18_jsonReadWrite.pro
│   │   ├── 18_jsonReadWrite.pro.qt5_backup
│   │   └── main.cpp
│   └── 19_textDoubleClickEdit/
│       ├── 19_textDoubleClickEdit.pro
│       ├── 19_textDoubleClickEdit.pro.qt5_backup
│       ├── main.cpp
│       ├── mainwindow.cpp
│       ├── mainwindow.h
│       └── mainwindow.ui
├── .gitignore
├── QT6_MIGRATION_ANALYSIS_REPORT.md
├── QT6_UPGRADE_SUMMARY.md
├── UI_EXTENSION_ANALYSIS_REPORT.md
├── fix_makefile.ps1
├── qtscrcpy_tc_tree.md
├── readme.md
├── task.txt
├── temp_qmake.bat
├── upgrade_qt6_script.sh
├── 运行效果1.png
└── 预期.png
```

---
*Generated by Directory Tree Generator*