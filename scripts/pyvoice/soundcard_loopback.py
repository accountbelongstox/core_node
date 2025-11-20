#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Audio Loopback Capture using SoundCard
Captures system audio (music, videos, games) while still allowing playback
"""

import sys
import numpy as np
import time

try:
    import soundcard as sc
except ImportError:
    print("Error: soundcard library is required")
    print("Install it with: pip install soundcard")
    sys.exit(1)


class LoopbackCapture:
    """System audio loopback capture using SoundCard"""

    def __init__(self):
        self.recorder = None
        self.running = False

    def list_loopback_devices(self):
        """List all available loopback devices (speakers/outputs)"""
        print("\n" + "="*60)
        print("Available Loopback Devices (System Audio Outputs):")
        print("="*60)

        try:
            # Get all microphones including loopback
            all_devices = sc.all_microphones(include_loopback=True)

            # Filter only loopback devices
            loopback_devices = [d for d in all_devices if d.isloopback]

            if not loopback_devices:
                print("\nNo loopback devices found!")
                print("\nNote: Loopback support varies by platform:")
                print("  - Windows: Fully supported via WASAPI")
                print("  - macOS: Requires virtual audio device (BlackHole, Soundflower)")
                print("  - Linux: Supported via PulseAudio monitor sources")

                # Show regular speakers as alternative
                print("\n" + "="*60)
                print("Available Speakers (may support loopback on some systems):")
                print("="*60)

                speakers = sc.all_speakers()
                for idx, speaker in enumerate(speakers):
                    print(f"\n[{idx}] {speaker.name}")
                    print(f"    Channels: {speaker.channels}")
                    print(f"    ID: {speaker.id}")

                return loopback_devices

            for idx, device in enumerate(loopback_devices):
                print(f"\n[{idx}] {device.name}")
                print(f"    Channels: {device.channels}")
                print(f"    ID: {device.id}")
                print(f"    Loopback: Yes")

            # Show default speaker
            try:
                default_speaker = sc.default_speaker()
                print(f"\n{'='*60}")
                print(f"Default Speaker: {default_speaker.name}")
                print("(Audio playing through this device can be captured)")
                print("="*60)
            except:
                print(f"\n{'='*60}")
                print("No default speaker found")
                print("="*60)

            return loopback_devices

        except Exception as e:
            print(f"Error listing loopback devices: {e}")
            import traceback
            traceback.print_exc()
            return []

    def select_device(self, devices):
        """Select loopback device"""
        if not devices:
            print("\nError: No loopback devices available!")
            print("\nPossible solutions:")
            print("  1. On macOS: Install BlackHole or Soundflower")
            print("  2. On Linux: Use PulseAudio monitor sources")
            print("  3. On Windows: Should work out of the box")
            return None

        default_index = 0

        # Let user choose
        while True:
            choice = input(f"\nEnter device number (press Enter for default [{default_index}]): ").strip()

            if choice == "":
                return devices[default_index]

            try:
                device_index = int(choice)
                if 0 <= device_index < len(devices):
                    return devices[device_index]
                else:
                    print(f"Error: Please enter a number between 0 and {len(devices)-1}")
            except ValueError:
                print("Error: Please enter a valid number.")

    def start_capture(self, device, samplerate=48000, blocksize=1024):
        """Start capturing system audio"""
        try:
            print(f"\nCapturing from: {device.name}")
            print(f"Sample Rate: {samplerate} Hz, Channels: {device.channels}")
            print(f"Block Size: {blocksize} frames (~{blocksize/samplerate*1000:.1f}ms)")

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

            # Start recording with blocksize for lower latency
            with device.recorder(samplerate=samplerate, blocksize=blocksize) as recorder:
                print("\n✓ Loopback stream opened successfully!")
                print("Play some audio to see the levels!\n")

                while self.running:
                    try:
                        # Record one block of audio
                        data = recorder.record(numframes=blocksize)

                        # Convert to mono if stereo
                        if len(data.shape) > 1:
                            audio_data = np.mean(data, axis=1)
                        else:
                            audio_data = data

                        # Calculate volume (RMS)
                        volume_rms = np.sqrt(np.mean(audio_data**2))

                        # Calculate peak
                        peak = np.max(np.abs(audio_data))

                        # Convert to decibels
                        if volume_rms > 1e-10:
                            db = 20 * np.log10(volume_rms)
                        else:
                            db = -100

                        # Create volume bar
                        bar_length = 50
                        filled_length = int(bar_length * min(peak, 1.0))
                        bar = '█' * filled_length + '-' * (bar_length - filled_length)

                        # Display real-time info
                        frame_count += 1
                        if frame_count % 5 == 0:
                            status = "🔊 AUDIO" if peak > 0.01 else "🔇 SILENT"
                            print(f"\r{status} | [{bar}] RMS: {volume_rms:7.4f} | Peak: {peak:6.4f} | dB: {db:6.2f}", end='', flush=True)

                    except KeyboardInterrupt:
                        print("\n\nStopping capture...")
                        self.running = False
                        break
                    except Exception as e:
                        print(f"\nError reading audio: {e}")
                        self.running = False
                        break

        except Exception as e:
            print(f"\nError opening loopback stream: {e}")
            print("\nTroubleshooting:")
            print("  1. Make sure audio is playing (some devices need active audio)")
            print("  2. Try a different loopback device")
            print("  3. Check platform-specific requirements:")
            print("     - macOS: Install BlackHole or Soundflower")
            print("     - Linux: Ensure PulseAudio is running")
            print("     - Windows: Should work automatically")
            return False

        return True

    def cleanup(self):
        """Cleanup resources"""
        print("\nResources cleaned up.")


def main():
    """Main function"""
    print("\nSystem Audio Loopback Capture (SoundCard)")
    print("="*60)
    print("This program captures system audio (music, videos, etc.)")
    print("while still allowing it to play through your speakers.")
    print("="*60)

    capture = LoopbackCapture()

    try:
        # List all loopback devices
        loopback_devices = capture.list_loopback_devices()

        if not loopback_devices:
            print("\nNo loopback devices found!")
            sys.exit(1)

        # Select device
        selected_device = capture.select_device(loopback_devices)

        if selected_device is None:
            print("\nNo device selected, exiting.")
            sys.exit(1)

        # Start capturing
        capture.start_capture(selected_device, samplerate=48000, blocksize=1024)

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
