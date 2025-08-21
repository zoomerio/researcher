/**
 * Memory Monitoring Utility for Researcher App
 * Provides comprehensive memory tracking and logging
 */

interface MemoryInfo {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

class MemoryMonitor {
  private isElectron: boolean;
  private intervalId: NodeJS.Timeout | null = null;
  private memoryHistory: MemoryInfo[] = [];
  private maxHistorySize = 100;
  private operationLogs: Array<{
    operation: string;
    memoryBefore: MemoryInfo;
    memoryAfter: MemoryInfo;
    timestamp: number;
  }> = [];

  constructor() {
    this.isElectron = typeof window !== 'undefined' && (window as any).api;
    this.logMemoryInfo('MemoryMonitor initialized');
  }

  /**
   * Get current memory usage information
   */
  private async getCurrentMemoryInfo(): Promise<MemoryInfo> {
    const timestamp = Date.now();

    if (this.isElectron && (window as any).api?.getMemoryUsage) {
      // Electron main process memory info
      try {
        const memoryData = await (window as any).api.getMemoryUsage();
        return {
          ...memoryData,
          timestamp
        };
      } catch (error) {
        console.warn('Failed to get Electron memory usage:', error);
      }
    }
    
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      // Browser memory info (Chrome/Chromium)
      const memory = (performance as any).memory as PerformanceMemory;
      return {
        rss: memory.totalJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        heapUsed: memory.usedJSHeapSize,
        external: 0,
        arrayBuffers: 0,
        timestamp
      };
    } else {
      // Fallback - estimate based on available info
      return {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0,
        timestamp
      };
    }
  }

  /**
   * Format memory size in human-readable format
   */
  private formatMemorySize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Log current memory information to console
   */
  async logMemoryInfo(context?: string): Promise<MemoryInfo> {
    const memInfo = await this.getCurrentMemoryInfo();
    
    const contextStr = context ? `[${context}] ` : '';
    console.group(`${contextStr}🧠 Memory Usage - ${new Date(memInfo.timestamp).toLocaleTimeString()}`);
    
    if (memInfo.rss > 0) {
      console.log(`📊 RSS (Resident Set Size): ${this.formatMemorySize(memInfo.rss)}`);
      console.log(`🏠 Heap Total: ${this.formatMemorySize(memInfo.heapTotal)}`);
      console.log(`💾 Heap Used: ${this.formatMemorySize(memInfo.heapUsed)}`);
      console.log(`🔗 External: ${this.formatMemorySize(memInfo.external)}`);
      console.log(`📦 Array Buffers: ${this.formatMemorySize(memInfo.arrayBuffers)}`);
      
      // Calculate heap usage percentage
      const heapUsagePercent = memInfo.heapTotal > 0 
        ? ((memInfo.heapUsed / memInfo.heapTotal) * 100).toFixed(1)
        : '0';
      console.log(`📈 Heap Usage: ${heapUsagePercent}%`);
      
      // Memory pressure warning
      if (memInfo.rss > 500 * 1024 * 1024) { // 500MB
        console.warn('⚠️ HIGH MEMORY USAGE DETECTED!');
      }
    } else {
      console.log('📊 Memory info not available in this environment');
    }
    
    console.groupEnd();
    
    // Store in history
    this.memoryHistory.push(memInfo);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }
    
