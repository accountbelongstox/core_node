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
import 'package:flutter/material.dart';

abstract class VideoPlayerInterface {
  Future<void> initialize(String url);
  Future<void> play();
  Future<void> pause();
  Future<void> stop();
  Future<void> seek(Duration position);
  Future<void> setVolume(double volume);
  Future<void> setPlaybackSpeed(double speed);
  Widget buildVideoWidget();
  Stream<Duration> get positionStream;
  Stream<Duration> get durationStream;
  Stream<VideoPlayerState> get stateStream;
  Stream<bool> get bufferingStream;
}

enum VideoPlayerState {
  idle,
  initializing,
  initialized,
  playing,
  paused,
  stopped,
  buffering,
  error
}

class VideoPlayer implements VideoPlayerInterface {
  static VideoPlayer? _instance;
  static VideoPlayer get instance => _instance ??= VideoPlayer._internal();
  
  VideoPlayer._internal();

  final StreamController<Duration> _positionController = StreamController<Duration>.broadcast();
  final StreamController<Duration> _durationController = StreamController<Duration>.broadcast();
  final StreamController<VideoPlayerState> _stateController = StreamController<VideoPlayerState>.broadcast();
  final StreamController<bool> _bufferingController = StreamController<bool>.broadcast();

  VideoPlayerState _currentState = VideoPlayerState.idle;
  Duration _currentPosition = Duration.zero;
  Duration _currentDuration = Duration.zero;
  double _currentVolume = 1.0;
  double _playbackSpeed = 1.0;
  String? _currentUrl;
  Size _videoSize = Size.zero;

  @override
  Stream<Duration> get positionStream => _positionController.stream;

  @override
  Stream<Duration> get durationStream => _durationController.stream;

  @override
  Stream<VideoPlayerState> get stateStream => _stateController.stream;

  @override
  Stream<bool> get bufferingStream => _bufferingController.stream;

  VideoPlayerState get currentState => _currentState;
  Duration get currentPosition => _currentPosition;
  Duration get currentDuration => _currentDuration;
  double get currentVolume => _currentVolume;
  double get playbackSpeed => _playbackSpeed;
  String? get currentUrl => _currentUrl;
  Size get videoSize => _videoSize;

  @override
  Future<void> initialize(String url) async {
    try {
      _setState(VideoPlayerState.initializing);
      _currentUrl = url;
      
      // Platform-specific implementation
      if (kIsWeb) {
        await _initializeWeb(url);
      } else {
        await _initializeNative(url);
      }
      
      _setState(VideoPlayerState.initialized);
    } catch (e) {
      _setState(VideoPlayerState.error);
      rethrow;
    }
  }

  @override
  Future<void> play() async {
    if (_currentState == VideoPlayerState.initialized || 
        _currentState == VideoPlayerState.paused) {
      // Platform-specific implementation
      _setState(VideoPlayerState.playing);
    }
  }

  @override
  Future<void> pause() async {
    if (_currentState == VideoPlayerState.playing) {
      // Platform-specific implementation
      _setState(VideoPlayerState.paused);
    }
  }

  @override
  Future<void> stop() async {
    if (_currentState != VideoPlayerState.idle) {
      // Platform-specific implementation
      _currentPosition = Duration.zero;
      _positionController.add(_currentPosition);
      _setState(VideoPlayerState.stopped);
    }
  }

  @override
  Future<void> seek(Duration position) async {
    if (_currentState != VideoPlayerState.idle && 
        _currentState != VideoPlayerState.initializing) {
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

  @override
  Future<void> setPlaybackSpeed(double speed) async {
    _playbackSpeed = speed.clamp(0.25, 2.0);
    // Platform-specific implementation
  }

  @override
  Widget buildVideoWidget() {
    return Container(
      color: Colors.black,
      child: _currentState == VideoPlayerState.initialized ||
             _currentState == VideoPlayerState.playing ||
             _currentState == VideoPlayerState.paused
          ? _buildPlatformVideoWidget()
          : _buildPlaceholderWidget(),
    );
  }

  Widget _buildPlatformVideoWidget() {
    if (kIsWeb) {
      return _buildWebVideoWidget();
    } else {
      return _buildNativeVideoWidget();
    }
  }

  Widget _buildWebVideoWidget() {
    // Web-specific video widget implementation
    return Container(
      child: Center(
        child: Text(
          'Web Video Player\n${_currentUrl ?? 'No URL'}',
          style: TextStyle(color: Colors.white),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  Widget _buildNativeVideoWidget() {
    // Native platform video widget implementation
    return Container(
      child: Center(
        child: Text(
          'Native Video Player\n${_currentUrl ?? 'No URL'}',
          style: TextStyle(color: Colors.white),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  Widget _buildPlaceholderWidget() {
    String message;
    switch (_currentState) {
      case VideoPlayerState.idle:
        message = 'Video Player Ready';
        break;
      case VideoPlayerState.initializing:
        message = 'Initializing...';
        break;
      case VideoPlayerState.buffering:
        message = 'Buffering...';
        break;
      case VideoPlayerState.error:
        message = 'Error Loading Video';
        break;
      default:
        message = 'Video Player';
    }

    return Container(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_currentState == VideoPlayerState.initializing ||
                _currentState == VideoPlayerState.buffering)
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

  Future<void> _initializeWeb(String url) async {
    // Web-specific video initialization
    if (kDebugMode) {
      print('Initializing video on web: $url');
    }
    
    // Simulate initialization delay
    await Future.delayed(Duration(milliseconds: 500));
    
    // Set mock video properties
    _currentDuration = Duration(minutes: 5, seconds: 30);
    _videoSize = Size(1920, 1080);
    _durationController.add(_currentDuration);
  }

  Future<void> _initializeNative(String url) async {
    // Native platform video initialization
    if (kDebugMode) {
      print('Initializing video on native: $url');
    }
    
    // Simulate initialization delay
    await Future.delayed(Duration(milliseconds: 500));
    
    // Set mock video properties
    _currentDuration = Duration(minutes: 5, seconds: 30);
    _videoSize = Size(1920, 1080);
    _durationController.add(_currentDuration);
  }

  void _setState(VideoPlayerState state) {
    _currentState = state;
    _stateController.add(state);
  }

  void dispose() {
    _positionController.close();
    _durationController.close();
    _stateController.close();
    _bufferingController.close();
  }
}
