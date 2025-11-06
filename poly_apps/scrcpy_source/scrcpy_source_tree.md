# Directory Tree: scrcpy_source

**Path:** `D:\programing\core_node\poly_apps\scrcpy_source`

```
scrcpy_source/
├── app/
│   ├── data/
│   │   ├── bash-completion/
│   │   │   └── scrcpy
│   │   ├── zsh-completion/
│   │   │   └── _scrcpy
│   │   ├── icon.ico
│   │   ├── icon.png
│   │   ├── icon.svg
│   │   ├── open_a_terminal_here.bat
│   │   ├── scrcpy-console.bat
│   │   └── scrcpy-noconsole.vbs
│   ├── deps/
│   │   ├── .gitignore
│   │   ├── README
│   │   ├── adb_linux.sh
│   │   ├── adb_macos.sh
│   │   ├── adb_windows.sh
│   │   ├── common
│   │   ├── dav1d.sh
│   │   ├── ffmpeg.sh
│   │   ├── libusb.sh
│   │   └── sdl.sh
│   ├── src/
│   │   ├── adb/
│   │   │   ├── adb.c
│   │   │   ├── adb.h
│   │   │   ├── adb_device.c
│   │   │   ├── adb_device.h
│   │   │   ├── adb_parser.c
│   │   │   ├── adb_parser.h
│   │   │   ├── adb_tunnel.c
│   │   │   └── adb_tunnel.h
│   │   ├── android/
│   │   │   ├── input.h
│   │   │   └── keycodes.h
│   │   ├── hid/
│   │   │   ├── hid_event.h
│   │   │   ├── hid_gamepad.c
│   │   │   ├── hid_gamepad.h
│   │   │   ├── hid_keyboard.c
│   │   │   ├── hid_keyboard.h
│   │   │   ├── hid_mouse.c
│   │   │   └── hid_mouse.h
│   │   ├── sys/
│   │   │   ├── unix/
│   │   │   │   ├── file.c
│   │   │   │   └── process.c
│   │   │   └── win/
│   │   │       ├── file.c
│   │   │       └── process.c
│   │   ├── trait/
│   │   │   ├── frame_sink.h
│   │   │   ├── frame_source.c
│   │   │   ├── frame_source.h
│   │   │   ├── gamepad_processor.h
│   │   │   ├── key_processor.h
│   │   │   ├── mouse_processor.h
│   │   │   ├── packet_sink.h
│   │   │   ├── packet_source.c
│   │   │   └── packet_source.h
│   │   ├── uhid/
│   │   │   ├── gamepad_uhid.c
│   │   │   ├── gamepad_uhid.h
│   │   │   ├── keyboard_uhid.c
│   │   │   ├── keyboard_uhid.h
│   │   │   ├── mouse_uhid.c
│   │   │   ├── mouse_uhid.h
│   │   │   ├── uhid_output.c
│   │   │   └── uhid_output.h
│   │   ├── usb/
│   │   │   ├── aoa_hid.c
│   │   │   ├── aoa_hid.h
│   │   │   ├── gamepad_aoa.c
│   │   │   ├── gamepad_aoa.h
│   │   │   ├── keyboard_aoa.c
│   │   │   ├── keyboard_aoa.h
│   │   │   ├── mouse_aoa.c
│   │   │   ├── mouse_aoa.h
│   │   │   ├── scrcpy_otg.c
│   │   │   ├── scrcpy_otg.h
│   │   │   ├── screen_otg.c
│   │   │   ├── screen_otg.h
│   │   │   ├── usb.c
│   │   │   └── usb.h
│   │   ├── util/
│   │   │   ├── acksync.c
│   │   │   ├── acksync.h
│   │   │   ├── audiobuf.c
│   │   │   ├── audiobuf.h
│   │   │   ├── average.c
│   │   │   ├── average.h
│   │   │   ├── binary.h
│   │   │   ├── env.c
│   │   │   ├── env.h
│   │   │   ├── file.c
│   │   │   ├── file.h
│   │   │   ├── intmap.c
│   │   │   ├── intmap.h
│   │   │   ├── intr.c
│   │   │   ├── intr.h
│   │   │   ├── log.c
│   │   │   ├── log.h
│   │   │   ├── memory.c
│   │   │   ├── memory.h
│   │   │   ├── net.c
│   │   │   ├── net.h
│   │   │   ├── net_intr.c
│   │   │   ├── net_intr.h
│   │   │   ├── process.c
│   │   │   ├── process.h
│   │   │   ├── process_intr.c
│   │   │   ├── process_intr.h
│   │   │   ├── rand.c
│   │   │   ├── rand.h
│   │   │   ├── str.c
│   │   │   ├── str.h
│   │   │   ├── strbuf.c
│   │   │   ├── strbuf.h
│   │   │   ├── term.c
│   │   │   ├── term.h
│   │   │   ├── thread.c
│   │   │   ├── thread.h
│   │   │   ├── tick.c
│   │   │   ├── tick.h
│   │   │   ├── timeout.c
│   │   │   ├── timeout.h
│   │   │   ├── vecdeque.h
│   │   │   └── vector.h
│   │   ├── audio_player.c
│   │   ├── audio_player.h
│   │   ├── audio_regulator.c
│   │   ├── audio_regulator.h
│   │   ├── cli.c
│   │   ├── cli.h
│   │   ├── clock.c
│   │   ├── clock.h
│   │   ├── common.h
│   │   ├── compat.c
│   │   ├── compat.h
│   │   ├── control_msg.c
│   │   ├── control_msg.h
│   │   ├── controller.c
│   │   ├── controller.h
│   │   ├── coords.h
│   │   ├── decoder.c
│   │   ├── decoder.h
│   │   ├── delay_buffer.c
│   │   ├── delay_buffer.h
│   │   ├── demuxer.c
│   │   ├── demuxer.h
│   │   ├── device_msg.c
│   │   ├── device_msg.h
│   │   ├── display.c
│   │   ├── display.h
│   │   ├── events.c
│   │   ├── events.h
│   │   ├── file_pusher.c
│   │   ├── file_pusher.h
│   │   ├── fps_counter.c
│   │   ├── fps_counter.h
│   │   ├── frame_buffer.c
│   │   ├── frame_buffer.h
│   │   ├── icon.c
│   │   ├── icon.h
│   │   ├── input_events.h
│   │   ├── input_manager.c
│   │   ├── input_manager.h
│   │   ├── keyboard_sdk.c
│   │   ├── keyboard_sdk.h
│   │   ├── main.c
│   │   ├── mouse_capture.c
│   │   ├── mouse_capture.h
│   │   ├── mouse_sdk.c
│   │   ├── mouse_sdk.h
│   │   ├── opengl.c
│   │   ├── opengl.h
│   │   ├── options.c
│   │   ├── options.h
│   │   ├── packet_merger.c
│   │   ├── packet_merger.h
│   │   ├── receiver.c
│   │   ├── receiver.h
│   │   ├── recorder.c
│   │   ├── recorder.h
│   │   ├── scrcpy.c
│   │   ├── scrcpy.h
│   │   ├── screen.c
│   │   ├── screen.h
│   │   ├── server.c
│   │   ├── server.h
│   │   ├── shortcut_mod.h
│   │   ├── v4l2_sink.c
│   │   ├── v4l2_sink.h
│   │   ├── version.c
│   │   └── version.h
│   ├── tests/
│   │   ├── test_adb_parser.c
│   │   ├── test_audiobuf.c
│   │   ├── test_binary.c
│   │   ├── test_cli.c
│   │   ├── test_control_msg_serialize.c
│   │   ├── test_device_msg_deserialize.c
│   │   ├── test_orientation.c
│   │   ├── test_str.c
│   │   ├── test_strbuf.c
│   │   ├── test_vecdeque.c
│   │   └── test_vector.c
│   ├── meson.build
│   ├── scrcpy-windows.manifest
│   ├── scrcpy-windows.rc
│   └── scrcpy.1
├── assets/
│   └── screenshot-debian-600.jpg
├── config/
│   ├── checkstyle/
│   │   └── checkstyle.xml
│   └── android-checkstyle.gradle
├── doc/
│   ├── audio.md
│   ├── build.md
│   ├── camera.md
│   ├── connection.md
│   ├── control.md
│   ├── develop.md
│   ├── device.md
│   ├── gamepad.md
│   ├── keyboard.md
│   ├── linux.md
│   ├── macos.md
│   ├── mouse.md
│   ├── otg.md
│   ├── recording.md
│   ├── shortcuts.md
│   ├── tunnels.md
│   ├── v4l2.md
│   ├── video.md
│   ├── virtual_display.md
│   ├── window.md
│   └── windows.md
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── release/
│   ├── .gitignore
│   ├── build_common
│   ├── build_linux.sh
│   ├── build_macos.sh
│   ├── build_server.sh
│   ├── build_windows.sh
│   ├── generate_checksums.sh
│   ├── package_client.sh
│   ├── package_server.sh
│   ├── release.sh
│   ├── test_client.sh
│   └── test_server.sh
├── server/
│   ├── scripts/
│   │   └── build-wrapper.sh
│   ├── src/
│   │   ├── main/
│   │   │   ├── aidl/
│   │   │   │   └── android/
│   │   │   │       ├── content/
│   │   │   │       │   └── IOnPrimaryClipChangedListener.aidl
│   │   │   │       └── view/
│   │   │   │           └── IDisplayWindowListener.aidl
│   │   │   ├── java/
│   │   │   │   ├── android/
│   │   │   │   │   └── content/
│   │   │   │   │       └── IContentProvider.java
│   │   │   │   └── com/
│   │   │   │       └── genymobile/
│   │   │   │           └── scrcpy/
│   │   │   │               ├── audio/
│   │   │   │               │   ├── AudioCapture.java
│   │   │   │               │   ├── AudioCaptureException.java
│   │   │   │               │   ├── AudioCodec.java
│   │   │   │               │   ├── AudioConfig.java
│   │   │   │               │   ├── AudioDirectCapture.java
│   │   │   │               │   ├── AudioEncoder.java
│   │   │   │               │   ├── AudioPlaybackCapture.java
│   │   │   │               │   ├── AudioRawRecorder.java
│   │   │   │               │   ├── AudioRecordReader.java
│   │   │   │               │   └── AudioSource.java
│   │   │   │               ├── control/
│   │   │   │               │   ├── ControlChannel.java
│   │   │   │               │   ├── ControlMessage.java
│   │   │   │               │   ├── ControlMessageReader.java
│   │   │   │               │   ├── ControlProtocolException.java
│   │   │   │               │   ├── Controller.java
│   │   │   │               │   ├── DeviceMessage.java
│   │   │   │               │   ├── DeviceMessageSender.java
│   │   │   │               │   ├── DeviceMessageWriter.java
│   │   │   │               │   ├── KeyComposition.java
│   │   │   │               │   ├── Pointer.java
│   │   │   │               │   ├── PointersState.java
│   │   │   │               │   ├── PositionMapper.java
│   │   │   │               │   └── UhidManager.java
│   │   │   │               ├── device/
│   │   │   │               │   ├── ConfigurationException.java
│   │   │   │               │   ├── DesktopConnection.java
│   │   │   │               │   ├── Device.java
│   │   │   │               │   ├── DeviceApp.java
│   │   │   │               │   ├── DisplayInfo.java
│   │   │   │               │   ├── NewDisplay.java
│   │   │   │               │   ├── Orientation.java
│   │   │   │               │   ├── Point.java
│   │   │   │               │   ├── Position.java
│   │   │   │               │   ├── Size.java
│   │   │   │               │   └── Streamer.java
│   │   │   │               ├── opengl/
│   │   │   │               │   ├── AffineOpenGLFilter.java
│   │   │   │               │   ├── GLUtils.java
│   │   │   │               │   ├── OpenGLException.java
│   │   │   │               │   ├── OpenGLFilter.java
│   │   │   │               │   └── OpenGLRunner.java
│   │   │   │               ├── util/
│   │   │   │               │   ├── AffineMatrix.java
│   │   │   │               │   ├── Binary.java
│   │   │   │               │   ├── Codec.java
│   │   │   │               │   ├── CodecOption.java
│   │   │   │               │   ├── CodecUtils.java
│   │   │   │               │   ├── Command.java
│   │   │   │               │   ├── HandlerExecutor.java
│   │   │   │               │   ├── IO.java
│   │   │   │               │   ├── Ln.java
│   │   │   │               │   ├── LogUtils.java
│   │   │   │               │   ├── Settings.java
│   │   │   │               │   ├── SettingsException.java
│   │   │   │               │   └── StringUtils.java
│   │   │   │               ├── video/
│   │   │   │               │   ├── CameraAspectRatio.java
│   │   │   │               │   ├── CameraCapture.java
│   │   │   │               │   ├── CameraFacing.java
│   │   │   │               │   ├── CaptureReset.java
│   │   │   │               │   ├── DisplaySizeMonitor.java
│   │   │   │               │   ├── NewDisplayCapture.java
│   │   │   │               │   ├── ScreenCapture.java
│   │   │   │               │   ├── SurfaceCapture.java
│   │   │   │               │   ├── SurfaceEncoder.java
│   │   │   │               │   ├── VideoCodec.java
│   │   │   │               │   ├── VideoFilter.java
│   │   │   │               │   ├── VideoSource.java
│   │   │   │               │   └── VirtualDisplayListener.java
│   │   │   │               ├── wrappers/
│   │   │   │               │   ├── ActivityManager.java
│   │   │   │               │   ├── ClipboardManager.java
│   │   │   │               │   ├── ContentProvider.java
│   │   │   │               │   ├── DisplayControl.java
│   │   │   │               │   ├── DisplayManager.java
│   │   │   │               │   ├── DisplayWindowListener.java
│   │   │   │               │   ├── InputManager.java
│   │   │   │               │   ├── PowerManager.java
│   │   │   │               │   ├── ServiceManager.java
│   │   │   │               │   ├── StatusBarManager.java
│   │   │   │               │   ├── SurfaceControl.java
│   │   │   │               │   └── WindowManager.java
│   │   │   │               ├── AndroidVersions.java
│   │   │   │               ├── AsyncProcessor.java
│   │   │   │               ├── CleanUp.java
│   │   │   │               ├── FakeContext.java
│   │   │   │               ├── Options.java
│   │   │   │               ├── Server.java
│   │   │   │               └── Workarounds.java
│   │   │   └── AndroidManifest.xml
│   │   └── test/
│   │       └── java/
│   │           └── com/
│   │               └── genymobile/
│   │                   └── scrcpy/
│   │                       ├── control/
│   │                       │   ├── ControlMessageReaderTest.java
│   │                       │   └── DeviceMessageWriterTest.java
│   │                       └── util/
│   │                           ├── BinaryTest.java
│   │                           ├── CodecOptionsTest.java
│   │                           ├── CommandParserTest.java
│   │                           └── StringUtilsTest.java
│   ├── .gitignore
│   ├── build.gradle
│   ├── build_without_gradle.sh
│   ├── meson.build
│   └── proguard-rules.pro
├── .gitignore
├── FAQ.md
├── LICENSE
├── README.md
├── build.gradle
├── bump_version
├── cross_win32.txt
├── cross_win64.txt
├── gradle.properties
├── gradlew
├── gradlew.bat
├── install_release.sh
├── meson.build
├── meson_options.txt
├── run
└── settings.gradle
```

---
*Generated by Directory Tree Generator*