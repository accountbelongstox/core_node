#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频录制程序 - 录制系统声音或麦克风并保存为文件
Audio Recorder - Record system audio or microphone and save to file
"""

import sys
import numpy as np
import wave
import time
from datetime import datetime

try:
    import soundcard as sc
except ImportError:
    print("错误: 需要安装 soundcard 库")
    print("Error: soundcard library is required")
    print("安装命令 / Install with: pip install soundcard")
    sys.exit(1)


class AudioRecorder:
    """音频录制器"""

    def __init__(self):
        self.data_chunks = []
        self.running = False

    def list_devices(self):
        """列出所有可用的音频设备"""
        print("\n" + "="*70)
        print("可用的录制设备 / Available Recording Devices:")
        print("="*70)

        devices = []

        # 1. 系统音频回环设备 (Loopback)
        print("\n【系统音频/System Audio Loopback】")
        print("-" * 70)
        loopback_devices = sc.all_microphones(include_loopback=True)
        loopback_devices = [d for d in loopback_devices if d.isloopback]

        if loopback_devices:
            for idx, device in enumerate(loopback_devices):
                devices.append(('loopback', device))
                print(f"  [{len(devices)-1}] {device.name}")
                print(f"      声道/Channels: {device.channels} | ID: {device.id}")
        else:
            print("  未找到系统音频设备 / No loopback devices found")

        # 2. 麦克风设备
        print("\n【麦克风/Microphones】")
        print("-" * 70)
        microphones = sc.all_microphones(include_loopback=False)

        if microphones:
            for idx, device in enumerate(microphones):
                devices.append(('microphone', device))
                print(f"  [{len(devices)-1}] {device.name}")
                print(f"      声道/Channels: {device.channels} | ID: {device.id}")
        else:
            print("  未找到麦克风设备 / No microphone devices found")

        print("\n" + "="*70)

        return devices

    def select_device(self, devices):
        """选择录制设备"""
        if not devices:
            print("\n错误: 没有可用的录制设备!")
            print("Error: No recording devices available!")
            return None

        while True:
            choice = input(f"\n请输入设备编号 (0-{len(devices)-1}) / Enter device number: ").strip()

            try:
                device_index = int(choice)
                if 0 <= device_index < len(devices):
                    return devices[device_index]
                else:
                    print(f"错误: 请输入 0 到 {len(devices)-1} 之间的数字")
            except ValueError:
                print("错误: 请输入有效的数字 / Error: Please enter a valid number")

    def record_audio(self, device_info, duration, samplerate=44100, output_file=None):
        """
        录制音频

        Args:
            device_info: (device_type, device) 元组
            duration: 录制时长（秒）
            samplerate: 采样率
            output_file: 输出文件名，如果为None则自动生成
        """
        device_type, device = device_info

        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"recording_{timestamp}.wav"

        print("\n" + "="*70)
        print(f"录制设备 / Recording from: {device.name}")
        print(f"设备类型 / Type: {'系统音频/System Audio' if device_type == 'loopback' else '麦克风/Microphone'}")
        print(f"采样率 / Sample Rate: {samplerate} Hz")
        print(f"声道数 / Channels: {device.channels}")
        print(f"录制时长 / Duration: {duration} 秒/seconds")
        print(f"输出文件 / Output file: {output_file}")
        print("="*70)

        if device_type == 'loopback':
            print("\n提示: 请播放音频以进行录制")
            print("Tip: Please play some audio to record")

        print("\n录制将在 3 秒后开始... / Recording will start in 3 seconds...")
        for i in range(3, 0, -1):
            print(f"{i}...", flush=True)
            time.sleep(1)

        print("\n🔴 录制中... / RECORDING... (请不要关闭程序 / Don't close the program)")
        print("-" * 70)

        try:
            self.data_chunks = []
            self.running = True

            # 计算需要录制的总帧数
            total_frames = int(samplerate * duration)
            blocksize = 1024
            blocks_needed = int(np.ceil(total_frames / blocksize))

            # 开始录制
            with device.recorder(samplerate=samplerate, blocksize=blocksize) as recorder:
                start_time = time.time()

                for block_num in range(blocks_needed):
                    if not self.running:
                        break

                    # 录制一个块
                    data = recorder.record(numframes=blocksize)
                    self.data_chunks.append(data)

                    # 显示进度
                    elapsed = time.time() - start_time
                    progress = min(elapsed / duration * 100, 100)
                    remaining = max(duration - elapsed, 0)

                    # 计算音量（用于显示）
                    if len(data.shape) > 1:
                        audio_mono = np.mean(data, axis=1)
                    else:
                        audio_mono = data

                    volume_rms = np.sqrt(np.mean(audio_mono**2))
                    peak = np.max(np.abs(audio_mono))

                    # 音量条
                    bar_length = 30
                    filled_length = int(bar_length * min(peak, 1.0))
                    bar = '█' * filled_length + '-' * (bar_length - filled_length)

                    print(f"\r进度/Progress: {progress:5.1f}% [{bar}] "
                          f"音量/Volume: {volume_rms:6.3f} | "
                          f"剩余/Remaining: {remaining:4.1f}s", end='', flush=True)

                    # 检查是否录制完成
                    if elapsed >= duration:
                        break

            print("\n\n✓ 录制完成! / Recording completed!")

            # 保存音频文件
            self._save_audio(output_file, samplerate, device.channels)

            return True

        except KeyboardInterrupt:
            print("\n\n⚠ 录制被用户中断 / Recording interrupted by user")
            if self.data_chunks:
                save = input("\n是否保存已录制的音频? (y/n) / Save recorded audio? (y/n): ").strip().lower()
                if save == 'y':
                    self._save_audio(output_file, samplerate, device.channels)
                    return True
            return False

        except Exception as e:
            print(f"\n\n✗ 录制错误 / Recording error: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _save_audio(self, output_file, samplerate, channels):
        """保存音频数据到 WAV 文件"""
        print(f"\n正在保存音频文件... / Saving audio file...")

        try:
            # 合并所有音频块
            if not self.data_chunks:
                print("✗ 没有录制到音频数据 / No audio data recorded")
                return

            audio_data = np.concatenate(self.data_chunks, axis=0)

            # 转换为 16-bit PCM
            audio_data = np.clip(audio_data, -1.0, 1.0)  # 限制范围
            audio_data_int16 = (audio_data * 32767).astype(np.int16)

            # 保存为 WAV 文件
            with wave.open(output_file, 'wb') as wf:
                wf.setnchannels(channels)
                wf.setsampwidth(2)  # 16-bit = 2 bytes
                wf.setframerate(samplerate)
                wf.writeframes(audio_data_int16.tobytes())

            # 显示文件信息
            file_size = len(audio_data_int16.tobytes()) / 1024 / 1024  # MB
            duration = len(audio_data) / samplerate

            print(f"\n{'='*70}")
            print(f"✓ 音频已保存 / Audio saved successfully!")
            print(f"{'='*70}")
            print(f"文件名 / File: {output_file}")
            print(f"文件大小 / Size: {file_size:.2f} MB")
            print(f"时长 / Duration: {duration:.2f} 秒/seconds")
            print(f"采样率 / Sample Rate: {samplerate} Hz")
            print(f"声道数 / Channels: {channels}")
            print(f"格式 / Format: 16-bit PCM WAV")
            print(f"{'='*70}")

        except Exception as e:
            print(f"\n✗ 保存文件失败 / Failed to save file: {e}")
            import traceback
            traceback.print_exc()


def main():
    """主函数"""
    print("\n" + "="*70)
    print("音频录制程序 / Audio Recorder")
    print("="*70)
    print("功能: 录制系统音频或麦克风并保存为 WAV 文件")
    print("Function: Record system audio or microphone and save as WAV file")
    print("="*70)

    recorder = AudioRecorder()

    try:
        # 列出所有设备
        devices = recorder.list_devices()

        if not devices:
            print("\n没有找到可用的录制设备!")
            print("No recording devices found!")
            sys.exit(1)

        # 选择设备
        selected_device = recorder.select_device(devices)

        if selected_device is None:
            print("\n未选择设备，退出程序")
            print("No device selected, exiting")
            sys.exit(1)

        # 输入录制参数
        print("\n" + "="*70)
        print("录制设置 / Recording Settings")
        print("="*70)

        # 录制时长
        while True:
            duration_input = input("录制时长(秒) / Duration (seconds) [默认/default: 10]: ").strip()
            if duration_input == "":
                duration = 10
                break
            try:
                duration = float(duration_input)
                if duration > 0:
                    break
                else:
                    print("请输入大于0的数字 / Please enter a number greater than 0")
            except ValueError:
                print("请输入有效的数字 / Please enter a valid number")

        # 采样率
        print("\n采样率选项 / Sample Rate Options:")
        print("  1 - 44100 Hz (CD 质量 / CD Quality)")
        print("  2 - 48000 Hz (专业音频 / Professional Audio)")
        print("  3 - 22050 Hz (语音 / Voice)")

        while True:
            rate_choice = input("选择采样率 / Choose sample rate [默认/default: 1]: ").strip()
            if rate_choice == "" or rate_choice == "1":
                samplerate = 44100
                break
            elif rate_choice == "2":
                samplerate = 48000
                break
            elif rate_choice == "3":
                samplerate = 22050
                break
            else:
                print("请输入 1, 2 或 3 / Please enter 1, 2, or 3")

        # 输出文件名
        output_file = input("\n输出文件名 / Output filename [默认自动生成 / default: auto-generate]: ").strip()
        if output_file == "":
            output_file = None
        elif not output_file.endswith('.wav'):
            output_file += '.wav'

        # 开始录制
        success = recorder.record_audio(
            device_info=selected_device,
            duration=duration,
            samplerate=samplerate,
            output_file=output_file
        )

        if success:
            print("\n录制完成! / Recording completed!")
        else:
            print("\n录制失败或被取消 / Recording failed or cancelled")

    except KeyboardInterrupt:
        print("\n\n程序被用户中断 / Program interrupted by user")
    except Exception as e:
        print(f"\n发生错误 / Error occurred: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
