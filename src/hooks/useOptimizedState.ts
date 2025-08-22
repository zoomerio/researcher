/**
 * Optimized state management hooks
 * Implements lazy initialization, domain division, and selectorization
 */

import React from 'react';
import { shallowEqual } from '../utils/memoization';

/**
 * Lazy state initialization hook
 */
export function useLazyState<T>(
  initializer: () => T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<T>(initializer);
  return [state, setState];
}

/**
 * Optimized state with selector pattern
 */
export function useStateSelector<T, K>(
  state: T,
  selector: (state: T) => K,
  equalityFn: (a: K, b: K) => boolean = shallowEqual
): K {
  const selectedState = React.useMemo(() => selector(state), [state, selector]);
  const prevSelectedState = React.useRef<K>(selectedState);
  
  if (!equalityFn(prevSelectedState.current, selectedState)) {
    prevSelectedState.current = selectedState;
  }
  
  return prevSelectedState.current;
}

/**
 * Domain-specific state management for editor
 */
export interface EditorState {
  content: any;
  selection: any;
  metadata: {
    title: string;
    description: string;
    goals: string;
    hypotheses: string;
    plan: string;
  };
  ui: {
    activeTool: 'text' | 'tables' | 'formulas' | 'graphs' | 'images' | null;
    sidebarView: 'users' | 'research' | 'recent';
    mathEditingState: {
      isEditing: boolean;
      originalPosition: number;
      mathType: 'inline' | 'block';
      originalLatex: string;
    } | null;
  };
  tabs: Array<{
    id: string;
    title: string;
    closable: boolean;
    type: string;
  }>;
  activeTabId: string;
}

/**
 * Editor state hook with domain separation
 */
export function useEditorState() {
  const [state, setState] = React.useState<EditorState>(() => ({
    content: null,
    selection: null,
    metadata: {
      title: '',
      description: '',
      goals: '',
      hypotheses: '',
      plan: '',
    },
    ui: {
      activeTool: 'text',
      sidebarView: 'users',
      mathEditingState: null,
    },
    tabs: [
      { id: 'home', title: 'Начало', closable: false, type: 'home' },
    ],
    activeTabId: 'home',
  }));

  // Optimized updaters for specific domains
  const updateContent = React.useCallback((newContent: any) => {
    setState(prev => ({
      ...prev,
      content: typeof newContent === 'function' ? newContent(prev.content) : newContent
    }));
  }, []);

  const updateMetadata = React.useCallback((updates: Partial<EditorState['metadata']>) => {
    setState(prev => ({
      ...prev,
      metadata: { ...prev.metadata, ...updates }
    }));
  }, []);

  const updateUI = React.useCallback((updates: Partial<EditorState['ui']>) => {
    setState(prev => ({
      ...prev,
      ui: { ...prev.ui, ...updates }
    }));
  }, []);

  const updateTabs = React.useCallback((updater: (tabs: EditorState['tabs']) => EditorState['tabs']) => {
    setState(prev => ({
      ...prev,
      tabs: updater(prev.tabs)
    }));
  }, []);

  const setActiveTab = React.useCallback((tabId: string) => {
    setState(prev => ({
      ...prev,
      activeTabId: tabId
    }));
  }, []);

  // Selectors for specific domains
  const contentSelector = React.useCallback((state: EditorState) => state.content, []);
  const metadataSelector = React.useCallback((state: EditorState) => state.metadata, []);
  const uiSelector = React.useCallback((state: EditorState) => state.ui, []);
  const tabsSelector = React.useCallback((state: EditorState) => state.tabs, []);
  const activeTabSelector = React.useCallback((state: EditorState) => 
    state.tabs.find(tab => tab.id === state.activeTabId), []);

  return {
    // Full state (use sparingly)
    state,
    setState,
    
    // Domain-specific updaters
    updateContent,
    updateMetadata,
    updateUI,
    updateTabs,
    setActiveTab,
    
    // Selectors
    content: useStateSelector(state, contentSelector),
    metadata: useStateSelector(state, metadataSelector),
    ui: useStateSelector(state, uiSelector),
    tabs: useStateSelector(state, tabsSelector),
    activeTab: useStateSelector(state, activeTabSelector),
  };
}

/**
 * Optimized list state for virtualization
 */
export function useVirtualizedListState<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const visibleRange = React.useMemo(() => {
    const startIndex = 0;
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil(containerHeight / itemHeight) + 5 // Buffer for smooth scrolling
    );
    
    return { startIndex, endIndex };
  }, [items.length, itemHeight, containerHeight]);

  const visibleItems = React.useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange.startIndex, visibleRange.endIndex]);

  return {
    visibleItems,
    visibleRange,
    totalHeight: items.length * itemHeight,
  };
}

/**
 * Performance monitoring hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = React.useRef(0);
  const lastRenderTime = React.useRef(Date.now());
  
  React.useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} render #${renderCount.current}, time since last: ${timeSinceLastRender}ms`);
    }
    
    lastRenderTime.current = now;
  });
  
  return {
    renderCount: renderCount.current,
    componentName,
  };
}

