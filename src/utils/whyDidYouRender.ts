/**
 * Why Did You Render Configuration for Researcher App
 * Tracks unnecessary React component re-renders to identify performance issues
 */

import React from 'react';

// Temporarily disable why-did-you-render to prevent hook order issues with TipTap
// TODO: Re-enable with proper configuration once TipTap compatibility is resolved
if (false && process.env.NODE_ENV === 'development') {
  // Dynamic import for ES modules
  import('@welldone-software/why-did-you-render').then((whyDidYouRenderModule) => {
    const whyDidYouRender = whyDidYouRenderModule.default;
    
    whyDidYouRender(React, {
      // Only track components that are explicitly marked
      trackAllPureComponents: false,
      
      // Disable hook tracking to prevent interference with TipTap
      trackHooks: false,
      
      // Log to console
      logOnDifferentValues: true,
      
      // Include extra information but be less verbose
      logOwnerReasons: false,
      
      // Custom logger that integrates with our memory monitoring
      customLogger: (message: any) => {
        console.group('🔄 Why Did You Render');
        console.warn(message);
        console.groupEnd();
      },
      
      // Include these components for tracking
      include: [
        // We'll mark specific components with whyDidYouRender = true
      ],
      
      // Exclude these components from tracking
      exclude: [
        /^BrowserRouter/,
        /^Router/,
        /^Route/,
        /^Switch/,
        /^Link/,
        /^NavLink/,
        // Exclude TipTap components to prevent hook interference
        /^Editor/,
        /^NodeView/,
        /^ReactNodeView/,
        // Exclude our App component to prevent the hook order issue
        /^App$/,
      ],
      
      // Additional options
      collapseGroups: true,
      titleColor: 'green',
      diffNameColor: 'aqua',
      
      // Reduce tracking to prevent interference
      trackExtraHooks: [],
      onlyLogs: true,
    });

    console.log('🔍 Why Did You Render initialized for development');
  }).catch((error) => {
    console.warn('Failed to load why-did-you-render:', error);
  });
}

/**
 * Helper function to mark components for tracking
 * Usage: markForTracking(MyComponent, 'MyComponent');
 */
export function markForTracking(Component: React.ComponentType<any>, displayName?: string): void {
  if (process.env.NODE_ENV === 'development') {
    (Component as any).whyDidYouRender = true;
    if (displayName) {
      Component.displayName = displayName;
    }
    console.log(`🎯 Marked ${displayName || Component.name || 'Component'} for re-render tracking`);
  }
}

/**
 * Hook to track component renders and log memory usage
 */
export function useRenderTracker(componentName: string, props?: any): void {
  if (process.env.NODE_ENV === 'development') {
    const renderCount = React.useRef(0);
    const prevProps = React.useRef(props);
    
    React.useEffect(() => {
      renderCount.current += 1;
      
      if (renderCount.current > 1) {
        console.group(`🔄 ${componentName} re-rendered (${renderCount.current} times)`);
        
        if (props && prevProps.current) {
          const changedProps = Object.keys(props).filter(
            key => props[key] !== prevProps.current[key]
          );
          
          if (changedProps.length > 0) {
            console.log('Changed props:', changedProps);
            changedProps.forEach(key => {
              console.log(`  ${key}:`, prevProps.current[key], '->', props[key]);
            });
          } else {
            console.warn('No props changed - unnecessary re-render!');
          }
        }
        
        console.groupEnd();
      }
      
      prevProps.current = props;
    });
  }
}

/**
 * Higher-order component to wrap components with render tracking
 */
export function withRenderTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  if (process.env.NODE_ENV !== 'development') {
    return WrappedComponent;
  }

  const TrackedComponent = React.forwardRef<any, P>((props, ref) => {
    useRenderTracker(componentName || WrappedComponent.name || 'Component', props);
    return React.createElement(WrappedComponent, { ...props, ref });
  });

  TrackedComponent.displayName = `withRenderTracking(${componentName || WrappedComponent.name || 'Component'})`;
  
  // Mark for why-did-you-render tracking
  markForTracking(TrackedComponent, TrackedComponent.displayName);
  
  return TrackedComponent;
}

/**
 * Hook to track expensive operations and their impact on renders
 */
export function useExpensiveOperationTracker(operationName: string, dependencies: any[]): void {
  if (process.env.NODE_ENV === 'development') {
    const prevDeps = React.useRef(dependencies);
    const operationCount = React.useRef(0);
    
    React.useEffect(() => {
      operationCount.current += 1;
      
      if (operationCount.current > 1) {
        const changedDeps = dependencies.filter(
          (dep, index) => dep !== prevDeps.current[index]
        );
        
        console.group(`💰 Expensive operation: ${operationName} (${operationCount.current} times)`);
        console.log('Changed dependencies:', changedDeps);
        console.groupEnd();
      }
      
      prevDeps.current = dependencies;
    }, dependencies);
  }
}

export default {
  markForTracking,
  useRenderTracker,
  withRenderTracking,
  useExpensiveOperationTracker,
};
