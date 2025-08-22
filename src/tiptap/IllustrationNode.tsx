import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import React, { useRef, useState, useEffect, useCallback, Component, ErrorInfo } from 'react'
import { createPortal } from 'react-dom'


interface Measurement {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  distance: number
  unit: string
  label: string
}
import { 
  RiDragMove2Line, 
  RiCloseLine, 
  RiEditLine, 
  RiRulerLine,
  RiAlignLeft,
  RiAlignCenter,
  RiAlignRight,
  RiAlignJustify,
  RiImageEditLine,
  RiPaintBrushLine,
  RiEraserLine,
  RiSave3Line,
  RiDeleteBinLine,
  RiQuillPenLine
} from 'react-icons/ri'

// Error boundary for illustration components
class IllustrationErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('IllustrationNode error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          border: '2px dashed #ccc', 
          borderRadius: '4px',
          textAlign: 'center',
          color: '#333'
        }}>
          <p>⚠️ Error loading illustration</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Image optimization utility
const optimizeImageIfNeeded = (imgElement: HTMLImageElement, dataUrl: string, updateAttributes: (attrs: any) => void) => {
  // Only optimize if image is larger than 1MB or dimensions are very large
  const maxFileSize = 1024 * 1024 // 1MB
  const maxDimension = 2048 // pixels

  const naturalWidth = imgElement.naturalWidth
  const naturalHeight = imgElement.naturalHeight
  const estimatedSize = dataUrl.length * 0.75 // rough estimate

  const needsOptimization = estimatedSize > maxFileSize || naturalWidth > maxDimension || naturalHeight > maxDimension

  if (!needsOptimization) return

  // Create canvas for optimization
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Calculate new dimensions while maintaining aspect ratio
  let newWidth = naturalWidth
  let newHeight = naturalHeight

  if (naturalWidth > maxDimension || naturalHeight > maxDimension) {
    const ratio = Math.min(maxDimension / naturalWidth, maxDimension / naturalHeight)
    newWidth = Math.round(naturalWidth * ratio)
    newHeight = Math.round(naturalHeight * ratio)
  }

  canvas.width = newWidth
  canvas.height = newHeight

  // Draw and compress
  ctx.drawImage(imgElement, 0, 0, newWidth, newHeight)
  const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.92)

  // Only update if we actually reduced the size
  if (optimizedDataUrl.length < dataUrl.length) {
    console.log(`Image optimized: ${Math.round(dataUrl.length / 1024)}KB → ${Math.round(optimizedDataUrl.length / 1024)}KB`)
    updateAttributes({ src: optimizedDataUrl })
  }
}

