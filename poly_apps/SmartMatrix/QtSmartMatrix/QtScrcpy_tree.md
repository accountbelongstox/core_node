# Directory Tree: SmartMatrix

**Path:** `D:\programing\core_node\poly_apps\SmartMatrix\SmartMatrix`

```
SmartMatrix/
├── SmartMatrixCore/
│   ├── include/
│   │   ├── SmartMatrixCore.h
│   │   ├── SmartMatrixCoreDef.h
│   │   └── adbprocess.h
│   ├── src/
│   │   ├── adb/
│   │   │   ├── 20251012_042444_backup_adbprocessimpl.cpp
│   │   │   ├── adbprocess.cpp
│   │   │   ├── adbprocessimpl.cpp
│   │   │   └── adbprocessimpl.h
│   │   ├── common/
│   │   │   └── qscrcpyevent.h
│   │   ├── device/
│   │   │   ├── android/
│   │   │   │   ├── input.h
│   │   │   │   └── keycodes.h
│   │   │   ├── controller/
│   │   │   │   ├── inputconvert/
│   │   │   │   │   ├── keymap/
│   │   │   │   │   │   ├── 20251012_044031_backup_keymap.h
│   │   │   │   │   │   ├── keymap.cpp
│   │   │   │   │   │   └── keymap.h
│   │   │   │   │   ├── controlmsg.cpp
│   │   │   │   │   ├── controlmsg.h
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
│   │   │   │   │   └── receiver.h
│   │   │   │   ├── bufferutil.cpp
│   │   │   │   ├── bufferutil.h
│   │   │   │   ├── controller.cpp
│   │   │   │   └── controller.h
│   │   │   ├── decoder/
│   │   │   │   ├── avframeconvert.cpp
│   │   │   │   ├── avframeconvert.h
│   │   │   │   ├── decoder.cpp
│   │   │   │   ├── decoder.h
│   │   │   │   ├── fpscounter.cpp
│   │   │   │   ├── fpscounter.h
│   │   │   │   ├── videobuffer.cpp
│   │   │   │   └── videobuffer.h
│   │   │   ├── demuxer/
│   │   │   │   ├── demuxer.cpp
│   │   │   │   └── demuxer.h
│   │   │   ├── filehandler/
│   │   │   │   ├── filehandler.cpp
│   │   │   │   └── filehandler.h
│   │   │   ├── recorder/
│   │   │   │   ├── recorder.cpp
│   │   │   │   └── recorder.h
│   │   │   ├── server/
│   │   │   │   ├── server.cpp
│   │   │   │   ├── server.h
│   │   │   │   ├── tcpserver.cpp
│   │   │   │   ├── tcpserver.h
│   │   │   │   ├── videosocket.cpp
│   │   │   │   └── videosocket.h
│   │   │   ├── compat.h
│   │   │   ├── device.cpp
│   │   │   └── device.h
│   │   ├── devicemanage/
│   │   │   ├── devicemanage.cpp
│   │   │   └── devicemanage.h
│   │   └── third_party/
│   │       ├── adb/
│   │       │   ├── linux/
│   │       │   │   └── adb
│   │       │   ├── mac/
│   │       │   │   └── adb
│   │       │   └── win/
│   │       │       ├── AdbWinApi.dll
│   │       │       ├── AdbWinUsbApi.dll
│   │       │       └── adb.exe
│   │       ├── ffmpeg/
│   │       │   ├── bin/
│   │       │   │   ├── x64/
│   │       │   │   │   ├── avcodec-58.dll
│   │       │   │   │   ├── avdevice-58.dll
│   │       │   │   │   ├── avfilter-7.dll
│   │       │   │   │   ├── avformat-58.dll
│   │       │   │   │   ├── avutil-56.dll
│   │       │   │   │   ├── swresample-3.dll
│   │       │   │   │   └── swscale-5.dll
│   │       │   │   └── x86/
│   │       │   │       ├── avcodec-58.dll
│   │       │   │       ├── avdevice-58.dll
│   │       │   │       ├── avfilter-7.dll
│   │       │   │       ├── avformat-58.dll
│   │       │   │       ├── avutil-56.dll
│   │       │   │       ├── swresample-3.dll
│   │       │   │       └── swscale-5.dll
│   │       │   ├── include/
│   │       │   │   ├── libavcodec/
│   │       │   │   │   ├── ac3_parser.h
│   │       │   │   │   ├── adts_parser.h
│   │       │   │   │   ├── avcodec.h
│   │       │   │   │   ├── avdct.h
│   │       │   │   │   ├── avfft.h
│   │       │   │   │   ├── bsf.h
│   │       │   │   │   ├── codec.h
│   │       │   │   │   ├── codec_desc.h
│   │       │   │   │   ├── codec_id.h
│   │       │   │   │   ├── codec_par.h
│   │       │   │   │   ├── d3d11va.h
│   │       │   │   │   ├── dirac.h
│   │       │   │   │   ├── dv_profile.h
│   │       │   │   │   ├── dxva2.h
│   │       │   │   │   ├── jni.h
│   │       │   │   │   ├── mediacodec.h
│   │       │   │   │   ├── packet.h
│   │       │   │   │   ├── qsv.h
│   │       │   │   │   ├── vaapi.h
│   │       │   │   │   ├── vdpau.h
│   │       │   │   │   ├── version.h
│   │       │   │   │   ├── videotoolbox.h
│   │       │   │   │   ├── vorbis_parser.h
│   │       │   │   │   └── xvmc.h
│   │       │   │   ├── libavdevice/
│   │       │   │   │   ├── avdevice.h
│   │       │   │   │   └── version.h
│   │       │   │   ├── libavfilter/
│   │       │   │   │   ├── avfilter.h
│   │       │   │   │   ├── buffersink.h
│   │       │   │   │   ├── buffersrc.h
│   │       │   │   │   └── version.h
│   │       │   │   ├── libavformat/
│   │       │   │   │   ├── avformat.h
│   │       │   │   │   ├── avio.h
│   │       │   │   │   └── version.h
│   │       │   │   ├── libavutil/
│   │       │   │   │   ├── adler32.h
│   │       │   │   │   ├── aes.h
│   │       │   │   │   ├── aes_ctr.h
│   │       │   │   │   ├── attributes.h
│   │       │   │   │   ├── audio_fifo.h
│   │       │   │   │   ├── avassert.h
│   │       │   │   │   ├── avconfig.h
│   │       │   │   │   ├── avstring.h
│   │       │   │   │   ├── avutil.h
│   │       │   │   │   ├── base64.h
│   │       │   │   │   ├── blowfish.h
│   │       │   │   │   ├── bprint.h
│   │       │   │   │   ├── bswap.h
│   │       │   │   │   ├── buffer.h
│   │       │   │   │   ├── camellia.h
│   │       │   │   │   ├── cast5.h
│   │       │   │   │   ├── channel_layout.h
│   │       │   │   │   ├── common.h
│   │       │   │   │   ├── cpu.h
│   │       │   │   │   ├── crc.h
│   │       │   │   │   ├── des.h
│   │       │   │   │   ├── dict.h
│   │       │   │   │   ├── display.h
│   │       │   │   │   ├── dovi_meta.h
│   │       │   │   │   ├── downmix_info.h
│   │       │   │   │   ├── encryption_info.h
│   │       │   │   │   ├── error.h
│   │       │   │   │   ├── eval.h
│   │       │   │   │   ├── ffversion.h
│   │       │   │   │   ├── fifo.h
│   │       │   │   │   ├── file.h
│   │       │   │   │   ├── film_grain_params.h
│   │       │   │   │   ├── frame.h
│   │       │   │   │   ├── hash.h
│   │       │   │   │   ├── hdr_dynamic_metadata.h
│   │       │   │   │   ├── hmac.h
│   │       │   │   │   ├── hwcontext.h
│   │       │   │   │   ├── hwcontext_cuda.h
│   │       │   │   │   ├── hwcontext_d3d11va.h
│   │       │   │   │   ├── hwcontext_drm.h
│   │       │   │   │   ├── hwcontext_dxva2.h
│   │       │   │   │   ├── hwcontext_mediacodec.h
│   │       │   │   │   ├── hwcontext_opencl.h
│   │       │   │   │   ├── hwcontext_qsv.h
│   │       │   │   │   ├── hwcontext_vaapi.h
│   │       │   │   │   ├── hwcontext_vdpau.h
│   │       │   │   │   ├── hwcontext_videotoolbox.h
│   │       │   │   │   ├── hwcontext_vulkan.h
│   │       │   │   │   ├── imgutils.h
│   │       │   │   │   ├── intfloat.h
│   │       │   │   │   ├── intreadwrite.h
│   │       │   │   │   ├── lfg.h
│   │       │   │   │   ├── log.h
│   │       │   │   │   ├── macros.h
│   │       │   │   │   ├── mastering_display_metadata.h
│   │       │   │   │   ├── mathematics.h
│   │       │   │   │   ├── md5.h
│   │       │   │   │   ├── mem.h
│   │       │   │   │   ├── motion_vector.h
│   │       │   │   │   ├── murmur3.h
│   │       │   │   │   ├── opt.h
│   │       │   │   │   ├── parseutils.h
│   │       │   │   │   ├── pixdesc.h
│   │       │   │   │   ├── pixelutils.h
│   │       │   │   │   ├── pixfmt.h
│   │       │   │   │   ├── random_seed.h
│   │       │   │   │   ├── rational.h
│   │       │   │   │   ├── rc4.h
│   │       │   │   │   ├── replaygain.h
│   │       │   │   │   ├── ripemd.h
│   │       │   │   │   ├── samplefmt.h
│   │       │   │   │   ├── sha.h
│   │       │   │   │   ├── sha512.h
│   │       │   │   │   ├── spherical.h
│   │       │   │   │   ├── stereo3d.h
│   │       │   │   │   ├── tea.h
│   │       │   │   │   ├── threadmessage.h
│   │       │   │   │   ├── time.h
│   │       │   │   │   ├── timecode.h
│   │       │   │   │   ├── timestamp.h
│   │       │   │   │   ├── tree.h
│   │       │   │   │   ├── twofish.h
│   │       │   │   │   ├── tx.h
│   │       │   │   │   ├── version.h
│   │       │   │   │   ├── video_enc_params.h
│   │       │   │   │   └── xtea.h
│   │       │   │   ├── libswresample/
│   │       │   │   │   ├── swresample.h
│   │       │   │   │   └── version.h
│   │       │   │   └── libswscale/
│   │       │   │       ├── swscale.h
│   │       │   │       └── version.h
│   │       │   └── lib/
│   │       │       ├── arm64/
│   │       │       │   ├── libavcodec.58.dylib
│   │       │       │   ├── libavdevice.58.dylib
│   │       │       │   ├── libavfilter.7.dylib
│   │       │       │   ├── libavformat.58.dylib
│   │       │       │   ├── libavutil.56.dylib
│   │       │       │   ├── libswresample.3.dylib
│   │       │       │   └── libswscale.5.dylib
│   │       │       ├── x64/
│   │       │       │   ├── avcodec.lib
│   │       │       │   ├── avdevice.lib
│   │       │       │   ├── avfilter.lib
│   │       │       │   ├── avformat.lib
│   │       │       │   ├── avutil.lib
│   │       │       │   ├── libavcodec.58.dylib
│   │       │       │   ├── libavdevice.58.dylib
│   │       │       │   ├── libavfilter.7.dylib
│   │       │       │   ├── libavformat.58.dylib
│   │       │       │   ├── libavutil.56.dylib
│   │       │       │   ├── libswresample.3.dylib
│   │       │       │   ├── libswscale.5.dylib
│   │       │       │   ├── swresample.lib
│   │       │       │   └── swscale.lib
│   │       │       ├── x86/
│   │       │       │   ├── avcodec.lib
│   │       │       │   ├── avdevice.lib
│   │       │       │   ├── avfilter.lib
│   │       │       │   ├── avformat.lib
│   │       │       │   ├── avutil.lib
│   │       │       │   ├── swresample.lib
│   │       │       │   └── swscale.lib
│   │       │       ├── libavcodec.a
│   │       │       ├── libavdevice.a
│   │       │       ├── libavfilter.a
│   │       │       ├── libavformat.a
│   │       │       ├── libavutil.a
│   │       │       ├── libswresample.a
│   │       │       └── libswscale.a
│   │       └── scrcpy-server
│   ├── .gitignore
│   ├── CMakeLists.txt
│   ├── CMakeLists.txt.backup
│   ├── LICENSE
│   └── README.md
├── audio/
│   ├── 20251012_044031_backup_audiooutput.cpp
│   ├── 20251012_044031_backup_audiooutput.h
│   ├── audiooutput.cpp
│   ├── audiooutput.cpp.backup
│   ├── audiooutput.h
│   └── audiooutput.h.backup
├── build-mingw/
│   ├── CMakeFiles/
│   │   ├── 3.30.5/
│   │   │   └── CMakeSystem.cmake
│   │   ├── pkgRedirects/
│   │   ├── CMakeConfigureLog.yaml
│   │   └── cmake.check_cache
│   └── CMakeCache.txt
├── fontawesome/
│   ├── iconhelper.cpp
│   └── iconhelper.h
├── groupcontroller/
│   ├── 20251012_044031_backup_groupcontroller.h
│   ├── groupcontroller.cpp
│   └── groupcontroller.h
├── render/
│   ├── qyuvopenglwidget.cpp
│   ├── qyuvopenglwidget.cpp.backup
│   ├── qyuvopenglwidget.h
│   └── qyuvopenglwidget.h.backup
├── res/
│   ├── font/
│   │   ├── fontawesome-webfont.pdf
│   │   └── fontawesome-webfont.ttf
│   ├── i18n/
│   │   ├── CMakeLists.txt
│   │   ├── en_US.qm
│   │   ├── en_US.ts
│   │   ├── ja_JP.qm
│   │   ├── ja_JP.ts
│   │   ├── zh_CN.qm
│   │   └── zh_CN.ts
│   ├── image/
│   │   ├── tray/
│   │   │   └── logo.png
│   │   └── videoform/
│   │       ├── phone-h.png
│   │       └── phone-v.png
│   ├── qss/
│   │   ├── psblack/
│   │   │   ├── add_bottom.png
│   │   │   ├── add_left.png
│   │   │   ├── add_right.png
│   │   │   ├── add_top.png
│   │   │   ├── branch_close.png
│   │   │   ├── branch_open.png
│   │   │   ├── calendar_nextmonth.png
│   │   │   ├── calendar_prevmonth.png
│   │   │   ├── checkbox_checked.png
│   │   │   ├── checkbox_checked_disable.png
│   │   │   ├── checkbox_parcial.png
│   │   │   ├── checkbox_parcial_disable.png
│   │   │   ├── checkbox_unchecked.png
│   │   │   ├── checkbox_unchecked_disable.png
│   │   │   ├── radiobutton_checked.png
│   │   │   ├── radiobutton_checked_disable.png
│   │   │   ├── radiobutton_unchecked.png
│   │   │   └── radiobutton_unchecked_disable.png
│   │   └── psblack.css
│   ├── Info_Mac.plist.in
│   ├── SmartMatrix.icns
│   ├── SmartMatrix.ico
│   ├── SmartMatrix.rc
│   └── res.qrc
├── sndcpy/
│   ├── sndcpy.apk
│   ├── sndcpy.bat
│   └── sndcpy.sh
├── ui/
│   ├── 20251012_042444_backup_dialog.cpp
│   ├── 20251012_044031_backup_dialog.cpp
│   ├── 20251012_044031_backup_dialog.h
│   ├── 20251012_044031_backup_videoform.cpp
│   ├── 20251012_044031_backup_videoform.h
│   ├── dialog.cpp
│   ├── dialog.h
│   ├── dialog.ui
│   ├── toolform.cpp
│   ├── toolform.h
│   ├── toolform.ui
│   ├── videoform.cpp
│   ├── videoform.h
│   └── videoform.ui
├── uibase/
│   ├── keepratiowidget.cpp
│   ├── keepratiowidget.h
│   ├── magneticwidget.cpp
│   └── magneticwidget.h
├── util/
│   ├── mousetap/
│   │   ├── cocoamousetap.h
│   │   ├── cocoamousetap.mm
│   │   ├── mousetap.cpp
│   │   ├── mousetap.h
│   │   ├── winmousetap.cpp
│   │   ├── winmousetap.h
│   │   ├── xmousetap.cpp
│   │   └── xmousetap.h
│   ├── config.cpp
│   ├── config.cpp.backup
│   ├── config.h
│   ├── config.h.backup
│   ├── path.h
│   ├── path.mm
│   ├── winutils.cpp
│   └── winutils.h
├── CMakeLists.txt
├── CMakeLists.txt.backup
├── appversion
├── clang-format-all.sh
├── main.cpp
└── main.cpp.backup
```

---
*Generated by Directory Tree Generator*