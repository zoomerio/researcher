/**
 * Virtualized List Components
 * Implements react-window for efficient rendering of large lists
 */

import React from 'react';
import { FixedSizeList as List, VariableSizeList, ListChildComponentProps } from 'react-window';
import { memoizeComponent, shallowEqual } from '../../utils/memoization';
import { usePerformanceMonitor } from '../../hooks/useOptimizedState';

interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemHeight: number | ((index: number) => number);
  width?: number | string;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  onItemsRendered?: (startIndex: number, endIndex: number) => void;
  className?: string;
  overscanCount?: number;
}

// Memoized list item wrapper
const MemoizedListItem = memoizeComponent(
  <T,>({ 
    index, 
    style, 
    data 
  }: ListChildComponentProps & { 
    data: { 
      items: T[]; 
      renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode; 
    } 
  }) => {
    const { items, renderItem } = data;
    const item = items[index];
    
    return (
      <div style={style}>
        {renderItem(item, index, style)}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.index === nextProps.index &&
      prevProps.style === nextProps.style &&
      prevProps.data.items[prevProps.index] === nextProps.data.items[nextProps.index]
    );
  }
);

// Fixed size virtualized list
export const VirtualizedFixedList = memoizeComponent(
  <T,>({
    items,
    height,
    itemHeight,
    width = '100%',
    renderItem,
    onItemsRendered,
    className,
    overscanCount = 5
  }: VirtualizedListProps<T> & { itemHeight: number }) => {
    usePerformanceMonitor('VirtualizedFixedList');
    
    const itemData = React.useMemo(() => ({
      items,
      renderItem
    }), [items, renderItem]);

    const handleItemsRendered = React.useCallback(
      ({ visibleStartIndex, visibleStopIndex }: any) => {
        onItemsRendered?.(visibleStartIndex, visibleStopIndex);
      },
      [onItemsRendered]
    );

    return (
      <div className={className}>
        <List
          height={height}
          itemCount={items.length}
          itemSize={itemHeight}
          width={width}
          itemData={itemData}
          onItemsRendered={handleItemsRendered}
          overscanCount={overscanCount}
        >
          {MemoizedListItem}
        </List>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.items === nextProps.items &&
      prevProps.height === nextProps.height &&
      prevProps.itemHeight === nextProps.itemHeight &&
      prevProps.width === nextProps.width &&
      prevProps.renderItem === nextProps.renderItem &&
      prevProps.className === nextProps.className &&
      prevProps.overscanCount === nextProps.overscanCount
    );
  }
);

// Variable size virtualized list
export const VirtualizedVariableList = memoizeComponent(
  <T,>({
    items,
    height,
    itemHeight,
    width = '100%',
    renderItem,
    onItemsRendered,
    className,
    overscanCount = 5
  }: VirtualizedListProps<T> & { itemHeight: (index: number) => number }) => {
    usePerformanceMonitor('VirtualizedVariableList');
    
    const itemData = React.useMemo(() => ({
      items,
      renderItem
    }), [items, renderItem]);

    const handleItemsRendered = React.useCallback(
      ({ visibleStartIndex, visibleStopIndex }: any) => {
        onItemsRendered?.(visibleStartIndex, visibleStopIndex);
      },
      [onItemsRendered]
    );

    return (
      <div className={className}>
        <VariableSizeList
          height={height}
          itemCount={items.length}
          itemSize={itemHeight}
          width={width}
          itemData={itemData}
          onItemsRendered={handleItemsRendered}
          overscanCount={overscanCount}
        >
          {MemoizedListItem}
        </VariableSizeList>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.items === nextProps.items &&
      prevProps.height === nextProps.height &&
      prevProps.itemHeight === nextProps.itemHeight &&
      prevProps.width === nextProps.width &&
      prevProps.renderItem === nextProps.renderItem &&
      prevProps.className === nextProps.className &&
      prevProps.overscanCount === nextProps.overscanCount
    );
  }
);

