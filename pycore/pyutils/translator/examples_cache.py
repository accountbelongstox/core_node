#!/usr/bin/env python3
"""
Translator Cache Examples

Demonstrates caching features in the translator module.
All translator features use MD5-based caching with namespace isolation.
"""

import asyncio
from pycore.pyutils.translator import (
    GoogleTranslator,
    romanize_text,
    text_to_ipa,
    GoogleTranslatorCache,
    RomanizationCache,
    PhoneticCache,
)

import time



def print_section(title: str):
    """Print section header"""
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


async def example_translation_cache():
    """Translation caching example"""
    print_section("Example 1: Translation Cache")

    async with GoogleTranslator() as translator:
        # First call - from API
        print("First call (will fetch from API):")
        result1 = await translator.translate_single("Hello", src="en", dest="zh-cn")
        print(f"  Translation: {result1.translated_text}")
        print(f"  From cache: {result1.from_cache}")

        # Second call - from cache
        print("\nSecond call (will use cache):")
        result2 = await translator.translate_single("Hello", src="en", dest="zh-cn")
        print(f"  Translation: {result2.translated_text}")
        print(f"  From cache: {result2.from_cache}")


async def example_romanization_cache():
    """Romanization caching example"""
    print_section("Example 2: Romanization Cache")

    # First call
    print("First call (will fetch from API):")
    result1 = await romanize_text("你好", src="zh-cn")
    print(f"  Romanized: {result1['romanized_text']}")
    print(f"  From cache: {result1['from_cache']}")

    # Second call - from cache
    print("\nSecond call (will use cache):")
    result2 = await romanize_text("你好", src="zh-cn")
    print(f"  Romanized: {result2['romanized_text']}")
    print(f"  From cache: {result2['from_cache']}")


def example_phonetic_cache():
    """Phonetic transcription caching example"""
    print_section("Example 3: Phonetic (IPA) Cache")

    # First call
    print("First call (will process):")
    result1 = text_to_ipa("hello")
    print(f"  IPA: /{result1['phonetic_text']}/")
    print(f"  From cache: {result1['from_cache']}")

    # Second call - from cache
    print("\nSecond call (will use cache):")
    result2 = text_to_ipa("hello")
    print(f"  IPA: /{result2['phonetic_text']}/")
    print(f"  From cache: {result2['from_cache']}")


async def example_disable_cache():
    """Example with cache disabled"""
    print_section("Example 4: Disable Cache")

    async with GoogleTranslator() as translator:
        # With cache disabled
        result = await translator.translate_single(
            "Hello",
            src="en",
            dest="zh-cn",
            use_cache=False
        )
        print(f"Translation: {result.translated_text}")
        print(f"From cache: {result.from_cache}")  # Always False


def example_clear_cache():
    """Clear cache examples"""
    print_section("Example 5: Clear Cache")

    # Clear translation cache for specific language pair
    cache = GoogleTranslatorCache(src_lang="en", dest_lang="zh-cn")
    count = cache.clear()
    print(f"Cleared {count} translation cache entries (en -> zh-cn)")

    # Clear romanization cache for specific language
    cache = RomanizationCache(src_lang="zh-cn")
    count = cache.clear()
    print(f"Cleared {count} romanization cache entries (zh-cn)")

    # Clear phonetic cache
    cache = PhoneticCache()
    count = cache.clear()
    print(f"Cleared {count} phonetic cache entries")


def example_cache_info():
    """Display cache information"""
    print_section("Example 6: Cache Information")

    # Translation cache location
    cache = GoogleTranslatorCache(src_lang="en", dest_lang="zh-cn")
    print(f"Translation cache directory:")
    print(f"  {cache.cache_dir}")

    # Romanization cache location
    cache = RomanizationCache(src_lang="zh-cn")
    print(f"\nRomanization cache directory:")
    print(f"  {cache.cache_dir}")

    # Phonetic cache location
    cache = PhoneticCache()
    print(f"\nPhonetic cache directory:")
    print(f"  {cache.cache_dir}")


async def example_cache_performance():
    """Demonstrate cache performance benefit"""
    print_section("Example 7: Cache Performance")


    texts = ["Hello", "World", "Python", "Programming", "Artificial Intelligence"]

    async with GoogleTranslator() as translator:
        # First batch - no cache
        print("First batch (no cache):")
        start = time.time()
        results = await translator.translate_batch(texts, src="en", dest="zh-cn")
        elapsed = time.time() - start
        print(f"  Time: {elapsed:.2f}s")
        print(f"  Translations: {[r.translated_text for r in results]}")

        # Second batch - with cache
        print("\nSecond batch (with cache):")
        start = time.time()
        results = await translator.translate_batch(texts, src="en", dest="zh-cn")
        elapsed = time.time() - start
        print(f"  Time: {elapsed:.2f}s (much faster!)")
        print(f"  All from cache: {all(r.from_cache for r in results)}")


async def run_async_examples():
    """Run all async examples"""
    await example_translation_cache()
    await example_romanization_cache()
    await example_disable_cache()
    await example_cache_performance()


def run_sync_examples():
    """Run all sync examples"""
    example_phonetic_cache()
    example_cache_info()
    example_clear_cache()


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("Translator Cache System Examples")
    print("=" * 70)
    print("\nAll translator features use MD5-based caching:")
    print("  • Translation: {wwwroot}/pycore_db/translator_cache/{src}_{dest}/")
    print("  • Romanization: {wwwroot}/pycore_db/romanization_cache/{src}/")
    print("  • Phonetic: {wwwroot}/pycore_db/phonetic_cache/")

    # Run async examples
    print("\n📦 CACHE EXAMPLES (async)")
    asyncio.run(run_async_examples())

    # Run sync examples
    print("\n📦 CACHE MANAGEMENT (sync)")
    run_sync_examples()

    print("\n" + "=" * 70)
    print("✅ All cache examples completed!")
    print("=" * 70)
