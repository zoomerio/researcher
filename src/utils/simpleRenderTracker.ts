/**
 * Simple Render Tracker - Safe Alternative to why-did-you-render
 * Provides basic re-render tracking without interfering with complex hooks like TipTap
 */

import React from 'react';

/**
 * Simple hook to track component renders without interfering with other hooks
 */
export function useRenderCounter(componentName: string, props?: any): void {
  if (process.env.NODE_ENV !== 'development') return;

  const renderCount = React.useRef(0);
  const prevProps = React.useRef(props);
  const mountTime = React.useRef(Date.now());

  renderCount.current += 1;

  React.useEffect(() => {
    if (renderCount.current === 1) {
      console.log(`🎯 ${componentName} mounted (render #${renderCount.current})`);
    } else {
      const timeSinceMount = Date.now() - mountTime.current;
      console.log(`🔄 ${componentName} re-rendered (render #${renderCount.current}) after ${timeSinceMount}ms`);
      
      if (props && prevProps.current) {
        const changedProps = Object.keys(props).filter(
          key => props[key] !== prevProps.current[key]
        );
        
        if (changedProps.length > 0) {
          console.log(`  📝 Changed props in ${componentName}:`, changedProps);
        } else {
          console.warn(`  ⚠️ ${componentName} re-rendered with no prop changes!`);
        }
      }
    }
    
    prevProps.current = props;
  });

  React.useEffect(() => {
    return () => {
      console.log(`🗑️ ${componentName} unmounted after ${renderCount.current} renders`);
    };
  }, [componentName]);
}

/**
 * Higher-order component for tracking renders safely
 */
export function withRenderCounter<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  if (process.env.NODE_ENV !== 'development') {
    return WrappedComponent;
  }

  const TrackedComponent: React.FC<P> = (props) => {
    useRenderCounter(componentName || WrappedComponent.name || 'Component', props);
    return React.createElement(WrappedComponent, props as P);
  };

  TrackedComponent.displayName = `withRenderCounter(${componentName || WrappedComponent.name || 'Component'})`;
  
  return TrackedComponent;
}

/**
 * Hook to track expensive operations and their frequency
 */
export function useOperationTracker(operationName: string, dependencies: any[]): void {
  if (process.env.NODE_ENV !== 'development') return;

  const operationCount = React.useRef(0);
  const lastOperation = React.useRef(Date.now());

  React.useEffect(() => {
    operationCount.current += 1;
    const now = Date.now();
    const timeSinceLast = now - lastOperation.current;
    
    if (operationCount.current > 1) {
      console.log(`💰 Expensive operation "${operationName}" executed ${operationCount.current} times (${timeSinceLast}ms since last)`);
      
      if (timeSinceLast < 100) {
        console.warn(`  ⚠️ Rapid re-execution of "${operationName}" - possible performance issue!`);
      }
    }
    
    lastOperation.current = now;
  }, dependencies);
}

/**
 * Simple performance monitor for components
 */
export function usePerformanceMonitor(componentName: string): void {
  if (process.env.NODE_ENV !== 'development') return;

  const startTime = React.useRef(performance.now());
  
  React.useLayoutEffect(() => {
    const renderTime = performance.now() - startTime.current;
    
    if (renderTime > 16) { // More than one frame (16ms)
      console.warn(`🐌 Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }
    
    startTime.current = performance.now();
  });
}

/**
 * Memory-safe component tracker that won't interfere with complex hooks
 */
export const RenderTracker = {
  useRenderCounter,
  withRenderCounter,
  useOperationTracker,
  usePerformanceMonitor,
};

export default RenderTracker;

