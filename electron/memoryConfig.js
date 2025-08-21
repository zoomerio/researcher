/**
 * Memory Optimization Configuration
 * Centralized configuration for all memory-related optimizations
 */

import os from 'node:os';

class MemoryConfig {
  constructor() {
    this.cpuCount = os.cpus().length;
    this.totalMemory = os.totalmem();
    this.isLowMemorySystem = this.totalMemory < 4 * 1024 * 1024 * 1024; // Less than 4GB
    
    // Better development mode detection for Electron
    this.isDevelopment = process.env.NODE_ENV === 'development' || 
                        process.env.ELECTRON_IS_DEV === '1' ||
                        process.defaultApp ||
                        /[\\/]electron-prebuilt[\\/]/.test(process.execPath) ||
                        /[\\/]electron[\\/]/.test(process.execPath);
                        
    console.log(`[MemoryConfig] Development mode detection: NODE_ENV=${process.env.NODE_ENV}, ELECTRON_IS_DEV=${process.env.ELECTRON_IS_DEV}, defaultApp=${process.defaultApp}, isDevelopment=${this.isDevelopment}`);
  }

  /**
   * Get optimized webPreferences for BrowserWindow
   */
  getWebPreferences(isChildWindow = false) {
    const baseConfig = {
      // Security and isolation
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      
      // Disable unnecessary modules
      enableRemoteModule: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      
      // Disable features to save memory
      backgroundThrottling: false,
      offscreen: false,
      plugins: false,
      experimentalFeatures: false,
      spellcheck: false,
      enableWebSQL: false,
      
      // Disable media features if not needed
      autoplayPolicy: 'user-gesture-required',
      disableBlinkFeatures: 'Auxclick',
      
      // Graphics optimizations
      webgl: true, // Keep for Plotly charts
      acceleratedGraphics: false, // Disable GPU acceleration to save memory
      
      // Disable unnecessary web features
      webSecurity: false, // Allow local files in dev
      allowRunningInsecureContent: false,
      
      // Disable additional features
      enablePreferredSizeMode: false,
      safeDialogs: true,
      safeDialogsMessage: 'This page is trying to open multiple dialogs',
      disableDialogs: false,
      
      // Performance optimizations
      backgroundThrottling: true, // Enable throttling for background tabs
      
      // Disable unnecessary APIs
      enableBlinkFeatures: '', // Disable experimental Blink features
    };

    // Memory-optimized V8 flags
    const memoryFlags = this.getV8Flags(isChildWindow);
    
    return {
      ...baseConfig,
      additionalArguments: memoryFlags
    };
  }

  /**
   * Get optimized V8 flags based on system resources
   */
  getV8Flags(isChildWindow = false) {
    const baseFlags = [
      '--optimize-for-size',
      '--gc-interval=50', // More frequent GC
      '--memory-pressure-off',
      '--no-lazy',
      '--expose-gc',
      '--enable-precise-memory-info',
      '--memory-reducer', // Aggressive memory reduction
      '--always-compact', // Always compact memory
      '--optimize-for-size', // Duplicate for emphasis
      '--no-concurrent-recompilation', // Disable concurrent compilation to save memory
      '--single-threaded-gc', // Use single-threaded GC for lower memory overhead
    ];

    // Adjust heap size based on system memory and window type - more aggressive limits
    let heapSize;
    if (isChildWindow) {
      heapSize = this.isLowMemorySystem ? 64 : 128; // Reduced from 128/256
    } else {
      heapSize = this.isLowMemorySystem ? 128 : 256; // Reduced from 256/512
    }

    const memoryFlags = [
      `--max-old-space-size=${heapSize}`,
      `--max-semi-space-size=${Math.max(1, Math.floor(heapSize / 64))}`,
      `--initial-old-space-size=${Math.max(4, Math.floor(heapSize / 32))}`,
      `--max-new-space-size=${Math.max(1, Math.floor(heapSize / 32))}`, // Limit new space
      `--heap-growing-percent=10`, // Slower heap growth
      `--max-heap-compaction-candidates=10`, // Limit compaction candidates
      `--gc-global`, // Global GC
      `--incremental-marking`, // Incremental marking for better performance
      `--concurrent-marking`, // Concurrent marking
    ];

    // Additional flags for low-memory systems
    if (this.isLowMemorySystem) {
      memoryFlags.push(
        '--optimize-for-size',
        '--memory-reducer',
        '--max-heap-compaction-candidates=10',
        '--heap-growing-percent=10'
      );
    }

    // Development-specific flags
    if (this.isDevelopment) {
      baseFlags.push('--enable-precise-memory-info');
    }

    return [...baseFlags, ...memoryFlags];
  }

  /**
   * Get child process configuration
   */
  getChildProcessConfig() {
    const maxProcesses = Math.max(2, Math.floor(this.cpuCount / 2));
    const memoryLimitMB = this.isLowMemorySystem ? 64 : 128;

    return {
      maxProcesses,
      memoryLimitMB,
      execArgv: [
        `--max-old-space-size=${memoryLimitMB}`,
        '--optimize-for-size',
        '--gc-interval=50',
        '--expose-gc',
        '--no-lazy',
        '--memory-pressure-off'
      ],
      timeout: 30000, // 30 seconds default timeout
      idleTimeout: 60000, // Kill idle processes after 1 minute
    };
  }

