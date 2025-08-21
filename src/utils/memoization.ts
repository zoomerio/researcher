/**
 * Deep memoization utilities for React components
 * Provides custom comparison functions and memoization helpers
 */

import React from 'react';

/**
 * Deep comparison function for complex objects
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * Shallow comparison for props (faster than deep comparison)
 */
export function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || a[key] !== b[key]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Custom comparison for TipTap node props
 */
export function nodePropsEqual(prevProps: any, nextProps: any): boolean {
  // Fast path: if references are the same
  if (prevProps === nextProps) return true;
  
  // Check node identity first (most important)
  if (prevProps.node !== nextProps.node) return false;
  
  // Check attributes with shallow comparison (attributes are usually flat objects)
  if (!shallowEqual(prevProps.node?.attrs, nextProps.node?.attrs)) return false;
  
  // Check other important props
  const importantProps = ['selected', 'editor', 'getPos'];
  for (const prop of importantProps) {
    if (prevProps[prop] !== nextProps[prop]) return false;
  }
  
  return true;
}

/**
 * Custom comparison for editor toolbar props
 */
export function toolbarPropsEqual(prevProps: any, nextProps: any): boolean {
  // Check editor state
  if (prevProps.editor !== nextProps.editor) return false;
  
  // Check active tool
  if (prevProps.activeTool !== nextProps.activeTool) return false;
  
  // Check editor selection/state
  if (prevProps.editor?.state?.selection !== nextProps.editor?.state?.selection) return false;
  
  return true;
}

/**
 * Memoization wrapper with custom comparison
 */
export function memoizeComponent<T extends React.ComponentType<any>>(
  component: T,
  areEqual?: (prevProps: React.ComponentProps<T>, nextProps: React.ComponentProps<T>) => boolean
): T {
  return React.memo(component, areEqual) as T;
}

/**
 * Memoization for expensive calculations
 */
export function memoizeCalculation<T extends (...args: any[]) => any>(
  fn: T,
  deps: React.DependencyList
): ReturnType<T> {
  return React.useMemo(fn, deps);
}

/**
 * Debounced callback hook
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList
): T {
  const timeoutRef = React.useRef<NodeJS.Timeout>();
  
  return React.useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [...deps, delay]
  );
}

/**
 * Throttled callback hook
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList
): T {
  const lastRun = React.useRef(Date.now());
  
  return React.useCallback(
    ((...args: Parameters<T>) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = Date.now();
      }
    }) as T,
    [...deps, delay]
  );
}

/**
 * Stable callback that doesn't change between renders
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = React.useRef(callback);
  
  // Update the ref on each render
  React.useLayoutEffect(() => {
    callbackRef.current = callback;
  });
  
  // Return a stable function that calls the current callback
  return React.useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    []
  );
}
