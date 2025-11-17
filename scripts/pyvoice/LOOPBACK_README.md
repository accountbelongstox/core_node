# System Audio Loopback Capture

Capture system audio (music, videos, etc.) while still allowing it to play through speakers.

## What is Loopback Recording?

Loopback recording lets you capture the audio that your computer is currently playing - like music from Spotify, sound from YouTube videos, game audio, etc. The audio continues to play normally through your speakers/headphones while being captured by the program.

## Installation

### Install Required Packages

```bash
pip install pyaudiowpatch numpy
```

**Important**: Use `pyaudiowpatch` instead of regular `pyaudio`. This is an enhanced version that supports Windows WASAPI Loopback.

### Windows-specific

On Windows, you may need to install it with:

```bash
pip install pyaudiowpatch --upgrade
```

## Usage

### Basic Usage

```bash
python loopback_capture.py
```

The program will:
1. List all available audio output devices (speakers, headphones, etc.)
2. Let you select which device to capture from
3. Start capturing audio while it continues playing
4. Display real-time volume levels
5. Press `Ctrl+C` to stop

### Example Output

```
Available Loopback Devices (System Audio Outputs):
============================================================

Device ID: 12
  Name: Speakers (Realtek Audio)
  Channels: 2
  Sample Rate: 48000 Hz

Device ID: 15
  Name: Headphones (USB Audio)
  Channels: 2
  Sample Rate: 44100 Hz

============================================================

Default Output Device: ID 12 - Speakers (Realtek Audio)

Enter device ID (press Enter to use device 12):

Capturing audio from: Speakers (Realtek Audio)
Sample Rate: 48000 Hz, Channels: 2, Format: 16-bit

============================================================
Capturing system audio... (Press Ctrl+C to stop)
Play some audio to see the levels!
============================================================
Volume: [██████████--------] RMS:  5234 | Peak: 12456 | dB: -15.23
```

## How It Works

### WASAPI Loopback Mode

On Windows, the program uses WASAPI (Windows Audio Session API) Loopback mode:
- Captures audio being sent to an output device
- Does NOT interfere with audio playback
- Zero latency between playback and capture
- Bit-perfect capture of the audio stream

### Example Use Cases

1. **Monitor System Audio Levels**
   - See real-time volume of what's playing
   - Useful for streaming setups

2. **Record System Audio**
   - Capture game audio
   - Record online meetings
   - Save streaming music/videos

3. **Audio Analysis**
   - Analyze frequency content of playing audio
   - Monitor audio quality
   - Detect audio patterns

## Comparison: Loopback vs Microphone

| Feature | `mic_test.py` (Microphone) | `loopback_capture.py` (Loopback) |
|---------|---------------------------|----------------------------------|
| Captures | External sounds (voice, room audio) | Computer audio (music, videos) |
| Source | Microphone input | System output (speakers) |
| Quality | Depends on mic & environment | Bit-perfect digital audio |
| Use Case | Voice recording, speech recognition | System audio capture, streaming |

## Troubleshooting

### "pyaudiowpatch not found"

Install the correct package:
```bash
pip uninstall pyaudio
pip install pyaudiowpatch
```

### "No loopback devices found"

**Option 1: Use pyaudiowpatch** (Recommended)
```bash
pip install pyaudiowpatch --upgrade
```

**Option 2: Enable Stereo Mix** (if your sound card supports it)
1. Right-click speaker icon in system tray
2. Select "Sound settings"
3. Click "Sound Control Panel" or "More sound settings"
4. Go to "Recording" tab
5. Right-click empty space → "Show Disabled Devices"
6. Enable "Stereo Mix" if available

**Option 3: Use Virtual Audio Cable**
Install a virtual audio cable software:
- VB-Audio Virtual Cable (free)
- VoiceMeeter (free)
- Virtual Audio Cable (paid)

### "Error opening loopback stream"

1. **Make sure audio is playing**
   - The device must be active
   - Play some music or video

2. **Check device permissions**
   - Ensure app has microphone access
   - Windows Settings → Privacy → Microphone

3. **Try different device**
   - Some devices don't support loopback
   - Try your default speakers/headphones

### Audio is silent/no volume showing

1. **Play some audio**
   - Open YouTube, Spotify, or any media player
   - The program captures what's playing through the selected device

2. **Check selected device**
   - Make sure you selected the device that's currently playing audio
   - If audio plays through headphones, select headphones device

## Technical Details

- **Sample Format**: 16-bit PCM
- **Channels**: Stereo (2 channels) or Mono
- **Sample Rate**: Device native sample rate (usually 44100 or 48000 Hz)
- **Buffer Size**: 1024 frames
- **API**: Windows WASAPI Loopback
- **Latency**: Near-zero (digital capture)

## Platform Support

| Platform | Support | Method |
|----------|---------|--------|
| Windows 7+ | ✅ Full | WASAPI Loopback via pyaudiowpatch |
| macOS | ⚠️ Limited | Requires virtual audio device (BlackHole, Soundflower) |
| Linux | ⚠️ Limited | Requires PulseAudio monitor or virtual device |

**Note**: This program works best on Windows. For macOS/Linux, you'll need to install additional virtual audio routing software.

## Advanced: Saving Audio to File

To extend this program to save captured audio to a WAV file, you can use the `wave` module:

```python
import wave

# In the capture loop, append data to a list
audio_frames = []
audio_frames.append(data)

# After stopping, save to file
with wave.open('output.wav', 'wb') as wf:
    wf.setnchannels(CHANNELS)
    wf.setsampwidth(audio.get_sample_size(FORMAT))
    wf.setframerate(RATE)
    wf.writeframes(b''.join(audio_frames))
```

## License

This program uses pyaudiowpatch, which is licensed under the MIT License.
