#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Audio Loopback Capture Program
Capture system audio that is currently playing (music, videos, etc.)
while still allowing it to play through speakers
"""

import sys
import numpy as np

try:
    import pyaudiowpatch as pyaudio
except ImportError:
    print("Error: pyaudiowpatch is required for loopback recording")
    print("Install it with: pip install pyaudiowpatch")
    print("\nNote: pyaudiowpatch is an enhanced version of PyAudio")
    print("      that supports WASAPI Loopback on Windows")
    sys.exit(1)


class LoopbackCapture:
    """System audio loopback capture class"""

    def __init__(self):
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.running = False

    def list_loopback_devices(self):
        """List all available loopback devices (output devices that can be captured)"""
        print("\n" + "="*60)
        print("Available Loopback Devices (System Audio Outputs):")
        print("="*60)

        try:
            # Get default WASAPI info
            wasapi_info = self.audio.get_host_api_info_by_type(pyaudio.paWASAPI)
        except OSError:
            print("Error: WASAPI not available on this system")
            print("Loopback recording requires Windows with WASAPI support")
            return []

        loopback_devices = []

        # Iterate through all devices
        for i in range(self.audio.get_device_count()):
            device_info = self.audio.get_device_info_by_index(i)

            # Check if device is WASAPI and has output channels
            if device_info['hostApi'] == wasapi_info['index'] and device_info['maxOutputChannels'] > 0:
                # Check if loopback is supported
                try:
                    if device_info['isLoopbackDevice']:
                        loopback_devices.append(i)
                        print(f"\nDevice ID: {i}")
                        print(f"  Name: {device_info['name']}")
                        print(f"  Channels: {device_info['maxOutputChannels']}")
                        print(f"  Sample Rate: {int(device_info['defaultSampleRate'])} Hz")
                except KeyError:
                    pass

        if not loopback_devices:
            print("\nNo loopback devices found!")
            print("\nTrying alternative method - listing output devices...")
            print("These devices can be captured while playing audio:")
            print("="*60)

            for i in range(self.audio.get_device_count()):
                device_info = self.audio.get_device_info_by_index(i)

                if device_info['hostApi'] == wasapi_info['index'] and device_info['maxOutputChannels'] > 0:
                    loopback_devices.append(i)
                    print(f"\nDevice ID: {i}")
                    print(f"  Name: {device_info['name']}")
                    print(f"  Channels: {device_info['maxOutputChannels']}")
                    print(f"  Sample Rate: {int(device_info['defaultSampleRate'])} Hz")

        print("\n" + "="*60)
        return loopback_devices

    def get_default_loopback_device(self):
        """Get default loopback device"""
        try:
            # Get default WASAPI output device
            wasapi_info = self.audio.get_host_api_info_by_type(pyaudio.paWASAPI)
            default_device = self.audio.get_default_output_device_info()

            # Try to get loopback version of default device
            if default_device['hostApi'] == wasapi_info['index']:
                print(f"\nDefault Output Device: ID {default_device['index']} - {default_device['name']}")
                return default_device['index']
        except:
            pass

        return None

    def select_device(self, loopback_devices):
        """Select loopback device"""
        if not loopback_devices:
            print("Error: No loopback devices available!")
            return None

        default_index = self.get_default_loopback_device()
        if default_index and default_index in loopback_devices:
            default_choice = default_index
        else:
            default_choice = loopback_devices[0]

        # Let user choose
        while True:
            choice = input(f"\nEnter device ID (press Enter to use device {default_choice}): ").strip()

            if choice == "":
                return default_choice

            try:
                device_id = int(choice)
                if device_id in loopback_devices:
                    return device_id
                else:
                    print(f"Error: Device ID {device_id} is not a valid loopback device. Please choose again.")
            except ValueError:
                print("Error: Please enter a valid number.")

    def start_capture(self, device_id):
        """Start capturing system audio"""
        try:
            device_info = self.audio.get_device_info_by_index(device_id)

            # Audio parameters
            CHUNK = 1024
            FORMAT = pyaudio.paInt16
            CHANNELS = device_info['maxOutputChannels']
            if CHANNELS > 2:
                CHANNELS = 2  # Use stereo for most cases
            RATE = int(device_info['defaultSampleRate'])

            print(f"\nCapturing audio from: {device_info['name']}")
            print(f"Sample Rate: {RATE} Hz, Channels: {CHANNELS}, Format: 16-bit")

            # Try to open loopback stream with retry
            max_retries = 3
            retry_count = 0

            while retry_count < max_retries:
                try:
                    print(f"\nAttempting to open loopback stream... (Attempt {retry_count + 1}/{max_retries})")

                    self.stream = self.audio.open(
                        format=FORMAT,
                        channels=CHANNELS,
                        rate=RATE,
                        input=True,
                        input_device_index=device_id,
                        frames_per_buffer=CHUNK,
                    )

                    print("✓ Loopback stream opened successfully!")
                    break  # Success!

                except Exception as e:
                    retry_count += 1
                    print(f"\n✗ Failed to open loopback stream: {e}")

                    if retry_count < max_retries:
                        print("\n" + "="*60)
                        print("IMPORTANT: Please start playing some audio now!")
                        print("="*60)
                        print("Examples:")
                        print("  - Open YouTube and play a video")
                        print("  - Play music in Spotify/iTunes/etc.")
                        print("  - Play any audio/video file")
                        print("\nSome devices need to be actively playing audio to open.")
                        print("The program will monitor continuously once opened.")
                        print("="*60)

                        retry_input = input(f"\nAudio playing? Press Enter to retry, or 'q' to quit: ").strip().lower()
                        if retry_input == 'q':
                            print("\nUser cancelled.")
                            return False
                    else:
                        print("\n" + "="*60)
                        print("Failed to open loopback stream after multiple attempts.")
                        print("\nPossible solutions:")
                        print("  1. Make sure pyaudiowpatch is installed:")
                        print("     pip uninstall pyaudio")
                        print("     pip install pyaudiowpatch")
                        print("  2. Try a different output device")
                        print("  3. Use Windows 'Stereo Mix' if available")
                        print("  4. Install VB-Audio Virtual Cable or VoiceMeeter")
                        print("="*60)
                        return False

            if retry_count >= max_retries:
                return False

            print("\n" + "="*60)
            print("Capturing system audio... (Press Ctrl+C to stop)")
            print("="*60)
            print("NOTE: Program is continuously monitoring audio")
            print("  - When audio is playing: You'll see volume bars")
            print("  - When silent: Volume will show as 0 (still monitoring)")
            print("  - You can start/stop audio anytime")
            print("="*60)

            self.running = True
            frame_count = 0

            while self.running:
                try:
                    # Read audio data
                    data = self.stream.read(CHUNK, exception_on_overflow=False)

                    # Convert to numpy array
                    audio_data = np.frombuffer(data, dtype=np.int16)

                    # Calculate volume (RMS)
                    volume_rms = np.sqrt(np.mean(audio_data**2))

                    # Calculate peak
                    peak = np.max(np.abs(audio_data))

                    # Convert to decibels
                    if volume_rms > 0:
                        db = 20 * np.log10(volume_rms / 32768.0)
                    else:
                        db = -100

                    # Create volume bar
                    bar_length = 50
                    filled_length = int(bar_length * peak / 32768.0)
                    bar = '█' * filled_length + '-' * (bar_length - filled_length)

                    # Display real-time info
                    frame_count += 1
                    if frame_count % 5 == 0:  # Update every 5 frames for more responsive display
                        status = "🔊 AUDIO" if peak > 100 else "🔇 SILENT"
                        print(f"\r{status} | [{bar}] RMS: {int(volume_rms):5d} | Peak: {int(peak):5d} | dB: {db:6.2f}", end='', flush=True)

                except KeyboardInterrupt:
                    print("\n\nStopping capture...")
                    self.running = False
                    break
                except Exception as e:
                    print(f"\nError reading audio stream: {e}")
                    self.running = False
                    break

        except Exception as e:
            print(f"Error: {e}")
            return False

        return True

    def cleanup(self):
        """Cleanup resources"""
        if self.stream is not None:
            self.stream.stop_stream()
            self.stream.close()
        self.audio.terminate()
        print("\nResources cleaned up.")


def main():
    """Main function"""
    print("\nSystem Audio Loopback Capture Program")
    print("=====================================")
    print("This program captures system audio (music, videos, etc.)")
    print("while still allowing it to play through your speakers.")

    capture = LoopbackCapture()

    try:
        # List all loopback devices
        loopback_devices = capture.list_loopback_devices()

        if not loopback_devices:
            print("\nNo loopback devices found!")
            print("\nPossible solutions:")
            print("  1. Install pyaudiowpatch: pip install pyaudiowpatch")
            print("  2. Use a virtual audio cable (VB-Cable, VoiceMeeter, etc.)")
            print("  3. Enable 'Stereo Mix' in Windows sound settings (if available)")
            sys.exit(1)

        # Select device
        device_id = capture.select_device(loopback_devices)

        if device_id is None:
            print("\nNo device selected, exiting.")
            sys.exit(1)

        # Start capturing
        capture.start_capture(device_id)

    except KeyboardInterrupt:
        print("\n\nProgram interrupted by user.")
    except Exception as e:
        print(f"\nError occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup resources
        capture.cleanup()


if __name__ == "__main__":
    main()
