# UI Component Architecture

## New Component Structure

```
src/components/
├── layout/
│   ├── Sidebar/
│   │   ├── Sidebar.tsx                    # Main sidebar container
│   │   ├── SidebarHeader.tsx              # Logo + collapse button
│   │   ├── SidebarSearch.tsx              # Search bar
│   │   ├── SidebarGroup.tsx               # Collapsible group
│   │   ├── SidebarItem.tsx                # Navigation item
│   │   └── SidebarFooter.tsx              # User profile
│   │
│   ├── Header/
│   │   ├── Header.tsx                     # Main header
│   │   ├── Breadcrumb.tsx                 # Breadcrumb navigation
│   │   ├── CommandPalette.tsx             # Search/command (Ctrl+K)
│   │   └── HeaderControls.tsx             # Theme/Lang/User
│   │
│   └── Layout.tsx                         # Main layout wrapper
│
├── server-manager/
│   ├── ServerManager.tsx                  # Main container
│   │
│   ├── Dashboard/
│   │   ├── Dashboard.tsx                  # Dashboard view
│   │   ├── StatusCard.tsx                 # Status summary card
│   │   ├── RecentActivity.tsx             # Activity timeline
│   │   ├── QuickActions.tsx               # Quick action buttons
│   │   └── SystemHealth.tsx               # Health indicators
│   │
│   ├── NginxManager/
│   │   ├── NginxManager.tsx               # Nginx tab
│   │   ├── NginxSiteCard.tsx              # Site card (grid/list)
│   │   ├── NginxSiteModal.tsx             # Create/Edit modal
│   │   ├── NginxToolbar.tsx               # Search + Actions
│   │   └── NginxConfigViewer.tsx          # Config viewer
│   │
│   ├── SSLManager/
│   │   ├── SSLManager.tsx                 # SSL tab
│   │   ├── SSLCertCard.tsx                # Certificate card
│   │   ├── SSLGenerateModal.tsx           # Generate modal
│   │   └── SSLToolbar.tsx                 # Actions
│   │
│   ├── FileManager/
│   │   ├── FileManager.tsx                # File browser
│   │   ├── FileTree.tsx                   # Tree view
│   │   ├── FileList.tsx                   # List view
│   │   ├── FileViewer.tsx                 # File preview
│   │   └── FileToolbar.tsx                # Actions
│   │
│   ├── ScriptExecutor/
│   │   ├── ScriptExecutor.tsx             # Scripts tab
│   │   ├── ScriptCard.tsx                 # Script card
│   │   ├── ScriptConsole.tsx              # Output console
│   │   └── ScriptToolbar.tsx              # Actions
│   │
│   ├── UnifiedManager/
│   │   ├── UnifiedManager.tsx             # Apps tab
│   │   ├── AppCard.tsx                    # App card
│   │   ├── AppDeployModal.tsx             # Deploy modal
│   │   └── AppToolbar.tsx                 # Actions
│   │
│   └── shared/
│       ├── ViewToggle.tsx                 # Card/Grid/List toggle
│       ├── SearchBar.tsx                  # Search input
│       ├── FilterBar.tsx                  # Filter controls
│       ├── EmptyState.tsx                 # Empty state
│       ├── LoadingState.tsx               # Loading skeleton
│       └── ErrorState.tsx                 # Error display
│
└── ui/
    ├── Button.tsx                         # Button component
    ├── Input.tsx                          # Input component
    ├── Select.tsx                         # Select component
    ├── Modal.tsx                          # Modal component
    ├── Card.tsx                           # Card component
    ├── Badge.tsx                          # Badge component
    ├── Tooltip.tsx                        # Tooltip component
    └── Skeleton.tsx                       # Skeleton loader
```

---

## Component Props Interfaces

### Sidebar Components

```typescript
// SidebarGroup.tsx
interface SidebarGroupProps {
  title: string;
  icon?: LucideIcon;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

// SidebarItem.tsx
interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: string | number;
  onClick: () => void;
}

// SidebarSearch.tsx
interface SidebarSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}
```

### Header Components

```typescript
// Breadcrumb.tsx
interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

// CommandPalette.tsx
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

interface Command {
  id: string;
  label: string;
  icon?: LucideIcon;
  action: () => void;
  keywords?: string[];
}
```

### ServerManager Dashboard

```typescript
// Dashboard.tsx
interface DashboardProps {
  stats: ServerStats;
  activities: Activity[];
  quickActions: QuickAction[];
}

interface ServerStats {
  nginxSites: { total: number; enabled: number };
  sslCerts: { total: number; expiring: number };
  unifiedApps: { total: number; running: number };
  scripts: { total: number; recent: number };
}

interface Activity {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  action: () => void;
}

// StatusCard.tsx
interface StatusCardProps {
  title: string;
  count: number;
  icon: LucideIcon;
  status: 'healthy' | 'warning' | 'error';
  trend?: { value: number; direction: 'up' | 'down' };
  onClick?: () => void;
}
```

