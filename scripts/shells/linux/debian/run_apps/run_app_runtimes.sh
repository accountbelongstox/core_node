#!/bin/bash

# Function to run Vue development server
run_vue_debug() {
    local app_dir="$1"
    shift
    local args=("$@")  # Capture all remaining arguments
    local app_name=$(basename "$app_dir")
    
    log_info "Starting Vue development server for: $app_name"
    log_info "Project directory: $app_dir"
    
    # Change to app directory
    cd "$app_dir" || {
        log_error "Failed to change to directory: $app_dir"
        return 1
    }
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules not found. Installing dependencies with yarn..."
        
        # Check if yarn is available
        if command -v yarn >/dev/null 2>&1; then
            yarn install || {
                log_error "Failed to install dependencies with yarn"
                return 1
            }
        else
            log_warning "yarn not found. Using npm instead..."
            npm install || {
                log_error "Failed to install dependencies with npm"
                return 1
            }
        fi
        
        log_success "Dependencies installed successfully"
    fi
    
    # Try to start development server
    log_info "Starting development server..."
    
    # Check package.json for available scripts
    if [ -f "package.json" ]; then
        if grep -q "\"dev\":" package.json; then
            log_info "Running: yarn dev (or npm run dev)"
            if command -v yarn >/dev/null 2>&1; then
                yarn dev
            else
                npm run dev
            fi
        elif grep -q "\"serve\":" package.json; then
            log_info "Running: yarn serve (or npm run serve)"
            if command -v yarn >/dev/null 2>&1; then
                yarn serve
            else
                npm run serve
            fi
        elif grep -q "\"start\":" package.json; then
            log_info "Running: yarn start (or npm start)"
            if command -v yarn >/dev/null 2>&1; then
                yarn start
            else
                npm start
            fi
        else
            log_error "No suitable development script found in package.json"
            return 1
        fi
    else
        log_error "package.json not found"
        return 1
    fi
}

# Function to run Laravel application
run_laravel_app() {
    local app_dir="$1"
    shift
    local args=("$@")  # Capture all remaining arguments
    local app_name=$(basename "$app_dir")
    
    log_info "Starting Laravel application: $app_name"
    log_info "Project directory: $app_dir"
    
    # Change to app directory
    cd "$app_dir" || {
        log_error "Failed to change to directory: $app_dir"
        return 1
    }
    
    # Ensure vendor/ matches composer.lock and the autoloader actually loads
    ensure_composer_vendor "$app_dir"
    if [ "$COMPOSER_VENDOR_AUTOLOAD_OK" != "yes" ]; then
        log_error "Failed to install dependencies with composer"
        return 1
    fi
    log_success "Dependencies ready"

    # Configuration convention: Laravel apps in this repository do NOT use a
    # .env file - configuration is supplied by the app itself (laravel_main:
    # RuntimeConfigurationStore via RuntimeConfigurationServiceProvider).
    # Scripts never create, copy, or read .env files.
    
    # Try to start Laravel development server
    log_info "Starting Laravel development server..."
    log_info "Server will be available at: http://localhost:8000"
    
    if [ -f "artisan" ]; then
        php artisan serve
    else
        log_error "artisan file not found. This may not be a valid Laravel project."
        return 1
    fi
}

