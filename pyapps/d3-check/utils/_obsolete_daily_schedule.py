#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Daily Schedule Generator
Generates daily schedules based on server region and rest time configuration
"""

import json
import os
import random
from datetime import datetime, time, timedelta
from typing import Dict, List, Tuple, Optional
import pytz

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import sys
sys.path.insert(0, current_dir)

from providor.providor_second import CONFIG, CURRENT_USER_DATA_PATH


class DailyScheduleGenerator:
    """Generates daily schedules based on server region and rest time configuration"""
    
    def __init__(self):
        self.schedule_file = os.path.join(CURRENT_USER_DATA_PATH, "daily_schedule.json")
        self.timezone_map = {
            "CN": "Asia/Shanghai",
            "TW": "Asia/Taipei", 
            "KR": "Asia/Seoul",
            "US": "America/New_York",
            "EU": "Europe/London"
        }
        # Cache for current schedule
        self._cached_schedule = None
        self._schedule_cache_date = None
        # Ensure schedule exists on initialization
        self._ensure_schedule_exists()
    
    def _ensure_schedule_exists(self):
        """Ensure that a valid schedule exists"""
        try:
            # Temporarily disable debug mode during initialization
            original_debug = CONFIG.get('daily_schedule', {}).get('debug', False)
            CONFIG['daily_schedule']['debug'] = False
            
            schedule = self.get_or_generate_schedule()
            if schedule:
                print(f"[SCHEDULE] Daily schedule ready: {schedule.get('date', 'Unknown')}")
            
            # Restore original debug setting
            CONFIG['daily_schedule']['debug'] = original_debug
        except Exception as e:
            print(f"[SCHEDULE] Error ensuring schedule exists: {e}")
    
    def _get_cached_schedule(self) -> Optional[Dict]:
        """Get cached schedule or load from file"""
        today = datetime.now().date()
        
        # Check if cache is valid for today
        if (self._cached_schedule and 
            self._schedule_cache_date and 
            self._schedule_cache_date == today):
            return self._cached_schedule
        
        # Load from file and cache
        try:
            if os.path.exists(self.schedule_file):
                with open(self.schedule_file, 'r', encoding='utf-8') as f:
                    schedule = json.load(f)
                    if self.is_schedule_valid(schedule):
                        self._cached_schedule = schedule
                        self._schedule_cache_date = today
                        return schedule
        except Exception as e:
            print(f"Error loading cached schedule: {e}")
        
        return None
    
    def get_server_region(self) -> str:
        """Get server region from CONFIG"""
        return CONFIG.get('server_settings', {}).get('server_region', 'US')
    
    def get_rest_duration_max(self) -> int:
        """Get maximum rest duration from CONFIG (default 6 hours)"""
        rest_config = CONFIG.get('daily_schedule', {}).get('rest_time_range', [6])
        if isinstance(rest_config, list) and len(rest_config) >= 1:
            return int(rest_config[0])
        return 6
    
    def is_debug_mode(self) -> bool:
        """Check if debug mode is enabled"""
        return CONFIG.get('daily_schedule', {}).get('debug', False)
    
    def get_timezone(self, server_region: str) -> str:
        """Get timezone based on server region"""
        return self.timezone_map.get(server_region, "UTC")
    
    def generate_time_range(self, start_hour: int, end_hour: int, duration_hours: float) -> Tuple[time, time]:
        """Generate a time range within specified hours"""
        # Convert duration to minutes
        duration_minutes = int(duration_hours * 60)
        
        # Handle overnight periods (e.g., 22:00 to 08:00)
        if start_hour > end_hour:
            # Overnight period
            available_hours = (24 - start_hour) + end_hour
            if duration_hours > available_hours:
                duration_hours = available_hours
                duration_minutes = int(duration_hours * 60)
            
            # Generate start time
            start_hour = random.randint(start_hour, 23)
            start_minute = random.randint(0, 59)
            
            # Calculate end time (may cross midnight)
            total_minutes = start_hour * 60 + start_minute + duration_minutes
            end_hour = (total_minutes // 60) % 24
            end_minute = total_minutes % 60
            
        else:
            # Same day period
            max_start_hour = end_hour - int(duration_hours)
            if max_start_hour < start_hour:
                max_start_hour = start_hour
                duration_hours = min(duration_hours, end_hour - start_hour)
                duration_minutes = int(duration_hours * 60)
            
            # Generate start time
            start_hour = random.randint(start_hour, max_start_hour)
            start_minute = random.randint(0, 59)
            
            # Calculate end time
            total_minutes = start_hour * 60 + start_minute + duration_minutes
            end_hour = total_minutes // 60
            end_minute = total_minutes % 60
            
            # Ensure end time doesn't exceed 23:59
            if end_hour > 23:
                end_hour = 23
                end_minute = 59
        
        return time(start_hour, start_minute), time(end_hour, end_minute)
    
    def generate_daily_schedule(self) -> Dict:
        """Generate a complete daily schedule with rest time allocation"""
        server_region = self.get_server_region()
        timezone_name = self.get_timezone(server_region)
        timezone = pytz.timezone(timezone_name)
        
        # Get current time in server timezone
        now = datetime.now(timezone)
        today = now.date()
        
        # Get maximum rest duration
        max_rest_duration = self.get_rest_duration_max()
        
        # Define rest periods and their time ranges
        rest_periods = [
            {"name": "sleep", "start_hour": 22, "end_hour": 8, "min_duration": 4.0, "max_duration": 6.0},
            {"name": "breakfast", "start_hour": 7, "end_hour": 9, "min_duration": 0.5, "max_duration": 1.0},
            {"name": "lunch", "start_hour": 12, "end_hour": 14, "min_duration": 0.5, "max_duration": 1.0},
            {"name": "dinner", "start_hour": 18, "end_hour": 20, "min_duration": 0.5, "max_duration": 1.0},
            {"name": "morning_break", "start_hour": 10, "end_hour": 11, "min_duration": 0.25, "max_duration": 0.75},
            {"name": "afternoon_break", "start_hour": 15, "end_hour": 16, "min_duration": 0.25, "max_duration": 0.75},
            {"name": "evening_break", "start_hour": 21, "end_hour": 22, "min_duration": 0.25, "max_duration": 0.75}
        ]
        
        # Calculate total minimum rest time needed
        total_min_rest = sum(period["min_duration"] for period in rest_periods)
        
        # If minimum exceeds max, adjust max
        if total_min_rest > max_rest_duration:
            max_rest_duration = total_min_rest
        
        # Allocate rest time randomly
        remaining_rest_time = max_rest_duration
        allocated_periods = []
        
        # First, allocate minimum time to each period
        for period in rest_periods:
            min_time = period["min_duration"]
            allocated_periods.append({
                "name": period["name"],
                "duration": min_time,
                "start_hour": period["start_hour"],
                "end_hour": period["end_hour"]
            })
            remaining_rest_time -= min_time
        
        # Then distribute remaining time randomly
        while remaining_rest_time > 0 and len(allocated_periods) > 0:
            # Pick a random period to add time to
            period_idx = random.randint(0, len(allocated_periods) - 1)
            period = allocated_periods[period_idx]
            
            # Find the original period definition
            original_period = next(p for p in rest_periods if p["name"] == period["name"])
            max_additional = original_period["max_duration"] - period["duration"]
            
            # Add random amount of time (up to 0.5 hours at a time)
            additional_time = min(random.uniform(0.1, 0.5), max_additional, remaining_rest_time)
            
            if additional_time > 0:
                period["duration"] += additional_time
                remaining_rest_time -= additional_time
            else:
                # Remove this period from consideration if it can't take more time
                allocated_periods.pop(period_idx)
        
        # Generate actual time slots
        schedule_periods = {}
        for period in allocated_periods:
            duration_hours = period["duration"]
            start_time, end_time = self.generate_time_range(
                period["start_hour"], 
                period["end_hour"], 
                duration_hours
            )
            
            schedule_periods[period["name"]] = {
                "start": start_time.strftime("%H:%M"),
                "end": end_time.strftime("%H:%M"),
                "duration_hours": round(duration_hours, 2),
                "description": self.get_period_description(period["name"])
            }
        
        # Create schedule
        schedule = {
            "date": today.isoformat(),
            "server_region": server_region,
            "timezone": timezone_name,
            "generated_at": now.isoformat(),
            "total_rest_duration": round(max_rest_duration, 2),
            "schedule": schedule_periods
        }
        
        return schedule
    
    def get_period_description(self, period_name: str) -> str:
        """Get description for a period"""
        descriptions = {
            "sleep": "Night rest period",
            "breakfast": "Breakfast time",
            "lunch": "Lunch time", 
            "dinner": "Dinner time",
            "morning_break": "Morning break",
            "afternoon_break": "Afternoon break",
            "evening_break": "Evening break"
        }
        return descriptions.get(period_name, "Rest period")
    
    def get_current_status(self, check_time: Optional[datetime] = None) -> Dict:
        """Get current status and remaining time based on schedule"""
        # Get schedule (use cached version if available)
        schedule = self._get_cached_schedule()
        if not schedule:
            return {
                "status": "unknown",
                "period_name": "unknown",
                "remaining_minutes": 0,
                "total_duration_minutes": 0,
                "elapsed_minutes": 0,
                "description": "No schedule available"
            }
        
        # Use provided time or current time
        if check_time is None:
            server_region = self.get_server_region()
            timezone_name = self.get_timezone(server_region)
            timezone = pytz.timezone(timezone_name)
            check_time = datetime.now(timezone)
        
        current_time = check_time.time()
        schedule_periods = schedule.get('schedule', {})
        
        # Check each period to see if current time falls within it
        for period_name, period_data in schedule_periods.items():
            start_str = period_data.get('start', '00:00')
            end_str = period_data.get('end', '23:59')
            
            try:
                start_time = datetime.strptime(start_str, '%H:%M').time()
                end_time = datetime.strptime(end_str, '%H:%M').time()
                
                # Handle overnight periods
                if start_time > end_time:
                    # Overnight period (e.g., 22:00 to 08:00)
                    if current_time >= start_time or current_time <= end_time:
                        status = self._calculate_period_status(
                            period_name, period_data, current_time, 
                            start_time, end_time, True
                        )
                        # Only return if there's remaining time
                        if status.get('remaining_minutes', 0) > 0:
                            return status
                else:
                    # Same day period
                    if start_time <= current_time <= end_time:
                        status = self._calculate_period_status(
                            period_name, period_data, current_time, 
                            start_time, end_time, False
                        )
                        # Only return if there's remaining time
                        if status.get('remaining_minutes', 0) > 0:
                            return status
                        
            except ValueError as e:
                print(f"Error parsing time for period {period_name}: {e}")
                continue
        
        # If not in any rest period or all rest periods are completed, assume work/play time
        return {
            "status": "work_play",
            "period_name": "work_play",
            "remaining_minutes": 0,
            "total_duration_minutes": 0,
            "elapsed_minutes": 0,
            "description": "Work/Play time",
            "is_rest_period": False
        }
    
    def _calculate_period_status(self, period_name: str, period_data: Dict, 
                               current_time: time, start_time: time, 
                               end_time: time, is_overnight: bool) -> Dict:
        """Calculate detailed status for a specific period"""
        # Calculate total duration in minutes
        total_duration_hours = period_data.get('duration_hours', 0)
        total_duration_minutes = int(total_duration_hours * 60)
        
        # Calculate elapsed time
        if is_overnight:
            # For overnight periods, calculate elapsed time differently
            if current_time >= start_time:
                # After start time on same day
                elapsed_minutes = (current_time.hour - start_time.hour) * 60 + (current_time.minute - start_time.minute)
            else:
                # Before start time, elapsed from previous day
                elapsed_minutes = (24 - start_time.hour + current_time.hour) * 60 + (current_time.minute - start_time.minute)
        else:
            # Same day period
            elapsed_minutes = (current_time.hour - start_time.hour) * 60 + (current_time.minute - start_time.minute)
        
        # Ensure elapsed time is within bounds
        elapsed_minutes = max(0, min(elapsed_minutes, total_duration_minutes))
        remaining_minutes = max(0, total_duration_minutes - elapsed_minutes)
        
        # Determine status based on period type
        if period_name == "sleep":
            status = "sleep"
        elif period_name in ["breakfast", "lunch", "dinner"]:
            status = "meal"
        else:
            status = "rest"
        
        return {
            "status": status,
            "period_name": period_name,
            "remaining_minutes": remaining_minutes,
            "total_duration_minutes": total_duration_minutes,
            "elapsed_minutes": elapsed_minutes,
            "description": period_data.get('description', 'Rest period'),
            "is_rest_period": True,
            "start_time": start_time.strftime('%H:%M'),
            "end_time": end_time.strftime('%H:%M'),
            "progress_percentage": round((elapsed_minutes / total_duration_minutes * 100) if total_duration_minutes > 0 else 0, 1)
        }
    
    def is_schedule_valid(self, schedule: Dict) -> bool:
        """Check if schedule is valid for today or tomorrow"""
        if not schedule:
            return False
        
        try:
            schedule_date = datetime.fromisoformat(schedule.get('date', '')).date()
            today = datetime.now().date()
            tomorrow = today + timedelta(days=1)
            return schedule_date == today or schedule_date == tomorrow
        except:
            return False
    
    def load_existing_schedule(self) -> Optional[Dict]:
        """Load existing schedule from file"""
        try:
            if os.path.exists(self.schedule_file):
                with open(self.schedule_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading schedule: {e}")
        return None
    
    def save_schedule(self, schedule: Dict):
        """Save schedule to file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.schedule_file), exist_ok=True)
            
            with open(self.schedule_file, 'w', encoding='utf-8') as f:
                json.dump(schedule, f, indent=2, ensure_ascii=False)
            print(f"Schedule saved to: {self.schedule_file}")
        except Exception as e:
            print(f"Error saving schedule: {e}")
    
    def get_or_generate_schedule(self) -> Dict:
        """Get existing schedule or generate new one"""
        # Check if debug mode is enabled
        if self.is_debug_mode():
            print("DEBUG MODE: Always generating new schedule for testing randomness")
            new_schedule = self.generate_daily_schedule()
            self.save_schedule(new_schedule)
            # Update cache
            self._cached_schedule = new_schedule
            self._schedule_cache_date = datetime.now().date()
            return new_schedule
        
        # Try to use cached schedule first
        cached_schedule = self._get_cached_schedule()
        if cached_schedule:
            return cached_schedule
        
        # Try to load existing schedule
        existing_schedule = self.load_existing_schedule()
        
        # Check if existing schedule is valid for today
        if self.is_schedule_valid(existing_schedule):
            print("Using existing schedule for today")
            # Update cache
            self._cached_schedule = existing_schedule
            self._schedule_cache_date = datetime.now().date()
            return existing_schedule
        
        # Generate new schedule
        print("Generating new daily schedule...")
        new_schedule = self.generate_daily_schedule()
        self.save_schedule(new_schedule)
        # Update cache
        self._cached_schedule = new_schedule
        self._schedule_cache_date = datetime.now().date()
        return new_schedule
    
    def print_schedule(self, schedule: Dict):
        """Print schedule in a readable format"""
        if not schedule:
            print("No schedule available")
            return
        
        print(f"\n=== Daily Schedule ({schedule.get('date', 'Unknown')}) ===")
        print(f"Server Region: {schedule.get('server_region', 'Unknown')}")
        print(f"Timezone: {schedule.get('timezone', 'Unknown')}")
        print(f"Total Rest Duration: {schedule.get('total_rest_duration', 0)} hours")
        
        sched = schedule.get('schedule', {})
        
        # Group periods by type
        sleep_periods = []
        meal_periods = []
        break_periods = []
        
        for period_name, period_data in sched.items():
            if period_name == "sleep":
                sleep_periods.append((period_name, period_data))
            elif period_name in ["breakfast", "lunch", "dinner"]:
                meal_periods.append((period_name, period_data))
            else:
                break_periods.append((period_name, period_data))
        
        # Print sleep periods
        if sleep_periods:
            print(f"\n🌙 Sleep Periods:")
            for period_name, period_data in sleep_periods:
                duration = period_data.get('duration_hours', 0)
                print(f"   {period_name.title()}: {period_data.get('start', '--')} - {period_data.get('end', '--')} ({duration}h)")
        
        # Print meal periods
        if meal_periods:
            print(f"\n🍽️  Meal Periods:")
            for period_name, period_data in meal_periods:
                duration = period_data.get('duration_hours', 0)
                print(f"   {period_name.title()}: {period_data.get('start', '--')} - {period_data.get('end', '--')} ({duration}h)")
        
        # Print break periods
        if break_periods:
            print(f"\n☕ Break Periods:")
            for period_name, period_data in break_periods:
                duration = period_data.get('duration_hours', 0)
                print(f"   {period_name.replace('_', ' ').title()}: {period_data.get('start', '--')} - {period_data.get('end', '--')} ({duration}h)")
        
        print("\n" + "="*50)
    
    def print_current_status(self, check_time: Optional[datetime] = None):
        """Print current status in a readable format"""
        status = self.get_current_status(check_time)
        
        print(f"\n=== Current Status ===")
        print(f"Status: {status['status'].upper()}")
        print(f"Period: {status['period_name'].replace('_', ' ').title()}")
        print(f"Description: {status['description']}")
        
        if status['is_rest_period']:
            print(f"Time Range: {status['start_time']} - {status['end_time']}")
            print(f"Progress: {status['progress_percentage']}%")
            print(f"Elapsed: {status['elapsed_minutes']} minutes")
            print(f"Remaining: {status['remaining_minutes']} minutes")
            print(f"Total Duration: {status['total_duration_minutes']} minutes")
        else:
            print(f"Currently in work/play mode")
        
        print("="*30)