// Drawing canvas component
const DrawingCanvas: React.FC<{
  width: number
  height: number
  displayWidth: number
  displayHeight: number
  onSave: (dataUrl: string) => void
  onCancel: () => void
  initialImage?: string
}> = ({ width, height, displayWidth, displayHeight, onSave, onCancel, initialImage }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush')
  const [brushSize, setBrushSize] = useState(5)
  const [brushColor, setBrushColor] = useState('#000000')

  // Maintain original image resolution for quality preservation
  // Only scale down if the image is extremely large (beyond reasonable editing size)
  const MAX_CANVAS_WIDTH = 4096  // Increased limit for quality
  const MAX_CANVAS_HEIGHT = 4096
  
  // Only scale down if absolutely necessary for memory
  const scaleFactor = Math.min(
    MAX_CANVAS_WIDTH / width,
    MAX_CANVAS_HEIGHT / height,
    1 // Don't scale up
  )
  
  // Use original dimensions unless the image is truly massive
  const canvasWidth = scaleFactor < 1 ? Math.floor(width * scaleFactor) : width
  const canvasHeight = scaleFactor < 1 ? Math.floor(height * scaleFactor) : height
  
  console.log(`Drawing canvas: ${canvasWidth}x${canvasHeight} (original: ${width}x${height}, scale: ${scaleFactor.toFixed(3)})`)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = canvasWidth
    canvas.height = canvasHeight

    const ctx = canvas.getContext('2d', { 
      willReadFrequently: false, // Optimize for drawing performance
      alpha: true, // Allow transparency
      desynchronized: true // Allow async rendering for better performance
    })
    if (!ctx) return

    // Configure canvas for memory efficiency
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'medium' // Balance between quality and performance

    // Fill with white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw the initial image if provided
    if (initialImage) {
      const img = new Image()
      img.onload = () => {
        // Draw image scaled to canvas size
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
        console.log(`Drawing canvas initialized: ${canvasWidth}x${canvasHeight} (scale: ${scaleFactor.toFixed(2)})`)
      }
      img.onerror = () => {
        console.warn('Failed to load initial image for drawing canvas')
      }
      img.src = initialImage
    } else {
      console.log(`New drawing canvas initialized: ${canvasWidth}x${canvasHeight}`)
    }
    
    // Cleanup function to clear canvas memory when component unmounts
    return () => {
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        canvas.width = 1  // Force canvas buffer deallocation
        canvas.height = 1
      }
    }
  }, [initialImage, width, height, canvasWidth, canvasHeight, scaleFactor])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    // Account for CSS scaling by calculating the ratio between actual canvas size and displayed size
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = brushColor
    } else {
      ctx.globalCompositeOperation = 'destination-out'
    }
    
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [tool, brushColor, brushSize])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    // Account for CSS scaling by calculating the ratio between actual canvas size and displayed size
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()
  }, [isDrawing])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create output canvas at original resolution
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = width
    outputCanvas.height = height
    const outputCtx = outputCanvas.getContext('2d', { 
      willReadFrequently: false,
      alpha: true
    })
    
    if (!outputCtx) return

    // Draw the canvas content to the output canvas
    if (scaleFactor < 1) {
      // Scale back up if we had to scale down
      outputCtx.scale(1 / scaleFactor, 1 / scaleFactor)
      outputCtx.drawImage(canvas, 0, 0)
    } else {
      // Direct copy if no scaling was needed
      outputCtx.drawImage(canvas, 0, 0)
    }

    // Determine appropriate quality based on original image characteristics
    let dataUrl: string
    let targetQuality = 0.92 // Default to good quality
    
    if (initialImage) {
      // Try to estimate original image compression level to match it
      if (initialImage.includes('data:image/jpeg') || initialImage.includes('.jpg') || initialImage.includes('.jpeg')) {
        // For JPEG originals, use quality that maintains similar file size ratio
        // Start with good quality, but if the result is much larger than original, adjust
        
        // Try different quality levels to find the best match
        const testQualities = [0.95, 0.90, 0.85, 0.80]
        let bestQuality = 0.92
        let bestDataUrl = outputCanvas.toDataURL('image/jpeg', bestQuality)
        
        // If we have access to original file size estimate, try to match it
        if (initialImage.startsWith('data:')) {
          const originalSize = initialImage.length
          const targetSize = originalSize * 1.2 // Allow 20% size increase
          
          for (const quality of testQualities) {
            const testDataUrl = outputCanvas.toDataURL('image/jpeg', quality)
            if (testDataUrl.length <= targetSize) {
              bestDataUrl = testDataUrl
              bestQuality = quality
              break
            }
          }
        }
        
        dataUrl = bestDataUrl
        console.log(`[Drawing] JPEG saved with quality ${bestQuality}`)
      } else if (initialImage.includes('data:image/png') || initialImage.includes('.png')) {
        // Original was PNG - try JPEG first for size, fallback to PNG if needed
        const jpegDataUrl = outputCanvas.toDataURL('image/jpeg', 0.92)
        const pngDataUrl = outputCanvas.toDataURL('image/png')
        
        // Use JPEG if it's significantly smaller, otherwise keep PNG
        if (jpegDataUrl.length < pngDataUrl.length * 0.7) {
          dataUrl = jpegDataUrl
          console.log(`[Drawing] PNG converted to JPEG for size optimization`)
        } else {
          dataUrl = pngDataUrl
          console.log(`[Drawing] Kept as PNG for quality`)
        }
      } else {
        // Unknown format - use JPEG with good quality
        dataUrl = outputCanvas.toDataURL('image/jpeg', 0.90)
      }
    } else {
      // New drawing - use JPEG with good quality
      dataUrl = outputCanvas.toDataURL('image/jpeg', 0.90)
    }
    
    const fileSizeKB = Math.round(dataUrl.length * 0.75 / 1024)
    const format = dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
    console.log(`Drawing saved: ${fileSizeKB}KB (${format})`)
    
    onSave(dataUrl)
  }

  return createPortal(
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.8)', 
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        maxWidth: '95vw',
        maxHeight: '95vh',
        overflow: 'auto',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setTool('brush')}
            style={{
              padding: '8px 12px',
              backgroundColor: tool === 'brush' ? '#007acc' : '#f0f0f0',
              color: tool === 'brush' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RiPaintBrushLine />
            Кисть
          </button>
          <button
            onClick={() => setTool('eraser')}
            style={{
              padding: '8px 12px',
              backgroundColor: tool === 'eraser' ? '#007acc' : '#f0f0f0',
              color: tool === 'eraser' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RiEraserLine />
            Ластик
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#000' }}>Размер:</label>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              style={{ width: '80px' }}
            />
            <span style={{ fontSize: '12px', minWidth: '20px', color: '#000' }}>{brushSize}</span>
          </div>

          {tool === 'brush' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#000' }}>Цвет:</label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                style={{ width: '40px', height: '30px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              />
            </div>
          )}

          <button
            onClick={clearCanvas}
            style={{
              padding: '8px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Очистить
          </button>
        </div>

        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ 
            border: '1px solid #ccc', 
            cursor: tool === 'brush' ? 'crosshair' : 'grab',
            display: 'block',
            maxWidth: '90vw',
            maxHeight: 'calc(90vh - 200px)', // Leave space for controls
            width: 'auto',
            height: 'auto'
          }}
        />

        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RiSave3Line />
            Сохранить
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Signature tool component
const SignatureTool: React.FC<{
  onSave: (dataUrl: string) => void
  onCancel: () => void
}> = ({ onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(3)
  const [brushColor, setBrushColor] = useState('#000000')

  // Reduced signature canvas size for memory efficiency
  const CANVAS_WIDTH = 480  // Reduced from 600
  const CANVAS_HEIGHT = 160 // Reduced from 200

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT

    const ctx = canvas.getContext('2d', { 
      willReadFrequently: false, // Optimize for drawing
      alpha: true, // Allow transparency for signatures
      desynchronized: true // Better performance
    })
    if (!ctx) return

    // Configure for smooth drawing
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'medium'

    // Fill with transparent background
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    console.log(`Signature canvas initialized: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`)
    
    // Cleanup function to clear canvas memory when component unmounts
    return () => {
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        canvas.width = 1  // Force canvas buffer deallocation
        canvas.height = 1
      }
    }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = brushColor
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [brushColor, brushSize])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()
  }, [isDrawing])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Use JPEG with high quality for new drawings to keep file size reasonable
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    onSave(dataUrl)
  }

  return createPortal(
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.8)', 
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        maxWidth: '95vw',
        maxHeight: '95vh',
        overflow: 'auto',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#000' }}>Добавить подпись</h3>
        
        <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#000' }}>Размер:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              style={{ width: '80px' }}
            />
            <span style={{ fontSize: '12px', minWidth: '20px', color: '#000' }}>{brushSize}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#000' }}>Цвет:</label>
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              style={{ width: '40px', height: '30px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            />
          </div>

          <button
            onClick={clearCanvas}
            style={{
              padding: '8px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Очистить
          </button>
        </div>

        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ 
            border: '1px solid #ccc', 
            cursor: 'crosshair',
            display: 'block',
            width: `${CANVAS_WIDTH}px`,
            height: `${CANVAS_HEIGHT}px`,
            maxWidth: '100%',
            backgroundColor: 'white'
          }}
        />

        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RiSave3Line />
            Сохранить
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Measurement tool component - FIXED CURSOR COORDINATES
const MeasurementTool: React.FC<{
  imageRef: React.RefObject<HTMLImageElement>
  imageWidth: number
  imageHeight: number
  onClose: () => void
}> = ({ imageRef, imageWidth, imageHeight, onClose }) => {
  const measurementImageRef = useRef<HTMLImageElement>(null)
  
  // Calculate proper container size maintaining aspect ratio
  const aspectRatio = imageWidth / imageHeight
  const maxWidth = Math.min(imageWidth, window.innerWidth * 0.9)
  const maxHeight = Math.min(imageHeight, window.innerHeight * 0.7)
  
  let containerWidth = imageWidth
  let containerHeight = imageHeight
  
  // Scale down if too large, maintaining aspect ratio
  if (containerWidth > maxWidth || containerHeight > maxHeight) {
    const widthRatio = maxWidth / containerWidth
    const heightRatio = maxHeight / containerHeight
    const ratio = Math.min(widthRatio, heightRatio)
    
    containerWidth = Math.round(containerWidth * ratio)
    containerHeight = Math.round(containerHeight * ratio)
  }
  
  const [measurements, setMeasurements] = useState<Array<{
    id: string
    x1: number
    y1: number
    x2: number
    y2: number
    distance: number
    label: string
  }>>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentMeasurement, setCurrentMeasurement] = useState<{
    x1: number
    y1: number
    x2: number
    y2: number
  } | null>(null)
  const [pixelsPerUnit, setPixelsPerUnit] = useState(100) // pixels per unit
  const [unit, setUnit] = useState('см')
  const [displayedImageSize, setDisplayedImageSize] = useState({ width: containerWidth, height: containerHeight })

  // Update displayed image size when image loads
  useEffect(() => {
    const updateImageSize = () => {
      if (measurementImageRef.current) {
        const rect = measurementImageRef.current.getBoundingClientRect()
        setDisplayedImageSize({ width: rect.width, height: rect.height })
      }
    }
    
    if (measurementImageRef.current) {
      measurementImageRef.current.onload = updateImageSize
      updateImageSize() // Call immediately in case image is already loaded
    }
    
    // Also update on window resize
    window.addEventListener('resize', updateImageSize)
    return () => window.removeEventListener('resize', updateImageSize)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    const measurementArea = e.currentTarget as HTMLElement
    const img = measurementImageRef.current
    if (!img) return
    
    const containerRect = measurementArea.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()
    
    // Calculate coordinates relative to the image position within the container
    const x = e.clientX - imgRect.left
    const y = e.clientY - imgRect.top

    setIsDrawing(true)
    setCurrentMeasurement({ x1: x, y1: y, x2: x, y2: y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentMeasurement) return

    const measurementArea = e.currentTarget as HTMLElement
    const img = measurementImageRef.current
    if (!img) return
    
    const containerRect = measurementArea.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()
    
    // Calculate coordinates relative to the image position within the container
    const x = e.clientX - imgRect.left
    const y = e.clientY - imgRect.top

    setCurrentMeasurement(prev => prev ? { ...prev, x2: x, y2: y } : null)
  }

  const handleMouseUp = () => {
    if (!currentMeasurement || !isDrawing) return

    const distance = Math.sqrt(
      Math.pow(currentMeasurement.x2 - currentMeasurement.x1, 2) +
      Math.pow(currentMeasurement.y2 - currentMeasurement.y1, 2)
    )

    if (distance > 5) { // Only add measurement if line is long enough
      // Convert display coordinates to actual image coordinates for accurate measurement
      const scaleX = containerWidth / displayedImageSize.width
      const scaleY = containerHeight / displayedImageSize.height
      const actualDistance = distance * Math.max(scaleX, scaleY) // Use the larger scale to be more accurate
      
      const realDistance = actualDistance / pixelsPerUnit
      const newMeasurement = {
        id: Date.now().toString(),
        x1: currentMeasurement.x1,
        y1: currentMeasurement.y1,
        x2: currentMeasurement.x2,
        y2: currentMeasurement.y2,
        distance: realDistance,
        label: `${realDistance.toFixed(2)} ${unit}`
      }
      setMeasurements(prev => [...prev, newMeasurement])
    }

    setCurrentMeasurement(null)
    setIsDrawing(false)
  }

  const deleteMeasurement = (id: string) => {
    setMeasurements(prev => prev.filter(m => m.id !== id))
  }

  return createPortal(
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.8)', 
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        maxWidth: '95vw',
        maxHeight: '95vh',
        overflow: 'auto',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        position: 'relative'
      }}>
        {/* Header with controls */}
        <div style={{
          marginBottom: '20px',
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#000' }}>Масштаб:</label>
            <input
              type="number"
              value={pixelsPerUnit}
              onChange={(e) => setPixelsPerUnit(Number(e.target.value))}
              style={{ width: '80px', padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
            />
            <span style={{ fontSize: '11px', color: '#666' }}>пикс/{unit}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#000' }}>Единица:</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{ padding: '4px', borderRadius: '3px', border: '1px solid #ccc' }}
            >
              <option value="см">см</option>
              <option value="мм">мм</option>
              <option value="м">м</option>
              <option value="дюйм">дюйм</option>
            </select>
          </div>

          {measurements.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '500', color: '#000'}}>Измерений: {measurements.length}</span>
            </div>
          )}
        </div>

        {/* Measurement area with image and overlay */}
        <div style={{
          position: 'relative',
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
          border: '2px solid #ddd',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: 'transparent',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Background image - maintains aspect ratio */}
          {imageRef.current && (
            <img
              ref={measurementImageRef}
              src={imageRef.current.src}
              alt="Measurement target"
              style={{
                width: `${containerWidth}px`,
                height: `${containerHeight}px`,
                objectFit: 'contain',
                pointerEvents: 'none',
                display: 'block'
              }}
            />
          )}

          {/* Measurement overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              cursor: 'crosshair'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />

          {/* SVG for measurement lines - positioned exactly over image */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
            width={displayedImageSize.width}
            height={displayedImageSize.height}
          >
              {measurements.map(measurement => (
                <g key={measurement.id}>
                  <line
                    x1={measurement.x1}
                    y1={measurement.y1}
                    x2={measurement.x2}
                    y2={measurement.y2}
                    stroke="#ff0000"
                    strokeWidth="2"
                  />
                  <circle cx={measurement.x1} cy={measurement.y1} r="4" fill="#ff0000" />
                  <circle cx={measurement.x2} cy={measurement.y2} r="4" fill="#ff0000" />
                  <text
                    x={(measurement.x1 + measurement.x2) / 2}
                    y={(measurement.y1 + measurement.y2) / 2 - 10}
                    fill="#ff0000"
                    fontSize="12"
                    textAnchor="middle"
                    style={{ fontWeight: 'bold', textShadow: '1px 1px 2px white' }}
                  >
                    {measurement.label}
                  </text>
                </g>
              ))}
              
              {/* Current measurement being drawn */}
              {currentMeasurement && (
                <g>
                  <line
                    x1={currentMeasurement.x1}
                    y1={currentMeasurement.y1}
                    x2={currentMeasurement.x2}
                    y2={currentMeasurement.y2}
                    stroke="#ff0000"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                  <circle cx={currentMeasurement.x1} cy={currentMeasurement.y1} r="4" fill="#ff0000" />
                  <circle cx={currentMeasurement.x2} cy={currentMeasurement.y2} r="4" fill="#ff0000" />
                </g>
              )}
          </svg>
        </div>

        {/* Measurements list and controls */}
        <div style={{
          marginTop: '20px',
          display: 'flex',
          gap: '20px',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          {/* Measurements list */}
          {measurements.length > 0 && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' , color: '#000'}}>
                Список измерений:
              </div>
              <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {measurements.map((measurement, index) => (
                  <div key={measurement.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '3px',
                    marginBottom: '4px',
                    fontSize: '12px',
                    color: '#000'
                  }}>
                    <span>#{index + 1}: {measurement.label}</span>
                    <button
                      onClick={() => deleteMeasurement(measurement.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc3545',
                        cursor: 'pointer',
                        padding: '2px',
                        fontSize: '14px'
                      }}
                      title="Удалить измерение"
                    >
                      <RiDeleteBinLine />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Close button */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Caption input component
const CaptionInput: React.FC<{
  initialValue: string
  onSave: (caption: string) => void
  onCancel: () => void
}> = ({ initialValue, onSave, onCancel }) => {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleSave = () => {
    onSave(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        width: '400px',
        maxWidth: '90vw',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        boxSizing: 'border-box'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#000' }}>Подпись к изображению</h3>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите подпись..."
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            marginBottom: '15px',
            boxSizing: 'border-box',
            color: '#000'
          }}
        />
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#000'
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Main illustration node view component - memoized for performance
const IllustrationNodeView = React.memo(({ node, updateAttributes, deleteNode, getPos, editor }: any) => {
  const { src, alt, title, width, height, originalWidth, originalHeight, caption, alignment, textWrap } = node.attrs
  const [isResizing, setIsResizing] = useState(false)
  const [showDrawing, setShowDrawing] = useState(false)
  const [showMeasurement, setShowMeasurement] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [showCaptionInput, setShowCaptionInput] = useState(false)
  const [isSelected, setIsSelected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const isSelectedRef = useRef(false)
  const nodeIdRef = useRef(node.attrs.id || containerRef.current)
  const originalDimensions = useRef<{ width: number; height: number } | null>(null)

  // Update refs when selection changes
  useEffect(() => {
    isSelectedRef.current = isSelected
  }, [isSelected])

  // Store original dimensions when image loads
  useEffect(() => {
    const img = imageRef.current
    if (!img) return

    const setOriginalDimensions = () => {
      const natWidth = img.naturalWidth
      const natHeight = img.naturalHeight
      
      if (natWidth > 0 && natHeight > 0) {
        originalDimensions.current = {
          width: natWidth,
          height: natHeight
        }
        
        if (!originalWidth || !originalHeight) {
          updateAttributes({
            originalWidth: natWidth,
            originalHeight: natHeight
          })
        }
      }
    }

    if (img.complete && img.naturalWidth > 0) {
      setOriginalDimensions()
    } else {
      img.onload = setOriginalDimensions
    }

    return () => {
      if (img) {
        img.onload = null
      }
    }
  }, [src, originalWidth, originalHeight, updateAttributes])

  // Use stored original dimensions if available
  useEffect(() => {
    if (originalWidth && originalHeight && !originalDimensions.current) {
      originalDimensions.current = {
        width: originalWidth,
        height: originalHeight
      }
    }
  }, [originalWidth, originalHeight])



  const handleResize = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = width || 300
    const startHeight = height || 200
    const aspectRatio = startWidth / startHeight

    // Optimize resize performance with RAF and better throttling
    let animationFrameId: number | null = null
    let lastUpdateTime = 0
    const updateThrottle = 16 // ~60fps for smooth performance
    const minDelta = 3 // Minimum pixel movement to trigger update

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY
      
      // Only process if there's significant movement
      if (Math.abs(deltaX) < minDelta && Math.abs(deltaY) < minDelta) return
      
      // Cancel previous animation frame if pending
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      
      // Use requestAnimationFrame for smooth updates
      animationFrameId = requestAnimationFrame(() => {
        const now = performance.now()
        if (now - lastUpdateTime < updateThrottle) return
        lastUpdateTime = now
      
      let newWidth = startWidth
      let newHeight = startHeight

      switch (direction) {
        case 'se': // Southeast - maintain aspect ratio, use primary direction
          const primaryDeltaSE = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY
          newWidth = Math.max(100, startWidth + primaryDeltaSE)
          newHeight = newWidth / aspectRatio
          break
        case 'sw': // Southwest - maintain aspect ratio
          const primaryDeltaSW = Math.abs(deltaX) > Math.abs(deltaY) ? -deltaX : deltaY
          newWidth = Math.max(100, startWidth + primaryDeltaSW)
          newHeight = newWidth / aspectRatio
          break
        case 'ne': // Northeast - maintain aspect ratio
          const primaryDeltaNE = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : -deltaY
          newWidth = Math.max(100, startWidth + primaryDeltaNE)
          newHeight = newWidth / aspectRatio
          break
        case 'nw': // Northwest - maintain aspect ratio
          const primaryDeltaNW = Math.abs(deltaX) > Math.abs(deltaY) ? -deltaX : -deltaY
          newWidth = Math.max(100, startWidth + primaryDeltaNW)
          newHeight = newWidth / aspectRatio
          break
        case 'e': // East - width only
          newWidth = Math.max(100, startWidth + deltaX)
          break
        case 'w': // West - width only
          newWidth = Math.max(100, startWidth - deltaX)
          break
        case 's': // South - height only
          newHeight = Math.max(100, startHeight + deltaY)
          break
        case 'n': // North - height only
          newHeight = Math.max(100, startHeight - deltaY)
          break
      }
      
        // Only update if values actually changed significantly
        const roundedWidth = Math.round(newWidth)
        const roundedHeight = Math.round(newHeight)
        
        if (Math.abs(roundedWidth - width) > 2 || Math.abs(roundedHeight - height) > 2) {
          updateAttributes({ width: roundedWidth, height: roundedHeight })
        }
      })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      // Clean up any pending animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [width, height, updateAttributes])

  const handleDrawingSave = async (dataUrl: string) => {
    try {
      let result;
      
      if (src.startsWith('rsrch-image://')) {
        // For existing temp files, save to the same path but add cache-busting
        const urlWithoutProtocol = src.replace('rsrch-image://', '');
        const pathWithoutParams = urlWithoutProtocol.split('?')[0]; // Remove cache-busting params
        const tempPath = decodeURIComponent(pathWithoutParams);
        result = await (window as any).api.saveTempImageEdit({
          tempPath: tempPath,
          imageData: dataUrl
        });
        
        if (result.success) {
          // Add cache-busting parameter to force browser reload
          const cacheBuster = Date.now();
          const newUrl = `${result.customUrl}?v=${cacheBuster}`;
          updateAttributes({ src: newUrl });
        }
      } else {
        // For old images or base64 images, create new temp file with unique ID
        const mimeType = dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';
        const timestamp = Date.now();
        const uniqueId = `drawing_edit_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
        
        result = await (window as any).api.createTempImage({
          imageData: src.startsWith('data:') ? src : dataUrl, // Use original src if it's base64, otherwise use drawing
          originalPath: src.startsWith('rsrch-image://') ? decodeURIComponent(src.replace('rsrch-image://', '')) : undefined,
          mimeType: mimeType,
          uniqueId: uniqueId
        });
        
        if (result.success) {
          // Now save the drawing to the new temp file
          const editResult = await (window as any).api.saveTempImageEdit({
            tempPath: result.tempPath,
            imageData: dataUrl
          });
          
          if (editResult.success) {
            const cacheBuster = Date.now();
            const newUrl = `${editResult.customUrl}?v=${cacheBuster}`;
            updateAttributes({ src: newUrl });
          }
        }
      }
      
      if (!result || !result.success) {
        console.error('Failed to save image edit:', result?.error);
        // Fallback to base64 if temp operations fail
        updateAttributes({ src: dataUrl });
      }
    } catch (error) {
      console.error('Error saving drawing:', error);
      // Fallback to base64 if anything fails
      updateAttributes({ src: dataUrl });
    }
    
    setShowDrawing(false);
  }

  const handleSignatureSave = async (dataUrl: string) => {
    try {
      // Create temp file for signature
      const result = await (window as any).api.createTempImage({
        imageData: dataUrl,
        mimeType: 'image/png'
      });
      
      if (result.success) {
        // Replace current image with signature
        updateAttributes({ 
          src: result.customUrl,
          width: 300,
          height: 100
        });
      } else {
        console.error('Failed to create temp signature:', result?.error);
        // Fallback to base64 if temp creation fails
        updateAttributes({ 
          src: dataUrl,
          width: 300,
          height: 100
        });
      }
    } catch (error) {
      console.error('Error saving signature:', error);
      // Fallback to base64 if anything fails
      updateAttributes({ 
        src: dataUrl,
        width: 300,
        height: 100
      });
    }
    
    setShowSignature(false);
  }

  // Global event listeners for selection management
  useEffect(() => {
    const handleGlobalDeselection = (event: any) => {
      const excludeId = event.detail?.excludeId
      if (excludeId !== nodeIdRef.current && isSelectedRef.current) {
        setIsSelected(false)
      }
    }

    const handleIllustrationDeselect = (event: any) => {
      const excludeId = event.detail?.excludeId
      // If excludeId is null (empty space click) or different from this node, deselect
      if ((excludeId === null || excludeId !== nodeIdRef.current) && isSelectedRef.current) {
        setIsSelected(false)
      }
    }

    const handleSyncSelection = (event: any) => {
      // Check if this is the illustration being synced
      if (event.detail.element === containerRef.current) {
        // Simply dispatch the illustrationSelected event to sync state
        document.dispatchEvent(new CustomEvent('illustrationSelected', {
          detail: {
            node,
            updateAttributes,
            deleteNode,
            startDrawing: () => setShowDrawing(true),
            startMeasurement: () => setShowMeasurement(true),
            startCaptionEdit: () => setShowCaptionInput(true)
          }
        }))
      }
    }

    document.addEventListener('illustrationSelected', handleGlobalDeselection)
    document.addEventListener('illustrationDeselect', handleIllustrationDeselect)
    document.addEventListener('syncIllustrationSelection', handleSyncSelection)
    
    return () => {
      document.removeEventListener('illustrationSelected', handleGlobalDeselection)
      document.removeEventListener('illustrationDeselect', handleIllustrationDeselect)
      document.removeEventListener('syncIllustrationSelection', handleSyncSelection)
    }
  }, [])

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent global deselection
    
    // Always deselect other illustrations first
    document.dispatchEvent(new CustomEvent('illustrationDeselect', { 
      detail: { excludeId: node.attrs.id || containerRef.current }
    }))
    
    setIsSelected(true)
    
    // Dispatch selection event for the images bar
    document.dispatchEvent(new CustomEvent('illustrationSelected', {
      detail: {
        node,
        updateAttributes,
        deleteNode,
        startDrawing: () => setShowDrawing(true),
        startMeasurement: () => setShowMeasurement(true),
        startCaptionEdit: () => setShowCaptionInput(true)
      }
    }))
  }

  const getWrapperStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {}

    if (textWrap === 'none') {
      // No text wrapping - use text alignment with clear both
      baseStyle.margin = '16px 0'
      baseStyle.clear = 'both'
      
      switch (alignment) {
        case 'left':
          baseStyle.textAlign = 'left'
          break
        case 'right':
          baseStyle.textAlign = 'right'
          break
        case 'center':
          baseStyle.textAlign = 'center'
          break
      }
    } else {
      // Text wrapping enabled - use floats (no clear: both!)
      switch (alignment) {
        case 'left':
          baseStyle.float = 'left'
          baseStyle.margin = '0 16px 8px 0'
          break
        case 'right':
          baseStyle.float = 'right'
          baseStyle.margin = '0 0 8px 16px'
          break
        case 'center':
          baseStyle.display = 'block'
          baseStyle.textAlign = 'center'
          baseStyle.clear = 'both'
          baseStyle.margin = '16px 0'
          break
      }
    }
    
    return baseStyle
  }

  const getContainerStyle = () => {
    const baseStyle: React.CSSProperties = {
      position: 'relative',
      display: 'inline-block',
      border: isSelected ? '2px solid #007acc' : '1px solid transparent',
      borderRadius: '4px',
      padding: '4px',
      maxWidth: '100%'
    }

    return baseStyle
  }

  return (
    <NodeViewWrapper
      className="illustration-node"
      style={getWrapperStyle()}
    >
      <IllustrationErrorBoundary>
      <div
        ref={containerRef}
        style={getContainerStyle()}
        onClick={handleImageClick}
      >
                 {/* Image - optimized for performance */}
          <img
            ref={imageRef}
            src={src}
            alt={alt || ''}
            title={title || ''}
            loading="lazy"
            decoding="async"
            style={{
              width: width ? `${width}px` : 'auto',
              height: height ? `${height}px` : 'auto',
              maxWidth: '100%',
              display: 'block',
              cursor: 'pointer',
              imageRendering: 'auto'
            }}
            draggable={false}
            onLoad={() => {
              // Optimize image after load if it's too large
              if (imageRef.current && src && src.startsWith('data:')) {
                optimizeImageIfNeeded(imageRef.current, src, updateAttributes)
              }
            }}
          />

          {/* Caption - always centered under the image */}
          {caption && (
            <div style={{
              textAlign: 'center',
              fontSize: '14px',
              color: '#666',
              fontStyle: 'italic',
              marginTop: '8px',
              padding: '0 4px'
            }}>
              {caption}
            </div>
          )}

                 {/* Controls (shown when selected) */}
         {isSelected && (
           <>
             {/* Resize handles */}
             {!isResizing && (
               <>
                 {/* Corner handles - maintain aspect ratio */}
                 <div
                   style={{
                     position: 'absolute',
                     top: '-4px',
                     left: '-4px',
                     width: '8px',
                     height: '8px',
                     backgroundColor: '#007acc',
                     cursor: 'nw-resize',
                     borderRadius: '50%'
                   }}
                   onMouseDown={(e) => handleResize(e, 'nw')}
                 />
                 <div
                   style={{
                     position: 'absolute',
                     top: '-4px',
                     right: '-4px',
                     width: '8px',
                     height: '8px',
                     backgroundColor: '#007acc',
                     cursor: 'ne-resize',
                     borderRadius: '50%'
                   }}
                   onMouseDown={(e) => handleResize(e, 'ne')}
                 />
                 <div
                   style={{
                     position: 'absolute',
                     bottom: '-4px',
                     left: '-4px',
                     width: '8px',
                     height: '8px',
                     backgroundColor: '#007acc',
                     cursor: 'sw-resize',
                     borderRadius: '50%'
                   }}
                   onMouseDown={(e) => handleResize(e, 'sw')}
                 />
                 <div
                   style={{
                     position: 'absolute',
                     bottom: '-4px',
                     right: '-4px',
                     width: '8px',
                     height: '8px',
                     backgroundColor: '#007acc',
                     cursor: 'se-resize',
                     borderRadius: '50%'
                   }}
                   onMouseDown={(e) => handleResize(e, 'se')}
                 />

                 {/* Side handles - resize width/height only */}
                 <div
                   style={{
                     position: 'absolute',
                     top: '50%',
                     left: '-4px',
                     width: '8px',
                     height: '20px',
                     backgroundColor: '#007acc',
                     cursor: 'w-resize',
                     borderRadius: '4px',
                     transform: 'translateY(-50%)'
                   }}
                   onMouseDown={(e) => handleResize(e, 'w')}
                 />
                 <div
                   style={{
                     position: 'absolute',
                     top: '50%',
                     right: '-4px',
                     width: '8px',
                     height: '20px',
                     backgroundColor: '#007acc',
                     cursor: 'e-resize',
                     borderRadius: '4px',
                     transform: 'translateY(-50%)'
                   }}
                   onMouseDown={(e) => handleResize(e, 'e')}
                 />
                 <div
                   style={{
                     position: 'absolute',
                     top: '-4px',
                     left: '50%',
                     width: '20px',
                     height: '8px',
                     backgroundColor: '#007acc',
                     cursor: 'n-resize',
                     borderRadius: '4px',
                     transform: 'translateX(-50%)'
                   }}
                   onMouseDown={(e) => handleResize(e, 'n')}
                 />
                 <div
                   style={{
                     position: 'absolute',
                     bottom: '-4px',
                     left: '50%',
                     width: '20px',
                     height: '8px',
                     backgroundColor: '#007acc',
                     cursor: 's-resize',
                     borderRadius: '4px',
                     transform: 'translateX(-50%)'
                   }}
                   onMouseDown={(e) => handleResize(e, 's')}
                 />
               </>
             )}

             {/* Toolbar */}
             <div
               style={{
                 position: 'absolute',
                 top: '-40px',
                 left: '0',
                 display: 'flex',
                 gap: '4px',
                 backgroundColor: 'rgba(255, 255, 255, 0.95)',
                 padding: '4px',
                 borderRadius: '4px',
                 boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                 zIndex: 10
               }}
             >
               <button
                 onClick={() => setShowCaptionInput(true)}
                 style={{
                   padding: '4px',
                   backgroundColor: 'transparent',
                   border: 'none',
                   borderRadius: '2px',
                   cursor: 'pointer',
                   display: 'flex',
                   alignItems: 'center',
                   fontSize: '14px'
                 }}
                 title="Добавить подпись"
               >
                 <RiEditLine />
               </button>
               <button
                 onClick={() => setShowDrawing(true)}
                 style={{
                   padding: '4px',
                   backgroundColor: 'transparent',
                   border: 'none',
                   borderRadius: '2px',
                   cursor: 'pointer',
                   display: 'flex',
                   alignItems: 'center',
                   fontSize: '14px'
                 }}
                 title="Рисовать на изображении"
               >
                 <RiImageEditLine />
               </button>
               <button
                 onClick={() => setShowMeasurement(true)}
                 style={{
                   padding: '4px',
                   backgroundColor: 'transparent',
                   border: 'none',
                   borderRadius: '2px',
                   cursor: 'pointer',
                   display: 'flex',
                   alignItems: 'center',
                   fontSize: '14px'
                 }}
                 title="Измерить объекты"
               >
                 <RiRulerLine />
               </button>
               
               <button
                 onClick={() => {
                   if (deleteNode) deleteNode()
                 }}
                 style={{
                   padding: '4px',
                   backgroundColor: 'transparent',
                   border: 'none',
                   borderRadius: '2px',
                   cursor: 'pointer',
                   display: 'flex',
                   alignItems: 'center',
                   fontSize: '14px',
                   color: '#dc3545'
                 }}
                 title="Удалить изображение"
               >
                 <RiDeleteBinLine />
               </button>
             </div>
           </>
         )}
      </div>



      {/* Drawing modal */}
      {showDrawing && originalDimensions.current && (
        <DrawingCanvas
          width={originalDimensions.current.width}
          height={originalDimensions.current.height}
          displayWidth={width}
          displayHeight={height}
          initialImage={src}
          onSave={handleDrawingSave}
          onCancel={() => setShowDrawing(false)}
        />
      )}

      {/* Measurement modal */}
      {showMeasurement && (
        <MeasurementTool
          imageRef={imageRef}
          imageWidth={originalDimensions.current?.width || width}
          imageHeight={originalDimensions.current?.height || height}
          onClose={() => setShowMeasurement(false)}
        />
      )}

      {/* Signature modal */}
      {showSignature && (
        <SignatureTool
          onSave={handleSignatureSave}
          onCancel={() => setShowSignature(false)}
        />
      )}

      {/* Caption input modal */}
      {showCaptionInput && (
        <CaptionInput
          initialValue={caption || ''}
          onSave={(newCaption) => {
            updateAttributes({ caption: newCaption })
            setShowCaptionInput(false)
          }}
          onCancel={() => setShowCaptionInput(false)}
        />
      )}
      </IllustrationErrorBoundary>
    </NodeViewWrapper>
  )
})

export const IllustrationNode = Node.create({
  name: 'illustration',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => element.querySelector('img')?.getAttribute('src') || element.getAttribute('data-src') || null,
        renderHTML: attributes => attributes.src ? { 'data-src': attributes.src } : {},
      },
      alt: {
        default: null,
        parseHTML: element => element.querySelector('img')?.getAttribute('alt') || null,
        renderHTML: attributes => attributes.alt ? { 'data-alt': attributes.alt } : {},
      },
      title: {
        default: null,
        parseHTML: element => element.querySelector('img')?.getAttribute('title') || null,
        renderHTML: attributes => attributes.title ? { 'data-title': attributes.title } : {},
      },
      width: {
        default: null,
        parseHTML: element => {
          const img = element.querySelector('img')
          const widthAttr = img?.getAttribute('width') || element.getAttribute('data-width')
          return widthAttr ? parseInt(widthAttr, 10) : null
        },
        renderHTML: attributes => attributes.width ? { 'data-width': attributes.width } : {},
      },
      height: {
        default: null,
        parseHTML: element => {
          const img = element.querySelector('img')
          const heightAttr = img?.getAttribute('height') || element.getAttribute('data-height')
          return heightAttr ? parseInt(heightAttr, 10) : null
        },
        renderHTML: attributes => attributes.height ? { 'data-height': attributes.height } : {},
      },
      originalWidth: {
        default: null,
        parseHTML: element => {
          const originalWidth = element.getAttribute('data-original-width')
          return originalWidth ? parseInt(originalWidth, 10) : null
        },
        renderHTML: attributes => attributes.originalWidth ? { 'data-original-width': attributes.originalWidth } : {},
      },
      originalHeight: {
        default: null,
        parseHTML: element => {
          const originalHeight = element.getAttribute('data-original-height')
          return originalHeight ? parseInt(originalHeight, 10) : null
        },
        renderHTML: attributes => attributes.originalHeight ? { 'data-original-height': attributes.originalHeight } : {},
      },
      caption: {
        default: null,
        parseHTML: element => {
          const captionElement = element.querySelector('.caption')
          return captionElement?.textContent || element.getAttribute('data-caption') || null
        },
        renderHTML: attributes => attributes.caption ? { 'data-caption': attributes.caption } : {},
      },
      alignment: {
        default: 'left',
        parseHTML: element => element.getAttribute('data-alignment') || 'left',
        renderHTML: attributes => ({ 'data-alignment': attributes.alignment || 'left' }),
      },
      textWrap: {
        default: 'none',
        parseHTML: element => element.getAttribute('data-text-wrap') || 'none',
        renderHTML: attributes => ({ 'data-text-wrap': attributes.textWrap || 'none' }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="illustration"]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false
          
          const img = element.querySelector('img')
          if (!img) return false

          // Return null to let individual attribute parsing methods handle the attributes
          return null
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    // Get attributes from the node (this is the source of truth)
    const nodeAttrs = node?.attrs || {}
    
    // Create safe attributes object
    const safeAttributes = {
      src: nodeAttrs.src || '',
      alt: nodeAttrs.alt || '',
      title: nodeAttrs.title || '',
      width: nodeAttrs.width || null,
      height: nodeAttrs.height || null,
      caption: nodeAttrs.caption || '',
      alignment: nodeAttrs.alignment || 'left',
      textWrap: nodeAttrs.textWrap || 'none'
    }
    
    // Build img attributes
    const imgAttrs: any = {
      src: safeAttributes.src
    }
    
    if (safeAttributes.alt) imgAttrs.alt = safeAttributes.alt
    if (safeAttributes.title) imgAttrs.title = safeAttributes.title
    if (safeAttributes.width) imgAttrs.width = safeAttributes.width
    if (safeAttributes.height) imgAttrs.height = safeAttributes.height

    // Only render the image in HTML - caption is handled by React component
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'illustration',
      }),
      ['img', imgAttrs]
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(IllustrationNodeView, {
      stopEvent: () => true,
    })
  },

  addCommands() {
    return {
      insertIllustration: (attributes = {}) => ({ commands }: { commands: any }) => {
        return commands.insertContent({
          type: this.name,
          attrs: attributes,
        })
      },
      updateIllustration: (attributes = {}) => ({ commands }: { commands: any }) => {
        return commands.updateAttributes(this.name, attributes)
      },
    } as any
  },


})