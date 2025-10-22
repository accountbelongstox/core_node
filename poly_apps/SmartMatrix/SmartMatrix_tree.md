# Directory Tree: SmartMatrix

**Path:** `D:\programing\core_node\poly_apps\SmartMatrix`

```
SmartMatrix/
├── QtSmartMatrix/
│   ├── SmartMatrixCore/
│   │   ├── include/
│   │   │   ├── SmartMatrixCore.h
│   │   │   ├── SmartMatrixCoreDef.h
│   │   │   └── adbprocess.h
│   │   ├── src/
│   │   │   ├── adb/
│   │   │   │   ├── 20251012_042444_backup_adbprocessimpl.cpp
│   │   │   │   ├── adbprocess.cpp
│   │   │   │   ├── adbprocessimpl.cpp
│   │   │   │   └── adbprocessimpl.h
│   │   │   ├── common/
│   │   │   │   └── qscrcpyevent.h
│   │   │   ├── device/
│   │   │   │   ├── android/
│   │   │   │   │   ├── input.h
│   │   │   │   │   └── keycodes.h
│   │   │   │   ├── controller/
│   │   │   │   │   ├── inputconvert/
│   │   │   │   │   │   ├── keymap/
│   │   │   │   │   │   │   ├── 20251012_044031_backup_keymap.h
│   │   │   │   │   │   │   ├── keymap.cpp
│   │   │   │   │   │   │   └── keymap.h
│   │   │   │   │   │   ├── controlmsg.cpp
│   │   │   │   │   │   ├── controlmsg.h
│   │   │   │   │   │   ├── inputconvertbase.cpp
│   │   │   │   │   │   ├── inputconvertbase.h
│   │   │   │   │   │   ├── inputconvertgame.cpp
│   │   │   │   │   │   ├── inputconvertgame.h
│   │   │   │   │   │   ├── inputconvertnormal.cpp
│   │   │   │   │   │   └── inputconvertnormal.h
│   │   │   │   │   ├── receiver/
│   │   │   │   │   │   ├── devicemsg.cpp
│   │   │   │   │   │   ├── devicemsg.h
│   │   │   │   │   │   ├── receiver.cpp
│   │   │   │   │   │   └── receiver.h
│   │   │   │   │   ├── bufferutil.cpp
│   │   │   │   │   ├── bufferutil.h
│   │   │   │   │   ├── controller.cpp
│   │   │   │   │   └── controller.h
│   │   │   │   ├── decoder/
│   │   │   │   │   ├── avframeconvert.cpp
│   │   │   │   │   ├── avframeconvert.h
│   │   │   │   │   ├── decoder.cpp
│   │   │   │   │   ├── decoder.h
│   │   │   │   │   ├── fpscounter.cpp
│   │   │   │   │   ├── fpscounter.h
│   │   │   │   │   ├── videobuffer.cpp
│   │   │   │   │   └── videobuffer.h
│   │   │   │   ├── demuxer/
│   │   │   │   │   ├── demuxer.cpp
│   │   │   │   │   └── demuxer.h
│   │   │   │   ├── filehandler/
│   │   │   │   │   ├── filehandler.cpp
│   │   │   │   │   └── filehandler.h
│   │   │   │   ├── recorder/
│   │   │   │   │   ├── recorder.cpp
│   │   │   │   │   └── recorder.h
│   │   │   │   ├── server/
│   │   │   │   │   ├── server.cpp
│   │   │   │   │   ├── server.h
│   │   │   │   │   ├── tcpserver.cpp
│   │   │   │   │   ├── tcpserver.h
│   │   │   │   │   ├── videosocket.cpp
│   │   │   │   │   └── videosocket.h
│   │   │   │   ├── compat.h
│   │   │   │   ├── device.cpp
│   │   │   │   └── device.h
│   │   │   ├── devicemanage/
│   │   │   │   ├── devicemanage.cpp
│   │   │   │   └── devicemanage.h
│   │   │   └── third_party/
│   │   │       ├── adb/
│   │   │       │   ├── linux/
│   │   │       │   │   └── adb
│   │   │       │   └── mac/
│   │   │       │       └── adb
│   │   │       ├── ffmpeg/
│   │   │       │   ├── include/
│   │   │       │   │   ├── libavcodec/
│   │   │       │   │   │   ├── ac3_parser.h
│   │   │       │   │   │   ├── adts_parser.h
│   │   │       │   │   │   ├── avcodec.h
│   │   │       │   │   │   ├── avdct.h
│   │   │       │   │   │   ├── avfft.h
│   │   │       │   │   │   ├── bsf.h
│   │   │       │   │   │   ├── codec.h
│   │   │       │   │   │   ├── codec_desc.h
│   │   │       │   │   │   ├── codec_id.h
│   │   │       │   │   │   ├── codec_par.h
│   │   │       │   │   │   ├── d3d11va.h
│   │   │       │   │   │   ├── dirac.h
│   │   │       │   │   │   ├── dv_profile.h
│   │   │       │   │   │   ├── dxva2.h
│   │   │       │   │   │   ├── jni.h
│   │   │       │   │   │   ├── mediacodec.h
│   │   │       │   │   │   ├── packet.h
│   │   │       │   │   │   ├── qsv.h
│   │   │       │   │   │   ├── vaapi.h
│   │   │       │   │   │   ├── vdpau.h
│   │   │       │   │   │   ├── version.h
│   │   │       │   │   │   ├── videotoolbox.h
│   │   │       │   │   │   ├── vorbis_parser.h
│   │   │       │   │   │   └── xvmc.h
│   │   │       │   │   ├── libavdevice/
│   │   │       │   │   │   ├── avdevice.h
│   │   │       │   │   │   └── version.h
│   │   │       │   │   ├── libavfilter/
│   │   │       │   │   │   ├── avfilter.h
│   │   │       │   │   │   ├── buffersink.h
│   │   │       │   │   │   ├── buffersrc.h
│   │   │       │   │   │   └── version.h
│   │   │       │   │   ├── libavformat/
│   │   │       │   │   │   ├── avformat.h
│   │   │       │   │   │   ├── avio.h
│   │   │       │   │   │   └── version.h
│   │   │       │   │   ├── libavutil/
│   │   │       │   │   │   ├── adler32.h
│   │   │       │   │   │   ├── aes.h
│   │   │       │   │   │   ├── aes_ctr.h
│   │   │       │   │   │   ├── attributes.h
│   │   │       │   │   │   ├── audio_fifo.h
│   │   │       │   │   │   ├── avassert.h
│   │   │       │   │   │   ├── avconfig.h
│   │   │       │   │   │   ├── avstring.h
│   │   │       │   │   │   ├── avutil.h
│   │   │       │   │   │   ├── base64.h
│   │   │       │   │   │   ├── blowfish.h
│   │   │       │   │   │   ├── bprint.h
│   │   │       │   │   │   ├── bswap.h
│   │   │       │   │   │   ├── buffer.h
│   │   │       │   │   │   ├── camellia.h
│   │   │       │   │   │   ├── cast5.h
│   │   │       │   │   │   ├── channel_layout.h
│   │   │       │   │   │   ├── common.h
│   │   │       │   │   │   ├── cpu.h
│   │   │       │   │   │   ├── crc.h
│   │   │       │   │   │   ├── des.h
│   │   │       │   │   │   ├── dict.h
│   │   │       │   │   │   ├── display.h
│   │   │       │   │   │   ├── dovi_meta.h
│   │   │       │   │   │   ├── downmix_info.h
│   │   │       │   │   │   ├── encryption_info.h
│   │   │       │   │   │   ├── error.h
│   │   │       │   │   │   ├── eval.h
│   │   │       │   │   │   ├── ffversion.h
│   │   │       │   │   │   ├── fifo.h
│   │   │       │   │   │   ├── file.h
│   │   │       │   │   │   ├── film_grain_params.h
│   │   │       │   │   │   ├── frame.h
│   │   │       │   │   │   ├── hash.h
│   │   │       │   │   │   ├── hdr_dynamic_metadata.h
│   │   │       │   │   │   ├── hmac.h
│   │   │       │   │   │   ├── hwcontext.h
│   │   │       │   │   │   ├── hwcontext_cuda.h
│   │   │       │   │   │   ├── hwcontext_d3d11va.h
│   │   │       │   │   │   ├── hwcontext_drm.h
│   │   │       │   │   │   ├── hwcontext_dxva2.h
│   │   │       │   │   │   ├── hwcontext_mediacodec.h
│   │   │       │   │   │   ├── hwcontext_opencl.h
│   │   │       │   │   │   ├── hwcontext_qsv.h
│   │   │       │   │   │   ├── hwcontext_vaapi.h
│   │   │       │   │   │   ├── hwcontext_vdpau.h
│   │   │       │   │   │   ├── hwcontext_videotoolbox.h
│   │   │       │   │   │   ├── hwcontext_vulkan.h
│   │   │       │   │   │   ├── imgutils.h
│   │   │       │   │   │   ├── intfloat.h
│   │   │       │   │   │   ├── intreadwrite.h
│   │   │       │   │   │   ├── lfg.h
│   │   │       │   │   │   ├── log.h
│   │   │       │   │   │   ├── macros.h
│   │   │       │   │   │   ├── mastering_display_metadata.h
│   │   │       │   │   │   ├── mathematics.h
│   │   │       │   │   │   ├── md5.h
│   │   │       │   │   │   ├── mem.h
│   │   │       │   │   │   ├── motion_vector.h
│   │   │       │   │   │   ├── murmur3.h
│   │   │       │   │   │   ├── opt.h
│   │   │       │   │   │   ├── parseutils.h
│   │   │       │   │   │   ├── pixdesc.h
│   │   │       │   │   │   ├── pixelutils.h
│   │   │       │   │   │   ├── pixfmt.h
│   │   │       │   │   │   ├── random_seed.h
│   │   │       │   │   │   ├── rational.h
│   │   │       │   │   │   ├── rc4.h
│   │   │       │   │   │   ├── replaygain.h
│   │   │       │   │   │   ├── ripemd.h
│   │   │       │   │   │   ├── samplefmt.h
│   │   │       │   │   │   ├── sha.h
│   │   │       │   │   │   ├── sha512.h
│   │   │       │   │   │   ├── spherical.h
│   │   │       │   │   │   ├── stereo3d.h
│   │   │       │   │   │   ├── tea.h
│   │   │       │   │   │   ├── threadmessage.h
│   │   │       │   │   │   ├── time.h
│   │   │       │   │   │   ├── timecode.h
│   │   │       │   │   │   ├── timestamp.h
│   │   │       │   │   │   ├── tree.h
│   │   │       │   │   │   ├── twofish.h
│   │   │       │   │   │   ├── tx.h
│   │   │       │   │   │   ├── version.h
│   │   │       │   │   │   ├── video_enc_params.h
│   │   │       │   │   │   └── xtea.h
│   │   │       │   │   ├── libswresample/
│   │   │       │   │   │   ├── swresample.h
│   │   │       │   │   │   └── version.h
│   │   │       │   │   └── libswscale/
│   │   │       │   │       ├── swscale.h
│   │   │       │   │       └── version.h
│   │   │       │   └── lib/
│   │   │       │       ├── x64/
│   │   │       │       │   ├── avcodec.lib
│   │   │       │       │   ├── avdevice.lib
│   │   │       │       │   ├── avfilter.lib
│   │   │       │       │   ├── avformat.lib
│   │   │       │       │   ├── avutil.lib
│   │   │       │       │   ├── swresample.lib
│   │   │       │       │   └── swscale.lib
│   │   │       │       ├── x86/
│   │   │       │       │   ├── avcodec.lib
│   │   │       │       │   ├── avdevice.lib
│   │   │       │       │   ├── avfilter.lib
│   │   │       │       │   ├── avformat.lib
│   │   │       │       │   ├── avutil.lib
│   │   │       │       │   ├── swresample.lib
│   │   │       │       │   └── swscale.lib
│   │   │       │       ├── libavcodec.a
│   │   │       │       ├── libavdevice.a
│   │   │       │       ├── libavfilter.a
│   │   │       │       ├── libavformat.a
│   │   │       │       ├── libavutil.a
│   │   │       │       ├── libswresample.a
│   │   │       │       └── libswscale.a
│   │   │       └── scrcpy-server
│   │   ├── .gitignore
│   │   ├── CMakeLists.txt
│   │   ├── LICENSE
│   │   └── README.md
│   ├── audio/
│   │   ├── 20251012_044031_backup_audiooutput.cpp
│   │   ├── 20251012_044031_backup_audiooutput.h
│   │   ├── audiooutput.cpp
│   │   └── audiooutput.h
│   ├── fontawesome/
│   │   ├── iconhelper.cpp
│   │   └── iconhelper.h
│   ├── groupcontroller/
│   │   ├── 20251012_044031_backup_groupcontroller.h
│   │   ├── groupcontroller.cpp
│   │   └── groupcontroller.h
│   ├── render/
│   │   ├── qyuvopenglwidget.cpp
│   │   └── qyuvopenglwidget.h
│   ├── res/
│   │   ├── font/
│   │   │   ├── fontawesome-webfont.pdf
│   │   │   └── fontawesome-webfont.ttf
│   │   ├── i18n/
│   │   │   ├── CMakeLists.txt
│   │   │   ├── en_US.qm
│   │   │   ├── en_US.ts
│   │   │   ├── ja_JP.qm
│   │   │   ├── ja_JP.ts
│   │   │   ├── zh_CN.qm
│   │   │   └── zh_CN.ts
│   │   ├── image/
│   │   │   ├── tray/
│   │   │   │   └── logo.png
│   │   │   └── videoform/
│   │   │       ├── phone-h.png
│   │   │       └── phone-v.png
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
│   │   ├── Info_Mac.plist.in
│   │   ├── SmartMatrix.icns
│   │   ├── SmartMatrix.ico
│   │   ├── SmartMatrix.rc
│   │   └── res.qrc
│   ├── sndcpy/
│   │   ├── sndcpy.bat
│   │   └── sndcpy.sh
│   ├── ui/
│   │   ├── icons/
│   │   │   ├── device.png
│   │   │   ├── device_connected.png
│   │   │   ├── device_disconnected.png
│   │   │   └── group.png
│   │   ├── image/
│   │   │   ├── tray/
│   │   │   │   └── logo.png
│   │   │   └── videoform/
│   │   │       ├── phone-h.png
│   │   │       └── phone-v.png
│   │   ├── res/
│   │   │   ├── phone-v.png
│   │   │   └── phone.png
│   │   ├── 20251012_042444_backup_dialog.cpp.obsolete
│   │   ├── 20251012_044031_backup_dialog.cpp
│   │   ├── 20251012_044031_backup_dialog.h
│   │   ├── 20251012_044031_backup_videoform.cpp
│   │   ├── 20251012_044031_backup_videoform.h
│   │   ├── CMakeLists_modern_ui.txt
│   │   ├── devicevideowidget.cpp
│   │   ├── devicevideowidget.h
│   │   ├── dialog.cpp
│   │   ├── dialog.h
│   │   ├── dialog.ui
│   │   ├── moderndevicegroupmanager.cpp
│   │   ├── moderndevicegroupmanager.h
│   │   ├── moderndevicetreewidget.cpp
│   │   ├── moderndevicetreewidget.h
│   │   ├── moderngridlayoutmanager.cpp
│   │   ├── moderngridlayoutmanager.h
│   │   ├── modernmainwindow.cpp
│   │   ├── modernmainwindow.h
│   │   ├── modernrightpanel.cpp
│   │   ├── modernrightpanel.h
│   │   ├── modernstylesystem.cpp
│   │   ├── modernstylesystem.h
│   │   ├── modernstylesystem_old.cpp
│   │   ├── modernstylesystem_simplified.cpp
│   │   ├── modernuiintegration.cpp
│   │   ├── modernuiintegration.h
│   │   ├── modernuiintegration_old.cpp
│   │   ├── modernuiintegration_simplified.cpp
│   │   ├── toolform.cpp
│   │   ├── toolform.h
│   │   ├── toolform.ui
│   │   ├── videoform.cpp
│   │   ├── videoform.h
│   │   └── videoform.ui
│   ├── uibase/
│   │   ├── keepratiowidget.cpp
│   │   ├── keepratiowidget.h
│   │   ├── magneticwidget.cpp
│   │   └── magneticwidget.h
│   ├── util/
│   │   ├── mousetap/
│   │   │   ├── cocoamousetap.h
│   │   │   ├── cocoamousetap.mm
│   │   │   ├── mousetap.cpp
│   │   │   ├── mousetap.h
│   │   │   ├── winmousetap.cpp
│   │   │   ├── winmousetap.h
│   │   │   ├── xmousetap.cpp
│   │   │   └── xmousetap.h
│   │   ├── config.cpp
│   │   ├── config.h
│   │   ├── path.h
│   │   ├── path.mm
│   │   ├── winutils.cpp
│   │   └── winutils.h
│   ├── CMakeLists.txt
│   ├── QtScrcpy_tree.md
│   ├── appversion
│   ├── clang-format-all.sh
│   ├── main.cpp
│   └── main_modern.cpp
├── backup/
│   ├── logo.png
│   └── myconfig.sh
├── ci/
│   ├── linux/
│   │   ├── build_for_linux.sh
│   │   └── publish_for_ubuntu.sh.todo
│   ├── mac/
│   │   ├── package/
│   │   │   ├── dmg-background.jpg
│   │   │   ├── dmg-settings.json
│   │   │   ├── package.py
│   │   │   └── requirements.txt
│   │   ├── build_for_mac.sh
│   │   ├── package_for_mac.sh
│   │   └── publish_for_mac.sh
│   ├── win/
│   │   ├── build_for_win.bat
│   │   └── publish_for_win.bat
│   ├── generate-version.py
│   ├── lrelease.sh
│   └── lupdate.sh
├── config/
│   ├── config.ini
│   └── userdata.ini.QzAdFD
├── docs/
│   ├── image/
│   │   ├── USB调试(安全设置).jpg
│   │   ├── debug-keymap-pos.png
│   │   ├── group-control.gif
│   │   ├── quickmirror.png
│   │   └── 显示指针位置.jpg
│   ├── upgrade/
│   │   ├── QtScrcpy_tree.md
│   │   ├── qt5toqt6_upgrade_progress.md
│   │   ├── updatehistory.txt
│   │   └── 恢复.md
│   ├── BuildQtFromGit.md
│   ├── ChangesToQt6Widgets.md
│   ├── DEVELOP.md
│   ├── FAQ.md
│   ├── KeyMapDes.md
│   ├── KeyMapDes_zh.md
│   ├── NewClassesAndFunctionsInQt6.9.md
│   ├── NewQMetaTypeQVariant.md
│   ├── NewQt6.md
│   ├── ObsoleteMembersForQtWin.md
│   ├── Qt45ToQt6UpgradePainfulExperienceSummaryV202308.md
│   ├── Qt5AndQt6compatibility.md
│   ├── Qt5CoreCompatibilityAPIs.md
│   ├── Qt5to6MigrationTutorial.md
│   ├── Qt5toQt6MigrationCriticalSteps.md
│   ├── Qt6Core.md
│   ├── Qt6OpenGL.md
│   ├── Qt6UpgradePainfulExperienceSummary.md
│   ├── QtDevelopmentExperience.md
│   ├── QtExtrasModulesQt6.md
│   ├── TODO.md
│   ├── WhatsNewInQt6.9.md
│   ├── docs_tree.md
│   ├── oldnewclasses515.md
│   ├── porting-from-qt-5-to-qt-6-using-qt5compat-library
│   └── qt4-qt5-to-qt6-migration-summary.md
├── keymap/
│   ├── FRAG.json
│   ├── gameforpeace.json
│   ├── identityv.json
│   ├── test.json
│   └── tiktok.json
├── screenshot/
│   ├── game.png
│   ├── linux-en.png
│   ├── linux-zh.png
│   ├── mac-en.png
│   ├── mac-zh.png
│   ├── win-en.png
│   └── win-zh.png
├── scripts/
│   └── check_keywords.py
├── .gitignore
├── 20251012_042444_backup_CMakeLists.txt
├── AUTOMATION_ANALYSIS.md
├── Baselogo.jpg
├── Baselogo.png
├── Baselogo.psd.js
├── CMakeLists.txt
├── CodeHistory.txt
├── INTEGRATION_PLAN.md
├── LICENSE
├── MODERN_UI_FEATURES.md
├── QtScrcpy_tree.md
├── README.md
├── README_zh.md
├── UI_DESIGN_SPECIFICATION.md
├── UI_EXTENSION_ANALYSIS.md
├── build.ps1
├── deploy_qt6.ps1
├── error_qt1.txt
├── install_qt_msvc.ps1
└── replace_text.ps1
```

---
*Generated by Directory Tree Generator*