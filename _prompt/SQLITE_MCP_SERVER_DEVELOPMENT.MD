# SQLite MCP Server Development

## Overview

Complete an MCP server for this project that supports CRUD operations on SQLite databases. Listen on port 38001. Default can configure a SQLite database. Note: Database implementation is separate, not all databases share one instance.

## Features

### 1. Multiple Database Instances

Can pass in a new database address, then randomly create or read a new database. This way MCP internally has multiple open instances. Each instance uses database name and path as namespace. Can operate.

### 2. Auto-Close Mechanism

A database will close after 3 minutes of no operation. But after closing, please mark the data. When next MCP service requests this data, check if it was closed to prevent errors from direct operation.

### 3. Full Access

Can operate databases anywhere in the system. Can add, delete, modify, query, no restrictions.

### 4. AI Communication

Can communicate details with AI, such as how many databases are currently open, which one needs to be opened, etc. AI can pass in new databases at any time to create new instances in MCP.

### 5. Technology Stack

Choose the most suitable development language and latest MCP standard. Recommend using `uv` (but if you think there's better, you can still choose).

### 6. Smart Creation

When AI requests to operate a database that does not exist, intelligently create it. If it exists, operate according to requirements.

