/**
 * Optimized Toolbar Components
 * Implements memoization and debouncing for toolbar interactions
 */

import React from 'react';
import { memoizeComponent, toolbarPropsEqual, useDebouncedCallback, useStableCallback } from '../../utils/memoization';
import { usePerformanceMonitor } from '../../hooks/useOptimizedState';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  title: string;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
  className?: string;
}

// Memoized toolbar button
const MemoizedToolbarButton = memoizeComponent(
  ({ icon, title, isActive, isDisabled, onClick, className }: ToolbarButtonProps) => {
    return (
      <button
        className={`toolbar-button ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''} ${className || ''}`}
        onClick={onClick}
        disabled={isDisabled}
        title={title}
        type="button"
      >
        {icon}
      </button>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isActive === nextProps.isActive &&
      prevProps.isDisabled === nextProps.isDisabled &&
      prevProps.title === nextProps.title &&
      prevProps.className === nextProps.className &&
      prevProps.icon === nextProps.icon
    );
  }
);

interface ToolbarGroupProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

// Memoized toolbar group
const MemoizedToolbarGroup = memoizeComponent(
  ({ children, className, title }: ToolbarGroupProps) => {
    return (
      <div className={`toolbar-group ${className || ''}`} title={title}>
        {children}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.children === nextProps.children &&
      prevProps.className === nextProps.className &&
      prevProps.title === nextProps.title
    );
  }
);

interface FormattingToolbarProps {
  editor: any;
  activeTool: string | null;
  onToolChange: (tool: string | null) => void;
}

// Text formatting toolbar
export const OptimizedFormattingToolbar = memoizeComponent(
  ({ editor, activeTool, onToolChange }: FormattingToolbarProps) => {
    usePerformanceMonitor('OptimizedFormattingToolbar');
    
    // Memoized editor state checks
    const editorState = React.useMemo(() => {
      if (!editor) return {};
      
      return {
        isBold: editor.isActive('bold'),
        isItalic: editor.isActive('italic'),
        isUnderline: editor.isActive('underline'),
        isStrike: editor.isActive('strike'),
        isCode: editor.isActive('code'),
        isHighlight: editor.isActive('highlight'),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
      };
    }, [editor?.state?.selection, editor?.state?.doc]);

    // Debounced formatting commands to prevent excessive updates
    const debouncedToggleBold = useDebouncedCallback(() => {
      editor?.chain().focus().toggleBold().run();
    }, 50, [editor]);

    const debouncedToggleItalic = useDebouncedCallback(() => {
      editor?.chain().focus().toggleItalic().run();
    }, 50, [editor]);

    const debouncedToggleUnderline = useDebouncedCallback(() => {
      editor?.chain().focus().toggleUnderline().run();
    }, 50, [editor]);

    const debouncedToggleStrike = useDebouncedCallback(() => {
      editor?.chain().focus().toggleStrike().run();
    }, 50, [editor]);

    const debouncedToggleCode = useDebouncedCallback(() => {
      editor?.chain().focus().toggleCode().run();
    }, 50, [editor]);

    const debouncedToggleHighlight = useDebouncedCallback(() => {
      editor?.chain().focus().toggleHighlight().run();
    }, 50, [editor]);

    const handleUndo = useStableCallback(() => {
      editor?.chain().focus().undo().run();
    });

    const handleRedo = useStableCallback(() => {
      editor?.chain().focus().redo().run();
    });

    if (!editor) return null;

    return (
      <div className="formatting-toolbar">
        <MemoizedToolbarGroup title="History">
          <MemoizedToolbarButton
            icon="↶"
            title="Undo"
            isDisabled={!editorState.canUndo}
            onClick={handleUndo}
          />
          <MemoizedToolbarButton
            icon="↷"
            title="Redo"
            isDisabled={!editorState.canRedo}
            onClick={handleRedo}
          />
        </MemoizedToolbarGroup>

        <MemoizedToolbarGroup title="Text Formatting">
          <MemoizedToolbarButton
            icon="B"
            title="Bold"
            isActive={editorState.isBold}
            onClick={debouncedToggleBold}
            className="bold-button"
          />
          <MemoizedToolbarButton
            icon="I"
            title="Italic"
            isActive={editorState.isItalic}
            onClick={debouncedToggleItalic}
            className="italic-button"
          />
          <MemoizedToolbarButton
            icon="U"
            title="Underline"
            isActive={editorState.isUnderline}
            onClick={debouncedToggleUnderline}
            className="underline-button"
          />
          <MemoizedToolbarButton
            icon="S"
            title="Strikethrough"
            isActive={editorState.isStrike}
            onClick={debouncedToggleStrike}
            className="strike-button"
          />
          <MemoizedToolbarButton
            icon="<>"
            title="Code"
            isActive={editorState.isCode}
            onClick={debouncedToggleCode}
            className="code-button"
          />
          <MemoizedToolbarButton
            icon="H"
            title="Highlight"
            isActive={editorState.isHighlight}
            onClick={debouncedToggleHighlight}
            className="highlight-button"
          />
        </MemoizedToolbarGroup>
      </div>
    );
  },
  toolbarPropsEqual
);

