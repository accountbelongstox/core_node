# Statistics Handler
# Calculates backup statistics

import os

def calculate_statistics(backup_base_dir):
    """Calculate backup statistics"""
    stats = {
        'total_backups': 0,
        'total_size': 0,
        'namespaces': {}
    }
    
    if not os.path.exists(backup_base_dir):
        return stats
    
    for namespace in os.listdir(backup_base_dir):
        namespace_path = os.path.join(backup_base_dir, namespace)
        if not os.path.isdir(namespace_path):
            continue
        
        namespace_stats = {
            'count': 0,
            'size': 0
        }
        
        for file in os.listdir(namespace_path):
            file_path = os.path.join(namespace_path, file)
            if os.path.isfile(file_path) and (file.endswith('.zip') or file.endswith('.tar.gz')):
                namespace_stats['count'] += 1
                namespace_stats['size'] += os.path.getsize(file_path)
        
        if namespace_stats['count'] > 0:
            stats['namespaces'][namespace] = namespace_stats
            stats['total_backups'] += namespace_stats['count']
            stats['total_size'] += namespace_stats['size']
    
    return stats

