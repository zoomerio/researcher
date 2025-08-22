/**
 * Lightweight Graph Node
 * Stores references to external data files instead of embedding full datasets
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { memoryMonitor } from '../../utils/memoryMonitor';

// Lazy load Plotly to reduce initial bundle size
const LazyPlot = React.lazy(() => import('react-plotly.js'));

interface LightweightGraphAttributes {
  graphId: string;          // Unique identifier
  dataPath?: string;        // Path to data file
  configPath?: string;      // Path to configuration file
  thumbnailPath?: string;   // Path to thumbnail image
  title?: string;           // Graph title
  type?: string;            // Graph type (scatter, bar, line, etc.)
  lastModified?: number;    // Timestamp for cache invalidation
  dataHash?: string;        // Hash of data for change detection
  width?: number;
  height?: number;
  dataPoints?: number;      // Number of data points (metadata)
  fileSize?: number;        // Size of data file (metadata)
}

// Graph data cache to avoid reloading the same data
class GraphDataCache {
  private static instance: GraphDataCache;
  private cache = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();

  static getInstance(): GraphDataCache {
    if (!GraphDataCache.instance) {
      GraphDataCache.instance = new GraphDataCache();
    }
    return GraphDataCache.instance;
  }

  async getData(graphId: string, dataPath?: string): Promise<any> {
    // Check cache first
    if (this.cache.has(graphId)) {
      return this.cache.get(graphId);
    }

    // Check if already loading
    if (this.loadingPromises.has(graphId)) {
      return this.loadingPromises.get(graphId);
    }

    // Load data
    const loadPromise = this.loadGraphData(graphId, dataPath);
    this.loadingPromises.set(graphId, loadPromise);

    try {
      const data = await loadPromise;
      this.cache.set(graphId, data);
      this.loadingPromises.delete(graphId);
      return data;
    } catch (error) {
      this.loadingPromises.delete(graphId);
      throw error;
    }
  }

  private async loadGraphData(graphId: string, dataPath?: string): Promise<any> {
    if (dataPath) {
      try {
        memoryMonitor.logOperation('Graph Data Load Start', () => {
          console.log(`Loading graph data: ${dataPath}`);
        });

        const response = await fetch(dataPath);
        const data = await response.json();

        memoryMonitor.logOperation('Graph Data Load Complete', () => {
          console.log(`Graph data loaded: ${dataPath}`);
        });

        return data;
      } catch (error) {
        console.error(`Failed to load graph data from ${dataPath}:`, error);
      }
    }

    // Fallback to default sample data
    return {
      data: [{
        x: [1, 2, 3, 4],
        y: [10, 11, 12, 13],
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Sample Data'
      }],
      layout: {
        title: 'Sample Graph',
        width: 400,
        height: 300,
        xaxis: { title: 'X Axis' },
        yaxis: { title: 'Y Axis' }
      },
      config: {
        displayModeBar: false,
        responsive: true,
      }
    };
  }

  invalidate(graphId: string) {
    this.cache.delete(graphId);
    this.loadingPromises.delete(graphId);
  }

  clear() {
    this.cache.clear();
    this.loadingPromises.clear();
  }
}

// Lightweight graph view component
const LightweightGraphView = React.memo(({ node, updateAttributes }: any) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [graphData, setGraphData] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    graphId, 
    dataPath, 
    configPath, 
    thumbnailPath, 
    title, 
    type, 
    width, 
    height,
    dataPoints,
    fileSize 
  } = node.attrs;

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load graph data when visible
  useEffect(() => {
    if (!isVisible || isLoaded || isError) return;

    const loadGraph = async () => {
      try {
        const cache = GraphDataCache.getInstance();
        const data = await cache.getData(graphId, dataPath);
        setGraphData(data);
        setIsLoaded(true);
      } catch (error) {
        console.error('Error loading graph:', error);
        setIsError(true);
      }
    };

    loadGraph();
  }, [isVisible, graphId, dataPath, isLoaded, isError]);

  const handleEdit = () => {
    console.log('Edit graph:', graphId);
    // TODO: Implement graph editing functionality
  };

  const handleRefresh = () => {
    const cache = GraphDataCache.getInstance();
    cache.invalidate(graphId);
    setIsLoaded(false);
    setIsError(false);
    setGraphData(null);
  };

  if (isError) {
    return (
      <NodeViewWrapper>
        <div 
          ref={containerRef}
          className="graph-error" 
          style={{ 
            padding: '20px', 
            border: '1px dashed #ccc', 
            textAlign: 'center',
            color: '#666',
            width: width || 400,
            height: height || 300,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <div>Failed to load graph</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>
            {title || `Graph ${graphId}`}
          </div>
          {fileSize && (
            <div style={{ fontSize: '10px', marginTop: '5px' }}>
              Data size: {(fileSize / 1024).toFixed(1)}KB
            </div>
          )}
          <button 
            onClick={handleRefresh}
            style={{ marginTop: '10px', padding: '5px 10px' }}
          >
            Retry
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  if (!isVisible || !isLoaded || !graphData) {
    return (
      <NodeViewWrapper>
        <div 
          ref={containerRef}
          className="graph-placeholder" 
          style={{ 
            width: width || 400, 
            height: height || 300, 
            backgroundColor: '#f8f9fa',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #dee2e6',
            borderRadius: '4px'
          }}
        >
          {thumbnailPath ? (
            <img 
              src={thumbnailPath} 
              alt={title || 'Graph thumbnail'}
              style={{ maxWidth: '100%', maxHeight: '100%', opacity: 0.7 }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#666' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>📊</div>
              <div>{isVisible ? 'Loading graph...' : 'Graph'}</div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>
                {title || `${type || 'Chart'} (${dataPoints || 0} points)`}
              </div>
              {fileSize && (
                <div style={{ fontSize: '10px', marginTop: '5px' }}>
                  {(fileSize / 1024).toFixed(1)}KB
                </div>
              )}
            </div>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div className="lightweight-graph" style={{ position: 'relative' }}>
        <div className="graph-controls" style={{ 
          position: 'absolute', 
          top: '5px', 
          right: '5px', 
          zIndex: 10,
          display: 'flex',
          gap: '5px'
        }}>
          <button 
            onClick={handleEdit}
            style={{ 
              padding: '2px 6px', 
              fontSize: '12px',
              backgroundColor: 'rgba(255,255,255,0.8)',
              border: '1px solid #ccc',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
          <button 
            onClick={handleRefresh}
            style={{ 
              padding: '2px 6px', 
              fontSize: '12px',
              backgroundColor: 'rgba(255,255,255,0.8)',
              border: '1px solid #ccc',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            ↻
          </button>
        </div>
        <Suspense fallback={
          <div style={{ 
            width: width || 400, 
            height: height || 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6'
          }}>
            Loading Plotly...
          </div>
        }>
          <LazyPlot
            data={graphData.data}
            layout={graphData.layout}
            config={graphData.config}
            style={{ width: '100%', height: '100%' }}
          />
        </Suspense>
      </div>
    </NodeViewWrapper>
  );
});

export const LightweightGraphNode = Node.create<{}>({
  name: 'lightweightGraph',
  
  group: 'block',
  
  atom: true,

  addAttributes() {
    return {
      graphId: {
        default: null,
        parseHTML: element => element.getAttribute('data-graph-id'),
        renderHTML: attributes => attributes.graphId ? { 'data-graph-id': attributes.graphId } : {},
      },
      dataPath: {
        default: null,
        parseHTML: element => element.getAttribute('data-path'),
        renderHTML: attributes => attributes.dataPath ? { 'data-path': attributes.dataPath } : {},
      },
      title: {
        default: null,
        parseHTML: element => element.getAttribute('data-title'),
        renderHTML: attributes => attributes.title ? { 'data-title': attributes.title } : {},
      },
      type: {
        default: null,
        parseHTML: element => element.getAttribute('data-type'),
        renderHTML: attributes => attributes.type ? { 'data-type': attributes.type } : {},
      },
      width: {
        default: 400,
        parseHTML: element => {
          const width = element.getAttribute('data-width');
          return width ? parseInt(width, 10) : 400;
        },
        renderHTML: attributes => ({ 'data-width': attributes.width }),
      },
      height: {
        default: 300,
        parseHTML: element => {
          const height = element.getAttribute('data-height');
          return height ? parseInt(height, 10) : 300;
        },
        renderHTML: attributes => ({ 'data-height': attributes.height }),
      },
      dataPoints: {
        default: null,
        parseHTML: element => {
          const points = element.getAttribute('data-points');
          return points ? parseInt(points, 10) : null;
        },
        renderHTML: attributes => attributes.dataPoints ? { 'data-points': attributes.dataPoints } : {},
      },
      fileSize: {
        default: null,
        parseHTML: element => {
          const size = element.getAttribute('data-size');
          return size ? parseInt(size, 10) : null;
        },
        renderHTML: attributes => attributes.fileSize ? { 'data-size': attributes.fileSize } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-graph-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'lightweight-graph-node' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LightweightGraphView);
  },

  addCommands() {
    return {
      setLightweightGraph: (options: LightweightGraphAttributes) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: {
            ...options,
            graphId: options.graphId || `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          },
        });
      },
    };
  },
});

