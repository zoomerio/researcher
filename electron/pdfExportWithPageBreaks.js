import { BrowserWindow, dialog } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Enhanced PDF export that handles page breaks by splitting content
 * @param {BrowserWindow} targetWindow - The window containing the content to export
 * @param {string} htmlContent - The HTML content to export (optional, will be extracted from window if not provided)
 * @returns {Promise<{canceled: boolean, filePath?: string}>}
 */
export async function exportPdfWithPageBreaks(targetWindow, htmlContent = null) {
  console.log('[PDF Export] Starting PDF export process...');
  
  if (!targetWindow) {
    console.error('[PDF Export] No target window provided');
    return { canceled: true };
  }

  try {
    // Get the HTML content from the editor if not provided
    let content = htmlContent;
    if (!content) {
      console.log('[PDF Export] Extracting content from editor...');
      content = await targetWindow.webContents.executeJavaScript(`
        (() => {
          const editorElement = document.querySelector('.ProseMirror');
          console.log('[PDF Export] Editor element found:', !!editorElement);
          const innerHTML = editorElement ? editorElement.innerHTML : '';
          console.log('[PDF Export] Content length:', innerHTML.length);
          return innerHTML;
        })()
      `);
    }

    console.log('[PDF Export] Content extracted, length:', content ? content.length : 0);

    if (!content) {
      throw new Error('No content to export');
    }

    // Check if content has page breaks
    const hasPageBreaks = /<div[^>]*data-type="page-break"[^>]*>.*?<\/div>/gi.test(content);
    console.log('[PDF Export] Content has page breaks:', hasPageBreaks);

    // Show save dialog
    console.log('[PDF Export] Showing save dialog...');
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Экспорт в PDF',
      defaultPath: 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      console.log('[PDF Export] Save dialog canceled');
      return { canceled: true };
    }

    console.log('[PDF Export] Save path selected:', filePath);

    let pdfBuffer;
    
    if (hasPageBreaks) {
      // Split content by page breaks
      const pages = splitContentByPageBreaks(content);
      console.log('[PDF Export] Content split into', pages.length, 'pages');
      
      if (pages.length === 0) {
        throw new Error('No content found after processing');
      }

      // Generate PDF with proper page breaks
      console.log('[PDF Export] Generating PDF with page breaks...');
      pdfBuffer = await generatePdfFromPages(pages);
    } else {
      // Use simple PDF generation for content without page breaks
      console.log('[PDF Export] Generating simple PDF (no page breaks)...');
      pdfBuffer = await targetWindow.webContents.printToPDF({
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
      });
    }
    
    console.log('[PDF Export] PDF generated, buffer size:', pdfBuffer.length);
    
    // Write the PDF file
    console.log('[PDF Export] Writing PDF to file...');
    console.log('[PDF Export] File path:', filePath);
    console.log('[PDF Export] Buffer is valid:', pdfBuffer instanceof Buffer);
    console.log('[PDF Export] Buffer size:', pdfBuffer.length, 'bytes');
    
    await fs.writeFile(filePath, pdfBuffer);
    console.log('[PDF Export] PDF file written successfully');
    
    // Verify file was created
    try {
      const stats = await fs.stat(filePath);
      console.log('[PDF Export] File verification - exists:', true, 'size:', stats.size, 'bytes');
    } catch (verifyError) {
      console.error('[PDF Export] File verification failed:', verifyError);
    }
    
    return { canceled: false, filePath };
  } catch (err) {
    console.error('[PDF Export] Error:', err);
    dialog.showErrorBox('Ошибка', `Не удалось экспортировать PDF: ${err.message}`);
    return { canceled: true };
  }
}

/**
 * Split HTML content by page break markers
 * @param {string} htmlContent - The HTML content to split
 * @returns {string[]} Array of HTML content for each page
 */
function splitContentByPageBreaks(htmlContent) {
  console.log('[Content Split] Starting content split process...');
  console.log('[Content Split] Original content length:', htmlContent.length);
  
  // Split by page break divs
  const pageBreakRegex = /<div[^>]*data-type="page-break"[^>]*>.*?<\/div>/gi;
  const pageBreakMatches = htmlContent.match(pageBreakRegex);
  console.log('[Content Split] Found page break markers:', pageBreakMatches ? pageBreakMatches.length : 0);
  
  const pages = htmlContent.split(pageBreakRegex);
  console.log('[Content Split] Split into', pages.length, 'raw pages');
  
  // Filter out empty pages and clean up content
  const cleanedPages = pages
    .map(page => page.trim())
    .filter(page => page.length > 0)
    .map(page => cleanPageContent(page));
    
  console.log('[Content Split] After cleaning:', cleanedPages.length, 'pages');
  cleanedPages.forEach((page, index) => {
    console.log(`[Content Split] Page ${index + 1} length:`, page.length);
  });
  
  return cleanedPages;
}

