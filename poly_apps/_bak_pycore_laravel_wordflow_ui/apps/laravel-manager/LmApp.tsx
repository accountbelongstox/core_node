/**
 * laravel-manager end (Lm*).
 *
 * The existing dashboard App is already a complete, self-contained Laravel
 * management UI (sidebar view-switcher + all its views + its own providers).
 * The unified shell mounts it verbatim under /laravel-manager/* so none of that
 * functionality is lost or rewritten; the shell only adds the cross-end chrome
 * around it. Future work can split these views onto real sub-routes.
 */
export { default } from '../../App';
