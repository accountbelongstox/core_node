
# Game State Management
class GameState:
    def __init__(self):
        self.mapstatus = "normal"  # "normal", "rift", "gem_upgrade", "paused", "inactive", "loop"
        self.previous_status = "normal"  # Store previous status for resume
        self.pause_time = 0.0  # Time when pause was triggered
        self.pause_duration = 120.0  # Pause duration in seconds
        self.last_rift_timer = 0.0
        self.gem_upgrade_count = 0
        self.gem_upgrade_max = 0
        self.last_gem_action = 0.0
        self.last_activity_time = 0.0  # Last activity timestamp
        self.inactive_timeout = 600.0  # 10 minutes timeout for inactive state
        self.loop_start_time = 0.0  # Time when loop state was activated
        self.loop_timeout = CONFIG.get('global_timeout', {}).get('loop_timeout_seconds', 60.0)  # Loop timeout in seconds
    
    def reset_gem_upgrade(self):
        """Reset gem upgrade state"""
        self.gem_upgrade_count = 0
        self.gem_upgrade_max = CONFIG.get('map_status', {}).get('gem_upgrade_action_count', 3)
        self.last_gem_action = 0.0
    
    def is_gem_upgrade_complete(self) -> bool:
        """Check if gem upgrade is complete"""
        return self.gem_upgrade_count >= self.gem_upgrade_max
    
    def pause(self, current_time: float):
        """Pause current state with timestamp"""
        if self.mapstatus != "paused":
            self.previous_status = self.mapstatus
            self.mapstatus = "paused"
            self.pause_time = current_time
    
    def resume(self):
        """Resume to previous state"""
        if self.mapstatus == "paused":
            self.mapstatus = self.previous_status
            self.pause_time = 0.0
    
    def should_resume(self, current_time: float) -> bool:
        """Check if pause duration has elapsed"""
        return (self.mapstatus == "paused" and 
                self.pause_time > 0 and 
                current_time - self.pause_time >= self.pause_duration)
    
    def activate_loop_state(self, current_time: float):
        """Activate loop state with timestamp"""
        if self.mapstatus != "loop":
            self.previous_status = self.mapstatus
            self.mapstatus = "loop"
            self.loop_start_time = current_time
            print(f"[MAP STATUS] Activated LOOP state")
    
    def deactivate_loop_state(self):
        """Deactivate loop state and return to previous state"""
        if self.mapstatus == "loop":
            self.mapstatus = self.previous_status
            self.loop_start_time = 0.0
            print(f"[MAP STATUS] Deactivated LOOP state, returned to {self.mapstatus}")
    
    def is_loop_timeout(self, current_time: float) -> bool:
        """Check if loop state has timed out"""
        return (self.mapstatus == "loop" and 
                self.loop_start_time > 0 and 
                current_time - self.loop_start_time >= self.loop_timeout)
    
    def update_activity_time(self, current_time: float):
        """Update last activity time and reactivate if inactive"""
        self.last_activity_time = current_time
        if self.mapstatus == "inactive":
            self.mapstatus = "normal"
            print(f"[MAP STATUS] Reactivated from INACTIVE to NORMAL mode")
    
    def check_inactive_timeout(self, current_time: float) -> bool:
        """Check if should transition to inactive state"""
        if (self.last_activity_time > 0 and 
            current_time - self.last_activity_time >= self.inactive_timeout):
            if self.mapstatus != "inactive":
                self.previous_status = self.mapstatus
                self.mapstatus = "inactive"
                print(f"[MAP STATUS] Transitioned to INACTIVE mode after {self.inactive_timeout}s timeout")
            return True
        return False

# Global game state instance
GAME_STATE = GameState()
