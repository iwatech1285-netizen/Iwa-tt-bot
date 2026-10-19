import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen flex items-center justify-center bg-[#090d16] text-slate-100 p-6 select-none">
          <div className="max-w-sm w-full p-6 rounded-3xl bg-[#0d1322] border border-red-500/30 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Something Went Wrong</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              An unexpected error occurred while rendering the application. Please reload to restore your session.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