// Virtualized table component
interface VirtualizedTableProps<T> {
  items: T[];
  columns: Array<{
    key: keyof T;
    title: string;
    width?: number;
    render?: (value: any, item: T, index: number) => React.ReactNode;
  }>;
  height: number;
  rowHeight: number;
  headerHeight?: number;
  className?: string;
}

export const VirtualizedTable = memoizeComponent(
  <T extends Record<string, any>>({
    items,
    columns,
    height,
    rowHeight,
    headerHeight = 40,
    className
  }: VirtualizedTableProps<T>) => {
    usePerformanceMonitor('VirtualizedTable');
    
    const renderRow = React.useCallback(
      (item: T, index: number, style: React.CSSProperties) => (
        <div className="virtual-table-row" style={style}>
          {columns.map((column, colIndex) => {
            const value = item[column.key];
            const content = column.render ? column.render(value, item, index) : value;
            
            return (
              <div
                key={colIndex}
                className="virtual-table-cell"
                style={{ width: column.width || 'auto' }}
              >
                {content}
              </div>
            );
          })}
        </div>
      ),
      [columns]
    );

    return (
      <div className={`virtual-table ${className || ''}`}>
        <div className="virtual-table-header" style={{ height: headerHeight }}>
          {columns.map((column, index) => (
            <div
              key={index}
              className="virtual-table-header-cell"
              style={{ width: column.width || 'auto' }}
            >
              {column.title}
            </div>
          ))}
        </div>
        <VirtualizedFixedList
          items={items}
          height={height - headerHeight}
          itemHeight={rowHeight}
          renderItem={renderRow}
          className="virtual-table-body"
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.items === nextProps.items &&
      shallowEqual(prevProps.columns, nextProps.columns) &&
      prevProps.height === nextProps.height &&
      prevProps.rowHeight === nextProps.rowHeight &&
      prevProps.headerHeight === nextProps.headerHeight &&
      prevProps.className === nextProps.className
    );
  }
);

// Virtualized grid component for complex layouts
interface VirtualizedGridProps<T> {
  items: T[];
  columnCount: number;
  height: number;
  itemWidth: number;
  itemHeight: number;
  renderItem: (item: T, rowIndex: number, colIndex: number, style: React.CSSProperties) => React.ReactNode;
  className?: string;
}

export const VirtualizedGrid = memoizeComponent(
  <T,>({
    items,
    columnCount,
    height,
    itemWidth,
    itemHeight,
    renderItem,
    className
  }: VirtualizedGridProps<T>) => {
    usePerformanceMonitor('VirtualizedGrid');
    
    const rowCount = Math.ceil(items.length / columnCount);
    
    const renderGridItem = React.useCallback(
      (rowIndex: number, style: React.CSSProperties) => {
        const startIndex = rowIndex * columnCount;
        const endIndex = Math.min(startIndex + columnCount, items.length);
        
        return (
          <div style={style} className="virtual-grid-row">
            {Array.from({ length: endIndex - startIndex }, (_, colIndex) => {
              const itemIndex = startIndex + colIndex;
              const item = items[itemIndex];
              
              if (!item) return null;
              
              return (
                <div
                  key={colIndex}
                  style={{
                    width: itemWidth,
                    height: itemHeight,
                    display: 'inline-block'
                  }}
                >
                  {renderItem(item, rowIndex, colIndex, {
                    width: itemWidth,
                    height: itemHeight
                  })}
                </div>
              );
            })}
          </div>
        );
      },
      [items, columnCount, itemWidth, itemHeight, renderItem]
    );

    return (
      <div className={`virtual-grid ${className || ''}`}>
        <VirtualizedFixedList
          items={Array.from({ length: rowCount }, (_, i) => i)}
          height={height}
          itemHeight={itemHeight}
          renderItem={renderGridItem}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.items === nextProps.items &&
      prevProps.columnCount === nextProps.columnCount &&
      prevProps.height === nextProps.height &&
      prevProps.itemWidth === nextProps.itemWidth &&
      prevProps.itemHeight === nextProps.itemHeight &&
      prevProps.renderItem === nextProps.renderItem &&
      prevProps.className === nextProps.className
    );
  }
);