    return memInfo;
  }

  /**
   * Start periodic memory monitoring
   */
  startPeriodicMonitoring(intervalMs: number = 30000): void {
    if (this.intervalId) {
      console.warn('Memory monitoring already running');
      return;
    }

    console.log(`🔄 Starting periodic memory monitoring (every ${intervalMs/1000}s)`);
    this.intervalId = setInterval(async () => {
      await this.logMemoryInfo('Periodic Check');
    }, intervalMs);
  }

  /**
   * Stop periodic memory monitoring
   */
  stopPeriodicMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Stopped periodic memory monitoring');
    }
  }

  /**
   * Log memory usage for a specific operation
   */
  async logOperation(operationName: string, operation: () => void | Promise<void>): Promise<void> {
    const memoryBefore = await this.getCurrentMemoryInfo();
    console.log(`🚀 Starting operation: ${operationName}`);
    
    if (operation.constructor.name === 'AsyncFunction') {
      await (operation as () => Promise<void>)();
    } else {
      (operation as () => void)();
    }
    
    const memoryAfter = await this.getCurrentMemoryInfo();
    this.logOperationResult(operationName, memoryBefore, memoryAfter);
  }

  /**
   * Log the result of an operation's memory impact
   */
  private logOperationResult(operationName: string, memoryBefore: MemoryInfo, memoryAfter: MemoryInfo): void {
    const rssDiff = memoryAfter.rss - memoryBefore.rss;
    const heapDiff = memoryAfter.heapUsed - memoryBefore.heapUsed;
    
    console.group(`📋 Operation Complete: ${operationName}`);
    console.log(`📊 RSS Change: ${rssDiff >= 0 ? '+' : ''}${this.formatMemorySize(Math.abs(rssDiff))}`);
    console.log(`💾 Heap Change: ${heapDiff >= 0 ? '+' : ''}${this.formatMemorySize(Math.abs(heapDiff))}`);
    
    if (Math.abs(rssDiff) > 10 * 1024 * 1024) { // 10MB threshold
      console.warn(`⚠️ Significant memory change detected for operation: ${operationName}`);
    }
    console.groupEnd();

    // Store operation log
    this.operationLogs.push({
      operation: operationName,
      memoryBefore,
      memoryAfter,
      timestamp: Date.now()
    });

    // Keep only last 50 operation logs
    if (this.operationLogs.length > 50) {
      this.operationLogs.shift();
    }
  }

  /**
   * Get memory usage history
   */
  getMemoryHistory(): MemoryInfo[] {
    return [...this.memoryHistory];
  }

  /**
   * Get operation logs
   */
  getOperationLogs() {
    return [...this.operationLogs];
  }

  /**
   * Generate memory report
   */
  generateReport(saveToFile: boolean = false): string {
    const reportData = this.generateReportData();
    const reportText = this.formatReportText(reportData);
    
    // Always log to console
    console.group('📊 Memory Usage Report');
    console.log(reportText);
    console.groupEnd();
    
    // Optionally save to file
    if (saveToFile) {
      this.saveReportToFile(reportData, reportText);
    }
    
    return reportText;
  }

  /**
   * Generate structured report data
   */
  private generateReportData(): any {
    if (this.memoryHistory.length === 0) {
      return { error: 'No memory data available' };
    }

    const latest = this.memoryHistory[this.memoryHistory.length - 1];
    const earliest = this.memoryHistory[0];
    
    // Find peak memory usage
    const peak = this.memoryHistory.reduce((max, current) => 
      current.rss > max.rss ? current : max
    );
    
    // Top memory-consuming operations
    const topOperations = this.operationLogs
      .map(log => ({
        operation: log.operation,
        memoryIncrease: log.memoryAfter.rss - log.memoryBefore.rss,
        timestamp: log.timestamp,
        memoryBefore: log.memoryBefore.rss,
        memoryAfter: log.memoryAfter.rss
      }))
      .sort((a, b) => b.memoryIncrease - a.memoryIncrease)
      .slice(0, 10);

    return {
      timestamp: new Date().toISOString(),
      summary: {
        currentMemory: latest.rss,
        initialMemory: earliest.rss,
        memoryGrowth: latest.rss - earliest.rss,
        peakMemory: peak.rss,
        peakTimestamp: peak.timestamp,
        totalOperations: this.operationLogs.length,
        monitoringDuration: latest.timestamp - earliest.timestamp
      },
      memoryHistory: this.memoryHistory,
      topOperations,
      allOperations: this.operationLogs
    };
  }

  /**
   * Format report data as readable text
   */
  private formatReportText(reportData: any): string {
    if (reportData.error) {
      return reportData.error;
    }

    const { summary, topOperations } = reportData;
    
    let report = `Memory Usage Report - ${new Date(reportData.timestamp).toLocaleString()}\n`;
    report += `${'='.repeat(60)}\n\n`;
    
    report += `📈 Current Memory: ${this.formatMemorySize(summary.currentMemory)}\n`;
    report += `📉 Initial Memory: ${this.formatMemorySize(summary.initialMemory)}\n`;
    report += `🔄 Memory Growth: ${this.formatMemorySize(summary.memoryGrowth)}\n`;
    report += `🏔️ Peak Memory: ${this.formatMemorySize(summary.peakMemory)} at ${new Date(summary.peakTimestamp).toLocaleTimeString()}\n`;
    report += `⏱️ Monitoring Duration: ${Math.round(summary.monitoringDuration / 1000)}s\n`;
    report += `📊 Total Operations: ${summary.totalOperations}\n\n`;
    
    if (topOperations.length > 0) {
      report += `🔝 Top Memory-Consuming Operations:\n`;
      report += `${'-'.repeat(40)}\n`;
      topOperations.forEach((op, index) => {
        const increase = op.memoryIncrease >= 0 ? `+${this.formatMemorySize(op.memoryIncrease)}` : this.formatMemorySize(op.memoryIncrease);
        report += `${index + 1}. ${op.operation}: ${increase}\n`;
        report += `   Time: ${new Date(op.timestamp).toLocaleTimeString()}\n`;
        report += `   Before: ${this.formatMemorySize(op.memoryBefore)} → After: ${this.formatMemorySize(op.memoryAfter)}\n\n`;
      });
    }
    
    return report;
  }

  /**
   * Save report to file
   */
  private async saveReportToFile(reportData: any, reportText: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `memory-report-${timestamp}`;
      
      if (this.isElectron && (window as any).api?.saveMemoryReport) {
        // Save via Electron IPC
        await (window as any).api.saveMemoryReport({
          filename,
          reportText,
          reportData: JSON.stringify(reportData, null, 2)
        });
        console.log(`💾 Memory report saved to file: ${filename}`);
      } else {
        // Fallback: download in browser
        this.downloadReport(filename, reportText, reportData);
      }
    } catch (error) {
      console.error('Failed to save memory report:', error);
    }
  }

  /**
   * Download report in browser
   */
  private downloadReport(filename: string, reportText: string, reportData: any): void {
    // Create text report
    const textBlob = new Blob([reportText], { type: 'text/plain' });
    const textUrl = URL.createObjectURL(textBlob);
    
    // Create JSON report
    const jsonBlob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    
    // Download text report
    const textLink = document.createElement('a');
    textLink.href = textUrl;
    textLink.download = `${filename}.txt`;
    textLink.click();
    
    // Download JSON report
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `${filename}.json`;
    jsonLink.click();
    
    // Cleanup
    setTimeout(() => {
      URL.revokeObjectURL(textUrl);
      URL.revokeObjectURL(jsonUrl);
    }, 100);
    
    console.log(`💾 Memory reports downloaded: ${filename}.txt and ${filename}.json`);
  }

  /**
   * Force garbage collection if available
   */
  async forceGarbageCollection(): Promise<void> {
    // Try Electron IPC first
    if (this.isElectron && (window as any).api?.forceGarbageCollection) {
      console.log('🗑️ Forcing garbage collection via Electron...');
      try {
        const result = await (window as any).api.forceGarbageCollection();
        if (result.success) {
          setTimeout(async () => {
            await this.logMemoryInfo('After GC');
          }, 100);
          return;
        }
      } catch (error) {
        console.warn('Failed to force GC via Electron:', error);
      }
    }
    
    // Fallback to browser GC
    if (typeof window !== 'undefined' && (window as any).gc) {
      console.log('🗑️ Forcing garbage collection...');
      (window as any).gc();
      setTimeout(async () => {
        await this.logMemoryInfo('After GC');
      }, 100);
    } else {
      console.warn('Garbage collection not available. Run with --expose-gc flag.');
    }
  }
}

// Create singleton instance
export const memoryMonitor = new MemoryMonitor();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).memoryMonitor = memoryMonitor;
}

// Auto-start monitoring in development
if (process.env.NODE_ENV === 'development') {
  memoryMonitor.startPeriodicMonitoring(30000); // Every 30 seconds
}
