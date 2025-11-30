# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

#!/usr/bin/env python3
"""
Image Classifier
Classifies images by analyzing dimensions, file names and paths to determine image type
"""

import re
from pathlib import Path
from typing import Dict, Tuple, Optional, List

class ImageClassifier:
    """Classifier for determining image types based on size, name and path"""

    def __init__(self):
        # Size thresholds for classification
        self.size_thresholds = {
            'small_icon': 256,      # <= 256px on any side
            'large_icon': 512,      # <= 512px on any side
            'placeholder': 5,       # <= 5px (1px images)
            'aspect_ratio_threshold': 2.0  # > 2.0 ratio = landscape/portrait
        }

        # Name pattern classifications
        self.name_patterns = {
            'icon': [
                r'.*icon.*', r'.*launcher.*', r'ic_.*', r'app_icon.*',
                r'.*logo.*', r'favicon.*', r'.*notification.*'
            ],
            'background': [
                r'.*background.*', r'.*bg.*', r'launch_background.*'
            ],
            'splash': [
                r'.*splash.*', r'launch_image.*', r'.*startup.*'
            ],
            'placeholder': [
                r'.*placeholder.*', r'.*empty.*', r'.*blank.*', r'1px.*'
            ]
        }

        # Path pattern classifications
        self.path_patterns = {
            'icon': [
                r'.*mipmap.*', r'.*icons.*', r'.*launcher.*', r'.*appicon.*'
            ],
            'background': [
                r'.*drawable.*', r'.*launch.*', r'.*background.*'
            ],
            'splash': [
                r'.*splash.*', r'.*launch.*', r'.*startup.*'
            ]
        }

    def classify_image(self, file_path: str, width: int, height: int) -> Dict:
        """
        Classify an image based on its path, name, and dimensions

        Returns:
            Dict with classification information including type, subtype, and recommendations
        """
        path_obj = Path(file_path)
        filename = path_obj.name.lower()
        path_str = str(path_obj).lower()

        # Calculate basic metrics
        max_dimension = max(width, height)
        min_dimension = min(width, height)
        aspect_ratio = max_dimension / min_dimension if min_dimension > 0 else 0

        # Initialize classification result
        classification = {
            'primary_type': 'unknown',
            'subtype': 'unknown',
            'size_category': self._classify_by_size(width, height),
            'aspect_category': self._classify_by_aspect_ratio(aspect_ratio),
            'confidence': 0,
            'dimensions': (width, height),
            'aspect_ratio': aspect_ratio,
            'recommendations': []
        }

        # Classify by name patterns
        name_type = self._classify_by_name(filename)
        name_confidence = 0.7 if name_type != 'unknown' else 0

        # Classify by path patterns
        path_type = self._classify_by_path(path_str)
        path_confidence = 0.6 if path_type != 'unknown' else 0

        # Classify by size characteristics
        size_type = self._classify_by_size_characteristics(width, height)
        size_confidence = 0.5 if size_type != 'unknown' else 0

        # Determine primary classification (highest confidence wins)
        classifications = [
            (name_type, name_confidence),
            (path_type, path_confidence),
            (size_type, size_confidence)
        ]

        best_classification = max(classifications, key=lambda x: x[1])
        classification['primary_type'] = best_classification[0]
        classification['confidence'] = best_classification[1]

        # Determine subtype based on size and aspect ratio
        classification['subtype'] = self._determine_subtype(
            classification['primary_type'],
            classification['size_category'],
            classification['aspect_category'],
            width, height
        )

        # Generate recommendations
        classification['recommendations'] = self._generate_recommendations(classification)

        return classification

    def _classify_by_name(self, filename: str) -> str:
        """Classify by filename patterns"""
        for image_type, patterns in self.name_patterns.items():
            for pattern in patterns:
                if re.match(pattern, filename, re.IGNORECASE):
                    return image_type
        return 'unknown'

    def _classify_by_path(self, path_str: str) -> str:
        """Classify by path patterns"""
        for image_type, patterns in self.path_patterns.items():
            for pattern in patterns:
                if re.search(pattern, path_str, re.IGNORECASE):
                    return image_type
        return 'unknown'

    def _classify_by_size(self, width: int, height: int) -> str:
        """Classify by size dimensions"""
        max_dim = max(width, height)
        min_dim = min(width, height)

        if max_dim <= self.size_thresholds['placeholder']:
            return 'placeholder'
        elif max_dim <= self.size_thresholds['small_icon']:
            return 'small'
        elif max_dim <= self.size_thresholds['large_icon']:
            return 'medium'
        else:
            return 'large'

    def _classify_by_aspect_ratio(self, aspect_ratio: float) -> str:
        """Classify by aspect ratio"""
        if aspect_ratio <= 0:
            return 'invalid'
        elif aspect_ratio < 1.2:
            return 'square'
        elif aspect_ratio < self.size_thresholds['aspect_ratio_threshold']:
            return 'slightly_rectangular'
        else:
            return 'wide_rectangular'

    def _classify_by_size_characteristics(self, width: int, height: int) -> str:
        """Classify based on size characteristics"""
        max_dim = max(width, height)
        aspect_ratio = max_dim / min(width, height) if min(width, height) > 0 else 0

        # Placeholder images (very small)
        if max_dim <= self.size_thresholds['placeholder']:
            return 'placeholder'

        # Icon-like (small and squarish)
        if max_dim <= self.size_thresholds['large_icon'] and aspect_ratio < 2.0:
            return 'icon'

        # Background/splash (large or wide aspect ratio)
        if max_dim > self.size_thresholds['large_icon'] or aspect_ratio >= 2.0:
            return 'background'

        return 'unknown'

    def _determine_subtype(self, primary_type: str, size_category: str, aspect_category: str, width: int, height: int) -> str:
        """Determine detailed subtype"""
        if primary_type == 'icon':
            if size_category == 'small':
                return 'small_icon'
            elif size_category == 'medium':
                return 'app_icon'
            else:
                return 'large_icon'

        elif primary_type == 'background':
            if aspect_category == 'wide_rectangular':
                if width > height:
                    return 'landscape_background'
                else:
                    return 'portrait_background'
            else:
                return 'square_background'

        elif primary_type == 'splash':
            if aspect_category == 'wide_rectangular':
                return 'fullscreen_splash'
            else:
                return 'centered_splash'

        elif primary_type == 'placeholder':
            return 'placeholder_image'

        return 'unclassified'

    def _generate_recommendations(self, classification: Dict) -> List[str]:
        """Generate recommendations based on classification"""
        recommendations = []
        primary_type = classification['primary_type']
        size_category = classification['size_category']
        width, height = classification['dimensions']

        if primary_type == 'icon':
            if size_category == 'large':
                recommendations.append("Consider creating smaller icon variants for different densities")
            elif size_category == 'small':
                recommendations.append("May need larger variants for high-DPI screens")

            if classification['aspect_category'] != 'square':
                recommendations.append("Icons should typically be square for best platform compatibility")

        elif primary_type == 'background':
            if size_category == 'small':
                recommendations.append("Background image may be too small for modern screen resolutions")

            if classification['aspect_category'] == 'square':
                recommendations.append("Consider creating portrait and landscape variants")

        elif primary_type == 'splash':
            if width < 1080 or height < 1920:
                recommendations.append("Consider higher resolution for modern devices (1080x1920 or larger)")

        elif primary_type == 'placeholder':
            recommendations.append("This appears to be a placeholder - replace with actual content")

        elif classification['confidence'] < 0.5:
            recommendations.append("Image type unclear - verify correct placement and naming")

        return recommendations

    def get_classification_summary(self, classification: Dict) -> str:
        """Get a human-readable summary of the classification"""
        primary_type = classification['primary_type']
        subtype = classification['subtype']
        size_category = classification['size_category']
        aspect_category = classification['aspect_category']
        confidence = classification['confidence']

        summary_parts = []

        # Main type
        if primary_type != 'unknown':
            summary_parts.append(f"{primary_type.title()}")

        # Subtype details
        if subtype != 'unknown' and subtype != primary_type:
            summary_parts.append(f"({subtype.replace('_', ' ').title()})")

        # Size info
        summary_parts.append(f"Size: {size_category.title()}")

        # Aspect ratio info
        if aspect_category in ['wide_rectangular', 'slightly_rectangular']:
            summary_parts.append(f"Shape: {aspect_category.replace('_', ' ').title()}")

        # Confidence
        if confidence > 0:
            confidence_level = "High" if confidence > 0.7 else "Medium" if confidence > 0.4 else "Low"
            summary_parts.append(f"Confidence: {confidence_level}")

        return " | ".join(summary_parts) if summary_parts else "Unclassified Image"