# CodeMart App

CodeMart is a professional platform connecting global developers with clients for software outsourcing services.

## Architecture Overview

### Theme System

The app follows a **Main Theme + Sub-App Extension Theme** architecture:

```
Main Theme (common/styles/theme-base.css)
  ├── All common CSS variables
  ├── Base styles and utilities
  └── Inherited by all sub-apps

Sub-App Theme (apps/app_codemart/styles_app_codemart/theme-codemart.css)
  ├── CodeMart-specific CSS variables
  ├── Business-specific component styles
  └── Extends main theme without overriding
```

### File Structure

```
apps/app_codemart/
├── components_app_codemart/         # CodeMart-specific components
│   ├── CodeMartProjectCard.vue      # Project listing card
│   ├── CodeMartTaskCard.vue         # Task listing card
│   ├── CodeMartDeveloperCard.vue    # Developer profile card
│   └── index.ts                     # Component exports
│
├── composables_app_codemart/        # Business logic composables
│   ├── use-codemart-project.ts      # Project management logic
│   ├── use-codemart-task.ts         # Task management logic
│   ├── use-codemart-user.ts         # User management logic
│   ├── use-codemart-payment.ts      # Payment processing logic
│   └── index.ts                     # Composable exports
│
├── services_app_codemart/           # API service layer
│   ├── codemart-api-base.ts         # Base API class (extends common)
│   ├── project-api.ts               # Project API endpoints
│   ├── task-api.ts                  # Task API endpoints
│   ├── user-api.ts                  # User API endpoints
│   └── payment-api.ts               # Payment API endpoints
│
├── types_app_codemart/              # TypeScript type definitions
│   └── index.ts                     # All CodeMart types
│
├── locales_app_codemart/            # i18n translations
│   ├── zh.json                      # Chinese translations
│   └── en.json                      # English translations
│
├── styles_app_codemart/             # CodeMart theme extension
│   └── theme-codemart.css           # All CodeMart styles
│
├── constants_app_codemart/          # Business constants
│   └── codemart-constants.ts        # All CodeMart constants
│
├── config_app_codemart/             # App configuration
│   └── app-config.ts                # CodeMart configuration
│
└── pages_app_codemart/              # Page components
    └── index.vue                    # Homepage
```

## Development Standards

### 1. No Inline Styles

**❌ NEVER do this:**

```vue
<template>
  <div class="my-component">Content</div>
</template>

<style scoped>
.my-component {
  padding: 20px;
  background: #fff;
}
</style>
```

**✅ ALWAYS do this:**

```vue
<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div class="codemart-card">Content</div>
</template>

<script setup lang="ts">
// Component logic only
</script>

<!-- NO <style> tag - All styles defined in theme files -->
```

### 2. Use Common Components First

Before creating a new component:

1. Check if a common component exists in `common/components/`
2. If exists, extend it or use it directly
3. If not, create a CodeMart-specific component

### 3. Extend Common Services

All API services must extend the common base:

```typescript
// ✅ Correct: Extend common base
import { BaseApiService } from '~/common/services/base-api';

export class ProjectApi extends BaseApiService {
  constructor() {
    super('/api/codemart/projects');
  }
}
```

```typescript
// ❌ Wrong: Don't create from scratch
export class ProjectApi {
  // Don't do this!
}
```

### 4. Multilingual Configuration

- **Common translations**: `i18n/locales/zh.json`, `i18n/locales/en.json`
- **CodeMart-specific translations**: `apps/app_codemart/locales_app_codemart/zh.json`, `en.json`

```json
// locales_app_codemart/en.json
{
  "codemart": {
    "project": {
      "title": "Project",
      "budget": "Budget"
    }
  }
}
```

Usage in component:

```vue
<template>
  <span>{{ t('codemart.project.budget') }}</span>
  <span>{{ t('common.save') }}</span> <!-- From common i18n -->
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>
```

### 5. Type Definitions

All types must be defined in `types_app_codemart/index.ts`:

```typescript
// Import from constants for enum values
import type { ProjectStatus } from '../constants_app_codemart/codemart-constants';

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  // ... other fields
}
```

## Key Features

### 1. Project Management

- **List projects**: Browse all available projects
- **View details**: See full project specifications
- **Create project**: Clients can post new projects
- **Update project**: Edit project information
- **Delete project**: Remove projects

**Usage:**

```vue
<script setup lang="ts">
import { useCodemartProject } from '~/apps/app_codemart/composables_app_codemart';

const {
  projects,
  loading,
  error,
  fetchProjects,
  createProject
} = useCodemartProject();

onMounted(() => {
  fetchProjects();
});
</script>
```

### 2. Task Management

- **Browse tasks**: Find available development tasks
- **Submit work**: Developers submit deliverables
- **Review & Accept**: Clients review and accept work
- **Payment processing**: Automated payment on acceptance

**Usage:**

```vue
<script setup lang="ts">
import { useCodemartTask } from '~/apps/app_codemart/composables_app_codemart';

const {
  tasks,
  loading,
  submitTask,
  acceptTask
} = useCodemartTask();
</script>
```

### 3. User & Developer Profiles

- **User authentication**: Login/register
- **Developer profiles**: Showcase skills and experience
- **Rating system**: 5-star rating for developers
- **Credit system**: Track user reputation

**Usage:**

```vue
<script setup lang="ts">
import { useCodemartUser } from '~/apps/app_codemart/composables_app_codemart';

const {
  currentUser,
  developer,
  isLoggedIn,
  isDeveloper
} = useCodemartUser();
</script>
```

### 4. Payment System

