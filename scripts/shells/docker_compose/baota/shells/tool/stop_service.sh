#!/bin/bash

# Stop bt service
service bt stop

# Stop nginx service
/etc/init.d/nginx stop

# Stop mysqld service
/etc/init.d/mysqld stop

# Stop redis service
/etc/init.d/redis stop

# Stop memcached service
service memcached stop

# Define PHP version array
php_versions=("52" "53" "54" "55" "56" "70" "71" "72" "73" "74" "80" "81" "82" "83" "84")

# Loop through and stop each PHP-FPM version
for version in "${php_versions[@]}"; do
    service_file="/etc/init.d/php-fpm-$version"

    if [ -f "$service_file" ]; then
        echo "Found $service_file, attempting to stop..."
        $service_file stop
        if [ $? -eq 0 ]; then
            echo "php-fpm-$version stopped successfully."
        else
            echo "Failed to stop php-fpm-$version."
        fi
    fi
done
