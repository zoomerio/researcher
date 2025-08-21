/**
 * Lightweight Image Node
 * Stores file paths and metadata instead of base64 data to reduce memory usage
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect, useRef } from 'react';
import { memoryMonitor } from '../../utils/memoryMonitor';

interface LightweightImageAttributes {
  src: string; // File path instead of base64
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  originalWidth?: number;
  originalHeight?: number;
  fileSize?: number;
  lastModified?: number;
  thumbnailPath?: string; // Path to thumbnail for quick loading
  imageId?: string; // Unique identifier for caching
}

// Image cache to avoid reloading the same images
class ImageCache {
  private static instance: ImageCache;
  private cache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  static getInstance(): ImageCache {
    if (!ImageCache.instance) {
      ImageCache.instance = new ImageCache();
    }
    return ImageCache.instance;
  }

  async getImage(src: string): Promise<HTMLImageElement> {
    // Check cache first
    if (this.cache.has(src)) {
      return this.cache.get(src)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    // Load image
    const loadPromise = this.loadImage(src);
    this.loadingPromises.set(src, loadPromise);

    try {
      const img = await loadPromise;
      this.cache.set(src, img);
      this.loadingPromises.delete(src);
      return img;
    } catch (error) {
      this.loadingPromises.delete(src);
      throw error;
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  invalidate(src: string) {
    this.cache.delete(src);
    this.loadingPromises.delete(src);
  }

  clear() {
    this.cache.clear();
    this.loadingPromises.clear();
  }
}

// Lightweight image view component
const LightweightImageView = React.memo(({ node, updateAttributes }: any) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    src, 
    alt, 
    title, 
    width, 
    height, 
    originalWidth, 
    originalHeight,
    fileSize,
    thumbnailPath,
    imageId 
  } = node.attrs;

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load image when visible
  useEffect(() => {
    if (!isVisible || isLoaded || isError) return;

    const loadImage = async () => {
      try {
        memoryMonitor.logOperation('Image Load Start', () => {
          console.log(`Loading image: ${src}`);
        });

        const cache = ImageCache.getInstance();
        await cache.getImage(src);
        setIsLoaded(true);

        memoryMonitor.logOperation('Image Load Complete', () => {
          console.log(`Image loaded successfully: ${src}`);
        });
      } catch (error) {
        console.error('Error loading image:', error);
        setIsError(true);
      }
    };

    loadImage();
  }, [isVisible, src, isLoaded, isError]);

  if (isError) {
    return (
      <NodeViewWrapper>
        <div 
          ref={containerRef}
          className="image-error" 
          style={{ 
            padding: '20px', 
            border: '1px dashed #ccc', 
            textAlign: 'center',
            color: '#666',
            width: width || 200,
            height: height || 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div>
            <div>Failed to load image</div>
            <div style={{ fontSize: '12px', marginTop: '5px' }}>
              {alt || title || 'Image'}
            </div>
            {fileSize && (
              <div style={{ fontSize: '10px', marginTop: '5px' }}>
                Size: {(fileSize / 1024).toFixed(1)}KB
              </div>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  if (!isVisible || !isLoaded) {
    return (
      <NodeViewWrapper>
        <div 
          ref={containerRef}
          className="image-placeholder" 
          style={{ 
            width: width || originalWidth || 200, 
            height: height || originalHeight || 150, 
            backgroundColor: '#f8f9fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #dee2e6',
            borderRadius: '4px'
          }}
        >
          {thumbnailPath ? (
            <img 
              src={thumbnailPath} 
              alt={alt || 'Image thumbnail'}
              style={{ maxWidth: '100%', maxHeight: '100%', opacity: 0.7 }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#666' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>🖼️</div>
              <div>{isVisible ? 'Loading...' : 'Image'}</div>
              {fileSize && (
                <div style={{ fontSize: '10px', marginTop: '5px' }}>
                  {(fileSize / 1024).toFixed(1)}KB
                </div>
              )}
            </div>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <img
        src={src}
        alt={alt || ''}
        title={title || ''}
        width={width}
        height={height}
        style={{
          maxWidth: '100%',
          height: 'auto',
          display: 'block',
          margin: '0 auto'
        }}
        onLoad={() => {
          memoryMonitor.logOperation('Image Render Complete', () => {
            console.log(`Image rendered: ${src}`);
          });
        }}
      />
    </NodeViewWrapper>
  );
});

export const LightweightImageNode = Node.create<{}>({
  name: 'lightweightImage',
  
  group: 'block',
  
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => element.getAttribute('src'),
        renderHTML: attributes => attributes.src ? { src: attributes.src } : {},
      },
      alt: {
        default: null,
        parseHTML: element => element.getAttribute('alt'),
        renderHTML: attributes => attributes.alt ? { alt: attributes.alt } : {},
      },
      title: {
        default: null,
        parseHTML: element => element.getAttribute('title'),
        renderHTML: attributes => attributes.title ? { title: attributes.title } : {},
      },
      width: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('width');
          return width ? parseInt(width, 10) : null;
        },
        renderHTML: attributes => attributes.width ? { width: attributes.width } : {},
      },
      height: {
        default: null,
        parseHTML: element => {
          const height = element.getAttribute('height');
          return height ? parseInt(height, 10) : null;
        },
        renderHTML: attributes => attributes.height ? { height: attributes.height } : {},
      },
      originalWidth: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('data-original-width');
          return width ? parseInt(width, 10) : null;
        },
        renderHTML: attributes => attributes.originalWidth ? { 'data-original-width': attributes.originalWidth } : {},
      },
      originalHeight: {
        default: null,
        parseHTML: element => {
          const height = element.getAttribute('data-original-height');
          return height ? parseInt(height, 10) : null;
        },
        renderHTML: attributes => attributes.originalHeight ? { 'data-original-height': attributes.originalHeight } : {},
      },
      fileSize: {
        default: null,
        parseHTML: element => {
          const size = element.getAttribute('data-file-size');
          return size ? parseInt(size, 10) : null;
        },
        renderHTML: attributes => attributes.fileSize ? { 'data-file-size': attributes.fileSize } : {},
      },
      lastModified: {
        default: null,
        parseHTML: element => {
          const modified = element.getAttribute('data-last-modified');
          return modified ? parseInt(modified, 10) : null;
        },
        renderHTML: attributes => attributes.lastModified ? { 'data-last-modified': attributes.lastModified } : {},
      },
      thumbnailPath: {
        default: null,
        parseHTML: element => element.getAttribute('data-thumbnail'),
        renderHTML: attributes => attributes.thumbnailPath ? { 'data-thumbnail': attributes.thumbnailPath } : {},
      },
      imageId: {
        default: null,
        parseHTML: element => element.getAttribute('data-image-id'),
        renderHTML: attributes => attributes.imageId ? { 'data-image-id': attributes.imageId } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { class: 'lightweight-image' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LightweightImageView);
  },

  addCommands() {
    return {
      setLightweightImage: (options: LightweightImageAttributes) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: {
            ...options,
            imageId: options.imageId || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          },
        });
      },
    };
  },
});
