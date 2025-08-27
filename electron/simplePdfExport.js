import { dialog } from 'electron';
import { promises as fs } from 'fs';

/**
 * Simple, reliable PDF export function
 * @param {BrowserWindow} targetWindow - The window containing the content to export
 * @returns {Promise<{canceled: boolean, filePath?: string}>}
 */
export async function exportPdfSimple(targetWindow) {
  console.log('[Simple PDF] Starting PDF export...');
  
  if (!targetWindow) {
    console.error('[Simple PDF] No target window provided');
    return { canceled: true };
  }

  try {
    // Show save dialog first
    console.log('[Simple PDF] Showing save dialog...');
    const { canceled, filePath } = await dialog.showSaveDialog(targetWindow, {
      title: 'Export to PDF',
      defaultPath: 'document.pdf',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      console.log('[Simple PDF] Save dialog canceled');
      return { canceled: true };
    }

    console.log('[Simple PDF] Selected file path:', filePath);

    // Generate PDF directly from the current window content
    console.log('[Simple PDF] Generating PDF...');
    const pdfBuffer = await targetWindow.webContents.printToPDF({
      landscape: false,
      marginsType: 1, // Default margins
      pageSize: 'A4',
      printBackground: true,
      scaleFactor: 100,
      preferCSSPageSize: true, // Respect CSS page breaks
    });

    console.log('[Simple PDF] PDF generated, size:', pdfBuffer.length, 'bytes');

    // Write the file
    console.log('[Simple PDF] Writing file...');
    await fs.writeFile(filePath, pdfBuffer);
    
    // Verify the file was created
    const stats = await fs.stat(filePath);
    console.log('[Simple PDF] File created successfully, size:', stats.size, 'bytes');

    return { canceled: false, filePath };
  } catch (error) {
    console.error('[Simple PDF] Error:', error);
    dialog.showErrorBox('PDF Export Error', `Failed to export PDF: ${error.message}`);
    return { canceled: true };
  }
}

/**
 * Enhanced PDF export with page break support
 * @param {BrowserWindow} targetWindow - The window containing the content to export
 * @returns {Promise<{canceled: boolean, filePath?: string}>}
 */
export async function exportPdfWithPageBreaks(targetWindow) {
  console.log('[Enhanced PDF] Starting enhanced PDF export...');
  
  if (!targetWindow) {
    console.error('[Enhanced PDF] No target window provided');
    return { canceled: true };
  }

  try {
    // First, let's debug what content is actually available
    console.log('[Enhanced PDF] Debugging content availability...');
    const debugInfo = await targetWindow.webContents.executeJavaScript(`
      (() => {
        const proseMirror = document.querySelector('.ProseMirror');
        const editorContent = document.querySelector('.ProseMirror-focused') || proseMirror;
        const stickyTools = document.querySelector('.sticky-tools');
        const viewMode = document.querySelector('.view-mode');
        
        console.log('[PDF Debug] ProseMirror element:', !!proseMirror);
        console.log('[PDF Debug] ProseMirror content length:', proseMirror ? proseMirror.innerHTML.length : 0);
        console.log('[PDF Debug] View mode element:', !!viewMode);
        console.log('[PDF Debug] View mode content length:', viewMode ? viewMode.innerHTML.length : 0);
        console.log('[PDF Debug] Sticky tools element:', !!stickyTools);
        console.log('[PDF Debug] Document body children count:', document.body.children.length);
        
        // Return debug info
        return {
          hasProseMirror: !!proseMirror,
          hasViewMode: !!viewMode,
          contentLength: proseMirror ? proseMirror.innerHTML.length : 0,
          viewModeContentLength: viewMode ? viewMode.innerHTML.length : 0,
          hasStickyTools: !!stickyTools,
          bodyChildrenCount: document.body.children.length,
          proseMirrorContent: proseMirror ? proseMirror.innerHTML.substring(0, 200) : 'No content',
          viewModeContent: viewMode ? viewMode.innerHTML.substring(0, 200) : 'No view mode content'
        };
      })();
    `);
    
    console.log('[Enhanced PDF] Debug info:', debugInfo);
    
    if ((!debugInfo.hasProseMirror || debugInfo.contentLength === 0) && (!debugInfo.hasViewMode || debugInfo.viewModeContentLength === 0)) {
      throw new Error('No editor content found to export');
    }

    // Clear any active selections and blur the editor to remove cursor
    console.log('[Enhanced PDF] Clearing selections and blurring editor...');
    await targetWindow.webContents.executeJavaScript(`
      (() => {
        // Clear any text selections
        if (window.getSelection) {
          window.getSelection().removeAllRanges();
        }
        
        // Clear document selection
        if (document.getSelection) {
          document.getSelection().removeAllRanges();
        }
        
        // Blur the ProseMirror editor to remove cursor
        const proseMirror = document.querySelector('.ProseMirror');
        if (proseMirror) {
          proseMirror.blur();
          // Remove focus from any focused element
          if (document.activeElement) {
            document.activeElement.blur();
          }
        }
        
        // Remove any contenteditable focus
        const editableElements = document.querySelectorAll('[contenteditable="true"]');
        editableElements.forEach(el => el.blur());
        
        console.log('[PDF] Cleared selections and blurred editor');
      })()
    `);

    // Inject minimal CSS - hide UI elements and cursor
    console.log('[Enhanced PDF] Injecting minimal CSS...');
    await targetWindow.webContents.insertCSS(`
      @media print {
        /* Hide UI elements */
        .tool-tabs {
          display: none !important;
        }
        
        /* Hide cursor and selection indicators - comprehensive approach */
        .ProseMirror-cursor,
        .ProseMirror-selection,
        .ProseMirror-selectednode,
        .ProseMirror-gapcursor,
        .ProseMirror-dropcursor,
        .ProseMirror-widget,
        .ProseMirror-decoration,
        .ProseMirror::after,
        .ProseMirror::before {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          width: 0 !important;
          height: 0 !important;
        }
        
        /* Remove any cursor/caret from contenteditable elements */
        *[contenteditable="true"] {
          caret-color: transparent !important;
        }
        
        /* Hide any blinking cursor */
        * {
          caret-color: transparent !important;
        }
        
        /* Ensure ProseMirror content is visible and properly styled */
        .ProseMirror {
          display: block !important;
          visibility: visible !important;
          color: #000 !important;
          background: #fff !important;
        }
        
        /* Ensure view mode content is visible and properly styled */
        .view-mode {
          display: block !important;
          visibility: visible !important;
          color: #000 !important;
          background: #fff !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        
        /* Ensure A4 canvas maintains its padding for EDIT mode exports */
        .a4-canvas {
          padding: 32px !important;
          margin: 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
          background: #fff !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        
        /* Ensure proper text wrapping in PDF - match editor exactly */
        .view-mode .ProseMirror,
        .ProseMirror,
        .view-mode * {
          overflow-wrap: break-word !important;
          word-wrap: break-word !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          /* Remove word-break: break-word as it might cause different wrapping */
        }
        
        /* Ensure exact font rendering match */
        body, .view-mode, .ProseMirror {
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif !important;
          font-size: 16px !important;
          line-height: 1.6 !important;
          letter-spacing: normal !important;
          word-spacing: normal !important;
        }
      }
    `);

         // Get document title for filename
     console.log('[Enhanced PDF] Getting document title...');
     const documentTitle = await targetWindow.webContents.executeJavaScript(`
       (() => {
         // Try to get the document title from app state
         if (typeof window !== 'undefined' && window.appState && window.appState.activeTab) {
           const activeTab = window.appState.activeTab;
           if (activeTab.type === 'doc' && activeTab.data && activeTab.data.meta) {
             return activeTab.data.meta.title || activeTab.title;
           }
           return activeTab.title;
         }
         return null;
       })()
     `);
     
     const defaultFilename = documentTitle ? `${documentTitle}.pdf` : 'document.pdf';
     console.log('[Enhanced PDF] Using filename:', defaultFilename);

     // Show save dialog
     console.log('[Enhanced PDF] Showing save dialog...');
     const { canceled, filePath } = await dialog.showSaveDialog(targetWindow, {
       title: 'Export to PDF',
       defaultPath: defaultFilename,
       filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
     });

    if (canceled || !filePath) {
      console.log('[Enhanced PDF] Save dialog canceled');
      return { canceled: true };
    }

    console.log('[Enhanced PDF] Selected file path:', filePath);

    // Generate PDF with CSS page breaks
    console.log('[Enhanced PDF] Generating PDF with page breaks...');
    const pdfBuffer = await targetWindow.webContents.printToPDF({
      landscape: false,
      marginsType: 3, // Custom margins
      margins: {
        top: 0, // Zero margins - let A4 canvas padding handle spacing
        bottom: 0,
        left: 0,
        right: 0
      },
      pageSize: 'A4',
      printBackground: true,
      scaleFactor: 100,
      preferCSSPageSize: true,
    });

    console.log('[Enhanced PDF] PDF generated, size:', pdfBuffer.length, 'bytes');

    // Write the file
    console.log('[Enhanced PDF] Writing file...');
    await fs.writeFile(filePath, pdfBuffer);
    
    // Verify the file was created
    const stats = await fs.stat(filePath);
    console.log('[Enhanced PDF] File created successfully, size:', stats.size, 'bytes');

    return { canceled: false, filePath };
  } catch (error) {
    console.error('[Enhanced PDF] Error:', error);
    dialog.showErrorBox('PDF Export Error', `Failed to export PDF: ${error.message}`);
    return { canceled: true };
  }
}
