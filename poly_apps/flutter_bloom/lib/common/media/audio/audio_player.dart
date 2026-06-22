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
import 'package:flutter/foundation.dart';

abstract class AudioPlayerInterface {
  Future<void> play(String url);
  Future<void> pause();
  Future<void> stop();
  Future<void> seek(Duration position);
  Future<void> setVolume(double volume);
  Stream<Duration> get positionStream;
  Stream<Duration> get durationStream;
  Stream<AudioPlayerState> get stateStream;
}

enum AudioPlayerState {
  idle,
  loading,
  playing,
  paused,
  stopped,
  error
}

class AudioPlayer implements AudioPlayerInterface {
  static AudioPlayer? _instance;
  static AudioPlayer get instance => _instance ??= AudioPlayer._internal();
  
  AudioPlayer._internal();

  final StreamController<Duration> _positionController = StreamController<Duration>.broadcast();
  final StreamController<Duration> _durationController = StreamController<Duration>.broadcast();
  final StreamController<AudioPlayerState> _stateController = StreamController<AudioPlayerState>.broadcast();

  AudioPlayerState _currentState = AudioPlayerState.idle;
  Duration _currentPosition = Duration.zero;
  final Duration _currentDuration = Duration.zero;
  double _currentVolume = 1.0;
  String? _currentUrl;

  @override
  Stream<Duration> get positionStream => _positionController.stream;

  @override
  Stream<Duration> get durationStream => _durationController.stream;

  @override
  Stream<AudioPlayerState> get stateStream => _stateController.stream;

  AudioPlayerState get currentState => _currentState;
  Duration get currentPosition => _currentPosition;
  Duration get currentDuration => _currentDuration;
  double get currentVolume => _currentVolume;
  String? get currentUrl => _currentUrl;

  @override
  Future<void> play(String url) async {
    try {
      _setState(AudioPlayerState.loading);
      _currentUrl = url;
      
      // Platform-specific implementation would go here
      if (kIsWeb) {
        await _playWeb(url);
      } else {
        await _playNative(url);
      }
      
      _setState(AudioPlayerState.playing);
    } catch (e) {
      _setState(AudioPlayerState.error);
      rethrow;
    }
  }

  @override
  Future<void> pause() async {
    if (_currentState == AudioPlayerState.playing) {
      // Platform-specific implementation
      _setState(AudioPlayerState.paused);
    }
  }

  @override
  Future<void> stop() async {
    if (_currentState != AudioPlayerState.idle) {
      // Platform-specific implementation
      _currentPosition = Duration.zero;
      _positionController.add(_currentPosition);
      _setState(AudioPlayerState.stopped);
    }
  }

  @override
  Future<void> seek(Duration position) async {
    if (_currentState != AudioPlayerState.idle) {
      _currentPosition = position;
      _positionController.add(_currentPosition);
      // Platform-specific implementation
    }
  }

  @override
  Future<void> setVolume(double volume) async {
    _currentVolume = volume.clamp(0.0, 1.0);
    // Platform-specific implementation
  }

  Future<void> _playWeb(String url) async {
    // Web-specific audio implementation
    if (kDebugMode) {
      print('Playing audio on web: $url');
    }
  }

  Future<void> _playNative(String url) async {
    // Native platform audio implementation
    if (kDebugMode) {
      print('Playing audio on native: $url');
    }
  }

  void _setState(AudioPlayerState state) {
    _currentState = state;
    _stateController.add(state);
  }

  void dispose() {
    _positionController.close();
    _durationController.close();
    _stateController.close();
  }
}
