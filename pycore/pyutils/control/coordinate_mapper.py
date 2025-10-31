"""Coordinate mapping for resolution adaptation"""

from typing import Tuple, List


class CoordinateMapper:
    """
    Coordinate mapper for different resolutions

    Features:
    - Map browser coordinates to device coordinates
    - Adapt different resolutions
    - Support rotation

    Example:
        # Browser displays 720x1280, device actual 1440x3120
        x, y = CoordinateMapper.map(
            360, 640,               # Browser coordinates (click center)
            from_width=720,
            from_height=1280,
            to_width=1440,
            to_height=3120
        )
        # Result: (720, 1560)
    """

    @staticmethod
    def map(
        x: int,
        y: int,
        from_width: int,
        from_height: int,
        to_width: int,
        to_height: int
    ) -> Tuple[int, int]:
        """
        Map coordinates from one resolution to another

        Args:
            x, y: Source coordinates
            from_width, from_height: Source resolution
            to_width, to_height: Target resolution

        Returns:
            Mapped coordinates (x, y)
        """
        mapped_x = int(x * to_width / from_width)
        mapped_y = int(y * to_height / from_height)

        # Boundary check
        mapped_x = max(0, min(mapped_x, to_width - 1))
        mapped_y = max(0, min(mapped_y, to_height - 1))

        return mapped_x, mapped_y

    @staticmethod
    def map_batch(
        points: List[Tuple[int, int]],
        from_width: int,
        from_height: int,
        to_width: int,
        to_height: int
    ) -> List[Tuple[int, int]]:
        """
        Map multiple coordinates at once

        Args:
            points: List of (x, y) tuples
            from_width, from_height: Source resolution
            to_width, to_height: Target resolution

        Returns:
            List of mapped coordinates
        """
        return [
            CoordinateMapper.map(
                x, y, from_width, from_height, to_width, to_height
            )
            for x, y in points
        ]

    @staticmethod
    def reverse_map(
        x: int,
        y: int,
        from_width: int,
        from_height: int,
        to_width: int,
        to_height: int
    ) -> Tuple[int, int]:
        """
        Reverse mapping (device to browser)

        This is the inverse of map() function
        """
        return CoordinateMapper.map(
            x, y, to_width, to_height, from_width, from_height
        )
