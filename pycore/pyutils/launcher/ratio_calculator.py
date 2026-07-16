# -*- coding: utf-8 -*-
"""
Ratio Calculator
Calculates character pixel ratios for terminal windows
"""


class RatioCalculator:
    """Calculate character pixel ratios based on measurements"""
    
    def __init__(self, measured_columns, measured_rows, measured_width_px, measured_height_px):
        """
        Initialize ratio calculator with measurement data
        
        Args:
            measured_columns: Number of columns in measurement
            measured_rows: Number of rows in measurement
            measured_width_px: Pixel width for measured columns
            measured_height_px: Pixel height for measured rows
        """
        self.measured_columns = measured_columns
        self.measured_rows = measured_rows
        self.measured_width_px = measured_width_px
        self.measured_height_px = measured_height_px
        
        # Calculate character dimensions
        self.char_width = measured_width_px / measured_columns
        self.char_height = measured_height_px / measured_rows
        # Provenance strings for get_info() logging.
        self.column_ratio = (f"{measured_columns} columns = {measured_width_px}px "
                             f"-> {self.char_width:.4f}px per column")
        self.row_ratio = (f"{measured_rows} rows = {measured_height_px}px "
                          f"-> {self.char_height:.4f}px per row")
        self.source = "config measurement"

    @classmethod
    def from_char_size(cls, char_width, char_height, source="dynamic measurement"):
        """Build a calculator from directly-measured per-cell pixel sizes.

        Used when the cell size was measured at runtime (CharSizeMeasurer) rather
        than read from config, so char_width/char_height are exact for the
        installed font/DPI instead of the fixed (and historically bogus) config
        calibration. The synthetic 1x1 measurement makes char_width/char_height
        exact; the ratio strings are overridden to avoid a misleading "1 columns"
        provenance line.
        """
        calc = cls(1, 1, char_width, char_height)
        calc.column_ratio = f"{char_width:.4f}px per column"
        calc.row_ratio = f"{char_height:.4f}px per row"
        calc.source = source
        return calc

    def get_char_width(self):
        """Get pixel width per column"""
        return self.char_width
    
    def get_char_height(self):
        """Get pixel height per row"""
        return self.char_height
    
    def calculate_term_size(self, target_width_px, target_height_px,
                            calibration_height_px=None, calibration_term_rows=None):
        """
        Calculate terminal columns and rows for target pixel size

        Args:
            target_width_px: Target content width in pixels
            target_height_px: Target content height in pixels
            calibration_height_px: Measured content height at calibration_term_rows
            calibration_term_rows: Row count used for the height calibration sample

        Returns:
            tuple: (term_columns, term_rows, actual_width_px, actual_height_px)
        """
        char_width = self.char_width
        if calibration_height_px and calibration_term_rows and calibration_term_rows > 0:
            char_height = calibration_height_px / calibration_term_rows
            print(f"  Calibration: {calibration_height_px}px / {calibration_term_rows} rows "
                  f"= {char_height:.4f}px per row")
        else:
            char_height = self.char_height

        term_columns = max(1, int(target_width_px / char_width))
        term_rows = max(1, int(target_height_px / char_height))

        actual_width_px = term_columns * char_width
        actual_height_px = term_rows * char_height

        return (term_columns, term_rows, actual_width_px, actual_height_px)
    
    def get_info(self):
        """Get ratio information"""
        return {
            'column_ratio': self.column_ratio,
            'row_ratio': self.row_ratio,
            'char_width': self.char_width,
            'char_height': self.char_height,
            'source': self.source,
        }

