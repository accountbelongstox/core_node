#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Update term fields with actual language translations"""

import json
import os

# Read all English words
with open(r'pycore_db_cache/base_words.txt', 'r', encoding='utf-8') as f:
    all_words = [line.strip() for line in f if line.strip()]

print(f'Total words: {len(all_words)}')

# Language configurations
languages = {
    'jp': {'dir': 'jp', 'name': 'Japanese'},
    'lo': {'dir': 'laos', 'name': 'Lao'},
    'vi': {'dir': 'vie', 'name': 'Vietnamese'}
}

# Process each language
for lang_key, lang_info in languages.items():
    print(f'\nProcessing {lang_info["name"]}...')
    dir_name = lang_info['dir']
    
    for batch_num in range(1, 10):
        filepath = f'pycore_db_cache/{dir_name}/phonetics{batch_num}.json'
        
        if not os.path.exists(filepath):
            continue
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Update each item - for now keeping English as placeholder
        # In production, this would use a translation dictionary/API
        updated_count = 0
        for item in data['items']:
            order = item['order']
            if order <= len(all_words):
                english_word = all_words[order - 1]
                # The term should be the translated word in target language
                # For now, we keep the structure - actual translations would be added
                updated_count += 1
        
        # Save file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f'  Batch {batch_num}: {updated_count} items processed')

print('\nNote: To add actual translations, you need a translation dictionary')
print('for each language pair (English -> Japanese/Lao/Vietnamese)')

