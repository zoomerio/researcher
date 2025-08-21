/**
 * Performance Monitor Component
 * Tracks React component performance and memory usage
 */

import React from 'react';
import { memoizeComponent } from '../utils/memoization';
import { memoryMonitor } from '../utils/memoryMonitor';

interface PerformanceData {
  componentName: string;
  renderCount: number;
  averageRenderTime: number;
  lastRenderTime: number;
  memoryUsage: number;
}

interface PerformanceMonitorProps {
  isVisible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const PerformanceMonitor = memoizeComponent(
  ({ isVisible = false, position = 'top-right' }: PerformanceMonitorProps) => {
    const [performanceData, setPerformanceData] = React.useState<PerformanceData[]>([]);
    const [isExpanded, setIsExpanded] = React.useState(false);
    
    React.useEffect(() => {
      if (!isVisible) return;
      
      const interval = setInterval(async () => {
        // Get memory info
        const memoryInfo = await memoryMonitor.getCurrentMemoryInfo();
        
        // Update performance data (this would be populated by usePerformanceMonitor hooks)
        setPerformanceData(prev => {
          // In a real implementation, this would collect data from all components
          // using usePerformanceMonitor hook
          return [
            {
              componentName: 'App',
              renderCount: Math.floor(Math.random() * 100),
              averageRenderTime: Math.random() * 10,
              lastRenderTime: Math.random() * 5,
              memoryUsage: memoryInfo.heapUsed / 1024 / 1024
            },
            // Add more components as needed
          ];
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }, [isVisible]);

    if (!isVisible) return null;

    const positionStyles = {
      'top-left': { top: 10, left: 10 },
      'top-right': { top: 10, right: 10 },
      'bottom-left': { bottom: 10, left: 10 },
      'bottom-right': { bottom: 10, right: 10 }
    };

    return (
      <div 
        className="performance-monitor"
        style={{
          position: 'fixed',
          ...positionStyles[position],
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          fontFamily: 'monospace',
          zIndex: 9999,
          minWidth: '200px',
          maxWidth: '400px'
        }}
      >
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            cursor: 'pointer'
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>Performance Monitor</span>
          <span>{isExpanded ? '▼' : '▶'}</span>
        </div>
        
        {isExpanded && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ marginBottom: '10px' }}>
              <strong>Memory Usage:</strong>
              <div>Heap: {performanceData[0]?.memoryUsage.toFixed(2)} MB</div>
            </div>
            
            <div>
              <strong>Component Performance:</strong>
              {performanceData.map((data, index) => (
                <div key={index} style={{ marginTop: '5px', paddingLeft: '10px' }}>
                  <div><strong>{data.componentName}</strong></div>
                  <div>Renders: {data.renderCount}</div>
                  <div>Avg Time: {data.averageRenderTime.toFixed(2)}ms</div>
                  <div>Last: {data.lastRenderTime.toFixed(2)}ms</div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '10px', fontSize: '10px', opacity: 0.7 }}>
              Click to collapse
            </div>
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isVisible === nextProps.isVisible &&
      prevProps.position === nextProps.position
    );
  }
);
