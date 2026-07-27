import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
    this.handleReset = this.handleReset.bind(this);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Game engine rendering error caught by boundary:', error, errorInfo);
  }

  public handleReset() {
    (this as any).setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-sm mx-auto p-6 bg-zinc-900 border border-rose-500/30 rounded-2xl text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Game Engine Recovered</h3>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            The game engine encountered an unexpected rendering error. Your wallet state and match entry remain secure.
          </p>

          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-rose-300/80 mb-5 text-left overflow-x-auto truncate">
            {this.state.error?.message || 'Mini-game render process fault'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Engine</span>
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Return Home</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GameErrorBoundary;