### Nginx Manager

```typescript
// NginxManager.tsx
interface NginxManagerProps {
  view: 'card' | 'grid' | 'list';
  onViewChange: (view: ViewType) => void;
}

// NginxSiteCard.tsx
interface NginxSiteCardProps {
  site: NginxSite;
  view: 'card' | 'grid' | 'list';
  onEdit: (site: NginxSite) => void;
  onDelete: (siteName: string) => void;
  onToggle: (siteName: string, enabled: boolean) => void;
  onViewConfig: (siteName: string) => void;
}

// NginxToolbar.tsx
interface NginxToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  onReload: () => void;
  onTestConfig: () => void;
  onCreate: () => void;
  selectedCount?: number;
  onBulkAction?: (action: string) => void;
}
```

### Shared Components

```typescript
// ViewToggle.tsx
interface ViewToggleProps {
  view: 'card' | 'grid' | 'list';
  onChange: (view: ViewType) => void;
}

// SearchBar.tsx
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

// EmptyState.tsx
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// LoadingState.tsx
interface LoadingStateProps {
  count?: number;
  type?: 'card' | 'list' | 'table';
}
```

---

## State Management

### ServerManager Context

```typescript
// contexts/ServerManagerContext.tsx
interface ServerManagerContextType {
  // State
  activeTab: ServerTab;
  view: ViewType;
  searchQuery: string;
  filters: FilterState;

  // Actions
  setActiveTab: (tab: ServerTab) => void;
  setView: (view: ViewType) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: FilterState) => void;

  // Data
  nginxSites: AsyncState<NginxSite[]>;
  sslCerts: AsyncState<SSLCertificate[]>;
  unifiedApps: AsyncState<UnifiedApp[]>;
  scripts: AsyncState<PredefinedScript[]>;

  // Operations
  loadNginxSites: () => Promise<void>;
  createNginxSite: (data: NginxSiteCreateRequest) => Promise<void>;
  deleteNginxSite: (siteName: string) => Promise<void>;
  // ... other operations
}
```

### UI State Management

```typescript
// hooks/useServerManagerUI.ts
interface ServerManagerUIState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  selectedItems: string[];
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
}

function useServerManagerUI() {
  const [state, setState] = useState<ServerManagerUIState>({
    sidebarCollapsed: false,
    commandPaletteOpen: false,
    selectedItems: [],
    sortBy: 'name',
    sortOrder: 'asc'
  });

  const toggleSidebar = () => {
    setState(prev => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
  };

  const openCommandPalette = () => {
    setState(prev => ({ ...prev, commandPaletteOpen: true }));
  };

  // ... other methods

  return {
    ...state,
    toggleSidebar,
    openCommandPalette,
    // ... other methods
  };
}
```

---

## Routing Structure

### New Route Organization

```typescript
// routes.ts
const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      // Development
      { path: 'media', element: <MediaBrowser /> },
      { path: 'code', element: <CodeBrowser /> },
      { path: 'tools', element: <UnifiedTools /> },
      { path: 'api', element: <ApiTester /> },

      // Management
      {
        path: 'server',
        element: <ServerManager />,
        children: [
          { path: '', element: <Dashboard /> },
          { path: 'nginx', element: <NginxManager /> },
          { path: 'ssl', element: <SSLManager /> },
          { path: 'files', element: <FileManager /> },
          { path: 'scripts', element: <ScriptExecutor /> },
          { path: 'apps', element: <UnifiedManager /> },
        ]
      },
      { path: 'octane', element: <OctaneTasks /> },
      { path: 'mcp', element: <MCPManager /> },

      // Learning
      { path: 'vocabulary', element: <Vocabulary /> },
      { path: 'ai-tools', element: <AITools /> },

      // System
      { path: 'system', element: <SystemInfo /> },
      { path: 'settings', element: <Settings /> },
      { path: 'invite-codes', element: <InviteCodes /> },
    ]
  }
];
```

### Deep Linking

```typescript
// Navigation examples
/server                    → Dashboard
/server/nginx              → Nginx Manager
/server/nginx?search=api   → Nginx with search
/server/ssl?expiring=true  → SSL with filter
```

---

## Keyboard Shortcuts

