import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Valubuild ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF8F4] text-[#26231E]">
          <div className="max-w-md w-full bg-white border border-[#E2DBD0] rounded-[6px] p-6 space-y-4">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              Something interrupted the valuation workspace
            </h2>
            <p className="text-sm text-[#6B6459] leading-relaxed">
              {this.state.errorMessage.slice(0, 260)}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary text-sm !py-2 !px-4"
            >
              Reload Valubuild
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
