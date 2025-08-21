# Memory Monitoring System

This document describes the comprehensive memory monitoring system implemented for the Researcher application to help identify and resolve memory consumption issues.

## Overview

The application currently consumes ~300MB at startup and can grow to 1000-1500MB during use. This monitoring system provides tools to:

1. **Analyze bundle size** and identify heavy dependencies
2. **Monitor memory usage** in real-time with detailed logging
3. **Track React component re-renders** to identify performance issues
4. **Log memory-intensive operations** automatically

## Components

### 1. Bundle Analysis (`source-map-explorer`)

**Purpose**: Identify which dependencies contribute most to bundle size.

**Usage**:
```bash
npm run analyze:bundle        # Generate bundle analysis
npm run analyze:bundle-server # Open interactive analysis in browser
```

**Configuration**: 
- Added to `package.json` scripts
- Vite config updated with source maps and manual chunks
- Dependencies split into logical chunks (tiptap, plotly, math, vendor)

### 2. Memory Monitor (`src/utils/memoryMonitor.ts`)

**Purpose**: Real-time memory usage tracking and logging.

**Features**:
- Periodic memory logging (RSS, Heap Total, Heap Used, External, Array Buffers)
- Operation-specific memory tracking
- Memory usage history
- Automatic garbage collection
- Memory pressure warnings (>500MB)

**Usage**:
```typescript
import { memoryMonitor } from './utils/memoryMonitor';

// Log current memory
await memoryMonitor.logMemoryInfo('Custom Context');

// Track operation memory impact
await memoryMonitor.logOperation('Heavy Operation', async () => {
  // Your heavy operation here
});

// Start/stop periodic monitoring
memoryMonitor.startPeriodicMonitoring(5000); // Every 5 seconds
memoryMonitor.stopPeriodicMonitoring();

// Force garbage collection
await memoryMonitor.forceGarbageCollection();

// Generate memory report
memoryMonitor.generateReport();
```

**Console Access**:
```javascript
// Available in browser console during development
window.memoryMonitor.logMemoryInfo('Manual Check');
window.memoryMonitor.generateReport();
```

### 3. React Re-render Tracking (`src/utils/whyDidYouRender.ts`)

**Purpose**: Identify unnecessary React component re-renders.

**Features**:
- Automatic tracking of pure components
- Hook re-render tracking
- Custom render tracking utilities
- Integration with why-did-you-render library

**Usage**:
```typescript
import { markForTracking, useRenderTracker, withRenderTracking } from './utils/whyDidYouRender';

// Mark component for tracking
markForTracking(MyComponent, 'MyComponent');

// Use render tracker hook
function MyComponent(props) {
  useRenderTracker('MyComponent', props);
  return <div>...</div>;
}

// Wrap component with tracking
const TrackedComponent = withRenderTracking(MyComponent, 'MyComponent');
```

### 4. Memory Logger (`src/utils/memoryLogger.ts`)

**Purpose**: Automatic logging of memory-intensive operations.

**Features**:
- Decorator for class methods
- Higher-order function wrapper
- Specialized loggers for common operations
- Automatic operation detection

**Usage**:
```typescript
import { logMemoryUsage, withMemoryLogging, MemoryAwareOperations } from './utils/memoryLogger';

// Decorator usage
class MyClass {
  @logMemoryUsage('Heavy Method')
  async heavyMethod() {
    // Method implementation
  }
}

// Function wrapper
const trackedFunction = withMemoryLogging(myFunction, 'My Function');

// Specialized operations
await MemoryAwareOperations.logDocumentLoad(async () => {
  // Document loading logic
});

await MemoryAwareOperations.logImageProcessing(async () => {
  // Image processing logic
});
```

### 5. Memory Monitor Dashboard (`src/components/MemoryMonitorDashboard.tsx`)

**Purpose**: Visual interface for memory monitoring during development.

**Features**:
- Real-time memory usage display
- Memory trend visualization
- Operation history
- Interactive controls (start/stop monitoring, force GC, generate reports)
- Keyboard shortcut (Ctrl+Shift+M)

