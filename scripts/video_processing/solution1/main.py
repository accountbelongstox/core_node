#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Solution 1: High Performance Combination
FFmpeg → faster-whisper → edge-tts → FFmpeg

Features:
- Convert video to speech and generate subtitles
- Automatically compress video and audio
- Generate corresponding audio files for each subtitle sentence
- Generate mapping table
"""

import os
import sys
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple
import shutil

# Setup dependencies before importing
sys.path.insert(0, str(Path(__file__).parent.parent))
from common.dependency_manager import setup_solution1_dependencies
setup_solution1_dependencies()

# Now import the required packages (they are guaranteed to be installed)
from faster_whisper import WhisperModel
import edge_tts
import asyncio


class VideoProcessor:
    """Video processing class - Solution 1"""
    
    def __init__(self, input_dir: str, output_base_name: str = "video_output"):
        self.input_dir = Path(input_dir).resolve()
        self.output_base_dir = self.input_dir.parent / output_base_name
        self.output_base_dir.mkdir(exist_ok=True)
        
        # Initialize Whisper model (using base model, can be adjusted as needed)
        self.whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
        
        # Supported video formats
        self.video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v'}
    
    def calculate_md5(self, file_path: Path) -> str:
        """Calculate MD5 hash of a file"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def extract_audio(self, video_path: Path, audio_path: Path) -> bool:
        """Extract audio using FFmpeg"""
        try:
            cmd = [
                'ffmpeg', '-i', str(video_path),
                '-vn', '-acodec', 'libmp3lame', '-ab', '128k',
                '-ar', '44100', '-y', str(audio_path)
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f"Failed to extract audio: {e}")
            return False
    
    def compress_video(self, video_path: Path, output_path: Path) -> bool:
        """Compress video"""
        try:
            cmd = [
                'ffmpeg', '-i', str(video_path),
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                '-c:a', 'aac', '-b:a', '128k',
                '-y', str(output_path)
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f"Failed to compress video: {e}")
            return False
    
    def compress_audio(self, audio_path: Path, output_path: Path) -> bool:
        """Compress audio"""
        try:
            cmd = [
                'ffmpeg', '-i', str(audio_path),
                '-acodec', 'libmp3lame', '-ab', '128k',
                '-ar', '44100', '-y', str(output_path)
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f"Failed to compress audio: {e}")
            return False
    
    def transcribe_audio(self, audio_path: Path) -> List[Dict]:
        """Perform speech recognition using faster-whisper"""
        try:
            segments, info = self.whisper_model.transcribe(
                str(audio_path),
                beam_size=5,
                language="zh"  # Can be adjusted as needed
            )
            
            subtitles = []
            for segment in segments:
                subtitles.append({
                    'start': segment.start,
                    'end': segment.end,
                    'text': segment.text.strip()
                })
            return subtitles
        except Exception as e:
            print(f"Speech recognition failed: {e}")
            return []
    
    async def text_to_speech(self, text: str, output_path: Path, voice: str = "zh-CN-XiaoxiaoNeural"):
        """Convert text to speech using edge-tts"""
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(output_path))
            return True
        except Exception as e:
            print(f"Text-to-speech failed: {e}")
            return False
    
    def save_subtitle(self, subtitles: List[Dict], subtitle_path: Path, format: str = 'srt'):
        """Save subtitle file"""
        if format == 'srt':
            with open(subtitle_path, 'w', encoding='utf-8') as f:
                for i, sub in enumerate(subtitles, 1):
                    start_time = self.format_time(sub['start'])
                    end_time = self.format_time(sub['end'])
                    f.write(f"{i}\n")
                    f.write(f"{start_time} --> {end_time}\n")
                    f.write(f"{sub['text']}\n\n")
        elif format == 'json':
            with open(subtitle_path, 'w', encoding='utf-8') as f:
                json.dump(subtitles, f, ensure_ascii=False, indent=2)
    
    def format_time(self, seconds: float) -> str:
        """Format timestamp to SRT format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    
    async def generate_sentence_audios(self, subtitles: List[Dict], output_dir: Path):
        """Generate corresponding audio files for each subtitle sentence"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        tasks = []
        for i, sub in enumerate(subtitles):
            audio_path = output_dir / f"sentence_{i+1:04d}.mp3"
            tasks.append(self.text_to_speech(sub['text'], audio_path))
        
        await asyncio.gather(*tasks)
        return len(subtitles)
    
    def process_video(self, video_path: Path) -> Dict:
        """Process a single video file"""
        print(f"\nProcessing video: {video_path.name}")
        
        # Calculate MD5
        video_md5 = self.calculate_md5(video_path)
        print(f"Video MD5: {video_md5}")
        
        # Create output directory
        output_dir = self.output_base_dir / video_md5
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Subtitle sentence audio directory
        sentence_audio_dir = output_dir / "sentence_audios"
        sentence_audio_dir.mkdir(exist_ok=True)
        
        mapping = {
            'video_md5': video_md5,
            'original_video': str(video_path),
            'output_dir': str(output_dir),
            'files': {}
        }
        
        # 1. Compress video
        compressed_video_path = output_dir / f"{video_md5}_compressed.mp4"
        print("Compressing video...")
        if self.compress_video(video_path, compressed_video_path):
            mapping['files']['compressed_video'] = str(compressed_video_path)
            print(f"✓ Video compression completed: {compressed_video_path.name}")
        
        # 2. Extract audio
        temp_audio_path = output_dir / f"{video_md5}_temp.wav"
        print("Extracting audio...")
        if not self.extract_audio(video_path, temp_audio_path):
            return mapping
        
        # 3. Compress audio
        audio_md5 = self.calculate_md5(temp_audio_path)
        compressed_audio_path = output_dir / f"{audio_md5}_compressed.mp3"
        print("Compressing audio...")
        if self.compress_audio(temp_audio_path, compressed_audio_path):
            mapping['files']['compressed_audio'] = str(compressed_audio_path)
            mapping['files']['audio_md5'] = audio_md5
            print(f"✓ Audio compression completed: {compressed_audio_path.name}")
        
        # 4. Speech recognition to generate subtitles
        print("Performing speech recognition...")
        subtitles = self.transcribe_audio(temp_audio_path)
        if subtitles:
            subtitle_md5 = hashlib.md5(json.dumps(subtitles, sort_keys=True).encode()).hexdigest()
            subtitle_srt_path = output_dir / f"{subtitle_md5}.srt"
            subtitle_json_path = output_dir / f"{subtitle_md5}.json"
            
            self.save_subtitle(subtitles, subtitle_srt_path, 'srt')
            self.save_subtitle(subtitles, subtitle_json_path, 'json')
            
            mapping['files']['subtitle_srt'] = str(subtitle_srt_path)
            mapping['files']['subtitle_json'] = str(subtitle_json_path)
            mapping['files']['subtitle_md5'] = subtitle_md5
            mapping['subtitle_count'] = len(subtitles)
            print(f"✓ Subtitle generation completed: {len(subtitles)} entries")
            
            # 5. Generate audio for each sentence
            print("Generating sentence audios...")
            asyncio.run(self.generate_sentence_audios(subtitles, sentence_audio_dir))
            mapping['files']['sentence_audio_dir'] = str(sentence_audio_dir)
            print(f"✓ Sentence audio generation completed")
        
        # Clean up temporary files
        if temp_audio_path.exists():
            temp_audio_path.unlink()
        
        return mapping
    
    def process_directory(self):
        """Process all video files in the directory"""
        video_files = [
            f for f in self.input_dir.iterdir()
            if f.is_file() and f.suffix.lower() in self.video_extensions
        ]
        
        if not video_files:
            print(f"No video files found in {self.input_dir}")
            return
        
        print(f"Found {len(video_files)} video files")
        
        all_mappings = []
        for video_file in video_files:
            try:
                mapping = self.process_video(video_file)
                all_mappings.append(mapping)
            except Exception as e:
                print(f"Error processing {video_file.name}: {e}")
                continue
        
        # Save mapping table
        mapping_file = self.output_base_dir / "mapping.json"
        with open(mapping_file, 'w', encoding='utf-8') as f:
            json.dump(all_mappings, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ All processing completed! Mapping table saved: {mapping_file}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python main.py <input_directory> [output_directory_name]")
        print("Example: python main.py /path/to/videos video_output")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_name = sys.argv[2] if len(sys.argv) > 2 else "video_output"
    
    if not os.path.isdir(input_dir):
        print(f"Error: {input_dir} is not a valid directory")
        sys.exit(1)
    
    processor = VideoProcessor(input_dir, output_name)
    processor.process_directory()


if __name__ == "__main__":
    main()

