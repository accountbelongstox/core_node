#!/bin/bash

# Set the version number (you can change it as needed)
version="1.0.0"

# Check if Go is installed
if ! command -v go &> /dev/null
then
    echo "Go is not installed. Please install Go to compile the project: https://golang.org/dl/"
fi

# Check if the 'sub2clash' subdirectory exists
if [ -d "sub2clash" ]; then
    echo "The 'sub2clash' directory exists, checking if it's empty..."
    
    # Check if the 'sub2clash' directory is empty
    if [ -z "$(ls -A sub2clash)" ]; then
        echo "'sub2clash' directory is empty, deleting it..."
        rm -rf "sub2clash"
    fi
fi

# Check again if the 'sub2clash' directory exists
if [ ! -d "sub2clash" ]; then
    echo "'sub2clash' directory does not exist, cloning the repository..."
    git clone https://github.com/nitezs/sub2clash.git
fi

# Check again if the 'sub2clash' directory exists after cloning
if [ -d "sub2clash" ]; then
    cd "sub2clash"
    
    # Check if the 'sub2clash' executable exists
    if [ ! -f "sub2clash" ]; then
        echo "'sub2clash' executable does not exist, starting the build process..."
        
        # Try to compile the Go project
        go build -ldflags="-s -w -X sub2clash/constant.Version=${version}" -o sub2clash
        
        # Check if 'sub2clash' was successfully created
        if [ -f "sub2clash" ]; then
            echo "'sub2clash' was successfully created, launching the program..."
            ./sub2clash &
        else
            echo "Build failed: 'sub2clash' does not exist. Please check your Go environment and code..."
        fi
    else
        echo "'sub2clash' already exists, launching the program..."
        ./sub2clash &
    fi
    
    cd ..
else
    echo "'sub2clash' directory does not exist, clone operation might have failed."
fi

# Go back to the initial directory and run 'yarn start'
echo "Returning to the initial directory to run 'yarn start'..."
yarn start