```typescript
// hooks/useKeyboardShortcuts.ts
const shortcuts = {
  // Global
  'Ctrl+K': () => openCommandPalette(),
  'Ctrl+/': () => toggleSidebar(),
  'Ctrl+B': () => toggleSidebar(),

  // Navigation
  'Ctrl+1': () => navigateTo('/media'),
  'Ctrl+2': () => navigateTo('/code'),
  'Ctrl+3': () => navigateTo('/tools'),
  'Ctrl+4': () => navigateTo('/server'),

  // Server Manager
  'Ctrl+N': () => createNew(),
  'Ctrl+R': () => reload(),
  'Ctrl+F': () => focusSearch(),
  'Ctrl+T': () => testConfig(),

  // View switching
  'Ctrl+Shift+1': () => setView('card'),
  'Ctrl+Shift+2': () => setView('grid'),
  'Ctrl+Shift+3': () => setView('list'),
};
```

---

## Animation & Transitions

```typescript
// constants/animations.ts
export const transitions = {
  // Sidebar
  sidebarCollapse: {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },

  // Modal
  modalFade: {
    enter: 200,
    exit: 150
  },

  // List items
  listItemStagger: {
    delay: 50,
    duration: 200
  },

  // Cards
  cardHover: {
    scale: 1.02,
    duration: 150
  }
};
```

---

## Accessibility

### ARIA Labels

```typescript
// Sidebar
<nav aria-label="Main navigation">
  <button aria-expanded={expanded} aria-controls="nav-group">
    Development
  </button>
</nav>

// Command Palette
<div role="dialog" aria-modal="true" aria-labelledby="command-title">
  <input
    type="search"
    role="combobox"
    aria-controls="command-list"
    aria-expanded={showResults}
  />
</div>

// Status Cards
<div role="status" aria-live="polite">
  {count} nginx sites
</div>
```

### Keyboard Navigation

```typescript
// Focus management
const handleKeyDown = (e: KeyboardEvent) => {
  switch(e.key) {
    case 'ArrowDown':
      focusNextItem();
      break;
    case 'ArrowUp':
      focusPreviousItem();
      break;
    case 'Enter':
      activateItem();
      break;
    case 'Escape':
      closeModal();
      break;
  }
};
```

---

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy components
const ServerManager = lazy(() => import('./views/ServerManager'));
const CodeBrowser = lazy(() => import('./views/CodeBrowser'));
const MCPManager = lazy(() => import('./views/MCPManager'));

// Suspense wrapper
<Suspense fallback={<LoadingState />}>
  <ServerManager />
</Suspense>
```

### Virtualization

```typescript
// For large lists (>100 items)
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={sites.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <NginxSiteCard site={sites[index]} />
    </div>
  )}
</FixedSizeList>
```

### Memoization

```typescript
// Expensive computations
const filteredSites = useMemo(() => {
  return sites.filter(site =>
    site.domain.includes(searchQuery)
  );
}, [sites, searchQuery]);

// Callbacks
const handleDelete = useCallback((siteName: string) => {
  deleteSite(siteName);
}, [deleteSite]);
```

---

## Testing Strategy

### Component Tests

```typescript
// SidebarItem.test.tsx
describe('SidebarItem', () => {
  it('renders with icon and label', () => {
    render(<SidebarItem icon={Server} label="Server" />);
    expect(screen.getByText('Server')).toBeInTheDocument();
  });

  it('shows active state', () => {
    render(<SidebarItem active={true} />);
    expect(screen.getByRole('button')).toHaveClass('active');
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<SidebarItem onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// ServerManager.test.tsx
describe('ServerManager', () => {
  it('loads nginx sites on mount', async () => {
    render(<ServerManager />);
    await waitFor(() => {
      expect(screen.getByText(/example.com/)).toBeInTheDocument();
    });
  });

  it('creates new site', async () => {
    render(<ServerManager />);
    fireEvent.click(screen.getByText('New Site'));
    // ... fill form and submit
    await waitFor(() => {
      expect(screen.getByText('Site created')).toBeInTheDocument();
    });
  });
});
```

---

## Migration Plan

### Step 1: Create New Components (No Breaking Changes)
- Build new Sidebar component alongside old one
- Build new ServerManager Dashboard
- Test in isolation

### Step 2: Feature Flag
```typescript
const USE_NEW_UI = process.env.REACT_APP_NEW_UI === 'true';

return USE_NEW_UI ? <NewSidebar /> : <OldSidebar />;
```

### Step 3: Gradual Rollout
- Week 1: Internal testing
- Week 2: Beta users (10%)
- Week 3: All users (100%)

### Step 4: Remove Old Code
- After 2 weeks of stable new UI
- Remove old components
- Update documentation

---

## Summary

This architecture provides:

✅ **Modularity**: Reusable components
✅ **Scalability**: Easy to add new features
✅ **Maintainability**: Clear structure
✅ **Performance**: Optimized rendering
✅ **Accessibility**: WCAG 2.1 AA compliant
✅ **Testing**: Comprehensive test coverage

**Total New Components**: ~40 components
**Estimated Development Time**: 3-4 weeks
**Estimated Bundle Size Increase**: +150KB (gzipped)
