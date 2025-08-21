/**
 * Memory Monitor Dashboard Component
 * Provides a visual interface for monitoring memory usage in development
 */

import React, { useState, useEffect, useCallback } from 'react';
import { memoryMonitor } from '../utils/memoryMonitor';

interface MemoryInfo {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
}

interface OperationLog {
  operation: string;
  memoryBefore: MemoryInfo;
  memoryAfter: MemoryInfo;
  timestamp: number;
}

const MemoryMonitorDashboard: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [memoryHistory, setMemoryHistory] = useState<MemoryInfo[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentMemory, setCurrentMemory] = useState<MemoryInfo | null>(null);

  // Format memory size
  const formatMemorySize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Update memory info
  const updateMemoryInfo = useCallback(async () => {
    const current = await memoryMonitor.logMemoryInfo('Dashboard Update');
    setCurrentMemory(current);
    setMemoryHistory(memoryMonitor.getMemoryHistory());
    setOperationLogs(memoryMonitor.getOperationLogs());
  }, []);

  // Toggle monitoring
  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      memoryMonitor.stopPeriodicMonitoring();
      setIsMonitoring(false);
    } else {
      memoryMonitor.startPeriodicMonitoring(10000); // Every 10 seconds
      setIsMonitoring(true);
    }
  }, [isMonitoring]);

  // Force garbage collection
  const forceGC = useCallback(async () => {
    await memoryMonitor.forceGarbageCollection();
    setTimeout(updateMemoryInfo, 1000);
  }, [updateMemoryInfo]);

  // Generate report
  const generateReport = useCallback(() => {
    memoryMonitor.generateReport();
  }, []);

  // Save report to file
  const saveReport = useCallback(() => {
    memoryMonitor.generateReport(true);
  }, []);

  // Update data periodically when visible
  useEffect(() => {
    if (!isVisible) return;

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000);
    return () => clearInterval(interval);
  }, [isVisible, updateMemoryInfo]);

  // Keyboard shortcut to toggle dashboard
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'M') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return (
      <div
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          zIndex: 10000,
          backgroundColor: '#333',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          opacity: 0.7,
        }}
        onClick={() => setIsVisible(true)}
        title="Click to open Memory Monitor Dashboard (Ctrl+Shift+M)"
      >
        🧠 Memory Monitor
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        width: '400px',
        maxHeight: '80vh',
        backgroundColor: '#1e1e1e',
        color: 'white',
        border: '1px solid #444',
        borderRadius: '8px',
        zIndex: 10000,
        fontSize: '12px',
        fontFamily: 'monospace',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px',
          backgroundColor: '#2d2d2d',
          borderBottom: '1px solid #444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>🧠 Memory Monitor Dashboard</span>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '10px', maxHeight: 'calc(80vh - 60px)', overflowY: 'auto' }}>
        {/* Current Memory Status */}
        {currentMemory && (
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#4CAF50' }}>Current Memory Usage</h4>
            <div>RSS: {formatMemorySize(currentMemory.rss)}</div>
            <div>Heap Used: {formatMemorySize(currentMemory.heapUsed)}</div>
            <div>Heap Total: {formatMemorySize(currentMemory.heapTotal)}</div>
            <div>
              Heap Usage: {currentMemory.heapTotal > 0 
                ? ((currentMemory.heapUsed / currentMemory.heapTotal) * 100).toFixed(1)
                : '0'}%
            </div>
            {currentMemory.rss > 500 * 1024 * 1024 && (
              <div style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                ⚠️ HIGH MEMORY USAGE!
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{ marginBottom: '15px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#2196F3' }}>Controls</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={toggleMonitoring}
              style={{
                padding: '4px 8px',
                backgroundColor: isMonitoring ? '#ff6b6b' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
            </button>
            <button
              onClick={updateMemoryInfo}
              style={{
                padding: '4px 8px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Refresh
            </button>
            <button
              onClick={forceGC}
              style={{
                padding: '4px 8px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Force GC
            </button>
            <button
              onClick={generateReport}
              style={{
                padding: '4px 8px',
                backgroundColor: '#9C27B0',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Console Report
            </button>
            <button
              onClick={saveReport}
              style={{
                padding: '4px 8px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Save Report
            </button>
          </div>
        </div>

        {/* Memory History Chart (Simple) */}
        {memoryHistory.length > 1 && (
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#FF9800' }}>Memory Trend</h4>
            <div
              style={{
                height: '60px',
                backgroundColor: '#333',
                borderRadius: '4px',
                padding: '5px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <svg width="100%" height="50" style={{ display: 'block' }}>
                {memoryHistory.map((mem, index) => {
                  if (index === 0) return null;
                  const prevMem = memoryHistory[index - 1];
                  const x1 = ((index - 1) / (memoryHistory.length - 1)) * 100;
                  const x2 = (index / (memoryHistory.length - 1)) * 100;
                  const maxRss = Math.max(...memoryHistory.map(m => m.rss));
                  const y1 = 50 - ((prevMem.rss / maxRss) * 40);
                  const y2 = 50 - ((mem.rss / maxRss) * 40);
                  
                  return (
                    <line
                      key={index}
                      x1={`${x1}%`}
                      y1={y1}
                      x2={`${x2}%`}
                      y2={y2}
                      stroke="#4CAF50"
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Recent Operations */}
        {operationLogs.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: '#E91E63' }}>Recent Operations</h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {operationLogs.slice(-10).reverse().map((log, index) => {
                const memoryChange = log.memoryAfter.rss - log.memoryBefore.rss;
                const isSignificant = Math.abs(memoryChange) > 10 * 1024 * 1024; // 10MB
                
                return (
                  <div
                    key={index}
                    style={{
                      padding: '4px',
                      marginBottom: '4px',
                      backgroundColor: isSignificant ? '#4a1a1a' : '#2a2a2a',
                      borderRadius: '4px',
                      borderLeft: isSignificant ? '3px solid #ff6b6b' : '3px solid #4CAF50',
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{log.operation}</div>
                    <div style={{ fontSize: '10px', opacity: 0.8 }}>
                      Memory change: {memoryChange >= 0 ? '+' : ''}{formatMemorySize(Math.abs(memoryChange))}
                    </div>
                    <div style={{ fontSize: '10px', opacity: 0.6 }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 10px',
          backgroundColor: '#2d2d2d',
          borderTop: '1px solid #444',
          fontSize: '10px',
          opacity: 0.7,
        }}
      >
        Press Ctrl+Shift+M to toggle • Development mode only
      </div>
    </div>
  );
};

export default MemoryMonitorDashboard;
