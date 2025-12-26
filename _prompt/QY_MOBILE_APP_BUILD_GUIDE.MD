# QY Mobile App Build Guide

## Overview

First complete the integration of Flutter and Laravel AppQyV1, using the current login system, but send backend requests to AppQyV1. Currently need to synchronize user profiles, user word libraries, public word libraries, and a series of resources. Also need to select the language to learn. The backend should provide a list of supported languages (refer to the edge TTS supported language table in the current backend), extract as a public library. If there are document conflicts, update the document first, then continue with the code.

## Word Learning APP

Implement the Flutter end according to previous requirements: `poly_apps/flutter_bloom/lib/apps/app_qy`. First strictly develop according to specification `development-guides/FLUTTER_GUIDE.md`. Scan and understand the non-compliant parts of the actual code. It was developed by a poor AI before and needs comprehensive refactoring.

## Implementation Requirements

### Theme and Layout

- Implement effects and integrate with Laravel's AppQyV1 API
- Pay attention to theme centralization
- Use holographic white, frosted glass, blur background, dynamic gradient effects
- Use bento box layout
- Call common area component extensions
- Theme centralization (theme defined in one directory)
- Data centralization (do not define data in multiple places)
- Settings and state centralization
- Use multilingual effects and define multilingual keys from the specification
- Use global storage effects

### Code Compliance

When code does not comply with the above specifications, you must correct it and create a development progress document. For all incomplete pages TODO pages, do not randomly fill in code, and comply with the route centralization specification.

### Backend API

Current backend API address: `192.168.50.2:9000`

## Settings Page Implementation

According to Flutter word learning requirements (see `_prompt` directory) and progress `poly_apps/flutter_bloom/lib/apps/app_qy/DEVPROGRESS.txt`, implement the settings page. First plan the settings items you need.

### Settings Structure

Settings are linked with the login system. Settings have an area that can be set without login, and an area that can only be set after login (My). Then add an option to add a learning language option, where you can select multiple languages to learn.

### Design Requirements

Design is related to multilingual, redraw, etc. When switching languages or some settings, immediately redraw. The selection of multiple languages will immediately synchronize with the backend word library recommendations.

### Backend Integration

Now please also complete the backend word library recommendations and the front-end extensible multilingual word library display.

## Architecture

```
┌─────────────────────────┼─────────────────────────┐
|                         |                         |
📄 Core Data Layer    🎯 Core Business Layer    🎨 User Interface Layer
|                         |                         |
┌───────────┼───────────┐   ┌─────────┼─────────┐   ┌──────────┼──────────┐
|           |           |   |         |         |   |          |          |
Document Data  Word Group  Memory  Learning  Review  Word  Learning  Statistics  Settings
            Data      Data   Engine  Engine  Library  Page    Page      Page
```

## Detailed Feature Tree Structure

### 1️⃣ Document Processing System

#### 1.1 Document Upload
- Supported formats: PDF/DOC/DOCX/TXT
- File size limit: 50MB
- Batch upload
- Progress display
- File preview

#### 1.2 Text Extraction
- PDF parsing (including OCR)
- Word parsing
- Paragraph recognition
- Sentence segmentation
- Format processing

#### 1.3 Word Extraction
- Intelligent recognition
- Lemmatization
- Word frequency statistics
- Phrase extraction
- Filter function words
- Difficulty labeling

#### 1.4 Sentence Extraction
- Example sentence extraction
- Difficulty assessment
- Key sentence filtering
- Context retention

