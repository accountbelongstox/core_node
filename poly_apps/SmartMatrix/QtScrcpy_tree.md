# Directory Tree: QtScrcpy

**Path:** `D:\programing\core_node\poly_apps\QtScrcpy`

```
QtScrcpy/
├── QtScrcpy/
│   ├── QtScrcpyCore/
│   │   ├── include/
│   │   │   ├── QtScrcpyCore.h
│   │   │   ├── QtScrcpyCoreDef.h
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
│   │   │       │   ├── mac/
│   │   │       │   │   └── adb
│   │   │       │   └── win/
│   │   │       │       ├── AdbWinApi.dll
│   │   │       │       ├── AdbWinUsbApi.dll
│   │   │       │       └── adb.exe
│   │   │       ├── ffmpeg/
│   │   │       │   ├── bin/
│   │   │       │   │   ├── x64/
│   │   │       │   │   │   ├── avcodec-58.dll
│   │   │       │   │   │   ├── avdevice-58.dll
│   │   │       │   │   │   ├── avfilter-7.dll
│   │   │       │   │   │   ├── avformat-58.dll
│   │   │       │   │   │   ├── avutil-56.dll
│   │   │       │   │   │   ├── swresample-3.dll
│   │   │       │   │   │   └── swscale-5.dll
│   │   │       │   │   └── x86/
│   │   │       │   │       ├── avcodec-58.dll
│   │   │       │   │       ├── avdevice-58.dll
│   │   │       │   │       ├── avfilter-7.dll
│   │   │       │   │       ├── avformat-58.dll
│   │   │       │   │       ├── avutil-56.dll
│   │   │       │   │       ├── swresample-3.dll
│   │   │       │   │       └── swscale-5.dll
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
│   │   │       │       ├── arm64/
│   │   │       │       │   ├── libavcodec.58.dylib
│   │   │       │       │   ├── libavdevice.58.dylib
│   │   │       │       │   ├── libavfilter.7.dylib
│   │   │       │       │   ├── libavformat.58.dylib
│   │   │       │       │   ├── libavutil.56.dylib
│   │   │       │       │   ├── libswresample.3.dylib
│   │   │       │       │   └── libswscale.5.dylib
│   │   │       │       ├── x64/
│   │   │       │       │   ├── avcodec.lib
│   │   │       │       │   ├── avdevice.lib
│   │   │       │       │   ├── avfilter.lib
│   │   │       │       │   ├── avformat.lib
│   │   │       │       │   ├── avutil.lib
│   │   │       │       │   ├── libavcodec.58.dylib
│   │   │       │       │   ├── libavdevice.58.dylib
│   │   │       │       │   ├── libavfilter.7.dylib
│   │   │       │       │   ├── libavformat.58.dylib
│   │   │       │       │   ├── libavutil.56.dylib
│   │   │       │       │   ├── libswresample.3.dylib
│   │   │       │       │   ├── libswscale.5.dylib
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
│   │   ├── CMakeLists.txt.backup
│   │   ├── LICENSE
│   │   └── README.md
│   ├── audio/
│   │   ├── 20251012_044031_backup_audiooutput.cpp
│   │   ├── 20251012_044031_backup_audiooutput.h
│   │   ├── audiooutput.cpp
│   │   ├── audiooutput.cpp.backup
│   │   ├── audiooutput.h
│   │   └── audiooutput.h.backup
│   ├── build-mingw/
│   │   ├── CMakeFiles/
│   │   │   ├── 3.30.5/
│   │   │   │   └── CMakeSystem.cmake
│   │   │   ├── pkgRedirects/
│   │   │   ├── CMakeConfigureLog.yaml
│   │   │   └── cmake.check_cache
│   │   └── CMakeCache.txt
│   ├── fontawesome/
│   │   ├── iconhelper.cpp
│   │   └── iconhelper.h
│   ├── groupcontroller/
│   │   ├── 20251012_044031_backup_groupcontroller.h
│   │   ├── groupcontroller.cpp
│   │   └── groupcontroller.h
│   ├── render/
│   │   ├── qyuvopenglwidget.cpp
│   │   ├── qyuvopenglwidget.cpp.backup
│   │   ├── qyuvopenglwidget.h
│   │   └── qyuvopenglwidget.h.backup
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
│   │   ├── QtScrcpy.icns
│   │   ├── QtScrcpy.ico
│   │   ├── QtScrcpy.rc
│   │   └── res.qrc
│   ├── sndcpy/
│   │   ├── sndcpy.apk
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
│   │   ├── modernstylesystem.h
│   │   ├── modernuiintegration.cpp
│   │   ├── modernuiintegration.h
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
│   │   ├── config.cpp.backup
│   │   ├── config.h
│   │   ├── config.h.backup
│   │   ├── path.h
│   │   ├── path.mm
│   │   ├── winutils.cpp
│   │   └── winutils.h
│   ├── CMakeLists.txt
│   ├── CMakeLists.txt.backup
│   ├── QtScrcpy_tree.md
│   ├── appversion
│   ├── clang-format-all.sh
│   ├── main.cpp
│   ├── main.cpp.backup
│   └── main_modern.cpp
├── backup/
│   ├── logo.png
│   └── myconfig.sh
├── build_msvc_2022/
│   ├── CMakeFiles/
│   │   ├── 02aa564d9f7926f4a9f5524b5dd02cf8/
│   │   │   └── autouic_(CONFIG).stamp.rule
│   │   ├── 3.31.6-msvc6/
│   │   │   ├── CompilerIdCXX/
│   │   │   │   ├── Debug/
│   │   │   │   │   ├── CompilerIdCXX.tlog/
│   │   │   │   │   │   ├── CL.command.1.tlog
│   │   │   │   │   │   ├── CL.read.1.tlog
│   │   │   │   │   │   ├── CL.write.1.tlog
│   │   │   │   │   │   ├── Cl.items.tlog
│   │   │   │   │   │   ├── CompilerIdCXX.lastbuildstate
│   │   │   │   │   │   ├── link.command.1.tlog
│   │   │   │   │   │   ├── link.read.1.tlog
│   │   │   │   │   │   ├── link.secondary.1.tlog
│   │   │   │   │   │   └── link.write.1.tlog
│   │   │   │   │   ├── CMakeCXXCompilerId.obj
│   │   │   │   │   └── CompilerIdCXX.exe.recipe
│   │   │   │   ├── CMakeCXXCompilerId.cpp
│   │   │   │   ├── CompilerIdCXX.exe
│   │   │   │   └── CompilerIdCXX.vcxproj
│   │   │   ├── VCTargetsPath/
│   │   │   │   └── x64/
│   │   │   │       └── Debug/
│   │   │   │           ├── VCTargetsPath.tlog/
│   │   │   │           │   └── VCTargetsPath.lastbuildstate
│   │   │   │           └── VCTargetsPath.recipe
│   │   │   ├── x64/
│   │   │   │   └── Debug/
│   │   │   ├── CMakeCXXCompiler.cmake
│   │   │   ├── CMakeDetermineCompilerABI_CXX.bin
│   │   │   ├── CMakeRCCompiler.cmake
│   │   │   ├── CMakeSystem.cmake
│   │   │   ├── VCTargetsPath.txt
│   │   │   └── VCTargetsPath.vcxproj
│   │   ├── 53ad5d54937ddb26492a8b93d1369b5a/
│   │   │   └── generate.stamp.rule
│   │   ├── 95b82623ff3265e5efbc9a2b7f4663e8/
│   │   │   └── qrc_res.cpp.rule
│   │   ├── CMakeScratch/
│   │   ├── QtScrcpy_autogen.dir/
│   │   │   ├── AutoRcc_res_PNK5WDWK6L_Info.json
│   │   │   ├── AutoRcc_res_PNK5WDWK6L_Used_RelWithDebInfo.txt
│   │   │   ├── AutogenInfo.json
│   │   │   ├── AutogenUsed_RelWithDebInfo.txt
│   │   │   └── ParseCache_RelWithDebInfo.txt
│   │   ├── pkgRedirects/
│   │   ├── CMakeConfigureLog.yaml
│   │   ├── TargetDirectories.txt
│   │   ├── cmake.check_cache
│   │   ├── generate.stamp
│   │   ├── generate.stamp.depend
│   │   └── generate.stamp.list
│   ├── QtScrcpy.dir/
│   │   └── RelWithDebInfo/
│   │       ├── QtScrcpy.tlog/
│   │       │   ├── CL.command.1.tlog
│   │       │   ├── CL.read.1.tlog
│   │       │   ├── CL.write.1.tlog
│   │       │   ├── CustomBuild.command.1.tlog
│   │       │   ├── CustomBuild.read.1.tlog
│   │       │   ├── CustomBuild.write.1.tlog
│   │       │   ├── QtScrcpy.lastbuildstate
│   │       │   ├── link.command.1.tlog
│   │       │   ├── link.read.1.tlog
│   │       │   ├── link.write.1.tlog
│   │       │   ├── rc.command.1.tlog
│   │       │   ├── rc.read.1.tlog
│   │       │   ├── rc.write.1.tlog
│   │       │   └── unsuccessfulbuild
│   │       ├── QtScrcpy_autogen/
│   │       │   └── PNK5WDWK6L_RelWithDebInfo/
│   │       │       └── qrc_res.cpp.obj
│   │       ├── QtScrcpy.res
│   │       ├── audiooutput.obj
│   │       ├── config.obj
│   │       ├── dialog.obj
│   │       ├── groupcontroller.obj
│   │       ├── iconhelper.obj
│   │       ├── keepratiowidget.obj
│   │       ├── magneticwidget.obj
│   │       ├── main.obj
│   │       ├── mocs_compilation_RelWithDebInfo.obj
│   │       ├── mousetap.obj
│   │       ├── qyuvopenglwidget.obj
│   │       ├── toolform.obj
│   │       ├── vc143.pdb
│   │       ├── videoform.obj
│   │       ├── winmousetap.obj
│   │       └── winutils.obj
│   ├── QtScrcpyCore/
│   │   ├── CMakeFiles/
│   │   │   ├── QtScrcpyCore_autogen.dir/
│   │   │   │   ├── AutogenInfo.json
│   │   │   │   ├── AutogenUsed_RelWithDebInfo.txt
│   │   │   │   └── ParseCache_RelWithDebInfo.txt
│   │   │   ├── generate.stamp
│   │   │   └── generate.stamp.depend
│   │   ├── QtScrcpyCore.dir/
│   │   │   └── RelWithDebInfo/
│   │   │       ├── QtScrcpyCore.tlog/
│   │   │       │   ├── CL.command.1.tlog
│   │   │       │   ├── CL.read.1.tlog
│   │   │       │   ├── CL.write.1.tlog
│   │   │       │   ├── Cl.items.tlog
│   │   │       │   ├── CustomBuild.command.1.tlog
│   │   │       │   ├── CustomBuild.read.1.tlog
│   │   │       │   ├── CustomBuild.write.1.tlog
│   │   │       │   ├── Lib-link.read.1.tlog
│   │   │       │   ├── Lib-link.write.1.tlog
│   │   │       │   ├── Lib.command.1.tlog
│   │   │       │   └── QtScrcpyCore.lastbuildstate
│   │   │       ├── QtScrcpyCore.lib.recipe
│   │   │       ├── adbprocess.obj
│   │   │       ├── adbprocessimpl.obj
│   │   │       ├── avframeconvert.obj
│   │   │       ├── bufferutil.obj
│   │   │       ├── controller.obj
│   │   │       ├── controlmsg.obj
│   │   │       ├── decoder.obj
│   │   │       ├── demuxer.obj
│   │   │       ├── device.obj
│   │   │       ├── devicemanage.obj
│   │   │       ├── devicemsg.obj
│   │   │       ├── filehandler.obj
│   │   │       ├── fpscounter.obj
│   │   │       ├── inputconvertbase.obj
│   │   │       ├── inputconvertgame.obj
│   │   │       ├── inputconvertnormal.obj
│   │   │       ├── keymap.obj
│   │   │       ├── mocs_compilation_RelWithDebInfo.obj
│   │   │       ├── receiver.obj
│   │   │       ├── recorder.obj
│   │   │       ├── server.obj
│   │   │       ├── tcpserver.obj
│   │   │       ├── videobuffer.obj
│   │   │       └── videosocket.obj
│   │   ├── QtScrcpyCore_autogen/
│   │   │   ├── include_RelWithDebInfo/
│   │   │   │   ├── 6YEA5652QU/
│   │   │   │   │   ├── moc_QtScrcpyCore.cpp
│   │   │   │   │   ├── moc_QtScrcpyCore.cpp.d
│   │   │   │   │   ├── moc_adbprocess.cpp
│   │   │   │   │   └── moc_adbprocess.cpp.d
│   │   │   │   ├── B4U5HBF4HE/
│   │   │   │   │   ├── moc_server.cpp
│   │   │   │   │   ├── moc_server.cpp.d
│   │   │   │   │   ├── moc_tcpserver.cpp
│   │   │   │   │   ├── moc_tcpserver.cpp.d
│   │   │   │   │   ├── moc_videosocket.cpp
│   │   │   │   │   └── moc_videosocket.cpp.d
│   │   │   │   ├── E5IYPM23Q7/
│   │   │   │   │   ├── moc_devicemsg.cpp
│   │   │   │   │   ├── moc_devicemsg.cpp.d
│   │   │   │   │   ├── moc_receiver.cpp
│   │   │   │   │   └── moc_receiver.cpp.d
│   │   │   │   ├── F2Z3URE5CP/
│   │   │   │   │   ├── moc_keymap.cpp
│   │   │   │   │   └── moc_keymap.cpp.d
│   │   │   │   ├── FIT7WCBYQG/
│   │   │   │   │   ├── moc_inputconvertbase.cpp
│   │   │   │   │   ├── moc_inputconvertbase.cpp.d
│   │   │   │   │   ├── moc_inputconvertgame.cpp
│   │   │   │   │   ├── moc_inputconvertgame.cpp.d
│   │   │   │   │   ├── moc_inputconvertnormal.cpp
│   │   │   │   │   └── moc_inputconvertnormal.cpp.d
│   │   │   │   ├── KQXXML3GD5/
│   │   │   │   │   ├── moc_filehandler.cpp
│   │   │   │   │   └── moc_filehandler.cpp.d
│   │   │   │   ├── QBQSNTONFS/
│   │   │   │   │   ├── moc_adbprocessimpl.cpp
│   │   │   │   │   └── moc_adbprocessimpl.cpp.d
│   │   │   │   ├── R27GN3UPJU/
│   │   │   │   │   ├── moc_device.cpp
│   │   │   │   │   └── moc_device.cpp.d
│   │   │   │   ├── TZCQTYOKL3/
│   │   │   │   │   ├── moc_decoder.cpp
│   │   │   │   │   ├── moc_decoder.cpp.d
│   │   │   │   │   ├── moc_fpscounter.cpp
│   │   │   │   │   ├── moc_fpscounter.cpp.d
│   │   │   │   │   ├── moc_videobuffer.cpp
│   │   │   │   │   └── moc_videobuffer.cpp.d
│   │   │   │   ├── V6TAWOZAWB/
│   │   │   │   │   ├── moc_recorder.cpp
│   │   │   │   │   └── moc_recorder.cpp.d
│   │   │   │   ├── VGKDREYSTA/
│   │   │   │   │   ├── moc_controller.cpp
│   │   │   │   │   └── moc_controller.cpp.d
│   │   │   │   ├── XA5EKVFPEJ/
│   │   │   │   │   ├── moc_devicemanage.cpp
│   │   │   │   │   └── moc_devicemanage.cpp.d
│   │   │   │   └── XS5GD45QW7/
│   │   │   │       ├── moc_demuxer.cpp
│   │   │   │       └── moc_demuxer.cpp.d
│   │   │   └── mocs_compilation_RelWithDebInfo.cpp
│   │   ├── QtScrcpyCore.vcxproj
│   │   ├── QtScrcpyCore.vcxproj.filters
│   │   └── cmake_install.cmake
│   ├── QtScrcpy_autogen/
│   │   ├── PNK5WDWK6L_RelWithDebInfo/
│   │   │   └── qrc_res.cpp
│   │   ├── include_RelWithDebInfo/
│   │   │   ├── 7WSARK52GL/
│   │   │   │   ├── moc_groupcontroller.cpp
│   │   │   │   └── moc_groupcontroller.cpp.d
│   │   │   ├── B2KWJJ5A6K/
│   │   │   │   ├── moc_keepratiowidget.cpp
│   │   │   │   ├── moc_keepratiowidget.cpp.d
│   │   │   │   ├── moc_magneticwidget.cpp
│   │   │   │   └── moc_magneticwidget.cpp.d
│   │   │   ├── KH43KSYMFX/
│   │   │   │   ├── moc_config.cpp
│   │   │   │   └── moc_config.cpp.d
│   │   │   ├── PNK5WDWK6L/
│   │   │   │   └── qrc_res_CMAKE_.cpp
│   │   │   ├── PZONOMFGYT/
│   │   │   │   ├── moc_audiooutput.cpp
│   │   │   │   └── moc_audiooutput.cpp.d
│   │   │   ├── RZRAGMB46M/
│   │   │   │   ├── moc_qyuvopenglwidget.cpp
│   │   │   │   └── moc_qyuvopenglwidget.cpp.d
│   │   │   ├── UYX5XTB5RZ/
│   │   │   │   ├── moc_dialog.cpp
│   │   │   │   ├── moc_dialog.cpp.d
│   │   │   │   ├── moc_toolform.cpp
│   │   │   │   ├── moc_toolform.cpp.d
│   │   │   │   ├── moc_videoform.cpp
│   │   │   │   └── moc_videoform.cpp.d
│   │   │   ├── ui_dialog.h
│   │   │   ├── ui_toolform.h
│   │   │   └── ui_videoform.h
│   │   ├── autouic_RelWithDebInfo.stamp
│   │   └── mocs_compilation_RelWithDebInfo.cpp
│   ├── RelWithDebInfo/
│   ├── x64/
│   │   └── RelWithDebInfo/
│   │       └── ZERO_CHECK/
│   │           ├── ZERO_CHECK.tlog/
│   │           │   ├── CustomBuild.command.1.tlog
│   │           │   ├── CustomBuild.read.1.tlog
│   │           │   ├── CustomBuild.write.1.tlog
│   │           │   └── ZERO_CHECK.lastbuildstate
│   │           └── ZERO_CHECK.recipe
│   ├── ALL_BUILD.vcxproj
│   ├── ALL_BUILD.vcxproj.filters
│   ├── CMakeCache.txt
│   ├── QtScrcpy.sln
│   ├── QtScrcpy.vcxproj
│   ├── QtScrcpy.vcxproj.filters
│   ├── ZERO_CHECK.vcxproj
│   ├── ZERO_CHECK.vcxproj.filters
│   └── cmake_install.cmake
├── ci/
│   ├── build_temp/
│   │   ├── CMakeFiles/
│   │   │   ├── 107614406f83b087cef7aa816cee4d54/
│   │   │   │   └── autouic_(CONFIG).stamp.rule
│   │   │   ├── 4.1.2/
│   │   │   │   ├── CompilerIdC/
│   │   │   │   │   ├── Debug/
│   │   │   │   │   │   ├── CompilerIdC.tlog/
│   │   │   │   │   │   │   ├── CL.command.1.tlog
│   │   │   │   │   │   │   ├── CL.read.1.tlog
│   │   │   │   │   │   │   ├── CL.write.1.tlog
│   │   │   │   │   │   │   ├── Cl.items.tlog
│   │   │   │   │   │   │   ├── CompilerIdC.lastbuildstate
│   │   │   │   │   │   │   ├── link.command.1.tlog
│   │   │   │   │   │   │   ├── link.read.1.tlog
│   │   │   │   │   │   │   ├── link.secondary.1.tlog
│   │   │   │   │   │   │   └── link.write.1.tlog
│   │   │   │   │   │   ├── CMakeCCompilerId.obj
│   │   │   │   │   │   └── CompilerIdC.exe.recipe
│   │   │   │   │   ├── CMakeCCompilerId.c
│   │   │   │   │   ├── CompilerIdC.exe
│   │   │   │   │   └── CompilerIdC.vcxproj
│   │   │   │   ├── CompilerIdCXX/
│   │   │   │   │   ├── Debug/
│   │   │   │   │   │   ├── CompilerIdCXX.tlog/
│   │   │   │   │   │   │   ├── CL.command.1.tlog
│   │   │   │   │   │   │   ├── CL.read.1.tlog
│   │   │   │   │   │   │   ├── CL.write.1.tlog
│   │   │   │   │   │   │   ├── Cl.items.tlog
│   │   │   │   │   │   │   ├── CompilerIdCXX.lastbuildstate
│   │   │   │   │   │   │   ├── link.command.1.tlog
│   │   │   │   │   │   │   ├── link.read.1.tlog
│   │   │   │   │   │   │   ├── link.secondary.1.tlog
│   │   │   │   │   │   │   └── link.write.1.tlog
│   │   │   │   │   │   ├── CMakeCXXCompilerId.obj
│   │   │   │   │   │   └── CompilerIdCXX.exe.recipe
│   │   │   │   │   ├── CMakeCXXCompilerId.cpp
│   │   │   │   │   ├── CompilerIdCXX.exe
│   │   │   │   │   └── CompilerIdCXX.vcxproj
│   │   │   │   ├── VCTargetsPath/
│   │   │   │   │   └── x64/
│   │   │   │   │       └── Debug/
│   │   │   │   │           ├── VCTargetsPath.tlog/
│   │   │   │   │           │   └── VCTargetsPath.lastbuildstate
│   │   │   │   │           └── VCTargetsPath.recipe
│   │   │   │   ├── x64/
│   │   │   │   │   └── Debug/
│   │   │   │   ├── CMakeCCompiler.cmake
│   │   │   │   ├── CMakeCXXCompiler.cmake
│   │   │   │   ├── CMakeDetermineCompilerABI_C.bin
│   │   │   │   ├── CMakeDetermineCompilerABI_CXX.bin
│   │   │   │   ├── CMakeRCCompiler.cmake
│   │   │   │   ├── CMakeSystem.cmake
│   │   │   │   ├── VCTargetsPath.txt
│   │   │   │   └── VCTargetsPath.vcxproj
│   │   │   ├── 51c70936797d40dd46521ae55ea90e54/
│   │   │   │   └── qrc_res.cpp.rule
│   │   │   ├── 894bec6114868e432dab517e150a7301/
│   │   │   │   └── generate.stamp.rule
│   │   │   ├── CMakeScratch/
│   │   │   ├── pkgRedirects/
│   │   │   ├── CMakeConfigureLog.yaml
│   │   │   ├── InstallScripts.json
│   │   │   ├── TargetDirectories.txt
│   │   │   ├── cmake.check_cache
│   │   │   ├── generate.stamp
│   │   │   ├── generate.stamp.depend
│   │   │   └── generate.stamp.list
│   │   ├── QtScrcpy/
│   │   │   ├── CMakeFiles/
│   │   │   │   ├── QtScrcpy_autogen.dir/
│   │   │   │   │   ├── AutoRcc_res_PNK5WDWK6L_Info.json
│   │   │   │   │   ├── AutoRcc_res_PNK5WDWK6L_Used_RelWithDebInfo.txt
│   │   │   │   │   ├── AutogenInfo.json
│   │   │   │   │   ├── AutogenUsed_RelWithDebInfo.txt
│   │   │   │   │   └── ParseCache_RelWithDebInfo.txt
│   │   │   │   ├── generate.stamp
│   │   │   │   └── generate.stamp.depend
│   │   │   ├── QtScrcpy.dir/
│   │   │   │   └── RelWithDebInfo/
│   │   │   │       ├── QtScrcpy.tlog/
│   │   │   │       │   ├── CL.command.1.tlog
│   │   │   │       │   ├── CL.read.1.tlog
│   │   │   │       │   ├── CL.write.1.tlog
│   │   │   │       │   ├── CustomBuild.command.1.tlog
│   │   │   │       │   ├── CustomBuild.read.1.tlog
│   │   │   │       │   ├── CustomBuild.write.1.tlog
│   │   │   │       │   ├── QtScrcpy.lastbuildstate
│   │   │   │       │   └── unsuccessfulbuild
│   │   │   │       ├── QtScrcpy_autogen/
│   │   │   │       │   └── PNK5WDWK6L_RelWithDebInfo/
│   │   │   │       ├── audiooutput.obj
│   │   │   │       ├── config.obj
│   │   │   │       ├── devicevideowidget.obj
│   │   │   │       ├── dialog.obj
│   │   │   │       ├── groupcontroller.obj
│   │   │   │       ├── iconhelper.obj
│   │   │   │       ├── keepratiowidget.obj
│   │   │   │       ├── magneticwidget.obj
│   │   │   │       ├── main.obj
│   │   │   │       ├── mocs_compilation_RelWithDebInfo.obj
│   │   │   │       ├── moderndevicegroupmanager.obj
│   │   │   │       ├── moderngridlayoutmanager.obj
│   │   │   │       ├── modernuiintegration.obj
│   │   │   │       ├── mousetap.obj
│   │   │   │       ├── qyuvopenglwidget.obj
│   │   │   │       ├── toolform.obj
│   │   │   │       ├── vc143.pdb
│   │   │   │       ├── videoform.obj
│   │   │   │       ├── winmousetap.obj
│   │   │   │       └── winutils.obj
│   │   │   ├── QtScrcpyCore/
│   │   │   │   ├── CMakeFiles/
│   │   │   │   │   ├── QtScrcpyCore_autogen.dir/
│   │   │   │   │   │   ├── AutogenInfo.json
│   │   │   │   │   │   ├── AutogenUsed_RelWithDebInfo.txt
│   │   │   │   │   │   └── ParseCache_RelWithDebInfo.txt
│   │   │   │   │   ├── generate.stamp
│   │   │   │   │   └── generate.stamp.depend
│   │   │   │   ├── QtScrcpyCore.dir/
│   │   │   │   │   └── RelWithDebInfo/
│   │   │   │   │       ├── QtScrcpyCore.tlog/
│   │   │   │   │       │   ├── CL.command.1.tlog
│   │   │   │   │       │   ├── CL.read.1.tlog
│   │   │   │   │       │   ├── CL.write.1.tlog
│   │   │   │   │       │   ├── Cl.items.tlog
│   │   │   │   │       │   ├── CustomBuild.command.1.tlog
│   │   │   │   │       │   ├── CustomBuild.read.1.tlog
│   │   │   │   │       │   ├── CustomBuild.write.1.tlog
│   │   │   │   │       │   ├── Lib-link.read.1.tlog
│   │   │   │   │       │   ├── Lib-link.write.1.tlog
│   │   │   │   │       │   ├── Lib.command.1.tlog
│   │   │   │   │       │   └── QtScrcpyCore.lastbuildstate
│   │   │   │   │       ├── QtScrcpyCore.lib.recipe
│   │   │   │   │       ├── adbprocess.obj
│   │   │   │   │       ├── adbprocessimpl.obj
│   │   │   │   │       ├── avframeconvert.obj
│   │   │   │   │       ├── bufferutil.obj
│   │   │   │   │       ├── controller.obj
│   │   │   │   │       ├── controlmsg.obj
│   │   │   │   │       ├── decoder.obj
│   │   │   │   │       ├── demuxer.obj
│   │   │   │   │       ├── device.obj
│   │   │   │   │       ├── devicemanage.obj
│   │   │   │   │       ├── devicemsg.obj
│   │   │   │   │       ├── filehandler.obj
│   │   │   │   │       ├── fpscounter.obj
│   │   │   │   │       ├── inputconvertbase.obj
│   │   │   │   │       ├── inputconvertgame.obj
│   │   │   │   │       ├── inputconvertnormal.obj
│   │   │   │   │       ├── keymap.obj
│   │   │   │   │       ├── mocs_compilation_RelWithDebInfo.obj
│   │   │   │   │       ├── receiver.obj
│   │   │   │   │       ├── recorder.obj
│   │   │   │   │       ├── server.obj
│   │   │   │   │       ├── tcpserver.obj
│   │   │   │   │       ├── videobuffer.obj
│   │   │   │   │       └── videosocket.obj
│   │   │   │   ├── QtScrcpyCore_autogen/
│   │   │   │   │   ├── include_RelWithDebInfo/
│   │   │   │   │   │   ├── 6YEA5652QU/
│   │   │   │   │   │   │   ├── moc_QtScrcpyCore.cpp
│   │   │   │   │   │   │   ├── moc_QtScrcpyCore.cpp.d
│   │   │   │   │   │   │   ├── moc_adbprocess.cpp
│   │   │   │   │   │   │   └── moc_adbprocess.cpp.d
│   │   │   │   │   │   ├── B4U5HBF4HE/
│   │   │   │   │   │   │   ├── moc_server.cpp
│   │   │   │   │   │   │   ├── moc_server.cpp.d
│   │   │   │   │   │   │   ├── moc_tcpserver.cpp
│   │   │   │   │   │   │   ├── moc_tcpserver.cpp.d
│   │   │   │   │   │   │   ├── moc_videosocket.cpp
│   │   │   │   │   │   │   └── moc_videosocket.cpp.d
│   │   │   │   │   │   ├── E5IYPM23Q7/
│   │   │   │   │   │   │   ├── moc_devicemsg.cpp
│   │   │   │   │   │   │   ├── moc_devicemsg.cpp.d
│   │   │   │   │   │   │   ├── moc_receiver.cpp
│   │   │   │   │   │   │   └── moc_receiver.cpp.d
│   │   │   │   │   │   ├── F2Z3URE5CP/
│   │   │   │   │   │   │   ├── moc_keymap.cpp
│   │   │   │   │   │   │   └── moc_keymap.cpp.d
│   │   │   │   │   │   ├── FIT7WCBYQG/
│   │   │   │   │   │   │   ├── moc_inputconvertbase.cpp
│   │   │   │   │   │   │   ├── moc_inputconvertbase.cpp.d
│   │   │   │   │   │   │   ├── moc_inputconvertgame.cpp
│   │   │   │   │   │   │   ├── moc_inputconvertgame.cpp.d
│   │   │   │   │   │   │   ├── moc_inputconvertnormal.cpp
│   │   │   │   │   │   │   └── moc_inputconvertnormal.cpp.d
│   │   │   │   │   │   ├── KQXXML3GD5/
│   │   │   │   │   │   │   ├── moc_filehandler.cpp
│   │   │   │   │   │   │   └── moc_filehandler.cpp.d
│   │   │   │   │   │   ├── QBQSNTONFS/
│   │   │   │   │   │   │   ├── moc_adbprocessimpl.cpp
│   │   │   │   │   │   │   └── moc_adbprocessimpl.cpp.d
│   │   │   │   │   │   ├── R27GN3UPJU/
│   │   │   │   │   │   │   ├── moc_device.cpp
│   │   │   │   │   │   │   └── moc_device.cpp.d
│   │   │   │   │   │   ├── TZCQTYOKL3/
│   │   │   │   │   │   │   ├── moc_decoder.cpp
│   │   │   │   │   │   │   ├── moc_decoder.cpp.d
│   │   │   │   │   │   │   ├── moc_fpscounter.cpp
│   │   │   │   │   │   │   ├── moc_fpscounter.cpp.d
│   │   │   │   │   │   │   ├── moc_videobuffer.cpp
│   │   │   │   │   │   │   └── moc_videobuffer.cpp.d
│   │   │   │   │   │   ├── V6TAWOZAWB/
│   │   │   │   │   │   │   ├── moc_recorder.cpp
│   │   │   │   │   │   │   └── moc_recorder.cpp.d
│   │   │   │   │   │   ├── VGKDREYSTA/
│   │   │   │   │   │   │   ├── moc_controller.cpp
│   │   │   │   │   │   │   └── moc_controller.cpp.d
│   │   │   │   │   │   ├── XA5EKVFPEJ/
│   │   │   │   │   │   │   ├── moc_devicemanage.cpp
│   │   │   │   │   │   │   └── moc_devicemanage.cpp.d
│   │   │   │   │   │   └── XS5GD45QW7/
│   │   │   │   │   │       ├── moc_demuxer.cpp
│   │   │   │   │   │       └── moc_demuxer.cpp.d
│   │   │   │   │   └── mocs_compilation_RelWithDebInfo.cpp
│   │   │   │   ├── QtScrcpyCore.vcxproj
│   │   │   │   ├── QtScrcpyCore.vcxproj.filters
│   │   │   │   └── cmake_install.cmake
│   │   │   ├── QtScrcpy_autogen/
│   │   │   │   ├── PNK5WDWK6L_RelWithDebInfo/
│   │   │   │   │   └── qrc_res.cpp
│   │   │   │   ├── include_RelWithDebInfo/
│   │   │   │   │   ├── 7WSARK52GL/
│   │   │   │   │   │   ├── moc_groupcontroller.cpp
│   │   │   │   │   │   └── moc_groupcontroller.cpp.d
│   │   │   │   │   ├── B2KWJJ5A6K/
│   │   │   │   │   │   ├── moc_keepratiowidget.cpp
│   │   │   │   │   │   ├── moc_keepratiowidget.cpp.d
│   │   │   │   │   │   ├── moc_magneticwidget.cpp
│   │   │   │   │   │   └── moc_magneticwidget.cpp.d
│   │   │   │   │   ├── KH43KSYMFX/
│   │   │   │   │   │   ├── moc_config.cpp
│   │   │   │   │   │   └── moc_config.cpp.d
│   │   │   │   │   ├── PNK5WDWK6L/
│   │   │   │   │   │   └── qrc_res_CMAKE_.cpp
│   │   │   │   │   ├── PZONOMFGYT/
│   │   │   │   │   │   ├── moc_audiooutput.cpp
│   │   │   │   │   │   └── moc_audiooutput.cpp.d
│   │   │   │   │   ├── RZRAGMB46M/
│   │   │   │   │   │   ├── moc_qyuvopenglwidget.cpp
│   │   │   │   │   │   └── moc_qyuvopenglwidget.cpp.d
│   │   │   │   │   ├── UYX5XTB5RZ/
│   │   │   │   │   │   ├── moc_devicevideowidget.cpp
│   │   │   │   │   │   ├── moc_devicevideowidget.cpp.d
│   │   │   │   │   │   ├── moc_dialog.cpp
│   │   │   │   │   │   ├── moc_dialog.cpp.d
│   │   │   │   │   │   ├── moc_moderndevicegroupmanager.cpp
│   │   │   │   │   │   ├── moc_moderndevicegroupmanager.cpp.d
│   │   │   │   │   │   ├── moc_moderndevicetreewidget.cpp
│   │   │   │   │   │   ├── moc_moderndevicetreewidget.cpp.d
│   │   │   │   │   │   ├── moc_moderngridlayoutmanager.cpp
│   │   │   │   │   │   ├── moc_moderngridlayoutmanager.cpp.d
│   │   │   │   │   │   ├── moc_modernmainwindow.cpp
│   │   │   │   │   │   ├── moc_modernmainwindow.cpp.d
│   │   │   │   │   │   ├── moc_modernstylesystem.cpp
│   │   │   │   │   │   ├── moc_modernstylesystem.cpp.d
│   │   │   │   │   │   ├── moc_modernuiintegration.cpp
│   │   │   │   │   │   ├── moc_modernuiintegration.cpp.d
│   │   │   │   │   │   ├── moc_toolform.cpp
│   │   │   │   │   │   ├── moc_toolform.cpp.d
│   │   │   │   │   │   ├── moc_videoform.cpp
│   │   │   │   │   │   └── moc_videoform.cpp.d
│   │   │   │   │   ├── ui_dialog.h
│   │   │   │   │   ├── ui_toolform.h
│   │   │   │   │   └── ui_videoform.h
│   │   │   │   ├── autouic_RelWithDebInfo.stamp
│   │   │   │   └── mocs_compilation_RelWithDebInfo.cpp
│   │   │   ├── ALL_BUILD.vcxproj
│   │   │   ├── ALL_BUILD.vcxproj.filters
│   │   │   ├── QtScrcpy.sln
│   │   │   ├── QtScrcpy.vcxproj
│   │   │   ├── QtScrcpy.vcxproj.filters
│   │   │   └── cmake_install.cmake
│   │   ├── x64/
│   │   │   └── RelWithDebInfo/
│   │   │       └── ZERO_CHECK/
│   │   │           ├── ZERO_CHECK.tlog/
│   │   │           │   ├── CustomBuild.command.1.tlog
│   │   │           │   ├── CustomBuild.read.1.tlog
│   │   │           │   ├── CustomBuild.write.1.tlog
│   │   │           │   └── ZERO_CHECK.lastbuildstate
│   │   │           └── ZERO_CHECK.recipe
│   │   ├── ALL_BUILD.vcxproj
│   │   ├── ALL_BUILD.vcxproj.filters
│   │   ├── CMakeCache.txt
│   │   ├── ZERO_CHECK.vcxproj
│   │   ├── ZERO_CHECK.vcxproj.filters
│   │   ├── all.sln
│   │   └── cmake_install.cmake
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
│   └── userdata.ini
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
├── output/
│   └── x64/
│       └── RelWithDebInfo/
│           ├── QtScrcpy/
│           │   └── ui/
│           │       ├── icons/
│           │       │   ├── device.png
│           │       │   ├── device_connected.png
│           │       │   ├── device_disconnected.png
│           │       │   └── group.png
│           │       ├── image/
│           │       │   ├── tray/
│           │       │   │   └── logo.png
│           │       │   └── videoform/
│           │       │       ├── phone-h.png
│           │       │       └── phone-v.png
│           │       └── res/
│           │           ├── phone-v.png
│           │           └── phone.png
│           ├── AdbWinApi.dll
│           ├── AdbWinUsbApi.dll
│           ├── QtScrcpyCore.lib
│           ├── QtScrcpyCore.pdb
│           ├── adb.exe
│           ├── avcodec-58.dll
│           ├── avformat-58.dll
│           ├── avutil-56.dll
│           ├── modern_ui_config.json
│           ├── scrcpy-server
│           ├── swresample-3.dll
│           └── swscale-5.dll
├── screenshot/
│   ├── game.png
│   ├── linux-en.png
│   ├── linux-zh.png
│   ├── mac-en.png
│   ├── mac-zh.png
│   ├── win-en.png
│   └── win-zh.png
├── .gitignore
├── 20251012_042444_backup_CMakeLists.txt
├── AUTOMATION_ANALYSIS.md
├── Baselogo.jpg
├── Baselogo.png
├── Baselogo.psd.js
├── CMakeLists.txt
├── CMakeLists.txt.backup
├── CodeHistory.txt
├── FINAL_BUILD_EXTENSION_REPORT.md
├── FINAL_IMPLEMENTATION_REPORT.md
├── IMPLEMENTATION_SUMMARY.md
├── LICENSE
├── MODERN_UI_INTEGRATION_REPORT.md
├── PROJECT_COMPLETION_REPORT.md
├── QtScrcpy_tree.md
├── README.md
├── README_zh.md
├── SIMPLIFIED_BUILD_GUIDE.md
├── UI_EXTENSION_ANALYSIS.md
├── build.ps1
├── build.ps1.backup
├── deploy_qt6.ps1
└── install_qt_msvc.ps1
```

---
*Generated by Directory Tree Generator*