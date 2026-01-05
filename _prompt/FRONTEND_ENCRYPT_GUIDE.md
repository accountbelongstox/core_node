poly_apps/appfactory-master-dashboard 
Find the entire project and implement high-speed encryption and decryption. Currently, the main focus is on encrypting images. When an image is encrypted, preserve its format, filename, and content. Then, implement a frontend decryption library with the same logic in the code, which can decrypt encrypted content based on a password obtained from a GET or POST request, or from constants, and extract image information. Note: any password can decrypt the content, but incorrect passwords will result in garbled output. This means we need a backend service and frontend decryption library with the same logic. Note that the two ends cannot reference each other, but need to document the corresponding files for their logic.


AVATAR_API_MULTI_PROVIDER_SYSTEM.md
According to the method in the documentation, download an image to the build dir, then call the method in the frontend, use a password to decrypt this image and use it as mock data. Now test automatic encryption, as well as the frontend decryption effect with the same logic.

Now in the frontend, there are 10 images agreed upon: app_icon1 - app_icon5, app_splash1-5. Please hardcode them, then add these 10 images to /www/_build_dir/appfactory-master-dashboard/dist/public and automatically encrypt them. The 10 images agreed upon in the frontend should automatically read the encrypted files (note: the files in the frontend are hardcoded and cannot be dynamically scanned), then use these 10 images in the frontend. First provide mock data for these images, i.e., app1-5's icon/splash.

 poly_apps/appfactory-master-dashboard/docs/ENCRYPTED_ASSETS_SYSTEM.md 
According to the above document, check for inconsistencies between frontend and backend. The frontend receives a password through GET to decrypt. Check if the backend encryption can be used by the frontend, and if the frontend has modified the correct usage. Then update the documentation. Specify frontend development requirements in it to prevent inconsistencies in understanding between frontend and backend.

 Obviously there is a problem with the current image display. After the logic update, icons are actually not images anymore but encrypted .js files, so the image display logic needs to be updated. Check if automatic encryption synchronization works. sudo systemctl restart webapp-appfactory-master-dashboard-daemon
  root@ubuntu-Aspire-AV15-51:/www/programing/core_node#
  After previous synchronization, check if the hardcoded paths are consistent with the frontend. http://192.168.50.3:10000/#/apps?pp=xxx and check if the apps display the correct icons, and if the mock data has introduced the hardcoded encrypted icons (the icon encryption files may be updated at any time due to image updates in the build dir)
