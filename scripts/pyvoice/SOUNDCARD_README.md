# SoundCard-based Audio Capture Programs

**RECOMMENDED**: Use these programs for better cross-platform support and easier setup!

## Why SoundCard?

### Advantages over PyAudio:

| Feature | SoundCard | PyAudio |
|---------|-----------|---------|
| Installation | ✅ Simple `pip install` | ⚠️ Needs compilation/binary wheels |
| Cross-platform | ✅ Linux, macOS, Windows | ⚠️ Platform-specific builds |
| Loopback Support | ✅ Native on Windows | ⚠️ Requires pyaudiowpatch |
| API Simplicity | ✅ Very simple | ⚠️ More complex |
| Dependencies | ✅ Pure CFFI (no C extension) | ⚠️ Requires portaudio library |
| Low Latency | ✅ Excellent | ✅ Good |
| Channel Mapping | ✅ Flexible | ⚠️ Limited |

## Programs

### 1. `soundcard_mic.py` - Microphone Capture
Captures audio from microphone or line-in devices.

### 2. `soundcard_loopback.py` - System Audio Loopback
Captures system audio (music, videos, games) while still allowing playback.

## Installation

### Quick Install (Recommended)

```bash
pip install soundcard numpy
```

That's it! No need for platform-specific binary wheels or compilation.

### Platform-Specific Notes

#### Windows
- Works out of the box
- Uses WASAPI for loopback
- No additional setup required

#### macOS
- Works for microphone capture
- For loopback, install a virtual audio device:
  - **BlackHole** (free): https://github.com/ExistentialAudio/BlackHole
  - **Soundflower** (free): https://github.com/mattingalls/Soundflower

#### Linux
- Requires PulseAudio (usually pre-installed)
- Loopback uses PulseAudio monitor sources
- Works great on modern Linux distributions

## Usage

### Microphone Capture

```bash
python soundcard_mic.py
```

**Output:**
```
Available Microphones:
============================================================

[0] Microphone (Realtek Audio)
    Channels: 2
    ID: {0.0.1.00000000}.{xxx}

[1] Microphone Array (Intel SST)
    Channels: 2
    ID: {0.0.1.00000000}.{yyy}

============================================================
Default Microphone: Microphone (Realtek Audio)
============================================================

Enter microphone number (press Enter for default [0]):

Capturing from: Microphone (Realtek Audio)
Sample Rate: 48000 Hz, Channels: 2
Block Size: 1024 frames (~21.3ms)

============================================================
Recording started... (Press Ctrl+C to stop)
============================================================
Speak into the microphone to see levels!
============================================================

🎤 AUDIO | [████████----------] RMS:  0.1234 | Peak: 0.3456 | dB: -18.17
```

### System Audio Loopback

```bash
python soundcard_loopback.py
```

**Output:**
```
System Audio Loopback Capture (SoundCard)
============================================================
This program captures system audio (music, videos, etc.)
while still allowing it to play through your speakers.
============================================================

Available Loopback Devices (System Audio Outputs):
============================================================

[0] Speakers (Realtek Audio) (Loopback)
    Channels: 2
    ID: {0.0.0.00000000}.{xxx}
    Loopback: Yes

============================================================
Default Speaker: Speakers (Realtek Audio)
(Audio playing through this device can be captured)
============================================================

Enter device number (press Enter for default [0]):

Capturing from: Speakers (Realtek Audio) (Loopback)
Sample Rate: 48000 Hz, Channels: 2
Block Size: 1024 frames (~21.3ms)

============================================================
Capturing system audio... (Press Ctrl+C to stop)
============================================================
NOTE: Program is continuously monitoring audio
  - When audio is playing: You'll see volume bars
  - When silent: Volume will show as 0 (still monitoring)
  - You can start/stop audio anytime
============================================================

✓ Loopback stream opened successfully!
Play some audio to see the levels!

🔊 AUDIO | [████████████------] RMS:  0.2567 | Peak: 0.5234 | dB: -11.81
```

## Features

### Low Latency
- Configurable block size (default: 1024 frames ≈ 21ms)
- Direct audio backend access
- Minimal buffering overhead

### Continuous Monitoring
- Program runs continuously
- Captures silence when no audio is playing
- No need to restart when audio starts/stops

### Real-time Display
- Visual volume bars
- RMS (Root Mean Square) values
- Peak levels
- Decibel (dB) measurements
- Audio/Silent status indicator

### Data Format
- Normalized floating-point values (-1.0 to 1.0)
- 0 dBFS (Full Scale) normalization
- Easy integration with audio processing libraries