  /**
   * Get process priority configuration
   */
  getPriorityConfig() {
    return {
      mainProcess: 'ABOVE_NORMAL',
      childProcess: 'BELOW_NORMAL',
      heavyTask: 'LOW',
      idleTask: 'IDLE',
      inactivityThreshold: 5 * 60 * 1000, // 5 minutes
      deepIdleThreshold: 15 * 60 * 1000, // 15 minutes
    };
  }

  /**
   * Get garbage collection configuration
   */
  getGCConfig() {
    return {
      // Main process GC interval
      mainProcessInterval: this.isLowMemorySystem ? 15000 : 30000,
      
      // Child process GC interval
      childProcessInterval: this.isLowMemorySystem ? 5000 : 10000,
      
      // Force GC on memory pressure
      memoryPressureThreshold: this.isLowMemorySystem ? 0.8 : 0.9,
      
      // Idle GC - more aggressive when idle
      idleGCInterval: 5000,
      
      // Memory thresholds for warnings
      warningThreshold: 500 * 1024 * 1024, // 500MB
      criticalThreshold: 1000 * 1024 * 1024, // 1GB
    };
  }

  /**
   * Get window optimization configuration
   */
  getWindowConfig(isChildWindow = false) {
    const baseConfig = {
      enableLargerThanScreen: false,
      thickFrame: false,
    };

    if (isChildWindow) {
      return {
        ...baseConfig,
        skipTaskbar: true,
        minimizable: false,
        maximizable: false,
      };
    }

    return baseConfig;
  }

  /**
   * Get renderer optimization configuration
   */
  getRendererConfig() {
    return {
      // Lazy loading thresholds
      lazyLoadThreshold: 1000, // Load components after 1s delay
      
      // Component cleanup intervals
      cleanupInterval: 60000, // Clean up unused components every minute
      
      // Memory monitoring intervals
      memoryCheckInterval: this.isDevelopment ? 10000 : 30000,
      
      // Bundle splitting configuration
      chunkSizeLimit: this.isLowMemorySystem ? 200 : 500, // KB
      
      // Image optimization
      maxImageSize: this.isLowMemorySystem ? 2 * 1024 * 1024 : 5 * 1024 * 1024, // 2MB or 5MB
      
      // Cache limits
      maxCacheSize: this.isLowMemorySystem ? 50 * 1024 * 1024 : 100 * 1024 * 1024, // 50MB or 100MB
    };
  }

  /**
   * Get system-specific optimizations
   */
  getSystemOptimizations() {
    const platform = process.platform;
    const arch = process.arch;

    const optimizations = {
      // Base optimizations for all systems
      disableHardwareAcceleration: this.isLowMemorySystem,
      enableBackgroundThrottling: !this.isDevelopment,
      
      // Platform-specific optimizations
      windows: {
        enableDwmComposition: !this.isLowMemorySystem,
        disableAero: this.isLowMemorySystem,
      },
      
      darwin: {
        enableMetalRendering: !this.isLowMemorySystem,
        useNativeMenus: true,
      },
      
      linux: {
        enableGpuSandbox: !this.isLowMemorySystem,
        useOzone: false, // Disable for memory savings
      }
    };

    return {
      ...optimizations,
      platform: optimizations[platform] || {},
      arch,
      isLowMemory: this.isLowMemorySystem,
      cpuCount: this.cpuCount,
      totalMemory: this.totalMemory,
    };
  }

  /**
   * Get complete configuration object
   */
  getCompleteConfig() {
    return {
      webPreferences: {
        main: this.getWebPreferences(false),
        child: this.getWebPreferences(true),
      },
      childProcess: this.getChildProcessConfig(),
      priority: this.getPriorityConfig(),
      gc: this.getGCConfig(),
      window: {
        main: this.getWindowConfig(false),
        child: this.getWindowConfig(true),
      },
      renderer: this.getRendererConfig(),
      system: this.getSystemOptimizations(),
    };
  }

  /**
   * Log current configuration
   */
  logConfiguration() {
    const config = this.getCompleteConfig();
    
    console.log('[MemoryConfig] System Information:');
    console.log(`  CPU Cores: ${this.cpuCount}`);
    console.log(`  Total Memory: ${Math.round(this.totalMemory / 1024 / 1024 / 1024)}GB`);
    console.log(`  Low Memory System: ${this.isLowMemorySystem}`);
    console.log(`  Platform: ${process.platform} (${process.arch})`);
    console.log(`  Development Mode: ${this.isDevelopment}`);
    
    console.log('[MemoryConfig] Memory Optimizations:');
    console.log(`  Main Process Heap Limit: ${config.webPreferences.main.additionalArguments.find(arg => arg.startsWith('--max-old-space-size'))}`);
    console.log(`  Child Process Heap Limit: ${config.webPreferences.child.additionalArguments.find(arg => arg.startsWith('--max-old-space-size'))}`);
    console.log(`  Max Child Processes: ${config.childProcess.maxProcesses}`);
    console.log(`  GC Interval: ${config.gc.mainProcessInterval}ms`);
  }
}

// Create singleton instance
export const memoryConfig = new MemoryConfig();

// Log configuration on startup
memoryConfig.logConfiguration();
