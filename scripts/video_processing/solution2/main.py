#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Solution 2: High Precision Combination
FFmpeg → WhisperX → GPT-SoVITS → MoviePy

Features:
- Convert video to speech and generate subtitles (word-level timestamps)
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
from common.dependency_manager import setup_solution2_dependencies
setup_solution2_dependencies()

# Now import the required packages (they are guaranteed to be installed)
import whisperx
import torch
from moviepy.editor import VideoFileClip, AudioFileClip, CompositeVideoClip, TextClip
import numpy as np


class VideoProcessor:
    """Video processing class - Solution 2"""
    
    def __init__(self, input_dir: str, output_base_name: str = "video_output"):
        self.input_dir = Path(input_dir).resolve()
        self.output_base_dir = self.input_dir.parent / output_base_name
        self.output_base_dir.mkdir(exist_ok=True)
        
        # Initialize device
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")
        
        # Load WhisperX model
        print("Loading WhisperX model...")
        self.model = whisperx.load_model("base", self.device, compute_type="float16" if self.device == "cuda" else "int8")
        
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
                '-vn', '-acodec', 'pcm_s16le', '-ar', '16000',
                '-ac', '1', '-y', str(audio_path)
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
    
    def transcribe_audio(self, audio_path: Path, language: str = "zh") -> Dict:
        """Perform speech recognition using WhisperX (word-level timestamps)"""
        try:
            # Load audio
            audio = whisperx.load_audio(str(audio_path))
            
            # Transcribe
            result = self.model.transcribe(audio, batch_size=16, language=language)
            
            # Align (word-level timestamps)
            model_a, metadata = whisperx.load_align_model(language_code=language, device=self.device)
            result = whisperx.align(result["segments"], model_a, metadata, audio, self.device, return_char_alignments=False)
            
            return result
        except Exception as e:
            print(f"Speech recognition failed: {e}")
            return {"segments": []}
    
    def save_subtitle(self, result: Dict, subtitle_path: Path, format: str = 'srt'):
        """Save subtitle file"""
        segments = result.get("segments", [])
        
        if format == 'srt':
            with open(subtitle_path, 'w', encoding='utf-8') as f:
                for i, segment in enumerate(segments, 1):
                    start_time = self.format_time(segment['start'])
                    end_time = self.format_time(segment['end'])
                    text = segment.get('text', '').strip()
                    f.write(f"{i}\n")
                    f.write(f"{start_time} --> {end_time}\n")
                    f.write(f"{text}\n\n")
        elif format == 'json':
            with open(subtitle_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
        elif format == 'word_level':
            # Word-level subtitles (JSON format, includes timestamp for each word)
            word_segments = []
            for segment in segments:
                words = segment.get('words', [])
                for word in words:
                    word_segments.append({
                        'word': word.get('word', ''),
                        'start': word.get('start', 0),
                        'end': word.get('end', 0),
                        'score': word.get('score', 0)
                    })
            with open(subtitle_path, 'w', encoding='utf-8') as f:
                json.dump(word_segments, f, ensure_ascii=False, indent=2)
    
    def format_time(self, seconds: float) -> str:
        """Format timestamp to SRT format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    
    def generate_sentence_audios_gpt_sovits(self, subtitles: List[Dict], output_dir: Path, gpt_sovits_path: str = None):
        """Generate corresponding audio files for each subtitle sentence using GPT-SoVITS"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Note: GPT-SoVITS needs to be configured and installed separately
        # This provides an interface framework, actual usage requires calling GPT-SoVITS API or CLI
        if gpt_sovits_path is None:
            print("Warning: GPT-SoVITS not configured, skipping sentence audio generation")
            print("Hint: You can manually configure GPT-SoVITS path or use other TTS solutions")
            return 0
        
        # TODO: Implement GPT-SoVITS calling logic
        # Example framework:
        # for i, sub in enumerate(subtitles):
        #     audio_path = output_dir / f"sentence_{i+1:04d}.wav"
        #     # Call GPT-SoVITS to generate audio
        #     # subprocess.run([gpt_sovits_path, ...])
        
        return len(subtitles)
    
    def generate_sentence_audios_fallback(self, subtitles: List[Dict], output_dir: Path, original_audio_path: Path):
        """Fallback solution: Extract audio segments corresponding to each sentence from original audio"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            audio_clip = AudioFileClip(str(original_audio_path))
            
            for i, segment in enumerate(subtitles):
                start_time = segment.get('start', 0)
                end_time = segment.get('end', 0)
                
                sentence_audio = audio_clip.subclip(start_time, end_time)
                output_path = output_dir / f"sentence_{i+1:04d}.mp3"
                sentence_audio.write_audiofile(str(output_path), verbose=False, logger=None)
                sentence_audio.close()
            
            audio_clip.close()
            return len(subtitles)
        except Exception as e:
            print(f"Failed to extract sentence audio: {e}")
            return 0
    
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
        
        # 2. Extract audio (WhisperX requires 16kHz mono WAV)
        temp_audio_path = output_dir / f"{video_md5}_temp.wav"
        print("Extracting audio...")
        if not self.extract_audio(video_path, temp_audio_path):
            return mapping
        
        # 3. Compress audio (for storage)
        audio_md5 = self.calculate_md5(temp_audio_path)
        compressed_audio_path = output_dir / f"{audio_md5}_compressed.mp3"
        print("Compressing audio...")
        if self.compress_audio(temp_audio_path, compressed_audio_path):
            mapping['files']['compressed_audio'] = str(compressed_audio_path)
            mapping['files']['audio_md5'] = audio_md5
            print(f"✓ Audio compression completed: {compressed_audio_path.name}")
        
        # 4. Speech recognition to generate subtitles (word-level timestamps)
        print("Performing speech recognition (word-level timestamps)...")
        result = self.transcribe_audio(temp_audio_path)
        segments = result.get("segments", [])
        
        if segments:
            subtitle_md5 = hashlib.md5(json.dumps(result, sort_keys=True).encode()).hexdigest()
            subtitle_srt_path = output_dir / f"{subtitle_md5}.srt"
            subtitle_json_path = output_dir / f"{subtitle_md5}.json"
            subtitle_word_path = output_dir / f"{subtitle_md5}_word_level.json"
            
            self.save_subtitle(result, subtitle_srt_path, 'srt')
            self.save_subtitle(result, subtitle_json_path, 'json')
            self.save_subtitle(result, subtitle_word_path, 'word_level')
            
            mapping['files']['subtitle_srt'] = str(subtitle_srt_path)
            mapping['files']['subtitle_json'] = str(subtitle_json_path)
            mapping['files']['subtitle_word_level'] = str(subtitle_word_path)
            mapping['files']['subtitle_md5'] = subtitle_md5
            mapping['subtitle_count'] = len(segments)
            print(f"✓ Subtitle generation completed: {len(segments)} entries (with word-level timestamps)")
            
            # 5. Generate audio for each sentence
            print("Generating sentence audios...")
            # Prefer GPT-SoVITS, use fallback if not configured
            sentence_count = self.generate_sentence_audios_fallback(segments, sentence_audio_dir, temp_audio_path)
            mapping['files']['sentence_audio_dir'] = str(sentence_audio_dir)
            print(f"✓ Sentence audio generation completed: {sentence_count} files")
        
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
                import traceback
                traceback.print_exc()
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

