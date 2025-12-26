# Bank App Development

## Overview

This document describes the development of a bank app with Laravel backend and Flutter frontend.

## Project Structure

- **Backend**: `poly_apps/laravel_main` - A poly app
  - Read development documentation: `poly_apps/laravel_main/development-guides/LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md`
  - Develop APIs for bank app

- **Frontend**: `poly_apps/flutter_bloom` - Flutter frontend
  - Read development documentation: `poly_apps/flutter_bloom/development-guides/FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md`

## Development Tasks

### Step 1: Extend Network Base Class

First extend the network base class in `poly_apps/flutter_bloom/lib/common` to make the network base class robust while maintaining good compatibility.

### Step 2: Implement Bank App

In `poly_apps/flutter_bloom/lib/apps/app_bank` sub-app:
- Inherit from common class library
- Implement actual API access
- Currently use domain `https://api.si.12gm.com` to connect to Laravel

## Required Features

### 1. App Launch Logging

When APP opens, simultaneously submit information to backend and record to logs.

### 2. Registration Code Submission

When APP uses registration code through "My" page, submit details to backend.

### 3. Profile Update

When APP modifies balance, name, address, etc. through "My" page, submit to backend.

### 4. App Lock Mechanism

- APP has a unique identifier, will be submitted to backend in all submissions
- If backend sends file instruction, APP will lock

## Implementation Requirements

- Implement all features in both frontend and backend simultaneously
- Note: Need to extend Flutter's network class library to make it stronger

