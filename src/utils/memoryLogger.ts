/**
 * Memory Logger for High-Impact Operations
 * Automatically logs memory usage for operations that typically consume significant memory
 */

import { memoryMonitor } from './memoryMonitor';
import React from 'react';

/**
 * Decorator for logging memory usage of class methods
 */
export function logMemoryUsage(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const methodName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return await memoryMonitor.logOperation(methodName, async () => {
        return await originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

/**
 * Higher-order function to wrap functions with memory logging
 */
export function withMemoryLogging<T extends (...args: any[]) => any>(
  fn: T,
  operationName?: string
): T {
  const name = operationName || fn.name || 'Anonymous Function';
  
  return (async (...args: any[]) => {
    return await memoryMonitor.logOperation(name, async () => {
      return await fn(...args);
    });
  }) as T;
}

/**
 * Memory-aware operations tracker
 * Tracks common memory-intensive operations in the app
 */
export class MemoryAwareOperations {
  
  /**
   * Log document loading operations
   */
  static async logDocumentLoad(operation: () => Promise<any>, documentName?: string): Promise<any> {
    const operationName = `Document Load${documentName ? ` - ${documentName}` : ''}`;
    return await memoryMonitor.logOperation(operationName, operation);
  }

  /**
   * Log image processing operations
   */
  static async logImageProcessing(operation: () => Promise<any>, imageInfo?: string): Promise<any> {
    const operationName = `Image Processing${imageInfo ? ` - ${imageInfo}` : ''}`;
    return await memoryMonitor.logOperation(operationName, operation);
  }

  /**
   * Log TipTap editor operations
   */
  static async logEditorOperation(operation: () => Promise<any>, operationType?: string): Promise<any> {
    const operationName = `Editor Operation${operationType ? ` - ${operationType}` : ''}`;
    return await memoryMonitor.logOperation(operationName, operation);
  }

  /**
   * Log math rendering operations
   */
  static async logMathRendering(operation: () => Promise<any>, mathType?: string): Promise<any> {
    const operationName = `Math Rendering${mathType ? ` - ${mathType}` : ''}`;
    return await memoryMonitor.logOperation(operationName, operation);
  }

  /**
   * Log chart/graph rendering operations
   */
  static async logChartRendering(operation: () => Promise<any>, chartType?: string): Promise<any> {
    const operationName = `Chart Rendering${chartType ? ` - ${chartType}` : ''}`;
    return await memoryMonitor.logOperation(operationName, operation);
  }

  /**
   * Log table operations
   */
  static async logTableOperation(operation: () => Promise<any>, tableInfo?: string): Promise<any> {
    const operationName = `Table Operation${tableInfo ? ` - ${tableInfo}` : ''}`;
    return await memoryMonitor.logOperation(operationName, operation);
  }

  /**
   * Log file I/O operations
   */
  static async logFileOperation(operation: () => Promise<any>, fileOperation?: string): Promise<any> {
    const operationName = `File Operation${fileOperation ? ` - ${fileOperation}` : ''}`;
    return await memoryMonitor.logOperation(operationName, operation);
  }
}

/**
 * React Hook for logging component mount/unmount memory impact
 */
export function useMemoryLogger(componentName: string, dependencies?: any[]) {
  if (typeof window === 'undefined') return;
  
  React.useEffect(() => {
    memoryMonitor.logMemoryInfo(`${componentName} - Mount`);
    
    return () => {
      memoryMonitor.logMemoryInfo(`${componentName} - Unmount`);
    };
  }, [componentName]);

  // Log when dependencies change
  React.useEffect(() => {
    if (dependencies) {
      memoryMonitor.logMemoryInfo(`${componentName} - Dependencies Changed`);
    }
  }, dependencies);
}

/**
 * Automatic memory logging for common operations
 */
export class AutoMemoryLogger {
  private static originalFetch: typeof fetch;
  private static originalSetTimeout: typeof setTimeout;
  private static originalSetInterval: typeof setInterval;

  /**
   * Initialize automatic logging for common operations
   */
  static initialize() {
    if (typeof window === 'undefined') return;

    // Log fetch operations
    if (!this.originalFetch && typeof fetch !== 'undefined') {
      this.originalFetch = fetch;
      (window as any).fetch = async (...args: Parameters<typeof fetch>) => {
        return await memoryMonitor.logOperation(`Fetch - ${args[0]}`, async () => {
          return await this.originalFetch(...args);
        });
      };
    }

    // Log large timeouts (potential memory leaks)
    if (!this.originalSetTimeout) {
      this.originalSetTimeout = setTimeout;
      (window as any).setTimeout = (callback: Function, delay: number, ...args: any[]) => {
        if (delay > 10000) { // Log timeouts longer than 10 seconds
          console.warn(`🕐 Long timeout detected: ${delay}ms`);
          memoryMonitor.logMemoryInfo(`Long Timeout - ${delay}ms`);
        }
        return this.originalSetTimeout(callback, delay, ...args);
      };
    }

    // Log intervals (potential memory leaks)
    if (!this.originalSetInterval) {
      this.originalSetInterval = setInterval;
      (window as any).setInterval = (callback: Function, delay: number, ...args: any[]) => {
        console.warn(`🔄 Interval created: ${delay}ms`);
        memoryMonitor.logMemoryInfo(`Interval Created - ${delay}ms`);
        return this.originalSetInterval(callback, delay, ...args);
      };
    }

    console.log('🤖 Auto memory logging initialized');
  }

  /**
   * Restore original functions
   */
  static restore() {
    if (typeof window === 'undefined') return;

    if (this.originalFetch) {
      (window as any).fetch = this.originalFetch;
    }
    if (this.originalSetTimeout) {
      (window as any).setTimeout = this.originalSetTimeout;
    }
    if (this.originalSetInterval) {
      (window as any).setInterval = this.originalSetInterval;
    }

    console.log('🔄 Auto memory logging restored');
  }
}

// Initialize auto logging in development
if (process.env.NODE_ENV === 'development') {
  AutoMemoryLogger.initialize();
}

export default {
  logMemoryUsage,
  withMemoryLogging,
  MemoryAwareOperations,
  useMemoryLogger,
  AutoMemoryLogger,
};
