/**
 * Optimized StarterKit Configuration
 * Reduces memory usage by disabling unnecessary extensions
 */

import StarterKit from '@tiptap/starter-kit';

/**
 * Optimized StarterKit with reduced plugins for better performance
 * Disables: blockquote, horizontalRule, dropcursor, gapcursor
 * Reduces: heading levels from 6 to 4
 */
export const OptimizedStarterKit = StarterKit.configure({
  // Disable unnecessary extensions to save memory
  blockquote: false,        // Not commonly used in scientific text
  horizontalRule: false,    // Rarely used
  dropcursor: false,        // Not essential for functionality
  gapcursor: false,         // Not essential for functionality
  
  // Optimize remaining extensions
  heading: {
    levels: [1, 2, 3, 4],    // Reduced from [1,2,3,4,5,6] to save memory
  },
  
  // Keep essential extensions with default settings
  // document: true,          // Required
  // paragraph: true,         // Required
  // text: true,              // Required
  // bold: true,              // Common formatting
  // italic: true,            // Common formatting
  // strike: true,            // Common formatting
  // code: true,              // Useful for scientific text
  // codeBlock: true,         // Useful for scientific text
  // bulletList: true,        // Essential for lists
  // orderedList: true,       // Essential for lists
  // listItem: true,          // Essential for lists
  // hardBreak: true,         // Essential for line breaks
  // history: true,           // Essential for undo/redo (note: can't configure depth here)
});

/**
 * Minimal StarterKit for maximum performance
 * Only includes absolute essentials
 */
export const MinimalStarterKit = StarterKit.configure({
  // Disable most extensions for minimal setup
  blockquote: false,
  horizontalRule: false,
  dropcursor: false,
  gapcursor: false,
  codeBlock: false,
  strike: false,
  bulletList: false,
  orderedList: false,
  listItem: false,
  heading: false,
  
  // Keep only the bare minimum
  // document: true,          // Required
  // paragraph: true,         // Required
  // text: true,              // Required
  // bold: true,              // Basic formatting
  // italic: true,            // Basic formatting
  // code: true,              // Inline code
  // hardBreak: true,         // Line breaks
  // history: true,           // Undo/redo
});

/**
 * Scientific document optimized kit
 * Includes features commonly used in scientific writing
 */
export const ScientificStarterKit = StarterKit.configure({
  // Disable unnecessary extensions
  blockquote: false,        // Not common in scientific papers
  horizontalRule: false,    // Not common in scientific papers
  dropcursor: false,        // Not essential
  gapcursor: false,         // Not essential
  
  // Configure for scientific writing
  heading: {
    levels: [1, 2, 3, 4],    // Scientific papers typically use 4 levels max
  },
  
  // Keep all other extensions for full scientific writing support
  // codeBlock: true,         // For code examples
  // bulletList: true,        // For lists
  // orderedList: true,       // For numbered lists
  // listItem: true,          // Required for lists
  // bold: true,              // Emphasis
  // italic: true,            // Emphasis
  // strike: true,            // Corrections
  // code: true,              // Inline code
  // hardBreak: true,         // Line breaks
  // history: true,           // Undo/redo
});

export default OptimizedStarterKit;

