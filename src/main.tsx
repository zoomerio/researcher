import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';
import 'katex/dist/katex.min.css';
import { memoryMonitor } from './utils/memoryMonitor';

// Initialize safe render tracking in development
import './utils/simpleRenderTracker';

// Import development components
let MemoryMonitorDashboard: React.ComponentType | null = null;

if (process.env.NODE_ENV === 'development') {
  MemoryMonitorDashboard = React.lazy(() => import('./components/MemoryMonitorDashboard'));
}

// Simple approach - rely on TipTap Mathematics extension only
console.log('KaTeX CSS loaded via import');

// Initialize memory monitoring
memoryMonitor.logMemoryInfo('App Initialization');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {MemoryMonitorDashboard && (
      <React.Suspense fallback={null}>
        <MemoryMonitorDashboard />
      </React.Suspense>
    )}
  </React.StrictMode>
);


