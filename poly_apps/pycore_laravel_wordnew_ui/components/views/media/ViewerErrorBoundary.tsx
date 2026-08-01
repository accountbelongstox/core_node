import React, { Component } from 'react';
import { AlertCircle, Download } from 'lucide-react';

interface ViewerErrorBoundaryProps {
  key?: React.Key;
  children: React.ReactNode;
  /** File name shown in the fallback. */
  fileName?: string;
  /** Optional download URL offered when the viewer cannot render. */
  downloadUrl?: string;
  /** Localized-ish fallback label. */
  label?: string;
}

interface ViewerErrorBoundaryState {
  hasError: boolean;
}

/**
 * Isolates a lazily-loaded media viewer (code editor, epub reader). If its
 * chunk fails to load (e.g. the optional dependency has not been installed yet)
 * or it throws while rendering, the rest of the Media UI keeps working and the
 * user is offered a download instead of a blank crash.
 *
 * Reset is driven by remounting via a `key` on the file id at the call site;
 * componentDidUpdate also clears the error if the file name changes.
 */
class ViewerErrorBoundary extends Component<ViewerErrorBoundaryProps, ViewerErrorBoundaryState> {
  declare props: Readonly<ViewerErrorBoundaryProps>;
  declare setState: (state: Partial<ViewerErrorBoundaryState>) => void;
  state: ViewerErrorBoundaryState;

  constructor(props: ViewerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ViewerErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ViewerErrorBoundaryProps) {
    if (prevProps.fileName !== this.props.fileName && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const label = this.props.label ? this.props.label : 'This viewer failed to load.';
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 p-6 text-center">
        <AlertCircle size={28} className="text-amber-400" />
        <p className="text-sm">{label}</p>
        {this.props.fileName ? (
          <p className="text-xs font-mono text-slate-600">{this.props.fileName}</p>
        ) : null}
        {this.props.downloadUrl ? (
          <a
            href={this.props.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
          >
            <Download size={16} /> Download
          </a>
        ) : null}
      </div>
    );
  }
}

export default ViewerErrorBoundary;
