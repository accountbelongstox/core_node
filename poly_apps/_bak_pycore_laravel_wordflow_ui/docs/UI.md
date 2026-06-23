# UI Conventions

## Overlays (mandatory)

Every modal, login dialog, toast and anchored popover must render through the shared Portal with a z-index from the overlay scale — never a raw `fixed inset-0 z-50`.

```tsx
import Portal from '../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_BACKDROP, OVERLAY_Z } from '../../styles/overlay';

<Portal>
  <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
    <div className={`absolute inset-0 ${OVERLAY_BACKDROP}`} onClick={onClose} />
    <div className="relative ...">{/* content */}</div>
  </div>
</Portal>
```

- `OVERLAY_Z`: `modal` (1000) < `login` (1100) < `toast` (1200) < `error` (1300).
- `Portal` appends a fresh node to `<body>` (escapes ancestor stacking/overflow) with optional ref-counted scroll lock.
- The `GlobalLogPanel` bottom dock sits at `z-[150]` — above chrome, below overlays.
- Anchored dropdowns (e.g. `ApiEndpointSwitcher`): capture the button rect, position `fixed` via Portal, close on outside `mousedown` + on scroll/resize reposition.

## Notifications & confirms

```tsx
import { useToast, ConfirmModal } from '../admin';
const toast = useToast();           // toast.success / error / warning / info
```
Destructive actions go through `ConfirmModal` (`isOpen / onClose / onConfirm / title / message / confirmText / cancelText / variant="danger" / loading`).

## Theme & surfaces

- `styles/theme` `commonClasses` — `card`, `input`, `button` + `buttonPrimary`/`buttonSecondary`, etc. Prefer these over ad-hoc classes.
- pycore-manager pages use the `.pc-glass` surface class.
- Dark mode via Tailwind `dark:` variants throughout. Stick to the default Tailwind spacing scale (no `w-4.5`).

## Logging from the UI

`import { logInfo, logSuccess, logError } from '../../core/logstore/logStore'` and log under a category (e.g. `'vocab'`, `'covers'`) for user-visible actions; `BaseAPI` already logs requests.

## Language / code rules

All code strings are English (labels, menu text). Chinese only inside i18n resource blocks. Each pycore-manager page centralizes its hardcoded copy in a local `L` object.
