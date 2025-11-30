Laravel Main Deployment Tools
==============================

This directory contains modularized deployment tools for Laravel application.

Module Files
============

1. environment_checker.sh
   - Detects WSL vs native Linux environment
   - Checks database and project directories
   - Performs comprehensive environment validation
   - Functions: detect_wsl_environment, get_database_directory, get_project_root,
               comprehensive_environment_check

2. system_dependencies.sh
   - Installs and verifies system requirements
   - Handles PHP, Composer, Python3, EdgeTTS, Edge browser
   - Fixes Git configuration
   - Functions: install_archive_tools, ensure_php_requirements, ensure_composer,
               ensure_python3, ensure_edgetts, check_edge_browser,
               fix_git_safe_directory, fix_script_permissions, verify_git

3. permission_manager.sh
   - Manages file and directory permissions
   - Sets up Laravel directory structure
   - Handles file ownership
   - Functions: setup_directory_permissions, setup_file_ownership,
               verify_critical_permissions

4. environment_setup.sh
   - Handles .env file configuration
   - Configures database connection
   - Manages environment variables
   - Functions: ensure_env_file, ensure_production_environment,
               configure_database_connection, get_current_environment,
               get_current_debug_setting

5. database_manager.sh
   - Creates and manages SQLite database
   - Runs migrations safely
   - Clears database cache
   - Functions: ensure_database_directory, ensure_database_file,
               run_migrations, clear_database_cache, verify_database_setup,
               setup_database

6. deployment_helper.sh
   - Utility functions for deployment process
   - Manages Composer dependencies
   - Optimizes Laravel for production/development
   - Functions: deployment_status_update, install_dependencies,
               optimize_for_production, optimize_for_development,
               create_init_marker, verify_artisan_exists,
               print_deployment_summary, stop_development_server,
               start_development_server

7. safety_checker.sh
   - Verifies deployment safety
   - Checks Laravel project structure
   - Validates disk space and system commands
   - Functions: verify_deployment_safety, verify_laravel_structure,
               check_disk_space, verify_system_commands,
               pre_deployment_check

Configuration
==============

Copy config.example.sh to config.sh and customize for your environment:
   cp config.example.sh config.sh

Edit config.sh with your specific settings:
   - Database location
   - Project root
   - Deployment mode (production/development)
   - Server host and port
   - File permissions and ownership

Usage
=====

The main deployment entry point is ../deploy.sh

This script automatically:
1. Loads all module files
2. Performs environment validation
3. Installs system dependencies
4. Configures environment files
5. Sets up file permissions
6. Manages database
7. Installs Laravel dependencies
8. Optimizes for production or development
9. Starts development server (if in development mode)

Running Deployment
==================

Navigate to the parent scripts directory and run:
   bash deploy.sh

Or set deployment mode before running:
   DEPLOY_MODE=production bash deploy.sh

For development mode (default):
   DEPLOY_MODE=development bash deploy.sh

Features
========

- Real-time output of all deployment steps
- WSL and native Linux support
- Automatic environment detection
- Safe database migration (no data loss)
- Comprehensive error checking
- Modular and maintainable code structure
- Full ASCII output (no Unicode characters)
- Extensive logging and status updates

Module Organization Benefits
=============================

- Single Responsibility: Each module handles specific functionality
- Reusability: Functions can be sourced independently
- Maintainability: Easy to locate and update specific features
- Testability: Individual modules can be tested separately
- Extensibility: Easy to add new modules
- Readability: Clear separation of concerns
