import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import os from 'node:os';

/**
 * Extracts images from HTML content (both base64 and file:// URLs) and saves them as separate files
 * @param {string} contentHtml - HTML content containing images
 * @param {string} tempDir - Temporary directory to save images
 * @returns {Promise<{contentHtml: string, imageFiles: Array}>} - Modified HTML and image file info
 */
export async function extractImagesFromContent(contentHtml, tempDir) {
  const imageFiles = [];
  let modifiedHtml = contentHtml;
  let imageIndex = 0;
  
  // First pass: Process base64 images
  const base64ImageRegex = /src="data:image\/([^;]+);base64,([^"]+)"/g;
  let match;
  
  while ((match = base64ImageRegex.exec(contentHtml)) !== null) {
    const [fullMatch, imageType, base64Data] = match;
    
    // Generate unique filename
    const imageId = uuidv4();
    const fileName = `image_${imageIndex}_${imageId}.${imageType}`;
    const filePath = path.join(tempDir, fileName);
    
    // Convert base64 to buffer and save
    const imageBuffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, imageBuffer);
    
    // Store image file info
    imageFiles.push({
      fileName,
      originalSrc: fullMatch,
      mimeType: `image/${imageType}`,
      size: imageBuffer.length
    });
    
    // Replace base64 src with relative path
    modifiedHtml = modifiedHtml.replace(fullMatch, `src="images/${fileName}"`);
    
    imageIndex++;
  }
  
  // Second pass: Process file:// URLs and custom protocol URLs
  const fileUrlRegex = /src="(?:file:\/\/|rsrch-image:\/\/)([^"]+)"/g;
  
  while ((match = fileUrlRegex.exec(modifiedHtml)) !== null) {
    const [fullMatch, encodedPath] = match;
    
    try {
      // Remove cache-busting parameters and decode the path
      const pathWithoutParams = encodedPath.split('?')[0];
      const filePath = fullMatch.includes('rsrch-image://') 
        ? decodeURIComponent(pathWithoutParams)
        : pathWithoutParams;
      
      // Read the file from disk
      const imageBuffer = await fs.readFile(filePath);
      
      // Get file extension
      const ext = path.extname(filePath).toLowerCase().substring(1);
      const imageType = ext === 'jpg' ? 'jpeg' : ext;
      
      // Generate unique filename
      const imageId = uuidv4();
      const fileName = `image_${imageIndex}_${imageId}.${imageType}`;
      const newFilePath = path.join(tempDir, fileName);
      
      // Copy file to temp directory
      await fs.writeFile(newFilePath, imageBuffer);
      
      // Store image file info
      imageFiles.push({
        fileName,
        originalSrc: fullMatch,
        mimeType: `image/${imageType}`,
        size: imageBuffer.length
      });
      
      // Replace file:// URL with relative path
      modifiedHtml = modifiedHtml.replace(fullMatch, `src="images/${fileName}"`);
      
      imageIndex++;
    } catch (error) {
      console.warn(`Failed to process file:// image ${filePath}:`, error);
      // Keep the original src if file can't be read
    }
  }
  
  return { contentHtml: modifiedHtml, imageFiles };
}

/**
 * Replaces relative image paths with custom protocol URLs pointing to extracted images
 * @param {string} contentHtml - HTML content with relative image paths
 * @param {string} tempDir - Directory containing extracted images
 * @returns {Promise<string>} - HTML content with rsrch-image:// URLs
 */
export async function embedImagesInContent(contentHtml, tempDir) {
  let modifiedHtml = contentHtml;
  
  // Regular expression to find relative image paths
  const relativeImageRegex = /src="images\/([^"]+)"/g;
  
  let match;
  while ((match = relativeImageRegex.exec(contentHtml)) !== null) {
    const [fullMatch, fileName] = match;
    const filePath = path.join(tempDir, fileName);
    
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Convert to custom protocol URL for safe access
      const normalizedPath = filePath.replace(/\\/g, '/');
      const customUrl = `rsrch-image://${encodeURIComponent(normalizedPath)}`;
      
      // Replace relative path with custom protocol URL
      modifiedHtml = modifiedHtml.replace(fullMatch, `src="${customUrl}"`);
    } catch (error) {
      console.warn(`Failed to access image ${fileName}:`, error);
      // Keep the relative path if image can't be accessed
    }
  }
  
  return modifiedHtml;
}

