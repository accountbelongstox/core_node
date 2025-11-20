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
    
    def get_char_width(self):
        """Get pixel width per column"""
        return self.char_width
    
    def get_char_height(self):
        """Get pixel height per row"""
        return self.char_height
    
    def calculate_term_size(self, target_width_px, target_height_px, actual_height_px=None):
        """
        Calculate terminal columns and rows for target pixel size
        
        Args:
            target_width_px: Target window width in pixels
            target_height_px: Target window height in pixels
            actual_height_px: Optional actual measured height (for calibration)
                            If provided, will dynamically adjust char_height
        
        Returns:
            tuple: (term_columns, term_rows, actual_width_px, actual_height_px)
        """
        term_columns = int(target_width_px / self.char_width)
        term_rows = int(target_height_px / self.char_height)
        
        # If actual height is provided, calibrate char_height dynamically
        if actual_height_px is not None and term_rows > 0:
            # Recalculate char_height based on actual measurement
            calibrated_char_height = actual_height_px / term_rows
            # Use calibrated height for final calculation
            actual_height_px_calc = term_rows * calibrated_char_height
            print(f"  Calibration: Actual height {actual_height_px}px / {term_rows} rows = {calibrated_char_height:.4f}px per row")
            actual_height_px = actual_height_px_calc
        else:
            actual_height_px = term_rows * self.char_height
        
        actual_width_px = term_columns * self.char_width
        
        return (term_columns, term_rows, actual_width_px, actual_height_px)
    
    def get_info(self):
        """Get ratio information"""
        return {
            'column_ratio': f"{self.measured_columns} columns = {self.measured_width_px}px -> {self.char_width:.4f}px per column",
            'row_ratio': f"{self.measured_rows} rows = {self.measured_height_px}px -> {self.char_height:.4f}px per row",
            'char_width': self.char_width,
            'char_height': self.char_height
        }

