import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
    } catch {}
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-3xl flex items-center justify-center mb-4 border border-rose-500/30">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-xl font-black mb-2">Đã xảy ra lỗi hiển thị tạm thời</h1>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            Ứng dụng đã phát hiện sự cố dữ liệu không hợp lệ. Bạn có thể tự động khôi phục ứng dụng chỉ bằng 1 click bên dưới.
          </p>
          <button
            onClick={this.handleReset}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-6 py-3 rounded-2xl text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            🔄 Khôi phục & Tải lại NutriFit
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
