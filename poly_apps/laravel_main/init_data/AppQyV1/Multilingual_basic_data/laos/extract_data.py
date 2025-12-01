#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
input_file = os.path.join(script_dir, '1-500.txt')

print(f"Reading file: {input_file}", file=sys.stderr)
print(f"File exists: {os.path.exists(input_file)}", file=sys.stderr)

with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines read: {len(lines)}", file=sys.stderr)

data = []
current_header = ""

for line in lines:
    line = line.strip()
    
    if re.match(r'^\d+\.\s+.+', line):
        current_header = line
        continue
    
    if '-' in line and line:
        parts = line.split(' - ', 1)
        if len(parts) == 2:
            chinese_word = parts[0].strip()
            laos_part = parts[1].strip()
            
            # Parse laos part: "ປັດຊະຍາ (patsanya)" -> separate text and pronunciation
            laos_text = laos_part
            pronunciation = ""
            
            # Extract pronunciation from parentheses
            match = re.search(r'\(([^)]+)\)', laos_part)
            if match:
                pronunciation = match.group(1)
                laos_text = re.sub(r'\s*\([^)]+\)', '', laos_part).strip()
            
            data.append({
                'header': current_header,
                'chinese': chinese_word,
                'laos': laos_text,
                'pronunciation': pronunciation,
                'english': 'TODO'
            })

print(f"Total entries extracted: {len(data)}", file=sys.stderr)

batch_size = 100
total_batches = (len(data) + batch_size - 1) // batch_size

print(f"Will generate {total_batches} files", file=sys.stderr)

for batch_num in range(total_batches):
    start_idx = batch_num * batch_size
    end_idx = min(start_idx + batch_size, len(data))
    batch_data = data[start_idx:end_idx]
    
    filename = f"{start_idx + 1}-{end_idx}.md"
    output_path = os.path.join(script_dir, filename)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("| Lao | (pronunciation) | English Translation | zh Translation |\n")
        f.write("|-----|-----------------|---------------------|----------------|\n")
        
        for item in batch_data:
            chinese = item['chinese'].replace('|', '\\|')
            english = item['english'].replace('|', '\\|')
            
            # Format: laos_text | (pronunciation) | TODO | chinese
            laos_text = item['laos'].replace('|', '\\|')
            pronunciation = item['pronunciation'].replace('|', '\\|')
            
            if pronunciation:
                pronunciation_col = f"({pronunciation})"
            else:
                pronunciation_col = ""
            
            f.write(f"| {laos_text} | {pronunciation_col} | {english} | {chinese} |\n")
    
    print(f"Generated: {filename} ({len(batch_data)} entries)", file=sys.stderr)

print("Done!", file=sys.stderr)
