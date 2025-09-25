import os
import shutil
import sys

def move_metadata_directories():
    """
    Access ../../public from script directory, move metadata directories from each subdirectory to ../../config/matedata/$sub
    """
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Set paths
    public_dir = os.path.join(script_dir, "..", "..", "public")  # ../../public
    config_metadata_dir = os.path.join(script_dir, "..", "..", "config", "matedata")  # ../../config/matedata
    
    # Convert to absolute paths
    public_dir = os.path.abspath(public_dir)
    config_metadata_dir = os.path.abspath(config_metadata_dir)
    
    print("=== Metadata Move Configuration ===")
    print(f"Script location: {script_dir}")
    print(f"Public directory: {public_dir}")
    print(f"Target directory: {config_metadata_dir}")
    print()
    
    # Check if public directory exists
    if not os.path.isdir(public_dir):
        print(f"Error: Public directory not found '{public_dir}'")
        return
    
    # Get all subdirectories in public directory
    try:
        subdirs = [d for d in os.listdir(public_dir) 
                  if os.path.isdir(os.path.join(public_dir, d))]
    except Exception as e:
        print(f"Error reading public directory: {e}")
        return
    
    if not subdirs:
        print("No subdirectories found in public directory")
        return
    
    print(f"Found {len(subdirs)} subdirectories: {', '.join(subdirs)}")
    print()
    
    # Analyze what will be moved
    print("=== Move Plan ===")
    move_plan = []
    skipped_plan = []
    
    for subdir in subdirs:
        source_metadata = os.path.join(public_dir, subdir, "metadata")
        target_metadata = os.path.join(config_metadata_dir, subdir)
        
        if os.path.isdir(source_metadata):
            move_plan.append({
                'subdir': subdir,
                'source': source_metadata,
                'target': target_metadata,
                'exists': os.path.exists(target_metadata)
            })
        else:
            skipped_plan.append({
                'subdir': subdir,
                'reason': 'metadata directory not found'
            })
    
    # Print move plan
    if move_plan:
        print("Directories to be moved:")
        for item in move_plan:
            print(f"  {item['subdir']}:")
            print(f"    From: {item['source']}")
            print(f"    To:   {item['target']}")
            if item['exists']:
                print(f"    Warning: Target already exists, will be overwritten")
            print()
    
    if skipped_plan:
        print("Directories to be skipped:")
        for item in skipped_plan:
            print(f"  {item['subdir']}: {item['reason']}")
        print()
    
    if not move_plan:
        print("No metadata directories found to move.")
        return
    
    # Get user confirmation
    print(f"Total directories to move: {len(move_plan)}")
    response = input("Press 'y' to continue with move operation, any other key to cancel: ")
    if response.lower() != 'y':
        print("Operation cancelled by user.")
        return
    
    # Create target directory
    try:
        os.makedirs(config_metadata_dir, exist_ok=True)
        print(f"Created target directory: {config_metadata_dir}")
    except Exception as e:
        print(f"Error creating target directory: {e}")
        return
    
    # Execute move operations
    print("\n=== Executing Move Operations ===")
    moved_count = 0
    error_count = 0
    
    for item in move_plan:
        print(f"Moving {item['subdir']}...")
        
        # Check if target directory already exists and remove it
        if item['exists']:
            try:
                shutil.rmtree(item['target'])
                print(f"  Removed existing target directory")
            except Exception as e:
                print(f"  Error removing existing target directory: {e}")
                error_count += 1
                continue
        
        # Move directory
        try:
            shutil.move(item['source'], item['target'])
            print(f"  Success: Moved metadata directory")
            moved_count += 1
        except Exception as e:
            print(f"  Error: Move failed: {e}")
            error_count += 1
            continue
        
        print()
    
    # Print summary
    print("=== Operation Complete ===")
    print(f"Successfully moved: {moved_count} directories")
    print(f"Errors: {error_count} directories")
    print(f"Skipped: {len(skipped_plan)} directories")
    print(f"Total processed: {len(subdirs)} subdirectories")

if __name__ == "__main__":
    move_metadata_directories()
