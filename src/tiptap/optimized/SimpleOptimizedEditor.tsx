/**
 * Simple Optimized TipTap Editor
 * A working, simplified version with basic optimizations
 */

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';

interface SimpleOptimizedEditorProps {
  content?: string;
  onUpdate?: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

export const SimpleOptimizedEditor: React.FC<SimpleOptimizedEditorProps> = ({
  content = '<p>Start writing...</p>',
  onUpdate,
  placeholder = 'Start writing...',
  editable = true,
  className = '',
}) => {
  // Debounced update handler
  const debouncedUpdateRef = React.useRef<NodeJS.Timeout>();
  
  const handleUpdate = React.useCallback(({ editor }: any) => {
    if (!onUpdate) return;
    
    // Clear previous timeout
    if (debouncedUpdateRef.current) {
      clearTimeout(debouncedUpdateRef.current);
    }
    
    // Set new timeout
    debouncedUpdateRef.current = setTimeout(() => {
      onUpdate(editor.getHTML());
    }, 300);
  }, [onUpdate]);

  // Optimized StarterKit configuration
  const optimizedStarterKit = React.useMemo(() => 
    StarterKit.configure({
      // Disable unnecessary extensions
      blockquote: false,
      horizontalRule: false,
      dropcursor: false,
      gapcursor: false,
      
      // Optimize history
      history: {
        depth: 30, // Reduced from default 100
        newGroupDelay: 1000,
      },
      
      // Limit heading levels
      heading: {
        levels: [1, 2, 3, 4],
      },
    }), []
  );

  // Memoized extensions array
  const extensions = React.useMemo(() => [
    optimizedStarterKit,
    TextStyle,
    Color,
    Underline,
    Highlight,
  ], [optimizedStarterKit]);

  const editor = useEditor({
    extensions,
    content,
    editable,
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class: `simple-optimized-editor ${className}`,
        'data-placeholder': placeholder,
      },
    },
    // Performance optimizations
    enableInputRules: true,
    enablePasteRules: true,
  }, [extensions, content, editable, handleUpdate, className, placeholder]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current);
      }
    };
  }, []);

  if (!editor) {
    return (
      <div className="editor-loading" style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: '#666'
      }}>
        Loading editor...
      </div>
    );
  }

  return (
    <div className="simple-optimized-editor-container">
      <EditorContent editor={editor} />
    </div>
  );
};

export default SimpleOptimizedEditor;

