/**
 * Optimized Graph Node Component
 * Implements deep memoization and performance optimizations
 */

import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { memoizeComponent, nodePropsEqual, useDebouncedCallback, useStableCallback } from '../../utils/memoization';
import { usePerformanceMonitor } from '../../hooks/useOptimizedState';

// Lazy load Plotly to reduce initial bundle size
const PlotlyPlaceholder = React.lazy(() => 
  import('react-plotly.js').then(module => ({ default: module.default }))
);

interface GraphNodeProps {
  node: any;
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
  getPos: () => number;
  editor: any;
  selected: boolean;
}

interface GraphData {
  data: any[];
  layout: any;
  config: any;
}

// Memoized Plotly component to prevent unnecessary re-renders
const MemoizedPlotly = memoizeComponent(
  ({ data, layout, config, onUpdate }: any) => {
    return (
      <React.Suspense fallback={<div className="graph-loading">Loading graph...</div>}>
        <PlotlyPlaceholder
          data={data}
          layout={layout}
          config={config}
          onUpdate={onUpdate}
        />
      </React.Suspense>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for Plotly props
    return (
      prevProps.data === nextProps.data &&
      prevProps.layout === nextProps.layout &&
      prevProps.config === nextProps.config
    );
  }
);

// Memoized edit form component
const MemoizedEditForm = memoizeComponent(
  ({ 
    graphData, 
    graphLayout, 
    onDataChange, 
    onLayoutChange, 
    onSave, 
    onCancel 
  }: {
    graphData: string;
    graphLayout: string;
    onDataChange: (data: string) => void;
    onLayoutChange: (layout: string) => void;
    onSave: () => void;
    onCancel: () => void;
  }) => {
    return (
      <div className="graph-edit-form">
        <div className="graph-edit-section">
          <label>Data (JSON):</label>
          <textarea
            value={graphData}
            onChange={(e) => onDataChange(e.target.value)}
            rows={8}
            cols={50}
            placeholder="Enter graph data as JSON array..."
          />
        </div>
        <div className="graph-edit-section">
          <label>Layout (JSON):</label>
          <textarea
            value={graphLayout}
            onChange={(e) => onLayoutChange(e.target.value)}
            rows={6}
            cols={50}
            placeholder="Enter layout configuration as JSON..."
          />
        </div>
        <div className="graph-edit-buttons">
          <button onClick={onSave}>Save</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.graphData === nextProps.graphData &&
      prevProps.graphLayout === nextProps.graphLayout
    );
  }
);

const OptimizedGraphNodeView: React.FC<GraphNodeProps> = ({
  node,
  updateAttributes,
  deleteNode,
  getPos,
  editor,
  selected
}) => {
  usePerformanceMonitor('OptimizedGraphNode');
  
  const { graphData, graphLayout, graphConfig, isEditing } = node.attrs;
  const [editMode, setEditMode] = React.useState(false);
  const [localData, setLocalData] = React.useState('');
  const [localLayout, setLocalLayout] = React.useState('');
  
  // Memoized default values
  const defaultGraphData = React.useMemo(() => [{
    x: [1, 2, 3, 4],
    y: [10, 11, 12, 13],
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Пример данных'
  }], []);

  const defaultLayout = React.useMemo(() => ({
    title: {
      text: 'Пример графика',
      font: { size: 16, color: '#000000' }
    },
    width: 400,
    height: 300,
    xaxis: { 
      title: { text: 'Ось X', font: { size: 14, color: '#000000' } }
    },
    yaxis: { 
      title: { text: 'Ось Y', font: { size: 14, color: '#000000' } }
    }
  }), []);

  const defaultConfig = React.useMemo(() => ({
    displayModeBar: false,
    responsive: true,
    scrollZoom: true,
    doubleClick: 'reset+autosize',
    showTips: false,
    showAxisDragHandles: false,
    showAxisRangeEntryBoxes: false,
    displaylogo: false
  }), []);

  // Memoized parsed data
  const parsedData = React.useMemo(() => {
    try {
      return graphData ? JSON.parse(graphData) : defaultGraphData;
    } catch {
      return defaultGraphData;
    }
  }, [graphData, defaultGraphData]);

  const parsedLayout = React.useMemo(() => {
    try {
      return graphLayout ? JSON.parse(graphLayout) : defaultLayout;
    } catch {
      return defaultLayout;
    }
  }, [graphLayout, defaultLayout]);

  const parsedConfig = React.useMemo(() => {
    try {
      return graphConfig ? JSON.parse(graphConfig) : defaultConfig;
    } catch {
      return defaultConfig;
    }
  }, [graphConfig, defaultConfig]);

  // Stable callbacks
  const handleEdit = useStableCallback(() => {
    setLocalData(JSON.stringify(parsedData, null, 2));
    setLocalLayout(JSON.stringify(parsedLayout, null, 2));
    setEditMode(true);
  });

  const handleDelete = useStableCallback(() => {
    if (confirm('Delete this graph?')) {
      deleteNode();
    }
  });

  // Debounced save to prevent excessive updates
  const debouncedSave = useDebouncedCallback(() => {
    try {
      const newData = JSON.parse(localData);
      const newLayout = JSON.parse(localLayout);
      
      updateAttributes({
        graphData: JSON.stringify(newData),
        graphLayout: JSON.stringify(newLayout)
      });
      
      setEditMode(false);
    } catch (error) {
      alert('Invalid JSON format. Please check your data and layout.');
    }
  }, 300, [localData, localLayout, updateAttributes]);

  const handleCancel = useStableCallback(() => {
    setEditMode(false);
    setLocalData('');
    setLocalLayout('');
  });

  const handleDataChange = useStableCallback((data: string) => {
    setLocalData(data);
  });

  const handleLayoutChange = useStableCallback((layout: string) => {
    setLocalLayout(layout);
  });

  // Memoized plot update handler
  const handlePlotUpdate = React.useCallback((figure: any) => {
    // Only update if there are actual changes
    const newData = JSON.stringify(figure.data);
    const newLayout = JSON.stringify(figure.layout);
    
    if (newData !== graphData || newLayout !== graphLayout) {
      updateAttributes({
        graphData: newData,
        graphLayout: newLayout
      });
    }
  }, [graphData, graphLayout, updateAttributes]);

  return (
    <NodeViewWrapper className={`graph-node ${selected ? 'ProseMirror-selectednode' : ''}`}>
      <div className="graph-container">
        {editMode ? (
          <MemoizedEditForm
            graphData={localData}
            graphLayout={localLayout}
            onDataChange={handleDataChange}
            onLayoutChange={handleLayoutChange}
            onSave={debouncedSave}
            onCancel={handleCancel}
          />
        ) : (
          <div className="graph-display">
            <div className="graph-controls">
              <button onClick={handleEdit} className="graph-edit-btn">
                Edit
              </button>
              <button onClick={handleDelete} className="graph-delete-btn">
                Delete
              </button>
            </div>
            <MemoizedPlotly
              data={parsedData}
              layout={parsedLayout}
              config={parsedConfig}
              onUpdate={handlePlotUpdate}
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

// Export memoized component with custom comparison
export const OptimizedGraphNode = memoizeComponent(
  OptimizedGraphNodeView,
  nodePropsEqual
);

