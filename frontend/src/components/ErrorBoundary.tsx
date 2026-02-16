import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-plex-darker flex items-center justify-center p-4">
                    <div className="bg-plex-dark p-8 rounded-lg max-w-md w-full text-center">
                        <h1 className="text-2xl font-bold text-red-500 mb-4">Algo salió mal</h1>
                        <p className="text-gray-300 mb-6">
                            Ha ocurrido un error inesperado. Por favor, recargue la página o contacte al administrador de Plex.
                        </p>
                        <div className="bg-black/30 p-4 rounded text-left overflow-auto max-h-48 mb-6">
                            <code className="text-red-400 text-xs">
                                {this.state.error?.toString()}
                            </code>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-plex-yellow text-plex-darker px-6 py-2 rounded font-semibold hover:bg-plex-orange transition-colors"
                        >
                            Recargar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
