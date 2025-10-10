import { dialog, BrowserWindow } from 'electron';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { promises as fs } from 'fs';

// __dirname is not defined in ESM; derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Extract rendered ProseMirror content and split by page-break nodes
    console.log('[Enhanced PDF] Extracting pages from DOM...');
    let pages = await targetWindow.webContents.executeJavaScript(`
      (() => {
        const root = document.querySelector('.view-mode .ProseMirror') 
          || document.querySelector('.a4-canvas .ProseMirror') 
          || document.querySelector('.ProseMirror');
        if (!root) return [];
        const isPageBreak = (el) => {
          if (!el || el.nodeType !== 1) return false;
          const attr = el.getAttribute('data-type');
          const cls = el.getAttribute('class') || '';
          return (attr === 'page-break') || /(^|\s)page-break(\s|$)/.test(cls);
        };
        const fragments = [];
        let buffer = [];
        const pushBuffer = () => {
          const html = buffer.join('').trim();
          if (html) fragments.push(html);
          buffer = [];
        };
        Array.from(root.childNodes).forEach((node) => {
          if (node.nodeType === 1 && isPageBreak(node)) {
            pushBuffer();
            return; // skip the page-break node itself
          }
          const tmp = document.createElement('div');
          tmp.appendChild(node.cloneNode(true));
          buffer.push(tmp.innerHTML);
        });
        pushBuffer();
        return fragments;
      })()
    `);
    if (!Array.isArray(pages) || pages.length === 0) {
      // Fallback: single page from ProseMirror innerHTML
      const fallbackContent = await targetWindow.webContents.executeJavaScript(`
        (() => {
          const root = document.querySelector('.view-mode .ProseMirror') 
            || document.querySelector('.a4-canvas .ProseMirror') 
            || document.querySelector('.ProseMirror');
          return root ? root.innerHTML : '';
        })()
      `);
      pages = [fallbackContent || ''];
    }
    // Clean/strip overlays
    pages = pages.map((html) => stripUiOverlays(html));

    // Capture computed font settings from the app to keep PDF fonts consistent
    const fontInfo = await targetWindow.webContents.executeJavaScript(`
      (() => {
        const cs = window.getComputedStyle(document.body);
        return { fontFamily: (cs.fontFamily && cs.fontFamily.replace(/system-ui/gi,'Gilroy')) || 'Gilroy, Arial, sans-serif', fontSize: cs.fontSize || '16px', lineHeight: cs.lineHeight || '1.6' };
      })()
    `);

    // Build @font-face for Gilroy from local app fonts
    const appDir = path.dirname(process.execPath);
    const rootDir = process.env.VITE_DEV_SERVER_URL ? path.resolve(__dirname, '..') : appDir;
    const fontRegular = pathToFileURL(path.resolve(rootDir, 'fonts', 'gilroy-regular.ttf')).toString();
    const fontBold = pathToFileURL(path.resolve(rootDir, 'fonts', 'gilroy-bold.ttf')).toString();
    const fontLight = pathToFileURL(path.resolve(rootDir, 'fonts', 'Gilroy-Light.otf')).toString();
    const fontExtraBold = pathToFileURL(path.resolve(rootDir, 'fonts', 'Gilroy-ExtraBold.otf')).toString();
    const fontCss = `
      @font-face { font-family: 'Gilroy'; src: url('${fontLight}') format('opentype'); font-weight: 300; font-style: normal; font-display: swap; }
      @font-face { font-family: 'Gilroy'; src: url('${fontRegular}') format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
      @font-face { font-family: 'Gilroy'; src: url('${fontBold}') format('truetype'); font-weight: 700; font-style: normal; font-display: swap; }
      @font-face { font-family: 'Gilroy'; src: url('${fontExtraBold}') format('opentype'); font-weight: 800; font-style: normal; font-display: swap; }
    `;

    // Replace any inline system-ui font declarations with Gilroy to keep default font consistent
    function replaceSystemUiWithGilroy(html) {
      try {
        let out = html;
        // Replace any font-family declarations that include system-ui (entire value)
        out = out.replace(/font-family\s*:\s*[^;]*system-ui[^;]*;/gi, 'font-family: Gilroy, Arial, sans-serif;');
        // Also handle cases missing trailing semicolon
        out = out.replace(/font-family\s*:\s*[^;]*system-ui[^;]*(?=["'])/gi, 'font-family: Gilroy, Arial, sans-serif');
        return out;
      } catch { return html; }
    }

    // Render via offscreen window with flowing layout (auto pagination) and manual breaks
    console.log('[Enhanced PDF] Generating PDF in offscreen window...');
    const contentHtml = replaceSystemUiWithGilroy(pages.join('<div class="manual-break"></div>'));
    const pdfBuffer = await generatePdfFromContent(contentHtml, fontInfo, fontCss);

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

// Helpers for enhanced export
function stripUiOverlays(html) {
  return html
    .replace(/<div[^>]*class=\"[^\"]*(tab-context-menu|menu-panel|menu-dropdown)[^\"]*\"[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*style=\"[^\"]*position:\s*fixed[^\"]*\"[\s\S]*?<\/div>/gi, '');
}

function createPdfHtmlFlow(contentHtml, fontInfo, fontCss) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Document Export</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" crossorigin="anonymous">
      <style>
        ${fontCss || ''}
        @page { size: A4; margin: 0; }
        html, body { width: 210mm; background: #fff; color: #000; margin: 0; padding: 0; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: ${fontInfo?.fontFamily || 'Gilroy, Arial, sans-serif'}; font-size: ${fontInfo?.fontSize || '16px'}; line-height: ${fontInfo?.lineHeight || '1.6'}; }
        .pdf-root { width: 210mm; box-sizing: border-box; padding: 15mm; background: #fff; }
        .manual-break { break-before: page; page-break-before: always; }
        * { overflow-wrap: break-word !important; word-wrap: break-word !important; max-width: 100% !important; box-sizing: border-box !important; }
        img { max-width: 100%; height: auto; break-inside: avoid; }
        table, pre, blockquote, .katex-display, h1, h2, h3, h4, h5, h6 { break-inside: avoid; }
        .page-break, [data-type="page-break"], .math-editing-node { display: none !important; }
        /* KaTeX: hide MathML layer to avoid duplicate text, center display formulas */
        .katex .katex-mathml { position: absolute; clip: rect(1px, 1px, 1px, 1px); padding: 0; margin: 0; border: 0; height: 1px; width: 1px; overflow: hidden; }
        .katex-display { display: block !important; text-align: center !important; margin: 1em 0 !important; }
        .katex-display > .katex { display: inline-block; }
        /* Ensure tiptap block math wrappers center their content */
        .math-display,
        div[data-math-type="block"],
        div[data-type="block-math"] { display: block; text-align: center !important; }
        /* Tables styling similar to app */
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; color: #111827; font-weight: 600; }
        /* Code blocks styling */
        pre { background: #0b1220; color: #e5e7eb; padding: 10px 12px; border-radius: 8px; border: 1px solid #1f2937; overflow: auto; font-family: "Fira Code", "Cascadia Code", Menlo, Consolas, monospace; font-size: 0.95em; }
        code { background: #fff3cd; border: 1px solid #ffecb5; color: #856404; padding: 2px 4px; border-radius: 3px; font-family: "Courier New", Monaco, monospace; }
        pre code { background: transparent; border: 0; padding: 0; }
        /* Hide any scrollbars if present */
        ::-webkit-scrollbar { display: none; width: 0; height: 0; }
      </style>
    </head>
    <body>
      <div class="pdf-root">${contentHtml}</div>
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js" crossorigin="anonymous"></script>
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          function renderMath(selectors, display) {
            selectors.forEach(function(sel){
              document.querySelectorAll(sel).forEach(function(el){
                if (el.querySelector && el.querySelector('.katex')) return;
                var latex = el.getAttribute('data-latex') || el.textContent || '';
                if (!latex.trim()) return;
                try { window.katex && window.katex.render(latex, el, { displayMode: display, throwOnError: false }); } catch(e) {}
              });
            });
          }
          renderMath(['.math-inline','span[data-math-type="inline"]','span[data-type="inline-math"]'], false);
          renderMath(['.math-display','div[data-math-type="block"]','div[data-type="block-math"]'], true);
        });
      </script>
    </body>
    </html>
  `;
}

async function generatePdfFromContent(contentHtml, fontInfo, fontCss) {
  const pdfWindow = new BrowserWindow({
    width: 800,
    height: 1200,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: { nodeIntegration: false, contextIsolation: true, offscreen: true }
  });
  try {
    const html = createPdfHtmlFlow(contentHtml, fontInfo, fontCss);
    // Load with robust events and timeout
    const failPromise = new Promise((_, reject) => {
      pdfWindow.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error(`did-fail-load ${code}: ${desc}`)));
    });
    const loadPromise = new Promise((resolve) => {
      const done = () => resolve();
      pdfWindow.webContents.once('did-finish-load', done);
      pdfWindow.webContents.once('dom-ready', done);
    });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('load timeout')), 10000));
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await Promise.race([failPromise, loadPromise, timeoutPromise]);

    // Ensure 100% zoom and small settle
    try { pdfWindow.webContents.setZoomFactor(1.0); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Use conservative printToPDF options (avoid unsupported margins object)
    const buf = await pdfWindow.webContents.printToPDF({
      landscape: false,
      marginsType: 0, // default margins; page CSS handles inner spacing
      pageSize: 'A4',
      printBackground: true,
      scaleFactor: 100,
      preferCSSPageSize: true
    });
    return buf;
  } finally {
    pdfWindow.close();
  }
}