# Function to run Node.js application
run_nodejs_app() {
    local app_name="$1"
    shift
    local args=("$@")  # Capture all remaining arguments
    
    log_info "Starting Node.js application: $app_name"
    
    # Change to dd.sh directory
    cd "$DD_SH_DIR" || {
        log_error "Failed to change to directory: $DD_SH_DIR"
        return 1
    }
    
    log_info "Current working directory: $(pwd)"
    log_info "Running: node ./main.js app=$app_name ${args[*]}"
    
    # Check if main.js exists
    if [ ! -f "main.js" ]; then
        log_error "main.js not found in directory: $DD_SH_DIR"
        return 1
    fi
    
    # Run the Node.js application with arguments
    if [ ${#args[@]} -gt 0 ]; then
        node ./main.js "app=$app_name" "${args[@]}" || {
            log_error "Failed to start Node.js application: $app_name"
            return 1
        }
    else
        node ./main.js "app=$app_name" || {
            log_error "Failed to start Node.js application: $app_name"
            return 1
        }
    fi
}

# Function to run Flutter application
run_flutter_app() {
    local app_dir="$1"
    shift
    local args=("$@")  # Capture all remaining arguments
    local app_name=$(basename "$app_dir")
    
    log_info "Starting Flutter application: $app_name"
    log_info "Project directory: $app_dir"
    
    # Change to app directory
    cd "$app_dir" || {
        log_error "Failed to change to directory: $app_dir"
        return 1
    }
    
    # Check if Flutter is installed
    if ! command -v flutter >/dev/null 2>&1; then
        log_error "Flutter is not installed or not in PATH"
        log_info "Please install Flutter from https://flutter.dev/docs/get-started/install"
        return 1
    fi
    
    # Check if pubspec.yaml exists
    if [ ! -f "pubspec.yaml" ]; then
        log_error "pubspec.yaml not found. This may not be a valid Flutter project."
        return 1
    fi
    
    # Check if dependencies are installed
    if [ ! -d ".dart_tool" ] || [ ! -f "pubspec.lock" ]; then
        log_warning "Dependencies not found. Running flutter pub get..."
        flutter pub get || {
            log_error "Failed to get Flutter dependencies"
            return 1
        }
        log_success "Dependencies installed successfully"
    fi
    
    # Show available devices
    log_info "Checking available devices..."
    flutter devices
    
    echo ""
    echo "Select Flutter run mode:"
    echo "1. Run on available device (flutter run)"
    echo "2. Run on web browser (flutter run -d web)"
    echo "3. Run on Chrome (flutter run -d chrome)"
    echo "4. Run debug mode with hot reload (flutter run --debug)"
    echo "5. Run release mode (flutter run --release)"
    echo "0. Cancel"
    echo ""
    
    read -p "Enter your choice (0-5): " flutter_choice
    
    case $flutter_choice in
        1)
            log_info "Running Flutter app on available device..."
            flutter run
            ;;
        2)
            log_info "Running Flutter app on web..."
            flutter run -d web
            ;;
        3)
            log_info "Running Flutter app on Chrome..."
            flutter run -d chrome
            ;;
        4)
            log_info "Running Flutter app in debug mode..."
            flutter run --debug
            ;;
        5)
            log_info "Running Flutter app in release mode..."
            flutter run --release
            ;;
        0)
            log_info "Cancelled Flutter app launch"
            return 0
            ;;
        *)
            log_error "Invalid choice. Running default flutter run..."
            flutter run
            ;;
    esac
}

