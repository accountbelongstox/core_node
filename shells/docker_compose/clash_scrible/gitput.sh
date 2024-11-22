#!/bin/bash

# Function to get the current timestamp
timestamp=$(date +"%Y-%m-%d@%H-%M-%S")

core_node_dir="$(dirname "$0")/core_node/"

color_text() {
    color_code=$1
    shift
    echo -e "\e[${color_code}m$@\e[0m"
}

color_text "32" "-------------------"
echo
color_text "31" "Submit_github"
echo
color_text "34" "-------------------"
echo
color_text "37;44" "-------------------"
echo
color_text "32" "$timestamp"
echo
color_text "33" "-------------------"
echo

process_directory() {
    current_dir=$(pwd)
    echo
    color_text "32" "Entering--"
    echo "$current_dir"
    color_text "32" "--------------------------------"
    echo

    # Verify if the 'main' branch exists, if not, create it
    if ! git branch -r | grep -q "origin/main"; then
        color_text "31" "Branch 'main' does not exist. Creating 'main' branch..."
        echo
        git checkout -b main
        git push --set-upstream origin main
        git branch --set-upstream-to=origin/main main
        git pull origin main
        echo
    fi

    git remote -v
    color_text "32" "--------------------------------"
    echo
    echo
    echo
    color_text "37;44" "----------------------------------------------------------------"
    echo


    # Commands to commit and push changes
    git add .
    git commit -m "$timestamp"
    git pull
    git add .
    git commit -m "$timestamp"
    git push --set-upstream origin main
    echo
    color_text "37;44" "----------------------------------------------------------------"
    echo
    echo

    # Process core_node directory if it exists
    if [ -d "$core_node_dir" ]; then
        cd "$core_node_dir"
        process_directory
    fi
}

process_directory

# Set permissions for all .sh files in the same directory and all subdirectories
find "$(dirname "$0")" -type f -name "*.sh" -exec chmod 777 {} \;

color_text "32" "Set permissions to 777 for all .sh files in the directory and subdirectories."