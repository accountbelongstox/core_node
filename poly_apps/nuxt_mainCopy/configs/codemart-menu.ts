// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

export type UserRole = 'client' | 'developer' | 'architect' | 'reviewer' | 'admin';

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  children?: MenuItem[];
  roles: UserRole[];
  badge?: {
    type: 'success' | 'warning' | 'danger' | 'info';
    value: string | number;
  };
}

export const codemartMenu: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'chart-bar',
    route: '/codemart',
    roles: ['client', 'developer', 'architect', 'reviewer', 'admin'],
  },
  {
    id: 'home',
    label: 'Home',
    icon: 'home',
    route: '/codemart/home',
    roles: ['client', 'developer', 'architect', 'reviewer', 'admin'],
  },

  {
    id: 'projects',
    label: 'My Projects',
    icon: 'folder',
    roles: ['client'],
    children: [
      {
        id: 'projects-active',
        label: 'Active Projects',
        icon: 'folder-open',
        route: '/codemart/projects?status=active',
        roles: ['client'],
      },
      {
        id: 'projects-pending',
        label: 'Pending Review',
        icon: 'clock',
        route: '/codemart/projects?status=pending',
        roles: ['client'],
      },
      {
        id: 'projects-completed',
        label: 'Completed Projects',
        icon: 'check-circle',
        route: '/codemart/projects?status=completed',
        roles: ['client'],
      },
      {
        id: 'projects-archived',
        label: 'Archived',
        icon: 'archive',
        route: '/codemart/projects?status=archived',
        roles: ['client'],
      },
    ],
  },
  {
    id: 'create-project',
    label: 'Create New Project',
    icon: 'plus-circle',
    route: '/codemart/projects/create',
    roles: ['client'],
  },
  {
    id: 'client-payments',
    label: 'Payments',
    icon: 'credit-card',
    roles: ['client'],
    children: [
      {
        id: 'payment-history',
        label: 'Payment History',
        icon: 'list',
        route: '/codemart/finance/payments/history',
        roles: ['client'],
      },
      {
        id: 'invoices',
        label: 'Invoices',
        icon: 'file-text',
        route: '/codemart/finance/payments/invoices',
        roles: ['client'],
      },
      {
        id: 'refunds',
        label: 'Refunds',
        icon: 'rotate-ccw',
        route: '/codemart/finance/payments/refunds',
        roles: ['client'],
      },
    ],
  },
  {
    id: 'client-team',
    label: 'Team Management',
    icon: 'users',
    roles: ['client'],
    children: [
      {
        id: 'assigned-developers',
        label: 'Assigned Developers',
        icon: 'user-check',
        route: '/codemart/team/developers',
        roles: ['client'],
      },
      {
        id: 'architect-contacts',
        label: 'Architect Contacts',
        icon: 'user-cog',
        route: '/codemart/team/architects',
        roles: ['client'],
      },
      {
        id: 'performance-reviews',
        label: 'Performance Reviews',
        icon: 'star',
        route: '/codemart/team/reviews',
        roles: ['client'],
      },
    ],
  },
  {
    id: 'client-reports',
    label: 'Reports',
    icon: 'bar-chart',
    roles: ['client'],
    children: [
      {
        id: 'project-analytics',
        label: 'Project Analytics',
        icon: 'trending-up',
        route: '/codemart/reports/projects',
        roles: ['client'],
      },
      {
        id: 'cost-analysis',
        label: 'Cost Analysis',
        icon: 'dollar-sign',
        route: '/codemart/reports/costs',
        roles: ['client'],
      },
      {
        id: 'quality-reports',
        label: 'Quality Reports',
        icon: 'check-square',
        route: '/codemart/reports/quality',
        roles: ['client'],
      },
    ],
  },

  {
    id: 'task-hall',
    label: 'Task Hall',
    icon: 'briefcase',
    roles: ['developer'],
    children: [
      {
        id: 'available-tasks',
        label: 'Available Tasks',
        icon: 'list',
        route: '/codemart/tasks/hall',
        roles: ['developer'],
      },
      {
        id: 'recommended-tasks',
        label: 'Recommended Tasks',
        icon: 'star',
        route: '/codemart/tasks/hall?filter=recommended',
        roles: ['developer'],
      },
      {
        id: 'skills-match',
        label: 'My Skills Match',
        icon: 'zap',
        route: '/codemart/tasks/hall?filter=skills',
        roles: ['developer'],
      },
    ],
  },
  {
    id: 'my-tasks',
    label: 'My Tasks',
    icon: 'check-square',
    roles: ['developer'],
    children: [
      {
        id: 'tasks-in-progress',
        label: 'In Progress',
        icon: 'play-circle',
        route: '/codemart/tasks/my?status=in-progress',
        roles: ['developer'],
      },
      {
        id: 'tasks-pending-review',
        label: 'Pending Review',
        icon: 'clock',
        route: '/codemart/tasks/my?status=pending-review',
        roles: ['developer'],
      },
      {
        id: 'tasks-completed',
        label: 'Completed',
        icon: 'check-circle',
        route: '/codemart/tasks/my?status=completed',
        roles: ['developer'],
      },
      {
        id: 'tasks-rejected',
        label: 'Rejected',
        icon: 'x-circle',
        route: '/codemart/tasks/my?status=rejected',
        roles: ['developer'],
      },
    ],
  },
  {
    id: 'development',
    label: 'Development',
    icon: 'code',
    roles: ['developer'],
    children: [
      {
        id: 'online-ide',
        label: 'Online IDE',
        icon: 'terminal',
        route: '/codemart/development/ide',
        roles: ['developer'],
      },
      {
        id: 'local-development',
        label: 'Local Development',
        icon: 'download',
        route: '/codemart/development/local',
        roles: ['developer'],
      },
      {
        id: 'code-submissions',
        label: 'Code Submissions',
        icon: 'upload',
        route: '/codemart/development/submissions',
        roles: ['developer'],
      },
    ],
  },
  {
    id: 'dev-performance',
    label: 'My Performance',
    icon: 'trending-up',
    roles: ['developer'],
    children: [
      {
        id: 'rating-reviews',
        label: 'Rating & Reviews',
        icon: 'star',
        route: '/codemart/performance/rating',
        roles: ['developer'],
      },
      {
        id: 'earnings',
        label: 'Earnings',
        icon: 'dollar-sign',
        route: '/codemart/finance/earnings',
        roles: ['developer'],
      },
      {
        id: 'skill-stats',
        label: 'Skill Stats',
        icon: 'bar-chart-2',
        route: '/codemart/performance/skills',
        roles: ['developer'],
      },
      {
        id: 'badges-achievements',
        label: 'Badges & Achievements',
        icon: 'award',
        route: '/codemart/performance/achievements',
        roles: ['developer'],
      },
    ],
  },
  {
    id: 'learning-center',
    label: 'Learning Center',
    icon: 'book',
    roles: ['developer'],
    children: [
      {
        id: 'tutorials',
        label: 'Tutorials',
        icon: 'video',
        route: '/codemart/learning/tutorials',
        roles: ['developer'],
      },
      {
        id: 'best-practices',
        label: 'Best Practices',
        icon: 'check',
        route: '/codemart/learning/best-practices',
        roles: ['developer'],
      },
      {
        id: 'code-examples',
        label: 'Code Examples',
        icon: 'code',
        route: '/codemart/learning/examples',
        roles: ['developer'],
      },
    ],
  },

  {
    id: 'architect-projects',
    label: 'My Projects',
    icon: 'layers',
    roles: ['architect'],
    children: [
      {
        id: 'architect-active-projects',
        label: 'Active Projects',
        icon: 'folder-open',
        route: '/codemart/architect/projects?status=active',
        roles: ['architect'],
      },
      {
        id: 'team-overview',
        label: 'Team Overview',
        icon: 'users',
        route: '/codemart/architect/team',
        roles: ['architect'],
      },
      {
        id: 'architecture-docs',
        label: 'Architecture Docs',
        icon: 'file-text',
        route: '/codemart/architect/docs',
        roles: ['architect'],
      },
    ],
  },
  {
    id: 'architect-team',
    label: 'Team Management',
    icon: 'users',
    roles: ['architect'],
    children: [
      {
        id: 'assign-tasks',
        label: 'Assign Tasks',
        icon: 'user-plus',
        route: '/codemart/architect/assign-tasks',
        roles: ['architect'],
      },
      {
        id: 'developer-performance',
        label: 'Developer Performance',
        icon: 'activity',
        route: '/codemart/architect/performance',
        roles: ['architect'],
      },
      {
        id: 'code-review-queue',
        label: 'Code Review Queue',
        icon: 'git-pull-request',
        route: '/codemart/code-review/queue',
        roles: ['architect'],
      },
    ],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: 'book-open',
    roles: ['architect'],
    children: [
      {
        id: 'technical-specs',
        label: 'Technical Specs',
        icon: 'file-text',
        route: '/codemart/architect/docs/specs',
        roles: ['architect'],
      },
      {
        id: 'api-docs',
        label: 'API Docs',
        icon: 'code',
        route: '/codemart/architect/docs/api',
        roles: ['architect'],
      },
      {
        id: 'architecture-diagrams',
        label: 'Architecture Diagrams',
        icon: 'git-branch',
        route: '/codemart/architect/docs/diagrams',
        roles: ['architect'],
      },
    ],
  },
  {
    id: 'code-review',
    label: 'Code Review',
    icon: 'git-pull-request',
    roles: ['architect'],
    children: [
      {
        id: 'pending-mrs',
        label: 'Pending MRs',
        icon: 'clock',
        route: '/codemart/code-review/queue?status=pending',
        roles: ['architect'],
      },
      {
        id: 'review-history',
        label: 'Review History',
        icon: 'history',
        route: '/codemart/code-review/history',
        roles: ['architect'],
      },
      {
        id: 'quality-metrics',
        label: 'Quality Metrics',
        icon: 'bar-chart',
        route: '/codemart/code-review/metrics',
        roles: ['architect'],
      },
    ],
  },
  {
    id: 'project-monitoring',
    label: 'Project Monitoring',
    icon: 'monitor',
    roles: ['architect'],
    children: [
      {
        id: 'progress-dashboard',
        label: 'Progress Dashboard',
        icon: 'pie-chart',
        route: '/codemart/architect/monitoring/dashboard',
        roles: ['architect'],
      },
      {
        id: 'task-kanban',
        label: 'Task Kanban',
        icon: 'trello',
        route: '/codemart/architect/monitoring/kanban',
        roles: ['architect'],
      },
      {
        id: 'gantt-chart',
        label: 'Gantt Chart',
        icon: 'calendar',
        route: '/codemart/architect/monitoring/gantt',
        roles: ['architect'],
      },
      {
        id: 'risk-analysis',
        label: 'Risk Analysis',
        icon: 'alert-triangle',
        route: '/codemart/architect/monitoring/risks',
        roles: ['architect'],
      },
    ],
  },

  {
    id: 'review-queue',
    label: 'Review Queue',
    icon: 'clipboard',
    roles: ['reviewer'],
    children: [
      {
        id: 'pending-reviews',
        label: 'Pending Reviews',
        icon: 'clock',
        route: '/codemart/reviewer/queue?status=pending',
        roles: ['reviewer'],
      },
      {
        id: 'my-reviews',
        label: 'My Reviews',
        icon: 'user',
        route: '/codemart/reviewer/my-reviews',
        roles: ['reviewer'],
      },
      {
        id: 'reviewer-history',
        label: 'Review History',
        icon: 'history',
        route: '/codemart/reviewer/history',
        roles: ['reviewer'],
      },
    ],
  },
  {
    id: 'review-statistics',
    label: 'Review Statistics',
    icon: 'pie-chart',
    roles: ['reviewer'],
    children: [
      {
        id: 'accuracy-score',
        label: 'Accuracy Score',
        icon: 'target',
        route: '/codemart/reviewer/stats/accuracy',
        roles: ['reviewer'],
      },
      {
        id: 'review-count',
        label: 'Review Count',
        icon: 'hash',
        route: '/codemart/reviewer/stats/count',
        roles: ['reviewer'],
      },
      {
        id: 'reviewer-earnings',
        label: 'Earnings',
        icon: 'dollar-sign',
        route: '/codemart/finance/earnings',
        roles: ['reviewer'],
      },
    ],
  },
  {
    id: 'reviewer-guidelines',
    label: 'Guidelines',
    icon: 'book',
    roles: ['reviewer'],
    children: [
      {
        id: 'review-standards',
        label: 'Review Standards',
        icon: 'check-square',
        route: '/codemart/reviewer/guidelines/standards',
        roles: ['reviewer'],
      },
      {
        id: 'scoring-criteria',
        label: 'Scoring Criteria',
        icon: 'star',
        route: '/codemart/reviewer/guidelines/criteria',
        roles: ['reviewer'],
      },
    ],
  },

  {
    id: 'admin-users',
    label: 'User Management',
    icon: 'users',
    roles: ['admin'],
    children: [
      {
        id: 'admin-developers',
        label: 'Developers',
        icon: 'code',
        route: '/codemart/admin/users?role=developer',
        roles: ['admin'],
      },
      {
        id: 'admin-clients',
        label: 'Clients',
        icon: 'briefcase',
        route: '/codemart/admin/users?role=client',
        roles: ['admin'],
      },
      {
        id: 'admin-architects',
        label: 'Architects',
        icon: 'layers',
        route: '/codemart/admin/users?role=architect',
        roles: ['admin'],
      },
      {
        id: 'admin-reviewers',
        label: 'Reviewers',
        icon: 'clipboard',
        route: '/codemart/admin/users?role=reviewer',
        roles: ['admin'],
      },
      {
        id: 'kyc-verification',
        label: 'KYC Verification',
        icon: 'shield',
        route: '/codemart/admin/users/kyc',
        roles: ['admin'],
      },
    ],
  },
  {
    id: 'admin-projects',
    label: 'Project Management',
    icon: 'folder',
    roles: ['admin'],
    children: [
      {
        id: 'all-projects',
        label: 'All Projects',
        icon: 'folder-open',
        route: '/codemart/admin/projects',
        roles: ['admin'],
      },
      {
        id: 'project-assignment',
        label: 'Project Assignment',
        icon: 'user-plus',
        route: '/codemart/admin/projects/assign',
        roles: ['admin'],
      },
      {
        id: 'dispute-resolution',
        label: 'Dispute Resolution',
        icon: 'alert-triangle',
        route: '/codemart/admin/projects/disputes',
        roles: ['admin'],
      },
    ],
  },
  {
    id: 'admin-finance',
    label: 'Financial Management',
    icon: 'dollar-sign',
    roles: ['admin'],
    children: [
      {
        id: 'transactions',
        label: 'Transactions',
        icon: 'list',
        route: '/codemart/admin/finance/transactions',
        roles: ['admin'],
      },
      {
        id: 'deposits-management',
        label: 'Deposits Management',
        icon: 'database',
        route: '/codemart/admin/finance/deposits',
        roles: ['admin'],
      },
      {
        id: 'commission-settings',
        label: 'Commission Settings',
        icon: 'percent',
        route: '/codemart/admin/finance/commission',
        roles: ['admin'],
      },
      {
        id: 'payment-processing',
        label: 'Payment Processing',
        icon: 'credit-card',
        route: '/codemart/admin/finance/processing',
        roles: ['admin'],
      },
    ],
  },
  {
    id: 'admin-analytics',
    label: 'Platform Analytics',
    icon: 'bar-chart-2',
    roles: ['admin'],
    children: [
      {
        id: 'user-statistics',
        label: 'User Statistics',
        icon: 'users',
        route: '/codemart/admin/analytics/users',
        roles: ['admin'],
      },
      {
        id: 'project-statistics',
        label: 'Project Statistics',
        icon: 'folder',
        route: '/codemart/admin/analytics/projects',
        roles: ['admin'],
      },
      {
        id: 'revenue-reports',
        label: 'Revenue Reports',
        icon: 'trending-up',
        route: '/codemart/admin/analytics/revenue',
        roles: ['admin'],
      },
      {
        id: 'performance-metrics',
        label: 'Performance Metrics',
        icon: 'activity',
        route: '/codemart/admin/analytics/performance',
        roles: ['admin'],
      },
    ],
  },
  {
    id: 'admin-settings',
    label: 'System Settings',
    icon: 'settings',
    roles: ['admin'],
    children: [
      {
        id: 'platform-config',
        label: 'Platform Configuration',
        icon: 'sliders',
        route: '/codemart/admin/settings/platform',
        roles: ['admin'],
      },
      {
        id: 'ai-settings',
        label: 'AI Settings',
        icon: 'cpu',
        route: '/codemart/admin/settings/ai',
        roles: ['admin'],
      },
      {
        id: 'notification-templates',
        label: 'Notification Templates',
        icon: 'bell',
        route: '/codemart/admin/settings/notifications',
        roles: ['admin'],
      },
    ],
  },
];

export function getMenuForRole(role: UserRole): MenuItem[] {
  const menuItems: MenuItem[] = [];
  const stack: MenuItem[][] = [];

  for (const item of codemartMenu) {
    stack.push([item]);
  }

  while (stack.length > 0) {
    const currentLevel = stack.pop();
    if (!currentLevel) continue;

    for (const item of currentLevel) {
      if (item.roles.includes(role)) {
        const filteredItem = { ...item };

        if (item.children) {
          filteredItem.children = item.children.filter(child =>
            child.roles.includes(role)
          );
        }

        menuItems.push(filteredItem);
      }
    }
  }

  return menuItems;
}

export function flattenMenu(menu: MenuItem[]): MenuItem[] {
  const result: MenuItem[] = [];
  const stack: MenuItem[] = [];

  for (const item of menu) {
    stack.push(item);
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    result.push(current);

    if (current.children) {
      for (const child of current.children) {
        stack.push(child);
      }
    }
  }

  return result;
}

export function findMenuItemByRoute(menu: MenuItem[], route: string): MenuItem | null {
  const flatMenu = flattenMenu(menu);

  for (const item of flatMenu) {
    if (item.route === route) {
      return item;
    }
  }

  return null;
}
