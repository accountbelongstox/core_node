# Task Management System Development Guide

> **Merged from**: `task.txt`, `任务.txt`, `.task.prompt`, `aug_task2.txt`
> **Last Updated**: 2025-01-XX

## Table of Contents
1. [Task System Overview](#task-system-overview)
2. [Role Definitions](#role-definitions)
3. [Business Processes](#business-processes)
4. [Development Processes](#development-processes)
5. [Platform Features](#platform-features)

---

## Task System Overview

### System Objectives

Develop a complete task management system that supports:
- Client submission of development requirements
- Platform AI analysis
- Developer assignment
- Development progress monitoring
- Project delivery completion

### Core Features

- AI-driven requirement analysis
- Intelligent development solution generation
- Multi-role collaboration
- Real-time progress monitoring
- Code quality scoring
- Online IDE integration
- Payment and settlement system

---

## Role Definitions

### 1. Client

**Permissions**:
- Submit development requirements
- View development progress
- Comment on project milestones
- Pay progress payments
- Modify development objectives (requires additional fees)
- Terminate development (deduct penalty)
- Request developer updates
- Like developers and settle payments

**Submission Content**:
- Title
- General requirements
- Documents
- Images
- Examples

### 2. Developer

**Application Process**:
1. Register
2. Phone verification
3. Identity verification
4. Pay deposit
5. Accept task matching push notifications

**Development Permissions**:
- Accept tasks (requires platform certification and deposit)
- Develop according to specifications
- Propose modification suggestions
- Document update suggestions
- Submit code
- Appeal quality score
- File complaints with platform
- Apply to copy code for offline development (requires signed guarantee and additional deposit)

### 3. Architect

**Application Conditions**:
- Platform certification
- Pay deposit
- High developer code scores
- High client ratings
- Can apply for upgrade, pay deposit

**Responsibilities**:
- Framework design
- Progress monitoring
- Create development documentation
- Assign developers
- Spot check if developers' AI IDE meets minimum requirements
- Review code progress and propose modifications
- Score code
- Use AI to merge code
- Modify and update development documentation

**Configuration**:
- Can be one or multiple architects
- Can be full-stack or separate frontend/backend

### 4. Company Manager

**Permissions**:
- Platform management
- User management
- Financial management
- System configuration

### 5. Quality Reviewer

**Application**:
- Anyone can apply
- Review and score all pushed development submission tasks

---

## Business Processes

### Phase 1: Requirement Submission and Analysis

```
Client submits development requirements
    ↓
Platform AI analyzes requirements
    ↓
Generate optimal development solution:
  - Development language set
  - Development framework set
  - Developer allocation
    ↓
Client confirms or modifies
    ↓
Client payment
    ↓
Enter development progress
```

### Phase 2: Project Assignment

```
Platform assigns architects based on project ratio
    ↓
Architect creates development documentation
    ↓
Architect assigns developers
    ↓
Tasks pushed to developer group
    ↓
Developers accept tasks (requires certification and deposit)
```

### Phase 3: Development Execution

```
Developers develop according to specifications
    ↓
Use platform online IDE or local development
    ↓
Submit code
    ↓
Architect confirms or preset auto-confirm
    ↓
AI merges code
    ↓
Architect confirms merge result or fixes
    ↓
(Backup before merge)
```

### Phase 4: Progress Monitoring

```
Architect monitors progress
    ↓
Client views progress
    ↓
Client pays progress payment
    ↓
Developers submit code
    ↓
Quality reviewers review and score
```

### Phase 5: Delivery and Settlement

```
Project completion
    ↓
Client acceptance
    ↓
Client likes developers
    ↓
Settle payments
```

---

## Development Processes

### Code Submission Process

1. **Developer receives development requirements**
2. **Develop AI-recognizable code according to specifications**
3. **Submit to platform**
4. **Architect confirms, or preset auto-confirm**
5. **Call AI to merge code**
6. **Architect confirms merge result or fixes**
7. **Backup before merge**

**Note**: Code merging uses architect's AI quota

### Development Environment

#### Online IDE

- Platform provides unified online AI services
- Provides online VSCode platform
- Pre-installed common AI plugins (e.g., CLAUDE)
- Using platform AI tools will deduct fees from developer account

#### Local Development

- Developers can apply to copy code for offline development
- Use local development environment
- Requires signed guarantee:
  - Configure environment according to company requirements
  - Prevent using outdated development solutions that slow project progress
- Pay additional deposit
- Then can copy code

---

## Platform Features

### Task Hall

- Display all tasks
- Development progress pushed platform-wide
- Development progress reviewed platform-wide
- Promote development quality

### Virtual Development Environment

- Platform provides virtual remote development environment
- Support online development
- Support local development synchronization

### AI Architecture

- Platform provides unified online AI services
- Online VSCode platform
- Pre-installed common AI plugins

### Payment System

- Client payment
- Progress payment
- Modify development objectives and pay additional development fees
- Terminate development and deduct penalty
- Settle payments

### Scoring System

- Code quality scoring
- Client scoring
- Developer scoring
- Quality reviewer scoring

### Complaints and Appeals

- Developers can propose modification suggestions
- Document update suggestions
- Appeal quality score
- File complaints with platform

---

## Process Flow Diagram

### Complete Process Flow

```
[Client] Submit development requirements
    ↓
[Platform AI] Analyze requirements → Generate development solution
    ↓
[Client] Confirm/Modify → Payment
    ↓
[Platform] Assign architect
    ↓
[Architect] Create development documentation → Assign developers
    ↓
[Platform] Push tasks to developer group
    ↓
[Developer] Accept task (requires certification + deposit)
    ↓
[Developer] Develop code (Online IDE/Local)
    ↓
[Developer] Submit code
    ↓
[Architect] Confirm → AI merge code
    ↓
[Quality Reviewer] Review and score
    ↓
[Client] View progress → Pay progress payment
    ↓
[Project Complete] → [Client Acceptance] → [Settle Payments]
```

---

## Technical Implementation Points

### 1. AI Requirement Analysis

- Analyze client-submitted requirements
- Generate optimal development solution
- Include: development languages, frameworks, personnel allocation

### 2. Task Matching

- Match tasks based on developer skills
- Push tasks to developer group
- Verify platform certification and deposit

### 3. Code Merging

- AI automatically merges code
- Backup before merge
- Architect confirms merge result

### 4. Progress Monitoring

- Real-time display of development progress
- Platform-wide push of progress updates
- Clients can view at any time

### 5. Payment System

- Support multiple payment methods
- Progress payment
- Penalty handling
- Settlement management

---

## Related Documents

- Flow diagram document: `D:\programing\core_node\poly_apps\nuxt_main\docs`

---

## Important Notes

1. **Deposit Mechanism**: Both developers and architects need to pay deposits
2. **Certification Requirements**: Developers need platform certification to accept tasks
3. **Code Standards**: Developers must develop AI-recognizable code according to specifications
4. **Environment Requirements**: Local development requires signed guarantee to ensure environment meets requirements
5. **AI Quota**: Code merging uses architect's AI quota
6. **Scoring System**: Multi-dimensional scoring (code quality, client satisfaction, etc.)
7. **Complaint Mechanism**: Provide comprehensive complaint and appeal channels

