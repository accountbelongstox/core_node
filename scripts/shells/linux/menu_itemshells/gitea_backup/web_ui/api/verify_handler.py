# Backup Verification Handler
# Handles backup file verification logic

import os
import tarfile
import zipfile

def verify_backup_file(backup_path):
    """Verify backup file integrity"""
    if not os.path.exists(backup_path):
        return {
            'valid': False,
            'format': None,
            'message': 'Backup file not found'
        }
    
    extension = os.path.splitext(backup_path)[1]
    
    if extension == '.gz' or backup_path.endswith('.tar.gz'):
        return verify_tar_gz(backup_path)
    elif extension == '.zip':
        return verify_zip(backup_path)
    else:
        return {
            'valid': False,
            'format': 'unknown',
            'message': f'Unknown backup format: {extension}'
        }

def verify_tar_gz(backup_path):
    """Verify tar.gz archive"""
    try:
        with tarfile.open(backup_path, 'r:gz') as tar:
            tar.getmembers()
            return {
                'valid': True,
                'format': 'tar.gz',
                'message': 'Archive is valid and can be extracted',
                'file_count': len(tar.getmembers())
            }
    except tarfile.TarError as e:
        return {
            'valid': False,
            'format': 'tar.gz',
            'message': f'Archive is corrupted: {str(e)}'
        }
    except Exception as e:
        return {
            'valid': False,
            'format': 'tar.gz',
            'message': f'Error verifying archive: {str(e)}'
        }

def verify_zip(backup_path):
    """Verify zip archive"""
    try:
        with zipfile.ZipFile(backup_path, 'r') as zip_file:
            zip_file.testzip()
            return {
                'valid': True,
                'format': 'zip',
                'message': 'Archive is valid and can be extracted',
                'file_count': len(zip_file.namelist())
            }
    except zipfile.BadZipFile as e:
        return {
            'valid': False,
            'format': 'zip',
            'message': f'Archive is corrupted: {str(e)}'
        }
    except Exception as e:
        return {
            'valid': False,
            'format': 'zip',
            'message': f'Error verifying archive: {str(e)}'
        }

