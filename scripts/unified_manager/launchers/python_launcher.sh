#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Python Framework Launcher
# Launches standalone Python applications

# Variable Declarations
APP_PATH="$1"
APP_NAME="$2"
ACTION="${3:-start}"

# Check parameters
if [ -z "$APP_PATH" ] || [ -z "$APP_NAME" ]; then
    echo "Usage: $0 <app_path> <app_name> [action]"
    exit 1
fi

# Check if app directory exists
if [ ! -d "$APP_PATH" ]; then
    echo "ERROR: App directory not found: $APP_PATH"
    exit 1
fi

# Check for Python files
MAIN_PY="$APP_PATH/main.py"

if [ ! -f "$MAIN_PY" ]; then
    echo "ERROR: main.py not found in: $APP_PATH"
    exit 1
fi

echo "=== Python Framework Launcher ==="
echo "App: $APP_NAME"
echo "Path: $APP_PATH"
echo "Action: $ACTION"
echo ""

# Change to app directory
cd "$APP_PATH"

case "$ACTION" in
    "install")
        echo "Installing Python dependencies..."
        if [ -f "requirements.txt" ]; then
            pip install -r requirements.txt
        elif [ -f "pyproject.toml" ]; then
            pip install -e .
        elif [ -f "setup.py" ]; then
            pip install -e .
        else
            echo "No requirements.txt, pyproject.toml, or setup.py found"
        fi
        ;;
    "start"|"run")
        echo "Running Python application..."
        python main.py
        ;;
    "dev")
        echo "Running Python application in development mode..."
        if [ -f "requirements-dev.txt" ]; then
            pip install --upgrade -r requirements-dev.txt
        fi
        python main.py
        ;;
    "test")
        echo "Running Python tests..."
        if [ -d "tests" ]; then
            if command -v pytest &> /dev/null; then
                pytest tests/
            else
                python -m unittest discover tests
            fi
        elif [ -f "test_*.py" ] || [ -f "*_test.py" ]; then
            if command -v pytest &> /dev/null; then
                pytest
            else
                python -m unittest discover
            fi
        else
            echo "No tests found"
        fi
        ;;
    "lint")
        echo "Linting Python code..."
        if command -v flake8 &> /dev/null; then
            flake8 .
        elif command -v pylint &> /dev/null; then
            pylint *.py
        else
            echo "No linter found (install flake8 or pylint)"
        fi
        ;;
    "format")
        echo "Formatting Python code..."
        if command -v black &> /dev/null; then
            black .
        else
            echo "Black formatter not found (pip install black)"
        fi
        ;;
    "clean")
        echo "Cleaning Python project..."
        find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
        find . -name "*.pyc" -delete 2>/dev/null
        find . -name "*.pyo" -delete 2>/dev/null
        find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null
        echo "Python cache files cleaned"
        ;;
    *)
        echo "Unknown action: $ACTION"
        echo "Available actions: install, start, run, dev, test, lint, format, clean"
        exit 1
        ;;
esac

echo ""
echo "Python launcher finished."