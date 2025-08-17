import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import CodeBlock from '@tiptap/extension-code-block';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Image from '@tiptap/extension-image';
import Mathematics, { migrateMathStrings } from '@tiptap/extension-mathematics';
import DragHandleReact from '@tiptap/extension-drag-handle-react';
// Table with extra attributes
import TableWithExtras from '../tiptap/TableExtras';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import FontSize from '../tiptap/FontSize';
import BackgroundColor from '../tiptap/BackgroundColor';
import { MathEditingNode } from '../tiptap/MathEditingNode';
import { GraphNode } from '../tiptap/GraphNode';
import {
  RiBold,
  RiItalic,
  RiStrikethrough,
  RiUnderline,
  RiMarkPenLine,
  RiParagraph,
  RiH1,
  RiH2,
  RiH3,
  RiH4,
  RiH5,
  RiH6,
  RiAlignLeft,
  RiAlignCenter,
  RiAlignRight,
  RiAlignJustify,
  RiListUnordered,
  RiListOrdered,
  RiCodeBoxLine,
  RiCodeLine,
  RiImageLine,
  RiMenuLine,
  RiSubscript,
  RiSuperscript,
  RiArrowDownSLine,
  RiCheckLine,
  RiFontColor,
  RiPaintFill,
  RiTableLine,
  RiAddLine,
  RiSubtractLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiEyeLine,
  RiEyeOffLine,
  RiDeleteBinLine,
  RiDeleteBack2Line,
  RiDeleteBin2Line,
  RiEditLine,
} from 'react-icons/ri';

type DropdownItem = { key: string; label: string; icon?: ReactNode };