interface ToolTabsProps {
  activeTool: string | null;
  onToolChange: (tool: string | null) => void;
  tools: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
  }>;
}

// Tool tabs component
export const OptimizedToolTabs = memoizeComponent(
  ({ activeTool, onToolChange, tools }: ToolTabsProps) => {
    usePerformanceMonitor('OptimizedToolTabs');
    
    const handleToolClick = useStableCallback((toolId: string) => {
      onToolChange(activeTool === toolId ? null : toolId);
    });

    return (
      <div className="tool-tabs">
        {tools.map((tool) => (
          <MemoizedToolbarButton
            key={tool.id}
            icon={tool.icon || tool.label}
            title={tool.label}
            isActive={activeTool === tool.id}
            onClick={() => handleToolClick(tool.id)}
            className="tool-tab"
          />
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.activeTool === nextProps.activeTool &&
      prevProps.tools === nextProps.tools
    );
  }
);

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  colors: string[];
  title: string;
}

// Optimized color picker
export const OptimizedColorPicker = memoizeComponent(
  ({ currentColor, onColorChange, colors, title }: ColorPickerProps) => {
    usePerformanceMonitor('OptimizedColorPicker');
    
    const [isOpen, setIsOpen] = React.useState(false);
    
    const handleColorSelect = useStableCallback((color: string) => {
      onColorChange(color);
      setIsOpen(false);
    });

    const togglePicker = useStableCallback(() => {
      setIsOpen(!isOpen);
    });

    return (
      <div className="color-picker">
        <MemoizedToolbarButton
          icon={<div className="color-preview" style={{ backgroundColor: currentColor }} />}
          title={title}
          onClick={togglePicker}
          className="color-picker-button"
        />
        {isOpen && (
          <div className="color-picker-dropdown">
            <div className="color-grid">
              {colors.map((color) => (
                <button
                  key={color}
                  className={`color-option ${color === currentColor ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorSelect(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.currentColor === nextProps.currentColor &&
      prevProps.colors === nextProps.colors &&
      prevProps.title === nextProps.title
    );
  }
);

// Font size selector
interface FontSizeSelectorProps {
  currentSize: number;
  onSizeChange: (size: number) => void;
  sizes: number[];
}

export const OptimizedFontSizeSelector = memoizeComponent(
  ({ currentSize, onSizeChange, sizes }: FontSizeSelectorProps) => {
    usePerformanceMonitor('OptimizedFontSizeSelector');
    
    const [isOpen, setIsOpen] = React.useState(false);
    
    const handleSizeSelect = useStableCallback((size: number) => {
      onSizeChange(size);
      setIsOpen(false);
    });

    const toggleSelector = useStableCallback(() => {
      setIsOpen(!isOpen);
    });

    return (
      <div className="font-size-selector">
        <MemoizedToolbarButton
          icon={`${currentSize}px`}
          title="Font Size"
          onClick={toggleSelector}
          className="font-size-button"
        />
        {isOpen && (
          <div className="font-size-dropdown">
            {sizes.map((size) => (
              <button
                key={size}
                className={`size-option ${size === currentSize ? 'active' : ''}`}
                onClick={() => handleSizeSelect(size)}
              >
                {size}px
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.currentSize === nextProps.currentSize &&
      prevProps.sizes === nextProps.sizes
    );
  }
);
