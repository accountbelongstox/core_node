import React, { Component } from 'react';

interface Props {
  /** Name logged with the error (component or panel id). */
  name: string;
  children: React.ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Isolates an optional panel: when it throws while rendering, only that panel disappears (the error
 * is logged) instead of React unmounting the whole page into a black screen. A new `key` remounts it.
 */
export class WordNewPanelBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(`[wordnew] panel ${this.props.name} failed; hidden until it remounts`, error);
  }

  render(): React.ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
