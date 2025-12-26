# AI Translator App Development

## Overview

Complete the development of `apps/ai_translator_app` according to specifications.

## Reference Documents

- `development-guides/NODE_NCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md` - Reference libraries
- `ncore/ncore_tree.md` - Analyze and select suitable libraries, and libraries to extend

## First Step: Library Analysis

First complete this step. Requirements:

### Service Architecture

When starting according to ncore specifications, simultaneously start:
- A WebSocket and HTTP service
- An API process (access API)
- Multiple model processes (currently only extend DeepSeek)
- A set of init methods to ensure successful initialization

### WebSocket Connection Management

When WebSocket connects:
- Analyze a client ID
- Use this client ID to exchange data
- Have single conversation ID
- Have request callback ID (callback for each request)
- Have group callback ID

**Purpose**: If a single conversation ends, notify clients according to callback ID and return data (simulate synchronization). Of course, if HTTP, client needs to automatically query.

## Current Task

Complete the first step: analyze libraries.