# Function to run poly app by showing script selection menu
run_poly_app() {
    local app_name="$1"
    shift
    local args=("$@")
    local app_dir="$POLY_APPS_DIR/$app_name"

    log_info "Starting Poly App: $app_name"
    log_info "Project directory: $app_dir"

    # Verify app exists
    if [ ! -d "$app_dir" ]; then
        log_error "Poly app directory not found: $app_dir"
        return 1
    fi

    # Find all .sh scripts in the directory
    local scripts=()
    while IFS= read -r -d '' script; do
        scripts+=("$script")
    done < <(find "$app_dir" -maxdepth 1 -name "*.sh" -type f -print0 2>/dev/null)

    if [ ${#scripts[@]} -eq 0 ]; then
        log_error "No .sh scripts found in $app_name directory"
        log_error "According to poly app rules, each poly app must have at least one .sh script"
        return 1
    fi

    # If only one script, run it directly
    if [ ${#scripts[@]} -eq 1 ]; then
        local script_name=$(basename "${scripts[0]}")
        log_info "Found single script: $script_name"
        log_info "Running: bash $script_name ${args[*]}"

        cd "$app_dir" || {
            log_error "Failed to change to directory: $app_dir"
            return 1
        }

        if [ ${#args[@]} -gt 0 ]; then
            bash "${scripts[0]}" "${args[@]}" || {
                log_error "Failed to run script: $script_name"
                return 1
            }
        else
            bash "${scripts[0]}" || {
                log_error "Failed to run script: $script_name"
                return 1
            }
        fi
        return 0
    fi

    # Multiple scripts - show selection menu
    local options=()
    for script in "${scripts[@]}"; do
        local script_name=$(basename "$script")
        options+=("$script_name")
    done
    options+=("Return to App Menu")
    options+=("Exit Program")

    local selected=0
    local total=${#options[@]}

    # Save current terminal settings
    local old_settings=$(stty -g)
    stty -icanon -echo

    trap 'stty "$old_settings"; exit' EXIT

    while true; do
        printf "\033c"
        log_info "Poly App Script Selection for: $app_name"
        echo "Use Up/Down arrows to navigate, Enter to select:"
        echo ""
        echo "Found ${#scripts[@]} script(s):"

        for i in "${!options[@]}"; do
            if [ "$i" -eq "$selected" ]; then
                printf "\033[47m\033[30m> %-50s\033[0m\n" "${options[$i]}"
            else
                printf "  %-50s\n" "${options[$i]}"
            fi
        done

        echo ""
        echo "Press Ctrl+C to force exit"

        local char
        char=$(dd bs=1 count=1 2>/dev/null)

        case "$char" in
            $'\x1B')
                read -r -t 0.1 -d '' seq
                case "$seq" in
                    '[A')
                        ((selected--))
                        [ "$selected" -lt 0 ] && selected=$((total - 1))
                        ;;
                    '[B')
                        ((selected++))
                        [ "$selected" -ge "$total" ] && selected=0
                        ;;
                esac
                ;;
            '')
                stty "$old_settings"

                if [ "$selected" -lt ${#scripts[@]} ]; then
                    local selected_script="${scripts[$selected]}"
                    local script_name=$(basename "$selected_script")
                    log_info "Selected script: $script_name"

                    cd "$app_dir" || {
                        log_error "Failed to change to directory: $app_dir"
                        return 1
                    }

                    log_info "Running: bash $script_name ${args[*]}"
                    if [ ${#args[@]} -gt 0 ]; then
                        bash "$selected_script" "${args[@]}" || {
                            log_error "Failed to run script: $script_name"
                            return 1
                        }
                    else
                        bash "$selected_script" || {
                            log_error "Failed to run script: $script_name"
                            return 1
                        }
                    fi
                    return 0
                elif [ "$selected" -eq ${#scripts[@]} ]; then
                    log_info "Returning to App Menu..."
                    return 1
                elif [ "$selected" -eq $((${#scripts[@]} + 1)) ]; then
                    log_info "Exiting program..."
                    exit 0
                fi

                stty -icanon -echo
                ;;
        esac
    done
}

# Function to run Python application
run_python_app() {
    local app_dir="$1"
    shift
    local args=("$@")  # Capture all remaining arguments
    local app_name=$(basename "$app_dir")
    
    log_info "Starting Python application: $app_name"
    log_info "Project directory: $app_dir"
    
    # Change to app directory
    cd "$app_dir" || {
        log_error "Failed to change to directory: $app_dir"
        return 1
    }
    
    # Check if Python is installed
    local python_cmd=""
    if command -v python3 >/dev/null 2>&1; then
        python_cmd="python3"
    elif command -v python >/dev/null 2>&1; then
        python_cmd="python"
    else
        log_error "Python is not installed or not in PATH"
        log_info "Please install Python from https://python.org"
        return 1
    fi
    
    log_info "Using Python command: $python_cmd"
    
    # Check if main.py exists
    if [ ! -f "main.py" ]; then
        log_error "main.py not found. This may not be a valid Python project."
        return 1
    fi
    
    # Check if requirements.txt exists and install dependencies
    if [ -f "requirements.txt" ]; then
        log_info "Found requirements.txt. Checking dependencies..."
        
        # Check if pip is available
        local pip_cmd=""
        if command -v pip3 >/dev/null 2>&1; then
            pip_cmd="pip3"
        elif command -v pip >/dev/null 2>&1; then
            pip_cmd="pip"
        else
            log_warning "pip not found. Dependencies may not be installed."
        fi
        
        if [ -n "$pip_cmd" ]; then
            log_info "Installing/updating dependencies..."
            $pip_cmd install -r requirements.txt || {
                log_warning "Failed to install some dependencies. Continuing anyway..."
            }
            log_success "Dependencies check completed"
        fi
    fi
    
    # Check if virtual environment should be used
    if [ -f "venv/bin/activate" ] || [ -f ".venv/bin/activate" ]; then
        log_info "Virtual environment detected. You may want to activate it manually:"
        if [ -f "venv/bin/activate" ]; then
            log_info "  source venv/bin/activate"
        else
            log_info "  source .venv/bin/activate"
        fi
        echo ""
        read -p "Do you want to continue without activating virtual environment? (y/N): " continue_choice
        if [[ ! "$continue_choice" =~ ^[Yy]$ ]]; then
            log_info "Please activate your virtual environment and run the application manually:"
            log_info "  $python_cmd main.py ${args[*]}"
            return 0
        fi
    fi
    
    # Run the Python application with arguments
    log_info "Running: $python_cmd main.py ${args[*]}"
    
    if [ ${#args[@]} -gt 0 ]; then
        "$python_cmd" main.py "${args[@]}" || {
            log_error "Failed to start Python application: $app_name"
            return 1
        }
    else
        "$python_cmd" main.py || {
            log_error "Failed to start Python application: $app_name"
            return 1
        }
    fi
}

