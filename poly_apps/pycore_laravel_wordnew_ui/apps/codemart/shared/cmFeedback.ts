/** Outcome channel a shared hook reports to: an inline notice on the web, a toast in the mobile UI. */
export interface CmFeedback {
  success: (text: string) => void;
  error: (text: string) => void;
  info?: (text: string) => void;
  clear: () => void;
}
