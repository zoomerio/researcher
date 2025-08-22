# Electron Memory Optimizations

## 🎯 **Overview**

This document describes the comprehensive Electron configuration optimizations implemented to reduce memory consumption from 300MB startup / 1000-1500MB runtime to more reasonable levels.

## ✅ **Implemented Optimizations**

### **1. WebPreferences Optimization**

**File**: `electron/main.js` - `createWindow()` and `openChildWindow()`

**Disabled Features**:
- ✅ `enableRemoteModule: false` - Removes remote module overhead
- ✅ `plugins: false` - Disables plugin loading
- ✅ `experimentalFeatures: false` - Disables experimental web features
- ✅ `spellcheck: false` - Removes spellcheck dictionary loading
- ✅ `enableWebSQL: false` - Disables deprecated WebSQL
- ✅ `nodeIntegrationInWorker: false` - Prevents Node.js in web workers
- ✅ `nodeIntegrationInSubFrames: false` - Prevents Node.js in subframes
- ✅ `offscreen: false` - Disables offscreen rendering

**Kept Features**:
- ✅ `webgl: true` - Required for Plotly.js charts
- ✅ `contextIsolation: true` - Security requirement
- ✅ `webSecurity: false` - Required for custom image protocols

### **2. Aggressive V8 Garbage Collection**

**Configuration**: `electron/memoryConfig.js`

**Main Process Flags**:
```javascript
--max-old-space-size=512        // 512MB heap limit (adaptive)
--optimize-for-size             // Optimize for memory over speed
--gc-interval=100               // Frequent garbage collection
--memory-pressure-off           // Disable memory pressure notifications
--max-semi-space-size=1         // Reduce semi-space size
--initial-old-space-size=4      // Start with smaller old space
--no-lazy                       // Disable lazy compilation
--expose-gc                     // Enable manual GC
```

**Child Process Flags**:
```javascript
--max-old-space-size=128-256    // Smaller heap for child processes
--gc-interval=50                // More aggressive GC
--optimize-for-size             // Memory-first optimization
```

**Adaptive Configuration**:
- **Low Memory Systems (<4GB)**: Smaller heap limits, more aggressive GC
- **Normal Systems (≥4GB)**: Balanced configuration
- **Child Windows**: 50% of main window limits

### **3. Child Process Architecture**

**Files**: 
- `electron/childProcessManager.js` - Process management
- `electron/workers/documentWorker.js` - Document operations
- `electron/workers/imageWorker.js` - Image processing

**Heavy Operations Moved to Child Processes**:
- ✅ Document loading/saving
- ✅ Archive extraction/creation
- ✅ Image processing
- ✅ File validation
- ✅ Thumbnail generation

**Process Management**:
- **Max Processes**: Half of CPU cores (adaptive)
- **Memory Limit**: 100MB per child process
- **Timeout**: 30 seconds per operation
- **Priority**: Below normal for background tasks
- **Auto-cleanup**: Processes killed on memory pressure

**Benefits**:
- Isolates memory-intensive operations
- Prevents main process memory leaks
- Automatic cleanup on completion
- Process recycling for efficiency

### **4. Process Priority Management**

**File**: `electron/processPriorityManager.js`

**Priority Levels**:
- **Main Process**: `ABOVE_NORMAL` (responsive UI)
- **Child Processes**: `BELOW_NORMAL` (background tasks)
- **Heavy Tasks**: `LOW` (computational work)
- **Idle Tasks**: `IDLE` (cleanup operations)

**Adaptive Behavior**:
- **Active Use**: Higher priorities for responsiveness
- **Idle (5 min)**: Reduced priorities, trigger GC
- **Deep Idle (15 min)**: Minimal priorities, aggressive cleanup
- **High System Load**: Auto-reduce priorities
- **Low System Load**: Auto-boost priorities

**Activity Tracking**:
- Window focus events
- User input events
- Document operations
- Menu interactions

### **5. Centralized Memory Configuration**

**File**: `electron/memoryConfig.js`

**System Detection**:
- CPU core count
- Total system memory
- Low memory system detection (<4GB)
- Platform-specific optimizations