const Dropdown: React.FC<{
  label: string;
  icon?: ReactNode;
  items: DropdownItem[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  active?: boolean;
  fixedWidthPx?: number;
  mathEditingState?: { isEditing: boolean; originalPosition: number; mathType: 'inline' | 'block'; originalLatex: string; } | null;
}> = ({ label, icon, items, selectedKey, onSelect, active = false, fixedWidthPx, mathEditingState }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);
  return (
    <div className="dropdown" ref={containerRef}>
      <button
        className={`tool ${active ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        onMouseDown={(e) => mathEditingState?.isEditing && e.preventDefault()}
        aria-haspopup="menu"
        aria-expanded={open}
        style={fixedWidthPx ? { width: fixedWidthPx, justifyContent: 'space-between' } as React.CSSProperties : { display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flex: fixedWidthPx ? '1 1 auto' : undefined }}>
          {icon}
          {label ? <span className="dropdown-label" style={{ minWidth: 0 }}>{label}</span> : null}
        </span>
        <RiArrowDownSLine />
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          {items.map((it) => (
            <button
              key={it.key}
              className="tool"
              role="menuitemradio"
              aria-checked={selectedKey === it.key}
              onClick={() => { onSelect(it.key); setOpen(false); }}
              onMouseDown={(e) => mathEditingState?.isEditing && e.preventDefault()}
              title={it.label}
              style={{ justifyContent: 'flex-start', gap: 8 }}
            >
              {it.icon}
              <span>{it.label}</span>
              {selectedKey === it.key && <RiCheckLine style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Grid-based dropdown for formula panel - displays items in a table layout
const GridDropdown: React.FC<{
  label: string;
  icon?: ReactNode;
  items: DropdownItem[];
  onSelect: (key: string) => void;
  active?: boolean;
  columns?: number;
  mathEditingState?: { isEditing: boolean; originalPosition: number; mathType: 'inline' | 'block'; originalLatex: string; } | null;
}> = ({ label, icon, items, onSelect, active = false, columns = 4, mathEditingState }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="dropdown" ref={containerRef}>
      <button
        className={`tool grid-dropdown-button ${active ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        onMouseDown={(e) => mathEditingState?.isEditing && e.preventDefault()}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid-dropdown-content">
          {icon}
          {label ? <span className="dropdown-label">{label}</span> : null}
        </span>
        <RiArrowDownSLine />
      </button>
      {open && (
        <div 
          className="dropdown-menu grid-dropdown-menu" 
          role="menu"
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`
          }}
        >
          {items.map((it) => (
            <button
              key={it.key}
              className="tool grid-dropdown-item"
              role="menuitemradio"
              onClick={() => { onSelect(it.key); setOpen(false); }}
              onMouseDown={(e) => mathEditingState?.isEditing && e.preventDefault()}
              title={it.label}

            >
              {it.icon}
              <span className="grid-dropdown-key">{it.key}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

type Tab = {
  id: string;
  title: string;
  closable: boolean;
  type: 'home' | 'create' | 'doc';
  data?: any;
  filePath?: string | null;
  scrollTop?: number;
};

type DocMeta = {
  title: string;
  description: string;
  goals: string;
  hypotheses: string;
  plan: string;
};

declare global {
  interface Window {
    api: {
      saveDocumentAs: (payload: { defaultPath?: string; jsonData: any; asXml?: boolean }) => Promise<any>;
      saveDocumentToPath: (payload: { filePath: string; jsonData: any; asXml?: boolean }) => Promise<any>;
      openDocument: () => Promise<any>;
      openDocumentPath: (filePath: string) => Promise<any>;
      onOpenFilePath: (cb: (path: string) => void) => void;
      exportPdf: () => Promise<any>;
      newDocument: () => Promise<any>;
      onMenuNew: (cb: () => void) => void;
      onMenuSave: (cb: () => void) => void;
      onMenuSaveAs: (cb: () => void) => void;
      onFileOpened: (cb: (payload: any) => void) => void;
        detachTab: (payload: any) => Promise<any>;
        reattachTab: (payload: any) => Promise<any>;
        onExternalOpenTab: (cb: (payload: any) => void) => void;
        onExternalReattachTab: (cb: (payload: any) => void) => void;
        broadcastCloseToken: (token: string) => Promise<any>;
        startExternalDrag: (payload: any) => void;
        endExternalDrag: () => void;
        onExternalDragStart: (cb: (payload: any) => void) => void;
        onExternalDragEnd: (cb: () => void) => void;
        closeSelf: () => Promise<any>;
        pickImage: () => Promise<{ canceled: boolean; filePath?: string }>;
    };
  }
}

const uid = () => Math.random().toString(36).slice(2);

export const App: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<string>('home');
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'home', title: 'Начало', closable: false, type: 'home' },
  ]);
  const [sidebarView, setSidebarView] = useState<'users' | 'research' | 'recent'>('users');

  const [docMeta, setDocMeta] = useState<DocMeta>({
    title: '',
    description: '',
    goals: '',
    hypotheses: '',
    plan: '',
  });

  const [activeTool, setActiveTool] = useState<'text' | 'tables' | 'formulas' | 'graphs' | null>('text');
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropBefore, setDropBefore] = useState<boolean>(false);
  const [selectedGraph, setSelectedGraph] = useState<any>(null);
  
  // Math editing state
  const [mathEditingState, setMathEditingState] = useState<{
    isEditing: boolean;
    originalPosition: number;
    mathType: 'inline' | 'block';
    originalLatex: string;
  } | null>(null);
  // detach is triggered by double-click now; DnD used for reorder and reattach only

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId]);

  // Editor must be declared before any useEffect/useRef that references it
  const editor = useEditor({
    onCreate: ({ editor: currentEditor }) => {
      migrateMathStrings(currentEditor);
    },
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      Color,
      BackgroundColor,
      Underline,
      Highlight,
      FontFamily,
      CodeBlock,
      Subscript,
      Superscript,
      Image,
      MathEditingNode,
      GraphNode,
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
          errorColor: '#cc0000',
          strict: false,
        },
        blockOptions: {
          onClick: (node, pos) => {
            const handleBlockClick = () => {
              const latex = node.attrs.latex;
              
              console.log(`=== STARTING BLOCK EDIT "${latex}" at pos ${pos} ===`);
              
              // Debug: Check what node is at this position
              const nodeAtPos = editor.state.doc.nodeAt(pos);
              console.log(`Node at position ${pos}:`, nodeAtPos?.type.name, nodeAtPos?.attrs);
              
              // VALIDATION: Check if clicked node matches the position and type
              if (nodeAtPos) {
                if (nodeAtPos.type.name === 'inlineMath') {
                  console.error(`TYPE MISMATCH: Trying to edit block but found inlineMath at position ${pos}`);
                  return; // Abort - don't try to edit wrong type
                }
                if (nodeAtPos.type.name === 'blockMath' && nodeAtPos.attrs.latex !== latex) {
                  console.warn(`CONTENT MISMATCH: Clicked "${latex}" but found "${nodeAtPos.attrs.latex}" at position ${pos}`);
                }
              }
              
              // ROBUST FIX: Find the EXACT position of the clicked node object
              let actualMathPos: number = pos; // Initialize with clicked position as fallback
              let foundMathNode = false;
              
              // Search the entire document to find this EXACT node object
              editor.state.doc.descendants((docNode, nodePos, parent) => {
                // Compare the actual node objects and their content
                if (docNode.type.name === 'blockMath' && 
                    docNode.attrs.latex === latex &&
                    docNode === node) { // This is the exact same node object
                  actualMathPos = nodePos;
                  foundMathNode = true;
                  console.log(`Found EXACT node object at position ${nodePos} (clicked pos was ${pos})`);
                  return false; // Stop searching
                }
              });
              
              // Fallback: if we can't find the exact node, search by content near the click
              if (!foundMathNode) {
                console.warn(`Could not find exact node object, falling back to content search`);
                let bestMatch = null;
                let bestDistance = Infinity;
                
                editor.state.doc.descendants((docNode, nodePos, parent) => {
                  if (docNode.type.name === 'blockMath' && docNode.attrs.latex === latex) {
                    const distance = Math.abs(nodePos - pos);
                    if (distance < bestDistance && distance <= 10) { // Larger range for block
                      bestMatch = nodePos;
                      bestDistance = distance;
                      console.log(`Found candidate block math node at position ${nodePos} (distance: ${distance})`);
                    }
                  }
                });
                
                if (bestMatch !== null) {
                  actualMathPos = bestMatch;
                  foundMathNode = true;
                  console.log(`Using closest match at position ${bestMatch}`);
                }
              }
              
              if (!foundMathNode) {
                console.error(`Could not find block math node with latex "${latex}" near position ${pos}`);
                return;
              }
              
              setMathEditingState({
                isEditing: true,
                originalPosition: actualMathPos,
                mathType: 'block',
                originalLatex: latex
              });
              
              // Create a unique ID for this editing session
              const editingId = `math-editing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              
              // Replace the math node with our custom editing node
              editor.chain()
                .setNodeSelection(actualMathPos)
                .deleteSelection()
                .insertContent({
                  type: 'mathEditingNode',
                  attrs: {
                    mathType: 'block',
                    originalLatex: latex,
                    editingId: editingId
                  }
                })
                .run();
              
              // Remove focus from the editor to prevent cursor conflicts
              setTimeout(() => {
                if (editor.view.dom) {
                  editor.view.dom.blur();
                }
              }, 20);
            };
            
            // Check if there's already an editing node and finish it first
            const existingEditingNodes = editor.view.dom.querySelectorAll('.math-editing-node');
            if (existingEditingNodes.length > 0) {
              console.log(`=== SWITCHING TO BLOCK FORMULA "${node.attrs.latex}" at pos ${pos} ===`);
              
              // Store current LaTeX values to prevent interference
              const currentEditingValues = Array.from(existingEditingNodes).map((nodeElement, index) => {
                const input = nodeElement.querySelector('input') as HTMLInputElement;
                const editingId = nodeElement.getAttribute('data-math-editing') || '';
                const currentValue = input?.value || '';
                console.log(`Existing node ${index + 1} [${editingId}]: "${currentValue}"`);
                return {
                  input: input,
                  currentValue: currentValue,
                  editingId: editingId
                };
              });
              
              // Track if editing finished event fired to prevent double execution
              let eventFired = false;
              
              // Listen for completion before starting new edit
              const handleEditingFinished = (event: any) => {
                if (eventFired) return;
                eventFired = true;
                
                console.log(`Previous editing finished [${event.detail.editingId}], starting new block edit...`);
                document.removeEventListener('mathEditingFinished', handleEditingFinished);
                setTimeout(() => {
                  // CRITICAL: Find the actual current position of the target formula
                  // since positions may have shifted during editing
                  let foundPos = pos;
                  const targetLatex = node.attrs.latex;
                  let bestMatch = null;
                  let bestDistance = Infinity;
                  
                  // Search for the target formula, preferring the one closest to original position
                  editor.state.doc.descendants((node, currentPos) => {
                    if (node.type.name === 'blockMath' && node.attrs.latex === targetLatex) {
                      const distance = Math.abs(currentPos - pos);
                      if (distance < bestDistance) {
                        bestMatch = currentPos;
                        bestDistance = distance;
                        console.log(`Found target formula "${targetLatex}" at position ${currentPos} (distance: ${distance})`);
                      }
                    }
                  });
                  
                  if (bestMatch !== null) {
                    foundPos = bestMatch;
                    console.log(`Using closest match at position: ${foundPos}`);
                  }
                  
                  const currentCursor = editor.state.selection.from;
                  console.log(`Current cursor: ${currentCursor}, target: ${foundPos}`);
                  if (currentCursor !== foundPos) {
                    console.log(`Setting cursor to target position ${foundPos} before starting new edit`);
                    editor.chain().setTextSelection(foundPos).run();
                  }
                  handleBlockClick();
                }, 50);
              };
              
              document.addEventListener('mathEditingFinished', handleEditingFinished);
              
              // Finish existing editing nodes
              currentEditingValues.forEach(({ input, currentValue, editingId }) => {
                if (input) {
                  console.log(`Triggering ESC on [${editingId}] with value: "${currentValue}"`);
                  input.value = currentValue;
                  const escEvent = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    code: 'Escape',
                    bubbles: true,
                    cancelable: true
                  });
                  input.dispatchEvent(escEvent);
                }
              });
              
              // Fallback timeout
              setTimeout(() => {
                if (eventFired) return; // Don't execute fallback if event already fired
                eventFired = true;
                
                document.removeEventListener('mathEditingFinished', handleEditingFinished);
                console.log('Fallback: Starting new block click after timeout...');
                // CRITICAL: Reset cursor to target position in fallback too
                console.log(`Fallback: Setting cursor to target position ${pos}`);
                editor.chain().setTextSelection(pos).run();
                handleBlockClick();
              }, 300);
              
              return;
            }
            
            handleBlockClick();
          },
        },
        inlineOptions: {
          onClick: (node, pos) => {
            const handleInlineClick = () => {
              const latex = node.attrs.latex;
              
              console.log(`=== STARTING INLINE EDIT "${latex}" at pos ${pos} ===`);
              
              // Debug: Check what node is at this position
              const nodeAtPos = editor.state.doc.nodeAt(pos);
              console.log(`Node at position ${pos}:`, nodeAtPos?.type.name, nodeAtPos?.attrs);
              
              // VALIDATION: Check if clicked node matches the position and type
              if (nodeAtPos) {
                if (nodeAtPos.type.name === 'blockMath') {
                  console.error(`TYPE MISMATCH: Trying to edit inline but found blockMath at position ${pos}`);
                  return; // Abort - don't try to edit wrong type
                }
                if (nodeAtPos.type.name === 'inlineMath' && nodeAtPos.attrs.latex !== latex) {
                  console.warn(`CONTENT MISMATCH: Clicked "${latex}" but found "${nodeAtPos.attrs.latex}" at position ${pos}`);
                }
              }
              
              // ROBUST FIX: Find the EXACT position of the clicked node object
              let actualMathPos: number = pos; // Initialize with clicked position as fallback
              let foundMathNode = false;
              
              // Search the entire document to find this EXACT node object
              editor.state.doc.descendants((docNode, nodePos, parent) => {
                // Compare the actual node objects and their content
                if (docNode.type.name === 'inlineMath' && 
                    docNode.attrs.latex === latex &&
                    docNode === node) { // This is the exact same node object
                  actualMathPos = nodePos;
                  foundMathNode = true;
                  console.log(`Found EXACT node object at position ${nodePos} (clicked pos was ${pos})`);
                  return false; // Stop searching
                }
              });
              
              // Fallback: if we can't find the exact node, search by content near the click
              if (!foundMathNode) {
                console.warn(`Could not find exact node object, falling back to content search`);
                let bestMatch = null;
                let bestDistance = Infinity;
                
                editor.state.doc.descendants((docNode, nodePos, parent) => {
                  if (docNode.type.name === 'inlineMath' && docNode.attrs.latex === latex) {
                    const distance = Math.abs(nodePos - pos);
                    if (distance < bestDistance && distance <= 5) {
                      bestMatch = nodePos;
                      bestDistance = distance;
                      console.log(`Found candidate inline math node at position ${nodePos} (distance: ${distance})`);
                    }
                  }
                });
                
                if (bestMatch !== null) {
                  actualMathPos = bestMatch;
                  foundMathNode = true;
                  console.log(`Using closest match at position ${bestMatch}`);
                }
              }
              
              if (!foundMathNode) {
                console.error(`Could not find inline math node with latex "${latex}" near position ${pos}`);
                return;
              }
              
              setMathEditingState({
                isEditing: true,
                originalPosition: actualMathPos,
                mathType: 'inline',
                originalLatex: latex
              });
              
              // Create a unique ID for this editing session
              const editingId = `math-editing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              
              // Replace the math node with our custom editing node
              editor.chain()
                .setNodeSelection(actualMathPos)
                .deleteSelection()
                .insertContent({
                  type: 'mathEditingNode',
                  attrs: {
                    mathType: 'inline',
                    originalLatex: latex,
                    editingId: editingId
                  }
                })
                .run();
              
              // Remove focus from the editor to prevent cursor conflicts
              setTimeout(() => {
                if (editor.view.dom) {
                  editor.view.dom.blur();
                }
              }, 20);
            };
            
            // Check if there's already an editing node and finish it first
            const existingEditingNodes = editor.view.dom.querySelectorAll('.math-editing-node');
            if (existingEditingNodes.length > 0) {
              // Store current LaTeX values to prevent interference
              const currentEditingValues = Array.from(existingEditingNodes).map(nodeElement => {
                const input = nodeElement.querySelector('input') as HTMLInputElement;
                return {
                  input: input,
                  currentValue: input?.value || ''
                };
              });
              
              // Track if editing finished event fired to prevent double execution
              let eventFired = false;
              
              // Listen for completion before starting new edit
              const handleEditingFinished = () => {
                if (eventFired) return;
                eventFired = true;
                
                document.removeEventListener('mathEditingFinished', handleEditingFinished);
                setTimeout(() => {
                  // CRITICAL: Find the actual current position of the target formula
                  // since positions may have shifted during editing
                  let foundPos = pos;
                  const targetLatex = node.attrs.latex;
                  let bestMatch = null;
                  let bestDistance = Infinity;
                  
                  // Search for the target formula, preferring the one closest to original position
                  editor.state.doc.descendants((node, currentPos) => {
                    if (node.type.name === 'inlineMath' && node.attrs.latex === targetLatex) {
                      const distance = Math.abs(currentPos - pos);
                      if (distance < bestDistance) {
                        bestMatch = currentPos;
                        bestDistance = distance;
                        console.log(`Found target formula "${targetLatex}" at position ${currentPos} (distance: ${distance})`);
                      }
                    }
                  });
                  
                  if (bestMatch !== null) {
                    foundPos = bestMatch;
                    console.log(`Using closest match at position: ${foundPos}`);
                  }
                  
                  const currentCursor = editor.state.selection.from;
                  console.log(`Current cursor: ${currentCursor}, target: ${foundPos}`);
                  if (currentCursor !== foundPos) {
                    console.log(`Setting cursor to target position ${foundPos} before starting inline edit`);
                    editor.chain().setTextSelection(foundPos).run();
                  }
                  handleInlineClick();
                }, 50);
              };
            
              document.addEventListener('mathEditingFinished', handleEditingFinished);
              
              // Finish existing editing nodes
              currentEditingValues.forEach(({ input, currentValue }) => {
                if (input) {
                  input.value = currentValue;
                  const escEvent = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    code: 'Escape',
                    bubbles: true,
                    cancelable: true
                  });
                  input.dispatchEvent(escEvent);
                }
              });
              
              // Fallback timeout
              setTimeout(() => {
                if (eventFired) return; // Don't execute fallback if event already fired
                eventFired = true;
                
                document.removeEventListener('mathEditingFinished', handleEditingFinished);
                // CRITICAL: Reset cursor to target position in fallback too
                console.log(`Fallback: Setting cursor to target position ${pos} for inline`);
                editor.chain().setTextSelection(pos).run();
                handleInlineClick();
              }, 300);
              
              return;
            }
            
            handleInlineClick();
          },
        },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableWithExtras.configure({
        resizable: true,
        lastColumnResizable: false, // Disable resizing the last column
        handleWidth: 5,
        cellMinWidth: 50,
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'a4-canvas',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const active = tabs.find((t) => t.id === activeTabId);
      if (active && active.type === 'doc') {
        const html = ed.getHTML();
        setTabs((prev) => prev.map((t) => t.id === active.id ? { ...t, data: { ...t.data, contentHtml: html } } : t));
      }
    },
  });

  // Force re-render on selection/content changes so toolbar state stays in sync
  const [, setEditorTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const rerender = () => setEditorTick((t) => t + 1);
    editor.on('selectionUpdate', rerender);
    editor.on('transaction', rerender);
    editor.on('update', rerender);
    return () => {
      editor.off('selectionUpdate', rerender);
      editor.off('transaction', rerender);
      editor.off('update', rerender);
    };
  }, [editor]);

  // Debug Mathematics extension and handle math editing
  useEffect(() => {
    if (!editor) return;
    

    
    // Handle keyboard events for Esc/Enter keys to exit math editing
    const handleKeyDown = (event: KeyboardEvent) => {
      if (mathEditingState?.isEditing && (event.key === 'Escape' || event.key === 'Enter')) {
        // Check if we have a math editing node that should handle this
        const editorElement = editor.view.dom;
        const mathEditingNodes = editorElement.querySelectorAll('.math-editing-node');
        
        if (mathEditingNodes.length > 0) {
          // Let the math editing node handle the key
          return;
        }
        

        event.preventDefault();
        event.stopPropagation();
        finishMathEditing();
      }
    };

    // Add keyboard listener to the editor's DOM element
    const editorElement = editor.view.dom;
    editorElement.addEventListener('keydown', handleKeyDown);

    // Listen for math editing finished events from the editing nodes
    const handleMathEditingFinished = (event: any) => {
      // Reset the math editing state when the editing node is replaced
      setMathEditingState(null);
    };

    // Debounced observer to watch for math editing nodes being added/removed
    let observerTimeout: NodeJS.Timeout | null = null;
    const observerCallback = (mutations: MutationRecord[]) => {
      // Debounce the observer to prevent excessive state updates
      if (observerTimeout) {
        clearTimeout(observerTimeout);
      }
      
      observerTimeout = setTimeout(() => {
        // Check if there are any math editing nodes in the document
        const editingNodes = editorElement.querySelectorAll('.math-editing-node');
        const hasEditingNodes = editingNodes.length > 0;

        let editingNodeFound = null;
        if (hasEditingNodes && editingNodes[0]) {
          const nodeElement = editingNodes[0] as HTMLElement;
          
          // Extract editing info from data attributes
          editingNodeFound = {
            isEditing: true,
            originalPosition: 0, // Position tracking can be added later if needed
            mathType: nodeElement.getAttribute('data-math-type') as 'block' | 'inline' || 'inline',
            originalLatex: nodeElement.getAttribute('data-original-latex') || ''
          };


        }

        // Sync the editing state with the presence of editing nodes
        if (hasEditingNodes && !mathEditingState?.isEditing) {
          setMathEditingState(editingNodeFound);
        } else if (!hasEditingNodes && mathEditingState?.isEditing) {
          setMathEditingState(null);
        }
      }, 50); // 50ms debounce
    };

    // Set up MutationObserver to watch for DOM changes
    const observer = new MutationObserver(observerCallback);
    observer.observe(editorElement, {
      childList: true,
      subtree: true,
      attributes: false
    });

    // Initial check for existing editing nodes
    observerCallback([]);

    document.addEventListener('mathEditingFinished', handleMathEditingFinished);

    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mathEditingFinished', handleMathEditingFinished);
      observer.disconnect();
      if (observerTimeout) {
        clearTimeout(observerTimeout);
      }
    };
  }, [editor, mathEditingState]);



  // Function to finish math editing and convert to proper math node
  const finishMathEditing = () => {
    if (!editor || !mathEditingState) return;
    
    // The math editing node handles finishing internally
    // Just reset the editing state
      setMathEditingState(null);
  };

  // Refs to avoid duplicate listeners and stale closures
  const activeTabRef = useRef<Tab | undefined>(activeTab);
  const tabsRef = useRef<Tab[]>(tabs);
  const docMetaRef = useRef<DocMeta>({ ...docMeta });
  const editorRef = useRef<any>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const saveAsRef = useRef<() => Promise<void>>(async () => {});
  const viewRef = useRef<HTMLDivElement | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const externalDragPayloadRef = useRef<any>(null);
  const textColorInputRef = useRef<HTMLInputElement | null>(null);
  const bgColorInputRef = useRef<HTMLInputElement | null>(null);
  function setActiveTabSafely(nextId: string) {
    const currentId = activeTabRef.current?.id;
    const currentScroll = viewRef.current?.scrollTop || 0;
    if (currentId) {
      setTabs((prev) => prev.map((t) => t.id === currentId ? { ...t, scrollTop: currentScroll } : t));
    }
    setActiveTabId(nextId);
    requestAnimationFrame(() => {
      const next = tabsRef.current.find((t) => t.id === nextId);
      if (viewRef.current) viewRef.current.scrollTop = next?.scrollTop || 0;
    });
  }

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { docMetaRef.current = docMeta; }, [docMeta]);

  // Global graph selection management - works regardless of active tab
  useEffect(() => {
    const handleGraphSelected = (event: any) => {
      setSelectedGraph(event.detail)
    }

    document.addEventListener('graphSelected', handleGraphSelected)
    return () => document.removeEventListener('graphSelected', handleGraphSelected)
  }, [])

  // Global click handler to deselect graphs when clicking empty space - works from any tab
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Check if click is on editor content but not on a graph
      if (target.closest('.a4-canvas') && !target.closest('.graph-node')) {
        setSelectedGraph(null)
        // Remove selection styling from all graphs
        document.querySelectorAll('.graph-node').forEach(el => {
          el.classList.remove('selected')
        })
      }
    }

    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])
  useEffect(() => { editorRef.current = editor; }, [editor]);
  // Helpers to normalize CSS color strings to #rrggbb for <input type="color">
  function rgbToHex(rgb: string): string | null {
    const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
    if (!m) return null;
    const r = Number(m[1]).toString(16).padStart(2, '0');
    const g = Number(m[2]).toString(16).padStart(2, '0');
    const b = Number(m[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  function normalizeHexColor(value: string | undefined, fallback: string): string {
    if (!value) return fallback;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
    const hex = rgbToHex(value);
    return hex || fallback;
  }

  function normalizeFontFamilyName(value?: string): string {
    if (!value) return 'system-ui';
    const first = value.split(',')[0]?.trim() || value;
    return first.replace(/^['"]+|['"]+$/g, '');
  }



  // Handle OS-level open file (register once)
  useEffect(() => {
    if (!(window as any).api?.onOpenFilePath) return;
    const handler = async (filePath: string) => {
      const res = await window.api.openDocumentPath(filePath);
      if (!res?.canceled) {
        openLoadedDoc(res.data, filePath);
      }
    };
    window.api.onOpenFilePath(handler as any);
  }, []);

  // Listen for menu events (register once; use refs inside). Preload clears previous listeners.
  useEffect(() => {
    if (!(window as any).api) return;
    window.api.onMenuNew(() => openCreateTab());
    window.api.onMenuSave(async () => {
      if (activeTabRef.current?.type === 'doc') await saveRef.current();
    });
    window.api.onMenuSaveAs(async () => {
      if (activeTabRef.current?.type === 'doc') await saveAsRef.current();
    });
    window.api.onFileOpened(({ filePath, data }: any) => openLoadedDoc(data, filePath));
    window.api.onExternalOpenTab((payload: any) => {
      // Child window should not have a Start tab; open only the received tab
      const id = uid();
      const data = payload?.data || {};
      const meta: DocMeta = {
        title: data.title || data?.meta?.title || payload?.title || 'Документ',
        description: data.description || data?.meta?.description || '',
        goals: data.goals || data?.meta?.goals || '',
        hypotheses: data.hypotheses || data?.meta?.hypotheses || '',
        plan: data.plan || data?.meta?.plan || '',
      };
      setTabs([{ id, title: meta.title || 'Документ', closable: true, type: 'doc', data: { meta, contentHtml: data.contentHtml || '<p></p>' }, filePath: payload?.filePath || null }]);
      setActiveTabId(id);
    });
    window.api.onExternalReattachTab((payload: any) => {
      // add back a tab to this window and close child window by token
      const data = payload?.data || {};
      openLoadedDoc(data, payload?.filePath);
      if (payload?.closeToken) {
        window.api.broadcastCloseToken(payload.closeToken);
      }
    });
    // external drag payload listeners
    window.api.onExternalDragStart((payload: any) => { externalDragPayloadRef.current = payload; });
    window.api.onExternalDragEnd(() => { externalDragPayloadRef.current = null; });
  }, []);


  function getCurrentActiveId() {
    return activeTabRef.current?.id ?? activeTabId;
  }

  function openCreateTab() {
    const id = uid();
    setTabs((prev) => {
      const currentId = getCurrentActiveId();
      const insertAfter = prev.findIndex((t) => t.id === currentId);
      const nextTabs = [...prev];
      const newTab: Tab = { id, title: 'Новое исследование', closable: true, type: 'create' };
      const insertIndex = Math.min(Math.max(insertAfter + 1, 0), nextTabs.length);
      nextTabs.splice(insertIndex, 0, newTab);
      return nextTabs;
    });
    setActiveTabSafely(id);
    // reset meta for new doc creation
    setDocMeta({ title: '', description: '', goals: '', hypotheses: '', plan: '' });
    editor?.commands.setContent('<p></p>');
  }

  function createDocument() {
    const id = uid();
    setTabs((prev) => {
      const currentId = getCurrentActiveId();
      const createIndex = prev.findIndex((t) => t.id === currentId);
      const nextTabs = [...prev];
      const newTab: Tab = { id, title: docMeta.title || 'Без названия', closable: true, type: 'doc', data: { meta: { ...docMeta }, contentHtml: '<p></p>' }, filePath: null };
      const insertIndex = Math.min(Math.max(createIndex + 1, 0), nextTabs.length);
      nextTabs.splice(insertIndex, 0, newTab);
      // remove the create tab
      if (createIndex >= 0 && nextTabs[createIndex]?.type === 'create') {
        // If the removal index affects the position of the inserted tab, adjust
        const insertedPos = nextTabs.findIndex((t) => t.id === id);
        nextTabs.splice(createIndex, 1);
        // if removal index was before insertedPos, the inserted tab shifted left by 1. Nothing else to do
      }
      return nextTabs;
    });
    setActiveTabSafely(id);
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id || !t.closable);
      return next;
    });
    if (activeTabId === id) {
      const nextTabs = tabs.filter((t) => t.id !== id || !t.closable);
      const home = nextTabs.find((t) => t.type === 'home');
      setActiveTabId(home ? home.id : (nextTabs[0]?.id || 'home'));
    }
  }

  function openLoadedDoc(data: any, filePath?: string) {
    const id = uid();
    // Do not overwrite global meta/editor when opening new tab; keep per-tab state
    const meta: DocMeta = {
      title: data.title || '',
      description: data.description || '',
      goals: data.goals || '',
      hypotheses: data.hypotheses || '',
      plan: data.plan || '',
    };
    setTabs((prev) => {
      const currentId = getCurrentActiveId();
      const insertAfter = prev.findIndex((t) => t.id === currentId);
      const nextTabs = [...prev];
      const newTab: Tab = { id, title: meta.title || 'Документ', closable: true, type: 'doc', data: { meta, contentHtml: data.contentHtml || '<p></p>' }, filePath: filePath || null };
      const insertIndex = Math.min(Math.max(insertAfter + 1, 0), nextTabs.length);
      nextTabs.splice(insertIndex, 0, newTab);
      return nextTabs;
    });
    setActiveTabSafely(id);
  }

  // Drag and drop reordering of tabs
  function onDragStartTab(e: React.DragEvent<HTMLDivElement>, tabId: string) {
    setDraggingTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    const t = tabs.find(x => x.id === tabId);
    if (t && t.type !== 'home') {
      const html = (t.id === activeTabId ? (editor?.getHTML() || t.data?.contentHtml) : t.data?.contentHtml) || '';
      const payload = { title: t.title, filePath: t.filePath || null, data: { meta: t.data?.meta, contentHtml: html }, closeToken: null };
      window.api.startExternalDrag(payload);
    }
  }

  function onDragOverTab(e: React.DragEvent<HTMLDivElement>, targetTabId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const before = e.clientX < rect.left + rect.width / 2;
    setDropTargetId(targetTabId);
    setDropBefore(before);
  }

  function onDropOnTab(e: React.DragEvent<HTMLDivElement>, targetTabId: string) {
    e.preventDefault();
    const sourceId = draggingTabId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetTabId) {
      setDraggingTabId(null);
      setDropTargetId(null);
      return;
    }
    const sourceIndex = tabs.findIndex((t) => t.id === sourceId);
    const targetIndex = tabs.findIndex((t) => t.id === targetTabId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingTabId(null);
      setDropTargetId(null);
      return;
    }
    // Prevent moving home tab if desired
    if (tabs[sourceIndex].type === 'home') {
      setDraggingTabId(null);
      setDropTargetId(null);
      return;
    }
    // Compute before/after based on cursor
    let insertIndex = targetIndex + (dropBefore ? 0 : 1);
    const newOrder = [...tabs];
    const [moved] = newOrder.splice(sourceIndex, 1);
    // If removing earlier changed target position
    if (sourceIndex < insertIndex) insertIndex -= 1;
    // Keep home tab at index 0
    if (moved.type !== 'home' && insertIndex === 0) insertIndex = 1;
    newOrder.splice(insertIndex, 0, moved);
    setTabs(newOrder);
    setDraggingTabId(null);
    setDropTargetId(null);
  }

  function onDragEndTab(_e?: React.DragEvent) {
    setDraggingTabId(null);
    setDropTargetId(null);
    window.api.endExternalDrag();
  }

  // detach by double-click only

  // No global drag-to-detach. Detach is via double-click.

  async function save(asXml = false) {
    if (activeTab?.type !== 'doc') return;
    const currentTab = tabs.find((t) => t.id === activeTab.id);
    const jsonData = {
      title: docMeta.title,
      description: docMeta.description,
      goals: docMeta.goals,
      hypotheses: docMeta.hypotheses,
      plan: docMeta.plan,
      contentHtml: editor?.getHTML() || '',
      version: 1,
    };
    if (currentTab?.filePath) {
      const res = await window.api.saveDocumentToPath({ filePath: currentTab.filePath, jsonData, asXml: false });
      if (!res?.canceled) {
        setTabs((prev) => prev.map((t) => t.id === currentTab.id ? { ...t, filePath: res.filePath } : t));
      }
    } else {
      await saveAs();
    }
  }

  // expose stable refs for menu handlers
  useEffect(() => {
    saveRef.current = async () => {
      const a = activeTabRef.current;
      if (!a || a.type !== 'doc') return;
      const currentTab = tabsRef.current.find((t) => t.id === a.id);
      const e = editorRef.current;
      const meta = docMetaRef.current;
      const jsonData = {
        title: meta.title,
        description: meta.description,
        goals: meta.goals,
        hypotheses: meta.hypotheses,
        plan: meta.plan,
        contentHtml: e?.getHTML() || '',
        version: 1,
      };
      if (currentTab?.filePath) {
        const res = await window.api.saveDocumentToPath({ filePath: currentTab.filePath, jsonData, asXml: false });
        if (!res?.canceled) {
          setTabs((prev) => prev.map((t) => t.id === currentTab.id ? { ...t, filePath: res.filePath } : t));
        }
      } else {
        await saveAsRef.current();
      }
    };
    saveAsRef.current = async () => {
      const a = activeTabRef.current;
      if (!a || a.type !== 'doc') return;
      const e = editorRef.current;
      const meta = docMetaRef.current;
      const jsonData = {
        title: meta.title,
        description: meta.description,
        goals: meta.goals,
        hypotheses: meta.hypotheses,
        plan: meta.plan,
        contentHtml: e?.getHTML() || '',
        version: 1,
      };
      const res = await window.api.saveDocumentAs({ jsonData, asXml: false });
      if (!res?.canceled) {
        const fp = res.filePath as string;
        setTabs((prev) => prev.map((t) => t.id === a.id ? { ...t, filePath: fp, title: meta.title || t.title } : t));
      }
    };
  }, [tabs, activeTabId, editor, docMeta]);

  async function saveAs() {
    if (activeTab?.type !== 'doc') return;
    const jsonData = {
      title: docMeta.title,
      description: docMeta.description,
      goals: docMeta.goals,
      hypotheses: docMeta.hypotheses,
      plan: docMeta.plan,
      contentHtml: editor?.getHTML() || '',
      version: 1,
    };
    const res = await window.api.saveDocumentAs({ jsonData, asXml: false });
    if (!res?.canceled) {
      const fp = res.filePath as string;
      setTabs((prev) => prev.map((t) => t.id === activeTab.id ? { ...t, filePath: fp, title: docMeta.title || t.title } : t));
    }
  }

  // Sync editor and meta when switching tabs
  useEffect(() => {
    const t = tabs.find((x) => x.id === activeTabId);
    if (!t) return;
    if (t.type === 'doc') {
      const meta = t.data?.meta as DocMeta;
      const html = t.data?.contentHtml as string;
      setDocMeta({ ...meta });
      if (editor && typeof html === 'string') {
        editor.commands.setContent(html || '<p></p>');
      }
    }
  }, [activeTabId]);

  // Update active tab's meta when inputs change
  function updateMeta<K extends keyof DocMeta>(key: K, value: DocMeta[K]) {
    setDocMeta((prev) => ({ ...prev, [key]: value }));
    const t = tabs.find((x) => x.id === activeTabId);
    if (t && t.type === 'doc') {
      setTabs((prev) => prev.map((tab) => tab.id === t.id ? { ...tab, title: key === 'title' ? (value as string) || tab.title : tab.title, data: { ...tab.data, meta: { ...tab.data.meta, [key]: value } } } : tab));
    }
  }

  // openFile handled by menu: 'Open…' sends file:opened

  async function exportPdf() {
    await window.api.exportPdf();
  }

  const hasSidebar = activeTab?.type === 'home';
  return (
    <div className={`app-shell ${hasSidebar ? 'with-sidebar' : 'no-sidebar'}`}>
        <div className="tabs" ref={tabsContainerRef} onWheel={(e) => { const target = e.currentTarget as HTMLDivElement; target.scrollLeft += e.deltaY; }}
          onDragOver={(e) => { e.preventDefault(); }}>
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`tab ${activeTabId === t.id ? 'active' : ''} ${t.type !== 'home' ? 'draggable' : ''} ${draggingTabId === t.id ? 'dragging' : ''} ${dropTargetId === t.id ? (dropBefore ? 'drop-before' : 'drop-after') : ''}`}
              onClick={() => setActiveTabSafely(t.id)}
              onDoubleClick={() => {
                // Detach on double-click
                const realTabs = tabs.filter(x => x.type !== 'home');
                if (t.type === 'home' || realTabs.length <= 1) return;
                const current = tabs.find(x => x.id === t.id);
                const html = (t.id === activeTabId ? (editor?.getHTML() || current?.data?.contentHtml) : current?.data?.contentHtml) || '';
                const meta = (current?.data?.meta as DocMeta) || docMeta;
                const data = { meta, contentHtml: html, title: meta.title };
                window.api.detachTab({ title: t.title, data, filePath: t.filePath || null });
                closeTab(t.id);
              }}
            draggable={t.type !== 'home'}
            onDragStart={(e) => onDragStartTab(e, t.id)}
            onDragOver={(e) => onDragOverTab(e, t.id)}
            onDrop={(e) => onDropOnTab(e, t.id)}
              onDragEnd={(e) => onDragEndTab(e)}
          >
            <span className="title">{t.type === 'home' ? <RiMenuLine /> : t.title}</span>
              {t.closable && (
                <button className="close" aria-label="Close tab" title="Close" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}>
                  ✕
                </button>
              )}
          </div>
        ))}
          {/* Drop attach from external window */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const payload = externalDragPayloadRef.current;
              if (payload) {
                window.api.reattachTab(payload);
                externalDragPayloadRef.current = null;
              }
            }}
            style={{ width: 1, height: 1 }}
          />
      </div>
      {hasSidebar && (
        <div className="sidebar">
          <button onClick={() => setSidebarView('users')}>Пользователи</button>
          <button onClick={() => setSidebarView('research')}>Исследования</button>
          <button onClick={() => setSidebarView('recent')}>Недавнее</button>
        </div>
      )}
      <div className="content">
        <div className="view" ref={viewRef}>
          {activeTab?.type === 'home' && (
            <div>
              <h2>Добро пожаловать в Researcher</h2>
              <p className="section-title">Навигация</p>
              <ul>
                <li>Левая панель: Пользователи, Исследования, Недавнее</li>
                <li>Верхняя панель: создание/сохранение/открытие/экспорт</li>
              </ul>
            </div>
          )}

          {activeTab?.type === 'create' && (
            <div className="doc-form">
              <label>Название</label>
              <input value={docMeta.title} onChange={(e) => updateMeta('title', e.target.value)} />
              <label>Описание</label>
              <textarea rows={3} value={docMeta.description} onChange={(e) => updateMeta('description', e.target.value)} />
              <label>Цели</label>
              <textarea rows={3} value={docMeta.goals} onChange={(e) => updateMeta('goals', e.target.value)} />
              <label>Гипотезы</label>
              <textarea rows={3} value={docMeta.hypotheses} onChange={(e) => updateMeta('hypotheses', e.target.value)} />
              <label>Плановый ход работы</label>
              <textarea rows={3} value={docMeta.plan} onChange={(e) => updateMeta('plan', e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createDocument}>Создать</button>
                <button onClick={() => closeTab(activeTabId)}>Отмена</button>
              </div>
            </div>
          )}

          {activeTab?.type === 'doc' && (
            <div>
              <div className={`sticky-tools ${activeTool ? 'has-active' : 'no-active'}`}>
                {activeTool !== null && (
                <div className="tools-panel">
              {/* Global LaTeX editing notification - visible on all tabs */}
              {mathEditingState?.isEditing && (
                <div className="latex-editing-notification">
                  🖊️ Редактирование LaTeX • ESC для выхода
                </div>
              )}

              {activeTool === 'text' && (
                <div className="toolbar text-toolbar">
                  {/* Group: Text style */}
                  <div className="tool-group">
                    {/* Font family dropdown */}
                    <Dropdown
                      label={(() => {
                        const fam = normalizeFontFamilyName(editor?.getAttributes('textStyle').fontFamily as string);
                        const labelMap: Record<string, string> = {
                          'system-ui': 'Системный',
                          'Arial': 'Arial',
                          'Georgia': 'Georgia',
                          'Times New Roman': 'Times New Roman',
                          'Courier New': 'Courier New',
                          'Verdana': 'Verdana',
                        };
                        return labelMap[fam] || fam;
                      })()}
                      icon={null}
                      items={[
                        { key: 'system-ui', label: 'Системный' },
                        { key: 'Arial', label: 'Arial' },
                        { key: 'Georgia', label: 'Georgia' },
                        { key: 'Times New Roman', label: 'Times New Roman' },
                        { key: 'Courier New', label: 'Courier New' },
                        { key: 'Verdana', label: 'Verdana' },
                      ]}
                      selectedKey={normalizeFontFamilyName(editor?.getAttributes('textStyle').fontFamily as string) || 'system-ui'}
                      onSelect={(k) => editor?.chain().focus().setFontFamily(k as string).run()}
                      fixedWidthPx={150}
                    />
                    {/* Font size dropdown */}
                    <Dropdown
                      label={(editor?.getAttributes('textStyle').fontSize || '16px').replace('px','')}
                      icon={null}
                      items={[
                        { key: '12px', label: '12' },
                        { key: '14px', label: '14' },
                        { key: '16px', label: '16' },
                        { key: '18px', label: '18' },
                        { key: '24px', label: '24' },
                        { key: '32px', label: '32' },
                        { key: '48px', label: '48' },
                      ]}
                      selectedKey={editor?.getAttributes('textStyle').fontSize || '16px'}
                      onSelect={(k) => editor?.chain().focus().setMark('textStyle', { fontSize: k as string }).run()}
                      fixedWidthPx={80}
                    />
                    {/* Colors as icon buttons with indicator */}
                    <button
                      className={`tool color-btn ${editor?.getAttributes('textStyle').color ? 'active' : ''}`}
                      aria-label="Цвет текста"
                      title="Цвет текста"
                      onClick={() => textColorInputRef.current?.click()}
                    >
                      <RiFontColor />
                      <span className="color-indicator" style={{ backgroundColor: normalizeHexColor(editor?.getAttributes('textStyle').color, '#000000') }} />
                    </button>
                    <input
                      ref={textColorInputRef}
                      type="color"
                      style={{ display: 'none' }}
                      value={normalizeHexColor(editor?.getAttributes('textStyle').color, '#000000')}
                      onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
                    />
                    <button
                      className={`tool color-btn ${editor?.getAttributes('textStyle').backgroundColor ? 'active' : ''}`}
                      aria-label="Цвет фона текста"
                      title="Цвет фона текста"
                      onClick={() => bgColorInputRef.current?.click()}
                    >
                      <RiPaintFill />
                      <span className="color-indicator" style={{ backgroundColor: normalizeHexColor(editor?.getAttributes('textStyle').backgroundColor, '#ffffff') }} />
                    </button>
                    <input
                      ref={bgColorInputRef}
                      type="color"
                      style={{ display: 'none' }}
                      value={normalizeHexColor(editor?.getAttributes('textStyle').backgroundColor, '#ffffff')}
                      onChange={(e) => editor?.chain().focus().setBackgroundColor(e.target.value).run()}
                    />
                  </div>
                  <div className="tool-sep" aria-hidden="true" />
                  {/* Group: Alignment */}
                  <div className="tool-group">
                    <button className={`tool ${(() => {
                      const left = editor?.isActive({ textAlign: 'left' });
                      const none = !editor?.isActive({ textAlign: 'center' }) && !editor?.isActive({ textAlign: 'right' }) && !editor?.isActive({ textAlign: 'justify' });
                      return left || none ? 'active' : '';
                    })()}`} onClick={() => editor?.chain().focus().setTextAlign('left').run()} title="По левому"><RiAlignLeft /></button>
                    <button className={`tool ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().setTextAlign('center').run()} title="По центру"><RiAlignCenter /></button>
                    <button className={`tool ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().setTextAlign('right').run()} title="По правому"><RiAlignRight /></button>
                    <button className={`tool ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} title="По ширине"><RiAlignJustify /></button>
                  </div>
                  <div className="tool-sep" aria-hidden="true" />
                  {/* Group: Text formatting */}
                  <div className="tool-group">
                    <button className={`tool ${editor?.isActive('bold') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleBold().run()} title="Полужирный"><RiBold /></button>
                    <button className={`tool ${editor?.isActive('italic') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Курсив"><RiItalic /></button>
                    <button className={`tool ${editor?.isActive('underline') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Подчёркнутый"><RiUnderline /></button>
                    <button className={`tool ${editor?.isActive('strike') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleStrike().run()} title="Зачёркнутый"><RiStrikethrough /></button>
                    <button className={`tool ${editor?.isActive('highlight') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleHighlight().run()} title="Подсветка"><RiMarkPenLine /></button>
                    <button className={`tool ${editor?.isActive('code') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleCode().run()} title="Код (встроенный)"><RiCodeLine /></button>
                  </div>
                  <div className="tool-sep" aria-hidden="true" />
                  {/* Group: Paragraph controls */}
                  <div className="tool-group">
                    {/* Heading dropdown with icon placeholder and more levels */}
                    <Dropdown
                      label=""
                      icon={(() => {
                        if (editor?.isActive('heading', { level: 1 })) return <RiH1 />;
                        if (editor?.isActive('heading', { level: 2 })) return <RiH2 />;
                        if (editor?.isActive('heading', { level: 3 })) return <RiH3 />;
                        if (editor?.isActive('heading', { level: 4 })) return <RiH4 />;
                        if (editor?.isActive('heading', { level: 5 })) return <RiH5 />;
                        if (editor?.isActive('heading', { level: 6 })) return <RiH6 />;
                        return <RiParagraph />;
                      })()}
                      items={[
                        { key: 'h1', label: 'Заголовок 1', icon: <RiH1 /> },
                        { key: 'h2', label: 'Заголовок 2', icon: <RiH2 /> },
                        { key: 'h3', label: 'Заголовок 3', icon: <RiH3 /> },
                        { key: 'h4', label: 'Заголовок 4', icon: <RiH4 /> },
                        { key: 'h5', label: 'Заголовок 5', icon: <RiH5 /> },
                        { key: 'h6', label: 'Заголовок 6', icon: <RiH6 /> },
                      ]}
                      selectedKey={(() => {
                        for (let lvl = 1; lvl <= 6; lvl++) {
                          if (editor?.isActive('heading', { level: lvl })) return `h${lvl}`;
                        }
                        return '';
                      })()}
                      onSelect={(k) => {
                        const chain = editor?.chain().focus();
                        if (!chain) return;
                        const level = (k === 'h1' ? 1 : k === 'h2' ? 2 : k === 'h3' ? 3 : k === 'h4' ? 4 : k === 'h5' ? 5 : 6) as 1|2|3|4|5|6;
                        if (editor?.isActive('heading', { level })) chain.setParagraph().run();
                        else chain.setHeading({ level }).run();
                      }}
                      active={(() => { for (let lvl = 1; lvl <= 6; lvl++) { if (editor?.isActive('heading', { level: lvl })) return true; } return false; })()}
                    />

                    {/* List type dropdown */}
                    <Dropdown
                      label=""
                      icon={editor?.isActive('orderedList') ? <RiListOrdered /> : editor?.isActive('bulletList') ? <RiListUnordered /> : <RiListUnordered />}
                      items={[
                        { key: 'bullet', label: 'Маркированный', icon: <RiListUnordered /> },
                        { key: 'ordered', label: 'Нумерованный', icon: <RiListOrdered /> },
                      ]}
                      selectedKey={editor?.isActive('orderedList') ? 'ordered' : editor?.isActive('bulletList') ? 'bullet' : ''}
                      onSelect={(k) => {
                        const c = editor?.chain().focus();
                        if (!c) return;
                        if (k === 'bullet') c.toggleBulletList().run();
                        if (k === 'ordered') c.toggleOrderedList().run();
                      }}
                      active={editor?.isActive('orderedList') || editor?.isActive('bulletList')}
                    />
                    {/* Code block */}
                    <button className={`tool ${editor?.isActive('codeBlock') ? 'active' : ''}`} title="Блок кода" onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><RiCodeBoxLine /></button>
                    {/* Image (kept here) */}
                    <button className="tool" title="Вставить изображение" onClick={async () => { const r = await window.api.pickImage(); if (!r?.canceled && (r as any).dataUrl) editor?.chain().focus().setImage({ src: (r as any).dataUrl }).run(); }}><RiImageLine /></button>
                  </div>
                  <div className="tool-sep" aria-hidden="true" />
                  {/* Group: Sub/Superscript */}
                  <div className="tool-group">
                    <button className={`tool ${editor?.isActive('subscript') ? 'active' : ''}`} onClick={() => (editor as any)?.chain().focus().toggleSubscript().run()} title="Нижний индекс"><RiSubscript /></button>
                    <button className={`tool ${editor?.isActive('superscript') ? 'active' : ''}`} onClick={() => (editor as any)?.chain().focus().toggleSuperscript().run()} title="Верхний индекс"><RiSuperscript /></button>
                  </div>
                </div>
              )}

              {activeTool === 'tables' && (
                <div className="toolbar text-toolbar">
                  {/* Group: Create/insert table */}
                  <div className="tool-group">
                    <Dropdown
                      label="Вставить"
                      icon={<RiTableLine />}
                      items={[
                        { key: '2x2', label: '2 × 2' },
                        { key: '3x3h', label: '3 × 3 (шапка)' },
                        { key: '3x3', label: '3 × 3' },
                        { key: '4x4h', label: '4 × 4 (шапка)' },
                        { key: '4x4', label: '4 × 4' },
                      ]}
                      onSelect={(k) => {
                        const withHeaderRow = k.endsWith('h');
                        const size = k.replace('h','');
                        const [colsStr, rowsStr] = size.split('x');
                        const cols = parseInt(colsStr, 10);
                        const rows = parseInt(rowsStr, 10);
                        try {
                          editor?.chain().focus().insertTable({ rows, cols, withHeaderRow }).run();
                        } catch (error) {
                          console.error('Error inserting table:', error);
                        }
                      }}
                    />
                  </div>
                  <div className="tool-sep" aria-hidden="true" />

                  {/* Group: Add rows/cols */}
                  <div className="tool-group">
                    <button className="tool" title="Строка выше" onClick={() => {
                      try { editor?.chain().focus().addRowBefore().run(); } catch (e) { console.warn('addRowBefore not available'); }
                    }}><RiArrowUpLine /></button>
                    <button className="tool" title="Строка ниже" onClick={() => {
                      try { editor?.chain().focus().addRowAfter().run(); } catch (e) { console.warn('addRowAfter not available'); }
                    }}><RiArrowDownLine /></button>
                    <button className="tool" title="Колонка слева" onClick={() => {
                      try { editor?.chain().focus().addColumnBefore().run(); } catch (e) { console.warn('addColumnBefore not available'); }
                    }}><RiArrowLeftLine /></button>
                    <button className="tool" title="Колонка справа" onClick={() => {
                      try { editor?.chain().focus().addColumnAfter().run(); } catch (e) { console.warn('addColumnAfter not available'); }
                    }}><RiArrowRightLine /></button>
                  </div>
                  <div className="tool-sep" aria-hidden="true" />

                  {/* Group: Row/Cell formatting */}
                  <div className="tool-group">
                    <button className="tool"
                      title="Объединить ячейки"
                      onClick={() => {
                        try {
                          editor?.chain().focus().mergeCells().run();
                        } catch (e) {
                          console.warn('mergeCells command not available');
                        }
                      }}>Склеить</button>
                    <button className="tool"
                      title="Разделить ячейку"
                      onClick={() => {
                        try {
                          editor?.chain().focus().splitCell().run();
                        } catch (e) {
                          console.warn('splitCell command not available');
                        }
                      }}>Разделить</button>
                    <button className="tool" title="Строка шапки" onClick={() => {
                      try { editor?.chain().focus().toggleHeaderRow().run(); } catch (e) { console.warn('toggleHeaderRow not available'); }
                    }}>Шапка строки</button>
                    <button className="tool" title="Колонки шапки" onClick={() => {
                      try { editor?.chain().focus().toggleHeaderColumn().run(); } catch (e) { console.warn('toggleHeaderColumn not available'); }
                    }}>Шапка колонки</button>
                    <button className="tool" title="Ячейка шапка" onClick={() => {
                      try { editor?.chain().focus().toggleHeaderCell().run(); } catch (e) { console.warn('toggleHeaderCell not available'); }
                    }}>Яч. шапка</button>
                  </div>
                  <div className="tool-sep" aria-hidden="true" />

                  {/* Group: Delete rows/cols */}
                  <div className="tool-group">
                    <button className="tool" title="Удалить строку" onClick={() => {
                      try { editor?.chain().focus().deleteRow().run(); } catch (e) { console.warn('deleteRow not available'); }
                    }}><RiDeleteBack2Line /></button>
                    <button className="tool" title="Удалить колонку" onClick={() => {
                      try { editor?.chain().focus().deleteColumn().run(); } catch (e) { console.warn('deleteColumn not available'); }
                    }}><RiDeleteBin2Line /></button>
                  </div>
                  <div className="tool-sep" aria-hidden="true" />

                  {/* Row height presets removed */}

                  {/* Group: Collapse/Hide - always visible */}
                  <div className="tool-group">
                    {(() => {
                      // Check if we're in a table and get its state
                      let collapsed = false;
                      let isInTable = false;
                      
                      if (editor?.isActive('table')) {
                        const attrs: any = editor.getAttributes('table') || {};
                        collapsed = Boolean(attrs.collapsed);
                        isInTable = true;
                      }
                      
                      const toggle = () => {
                        try {
                          if (editor && (editor as any).commands?.toggleTableCollapsed) {
                            (editor as any).chain().focus().toggleTableCollapsed().run();
                          } else {
                            console.warn('toggleTableCollapsed command not available');
                          }
                        } catch (e) {
                          console.warn('Table collapse toggle failed:', e);
                        }
                      };
                      
                      // Show button state based on current table or disabled if not in table
                      if (isInTable) {
                        return collapsed ? (
                          <button className="tool" title="Показать таблицу" onClick={toggle}><RiEyeLine /> Показать</button>
                        ) : (
                          <button className="tool" title="Скрыть таблицу" onClick={toggle}><RiEyeOffLine /> Скрыть</button>
                        );
                      } else {
                        return (
                          <button className="tool disabled" title="Поместите курсор в таблицу" disabled><RiEyeOffLine /> Скрыть</button>
                        );
                      }
                    })()}
                  </div>
                  <div className="tool-sep" aria-hidden="true" />

                  {/* Group: Delete table */}
                  <div className="tool-group">
                    <button className="tool" title="Удалить таблицу" onClick={() => {
                      try { editor?.chain().focus().deleteTable().run(); } catch (e) { console.warn('deleteTable not available'); }
                    }}><RiDeleteBinLine /></button>
                  </div>
                </div>
              )}

              {activeTool === 'formulas' && (
                <div className="toolbar formula-wrapper">
                  <FormulaBar editor={editor} mathEditingState={mathEditingState} />
                </div>
              )}

              {activeTool === 'graphs' && (
                <div className="toolbar graphs-wrapper">
                  <GraphsBar editor={editor} selectedGraph={selectedGraph} setSelectedGraph={setSelectedGraph} />
                </div>
              )}
                </div>
                )}
                <div className="tool-tabs">
                  <button className={`tool-tab ${activeTool === 'text' ? 'active' : ''}`} onClick={() => setActiveTool(prev => prev === 'text' ? null : 'text')}>Text</button>
                  <button className={`tool-tab ${activeTool === 'tables' ? 'active' : ''}`} onClick={() => setActiveTool(prev => prev === 'tables' ? null : 'tables')}>Tables</button>
                  <button className={`tool-tab ${activeTool === 'formulas' ? 'active' : ''}`} onClick={() => setActiveTool(prev => prev === 'formulas' ? null : 'formulas')}>Formulas</button>
                  <button className={`tool-tab ${activeTool === 'graphs' ? 'active' : ''}`} onClick={() => setActiveTool(prev => prev === 'graphs' ? null : 'graphs')}>Graphs</button>
                </div>
              </div>
              <DragHandleReact editor={editor}>
                <div className="tiptap-drag-handle" />
              </DragHandleReact>
              <EditorContent editor={editor} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FormulaBar: React.FC<{ 
  editor: any; 
  mathEditingState: { isEditing: boolean; originalPosition: number; mathType: 'inline' | 'block'; originalLatex: string; } | null;
}> = ({ editor, mathEditingState }) => {
  
  // Symbols (brackets, braces, arrows, etc.)
  const symbols = [
    // Brackets and braces
    { key: 'lparen', label: '(', code: '(' },
    { key: 'rparen', label: ')', code: ')' },
    { key: 'lbracket', label: '[', code: '[' },
    { key: 'rbracket', label: ']', code: ']' },
    { key: 'lbrace', label: '{', code: '\\{' },
    { key: 'rbrace', label: '}', code: '\\}' },
    { key: 'langle', label: '⟨', code: '\\langle' },
    { key: 'rangle', label: '⟩', code: '\\rangle' },
    { key: 'lceil', label: '⌈', code: '\\lceil' },
    { key: 'rceil', label: '⌉', code: '\\rceil' },
    { key: 'lfloor', label: '⌊', code: '\\lfloor' },
    { key: 'rfloor', label: '⌋', code: '\\rfloor' },
    // Large brackets
    { key: 'bigl', label: '\\big(', code: '\\bigl(' },
    { key: 'bigr', label: '\\big)', code: '\\bigr)' },
    { key: 'Bigl', label: '\\Big[', code: '\\Bigl[' },
    { key: 'Bigr', label: '\\Big]', code: '\\Bigr]' },
    { key: 'biggl', label: '\\bigg{', code: '\\biggl\\{' },
    { key: 'biggr', label: '\\bigg}', code: '\\biggr\\}' },
    // Arrows
    { key: 'leftarrow', label: '←', code: '\\leftarrow' },
    { key: 'rightarrow', label: '→', code: '\\rightarrow' },
    { key: 'leftrightarrow', label: '↔', code: '\\leftrightarrow' },
    { key: 'uparrow', label: '↑', code: '\\uparrow' },
    { key: 'downarrow', label: '↓', code: '\\downarrow' },
    { key: 'Leftarrow', label: '⇐', code: '\\Leftarrow' },
    { key: 'Rightarrow', label: '⇒', code: '\\Rightarrow' },
    { key: 'Leftrightarrow', label: '⇔', code: '\\Leftrightarrow' },
    // Special symbols
    { key: 'infty', label: '∞', code: '\\infty' },
    { key: 'partial', label: '∂', code: '\\partial' },
    { key: 'nabla', label: '∇', code: '\\nabla' },
    { key: 'angle', label: '∠', code: '\\angle' },
    { key: 'triangle', label: '△', code: '\\triangle' },
    { key: 'square', label: '□', code: '\\square' },
    { key: 'diamond', label: '◊', code: '\\diamond' },
    { key: 'star', label: '⋆', code: '\\star' },
    { key: 'dagger', label: '†', code: '\\dagger' },
    { key: 'ddagger', label: '‡', code: '\\ddagger' },
    { key: 'sharp', label: '♯', code: '\\sharp' },
    { key: 'flat', label: '♭', code: '\\flat' },
    { key: 'natural', label: '♮', code: '\\natural' },
    { key: 'clubsuit', label: '♣', code: '\\clubsuit' },
    { key: 'diamondsuit', label: '♢', code: '\\diamondsuit' },
    { key: 'heartsuit', label: '♡', code: '\\heartsuit' },
    { key: 'spadesuit', label: '♠', code: '\\spadesuit' },
  ];
  
  // Greek letters
  const greekLetters = [
    { key: 'alpha', label: 'α', code: '\\alpha' },
    { key: 'beta', label: 'β', code: '\\beta' },
    { key: 'gamma', label: 'γ', code: '\\gamma' },
    { key: 'delta', label: 'δ', code: '\\delta' },
    { key: 'epsilon', label: 'ε', code: '\\epsilon' },
    { key: 'zeta', label: 'ζ', code: '\\zeta' },
    { key: 'eta', label: 'η', code: '\\eta' },
    { key: 'theta', label: 'θ', code: '\\theta' },
    { key: 'iota', label: 'ι', code: '\\iota' },
    { key: 'kappa', label: 'κ', code: '\\kappa' },
    { key: 'lambda', label: 'λ', code: '\\lambda' },
    { key: 'mu', label: 'μ', code: '\\mu' },
    { key: 'nu', label: 'ν', code: '\\nu' },
    { key: 'xi', label: 'ξ', code: '\\xi' },
    { key: 'omicron', label: 'ο', code: '\\omicron' },
    { key: 'pi', label: 'π', code: '\\pi' },
    { key: 'rho', label: 'ρ', code: '\\rho' },
    { key: 'sigma', label: 'σ', code: '\\sigma' },
    { key: 'tau', label: 'τ', code: '\\tau' },
    { key: 'upsilon', label: 'υ', code: '\\upsilon' },
    { key: 'phi', label: 'φ', code: '\\phi' },
    { key: 'chi', label: 'χ', code: '\\chi' },
    { key: 'psi', label: 'ψ', code: '\\psi' },
    { key: 'omega', label: 'ω', code: '\\omega' },
    // Capital Greek letters
    { key: 'Alpha', label: 'Α', code: '\\Alpha' },
    { key: 'Beta', label: 'Β', code: '\\Beta' },
    { key: 'Gamma', label: 'Γ', code: '\\Gamma' },
    { key: 'Delta', label: 'Δ', code: '\\Delta' },
    { key: 'Epsilon', label: 'Ε', code: '\\Epsilon' },
    { key: 'Zeta', label: 'Ζ', code: '\\Zeta' },
    { key: 'Eta', label: 'Η', code: '\\Eta' },
    { key: 'Theta', label: 'Θ', code: '\\Theta' },
    { key: 'Iota', label: 'Ι', code: '\\Iota' },
    { key: 'Kappa', label: 'Κ', code: '\\Kappa' },
    { key: 'Lambda', label: 'Λ', code: '\\Lambda' },
    { key: 'Mu', label: 'Μ', code: '\\Mu' },
    { key: 'Nu', label: 'Ν', code: '\\Nu' },
    { key: 'Xi', label: 'Ξ', code: '\\Xi' },
    { key: 'Omicron', label: 'Ο', code: '\\Omicron' },
    { key: 'Pi', label: 'Π', code: '\\Pi' },
    { key: 'Rho', label: 'Ρ', code: '\\Rho' },
    { key: 'Sigma', label: 'Σ', code: '\\Sigma' },
    { key: 'Tau', label: 'Τ', code: '\\Tau' },
    { key: 'Upsilon', label: 'Υ', code: '\\Upsilon' },
    { key: 'Phi', label: 'Φ', code: '\\Phi' },
    { key: 'Chi', label: 'Χ', code: '\\Chi' },
    { key: 'Psi', label: 'Ψ', code: '\\Psi' },
    { key: 'Omega', label: 'Ω', code: '\\Omega' },
  ];

  // Mathematical operators
  const operators = [
    { key: 'plus', label: '+', code: '+' },
    { key: 'minus', label: '−', code: '-' },
    { key: 'times', label: '×', code: '\\times' },
    { key: 'div', label: '÷', code: '\\div' },
    { key: 'pm', label: '±', code: '\\pm' },
    { key: 'mp', label: '∓', code: '\\mp' },
    { key: 'cdot', label: '·', code: '\\cdot' },
    { key: 'bullet', label: '∙', code: '\\bullet' },
    { key: 'ast', label: '∗', code: '\\ast' },
    { key: 'star', label: '⋆', code: '\\star' },
    { key: 'circ', label: '∘', code: '\\circ' },
    { key: 'oplus', label: '⊕', code: '\\oplus' },
    { key: 'ominus', label: '⊖', code: '\\ominus' },
    { key: 'otimes', label: '⊗', code: '\\otimes' },
    { key: 'oslash', label: '⊘', code: '\\oslash' },
    { key: 'odot', label: '⊙', code: '\\odot' },
  ];

  // Relations
  const relations = [
    { key: 'eq', label: '=', code: '=' },
    { key: 'neq', label: '≠', code: '\\neq' },
    { key: 'lt', label: '<', code: '<' },
    { key: 'gt', label: '>', code: '>' },
    { key: 'leq', label: '≤', code: '\\leq' },
    { key: 'geq', label: '≥', code: '\\geq' },
    { key: 'equiv', label: '≡', code: '\\equiv' },
    { key: 'approx', label: '≈', code: '\\approx' },
    { key: 'sim', label: '∼', code: '\\sim' },
    { key: 'propto', label: '∝', code: '\\propto' },
    { key: 'parallel', label: '∥', code: '\\parallel' },
    { key: 'perp', label: '⊥', code: '\\perp' },
    { key: 'in', label: '∈', code: '\\in' },
    { key: 'notin', label: '∉', code: '\\notin' },
    { key: 'subset', label: '⊂', code: '\\subset' },
    { key: 'supset', label: '⊃', code: '\\supset' },
    { key: 'subseteq', label: '⊆', code: '\\subseteq' },
    { key: 'supseteq', label: '⊇', code: '\\supseteq' },
  ];

  // Arrows
  const arrows = [
    { key: 'leftarrow', label: '←', code: '\\leftarrow' },
    { key: 'rightarrow', label: '→', code: '\\rightarrow' },
    { key: 'leftrightarrow', label: '↔', code: '\\leftrightarrow' },
    { key: 'Leftarrow', label: '⇐', code: '\\Leftarrow' },
    { key: 'Rightarrow', label: '⇒', code: '\\Rightarrow' },
    { key: 'Leftrightarrow', label: '⇔', code: '\\Leftrightarrow' },
    { key: 'uparrow', label: '↑', code: '\\uparrow' },
    { key: 'downarrow', label: '↓', code: '\\downarrow' },
    { key: 'updownarrow', label: '↕', code: '\\updownarrow' },
    { key: 'Uparrow', label: '⇑', code: '\\Uparrow' },
    { key: 'Downarrow', label: '⇓', code: '\\Downarrow' },
    { key: 'Updownarrow', label: '⇕', code: '\\Updownarrow' },
  ];

  // Functions and symbols
  const functions = [
    // Basic trigonometric functions
    { key: 'sin', label: 'sin', code: '\\sin' },
    { key: 'cos', label: 'cos', code: '\\cos' },
    { key: 'tan', label: 'tan', code: '\\tan' },
    { key: 'cot', label: 'cot', code: '\\cot' },
    { key: 'arcsin', label: 'arcsin', code: '\\arcsin' },
    { key: 'arccos', label: 'arccos', code: '\\arccos' },
    { key: 'arctan', label: 'arctan', code: '\\arctan' },
    { key: 'sinh', label: 'sinh', code: '\\sinh' },
    { key: 'cosh', label: 'cosh', code: '\\cosh' },
    { key: 'tanh', label: 'tanh', code: '\\tanh' },
    // Logarithmic functions
    { key: 'log', label: 'log', code: '\\log' },
    { key: 'ln', label: 'ln', code: '\\ln' },
    { key: 'exp', label: 'exp', code: '\\exp' },
    // Limits and calculus
    { key: 'lim', label: 'lim', code: '\\lim_{x \\to }' },
    { key: 'sup', label: 'sup', code: '\\sup' },
    { key: 'inf', label: 'inf', code: '\\inf' },
    { key: 'max', label: 'max', code: '\\max' },
    { key: 'min', label: 'min', code: '\\min' },
    // Roots and fractions
    { key: 'sqrt', label: '√', code: '\\sqrt{}' },
    { key: 'sqrt3', label: '∛', code: '\\sqrt[3]{}' },
    { key: 'frac', label: 'a/b', code: '\\frac{}{}' },
    { key: 'dfrac', label: 'A/B', code: '\\dfrac{}{}' },
    { key: 'tfrac', label: 'a/b', code: '\\tfrac{}{}' },
    // Sums and products
    { key: 'sum', label: '∑', code: '\\sum_{}^{}' },
    { key: 'prod', label: '∏', code: '\\prod_{}^{}' },
    // Integrals
    { key: 'int', label: '∫', code: '\\int_{}^{}' },
    { key: 'iint', label: '∬', code: '\\iint' },
    { key: 'oint', label: '∮', code: '\\oint' },
    // Other functions
    { key: 'det', label: 'det', code: '\\det' },
    { key: 'gcd', label: 'gcd', code: '\\gcd' },
  ];

  function insertInlineFormula(formula: string) {
    if (!editor || !formula.trim()) return;
    
    if (mathEditingState?.isEditing) {
      // We're in editing mode - insert directly into the active input
      insertIntoActiveInput(formula);
    } else {
      // Normal mode - create new math node
      const hasSelection = !editor.state.selection.empty;
      if (hasSelection) {
        editor.chain().setInlineMath().focus().run();
      } else {
        editor.chain().insertInlineMath({ latex: formula }).focus().run();
      }
    }
  }

  function insertBlockFormula(formula: string) {
    if (!editor || !formula.trim()) return;
    
    if (mathEditingState?.isEditing) {
      // We're in editing mode - insert directly into the active input
      insertIntoActiveInput(formula);
    } else {
      // Normal mode - create new math node
      const hasSelection = !editor.state.selection.empty;
      if (hasSelection) {
        editor.chain().setBlockMath().focus().run();
      } else {
        editor.chain().insertBlockMath({ latex: formula }).focus().run();
      }
    }
  }

  function insertSymbol(code: string) {
    if (!editor) return;
    
    if (mathEditingState?.isEditing) {
      // We're in editing mode - insert directly into the active input
      insertIntoActiveInput(code);
    } else {
      // Normal mode - create new inline math with the symbol
      editor.chain().insertInlineMath({ latex: code }).focus().run();
    }
  }

  // Helper function to insert text into the active math editing input
  function insertIntoActiveInput(text: string) {
    const activeInput = document.querySelector('.math-editing-node input') as HTMLInputElement;
    if (activeInput) {
      const startPos = activeInput.selectionStart || 0;
      const endPos = activeInput.selectionEnd || 0;
      const currentValue = activeInput.value;
      
      // Insert the text at the current cursor position
      const newValue = currentValue.slice(0, startPos) + text + currentValue.slice(endPos);
      activeInput.value = newValue;
      
      // Set cursor position after the inserted text
      const newCursorPos = startPos + text.length;
      activeInput.setSelectionRange(newCursorPos, newCursorPos);
      
      // Trigger change event and keep focus
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
      activeInput.dispatchEvent(new Event('change', { bubbles: true }));
      activeInput.focus();
    }
  }

  // Helper function to check if we're in LaTeX editing mode
  function isInLatexEditingMode() {
    return mathEditingState?.isEditing || false;
  }

  function deleteSelectedFormula() {
    if (!editor) return;
    
    // Check if we're in an inline math node
    if (editor.isActive('inline-math')) {
      editor.chain().deleteInlineMath().focus().run();
    }
    // Check if we're in a block math node
    else if (editor.isActive('block-math')) {
      editor.chain().deleteBlockMath().focus().run();
    }
    // Fallback to general deletion
    else {
      editor.commands.deleteSelection();
    }
  }

  const editingMode = isInLatexEditingMode();

  return (
    <div className="formula-toolbar">
      
      {/* Group 1: Quick formulas */}
      <div className="tool-group">
        <button 
          className="tool" 
          onClick={() => insertInlineFormula('E=mc^2')}
          onMouseDown={(e) => mathEditingState?.isEditing && e.preventDefault()}
          title="Вставить простую встроенную формулу. Для редактирования нажмите на формулу, для выхода - ESC"
        >
          Встроенная
        </button>
        <button 
          className="tool" 
          onClick={() => insertBlockFormula('\\frac{a}{b} = \\frac{c}{d}')}
          onMouseDown={(e) => mathEditingState?.isEditing && e.preventDefault()}
          title="Вставить простую блочную формулу. Для редактирования нажмите на формулу, для выхода - ESC"
        >
          Блочная
        </button>
      </div>
      <div className="tool-sep" aria-hidden="true" />

      {/* Group 2: Symbol categories (all except Functions) */}
      <div className="tool-group">
        <GridDropdown
          label="Символы"
          icon={null}
          items={symbols.map(symbol => ({
            key: symbol.key,
            label: `${symbol.label} (${symbol.code})`,
            icon: <span className="grid-dropdown-symbol">{symbol.label}</span>
          }))}
          onSelect={(key) => {
            const symbol = symbols.find(s => s.key === key);
            if (symbol) insertSymbol(symbol.code);
          }}
          columns={6}
          mathEditingState={mathEditingState}
        />
        <GridDropdown
          label="Греческие"
          icon={null}
          items={greekLetters.map(letter => ({
            key: letter.key,
            label: `${letter.label} (${letter.code})`,
            icon: <span style={{ fontFamily: 'serif', fontSize: '18px' }}>{letter.label}</span>
          }))}
          onSelect={(key) => {
            const symbol = greekLetters.find(s => s.key === key);
            if (symbol) insertSymbol(symbol.code);
          }}
          columns={6}
          mathEditingState={mathEditingState}
        />
        <GridDropdown
          label="Операторы"
          icon={null}
          items={operators.map(op => ({
            key: op.key,
            label: `${op.label} (${op.code})`,
            icon: <span style={{ fontFamily: 'serif', fontSize: '18px' }}>{op.label}</span>
          }))}
          onSelect={(key) => {
            const operator = operators.find(op => op.key === key);
            if (operator) insertSymbol(operator.code);
          }}
          columns={5}
          mathEditingState={mathEditingState}
        />
        <GridDropdown
          label="Отношения"
          icon={null}
          items={relations.map(rel => ({
            key: rel.key,
            label: `${rel.label} (${rel.code})`,
            icon: <span style={{ fontFamily: 'serif', fontSize: '18px' }}>{rel.label}</span>
          }))}
          onSelect={(key) => {
            const relation = relations.find(rel => rel.key === key);
            if (relation) insertSymbol(relation.code);
          }}
          columns={5}
          mathEditingState={mathEditingState}
        />
      </div>
      <div className="tool-sep" aria-hidden="true" />

      {/* Group 3: Functions */}
      <div className="tool-group">
        <GridDropdown
          label="Функции"
          icon={null}
          items={functions.map(func => ({
            key: func.key,
            label: `${func.label} (${func.code})`,
            icon: <span style={{ fontFamily: 'serif', fontSize: '18px' }}>{func.label}</span>
          }))}
          onSelect={(key) => {
            const func = functions.find(f => f.key === key);
            if (func) {
              insertSymbol(func.code);
            }
          }}
          columns={5}
          mathEditingState={mathEditingState}
        />
      </div>
    </div>
  );
};

const GraphsBar: React.FC<{ editor: any; selectedGraph: any; setSelectedGraph: (graph: any) => void }> = ({ editor, selectedGraph, setSelectedGraph }) => {

  function createGraph(graphType: string) {
    if (!editor || !(editor as any).commands?.insertGraph) {
      console.warn('Команда insertGraph недоступна');
      return;
    }

    // Generate unique ID
    const currentTime = Date.now();
    const randomNumber = Math.floor(Math.random() * 1000000);
    const uniqueGraphId = 'graph-' + currentTime.toString() + '-' + randomNumber.toString();
    
    // Define different graph templates
    const graphTemplates: Record<string, { data: any[], title: string }> = {
      'line': {
        data: [{
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 3, 5, 6],
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Линейный график'
        }],
        title: 'Линейный график'
      },
      'bar': {
        data: [{
          x: ['A', 'B', 'C', 'D', 'E'],
          y: [20, 14, 23, 25, 22],
          type: 'bar',
          name: 'Столбчатая диаграмма'
        }],
        title: 'Столбчатая диаграмма'
      },
      'scatter': {
        data: [{
          x: [1, 2, 3, 4, 5, 6, 7, 8],
          y: [2, 4, 3, 5, 6, 8, 7, 9],
          mode: 'markers',
          type: 'scatter',
          name: 'Точечная диаграмма'
        }],
        title: 'Точечная диаграмма'
      },
      'pie': {
        data: [{
          values: [19, 26, 55],
          labels: ['Жилой', 'Нежилой', 'Коммунальный'],
          type: 'pie',
          name: 'Круговая диаграмма'
        }],
        title: 'Круговая диаграмма'
      },
      'histogram': {
        data: [{
          x: [1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5],
          type: 'histogram',
          name: 'Гистограмма'
        }],
        title: 'Гистограмма'
      }
    }

    const selectedTemplate = graphTemplates[graphType];
    const template = selectedTemplate || graphTemplates.line;
    
    (editor as any).commands.insertGraph({
      id: uniqueGraphId,
      graphData: template.data,
      graphLayout: {
        title: {
          text: template.title,
          font: {
            size: 16,
            color: '#000000'
          }
        },
        width: 500,
        height: 350,
        xaxis: { 
          title: {
            text: 'Ось X',
            font: {
              size: 14,
              color: '#000000'
            }
          }
        },
        yaxis: { 
          title: {
            text: 'Ось Y',
            font: {
              size: 14,
              color: '#000000'
            }
          }
        },
        margin: {
          l: 60,
          r: 30,
          t: 60,
          b: 60
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white'
      }
    });
  }

  function editSelectedGraph() {
    if (selectedGraph && selectedGraph.handleEdit) {
      selectedGraph.handleEdit()
    }
  }

  function deleteSelectedGraph() {
    if (selectedGraph && selectedGraph.deleteNode) {
      // Store editor reference before deletion
      const editorElement = editor?.view?.dom
      
      selectedGraph.deleteNode()
      setSelectedGraph(null)
      
      // Restore focus to editor after deletion to prevent cursor disappearing
      setTimeout(() => {
        if (editor && editor.view) {
          // Get current selection position
          const { state } = editor.view
          const currentPos = state.selection.from
          
          // Restore focus with proper text selection
          editor.chain()
            .focus()
            .setTextSelection(currentPos)
            .run()
          
          // Additional steps to ensure cursor visibility
          setTimeout(() => {
            if (editor.view && editor.view.dom) {
              editor.view.dom.focus()
              // Force cursor to be visible by dispatching a selection update
              const { state, dispatch } = editor.view
              const tr = state.tr.setSelection(state.selection)
              dispatch(tr)
            }
          }, 50)
        }
      }, 150)
    }
  }

  function exportSelectedGraph() {
    if (selectedGraph) {
      // Find the Plotly graph element and export it
      const graphElement = document.querySelector(`[data-graph-id="${selectedGraph.graphId}"] .js-plotly-plot`)
      if (graphElement && (window as any).Plotly) {
        (window as any).Plotly.toImage(graphElement, {
          format: 'png',
          width: 800,
          height: 600
        }).then((dataUrl: string) => {
          // Create download link
          const link = document.createElement('a')
          link.download = `graph-${selectedGraph.graphId}.png`
          link.href = dataUrl
          link.click()
        }).catch((err: any) => {
          console.error('Не удалось экспортировать график:', err)
          alert('Не удалось экспортировать график. Убедитесь, что график полностью загружен.')
        })
      } else {
        alert('График не выбран или Plotly недоступен')
      }
    }
  }

  return (
    <>
      {/* Group: Create graphs */}
      <div className="tool-group">
        <Dropdown
          label="Создать"
          icon={<RiAddLine />}
          items={[
            { key: 'line', label: 'Линейный график', icon: <span>📈</span> },
            { key: 'bar', label: 'Столбчатая диаграмма', icon: <span>📊</span> },
            { key: 'scatter', label: 'Точечная диаграмма', icon: <span>⚫</span> },
            { key: 'pie', label: 'Круговая диаграмма', icon: <span>🥧</span> },
            { key: 'histogram', label: 'Гистограмма', icon: <span>📶</span> },
          ]}
          onSelect={(key) => createGraph(key)}
          fixedWidthPx={130}
        />
      </div>
      <div className="tool-sep" aria-hidden="true" />
      
      {/* Group: Graph operations */}
      <div className="tool-group">
        <button 
          className={`tool ${selectedGraph ? '' : 'disabled'}`}
          onClick={editSelectedGraph}
          disabled={!selectedGraph}
          title={selectedGraph ? "Редактировать выбранный график" : "Выберите график для редактирования"}
        >
          <RiEditLine />
        </button>
        <button 
          className={`tool ${selectedGraph ? '' : 'disabled'}`}
          onClick={deleteSelectedGraph}
          disabled={!selectedGraph}
          title={selectedGraph ? "Удалить выбранный график" : "Выберите график для удаления"}
        >
          <RiDeleteBinLine />
        </button>
        <button 
          className={`tool ${selectedGraph ? '' : 'disabled'}`}
          onClick={exportSelectedGraph}
          disabled={!selectedGraph}
          title={selectedGraph ? "Экспортировать выбранный график в PNG" : "Выберите график для экспорта"}
        >
          <RiImageLine />
        </button>
      </div>
    </>
  );
};