**Access**: 
- Only available in development mode
- Toggle with Ctrl+Shift+M
- Click the floating "🧠 Memory Monitor" button

## Electron Integration

### Main Process Monitoring

The Electron main process includes:
- IPC handlers for memory usage (`memory:get-usage`)
- Garbage collection support (`memory:force-gc`)
- Automatic memory logging every 30 seconds in development
- Memory usage logging in console

### Preload Script

Updated `preload.cjs` exposes memory monitoring functions:
```javascript
window.api.getMemoryUsage()          // Get current memory usage
window.api.forceGarbageCollection()  // Force GC in main process
```

## Configuration

### Development vs Production

- **Development**: All monitoring features enabled
- **Production**: Monitoring disabled for performance

### Memory Thresholds

- **Warning threshold**: 500MB RSS usage
- **Significant operation**: 10MB memory change
- **Periodic logging**: Every 30 seconds (configurable)

## Usage Instructions

### 1. Initial Setup

The monitoring system is automatically initialized when the app starts in development mode.

### 2. Bundle Analysis

```bash
# Build and analyze bundle
npm run analyze:bundle-server
```

This will:
1. Build the application with source maps
2. Run source-map-explorer
3. Open interactive bundle analysis in browser

### 3. Real-time Monitoring

1. Start the application in development mode
2. Press `Ctrl+Shift+M` to open the Memory Monitor Dashboard
3. Click "Start Monitoring" for periodic updates
4. Monitor the console for detailed memory logs

### 4. Operation Tracking

Wrap memory-intensive operations:

```typescript
// For document operations
await MemoryAwareOperations.logDocumentLoad(async () => {
  const document = await loadLargeDocument();
  return document;
}, 'Large Document.rsrch');

// For image processing
await MemoryAwareOperations.logImageProcessing(async () => {
  const processedImage = await processImage(imageData);
  return processedImage;
}, '4K Image Processing');

// For editor operations
await MemoryAwareOperations.logEditorOperation(async () => {
  editor.commands.setContent(largeContent);
}, 'Set Large Content');
```

### 5. Component Re-render Analysis

Check console for why-did-you-render messages:
- Look for "🔄 Why Did You Render" groups
- Identify components with unnecessary re-renders
- Check changed props and state

## Common Memory Issues to Look For

### 1. Bundle Size Issues
- Large dependencies (Plotly.js, TipTap extensions)
- Duplicate dependencies
- Unused code not being tree-shaken

### 2. Runtime Memory Issues
- Memory leaks in React components
- Large objects not being garbage collected
- Excessive re-renders
- Image/media not being properly disposed

### 3. Electron-specific Issues
- Main process memory growth
- Renderer process isolation issues
- IPC message accumulation

## Optimization Strategies

### 1. Bundle Optimization
- Code splitting for large dependencies
- Lazy loading of heavy components
- Tree shaking unused code
- Using lighter alternatives for heavy libraries

### 2. Runtime Optimization
- Proper cleanup in useEffect
- Memoization of expensive calculations
- Virtualization for large lists
- Image optimization and caching

### 3. Memory Management
- Regular garbage collection
- Proper disposal of resources
- Avoiding memory leaks in event listeners
- Efficient data structures

## Troubleshooting

### Memory Monitor Not Working
1. Ensure you're in development mode
2. Check browser console for errors
3. Verify Electron IPC handlers are working

### Bundle Analysis Fails
1. Ensure build completed successfully
2. Check that source maps are generated
3. Verify source-map-explorer is installed

### High Memory Usage
1. Check Memory Monitor Dashboard for trends
2. Look for operations with high memory impact
3. Use garbage collection to verify if memory is reclaimable
4. Check for memory leaks in component lifecycle

## Next Steps

This monitoring system provides the foundation for identifying memory issues. Use the data collected to:

1. **Identify the heaviest dependencies** and consider alternatives
2. **Find memory leaks** in React components
3. **Optimize expensive operations** that consume significant memory
4. **Implement lazy loading** for heavy features
5. **Add memory budgets** and alerts for production

The system is designed to be non-intrusive in production while providing comprehensive insights during development.
