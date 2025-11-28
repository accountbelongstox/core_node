#!/usr/bin/env python3

"""
Romanization and Phonetic Examples

Demonstrates how to use the romanization and phonetic transcription features
of the translator utility.
"""

import asyncio
from pycore.pyutils.translator import (
    romanize_text,
    romanize_batch,
    text_to_ipa,
    word_to_ipa,
    batch_to_ipa,
    Romanizer,
    PhoneticTranscriber,
)


def print_section(title: str):
    """Print a section header"""
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


async def example_romanization_basic():
    """Basic romanization examples"""
    print_section("Example 1: Basic Romanization")

    # Chinese romanization
    result = await romanize_text("你好，世界", src="zh-cn")
    print(f"Chinese: {result['original_text']}")
    print(f"Romanized: {result['romanized_text']}")
    print(f"From cache: {result['from_cache']}")

    print("\n" + "-" * 70)

    # Japanese romanization
    result = await romanize_text("こんにちは", src="ja")
    print(f"Japanese: {result['original_text']}")
    print(f"Romanized: {result['romanized_text']}")

    print("\n" + "-" * 70)

    # Korean romanization
    result = await romanize_text("안녕하세요", src="ko")
    print(f"Korean: {result['original_text']}")
    print(f"Romanized: {result['romanized_text']}")


async def example_romanization_batch():
    """Batch romanization example"""
    print_section("Example 2: Batch Romanization")

    texts = [
        "你好",
        "世界",
        "谢谢",
        "再见"
    ]

    results = await romanize_batch(texts, src="zh-cn")

    for result in results:
        print(f"{result['original_text']:10} → {result['romanized_text']}")


async def example_romanization_auto_detect():
    """Auto-detect language for romanization"""
    print_section("Example 3: Auto-Detect Language")

    texts = [
        ("你好", "Chinese"),
        ("こんにちは", "Japanese"),
        ("안녕하세요", "Korean"),
        ("Привет", "Russian"),
        ("مرحبا", "Arabic"),
    ]

    async with Romanizer() as romanizer:
        for text, lang_name in texts:
            result = await romanizer.romanize(text, src='auto')
            print(f"{lang_name:10} {result.original_text:15} → {result.romanized_text}")


def example_phonetic_basic():
    """Basic IPA phonetic transcription"""
    print_section("Example 4: Basic IPA Phonetic Transcription")

    transcriber = PhoneticTranscriber()

    # Single word
    result = transcriber.transcribe_word("hello")
    print(f"Word: {result.original_text}")
    print(f"IPA:  /{result.phonetic_text}/")

    print("\n" + "-" * 70)

    # Sentence
    result = transcriber.transcribe("Hello, world!")
    print(f"Sentence: {result.original_text}")
    print(f"IPA:      /{result.phonetic_text}/")


def example_phonetic_words():
    """IPA transcription for multiple words"""
    print_section("Example 5: IPA for Multiple Words")

    transcriber = PhoneticTranscriber()

    words = ["hello", "world", "python", "programming", "artificial", "intelligence"]

    results = transcriber.transcribe_words(words)

    print(f"{'Word':<15} {'IPA Notation'}")
    print("-" * 70)
    for result in results:
        print(f"{result.original_text:<15} /{result.phonetic_text}/")


def example_phonetic_sentences():
    """IPA transcription for sentences"""
    print_section("Example 6: IPA for Sentences")

    transcriber = PhoneticTranscriber()

    sentences = [
        "How are you?",
        "Thank you very much.",
        "Nice to meet you.",
        "Have a good day!",
    ]

    results = transcriber.transcribe_batch(sentences)

    for result in results:
        print(f"Text: {result.original_text}")
        print(f"IPA:  /{result.phonetic_text}/")
        print()


def example_phonetic_helper_functions():
    """Using helper functions for IPA"""
    print_section("Example 7: IPA Helper Functions")

    # text_to_ipa
    result = text_to_ipa("Hello world")
    print(f"text_to_ipa: {result['original_text']} → /{result['phonetic_text']}/")

    # word_to_ipa
    result = word_to_ipa("python")
    print(f"word_to_ipa: {result['original_text']} → /{result['phonetic_text']}/")

    # batch_to_ipa
    results = batch_to_ipa(["cat", "dog", "bird"])
    print("\nbatch_to_ipa:")
    for result in results:
        print(f"  {result['original_text']} → /{result['phonetic_text']}/")


async def example_combined_usage():
    """Combined romanization and phonetic usage"""
    print_section("Example 8: Combined Usage")

    # Romanize a Chinese phrase
    romanization = await romanize_text("你好，世界！", src="zh-cn")
    print(f"Chinese:    {romanization['original_text']}")
    print(f"Romanized:  {romanization['romanized_text']}")

    # Convert English to IPA
    transcriber = PhoneticTranscriber()
    phonetic = transcriber.transcribe("Hello, world!")
    print(f"\nEnglish:    {phonetic.original_text}")
    print(f"IPA:        /{phonetic.phonetic_text}/")


async def example_caching():
    """Demonstrate caching behavior"""
    print_section("Example 9: Caching Demonstration")

    print("First call (will fetch from API):")
    result1 = await romanize_text("你好", src="zh-cn")
    print(f"  Romanized: {result1['romanized_text']}")
    print(f"  From cache: {result1['from_cache']}")

    print("\nSecond call (will use cache):")
    result2 = await romanize_text("你好", src="zh-cn")
    print(f"  Romanized: {result2['romanized_text']}")
    print(f"  From cache: {result2['from_cache']}")


async def run_async_examples():
    """Run all async examples"""
    await example_romanization_basic()
    await example_romanization_batch()
    await example_romanization_auto_detect()
    await example_combined_usage()
    await example_caching()


def run_sync_examples():
    """Run all sync examples"""
    example_phonetic_basic()
    example_phonetic_words()
    example_phonetic_sentences()
    example_phonetic_helper_functions()


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("Romanization and Phonetic Transcription Examples")
    print("=" * 70)

    # Run async examples (romanization)
    print("\n🌍 ROMANIZATION EXAMPLES (async)")
    asyncio.run(run_async_examples())

    # Run sync examples (phonetic)
    print("\n🔊 PHONETIC (IPA) EXAMPLES (sync)")
    run_sync_examples()

    print("\n" + "=" * 70)
    print("✅ All examples completed!")
    print("=" * 70)
