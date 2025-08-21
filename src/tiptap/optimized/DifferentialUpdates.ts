/**
 * Differential Content Updates System
 * Implements efficient content updates instead of complete reinstalls
 */

import React from 'react';
import { Editor } from '@tiptap/core';
import { Transaction } from 'prosemirror-state';
import { Step } from 'prosemirror-transform';

interface ContentDiff {
  type: 'insert' | 'delete' | 'replace' | 'attribute';
  position: number;
  length?: number;
  content?: any;
  attributes?: Record<string, any>;
  oldContent?: any;
}

interface UpdateBatch {
  id: string;
  timestamp: number;
  diffs: ContentDiff[];
  applied: boolean;
}

/**
 * Differential Update Manager
 * Manages efficient content updates using ProseMirror's step system
 */
export class DifferentialUpdateManager {
  private editor: Editor;
  private updateQueue: UpdateBatch[] = [];
  private isProcessing = false;
  private batchTimeout: NodeJS.Timeout | null = null;
  private currentBatch: ContentDiff[] = [];
  
  // Configuration
  private readonly BATCH_DELAY = 100; // ms to wait before processing batch
  private readonly MAX_BATCH_SIZE = 50; // maximum operations per batch
  private readonly MAX_QUEUE_SIZE = 100; // maximum batches in queue

  constructor(editor: Editor) {
    this.editor = editor;
    this.setupTransactionListener();
  }

  /**
   * Set up transaction listener to capture changes
   */
  private setupTransactionListener() {
    this.editor.on('transaction', ({ transaction }) => {
      if (transaction.docChanged) {
        this.processTransaction(transaction);
      }
    });
  }

  /**
   * Process a ProseMirror transaction into differential updates
   */
  private processTransaction(transaction: Transaction) {
    const diffs: ContentDiff[] = [];
    
    transaction.steps.forEach((step, index) => {
      const diff = this.stepToDiff(step, transaction);
      if (diff) {
        diffs.push(diff);
      }
    });

    if (diffs.length > 0) {
      this.addToBatch(diffs);
    }
  }

  /**
   * Convert ProseMirror step to ContentDiff
   */
  private stepToDiff(step: Step, transaction: Transaction): ContentDiff | null {
    const stepJSON = step.toJSON();
    
    switch (stepJSON.stepType) {
      case 'replace':
        return {
          type: 'replace',
          position: stepJSON.from,
          length: stepJSON.to - stepJSON.from,
          content: stepJSON.slice,
          oldContent: transaction.before.slice(stepJSON.from, stepJSON.to)
        };
        
      case 'replaceAround':
        return {
          type: 'replace',
          position: stepJSON.from,
          length: stepJSON.to - stepJSON.from,
          content: stepJSON.slice,
          oldContent: transaction.before.slice(stepJSON.from, stepJSON.to)
        };
        
      case 'addMark':
      case 'removeMark':
        return {
          type: 'attribute',
          position: stepJSON.from,
          length: stepJSON.to - stepJSON.from,
          attributes: { mark: stepJSON.mark }
        };
        
      default:
        // Handle other step types as generic replacements
        return {
          type: 'replace',
          position: stepJSON.from || 0,
          length: (stepJSON.to || 0) - (stepJSON.from || 0),
          content: stepJSON.slice || null
        };
    }
  }

  /**
   * Add diffs to current batch
   */
  private addToBatch(diffs: ContentDiff[]) {
    this.currentBatch.push(...diffs);
    
    // Process batch if it's getting too large
    if (this.currentBatch.length >= this.MAX_BATCH_SIZE) {
      this.processBatch();
      return;
    }
    
    // Set up delayed batch processing
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = setTimeout(() => {
      this.processBatch();
    }, this.BATCH_DELAY);
  }

  /**
   * Process current batch of diffs
   */
  private processBatch() {
    if (this.currentBatch.length === 0) return;
    
    const batch: UpdateBatch = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      diffs: [...this.currentBatch],
      applied: false
    };
    
