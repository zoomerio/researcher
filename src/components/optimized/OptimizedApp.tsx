/**
 * Optimized App Component
 * Implements all React optimizations: memoization, virtualization, state management
 */

import React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { memoizeComponent, useDebouncedCallback, useStableCallback } from '../../utils/memoization';
import { useEditorState, usePerformanceMonitor } from '../../hooks/useOptimizedState';
import { OptimizedFormattingToolbar, OptimizedToolTabs } from './OptimizedToolbar';
import { VirtualizedFixedList } from '../virtualized/VirtualizedList';
import { memoryMonitor } from '../../utils/memoryMonitor';

// Lazy load heavy components
const OptimizedGraphNode = React.lazy(() => 
  import('./OptimizedGraphNode').then(module => ({ default: module.OptimizedGraphNode }))
);

const OptimizedMathNode = React.lazy(() => 
  import('./OptimizedMathNode').then(module => ({ default: module.OptimizedMathNode }))
);

// Memoized tab component
const MemoizedTab = memoizeComponent(
  ({ 
    tab, 
    isActive, 
    onSelect, 
    onClose, 
    onDragStart, 
    onDragOver, 
    onDrop 
  }: {
    tab: any;
    isActive: boolean;
    onSelect: () => void;
    onClose: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  }) => {
    return (
      <div
        className={`tab ${isActive ? 'active' : ''}`}
        onClick={onSelect}
        draggable={tab.closable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <span className="tab-title">{tab.title}</span>
        {tab.closable && (
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.tab === nextProps.tab &&
      prevProps.isActive === nextProps.isActive
    );
  }
);

// Memoized sidebar component
const MemoizedSidebar = memoizeComponent(
  ({ 
    view, 
    onViewChange 
  }: {
    view: string;
    onViewChange: (view: string) => void;
  }) => {
    const sidebarItems = React.useMemo(() => [
      { id: 'users', label: 'Users', icon: '👥' },
      { id: 'research', label: 'Research', icon: '🔬' },
      { id: 'recent', label: 'Recent', icon: '📄' }
    ], []);

    return (
      <div className="sidebar">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${view === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.view === nextProps.view;
  }
);

// Memoized document metadata form
const MemoizedDocumentMeta = memoizeComponent(
  ({ 
    metadata, 
    onMetadataChange 
  }: {
    metadata: any;
    onMetadataChange: (updates: any) => void;
  }) => {
    const handleFieldChange = useStableCallback((field: string, value: string) => {
      onMetadataChange({ [field]: value });
    });

    return (
      <div className="document-meta">
        <div className="meta-field">
          <label>Title:</label>
          <input
            type="text"
            value={metadata.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="Document title..."
          />
        </div>
        <div className="meta-field">
          <label>Description:</label>
          <textarea
            value={metadata.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Document description..."
            rows={3}
          />
        </div>
        <div className="meta-field">
          <label>Goals:</label>
          <textarea
            value={metadata.goals}
            onChange={(e) => handleFieldChange('goals', e.target.value)}
            placeholder="Research goals..."
            rows={2}
          />
        </div>
        <div className="meta-field">
          <label>Hypotheses:</label>
          <textarea
            value={metadata.hypotheses}
            onChange={(e) => handleFieldChange('hypotheses', e.target.value)}
            placeholder="Research hypotheses..."
            rows={2}
          />
        </div>
        <div className="meta-field">
          <label>Plan:</label>
          <textarea
            value={metadata.plan}
            onChange={(e) => handleFieldChange('plan', e.target.value)}
            placeholder="Research plan..."
            rows={3}
          />
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.metadata === nextProps.metadata;
  }
);

// Main optimized app component
export const OptimizedApp: React.FC = () => {
  usePerformanceMonitor('OptimizedApp');
  
  // Use optimized state management
  const {
    metadata,
    ui,
    tabs,
    activeTab,
    updateMetadata,
    updateUI,
    updateTabs,
    setActiveTab
  } = useEditorState();

  // Initialize TipTap editor with lazy loading
  const editor = useEditor({
    extensions: [
      StarterKit,
      // Add other extensions as needed
    ],
    content: '<p>Start writing...</p>',
    onUpdate: ({ editor }) => {
      // Debounced content updates
      debouncedContentUpdate(editor.getHTML());
    },
  });

  // Debounced content update to prevent excessive re-renders
  const debouncedContentUpdate = useDebouncedCallback((content: string) => {
    memoryMonitor.logOperation('Editor Content Update', () => {
      // Update content in state
      console.log('Content updated:', content.length, 'characters');
    });
  }, 500, []);

  // Debounced resize handler
  const debouncedResize = useDebouncedCallback(() => {
    memoryMonitor.logOperation('Window Resize', () => {
      // Handle resize operations
      console.log('Window resized');
    });
  }, 250, []);

  // Set up resize listener
  React.useEffect(() => {
    window.addEventListener('resize', debouncedResize);
    return () => window.removeEventListener('resize', debouncedResize);
  }, [debouncedResize]);

  // Stable event handlers
  const handleTabSelect = useStableCallback((tabId: string) => {
    setActiveTab(tabId);
  });

  const handleTabClose = useStableCallback((tabId: string) => {
    updateTabs(tabs => tabs.filter(tab => tab.id !== tabId));
  });

  const handleToolChange = useStableCallback((tool: string | null) => {
    updateUI({ activeTool: tool as any });
  });

  const handleSidebarViewChange = useStableCallback((view: string) => {
    updateUI({ sidebarView: view as any });
  });

  // Memoized tool configuration
  const toolConfig = React.useMemo(() => [
    { id: 'text', label: 'Text', icon: '📝' },
    { id: 'tables', label: 'Tables', icon: '📊' },
    { id: 'formulas', label: 'Formulas', icon: '∑' },
    { id: 'graphs', label: 'Graphs', icon: '📈' },
    { id: 'images', label: 'Images', icon: '🖼️' }
  ], []);

  // Virtualized tab rendering for many tabs
  const renderTab = React.useCallback((tab: any, index: number, style: React.CSSProperties) => (
    <div style={style}>
      <MemoizedTab
        tab={tab}
        isActive={tab.id === activeTab?.id}
        onSelect={() => handleTabSelect(tab.id)}
        onClose={() => handleTabClose(tab.id)}
        onDragStart={() => {}}
        onDragOver={() => {}}
        onDrop={() => {}}
      />
    </div>
  ), [activeTab?.id, handleTabSelect, handleTabClose]);

  return (
    <div className="app-container">
      {/* Header with tabs */}
      <div className="app-header">
        <div className="tabs-container">
          {tabs.length > 10 ? (
            // Use virtualization for many tabs
            <VirtualizedFixedList
              items={tabs}
              height={40}
              itemHeight={120}
              renderItem={renderTab}
              className="virtualized-tabs"
            />
          ) : (
            // Regular rendering for few tabs
            <div className="tabs">
              {tabs.map((tab) => (
                <MemoizedTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTab?.id}
                  onSelect={() => handleTabSelect(tab.id)}
                  onClose={() => handleTabClose(tab.id)}
                  onDragStart={() => {}}
                  onDragOver={() => {}}
                  onDrop={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="app-content">
        {/* Sidebar */}
        <MemoizedSidebar
          view={ui.sidebarView}
          onViewChange={handleSidebarViewChange}
        />

        {/* Main editor area */}
        <div className="editor-area">
          {activeTab?.type === 'home' ? (
            <MemoizedDocumentMeta
              metadata={metadata}
              onMetadataChange={updateMetadata}
            />
          ) : (
            <div className="editor-container">
              {/* Toolbar */}
              <div className="toolbar-container">
                <OptimizedFormattingToolbar
                  editor={editor}
                  activeTool={ui.activeTool}
                  onToolChange={handleToolChange}
                />
                <OptimizedToolTabs
                  activeTool={ui.activeTool}
                  onToolChange={handleToolChange}
                  tools={toolConfig}
                />
              </div>

              {/* Editor content */}
              <div className="editor-content">
                <React.Suspense fallback={<div>Loading editor...</div>}>
                  <EditorContent editor={editor} />
                </React.Suspense>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Export memoized app component
export default memoizeComponent(OptimizedApp);

