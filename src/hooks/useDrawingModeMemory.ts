import { useEffect, useCallback } from 'react';

/**
 * Hook to manage memory optimization for drawing mode
 * Communicates with the main process to enable aggressive memory management
 * when drawing mode is active
 */
export function useDrawingModeMemory() {
  const notifyDrawingModeActivated = useCallback(() => {
    if (window.electronAPI?.ipcRenderer) {
      window.electronAPI.ipcRenderer.send('drawing-mode:activated');
      console.log('[Renderer] Drawing mode activated - notified main process');
    }
  }, []);

  const notifyDrawingModeDeactivated = useCallback(() => {
    if (window.electronAPI?.ipcRenderer) {
      window.electronAPI.ipcRenderer.send('drawing-mode:deactivated');
      console.log('[Renderer] Drawing mode deactivated - notified main process');
    }
  }, []);

  const clearMemoryCache = useCallback(async () => {
    if (window.electronAPI?.invoke) {
      try {
        const result = await window.electronAPI.invoke('memory:clear-cache');
        if (result.success) {
          console.log('[Renderer] Memory cache cleared successfully');
        } else {
          console.warn('[Renderer] Failed to clear memory cache:', result.error);
        }
        return result;
      } catch (error) {
        console.error('[Renderer] Error clearing memory cache:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron API not available' };
  }, []);

  const getDetailedMemoryUsage = useCallback(async () => {
    if (window.electronAPI?.invoke) {
      try {
        const result = await window.electronAPI.invoke('memory:get-detailed-usage');
        return result;
      } catch (error) {
        console.error('[Renderer] Error getting memory usage:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron API not available' };
  }, []);

  const forceGarbageCollection = useCallback(async () => {
    if (window.electronAPI?.invoke) {
      try {
        const result = await window.electronAPI.invoke('memory:force-gc');
        if (result.success) {
          console.log('[Renderer] Garbage collection forced:', result.message);
        }
        return result;
      } catch (error) {
        console.error('[Renderer] Error forcing GC:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron API not available' };
  }, []);

  // Listen for memory management events from main process
  useEffect(() => {
    if (window.electronAPI?.ipcRenderer) {
      const handleForceGC = () => {
        // Trigger renderer-side garbage collection if available
        if (window.gc) {
          window.gc();
          console.log('[Renderer] Forced garbage collection completed');
        }
        
        // Clear any large objects or caches in the renderer
        if (window.performance?.memory) {
          console.log('[Renderer] Memory after GC:', {
            used: Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
            total: Math.round(window.performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
            limit: Math.round(window.performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
          });
        }
      };

      window.electronAPI.ipcRenderer.on('memory:force-gc', handleForceGC);

      return () => {
        window.electronAPI.ipcRenderer.removeListener('memory:force-gc', handleForceGC);
      };
    }
  }, []);

  return {
    notifyDrawingModeActivated,
    notifyDrawingModeDeactivated,
    clearMemoryCache,
    getDetailedMemoryUsage,
    forceGarbageCollection,
  };
}

/**
 * Higher-order component to automatically manage drawing mode memory optimization
 */
export function withDrawingModeMemory<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  isDrawingMode: (props: T) => boolean
) {
  return function DrawingModeMemoryWrapper(props: T) {
    const { notifyDrawingModeActivated, notifyDrawingModeDeactivated } = useDrawingModeMemory();
    
    useEffect(() => {
      if (isDrawingMode(props)) {
        notifyDrawingModeActivated();
        return () => {
          notifyDrawingModeDeactivated();
        };
      }
    }, [isDrawingMode(props), notifyDrawingModeActivated, notifyDrawingModeDeactivated]);

    return <WrappedComponent {...props} />;
  };
}