    this.currentBatch = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    this.addToQueue(batch);
  }

  /**
   * Add batch to processing queue
   */
  private addToQueue(batch: UpdateBatch) {
    this.updateQueue.push(batch);
    
    // Limit queue size
    if (this.updateQueue.length > this.MAX_QUEUE_SIZE) {
      this.updateQueue.shift(); // Remove oldest batch
    }
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process update queue
   */
  private async processQueue() {
    if (this.isProcessing || this.updateQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.updateQueue.length > 0) {
      const batch = this.updateQueue.shift()!;
      await this.applyBatch(batch);
    }
    
    this.isProcessing = false;
  }

  /**
   * Apply a batch of updates
   */
  private async applyBatch(batch: UpdateBatch) {
    try {
      // Optimize diffs before applying
      const optimizedDiffs = this.optimizeDiffs(batch.diffs);
      
      // Apply optimizations based on diff types
      for (const diff of optimizedDiffs) {
        await this.applyDiff(diff);
      }
      
      batch.applied = true;
      
      // Emit event for external listeners
      this.editor.emit('differentialUpdate', { batch, diffs: optimizedDiffs });
      
    } catch (error) {
      console.error('Error applying differential update batch:', error);
    }
  }

  /**
   * Optimize diffs by merging adjacent operations
   */
  private optimizeDiffs(diffs: ContentDiff[]): ContentDiff[] {
    if (diffs.length <= 1) return diffs;
    
    const optimized: ContentDiff[] = [];
    let current = diffs[0];
    
    for (let i = 1; i < diffs.length; i++) {
      const next = diffs[i];
      
      // Try to merge adjacent operations
      const merged = this.tryMergeDiffs(current, next);
      if (merged) {
        current = merged;
      } else {
        optimized.push(current);
        current = next;
      }
    }
    
    optimized.push(current);
    return optimized;
  }

  /**
   * Try to merge two adjacent diffs
   */
  private tryMergeDiffs(a: ContentDiff, b: ContentDiff): ContentDiff | null {
    // Only merge same type operations
    if (a.type !== b.type) return null;
    
    // Check if operations are adjacent
    const aEnd = a.position + (a.length || 0);
    if (aEnd !== b.position) return null;
    
    switch (a.type) {
      case 'insert':
        return {
          type: 'insert',
          position: a.position,
          content: this.mergeContent(a.content, b.content)
        };
        
      case 'delete':
        return {
          type: 'delete',
          position: a.position,
          length: (a.length || 0) + (b.length || 0)
        };
        
      case 'replace':
        return {
          type: 'replace',
          position: a.position,
          length: (a.length || 0) + (b.length || 0),
          content: this.mergeContent(a.content, b.content),
          oldContent: this.mergeContent(a.oldContent, b.oldContent)
        };
        
      default:
        return null;
    }
  }

  /**
   * Merge content from two diffs
   */
  private mergeContent(a: any, b: any): any {
    if (!a) return b;
    if (!b) return a;
    
    // Simple concatenation for now
    // In a real implementation, this would handle ProseMirror fragments properly
    return a + b;
  }

  /**
   * Apply a single diff
   */
  private async applyDiff(diff: ContentDiff) {
    // This is where you would apply optimizations based on diff type
    // For example:
    
    switch (diff.type) {
      case 'insert':
        await this.optimizeInsert(diff);
        break;
        
      case 'delete':
        await this.optimizeDelete(diff);
        break;
        
      case 'replace':
        await this.optimizeReplace(diff);
        break;
        
      case 'attribute':
        await this.optimizeAttribute(diff);
        break;
    }
  }

  /**
   * Optimize insert operations
   */
  private async optimizeInsert(diff: ContentDiff) {
    // Batch DOM insertions
    // Use document fragments for multiple insertions
    // Defer non-critical updates
    console.log('Optimizing insert at position', diff.position);
  }

  /**
   * Optimize delete operations
   */
  private async optimizeDelete(diff: ContentDiff) {
    // Batch DOM deletions
    // Clean up associated resources (images, etc.)
    console.log('Optimizing delete at position', diff.position, 'length', diff.length);
  }

  /**
   * Optimize replace operations
   */
  private async optimizeReplace(diff: ContentDiff) {
    // Use efficient DOM replacement strategies
    // Preserve unchanged elements
    console.log('Optimizing replace at position', diff.position);
  }

  /**
   * Optimize attribute changes
   */
  private async optimizeAttribute(diff: ContentDiff) {
    // Batch attribute updates
    // Use CSS classes instead of inline styles where possible
    console.log('Optimizing attributes at position', diff.position);
  }

  /**
   * Get current queue status
   */
  public getQueueStatus() {
    return {
      queueLength: this.updateQueue.length,
      currentBatchSize: this.currentBatch.length,
      isProcessing: this.isProcessing,
      hasPendingBatch: this.batchTimeout !== null
    };
  }

  /**
   * Force process current batch
   */
  public flushBatch() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.processBatch();
  }

  /**
   * Clear all pending updates
   */
  public clearQueue() {
    this.updateQueue = [];
    this.currentBatch = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /**
   * Cleanup
   */
  public destroy() {
    this.clearQueue();
    this.editor.off('transaction');
  }
}

/**
 * Hook for using differential updates in React components
 */
export function useDifferentialUpdates(editor: Editor | null) {
  const [manager, setManager] = React.useState<DifferentialUpdateManager | null>(null);
  const [queueStatus, setQueueStatus] = React.useState({
    queueLength: 0,
    currentBatchSize: 0,
    isProcessing: false,
    hasPendingBatch: false
  });

  React.useEffect(() => {
    if (!editor) return;

    const updateManager = new DifferentialUpdateManager(editor);
    setManager(updateManager);

    // Update status periodically
    const statusInterval = setInterval(() => {
      setQueueStatus(updateManager.getQueueStatus());
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      updateManager.destroy();
    };
  }, [editor]);

  return {
    manager,
    queueStatus,
    flushBatch: () => manager?.flushBatch(),
    clearQueue: () => manager?.clearQueue(),
  };
}
