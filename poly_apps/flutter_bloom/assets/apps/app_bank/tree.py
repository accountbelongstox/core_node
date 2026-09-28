import os

def generate_tree_lines(root_dir, prefix=""):
    """
    Generates the lines for a visual tree structure of a directory.
    """
    lines = []
    if not prefix:
        # Add the absolute path of the root directory only once at the beginning.
        lines.append(f"Absolute path: {os.path.abspath(root_dir)}")
        # Add the root directory name itself to start the tree.
        lines.append(f"{os.path.basename(root_dir)}/")
    
    try:
        # Get a sorted list of entries in the directory.
        entries = sorted(os.listdir(root_dir))
    except OSError:
        # If the directory can't be accessed, return empty list.
        return []
        
    for i, entry in enumerate(entries):
        # Determine if this is the last entry in the list to use the correct connector.
        is_last = i == (len(entries) - 1)
        connector = "└── " if is_last else "├── "
        
        # Get the full path of the entry.
        path = os.path.join(root_dir, entry)
        
        # Add the entry to the list of lines.
        lines.append(prefix + connector + entry)
        
        # If the entry is a directory, recurse into it and extend the lines.
        if os.path.isdir(path):
            extension = "    " if is_last else "│   "
            lines.extend(generate_tree_lines(path, prefix=prefix + extension))
    return lines

if __name__ == "__main__":
    # Start the process from the current working directory.
    start_directory = "."
    
    # Generate the tree structure as a list of strings.
    tree_output_lines = generate_tree_lines(start_directory)
    
    # Prepare the content for the Markdown file.
    markdown_content = "# Directory Tree\n\n```\n" + "\n".join(tree_output_lines) + "\n```\n"
    
    # Define the output filename.
    output_filename = "directory_tree.md"
    
    # Write the content to the Markdown file.
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write(markdown_content)
        
    print(f"Successfully generated '{output_filename}'.")