## Code Example

### Simple Microphone Recording

```python
import soundcard as sc
import numpy as np

# Get default microphone
mic = sc.default_microphone()

# Record 1 second of audio at 48kHz
data = mic.record(samplerate=48000, numframes=48000)

print(f"Recorded {data.shape[0]} frames with {data.shape[1]} channels")
print(f"Peak level: {np.max(np.abs(data)):.4f}")
```

### Simple Loopback Recording

```python
import soundcard as sc

# Get all loopback devices
loopbacks = sc.all_microphones(include_loopback=True)
loopback = [d for d in loopbacks if d.isloopback][0]

# Record system audio continuously
with loopback.recorder(samplerate=48000, blocksize=1024) as recorder:
    for i in range(100):  # Record 100 blocks
        data = recorder.record(numframes=1024)
        print(f"Block {i}: Peak = {np.max(np.abs(data)):.4f}")
```

### Save to WAV File

```python
import soundcard as sc
import numpy as np
from scipy.io import wavfile

mic = sc.default_microphone()

# Record 5 seconds
samplerate = 48000
duration = 5
data = mic.record(samplerate=samplerate, numframes=samplerate * duration)

# Convert to 16-bit PCM
data_int16 = (data * 32767).astype(np.int16)

# Save to file
wavfile.write('recording.wav', samplerate, data_int16)
print("Saved recording.wav")
```

## Comparison with PyAudio Programs

| Program | Backend | Loopback Support | Installation Difficulty |
|---------|---------|------------------|------------------------|
| `mic_test.py` | PyAudio | No | Medium (needs binary) |
| `loopback_capture.py` | PyAudioWPatch | Windows only | Hard (Windows-specific) |
| `soundcard_mic.py` | SoundCard | No | **Easy** |
| `soundcard_loopback.py` | SoundCard | **All platforms** | **Easy** |

## Troubleshooting

### No loopback devices found (Windows)

This should work automatically. If not:
1. Update Windows
2. Check Windows Audio service is running
3. Try the old PyAudio version as fallback

### No loopback devices found (macOS)

Install a virtual audio device:
```bash
# Install BlackHole with Homebrew
brew install blackhole-2ch

# Or download from:
# https://github.com/ExistentialAudio/BlackHole/releases
```

Then set BlackHole as your system output in System Preferences → Sound.

### No loopback devices found (Linux)

Ensure PulseAudio is running:
```bash
# Check if PulseAudio is running
pulseaudio --check
echo $?  # Should return 0

# List PulseAudio sources (should show monitor sources)
pactl list sources | grep -i monitor

# If not running, start it
pulseaudio --start
```

### Permission denied (macOS)

Grant microphone permission:
1. System Preferences → Security & Privacy → Privacy
2. Select "Microphone"
3. Enable access for Terminal or your Python IDE

### ImportError: soundcard not found

Install the library:
```bash
pip install soundcard
```

### Audio sounds choppy or stuttering

Try increasing the block size:
```python
# Instead of blocksize=1024
capture.start_capture(device, blocksize=2048)  # Lower latency requirements
```

## Performance Tips

### For Minimum Latency
- Use smaller block sizes (512-1024 frames)
- Record/play at native device sample rate
- Use exclusive mode if available (platform-dependent)

### For Stability
- Use larger block sizes (2048-4096 frames)
- Match sample rates between recording and playback
- Close other audio applications

### For Multi-channel Audio
```python
# Access individual channels
with mic.recorder(samplerate=48000) as recorder:
    data = recorder.record(numframes=1024)
    left_channel = data[:, 0]   # First channel
    right_channel = data[:, 1]  # Second channel
```

## Advanced: Channel Mapping

SoundCard supports flexible channel mapping:

```python
import soundcard as sc

speaker = sc.default_speaker()

# Create stereo audio (left and right different)
samplerate = 48000
duration = 1
t = np.linspace(0, duration, samplerate * duration)

# Left channel: 440 Hz, Right channel: 880 Hz
left = np.sin(2 * np.pi * 440 * t)
right = np.sin(2 * np.pi * 880 * t)
stereo = np.column_stack([left, right])

# Play with explicit channel mapping
speaker.play(stereo, samplerate=samplerate, channels=[0, 1])
```

## License

These programs use SoundCard library, which is licensed under BSD 3-Clause License.

## Credits

- **SoundCard Library**: https://github.com/bastibe/SoundCard
- **Author**: Bastian Bechtold
- **License**: BSD-3-Clause
