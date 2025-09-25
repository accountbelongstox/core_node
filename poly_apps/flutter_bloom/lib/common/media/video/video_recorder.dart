// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

abstract class VideoRecorderInterface {
  Future<void> initialize();
  Future<void> startRecording({String? outputPath, VideoQuality quality = VideoQuality.medium});
  Future<String?> stopRecording();
  Future<void> pauseRecording();
  Future<void> resumeRecording();
  Widget buildCameraPreview();
  Future<void> switchCamera();
  Stream<VideoRecordingState> get stateStream;
  Stream<Duration> get durationStream;
}

enum VideoRecordingState {
  idle,
  initializing,
  initialized,
  recording,
  paused,
  stopped,
  error
}

enum VideoQuality {
  low,    // 480p
  medium, // 720p
  high,   // 1080p
  ultra   // 4K
}

enum CameraPosition {
  front,
  back
}

class VideoRecorder implements VideoRecorderInterface {
  static VideoRecorder? _instance;
  static VideoRecorder get instance => _instance ??= VideoRecorder._internal();
  
  VideoRecorder._internal();

  final StreamController<VideoRecordingState> _stateController = StreamController<VideoRecordingState>.broadcast();
  final StreamController<Duration> _durationController = StreamController<Duration>.broadcast();

  VideoRecordingState _currentState = VideoRecordingState.idle;
  Duration _recordingDuration = Duration.zero;
  String? _currentOutputPath;
  CameraPosition _currentCamera = CameraPosition.back;
  VideoQuality _currentQuality = VideoQuality.medium;
  Timer? _durationTimer;

  @override
  Stream<VideoRecordingState> get stateStream => _stateController.stream;

  @override
  Stream<Duration> get durationStream => _durationController.stream;

  VideoRecordingState get currentState => _currentState;
  Duration get recordingDuration => _recordingDuration;
  String? get currentOutputPath => _currentOutputPath;
  CameraPosition get currentCamera => _currentCamera;
  VideoQuality get currentQuality => _currentQuality;

  @override
  Future<void> initialize() async {
    try {
      _setState(VideoRecordingState.initializing);
      
      // Platform-specific camera initialization
      if (kIsWeb) {
        await _initializeWeb();
      } else {
        await _initializeNative();
      }
      
      _setState(VideoRecordingState.initialized);
    } catch (e) {
      _setState(VideoRecordingState.error);
      rethrow;
    }
  }

  @override
  Future<void> startRecording({String? outputPath, VideoQuality quality = VideoQuality.medium}) async {
    try {
      if (_currentState != VideoRecordingState.initialized) {
        throw Exception('Camera is not initialized');
      }

      _currentOutputPath = outputPath ?? await _generateOutputPath();
      _currentQuality = quality;
      
      // Platform-specific recording start
      if (kIsWeb) {
        await _startRecordingWeb();
      } else {
        await _startRecordingNative();
      }

      _setState(VideoRecordingState.recording);
      _startDurationTimer();
      
    } catch (e) {
      _setState(VideoRecordingState.error);
      rethrow;
    }
  }

  @override
  Future<String?> stopRecording() async {
    if (_currentState == VideoRecordingState.recording || 
        _currentState == VideoRecordingState.paused) {
      _stopDurationTimer();
      
      // Platform-specific recording stop
      String? filePath;
      if (kIsWeb) {
        filePath = await _stopRecordingWeb();
      } else {
        filePath = await _stopRecordingNative();
      }

      _setState(VideoRecordingState.stopped);
      _recordingDuration = Duration.zero;
      _durationController.add(_recordingDuration);
      
      return filePath;
    }
    return null;
  }

  @override
  Future<void> pauseRecording() async {
    if (_currentState == VideoRecordingState.recording) {
      _stopDurationTimer();
      // Platform-specific pause implementation
      _setState(VideoRecordingState.paused);
    }
  }

  @override
  Future<void> resumeRecording() async {
    if (_currentState == VideoRecordingState.paused) {
      // Platform-specific resume implementation
      _setState(VideoRecordingState.recording);
      _startDurationTimer();
    }
  }

