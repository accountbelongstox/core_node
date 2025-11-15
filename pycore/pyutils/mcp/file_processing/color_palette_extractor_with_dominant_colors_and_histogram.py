#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Color Palette Extractor with Dominant Colors and Histogram
Extracts color information from images including dominant colors, palettes, and histograms
"""

import logging
from typing import Dict, Any, List, Tuple
from collections import Counter

from pycore.pyfoundations.third_party import PIL_Image, numpy

logger = logging.getLogger(__name__)


class ColorPaletteExtractorWithDominantColorsAndHistogram:
    """Color palette extractor for comprehensive color analysis"""

    COLOR_NAMES = {
        (255, 0, 0): "red", (0, 255, 0): "green", (0, 0, 255): "blue",
        (255, 255, 0): "yellow", (255, 0, 255): "magenta", (0, 255, 255): "cyan",
        (255, 255, 255): "white", (0, 0, 0): "black", (128, 128, 128): "gray",
        (255, 165, 0): "orange", (128, 0, 128): "purple", (165, 42, 42): "brown"
    }

    async def extract_color_palette_with_dominant_colors_histogram_statistics_and_brightness_analysis(
        self, image_path: str, num_colors: int = 10
    ) -> Dict[str, Any]:
        """Extract comprehensive color palette information from image"""
        with PIL_Image.open(image_path) as img:
            if img.mode != 'RGB':
                img = img.convert('RGB')

            img_array = numpy.array(img)

            dominant_colors = await self._extract_dominant_colors_with_percentages(img_array, num_colors)
            color_palette = await self._generate_quantized_color_palette(img_array, num_colors=16)
            histogram_stats = await self._calculate_color_histogram_statistics(img_array)
            brightness_analysis = await self._analyze_image_brightness(img_array)

            return {
                "dominant_colors_rgb_top_10": dominant_colors[:num_colors],
                "color_palette_quantized": color_palette,
                "color_histogram_statistics": histogram_stats,
                "brightness_analysis": brightness_analysis
            }

    async def _extract_dominant_colors_with_percentages(
        self, img_array, num_colors: int
    ) -> List[Dict[str, Any]]:
        """Extract dominant colors with percentages"""
        pixels = img_array.reshape(-1, 3)
        total_pixels = len(pixels)
        pixel_tuples = [tuple(pixel) for pixel in pixels]
        color_counts = Counter(pixel_tuples)

        dominant = []
        for rgb, count in color_counts.most_common(num_colors):
            percentage = (count / total_pixels) * 100
            dominant.append({
                "rgb": list(rgb),
                "hex": self._rgb_to_hex(rgb),
                "percentage": round(percentage, 2),
                "color_name": self._get_closest_color_name(rgb),
                "pixel_count": count
            })
        return dominant

    async def _generate_quantized_color_palette(
        self, img_array, num_colors: int
    ) -> List[Dict[str, str]]:
        """Generate quantized color palette"""
        pixels = img_array.reshape(-1, 3)
        if len(pixels) > 10000:
            indices = numpy.random.choice(len(pixels), 10000, replace=False)
            pixels = pixels[indices]

        from sklearn.cluster import KMeans
        kmeans = KMeans(n_clusters=num_colors, random_state=42, n_init=10)
        kmeans.fit(pixels)

        palette = []
        for center in kmeans.cluster_centers_:
            rgb = tuple(int(c) for c in center)
            palette.append({"rgb": list(rgb), "hex": self._rgb_to_hex(rgb)})
        return palette

    async def _calculate_color_histogram_statistics(self, img_array) -> Dict[str, Dict[str, float]]:
        """Calculate color histogram statistics for each channel"""
        stats = {}
        for i, channel in enumerate(['red_channel', 'green_channel', 'blue_channel']):
            channel_data = img_array[:, :, i]
            stats[channel] = {
                "mean": float(numpy.mean(channel_data)),
                "std": float(numpy.std(channel_data)),
                "min": int(numpy.min(channel_data)),
                "max": int(numpy.max(channel_data)),
                "median": float(numpy.median(channel_data))
            }
        return stats

    async def _analyze_image_brightness(self, img_array) -> Dict[str, Any]:
        """Analyze image brightness"""
        luminance = (
            0.299 * img_array[:, :, 0] +
            0.587 * img_array[:, :, 1] +
            0.114 * img_array[:, :, 2]
        )
        avg_brightness = float(numpy.mean(luminance))

        return {
            "average_brightness": round(avg_brightness, 2),
            "brightness_std": round(float(numpy.std(luminance)), 2),
            "is_dark_image": avg_brightness < 85,
            "is_bright_image": avg_brightness > 170,
            "brightness_range": {
                "min": float(numpy.min(luminance)),
                "max": float(numpy.max(luminance))
            }
        }

    def _rgb_to_hex(self, rgb: Tuple[int, int, int]) -> str:
        """Convert RGB tuple to hex string"""
        return '#{:02x}{:02x}{:02x}'.format(rgb[0], rgb[1], rgb[2])

    def _get_closest_color_name(self, rgb: Tuple[int, int, int]) -> str:
        """Get closest color name for RGB value"""
        min_distance = float('inf')
        closest_name = "unknown"
        for color_rgb, name in self.COLOR_NAMES.items():
            distance = sum((a - b) ** 2 for a, b in zip(rgb, color_rgb)) ** 0.5
            if distance < min_distance:
                min_distance = distance
                closest_name = name
        return closest_name


_color_extractor_instance = None

def get_color_extractor_singleton() -> ColorPaletteExtractorWithDominantColorsAndHistogram:
    """Get singleton instance of color extractor"""
    global _color_extractor_instance
    if _color_extractor_instance is None:
        _color_extractor_instance = ColorPaletteExtractorWithDominantColorsAndHistogram()
    return _color_extractor_instance
