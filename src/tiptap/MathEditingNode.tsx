import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import React, { useEffect, useRef, useState } from 'react'

// React component for the math editing node view
const MathEditingNodeView = ({ node, updateAttributes, deleteNode, getPos, editor }: any) => {
  const { mathType, originalLatex, editingId } = node.attrs
  const [isEditing, setIsEditing] = useState(true)
  const [inputWidth, setInputWidth] = useState(() => Math.max(10, (originalLatex || '').length * 8))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus and place cursor at the end when the node is created
    if (inputRef.current && isEditing) {
      // Use setTimeout to ensure the DOM is fully updated
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          // Set cursor to the end instead of selecting all text
          const length = inputRef.current.value.length
          inputRef.current.setSelectionRange(length, length)
          
          // Ensure the input is truly focused by blurring editor first
          if (editor && editor.view && editor.view.dom) {
            editor.view.dom.blur()
          }
          inputRef.current.focus()
        }
      }, 10)
    }
  }, [isEditing])

  // Monitor input value changes (including programmatic changes)
  useEffect(() => {
    if (!inputRef.current || !isEditing) return;
    
    const updateWidth = () => {
      if (inputRef.current) {
        const currentLength = inputRef.current.value.length;
        setInputWidth(Math.max(10, currentLength * 8));
      }
    };

    // Initial update
    updateWidth();

    // Set up observer for programmatic changes
    const input = inputRef.current;
    input.addEventListener('input', updateWidth);
    
    // Also check periodically for programmatic changes
    const interval = setInterval(updateWidth, 100);
    
    return () => {
      input.removeEventListener('input', updateWidth);
      clearInterval(interval);
    };
  }, [isEditing])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        finishEditing()
      }
    }

    if (isEditing && inputRef.current) {
      // Add the listener to the input element specifically to capture it first
      inputRef.current.addEventListener('keydown', handleKeyDown, true)
      return () => {
        if (inputRef.current) {
          inputRef.current.removeEventListener('keydown', handleKeyDown, true)
        }
      }
    }
  }, [isEditing])

  const finishEditing = () => {
    if (!isEditing) return;
    
    // Capture the current input value immediately to prevent interference
    const currentInput = inputRef.current;
    const newLatex = currentInput?.value.trim() || originalLatex;
    
    console.log(`[${editingId}] Finishing editing: "${originalLatex}" -> "${newLatex}"`);
    
    // Set editing to false immediately to prevent re-entry
    setIsEditing(false);
    
    // POSITION-INDEPENDENT APPROACH:
    // Find this exact editing node and replace it directly using transactions
    const { state, dispatch } = editor.view;
    const { tr } = state;
    
    let editingNodePos: number | null = null;
    state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'mathEditingNode' && 
          node.attrs.editingId === editingId) {
        editingNodePos = pos;
        console.log(`[${editingId}] Found editing node at position: ${pos}`);
        return false; // Stop searching
      }
    });
    
    if (editingNodePos === null) {
      console.error(`[${editingId}] Could not find editing node in document`);
      // Still dispatch the event so the UI can sync
      document.dispatchEvent(new CustomEvent('mathEditingFinished', { 
        detail: { editingId, error: true }
      }));
      return;
    }
    
    // Create the replacement node based on the math type
    const newNode = mathType === 'block' 
      ? state.schema.nodes.blockMath.create({ latex: newLatex })
      : state.schema.nodes.inlineMath.create({ latex: newLatex });
    
    console.log(`[${editingId}] Replacing editing node with ${mathType} math: "${newLatex}"`);
    
    // Replace the editing node with the new math node in a single atomic transaction
    const newTr = tr.replaceWith(editingNodePos, editingNodePos + 1, newNode);
    
    // Dispatch the transaction immediately - no setTimeout needed!
    dispatch(newTr);
    
    console.log(`[${editingId}] Transaction complete, formula replaced`);
    
    // Notify the app that editing is finished
    document.dispatchEvent(new CustomEvent('mathEditingFinished', { 
      detail: { editingId, mathType, newLatex, originalLatex }
    }));
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    // Update the node attributes with the new content
    updateAttributes({ currentLatex: newValue });
    // Update input width based on content length
    setInputWidth(Math.max(10, newValue.length * 8));
  }

  const mathDisplay = mathType === 'block' ? '$$' : '$'

  return (
    <NodeViewWrapper
      className={`math-editing-node ${mathType === 'block' ? 'block-math-editing' : 'inline-math-editing'}`}
      data-math-editing={editingId}
      data-math-type={mathType}
      data-original-latex={originalLatex}
      style={{
        display: mathType === 'block' ? 'block' : 'inline-block',
        padding: mathType === 'block' ? '1rem' : '2px 4px',
        margin: mathType === 'block' ? '1rem 0' : '0 2px',
        textAlign: mathType === 'block' ? 'center' : 'left',
        border: '2px solid #007acc',
        borderRadius: '4px',
        backgroundColor: '#e6f3ff'
      }}
    >
      {isEditing ? (
        <span style={{ fontFamily: 'monospace' }}>
          {mathDisplay}
                      <input
              ref={inputRef}
              type="text"
              defaultValue={originalLatex}
              onChange={handleInputChange}
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontFamily: 'monospace',
                fontSize: 'inherit',
                minWidth: '10px',
                width: `${inputWidth}px`
              }}
            />
          {mathDisplay}
        </span>
      ) : (
        <span>{mathDisplay}{node.attrs.currentLatex || originalLatex}{mathDisplay}</span>
      )}
    </NodeViewWrapper>
  )
}

// Define the TipTap node
export const MathEditingNode = Node.create({
  name: 'mathEditingNode',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      mathType: {
        default: 'inline',
      },
      originalLatex: {
        default: '',
      },
      currentLatex: {
        default: '',
      },
      editingId: {
        default: '',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-math-editing]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false
          
          return {
            mathType: element.getAttribute('data-math-type') || 'inline',
            originalLatex: element.getAttribute('data-original-latex') || '',
            editingId: element.getAttribute('data-math-editing') || '',
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-math-editing': HTMLAttributes.editingId,
      'data-math-type': HTMLAttributes.mathType,
      'data-original-latex': HTMLAttributes.originalLatex,
    })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathEditingNodeView)
  },
})
