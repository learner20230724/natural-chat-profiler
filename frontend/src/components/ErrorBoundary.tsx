/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Reload the page to reset the app state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-3xl font-bold text-gray-800 mb-4">
                应用程序出错
              </h1>
              <p className="text-gray-600 mb-6">
                抱歉，应用程序遇到了一个错误。请尝试刷新页面。
              </p>
              
              {this.state.error && (
                <div className="mb-6 p-4 bg-red-50 rounded-lg text-left">
                  <p className="text-sm font-semibold text-red-800 mb-2">
                    错误详情:
                  </p>
                  <p className="text-sm text-red-700 font-mono">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}

              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