- **Create payments**: Initiate payment for projects
- **Confirm payments**: Complete transactions
- **Refund handling**: Process refunds if needed
- **Payment history**: Track all transactions

**Usage:**

```vue
<script setup lang="ts">
import { useCodemartPayment } from '~/apps/app_codemart/composables_app_codemart';

const {
  createPayment,
  confirmPayment,
  refundPayment
} = useCodemartPayment();
</script>
```

## Components

### CodeMartProjectCard

Display project information in card format.

**Props:**

- `project: Project` - Project data
- `showViewButton?: boolean` - Show view details button (default: true)

**Events:**

- `@view` - Emitted when view button clicked

**Usage:**

```vue
<template>
  <CodeMartProjectCard
    :project="project"
    @view="handleViewProject"
  >
    <template #actions="{ project }">
      <button>Custom Action</button>
    </template>
  </CodeMartProjectCard>
</template>
```

### CodeMartTaskCard

Display task information in card format.

**Props:**

- `task: Task` - Task data

**Slots:**

- `actions` - Custom action buttons

**Usage:**

```vue
<template>
  <CodeMartTaskCard :task="task">
    <template #actions="{ task }">
      <button @click="handleApply(task)">Apply</button>
    </template>
  </CodeMartTaskCard>
</template>
```

### CodeMartDeveloperCard

Display developer profile in card format.

**Props:**

- `developer: Developer` - Developer data

**Slots:**

- `actions` - Custom action buttons

**Usage:**

```vue
<template>
  <CodeMartDeveloperCard :developer="developer">
    <template #actions="{ developer }">
      <button>Contact</button>
      <button>Hire</button>
    </template>
  </CodeMartDeveloperCard>
</template>
```

## Constants

All business constants are defined in `constants_app_codemart/codemart-constants.ts`:

```typescript
export const CODEMART_CONSTANTS = {
  PROJECT: {
    MIN_BUDGET: 500,
    MAX_BUDGET: 1000000,
    MIN_DEADLINE_DAYS: 3,
  },
  DEVELOPER: {
    MIN_EXPERIENCE_YEARS: 0,
    MIN_HOURLY_RATE: 50,
    MAX_HOURLY_RATE: 10000,
  },
  // ... more constants
};
```

## API Endpoints

### Project API

- `GET /api/codemart/projects` - List projects
- `GET /api/codemart/projects/:id` - Get project details
- `POST /api/codemart/projects` - Create project
- `PUT /api/codemart/projects/:id` - Update project
- `DELETE /api/codemart/projects/:id` - Delete project

### Task API

- `GET /api/codemart/tasks` - List tasks
- `GET /api/codemart/tasks/:id` - Get task details
- `POST /api/codemart/tasks` - Create task
- `POST /api/codemart/tasks/:id/submit` - Submit task
- `POST /api/codemart/tasks/:id/accept` - Accept task
- `POST /api/codemart/tasks/:id/reject` - Reject task

### User API

- `GET /api/codemart/users/me` - Get current user
- `GET /api/codemart/users/:id` - Get user profile
- `PUT /api/codemart/users/:id` - Update user
- `GET /api/codemart/users/:id/developer` - Get developer profile
- `PUT /api/codemart/users/:id/developer` - Update developer profile

### Payment API

- `POST /api/codemart/payments` - Create payment
- `GET /api/codemart/payments/:id` - Get payment details
- `POST /api/codemart/payments/:id/confirm` - Confirm payment
- `POST /api/codemart/payments/:id/cancel` - Cancel payment
- `POST /api/codemart/payments/:id/refund` - Refund payment

## Theme Variables

### CodeMart-Specific Variables

```css
/* Brand colors */
--codemart-primary: #4361ee;
--codemart-primary-hover: #3651d4;

/* Project status colors */
--codemart-project-draft: #9e9e9e;
--codemart-project-active: #2196f3;
--codemart-project-completed: #4caf50;

/* Task status colors */
--codemart-task-pending: #ff9800;
--codemart-task-progress: #2196f3;
--codemart-task-completed: #4caf50;

/* Payment status colors */
--codemart-payment-pending: #ff9800;
--codemart-payment-completed: #4caf50;
```

## Development Checklist

Before submitting code, ensure:

- [ ] No `<style>` tags in component files
- [ ] All styles use CSS variables
- [ ] All colors reference theme variables
- [ ] All spacing uses spacing variables
- [ ] Class names follow naming convention (`codemart-*`)
- [ ] Dark theme is supported
- [ ] Development standards comment is added
- [ ] TypeScript types are properly defined
- [ ] API services extend common base
- [ ] i18n keys are properly defined
- [ ] Responsive design works on mobile
- [ ] All code comments are in English

## Reference Documents

- **Architecture Guide**: `development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md`
- **Theme Guide**: `development-guides/THEME_AND_STYLE_GUIDE.md`
- **Project Tree**: `poly_apps/nuxt_main/nuxt_main_tree.md`
- **CodeMart Spec**: `poly_apps/nuxt_main/codemart_doc/codemart.md`

## Build & Run

```bash
# Run CodeMart app in development mode
APP_ENTRY=codemart npm run dev

# Build CodeMart app for production
APP_ENTRY=codemart npm run build

# Run production build
APP_ENTRY=codemart npm run start
```

## Contributing

When contributing to CodeMart:

1. Follow the development standards strictly
2. Never use inline styles
3. Always extend common components/services
4. Add proper TypeScript types
5. Support multilingual
6. Write code comments in English
7. Test on both light and dark themes
8. Ensure mobile responsiveness

---

For questions or issues, please refer to the development guides or consult the team lead.