def test_random_times():
    """Test status checking with random times"""
    import random
    import time
    
    generator = DailyScheduleGenerator()
    
    print("🎲 随机时间状态测试")
    print("="*50)
    
    # Temporarily disable debug mode for testing
    original_debug = CONFIG.get('daily_schedule', {}).get('debug', False)
    CONFIG['daily_schedule']['debug'] = False
    
    for i in range(5):  # Test 5 random times
        # Generate random time for today
        hour = random.randint(0, 23)
        minute = random.randint(0, 59)
        test_time = datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        print(f"\n--- 测试 #{i+1} ---")
        print(f"🕐 随机时间: {test_time.strftime('%H:%M:%S')}")
        
        # Get status for this time
        status = generator.get_current_status(test_time)
        
        # Print status
        generator.print_current_status(test_time)
        
        time.sleep(1)  # Wait 1 second between tests
    
    # Restore original debug setting
    CONFIG['daily_schedule']['debug'] = original_debug


def main():
    """Main function for testing"""
    generator = DailyScheduleGenerator()
    
    # Generate and print schedule
    schedule = generator.get_or_generate_schedule()
    generator.print_schedule(schedule)
    
    # Print current status
    generator.print_current_status()
    
    # Run random time test
    test_random_times()


if __name__ == "__main__":
    main() 