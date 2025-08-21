import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';
import 'katex/dist/katex.min.css';
import { memoryMonitor } from './utils/memoryMonitor';

// Initialize safe render tracking in development (why-did-you-render temporarily disabled)
// import './utils/whyDidYouRender';  // Disabled due to TipTap hook interference
import './utils/simpleRenderTracker';

// Import optimized components for development
let MemoryMonitorDashboard: React.ComponentType | null = null;
let PerformanceMonitor: React.ComponentType<any> | null = null;
let OptimizedApp: React.ComponentType | null = null;

if (process.env.NODE_ENV === 'development') {
  MemoryMonitorDashboard = React.lazy(() => import('./components/MemoryMonitorDashboard'));
  PerformanceMonitor = React.lazy(() => import('./components/PerformanceMonitor').then(m => ({ default: m.PerformanceMonitor })));
  
  // Optionally use optimized app in development for testing
  // OptimizedApp = React.lazy(() => import('./components/optimized/OptimizedApp'));
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
    {PerformanceMonitor && (
      <React.Suspense fallback={null}>
        <PerformanceMonitor isVisible={true} position="bottom-left" />
      </React.Suspense>
    )}
  </React.StrictMode>
);


