/**
 * Optimized Math Node Component
 * Implements deep memoization and performance optimizations for math editing
 */

import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { memoizeComponent, nodePropsEqual, useDebouncedCallback, useStableCallback } from '../../utils/memoization';
import { usePerformanceMonitor } from '../../hooks/useOptimizedState';

// Lazy load KaTeX for better performance
const KaTeX = React.lazy(() => 
  import('react-katex').then(module => ({ 
    default: module.InlineMath,
    BlockMath: module.BlockMath 
  }))
);

interface MathNodeProps {
  node: any;
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
  getPos: () => number;
  editor: any;
  selected: boolean;
}

// Memoized KaTeX renderer
const MemoizedKaTeX = memoizeComponent(
  ({ latex, isBlock, errorColor = '#cc0000' }: { 
    latex: string; 
    isBlock: boolean; 
    errorColor?: string; 
  }) => {
    const katexOptions = React.useMemo(() => ({
      throwOnError: false,
      errorColor,
      strict: false,
    }), [errorColor]);

    return (
      <React.Suspense fallback={<span className="math-loading">Loading math...</span>}>
        {isBlock ? (
          <KaTeX math={latex} settings={katexOptions} />
        ) : (
          <KaTeX math={latex} settings={katexOptions} />
        )}
      </React.Suspense>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.latex === nextProps.latex &&
      prevProps.isBlock === nextProps.isBlock &&
      prevProps.errorColor === nextProps.errorColor
    );
  }
);

// Memoized math input component
const MemoizedMathInput = memoizeComponent(
  ({ 
    value, 
    onChange, 
    onSave, 
    onCancel, 
    placeholder,
    autoFocus = true 
  }: {
    value: string;
    onChange: (value: string) => void;
    onSave: () => void;
    onCancel: () => void;
    placeholder?: string;
    autoFocus?: boolean;
  }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    React.useEffect(() => {
      if (autoFocus && inputRef.current) {
        setTimeout(() => {
          inputRef.current?.focus();
          const length = inputRef.current?.value.length || 0;
          inputRef.current?.setSelectionRange(length, length);
        }, 10);
      }
    }, [autoFocus]);

    const handleKeyDown = useStableCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    });

    return (
      <div className="math-input-container">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="math-input"
        />
        <div className="math-input-buttons">
          <button onClick={onSave} className="math-save-btn">
            Save
          </button>
          <button onClick={onCancel} className="math-cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.value === nextProps.value &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.autoFocus === nextProps.autoFocus
    );
  }
);

const OptimizedMathNodeView: React.FC<MathNodeProps> = ({
  node,
  updateAttributes,
  deleteNode,
  getPos,
  editor,
  selected
}) => {
  usePerformanceMonitor('OptimizedMathNode');
  
  const { mathType, originalLatex, currentLatex, editingId } = node.attrs;
  const [isEditing, setIsEditing] = React.useState(true);
  const [inputValue, setInputValue] = React.useState(originalLatex || '');
  
  const isBlock = mathType === 'block';
  
  // Memoized display latex
  const displayLatex = React.useMemo(() => {
    return currentLatex || originalLatex || '';
  }, [currentLatex, originalLatex]);

  // Debounced save to prevent excessive updates
  const debouncedSave = useDebouncedCallback(() => {
    if (inputValue.trim()) {
      // Replace the math editing node with actual math node
      const pos = getPos();
      if (pos !== undefined) {
        const mathNodeType = isBlock ? 'blockMath' : 'inlineMath';
        const transaction = editor.state.tr.replaceWith(
          pos,
          pos + node.nodeSize,
          editor.schema.nodes[mathNodeType].create({
            latex: inputValue.trim()
          })
        );
        editor.view.dispatch(transaction);
      }
    } else {
      // Delete empty math node
      deleteNode();
    }
  }, 300, [inputValue, isBlock, getPos, editor, node.nodeSize, deleteNode]);

  const handleCancel = useStableCallback(() => {
    deleteNode();
  });

  const handleInputChange = useStableCallback((value: string) => {
    setInputValue(value);
    // Update current latex for live preview
    updateAttributes({ currentLatex: value });
  });

  // Auto-width calculation for input
  const inputWidth = React.useMemo(() => {
    return Math.max(100, Math.min(500, inputValue.length * 8 + 50));
  }, [inputValue.length]);

  return (
    <NodeViewWrapper 
      className={`math-editing-node ${isBlock ? 'block' : 'inline'} ${selected ? 'ProseMirror-selectednode' : ''}`}
      style={isBlock ? {} : { display: 'inline-block' }}
    >
      <div className="math-editing-container">
        {isEditing ? (
          <div className="math-editing-input" style={{ width: inputWidth }}>
            <MemoizedMathInput
              value={inputValue}
              onChange={handleInputChange}
              onSave={debouncedSave}
              onCancel={handleCancel}
              placeholder={isBlock ? "Enter block math (LaTeX)..." : "Enter inline math (LaTeX)..."}
              autoFocus={true}
            />
            {inputValue && (
              <div className="math-preview">
                <span className="math-preview-label">Preview:</span>
                <MemoizedKaTeX
                  latex={inputValue}
                  isBlock={isBlock}
                />
              </div>
            )}
          </div>
        ) : (
          <div 
            className="math-display"
            onClick={() => setIsEditing(true)}
          >
            <MemoizedKaTeX
              latex={displayLatex}
              isBlock={isBlock}
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

// Export memoized component with custom comparison
export const OptimizedMathNode = memoizeComponent(
  OptimizedMathNodeView,
  nodePropsEqual
);

