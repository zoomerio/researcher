import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import React, { useRef, useState, useEffect, Suspense } from 'react'

// Lazy load Plotly to reduce initial bundle size and memory usage
const LazyPlot = React.lazy(() => import('react-plotly.js'))

// Simple placeholder component for now (will be replaced with Plotly when dependencies are installed)
const PlotlyPlaceholder: React.FC<{ data: any; layout: any; config: any }> = ({ data, layout, config }) => {
  return (
    <div style={{
      width: layout?.width || 400,
      height: layout?.height || 300,
      border: '2px dashed #ccc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9f9f9',
      borderRadius: '4px',
      fontSize: '14px',
      color: '#333'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div>📊 Plotly Graph</div>
        <div style={{ fontSize: '12px', marginTop: '4px' }}>
          {data?.[0]?.type || 'scatter'} chart with {data?.[0]?.x?.length || 0} points
        </div>
        <div style={{ fontSize: '10px', marginTop: '4px', color: '#555' }}>
          Install plotly.js and react-plotly.js to see actual graph
        </div>
      </div>
    </div>
  )
}

// React component for the graph node view
const GraphNodeView = ({ node, updateAttributes, deleteNode, getPos, editor }: any) => {
  const { graphData, graphLayout, graphConfig, isEditing } = node.attrs
  const [editMode, setEditMode] = useState(false)
  
  // Ensure each graph has a unique ID
  const currentTime = Date.now()
  const randomNumber = Math.floor(Math.random() * 1000000)
  const graphId = node.attrs.id || ('graph-' + currentTime.toString() + '-' + randomNumber.toString())
  
  // Set the ID if it doesn't exist
  useEffect(() => {
    if (!node.attrs.id) {
      updateAttributes({ id: graphId })
    }
  }, [])
  
  const dataTextareaRef = useRef<HTMLTextAreaElement>(null)
  const layoutTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Default empty graph data
  const defaultData = [{
    x: [1, 2, 3, 4],
    y: [10, 11, 12, 13],
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Пример данных'
  }]

  const defaultLayout = {
    title: {
      text: 'Пример графика',
      font: {
        size: 16,
        color: '#000000'
      }
    },
    width: 400,
    height: 300,
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
    }
  }

  const defaultConfig = {
    displayModeBar: false, // Hide Plotly's toolbar for clean PDF export
    responsive: true,
    // Keep interactions but hide toolbar
    scrollZoom: true,
    doubleClick: 'reset+autosize',
    showTips: false,
    showAxisDragHandles: false,
    showAxisRangeEntryBoxes: false,
    displaylogo: false
  }

  // Safely parse data - should now be properly parsed objects from TipTap attributes
  const parseGraphData = (data: any) => {
    if (!data) return defaultData
    
    // If it's already an array, return it
    if (Array.isArray(data)) return data
    
    // If it's still a string (fallback case), try to parse it
    if (typeof data === 'string') {
      // Handle the case where data is "[object Object]" - this means serialization failed
      if (data === '[object Object]' || data.startsWith('[object ')) {
        // Fallback for incorrectly serialized data
        return defaultData
      }
      
      // Skip empty strings
      if (data.trim() === '') return defaultData
      
      try {
        const parsed = JSON.parse(data)
        return Array.isArray(parsed) ? parsed : defaultData
      } catch (e) {
        // Failed to parse, use default data
        return defaultData
      }
    }
    
    // If it's an object but not an array, wrap it or return default
    if (typeof data === 'object') {
      // If it looks like it might be a single trace object, wrap it in an array
      if (data.x || data.y || data.type) {
        return [data]
      }
      return defaultData
    }
    
    return defaultData
  }

  const parseGraphLayout = (layout: any) => {
    console.log('parseGraphLayout input:', { type: typeof layout, value: layout })
    
    if (!layout) return {}
    
    // If it's already an object, return it
    if (typeof layout === 'object' && !Array.isArray(layout)) {
      console.log('parseGraphLayout: returning object as-is')
      return layout
    }
    
    // If it's still a string (fallback case), try to parse it
    if (typeof layout === 'string') {
      // Handle the case where layout is "[object Object]"
      if (layout === '[object Object]' || layout.startsWith('[object ')) {
        console.log('parseGraphLayout: found [object Object], using default layout')
        // Return default layout instead of empty object
        return {
          title: {
            text: 'График',
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
          }
        }
      }
      
      // Skip empty strings
      if (layout.trim() === '') return {}
      
      try {
        const parsed = JSON.parse(layout)
        console.log('parseGraphLayout: successfully parsed JSON')
        return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      } catch (e) {
        console.log('parseGraphLayout: failed to parse JSON, using empty layout')
        return {}
      }
    }
    
    return {}
  }

  const currentData = parseGraphData(graphData)
  const parsedLayout = parseGraphLayout(graphLayout)
  
  // More robust layout merging - preserve user edits when they exist
  const currentLayout = (() => {
    // If we have a valid parsed layout with user data, use it as-is
    if (parsedLayout && typeof parsedLayout === 'object' && Object.keys(parsedLayout).length > 0) {
      // Only add missing essential properties, don't override existing ones
      const layout = { ...parsedLayout }
      
      // Ensure width and height exist
      if (!layout.width) layout.width = defaultLayout.width || 500
      if (!layout.height) layout.height = defaultLayout.height || 350
      
      // Only add default title if none exists
      if (!layout.title) {
        layout.title = {
          text: 'График',
          font: { size: 16, color: '#000000' }
        }
      }
      
      // Only add default axes if they don't exist
      if (!layout.xaxis) {
        layout.xaxis = {
          title: { text: 'Ось X', font: { size: 14, color: '#000000' } },
          showgrid: true,
          zeroline: true
        }
      }
      if (!layout.yaxis) {
        layout.yaxis = {
          title: { text: 'Ось Y', font: { size: 14, color: '#000000' } },
          showgrid: true,
          zeroline: true
        }
      }
      
      // Add margins and backgrounds only if not specified
      if (!layout.margin) {
        layout.margin = { l: 60, r: 30, t: 60, b: 60 }
      }
      if (!layout.plot_bgcolor) layout.plot_bgcolor = 'white'
      if (!layout.paper_bgcolor) layout.paper_bgcolor = 'white'
      
      return layout
    }
    
    // Fallback to enhanced default layout for new graphs
    return {
      ...defaultLayout,
      title: {
        text: defaultLayout.title?.text || 'График',
        font: { size: 16, color: '#000000' }
      },
      width: defaultLayout.width || 500,
      height: defaultLayout.height || 350,
      xaxis: {
        ...defaultLayout.xaxis,
        showgrid: true,
        zeroline: true
      },
      yaxis: {
        ...defaultLayout.yaxis,
        showgrid: true,
        zeroline: true
      },
      margin: { l: 60, r: 30, t: 60, b: 60 },
      plot_bgcolor: 'white',
      paper_bgcolor: 'white'
    }
  })()
  const currentConfig = { ...defaultConfig, ...graphConfig }

  // Debug logging for layout issues (temporarily enabled)
  console.log('Graph layout debug:', {
    graphLayoutType: typeof graphLayout,
    graphLayout: graphLayout,
    parsedLayoutType: typeof parsedLayout,
    parsedLayout: parsedLayout,
    currentLayoutType: typeof currentLayout,
    currentLayout: currentLayout,
    hasTitle: !!currentLayout.title,
    titleValue: currentLayout.title,
    hasXAxis: !!currentLayout.xaxis,
    xAxisValue: currentLayout.xaxis,
    hasYAxis: !!currentLayout.yaxis,
    yAxisValue: currentLayout.yaxis,
    width: currentLayout.width,
    height: currentLayout.height
  })

  const [tempData, setTempData] = useState('')
  const [tempLayout, setTempLayout] = useState('')
  const [initialized, setInitialized] = useState(false)

  // Initialize temp states only once when component mounts or when data is loaded
  useEffect(() => {
    if (!initialized) {
      setTempData(JSON.stringify(currentData, null, 2))
      setTempLayout(JSON.stringify(currentLayout, null, 2))
      setInitialized(true)
    }
  }, [currentData, currentLayout, initialized])

  // Update temp states only when not in edit mode and data changes
  useEffect(() => {
    if (initialized && !editMode) {
      setTempData(JSON.stringify(currentData, null, 2))
      setTempLayout(JSON.stringify(currentLayout, null, 2))
    }
  }, [currentData, currentLayout, initialized, editMode])

  const handleEdit = () => {
    setEditMode(true)
    // Always refresh with current data when starting edit mode
    // This ensures we start with the latest saved state
    setTempData(JSON.stringify(currentData, null, 2))
    setTempLayout(JSON.stringify(currentLayout, null, 2))
  }

  const handleSave = () => {
    try {
      const newData = JSON.parse(tempData)
      const newLayout = JSON.parse(tempLayout)
      
      updateAttributes({
        graphData: newData,
        graphLayout: newLayout
      })
      
      setEditMode(false)
      
      // Restore editor focus after saving
      setTimeout(() => {
        if (editor && editor.view && editor.view.dom) {
          const pos = getPos()
          if (pos !== undefined) {
            editor.chain()
              .focus()
              .setTextSelection(pos + 1)
              .run()
          } else {
            editor.commands.focus()
          }
        }
      }, 100)
    } catch (error) {
      alert('Неверный формат JSON. Пожалуйста, проверьте ваши данные и макет.')
    }
  }

  const handleCancel = () => {
    setEditMode(false)
    // Reset temp states to current values when canceling
    setTempData(JSON.stringify(currentData, null, 2))
    setTempLayout(JSON.stringify(currentLayout, null, 2))
    
    // Restore editor focus after canceling
    setTimeout(() => {
      if (editor && editor.view && editor.view.dom) {
        const pos = getPos()
        if (pos !== undefined) {
          editor.chain()
            .focus()
            .setTextSelection(pos + 1)
            .run()
        } else {
          editor.commands.focus()
        }
      }
    }, 100)
  }

  const handleDelete = () => {
    deleteNode()
  }

  return (
    <NodeViewWrapper
      className="graph-node"
      data-graph-id={node.attrs.id || graphId}
      style={{
        display: 'block',
        margin: '1rem 0', // Back to original margin
        padding: '1rem',
        border: editMode ? '2px solid #007acc' : 'none', // Keep no border when not selected
        borderRadius: '8px',
        backgroundColor: editMode ? '#f0f8ff' : 'transparent'
      }}
    >
      {editMode ? (
        <div className="graph-editor">
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '14px', fontWeight: 'bold' }}>
              Редактировать график
            </h4>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '12px', fontWeight: 'bold' }}>
                Данные (JSON):
              </label>
              <textarea
                ref={dataTextareaRef}
                value={tempData}
                onChange={(e) => setTempData(e.target.value)}
                style={{
                  width: '100%',
                  height: '200px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  padding: '0.5rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
                placeholder="Введите данные Plotly в формате JSON массива..."
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '12px', fontWeight: 'bold' }}>
                Макет (JSON):
              </label>
              <textarea
                ref={layoutTextareaRef}
                value={tempLayout}
                onChange={(e) => setTempLayout(e.target.value)}
                style={{
                  width: '100%',
                  height: '200px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  padding: '0.5rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
                placeholder="Введите макет Plotly в формате JSON объекта..."
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#f5f5f5',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #007acc',
                borderRadius: '4px',
                backgroundColor: '#007acc',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Сохранить
            </button>
          </div>
        </div>
      ) : (
        <div 
          className="graph-display"
          onClick={() => {
            // Mark this graph as selected when clicked
            const currentGraphId = node.attrs.id || graphId
            
            // Remove selection from other graphs
            document.querySelectorAll('.graph-node').forEach(el => {
              el.classList.remove('selected')
            })
            
            // Add selection to this graph
            const thisNode = document.querySelector(`[data-graph-id="${currentGraphId}"]`)
            if (thisNode) {
              thisNode.classList.add('selected')
            }
            
            document.dispatchEvent(new CustomEvent('graphSelected', { 
              detail: { 
                graphId: currentGraphId, 
                node, 
                updateAttributes, 
                deleteNode, 
                handleEdit: () => {
                  setEditMode(true)
                  // Start with current saved state when editing from toolbar
                  setTempData(JSON.stringify(currentData, null, 2))
                  setTempLayout(JSON.stringify(currentLayout, null, 2))
                }
              } 
            }))
            
            // Enhanced focus restoration after graph selection
            setTimeout(() => {
              if (editor && editor.view && editor.view.dom) {
                // Ensure the editor regains focus and cursor is visible
                const pos = getPos()
                if (pos !== undefined) {
                  // Set a proper text selection to make cursor visible
                  const nextPos = pos + 1
                  editor.chain()
                    .focus()
                    .setTextSelection(nextPos)
                    .run()
                  
                  // Additional focus attempts to ensure cursor visibility
                  setTimeout(() => {
                    editor.view.dom.focus()
                    // Force a selection update to ensure cursor is rendered
                    const { state, dispatch } = editor.view
                    const tr = state.tr.setSelection(state.selection)
                    dispatch(tr)
                  }, 10)
                }
              }
            }, 50)
          }}
          style={{ 
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            display: 'flex',
            justifyContent: 'center' // Center the plot within the full-width container
          }}
        >
          <Suspense fallback={
            <div style={{
              width: currentLayout?.width || 400,
              height: currentLayout?.height || 300,
              border: '2px dashed #ccc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f9f9f9',
              borderRadius: '4px',
              fontSize: '14px',
              color: '#333'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div>📊 Loading Plotly...</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  {currentData?.[0]?.type || 'scatter'} chart with {currentData?.[0]?.x?.length || 0} points
                </div>
              </div>
            </div>
          }>
            <LazyPlot 
              data={currentData}
              layout={currentLayout}
              config={currentConfig}
            />
          </Suspense>
        </div>
      )}
    </NodeViewWrapper>
  )
}

// Define the TipTap node
export const GraphNode = Node.create({
  name: 'graphNode',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
      graphData: {
        default: null,
        // Store as JSON string to prevent [object Object] serialization
        parseHTML: element => {
          const data = element.getAttribute('data-graph-data')
          if (!data || data === '') return null
          try {
            return JSON.parse(data)
          } catch {
            return null
          }
        },
        renderHTML: attributes => {
          if (!attributes.graphData) return {}
          try {
            return {
              'data-graph-data': JSON.stringify(attributes.graphData)
            }
          } catch {
            return {}
          }
        },
      },
      graphLayout: {
        default: null,
        parseHTML: element => {
          const layout = element.getAttribute('data-graph-layout')
          if (!layout || layout === '') return null
          try {
            return JSON.parse(layout)
          } catch {
            return null
          }
        },
        renderHTML: attributes => {
          if (!attributes.graphLayout) return {}
          try {
            return {
              'data-graph-layout': JSON.stringify(attributes.graphLayout)
            }
          } catch {
            return {}
          }
        },
      },
      graphConfig: {
        default: null,
        parseHTML: element => {
          const config = element.getAttribute('data-graph-config')
          if (!config || config === '') return null
          try {
            return JSON.parse(config)
          } catch {
            return null
          }
        },
        renderHTML: attributes => {
          if (!attributes.graphConfig) return {}
          try {
            return {
              'data-graph-config': JSON.stringify(attributes.graphConfig)
            }
          } catch {
            return {}
          }
        },
      },
      isEditing: {
        default: false,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-graph-id]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false
          
          return {
            id: element.getAttribute('data-graph-id') || '',
            // Let the attribute parsers handle the data parsing
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-graph-id': HTMLAttributes.id,
      // The attribute renderHTML methods will handle the data serialization
    }), 'Graph placeholder']
  },

  addNodeView() {
    return ReactNodeViewRenderer(GraphNodeView, {
      // Add options to reduce flushSync warnings
      stopEvent: () => true,
    })
  },

  addCommands() {
    return {
      insertGraph: (attributes = {}) => ({ commands }: { commands: any }) => {
        return commands.insertContent({
          type: this.name,
          attrs: attributes,
        })
      },
    } as any
  },
})
