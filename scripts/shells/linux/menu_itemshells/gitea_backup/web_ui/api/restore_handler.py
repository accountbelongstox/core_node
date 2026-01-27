# Restore Handler
# Handles backup restoration logic

import os
import subprocess
import sys

def restore_backup(backup_path, namespace, backup_base_dir):
    """Restore backup based on namespace"""
    if not os.path.exists(backup_path):
        return {
            'success': False,
            'message': 'Backup file not found'
        }
    
    try:
        # Get script directory
        script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        if namespace == 'gitea':
            return restore_gitea(backup_path, script_dir)
        elif namespace == 'laravel':
            return restore_laravel(backup_path, script_dir)
        else:
            return {
                'success': False,
                'message': f'Unknown namespace: {namespace}'
            }
    except Exception as e:
        return {
            'success': False,
            'message': f'Restore failed: {str(e)}'
        }

def restore_gitea(backup_path, script_dir):
    """Restore Gitea backup by calling shell script"""
    restore_script = os.path.join(script_dir, 'restore_gitea_core.sh')
    
    if not os.path.exists(restore_script):
        return {
            'success': False,
            'message': 'Gitea restore script not found'
        }
    
    try:
        # Call the restore function via bash
        # Note: This is a simplified approach - in production, you might want to use a more robust method
        result = subprocess.run(
            ['bash', '-c', f'source "{restore_script}" && restore_gitea "{backup_path}"'],
            capture_output=True,
            text=True,
            timeout=3600
        )
        
        if result.returncode == 0:
            return {
                'success': True,
                'message': 'Gitea restore completed successfully'
            }
        else:
            return {
                'success': False,
                'message': f'Restore failed: {result.stderr}'
            }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'message': 'Restore operation timed out'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Error during restore: {str(e)}'
        }

def restore_laravel(backup_path, script_dir):
    """Restore Laravel backup by calling shell script"""
    restore_script = os.path.join(script_dir, 'restore_laravel_core.sh')
    
    if not os.path.exists(restore_script):
        return {
            'success': False,
            'message': 'Laravel restore script not found'
        }
    
    try:
        # Call the restore function via bash
        result = subprocess.run(
            ['bash', '-c', f'source "{restore_script}" && restore_laravel "{backup_path}"'],
            capture_output=True,
            text=True,
            timeout=3600
        )
        
        if result.returncode == 0:
            return {
                'success': True,
                'message': 'Laravel restore completed successfully'
            }
        else:
            return {
                'success': False,
                'message': f'Restore failed: {result.stderr}'
            }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'message': 'Restore operation timed out'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Error during restore: {str(e)}'
        }

