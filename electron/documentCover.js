import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { app, BrowserWindow } from 'electron';

/**
 * Generate a document cover image from HTML content
 * This creates a thumbnail/preview of the first page of the document
 */
export async function generateDocumentCover(htmlContent, documentFilePath, oldCoverPath = null) {
  try {
    console.log('[DocumentCover] Starting cover generation...');
    console.log('[DocumentCover] HTML content length:', htmlContent.length);
    console.log('[DocumentCover] Document file path:', documentFilePath);
    console.log('[DocumentCover] Old cover path:', oldCoverPath);
    
    // Create covers directory in user data
    const userDataPath = app.getPath('userData');
    const coversDir = path.join(userDataPath, 'document-covers');
    console.log('[DocumentCover] Creating covers directory at:', coversDir);
    
    await fs.mkdir(coversDir, { recursive: true });
    console.log('[DocumentCover] Covers directory created successfully');

    // Generate unique filename based on document path, content hash, and timestamp
    const contentHash = crypto.createHash('md5').update(htmlContent + documentFilePath + Date.now()).digest('hex');
    const coverFileName = `cover_${contentHash}.png`;
    const coverPath = path.join(coversDir, coverFileName);
    console.log('[DocumentCover] Generated cover filename:', coverFileName);
    console.log('[DocumentCover] Full cover path:', coverPath);

    // Delete old cover if it exists
    if (oldCoverPath) {
      try {
        await fs.unlink(oldCoverPath);
        console.log('[DocumentCover] Deleted old cover:', oldCoverPath);
      } catch (error) {
        console.log('[DocumentCover] Could not delete old cover (may not exist):', error.message);
      }
    }

    // Create a simplified HTML template for cover generation
    const coverHtml = createCoverHtml(htmlContent);
    
    // Generate actual image using Electron's BrowserWindow
    console.log('[DocumentCover] Generating actual image from HTML...');
    const imageBuffer = await generateImageFromHtml(coverHtml);
    
    // Save the actual image data
    console.log('[DocumentCover] Writing image data to file...');
    await fs.writeFile(coverPath, imageBuffer);
    console.log('[DocumentCover] Image file written successfully');
    
    // Verify the file was created
    try {
      const stats = await fs.stat(coverPath);
      console.log('[DocumentCover] Cover file size:', stats.size, 'bytes');
    } catch (error) {
      console.error('[DocumentCover] Failed to verify cover file:', error);
    }
    
    console.log(`[DocumentCover] Generated cover: ${coverFileName}`);
    return coverPath;
  } catch (error) {
    console.error('[DocumentCover] Error generating cover:', error);
    throw error;
  }
}

/**
 * Generate actual image from HTML using Electron's BrowserWindow
 */
async function generateImageFromHtml(htmlContent) {
  return new Promise((resolve, reject) => {
    // Create an offscreen browser window
    const window = new BrowserWindow({
      width: 800,
      height: 1000,
      show: false,
      webPreferences: {
        offscreen: true,
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Load the HTML content
    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Wait for the page to load, then capture screenshot
    window.webContents.once('did-finish-load', async () => {
      try {
        // Wait a bit for rendering to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Capture screenshot as PNG
        const image = await window.webContents.capturePage({
          x: 0,
          y: 0,
          width: 800,
          height: 1000
        });
        
        // Close the window
        window.close();
        
        // Return the image buffer
        resolve(image.toPNG());
      } catch (error) {
        window.close();
        reject(error);
      }
    });

    // Handle load errors
    window.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
      window.close();
      reject(new Error(`Failed to load HTML: ${errorDescription}`));
    });
  });
}

/**
 * Create a simplified HTML template for cover generation
 */
function createCoverHtml(htmlContent) {
  // Extract and clean the HTML content
  let cleanContent = htmlContent
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove scripts
    .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove existing styles
    .replace(/style="[^"]*"/gi, ''); // Remove inline styles

  // If content is too long, truncate it
  if (cleanContent.length > 2000) {
    cleanContent = cleanContent.substring(0, 2000) + '...';
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 40px;
          background: white;
          color: #333;
          line-height: 1.6;
          width: 800px;
          height: 1000px;
          overflow: hidden;
        }
        .cover-header {
          border-bottom: 3px solid #3b82f6;
          padding-bottom: 20px;
          margin-bottom: 30px;
          text-align: center;
        }
        .document-preview {
          color: #6b7280;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 10px;
        }
        .document-title {
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
        }
        .cover-content {
          font-size: 16px;
          text-align: justify;
          overflow: hidden;
          max-height: 800px;
        }
        .cover-content h1, .cover-content h2, .cover-content h3 {
          margin: 20px 0 10px 0;
          color: #1f2937;
        }
        .cover-content h1 { font-size: 24px; }
        .cover-content h2 { font-size: 20px; }
        .cover-content h3 { font-size: 18px; }
        .cover-content p {
          margin-bottom: 15px;
        }
        .cover-content ul, .cover-content ol {
          margin: 10px 0 10px 20px;
        }
        .cover-content li {
          margin-bottom: 5px;
        }
      </style>
    </head>
    <body>
      <div class="cover-header">
        <div class="document-preview">Researcher Document</div>
        <div class="document-title">Research Document</div>
      </div>
      <div class="cover-content">
        ${cleanContent}
      </div>
    </body>
    </html>
  `;
}



/**
 * Get cover path for a document (if it exists)
 */
export async function getDocumentCoverPath(documentFilePath, htmlContent = '') {
  try {
    const userDataPath = app.getPath('userData');
    const coversDir = path.join(userDataPath, 'document-covers');
    
    const contentHash = crypto.createHash('md5').update(htmlContent + documentFilePath).digest('hex');
    const coverFileName = `cover_${contentHash}.png`;
    const coverPath = path.join(coversDir, coverFileName);

    // Check if cover exists
    try {
      await fs.access(coverPath);
      return coverPath;
    } catch {
      return null;
    }
  } catch (error) {
    console.error('[DocumentCover] Error getting cover path:', error);
    return null;
  }
}

/**
 * Delete cover for a document
 */
export async function deleteDocumentCover(coverPath) {
  try {
    if (coverPath) {
      await fs.unlink(coverPath);
      console.log(`[DocumentCover] Deleted cover: ${coverPath}`);
    }
  } catch (error) {
    console.error('[DocumentCover] Error deleting cover:', error);
  }
}