  @override
  Future<void> switchCamera() async {
    if (_currentState == VideoRecordingState.initialized || 
        _currentState == VideoRecordingState.stopped) {
      _currentCamera = _currentCamera == CameraPosition.back 
          ? CameraPosition.front 
          : CameraPosition.back;
      
      // Platform-specific camera switch implementation
      if (kDebugMode) {
        print('Switched to ${_currentCamera.name} camera');
      }
    }
  }

  @override
  Widget buildCameraPreview() {
    return Container(
      color: Colors.black,
      child: _currentState == VideoRecordingState.initialized ||
             _currentState == VideoRecordingState.recording ||
             _currentState == VideoRecordingState.paused ||
             _currentState == VideoRecordingState.stopped
          ? _buildPlatformCameraPreview()
          : _buildPlaceholderWidget(),
    );
  }

  Widget _buildPlatformCameraPreview() {
    if (kIsWeb) {
      return _buildWebCameraPreview();
    } else {
      return _buildNativeCameraPreview();
    }
  }

  Widget _buildWebCameraPreview() {
    // Web-specific camera preview implementation
    return Container(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.videocam, size: 64, color: Colors.white),
            SizedBox(height: 16),
            Text(
              'Web Camera Preview\n${_currentCamera.name.toUpperCase()} Camera',
              style: TextStyle(color: Colors.white),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNativeCameraPreview() {
    // Native platform camera preview implementation
    return Container(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.videocam, size: 64, color: Colors.white),
            SizedBox(height: 16),
            Text(
              'Native Camera Preview\n${_currentCamera.name.toUpperCase()} Camera',
              style: TextStyle(color: Colors.white),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholderWidget() {
    String message;
    switch (_currentState) {
      case VideoRecordingState.idle:
        message = 'Camera Not Initialized';
        break;
      case VideoRecordingState.initializing:
        message = 'Initializing Camera...';
        break;
      case VideoRecordingState.error:
        message = 'Camera Error';
        break;
      default:
        message = 'Camera';
    }

    return Container(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_currentState == VideoRecordingState.initializing)
              CircularProgressIndicator(color: Colors.white),
            SizedBox(height: 16),
            Text(
              message,
              style: TextStyle(color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }

  Future<String> _generateOutputPath() async {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    
    if (kIsWeb) {
      return 'video_recording_$timestamp.mp4';
    } else {
      final directory = Directory.systemTemp;
      return '${directory.path}/video_recording_$timestamp.mp4';
    }
  }

  Future<void> _initializeWeb() async {
    // Web-specific camera initialization
    if (kDebugMode) {
      print('Initializing camera on web');
    }
    await Future.delayed(Duration(milliseconds: 1000));
  }

  Future<void> _initializeNative() async {
    // Native platform camera initialization
    if (kDebugMode) {
      print('Initializing camera on native');
    }
    await Future.delayed(Duration(milliseconds: 1000));
  }

  Future<void> _startRecordingWeb() async {
    // Web-specific recording start
    if (kDebugMode) {
      print('Starting video recording on web: $_currentOutputPath');
    }
  }

  Future<void> _startRecordingNative() async {
    // Native platform recording start
    if (kDebugMode) {
      print('Starting video recording on native: $_currentOutputPath');
    }
  }

  Future<String?> _stopRecordingWeb() async {
    // Web-specific recording stop
    if (kDebugMode) {
      print('Stopping video recording on web');
    }
    return _currentOutputPath;
  }

  Future<String?> _stopRecordingNative() async {
    // Native platform recording stop
    if (kDebugMode) {
      print('Stopping video recording on native');
    }
    return _currentOutputPath;
  }

  void _startDurationTimer() {
    _durationTimer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      _recordingDuration = Duration(milliseconds: _recordingDuration.inMilliseconds + 100);
      _durationController.add(_recordingDuration);
    });
  }

  void _stopDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = null;
  }

  void _setState(VideoRecordingState state) {
    _currentState = state;
    _stateController.add(state);
  }

  void dispose() {
    _stopDurationTimer();
    _stateController.close();
    _durationController.close();
  }
}
