#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Alert Logger - Log Price Alerts to File
Alert Logger - Write Price Alerts to Log File

Features:
- Log alerts to daily rotating log files
- Color-coded console output
- CSV format for easy analysis
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
from pyapps.okx_price_monitor.core.monitor_config import monitor_config


class AlertLogger:
    """
    Alert Logger for price movement alerts

    Logs alerts to daily files in CSV format
    """

    def __init__(self, log_dir: Optional[Path] = None):
        """
        Initialize alert logger

        Args:
            log_dir: Directory for log files (default: cache_dir/alerts)
        """
        if log_dir is None:
            log_dir = monitor_config.CACHE_DIR / "alerts"

        self.log_dir = log_dir
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Alert counters
        self.alert_counts = {
            '5s': 0,
            '30s': 0,
            '1m': 0,
            'total': 0
        }

        print(f"[AlertLogger] Initialized")
        print(f"[AlertLogger] Log directory: {self.log_dir}")

    def log_alert(self, alert: Dict):
        """
        Log an alert to file

        Args:
            alert: Alert dictionary with keys:
                   - coin: Coin symbol
                   - window: Time window ('5s', '30s', '1m')
                   - change: Price change percentage
                   - direction: 'up' or 'down'
                   - timestamp: Alert timestamp
        """
        try:
            # Get today's log file
            today = datetime.now().strftime('%Y%m%d')
            log_file = self.log_dir / f"alerts_{today}.csv"

            # Check if file exists to determine if we need header
            file_exists = log_file.exists()

            # Open file in append mode
            with open(log_file, 'a', encoding='utf-8') as f:
                # Write header if new file
                if not file_exists:
                    f.write("Timestamp,Coin,Window,Change(%),Direction\n")

                # Write alert data
                timestamp = alert['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
                coin = alert['coin']
                window = alert['window']
                change = alert['change']
                direction = alert['direction']

                f.write(f"{timestamp},{coin},{window},{change:.4f},{direction}\n")

            # Update counters
            self.alert_counts[window] += 1
            self.alert_counts['total'] += 1

        except Exception as e:
            print(f"[AlertLogger] Error logging alert: {e}")

    def get_today_log_file(self) -> Path:
        """Get today's log file path"""
        today = datetime.now().strftime('%Y%m%d')
        return self.log_dir / f"alerts_{today}.csv"

    def get_stats(self) -> Dict:
        """Get alert statistics"""
        return {
            'total_alerts': self.alert_counts['total'],
            'alerts_5s': self.alert_counts['5s'],
            'alerts_30s': self.alert_counts['30s'],
            'alerts_1m': self.alert_counts['1m'],
            'log_dir': str(self.log_dir),
            'today_log': str(self.get_today_log_file())
        }


# Global instance
_global_logger = None


def get_alert_logger() -> AlertLogger:
    """Get global alert logger instance"""
    global _global_logger

    if _global_logger is None:
        _global_logger = AlertLogger()

    return _global_logger
