/**
 * Renderer-side memory optimization utilities
 * Complements the main process memory management
 */

class RendererMemoryOptimizer {
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private isDrawingMode = false;
  private memoryThreshold = 100 * 1024 * 1024; // 100MB threshold
  private criticalThreshold = 200 * 1024 * 1024; // 200MB critical threshold

  constructor() {
    this.startMemoryMonitoring();
    this.setupMemoryPressureHandling();
  }

  /**
   * Start monitoring memory usage in the renderer
   */
  private startMemoryMonitoring() {
    // Check memory every 30 seconds normally, every 10 seconds in drawing mode
    const checkInterval = () => this.isDrawingMode ? 10000 : 30000;
    
    const scheduleNextCheck = () => {
      if (this.memoryCheckInterval) {
        clearTimeout(this.memoryCheckInterval);
      }
      
      this.memoryCheckInterval = setTimeout(() => {
        this.checkMemoryUsage();
        scheduleNextCheck();
      }, checkInterval());
    };

    scheduleNextCheck();
  }

  /**
   * Check current memory usage and take action if needed
   */
  private checkMemoryUsage() {
    if (!window.performance?.memory) {
      return;
    }

    const memory = window.performance.memory;
    const usedMB = memory.usedJSHeapSize / 1024 / 1024;
    const totalMB = memory.totalJSHeapSize / 1024 / 1024;
    const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;

    console.log(`[RendererMemory] Used: ${usedMB.toFixed(2)}MB, Total: ${totalMB.toFixed(2)}MB, Limit: ${limitMB.toFixed(2)}MB`);

    // Take action based on memory usage
    if (memory.usedJSHeapSize > this.criticalThreshold) {
      console.warn('[RendererMemory] Critical memory usage detected, forcing cleanup');
      this.performAggressiveCleanup();
    } else if (memory.usedJSHeapSize > this.memoryThreshold) {
      console.log('[RendererMemory] High memory usage detected, performing cleanup');
      this.performCleanup();
    }
  }

  /**
   * Setup memory pressure event handling
   */
  private setupMemoryPressureHandling() {
    // Listen for memory pressure events if available
    if ('memory' in navigator) {
      // @ts-ignore - experimental API
      navigator.memory?.addEventListener?.('memorypressure', () => {
        console.warn('[RendererMemory] Memory pressure event detected');
        this.performAggressiveCleanup();
      });
    }

    // Listen for visibility change to clean up when hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[RendererMemory] Page hidden, performing cleanup');
        this.performCleanup();
      }
    });

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  /**
   * Set drawing mode status
   */
  setDrawingMode(isDrawing: boolean) {
    this.isDrawingMode = isDrawing;
    console.log(`[RendererMemory] Drawing mode ${isDrawing ? 'activated' : 'deactivated'}`);
    
    if (isDrawing) {
      // More aggressive thresholds in drawing mode
      this.memoryThreshold = 50 * 1024 * 1024; // 50MB
      this.criticalThreshold = 100 * 1024 * 1024; // 100MB
    } else {
      // Normal thresholds
      this.memoryThreshold = 100 * 1024 * 1024; // 100MB
      this.criticalThreshold = 200 * 1024 * 1024; // 200MB
      
      // Perform cleanup when exiting drawing mode
      setTimeout(() => this.performCleanup(), 1000);
    }
  }

  /**
   * Perform standard cleanup
   */
  private performCleanup() {
    // Clear any cached data
    this.clearImageCaches();
    this.clearDOMCaches();
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
      console.log('[RendererMemory] Garbage collection completed');
    }
  }

  /**
   * Perform aggressive cleanup for critical memory situations
   */
  private performAggressiveCleanup() {
    console.warn('[RendererMemory] Performing aggressive cleanup');
    
    // Clear all caches
    this.clearImageCaches();
    this.clearDOMCaches();
    this.clearCanvasCaches();
    
    // Clear any large objects from memory
    this.clearLargeObjects();
    
    // Force multiple GC cycles if available
    if (window.gc) {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => window.gc(), i * 100);
      }
    }
    
    // Notify main process about memory pressure
    if (window.electronAPI?.invoke) {
      window.electronAPI.invoke('memory:force-gc').catch(console.error);
    }
  }

  /**
   * Clear image caches
   */
  private clearImageCaches() {
    // Clear any image caches in the renderer
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
      }
    });

    // Clear canvas contexts if any
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(canvas => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
  }

  /**
   * Clear DOM caches
   */
  private clearDOMCaches() {
    // Clear any cached DOM queries
    if (window.jQuery) {
      // @ts-ignore
      window.jQuery.cache = {};
    }
    
    // Clear any React dev tools caches in development
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        // @ts-ignore
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers?.clear?.();
      }
    }
  }

  /**
   * Clear canvas caches
   */
  private clearCanvasCaches() {
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(canvas => {
      // Clear 2D context
      const ctx2d = canvas.getContext('2d');
      if (ctx2d) {
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      // Clear WebGL context if any (though we disabled WebGL)
      const webglCtx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (webglCtx) {
        const ext = webglCtx.getExtension('WEBGL_lose_context');
        if (ext) {
          ext.loseContext();
        }
      }
    });
  }

  /**
   * Clear large objects from memory
   */
  private clearLargeObjects() {
    // Clear any large arrays or objects that might be cached
    // This is application-specific and should be customized based on your app's data structures
    
    // Example: Clear any global caches
    if (window.appCache) {
      // @ts-ignore
      window.appCache = {};
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    if (!window.performance?.memory) {
      return null;
    }

    const memory = window.performance.memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      limitMB: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
      percentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
    };
  }

  /**
   * Cleanup when shutting down
   */
  cleanup() {
    if (this.memoryCheckInterval) {
      clearTimeout(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    
    this.performAggressiveCleanup();
  }
}

// Create singleton instance
export const rendererMemoryOptimizer = new RendererMemoryOptimizer();

// Export types
export interface MemoryUsage {
  used: number;
  total: number;
  limit: number;
  usedMB: number;
  totalMB: number;
  limitMB: number;
  percentage: number;
}

// Utility functions
export function formatMemorySize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)}MB`;
}

export function getMemoryPressureLevel(usage: MemoryUsage): 'low' | 'medium' | 'high' | 'critical' {
  if (usage.percentage > 90) return 'critical';
  if (usage.percentage > 75) return 'high';
  if (usage.percentage > 50) return 'medium';
  return 'low';
}
