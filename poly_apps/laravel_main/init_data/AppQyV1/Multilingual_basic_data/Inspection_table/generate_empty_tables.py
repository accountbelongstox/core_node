from pathlib import Path

BASE_DIR = Path('pycore_db_cache')
OUTPUT_DIR = BASE_DIR / 'Inspection_table'
BASE_WORDS_FILE = BASE_DIR / 'base_words.txt'

HEADERS = "| # | English | Lao | Lao Pronunciation | Japanese | Japanese Pronunciation | Vietnamese | Vietnamese Pronunciation | English Meaning | Chinese Meaning |"
SEPARATOR = "|---|---------|-----|-------------------|----------|------------------------|------------|---------------------------|-----------------|-----------------|"


def read_base_words():
    return [line.strip() for line in BASE_WORDS_FILE.read_text(encoding='utf-8').splitlines() if line.strip()]


def write_table(words, start_index, chunk=100):
    end_index = min(start_index + chunk - 1, len(words))
    lines = [f"# Words {start_index}-{end_index}", "", HEADERS, SEPARATOR]
    for idx, word in enumerate(words[start_index - 1:end_index], start=start_index):
        lines.append(f"| {idx} | {word} |  |  |  |  |  |  |  |  |")
    output_path = OUTPUT_DIR / f"{start_index}-{end_index}.md"
    output_path.write_text("\n".join(lines), encoding='utf-8')


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    words = read_base_words()
    chunk = 100
    for start in range(1, len(words) + 1, chunk):
        write_table(words, start, chunk=chunk)


if __name__ == '__main__':
    main()
