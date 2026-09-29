@echo off
setlocal

rem Set the version number (you can change it as needed)
set "version=1.0.0"

rem Check if Go is installed
go version >nul 2>&1
if errorlevel 1 (
    echo "Go is not installed. Please install Go to compile the project: https://golang.org/dl/"
)

rem Check if the 'sub2clash' subdirectory exists
if exist "sub2clash" (
    echo "The 'sub2clash' directory exists, checking if it's empty..."
    
    rem Check if the 'sub2clash' directory is empty
    dir "sub2clash" /b | findstr /r "^" >nul
    if errorlevel 1 (
        echo "'sub2clash' directory is empty, deleting it..."
        rmdir /s /q "sub2clash"
    )
)

rem Check again if the 'sub2clash' directory exists
if not exist "sub2clash" (
    echo "'sub2clash' directory does not exist, cloning the repository..."
    git clone https://github.com/nitezs/sub2clash.git
)

rem Check again if the 'sub2clash' directory exists after cloning
if exist "sub2clash" (
    cd "sub2clash"
    
    rem Check if 'sub2clash.exe' exists
    if not exist "sub2clash.exe" (
        echo "'sub2clash.exe' does not exist, starting the build process..."
        
        rem Try to compile the Go project
        go build -ldflags="-s -w -X sub2clash/constant.Version=%version%" -o sub2clash.exe
        
        rem Check if 'sub2clash.exe' was successfully created
        if exist "sub2clash.exe" (
            echo "'sub2clash.exe' was successfully created, launching the program..."
            start sub2clash.exe
        ) else (
            echo "Build failed: 'sub2clash.exe' does not exist. Please check your Go environment and code..."
        )
    ) else (
        echo "'sub2clash.exe' already exists, launching the program..."
        start sub2clash.exe
    )
    
    cd ..
) else (
    echo "'sub2clash' directory does not exist, clone operation might have failed."
)

rem Go back to the initial directory and run 'yarn start'
echo "Returning to the initial directory to run 'yarn start'..."
cd "%~dp0"
yarn start

endlocal
pause
