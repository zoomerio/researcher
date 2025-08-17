import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view'

// Import the original updateColumns function
function updateColumns(
  node: ProseMirrorNode,
  colgroup: HTMLTableColElement,
  table: HTMLTableElement,
  cellMinWidth: number,
  overrideCol?: number,
  overrideValue?: number,
) {
  let totalWidth = 0
  let fixedWidth = true
  let nextDOM = colgroup.firstChild
  const row = node.firstChild

  if (row !== null) {
    for (let i = 0, col = 0; i < row.childCount; i += 1) {
      const { colspan, colwidth } = row.child(i).attrs

      for (let j = 0; j < colspan; j += 1, col += 1) {
        const hasWidth = overrideCol === col ? overrideValue : ((colwidth && colwidth[j]) as number | undefined)
        const cssWidth = hasWidth ? `${hasWidth}px` : ''

        totalWidth += hasWidth || cellMinWidth

        if (!hasWidth) {
          fixedWidth = false
        }

        if (!nextDOM) {
          const colElement = document.createElement('col')
          
          // Set proper style for column
          if (hasWidth) {
            colElement.style.width = cssWidth
          } else {
            colElement.style.minWidth = `${cellMinWidth}px`
          }

          colgroup.appendChild(colElement)
        } else {
          if ((nextDOM as HTMLTableColElement).style.width !== cssWidth) {
            if (hasWidth) {
              ;(nextDOM as HTMLTableColElement).style.width = cssWidth
              ;(nextDOM as HTMLTableColElement).style.minWidth = ''
            } else {
              ;(nextDOM as HTMLTableColElement).style.width = ''
              ;(nextDOM as HTMLTableColElement).style.minWidth = `${cellMinWidth}px`
            }
          }

          nextDOM = nextDOM.nextSibling
        }
      }
    }
  }

  while (nextDOM) {
    const after = nextDOM.nextSibling
    nextDOM.parentNode?.removeChild(nextDOM)
    nextDOM = after
  }

  if (fixedWidth) {
    table.style.width = `${totalWidth}px`
    table.style.minWidth = ''
  } else {
    table.style.width = ''
    table.style.minWidth = `${totalWidth}px`
  }
}

export class CustomTableView implements NodeView {
  node: ProseMirrorNode
  cellMinWidth: number
  dom: HTMLDivElement
  table: HTMLTableElement
  colgroup: HTMLTableColElement
  contentDOM: HTMLTableSectionElement

  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    this.node = node
    this.cellMinWidth = cellMinWidth
    this.dom = document.createElement('div')
    this.dom.className = 'tableWrapper'
    this.table = this.dom.appendChild(document.createElement('table'))
    this.colgroup = this.table.appendChild(document.createElement('colgroup'))
    updateColumns(node, this.colgroup, this.table, cellMinWidth)
    this.contentDOM = this.table.appendChild(document.createElement('tbody'))
    
    // Apply collapsed state immediately if needed
    this.updateCollapsedState()
    
    // Add click handler for collapsed state
    this.dom.addEventListener('click', (event) => {
      const collapsed = Boolean(this.node.attrs?.collapsed)
      if (collapsed) {
        // The click will be handled by our ProseMirror plugin
      }
    })
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) {
      return false
    }

    this.node = node
    updateColumns(node, this.colgroup, this.table, this.cellMinWidth)
    
    // Update collapsed state when node updates
    this.updateCollapsedState()

    return true
  }

  private updateCollapsedState() {
    const collapsed = Boolean(this.node.attrs?.collapsed)
    
    if (collapsed) {
      // Apply collapsed styling to the wrapper
      this.dom.setAttribute('data-collapsed', 'true')
      this.dom.style.display = 'block'
      this.dom.style.border = '1px dashed #64748b'
      this.dom.style.background = '#0b1220'
      this.dom.style.color = 'var(--text)'
      this.dom.style.padding = '6px'
      this.dom.style.width = 'auto'
      this.dom.style.maxWidth = '100%'
      this.dom.style.minWidth = 'auto'
      
      // Hide the table content
      this.table.style.display = 'none'
      
      // Add collapse text if not already present
      if (!this.dom.querySelector('.collapse-text')) {
        const collapseText = document.createElement('div')
        collapseText.className = 'collapse-text'
        collapseText.textContent = 'Таблица скрыта'
        collapseText.style.fontSize = '12px'
        collapseText.style.color = '#94a3b8'
        this.dom.appendChild(collapseText)
      }
    } else {
      // Remove collapsed styling
      this.dom.removeAttribute('data-collapsed')
      this.dom.style.display = ''
      this.dom.style.border = ''
      this.dom.style.background = ''
      this.dom.style.color = ''
      this.dom.style.padding = ''
      this.dom.style.width = ''
      this.dom.style.maxWidth = ''
      this.dom.style.minWidth = ''
      
      // Show the table content
      this.table.style.display = ''
      
      // Remove collapse text
      const collapseText = this.dom.querySelector('.collapse-text')
      if (collapseText) {
        collapseText.remove()
      }
    }
    
    // Also set the data-collapsed attribute on the table itself for CSS compatibility
    if (collapsed) {
      this.table.setAttribute('data-collapsed', 'true')
    } else {
      this.table.removeAttribute('data-collapsed')
    }
  }

  ignoreMutation(mutation: ViewMutationRecord) {
    return mutation.type === 'attributes' && (mutation.target === this.table || this.colgroup.contains(mutation.target))
  }
}
