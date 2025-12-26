# Certbot Laravel Integration

## Overview

Analyze poly app Laravel structure `poly_apps/laravel_main/app/Apps/ServerManagerV1`. Understand that in Laravel, one app is used to manage this server's nginx and certbot services.

## Analysis Tasks

### 1. ServerManagerV1 Analysis
- Analyze `poly_apps/laravel_main/app/Apps/ServerManagerV1`
- View test files `poly_apps/laravel_main/app/Helpers/nginx-proxy-manager-api` to understand previous API
- Review `poly_apps/laravel_main/app/Helpers/nginx-proxy-manager-api/src/Api/BaseApi.php`, `Certificates.php`, `Hosts.php`
- Delete test directory after analysis

### 2. Route Analysis
- Analyze routes: `poly_apps/laravel_main/routes/ServerManagerV1Router/ServerManagerV1Routes.php`
- Add missing routes

### 3. Command Line Understanding
- Understand command line: `poly_apps/laravel_main/app/Console/Commands/CheckCertbotCommand.php`
- Review other possible command line files

### 4. Secret Management Analysis
- Analyze `scripts/disguise.js` file
- Review `scripts/shells/linux/common/gvar_common.sh` for disguise.js calls
- Understand `.secret_keys\.secret_ignore` directory and `.secret_keys\already_encrypted` directory
- Logic: Project writes some plaintext secrets in `.secret_ignore` directory, which is ignored by git on commit, but before commit, content is encrypted via script in `gvar_common.sh`, encrypted content is placed in `already_encrypted` directory with `.js` extension, so secrets are safely committed to GitHub. If project is cloned, when reading, if corresponding key is not found in `.secret_ignore`, then look in `already_encrypted` directory, but prompt to use corresponding script in `gvar_common` to input password to decrypt. If already decrypted, skip directly.

### 5. Built-in Domain Configuration
- In `.secret_ignore` directory, build in the following information:
  - Domain: `dns_dnspod_email = "accountbelongstox@163.com"`
  - `dns_dnspod_api_token = "423302,c7d75d337e837276da7239693955b137"`
  - Corresponding domains: `gm15.com`, `12gm.com`
  - Confirm metadata in scripts
- In `scripts/shells/linux/debian/install_shells/26_install_certbot.sh`, confirm related directories
- **Note**: This function does not use certbot installation

### 6. Domain Setup Script
- After confirming above information, add a file in `scripts/shells/linux/debian/install_shells`
- Call functions in `gvar_common.sh` to read domains from `.secret_ignore` (currently `gm15.com`/`12gm.com` and dnspod related information)
- Print information
- Call PHP artisan Laravel related functions
- Execute related command lines in `poly_apps/laravel_main/app/Apps`
- Add above domains to nginx system and certbot system
- **Note**: Operate through Laravel. Understand that in Laravel, one app is used to manage this server's nginx and certbot services
- If local testing, modify Windows host to point to local (but domain certificate application because using DNS can be unaffected by resolution), and print host path and content to modify for easy copy-paste

### 7. Laravel Development Specification
- Read this project's poly apps Laravel development specification: `poly_apps/laravel_main/development-guides/LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md`
- Check `poly_apps/laravel_main/app/Apps/ServerManagerV1` app usage
- Add to nginx domain list
- Add to certbot automatic certificate application and automatic certificate update
- **Note**: Currently only consider certbot supporting dnspod one method. Only two built-in domains.

### 8. Global Secret Management (Additional Task)
- Implement a global function in Laravel available to all apps, exactly the same as `gvar_common.sh` function to read `.secret_ignore`, `already_encrypted`, and `disguise.js` functionality
- **Note**: Obviously reads external directory, so default allow Laravel to handle external files
- This function is for future use, not actually used now

## Domain Extension

When a domain is submitted, it affects only websites, but SSL uses a common one. For example, `15gm.com` will simultaneously be extended by certbot application to `15gm.com`, `*.15gm.com`.

### Predefined Fields
- Predefine several fields, such as `si`/`sz`/`local`/`api`
- Above domain will simultaneously be extended according to predefined fields:
  - `15gm.com`
  - `*.15gm.com`
  - `si.15gm.com`
  - `*.si.15gm.com`
  - `sz.15gm.com`
  - `*.sz.15gm.com`
  - `local.15gm.com`
  - `*.local.15gm.com`
  - `*.api.15gm.com`
  - `*.api.si.15gm.com`
  - `*.api.sz.15gm.com`
  - `*.api.local.15gm.com`
- Then correspond in certificate data JSON, and use DNS to uniformly use one certificate

### Automatic Website Creation
- When adding `15gm.com`, automatically create website directory (server deployment path: `/www/wwwroot/15gm.com/index.htm`) and Laravel outputs appropriate HTML indicating webpage is correct
- Simultaneously extend domain and apply for SSL certificate
- After that, no matter what other domain `a.15gm.com` is added, use certificate within range

### Certificate Range Expansion
- If newly added domain like `a.new.15gm.com` exceeds range, automatically change range domain to `*.new.15gm.com` and append to certificate list
- Simultaneously update certificate to make certificate range larger
- Unless there is new range, or certificate temporarily expires, no need to update certificate every time a domain is added

### Database Structure
- Certificate JSON database and website JSON database are separate, record different information, but have correlation
- Print more information, such as:
  - All sites in website
  - All certificates in SSL
  - Expiration time
  - PHP version
  - Laravel information
  - Whether certificate application succeeded
- Implemented by Laravel side. Currently all consider command line first, but write TODO information in web-API related files

## Simplified Functionality

### 1. Domain Setup Script
- `130_setup_domains.sh` changed to connect and call multiple commands
- 1-1: According to one domain and submitted information, let Laravel add to SSL JSON database and extend domain
- `"si"`, `"sz"`, `"local"`, `"api"` as additional subdomains that need certificate application, submitted by `.sh`
- This extends SSL application flexibility, but still default to attach `*.xxx.com` and `xxx.com` functionality
- These two domains automatically extend, e.g., if passed `15gm.com`, automatically extend to `*.15gm.com` and `15gm.com`
- But if passed `www.15gm.com`, also need to extend, i.e., ensure `@` domain exists
- 1-2: After submitting SSL application, add submitted domain application to nginx as website
- Automatically parse domain in `.sh` to extend `www.` prefix for submission

### 2. Laravel Side Function Decomposition
- 2-1: Laravel side can according to one domain's submitted information, first query SSL JSON database, if exists use old token, if not add, then return certificate application result, including certificate location and other information
- 2-2: Laravel side will decompose a function, when adding website, if has corresponding mark, then go to SSL JSON to find certificate and apply
- If SSL certificate not found, default to use HTTP instead of HTTPS but print related information
- 2-3: Laravel side will ensure certificate update, website list query, certificate list query, information printing and other functions
- At the same time, in `130_setup_domains.sh` finally reference these functions

