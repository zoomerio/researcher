import { Table } from '@tiptap/extension-table';
import { Plugin, NodeSelection } from 'prosemirror-state';
import { CustomTableView } from './CustomTableView';

// Declare our custom table commands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableExtras: {
      toggleTableCollapsed: () => ReturnType;
      setTableCollapsed: (collapsed: boolean) => ReturnType;
    };
  }
}

const TableWithExtras = Table.extend({
  name: 'table',

  addAttributes() {
    const parent = (this as any).parent?.() || {};
    
    return {
      ...parent,
      collapsed: {
        default: false,
        parseHTML: (element: HTMLElement) => {
          return element.hasAttribute('data-collapsed') || false;
        },
        renderHTML: (attributes: { collapsed?: boolean }) => {
          if (attributes.collapsed) {
            return { 'data-collapsed': 'true' };
          }
          return {};
        },
      },
    };
  },

  addCommands() {
    const parentCommands = (this as any).parent?.() || {};
    
    console.log('TableExtras: Adding commands. Parent commands:', Object.keys(parentCommands));
    
    const customCommands = {
      toggleTableCollapsed: () => ({ state, dispatch, view }: any) => {
        console.log('toggleTableCollapsed command executed!');
        
        const { selection } = state;
        let tablePos = -1;
        let tableNode: any = null;
        
        // Handle NodeSelection (when table is selected as a whole)
        if (selection instanceof NodeSelection && selection.node.type.name === 'table') {
          tablePos = selection.from;
          tableNode = selection.node;
        } else {
          // Handle text selection inside table
          const $from = selection.$from;
          for (let depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node?.type?.name === 'table') {
              tablePos = $from.before(depth);
              tableNode = node;
              break;
            }
          }
        }
        
        if (tablePos === -1 || !tableNode) {
          console.log('No table found at current selection');
          return false;
        }
        
        const currentCollapsed = Boolean(tableNode.attrs?.collapsed);
        console.log('Current collapsed state:', currentCollapsed, '-> toggling to:', !currentCollapsed);
        
        const tr = state.tr.setNodeMarkup(tablePos, tableNode.type, { 
          ...tableNode.attrs, 
          collapsed: !currentCollapsed 
        });
        
        if (dispatch) {
          dispatch(tr);
        }
        return true;
      },

      setTableCollapsed: (collapsed: boolean) => ({ state, dispatch }: any) => {
        const { selection } = state;
        let tablePos = -1;
        let tableNode: any = null;
        
        // Handle NodeSelection (when table is selected as a whole)
        if (selection instanceof NodeSelection && selection.node.type.name === 'table') {
          tablePos = selection.from;
          tableNode = selection.node;
        } else {
          // Handle text selection inside table
          const $from = selection.$from;
          for (let depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node?.type?.name === 'table') {
              tablePos = $from.before(depth);
              tableNode = node;
              break;
            }
          }
        }
        
        if (tablePos === -1 || !tableNode) return false;
        
        const tr = state.tr.setNodeMarkup(tablePos, tableNode.type, { 
          ...tableNode.attrs, 
          collapsed 
        });
        
        if (dispatch) {
          dispatch(tr);
        }
        return true;
      },
    };
    
    console.log('TableExtras: Final commands:', Object.keys({
      ...parentCommands,
      ...customCommands,
    }));
    
    return {
      ...parentCommands,
      ...customCommands,
    } as any;
  },

  addOptions() {
    return {
      ...(this as any).parent?.(),
      View: CustomTableView, // Use our custom view instead of the default TableView
    }
  },

  addProseMirrorPlugins() {
    const parent = (this as any).parent?.() || [];
    
    console.log('TableExtras: Adding ProseMirror plugins. Parent plugins count:', parent.length);
    
    // Create a plugin for column highlighting and collapse selection
    const tableInteractionPlugin = new Plugin({
      props: {
        handleDOMEvents: {

          
          mousedown(view, event) {
            const target = event.target as HTMLElement;
            
            // Look for collapsed tableWrapper or any element inside it
            const wrapper = target?.closest && (
              target.closest('.tableWrapper[data-collapsed="true"]') as HTMLElement | null ||
              target.closest('.tableWrapper')?.hasAttribute('data-collapsed') ? target.closest('.tableWrapper') as HTMLElement : null
            );
            
            if (!wrapper || !wrapper.hasAttribute('data-collapsed')) {
              console.log('TableExtras mousedown: Not a collapsed table');
              return false;
            }
            
            console.log('Collapsed table clicked, attempting to select');
            
            // Try multiple strategies to find the table position
            const rect = wrapper.getBoundingClientRect();
            
            // Strategy 1: Try center of wrapper
            let pos = view.posAtCoords({ 
              left: rect.left + rect.width / 2, 
              top: rect.top + rect.height / 2 
            });
            
            // Strategy 2: Try top-left corner if center failed
            if (!pos) {
              pos = view.posAtCoords({ 
                left: rect.left + 5, 
                top: rect.top + 5 
              });
            }
            
            // Strategy 3: Try bottom-right corner
            if (!pos) {
              pos = view.posAtCoords({ 
                left: rect.right - 5, 
                top: rect.bottom - 5 
              });
            }
            
            if (!pos) return false;
            
            console.log('Found position:', pos.pos);
            
            // Walk up the document tree to find the table node
            const $pos: any = view.state.doc.resolve(pos.pos);
            let depth = $pos.depth;
            let tablePos = -1;
            let tableNode: any = null;
            
            while (depth >= 0) {
              const node = $pos.node(depth);
              console.log(`Depth ${depth}: node type = ${node?.type?.name}`);
              if (node?.type?.name === 'table') {
                tablePos = $pos.before(depth);
                tableNode = node;
                console.log('Found table at position:', tablePos);
                break;
              }
              depth--;
            }
            
            // Alternative approach: traverse the document to find table nodes
            if (tablePos === -1) {
              view.state.doc.descendants((node: any, nodePos: number) => {
                if (node.type.name === 'table' && node.attrs?.collapsed) {
                  // Check if this position is near our click
                  const nodeCoords = view.coordsAtPos(nodePos);
                  if (nodeCoords && 
                      Math.abs(nodeCoords.left - rect.left) < 100 && 
                      Math.abs(nodeCoords.top - rect.top) < 100) {
                    tablePos = nodePos;
                    tableNode = node;
                    return false; // stop iteration
                  }
                }
                return true;
              });
            }
            
            if (tablePos === -1) return false;
            
            console.log('Selecting table node at position:', tablePos);
            
            // Create node selection and dispatch
            const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, tablePos));
            view.dispatch(tr);
            
            // Also ensure the editor is focused
            setTimeout(() => {
              view.focus();
              console.log('Editor focused, isActive table:', view.state.selection instanceof NodeSelection);
            }, 0);
            
            event.preventDefault();
            return true;
          },
        },
      },
    });
    
    // Just return parent plugins with table interaction functionality
    return [
      ...parent,
      tableInteractionPlugin,
    ];
  },
});

export default TableWithExtras;