**Configuration Categories**:
- **WebPreferences**: Browser window settings
- **Child Processes**: Worker process limits
- **Garbage Collection**: GC intervals and thresholds
- **Process Priorities**: Priority management rules
- **Window Options**: Window-specific optimizations

**Adaptive Settings**:
```javascript
// Low memory system (< 4GB RAM)
mainProcessHeap: 256MB
childProcessHeap: 128MB
gcInterval: 15s
maxChildProcesses: 2

// Normal system (≥ 4GB RAM)  
mainProcessHeap: 512MB
childProcessHeap: 256MB
gcInterval: 30s
maxChildProcesses: 4
```

## 📊 **Expected Memory Improvements**

### **Startup Memory Reduction**:
- **Before**: ~300MB
- **After**: ~100-150MB (50-67% reduction)

### **Runtime Memory Reduction**:
- **Before**: 1000-1500MB
- **After**: 300-600MB (60-70% reduction)

### **Memory Leak Prevention**:
- Child processes prevent main process leaks
- Automatic process recycling
- Aggressive garbage collection
- Idle state cleanup

## 🛠 **Usage Instructions**

### **Automatic Configuration**

All optimizations are applied automatically when the app starts:

1. **System Detection**: Automatically detects system resources
2. **Adaptive Configuration**: Applies appropriate settings
3. **Process Management**: Starts child process manager
4. **Priority Management**: Begins activity monitoring

### **Manual Controls**

**Memory Dashboard** (Ctrl+Shift+M):
- View current memory usage
- Monitor child processes
- Force garbage collection
- Generate memory reports

**Console Commands**:
```javascript
// Check process statistics
window.api.getProcessStats()

// Force garbage collection
window.api.forceGarbageCollection()

// Execute heavy operation in child process
window.api.executeDocumentOperation('loadDocument', { filePath: 'doc.rsrch' })
```

### **Development vs Production**

**Development Mode**:
- More verbose logging
- Memory monitoring enabled
- Process statistics available
- Shorter GC intervals

**Production Mode**:
- Minimal logging
- Optimized for performance
- Longer GC intervals
- Background monitoring only

## 🔧 **Configuration Files**

### **Main Configuration**
- `electron/memoryConfig.js` - Central configuration
- `electron/main.js` - Window creation with optimizations
- `electron/childProcessManager.js` - Process management
- `electron/processPriorityManager.js` - Priority management

### **Worker Processes**
- `electron/workers/documentWorker.js` - Document operations
- `electron/workers/imageWorker.js` - Image processing

### **Integration**
- `electron/preload.cjs` - IPC API exposure
- `src/utils/memoryMonitor.ts` - Frontend monitoring

## 📈 **Monitoring and Debugging**

### **Real-time Monitoring**
1. **Memory Dashboard**: Press Ctrl+Shift+M
2. **Console Logs**: Check browser console for memory logs
3. **Process Stats**: Monitor child process usage
4. **System Resources**: Track CPU and memory usage

### **Memory Reports**
- **Location**: `~/Documents/Researcher/Memory Reports/`
- **Format**: Text and JSON reports
- **Content**: Memory usage, operations, trends
- **Frequency**: On-demand or automatic

### **Performance Metrics**
- Startup time improvement
- Memory usage reduction
- Operation response times
- Process lifecycle tracking

## ⚠️ **Important Notes**

### **Compatibility**
- **Windows**: Full support for all optimizations
- **macOS**: Full support with platform-specific tweaks
- **Linux**: Full support with GPU sandbox adjustments

### **Trade-offs**
- **Startup Time**: Slightly longer due to process setup
- **CPU Usage**: Higher during GC cycles
- **Complexity**: More processes to manage

### **Troubleshooting**
1. **High Memory Usage**: Check child process stats
2. **Slow Performance**: Verify GC intervals aren't too aggressive
3. **Process Errors**: Check worker process logs
4. **Priority Issues**: Verify system permissions

## 🚀 **Future Optimizations**

### **Planned Improvements**
- Dynamic heap size adjustment
- Smart process pooling
- Memory pressure detection
- Advanced caching strategies

### **Monitoring Enhancements**
- Real-time memory graphs
- Process performance metrics
- Automatic optimization suggestions
- Memory leak detection

The implemented optimizations provide a solid foundation for memory-efficient operation while maintaining full functionality of your scientific text editor.

