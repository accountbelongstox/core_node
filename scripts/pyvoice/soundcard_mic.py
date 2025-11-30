#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Microphone Audio Capture using SoundCard
A simpler, cross-platform alternative using the SoundCard library
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


class MicrophoneCapture:
    """Microphone audio capture using SoundCard"""

    def __init__(self):
        self.recorder = None
        self.running = False

    def list_microphones(self):
        """List all available microphones"""
        print("\n" + "="*60)
        print("Available Microphones:")
        print("="*60)

        try:
            mics = sc.all_microphones(include_loopback=False)

            if not mics:
                print("\nNo microphones found!")
                return []

            for idx, mic in enumerate(mics):
                print(f"\n[{idx}] {mic.name}")
                print(f"    Channels: {mic.channels}")
                print(f"    ID: {mic.id}")

            # Show default microphone
            try:
                default_mic = sc.default_microphone()
                print(f"\n{'='*60}")
                print(f"Default Microphone: {default_mic.name}")
                print("="*60)
            except:
                print(f"\n{'='*60}")
                print("No default microphone found")
                print("="*60)

            return mics

        except Exception as e:
            print(f"Error listing microphones: {e}")
            return []

    def select_microphone(self, mics):
        """Select microphone"""
        if not mics:
            print("Error: No microphones available!")
            return None

        # Get default microphone
        try:
            default_mic = sc.default_microphone()
            default_index = next((i for i, m in enumerate(mics) if m.id == default_mic.id), 0)
        except:
            default_index = 0

        # Let user choose
        while True:
            choice = input(f"\nEnter microphone number (press Enter for default [{default_index}]): ").strip()

            if choice == "":
                return mics[default_index]

            try:
                mic_index = int(choice)
                if 0 <= mic_index < len(mics):
                    return mics[mic_index]
                else:
                    print(f"Error: Please enter a number between 0 and {len(mics)-1}")
            except ValueError:
                print("Error: Please enter a valid number.")

    def start_capture(self, microphone, samplerate=48000, blocksize=1024):
        """Start capturing microphone audio"""
        try:
            print(f"\nCapturing from: {microphone.name}")
            print(f"Sample Rate: {samplerate} Hz, Channels: {microphone.channels}")
            print(f"Block Size: {blocksize} frames (~{blocksize/samplerate*1000:.1f}ms)")

            print("\n" + "="*60)
            print("Recording started... (Press Ctrl+C to stop)")
            print("="*60)
            print("Speak into the microphone to see levels!")
            print("="*60)

            self.running = True
            frame_count = 0

            # Start recording with blocksize for lower latency
            with microphone.recorder(samplerate=samplerate, blocksize=blocksize) as recorder:
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
                            status = "🎤 AUDIO" if peak > 0.01 else "🔇 SILENT"
                            print(f"\r{status} | [{bar}] RMS: {volume_rms:7.4f} | Peak: {peak:6.4f} | dB: {db:6.2f}", end='', flush=True)

                    except KeyboardInterrupt:
                        print("\n\nStopping recording...")
                        self.running = False
                        break
                    except Exception as e:
                        print(f"\nError reading audio: {e}")
                        self.running = False
                        break

        except Exception as e:
            print(f"Error opening microphone: {e}")
            print("\nTroubleshooting:")
            print("  1. Check microphone permissions")
            print("  2. Try a different microphone")
            print("  3. Make sure the microphone is not in use")
            return False

        return True

    def cleanup(self):
        """Cleanup resources"""
        print("\nResources cleaned up.")


def main():
    """Main function"""
    print("\nMicrophone Audio Capture (SoundCard)")
    print("="*60)

    capture = MicrophoneCapture()

    try:
        # List all microphones
        mics = capture.list_microphones()

        if not mics:
            print("\nNo microphones found!")
            sys.exit(1)

        # Select microphone
        selected_mic = capture.select_microphone(mics)

        if selected_mic is None:
            print("\nNo microphone selected, exiting.")
            sys.exit(1)

        # Start capturing
        capture.start_capture(selected_mic, samplerate=48000, blocksize=1024)

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
