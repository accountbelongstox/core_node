# Audio Stream Test Programs

Real-time audio capture and monitoring tools.

## 🌟 Recommended: SoundCard-based Programs

**For easier installation and better cross-platform support, use these programs:**

### ✅ `soundcard_mic.py` - Microphone Capture (SoundCard)
- Simple `pip install soundcard` - no compilation needed
- Cross-platform (Linux, macOS, Windows)
- Clean, simple API

### ✅ `soundcard_loopback.py` - System Audio Loopback (SoundCard)
- Native loopback support on all platforms
- Captures system audio while still playing through speakers
- No need for platform-specific patches

**See [SOUNDCARD_README.md](SOUNDCARD_README.md) for detailed SoundCard documentation.**

---

## Alternative: PyAudio-based Programs

These programs use PyAudio and require more complex installation:

### 1. `mic_test.py` - Microphone Input (PyAudio)
Captures audio from microphone or line-in devices (external audio sources).

### 2. `loopback_capture.py` - System Audio Loopback (PyAudioWPatch)
Captures system audio that's playing (music, videos, games) - Windows only.

See [LOOPBACK_README.md](LOOPBACK_README.md) for PyAudio loopback documentation.

---

## Quick Comparison

| Feature | SoundCard Programs | PyAudio Programs |
|---------|-------------------|------------------|
| Installation | ✅ Easy (`pip install`) | ⚠️ Complex (binary wheels) |
| Cross-platform | ✅ Yes | ⚠️ Platform-specific |
| Loopback Support | ✅ All platforms | ⚠️ Windows only |
| **Recommendation** | **USE THIS** | Fallback option |

---

## Installation

### 🌟 Recommended: SoundCard

```bash
pip install soundcard numpy
```

That's it! Works on Linux, macOS, and Windows.

### Alternative: PyAudio (More Complex)

#### Windows

```bash
# Install PyAudio (Windows requires pre-compiled wheel)
pip install pipwin
pipwin install pyaudio

# Or install directly
pip install -r requirements.txt
```

#### Linux

```bash
# Install portaudio development library first
sudo apt-get install portaudio19-dev python3-pyaudio

# Then install Python dependencies
pip install -r requirements.txt
```

#### macOS

```bash
# Install portaudio first
brew install portaudio

# Then install Python dependencies
pip install -r requirements.txt
```

---

## Usage

### 🌟 Recommended: SoundCard Programs

#### Microphone Capture

```bash
python soundcard_mic.py
```

#### System Audio Loopback

```bash
python soundcard_loopback.py
```

**Benefits:**
- ✅ Simple installation
- ✅ Works on all platforms
- ✅ Native loopback support
- ✅ Low latency
- ✅ No compilation needed

---

### Alternative: PyAudio Programs

#### Microphone Capture

```bash
python mic_test.py
```

The program will:
1. List all available audio input devices (and test each one)
2. Prompt you to select a device (or use default device)
3. Start displaying audio stream information in real-time
4. Press `Ctrl+C` to stop recording

#### System Audio Loopback Capture (Windows Only)

```bash
python loopback_capture.py
```

The program will:
1. List all available audio output devices (speakers, headphones)
2. Let you select which device to monitor
3. Capture audio playing through that device
4. Audio continues playing normally through speakers
5. Press `Ctrl+C` to stop

**Use this to capture:**
- Music playing in Spotify, YouTube, etc.
- Game audio
- Video call audio
- Any sound your computer is playing

---

## Output Example

```
Available Audio Devices:
============================================================

Device ID: 0
  Name: Microphone (Realtek Audio)
  Input Channels: 2
  Default Sample Rate: 44100 Hz
  Host API: Windows WASAPI

Device ID: 1
  Name: Microphone Array (Intel SST)
  Input Channels: 2
  Default Sample Rate: 48000 Hz
  Host API: Windows WASAPI

============================================================

Default Input Device: ID 0 - Microphone (Realtek Audio)

Enter device ID (press Enter to use default device 0):

Opening device: Microphone (Realtek Audio)
Sample Rate: 44100 Hz, Channels: 1, Format: 16-bit

============================================================
Recording started... (Press Ctrl+C to stop)
============================================================
Volume: [████████----------] RMS:  2451 | Peak:  8921 | dB: -20.34
```

## Technical Details

- Sample Format: 16-bit PCM
- Channels: Mono
- Sample Rate: Use device default sample rate
- Buffer Size: 1024 frames
- Volume Calculation: RMS (Root Mean Square)
- Display Update Rate: Every 10 frames

## Troubleshooting

### PyAudio Installation Failed on Windows

If `pip install pyaudio` fails, try:

```bash
# Method 1: Use pipwin
pip install pipwin
pipwin install pyaudio

# Method 2: Install pre-compiled wheel from unofficial source
pip install pyaudio --only-binary :all:
```

### Audio Device Not Found

Ensure:
1. Microphone is properly connected
2. Driver is installed
3. Microphone is not disabled in system settings
4. Application has permission to access microphone (Windows 10/11 privacy settings)

### Audio Stream Stuttering or Errors

Try:
1. Use a different audio device
2. Adjust buffer size (modify `CHUNK` value)
3. Close other programs using the audio device