/**
 * Creates a .rsrch archive from document data
 * @param {Object} documentData - Document data object
 * @param {string} outputPath - Path where to save the .rsrch file
 * @returns {Promise<void>}
 */
export async function createDocumentArchive(documentData, outputPath) {
  // Create temporary directory for processing
  const tempDir = path.join(os.tmpdir(), `rsrch_temp_${uuidv4()}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    // Create images subdirectory
    const imagesDir = path.join(tempDir, 'images');
    await fs.mkdir(imagesDir, { recursive: true });
    
    // Extract images from content
    const { contentHtml: processedHtml, imageFiles } = await extractImagesFromContent(
      documentData.contentHtml || '', 
      imagesDir
    );
    
    // Create document.json with processed content
    const documentJson = {
      ...documentData,
      contentHtml: processedHtml,
      version: 2, // Increment version to indicate new format
      imageFiles: imageFiles.map(img => ({
        fileName: img.fileName,
        mimeType: img.mimeType,
        size: img.size
      }))
    };
    
    // Create ZIP archive
    const zip = new JSZip();
    
    // Add document.json to archive
    zip.file('document.json', JSON.stringify(documentJson, null, 2));
    
    // Add image files to archive
    for (const imageFile of imageFiles) {
      const imagePath = path.join(imagesDir, imageFile.fileName);
      const imageBuffer = await fs.readFile(imagePath);
      zip.file(`images/${imageFile.fileName}`, imageBuffer);
    }
    
    // Generate and save archive
    const archiveBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    await fs.writeFile(outputPath, archiveBuffer);
    
  } finally {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  }
}

/**
 * Extracts document data from a .rsrch archive
 * @param {string} archivePath - Path to the .rsrch file
 * @returns {Promise<Object>} - Document data with file:// URLs for images
 */
export async function extractDocumentArchive(archivePath) {
  // Create persistent temporary directory for extraction (don't clean up immediately)
  const tempDir = path.join(os.tmpdir(), `rsrch_extract_${uuidv4()}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  // Read and extract archive
  const archiveBuffer = await fs.readFile(archivePath);
  const zip = new JSZip();
  const archive = await zip.loadAsync(archiveBuffer);
  
  // Extract document.json
  const documentJsonFile = archive.file('document.json');
  if (!documentJsonFile) {
    throw new Error('Invalid .rsrch file: missing document.json');
  }
  
  const documentJsonContent = await documentJsonFile.async('string');
  const documentData = JSON.parse(documentJsonContent);
  
  // Check if this is the new format (version 2+)
  if (documentData.version >= 2) {
    // Create images directory
    const imagesDir = path.join(tempDir, 'images');
    await fs.mkdir(imagesDir, { recursive: true });
    
    // Extract image files
    const imagePromises = [];
    archive.folder('images').forEach((relativePath, file) => {
      if (!file.dir) {
        const extractPath = path.join(imagesDir, relativePath);
        imagePromises.push(
          file.async('nodebuffer').then(buffer => 
            fs.writeFile(extractPath, buffer)
          )
        );
      }
    });
    
    await Promise.all(imagePromises);
    
    // Convert relative paths to file:// URLs
    const contentWithImages = await embedImagesInContent(
      documentData.contentHtml || '', 
      imagesDir
    );
    
    return {
      ...documentData,
      contentHtml: contentWithImages,
      _tempDir: tempDir // Store temp dir path for cleanup later
    };
  } else {
    // Legacy format - return as is
    return documentData;
  }
}

/**
 * Cleans up temporary directory used for document extraction
 * @param {string} tempDir - Path to temporary directory
 * @returns {Promise<void>}
 */
export async function cleanupTempDirectory(tempDir) {
  if (!tempDir) return;
  
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clean up temp directory:', error);
  }
}

/**
 * Checks if a file is a valid .rsrch archive
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} - True if valid archive
 */
export async function isValidDocumentArchive(filePath) {
  try {
    const archiveBuffer = await fs.readFile(filePath);
    const zip = new JSZip();
    const archive = await zip.loadAsync(archiveBuffer);
    
    // Check for required files
    return archive.file('document.json') !== null;
  } catch (error) {
    return false;
  }
}