/**
 * Clean up page content for PDF generation
 * @param {string} pageContent - Raw page content
 * @returns {string} Cleaned page content
 */
function cleanPageContent(pageContent) {
  // Remove any remaining page break elements
  let cleaned = pageContent.replace(/<div[^>]*data-type="page-break"[^>]*>.*?<\/div>/gi, '');
  
  // Ensure we have proper paragraph structure
  if (cleaned && !cleaned.trim().startsWith('<')) {
    cleaned = `<p>${cleaned}</p>`;
  }
  
  return cleaned;
}

/**
 * Generate PDF from array of page contents
 * @param {string[]} pages - Array of HTML content for each page
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePdfFromPages(pages) {
  console.log('[PDF Generation] Creating temporary window for PDF generation...');
  
  // Create a temporary window for PDF generation
  const pdfWindow = new BrowserWindow({
    width: 800,
    height: 1200,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      offscreen: true
    }
  });

  try {
    // Create HTML document with all pages
    console.log('[PDF Generation] Creating HTML document...');
    const fullHtml = createPdfHtml(pages);
    console.log('[PDF Generation] HTML document created, length:', fullHtml.length);
    
    // Load the HTML content
    console.log('[PDF Generation] Loading HTML content...');
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
    
    // Wait for content to load
    console.log('[PDF Generation] Waiting for content to load...');
    await new Promise(resolve => {
      pdfWindow.webContents.once('did-finish-load', () => {
        console.log('[PDF Generation] Content loaded successfully');
        resolve();
      });
    });

    // Add a small delay to ensure rendering is complete
    console.log('[PDF Generation] Waiting for rendering to complete...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate PDF
    console.log('[PDF Generation] Generating PDF buffer...');
    const pdfBuffer = await pdfWindow.webContents.printToPDF({
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
      pageRanges: '', // Print all pages
    });

    console.log('[PDF Generation] PDF buffer generated successfully, size:', pdfBuffer.length);
    return pdfBuffer;
  } catch (error) {
    console.error('[PDF Generation] Error generating PDF:', error);
    throw error;
  } finally {
    console.log('[PDF Generation] Closing temporary window...');
    pdfWindow.close();
  }
}

/**
 * Create complete HTML document for PDF generation
 * @param {string[]} pages - Array of page contents
 * @returns {string} Complete HTML document
 */
function createPdfHtml(pages) {
  const pageHtmls = pages.map((pageContent, index) => `
    <div class="pdf-page" ${index > 0 ? 'style="page-break-before: always;"' : ''}>
      ${pageContent}
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Document Export</title>
      <style>
        @page {
          size: A4;
          margin: 0; /* Zero margins - let A4 canvas padding handle spacing */
        }
        
        body {
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
          line-height: 1.6;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 0;
        }
        
        .pdf-page {
          min-height: 100vh;
          box-sizing: border-box;
        }
        
        /* Ensure proper text wrapping in PDF - match editor exactly */
        * {
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
        
        /* Remove any view-mode specific styling that might interfere */
        .view-mode {
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        
        /* Ensure proper styling for content elements */
        h1, h2, h3, h4, h5, h6 {
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          font-weight: bold;
        }
        
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.3em; }
        h4 { font-size: 1.1em; }
        h5 { font-size: 1em; }
        h6 { font-size: 0.9em; }
        
        p {
          margin-bottom: 1em;
        }
        
        ul, ol {
          margin: 1em 0;
          padding-left: 2em;
        }
        
        li {
          margin-bottom: 0.5em;
        }
        
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        
        code {
          background-color: #f5f5f5;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
        
        pre {
          background-color: #f5f5f5;
          padding: 1em;
          border-radius: 5px;
          overflow-x: auto;
        }
        
        img {
          max-width: 100%;
          height: auto;
        }
        
        /* Hide page break indicators in PDF */
        .page-break,
        [data-type="page-break"] {
          display: none !important;
        }
        
        /* Math rendering support */
        .katex {
          font-size: 1em;
        }
      </style>
    </head>
    <body>
      ${pageHtmls}
    </body>
    </html>
  `;
}
