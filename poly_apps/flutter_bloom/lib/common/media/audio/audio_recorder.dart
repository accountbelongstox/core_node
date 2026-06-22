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

abstract class AudioRecorderInterface {
  Future<void> startRecording({String? outputPath, AudioFormat format = AudioFormat.aac});
  Future<String?> stopRecording();
  Future<void> pauseRecording();
  Future<void> resumeRecording();
  Stream<RecordingState> get stateStream;
  Stream<Duration> get durationStream;
  Stream<double> get amplitudeStream;
}

enum RecordingState {
  idle,
  recording,
  paused,
  stopped,
  error
}

enum AudioFormat {
  aac,
  mp3,
  wav,
  m4a
}

class AudioRecorder implements AudioRecorderInterface {
  static AudioRecorder? _instance;
  static AudioRecorder get instance => _instance ??= AudioRecorder._internal();
  
  AudioRecorder._internal();

  final StreamController<RecordingState> _stateController = StreamController<RecordingState>.broadcast();
  final StreamController<Duration> _durationController = StreamController<Duration>.broadcast();
  final StreamController<double> _amplitudeController = StreamController<double>.broadcast();

  RecordingState _currentState = RecordingState.idle;
  Duration _recordingDuration = Duration.zero;
  String? _currentOutputPath;
  Timer? _durationTimer;

  @override
  Stream<RecordingState> get stateStream => _stateController.stream;

  @override
  Stream<Duration> get durationStream => _durationController.stream;

  @override
  Stream<double> get amplitudeStream => _amplitudeController.stream;

  RecordingState get currentState => _currentState;
  Duration get recordingDuration => _recordingDuration;
  String? get currentOutputPath => _currentOutputPath;

  @override
  Future<void> startRecording({String? outputPath, AudioFormat format = AudioFormat.aac}) async {
    try {
      if (_currentState != RecordingState.idle) {
        throw Exception('Recorder is not in idle state');
      }

      _currentOutputPath = outputPath ?? await _generateOutputPath(format);
      
      // Platform-specific implementation
      if (kIsWeb) {
        await _startRecordingWeb(format);
      } else {
        await _startRecordingNative(_currentOutputPath!, format);
      }

      _setState(RecordingState.recording);
      _startDurationTimer();
      
    } catch (e) {
      _setState(RecordingState.error);
      rethrow;
    }
  }

  @override
  Future<String?> stopRecording() async {
    if (_currentState == RecordingState.recording || _currentState == RecordingState.paused) {
      _stopDurationTimer();
      
      // Platform-specific implementation
      String? filePath;
      if (kIsWeb) {
        filePath = await _stopRecordingWeb();
      } else {
        filePath = await _stopRecordingNative();
      }

      _setState(RecordingState.stopped);
      _recordingDuration = Duration.zero;
      _durationController.add(_recordingDuration);
      
      return filePath;
    }
    return null;
  }

  @override
  Future<void> pauseRecording() async {
    if (_currentState == RecordingState.recording) {
      _stopDurationTimer();
      // Platform-specific implementation
      _setState(RecordingState.paused);
    }
  }

  @override
  Future<void> resumeRecording() async {
    if (_currentState == RecordingState.paused) {
      // Platform-specific implementation
      _setState(RecordingState.recording);
      _startDurationTimer();
    }
  }

  Future<String> _generateOutputPath(AudioFormat format) async {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final extension = _getFileExtension(format);
    
    if (kIsWeb) {
      return 'recording_$timestamp.$extension';
    } else {
      final directory = Directory.systemTemp;
      return '${directory.path}/recording_$timestamp.$extension';
    }
  }

  String _getFileExtension(AudioFormat format) {
    switch (format) {
      case AudioFormat.aac:
        return 'aac';
      case AudioFormat.mp3:
        return 'mp3';
      case AudioFormat.wav:
        return 'wav';
      case AudioFormat.m4a:
        return 'm4a';
    }
  }

  Future<void> _startRecordingWeb(AudioFormat format) async {
    // Web-specific recording implementation
    if (kDebugMode) {
      print('Starting recording on web with format: $format');
    }
  }

  Future<void> _startRecordingNative(String outputPath, AudioFormat format) async {
    // Native platform recording implementation
    if (kDebugMode) {
      print('Starting recording on native: $outputPath with format: $format');
    }
  }

  Future<String?> _stopRecordingWeb() async {
    // Web-specific stop recording implementation
    if (kDebugMode) {
      print('Stopping recording on web');
    }
    return _currentOutputPath;
  }

  Future<String?> _stopRecordingNative() async {
    // Native platform stop recording implementation
    if (kDebugMode) {
      print('Stopping recording on native');
    }
    return _currentOutputPath;
  }

  void _startDurationTimer() {
    _durationTimer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      _recordingDuration = Duration(milliseconds: _recordingDuration.inMilliseconds + 100);
      _durationController.add(_recordingDuration);
      
      // Simulate amplitude data
      final amplitude = (DateTime.now().millisecondsSinceEpoch % 100) / 100.0;
      _amplitudeController.add(amplitude);
    });
  }

  void _stopDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = null;
  }

  void _setState(RecordingState state) {
    _currentState = state;
    _stateController.add(state);
  }

  void dispose() {
    _stopDurationTimer();
    _stateController.close();
    _durationController.close();
    _amplitudeController.close();
  }
}
