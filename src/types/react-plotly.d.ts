declare module 'react-plotly.js' {
  import { Component } from 'react'
  
  interface PlotParams {
    data: any[]
    layout?: any
    config?: any
    frames?: any[]
    revision?: number
    onInitialized?: (figure: any, graphDiv: HTMLElement) => void
    onUpdate?: (figure: any, graphDiv: HTMLElement) => void
    onPurge?: (figure: any, graphDiv: HTMLElement) => void
    onError?: (err: any) => void
    onBeforeExport?: () => void
    onAfterExport?: () => void
    onAnimatingFrame?: (event: any) => void
    onAnimated?: () => void
    onTransitioning?: () => void
    onTransitioned?: () => void
    onRelayout?: (event: any) => void
    onRedraw?: () => void
    onSelected?: (event: any) => void
    onSelecting?: (event: any) => void
    onDeselect?: () => void
    onDoubleClick?: () => void
    onClick?: (event: any) => void
    onHover?: (event: any) => void
    onUnhover?: (event: any) => void
    onWebGlContextLost?: () => void
    debug?: boolean
    useResizeHandler?: boolean
    style?: React.CSSProperties
    className?: string
    divId?: string
  }
  
  export default class Plot extends Component<PlotParams> {}
}

