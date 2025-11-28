"""
Gemini Utility Package

Provides unified interface for Google Gemini API operations.
Exports the main Gemini manager instance for easy access.

Usage:
    from pycore.pyutils.gemini import gemini_manager

    # Generate text content
    result = gemini_manager.generate_content("Explain how AI works")
    print(result["text"])

    # Generate content with images
    result = gemini_manager.generate_with_images(
        prompt="What's in this image?",
        image_paths=["path/to/image.jpg"]
    )
    print(result["text"])

    # List available models
    models = gemini_manager.list_models()
    print(models["models"])
"""

from pycore.pyutils.gemini.gemini_manager import gemini_manager

__all__ = ['gemini_manager']
