/**
 * Image Processing Worker
 * Handles heavy image operations in a separate process
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// Enable manual garbage collection
if (global.gc) {
  setInterval(() => {
    global.gc();
  }, 5000); // More frequent GC for image processing
}

class ImageWorker {
  constructor() {
    this.isProcessing = false;
    this.tempDirs = new Set();
  }

  async processTask(taskData) {
    if (this.isProcessing) {
      throw new Error('Worker is already processing a task');
    }

    this.isProcessing = true;
    
    try {
      const { operation, data } = taskData;
      
      switch (operation) {
        case 'processImage':
          return await this.processImage(data);
        case 'createTempImage':
          return await this.createTempImage(data);
        case 'optimizeImage':
          return await this.optimizeImage(data);
        case 'generateThumbnail':
          return await this.generateThumbnail(data);
        case 'validateImage':
          return await this.validateImage(data);
        case 'cleanup':
          return await this.cleanup(data);
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } finally {
      this.isProcessing = false;
      // Force garbage collection after each task
      if (global.gc) {
        global.gc();
      }
    }
  }

  async processImage(data) {
    const { imageData, originalPath, mimeType } = data;
    
    this.sendProgress('Processing image...', 10);
    
    try {
      let imageBuffer;
      let fileName;
      
      if (imageData.startsWith('data:')) {
        // Handle base64 data
        this.sendProgress('Decoding base64...', 30);
        const base64Data = imageData.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
        const ext = mimeType ? mimeType.split('/')[1] : 'png';
        fileName = `processed_image.${ext}`;
      } else if (imageData.startsWith('rsrch-image://')) {
        // Handle custom protocol URL
        this.sendProgress('Reading from path...', 30);
        const decodedPath = decodeURIComponent(imageData.replace('rsrch-image://', ''));
        imageBuffer = await fs.readFile(decodedPath);
        fileName = path.basename(decodedPath);
      } else if (originalPath) {
        // Handle file path
        this.sendProgress('Reading from file...', 30);
        imageBuffer = await fs.readFile(originalPath);
        fileName = path.basename(originalPath);
      } else {
        throw new Error('Invalid image data provided');
      }
      
      // Generate content-based hash
      this.sendProgress('Generating hash...', 50);
      const imageHash = this.generateImageHash(imageBuffer);
      
      // Create temp file
      this.sendProgress('Creating temp file...', 70);
      const tempDir = path.join(os.tmpdir(), `rsrch_image_${Date.now()}_${imageHash}`);
      await fs.mkdir(tempDir, { recursive: true });
      this.tempDirs.add(tempDir);
      
      const ext = fileName.split('.').pop() || 'png';
      const hashBasedFileName = `img_${imageHash}.${ext}`;
      const tempFilePath = path.join(tempDir, hashBasedFileName);
      
      await fs.writeFile(tempFilePath, imageBuffer);
      
      // Return custom protocol URL for the temp file
      const normalizedPath = tempFilePath.replace(/\\/g, '/');
      const customUrl = `rsrch-image://${encodeURIComponent(normalizedPath)}`;
      
      this.sendProgress('Image processed', 100);
      
      return {
        success: true,
        tempPath: tempFilePath,
        customUrl,
        tempDir,
        hash: imageHash,
        size: imageBuffer.length
      };
      
    } catch (error) {
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  async createTempImage(data) {
    const { imageData, mimeType } = data;
    
    this.sendProgress('Creating temp image...', 20);
    
    try {
      if (!imageData.startsWith('data:')) {
        throw new Error('Expected base64 data URL for temp image creation');
      }
      
      const base64Data = imageData.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      const imageHash = this.generateImageHash(imageBuffer);
      
      const tempDir = path.join(os.tmpdir(), `rsrch_temp_${Date.now()}_${imageHash}`);
      await fs.mkdir(tempDir, { recursive: true });
      this.tempDirs.add(tempDir);
      
      const ext = mimeType ? mimeType.split('/')[1] : 'png';
      const tempFilePath = path.join(tempDir, `temp_${imageHash}.${ext}`);
      
      await fs.writeFile(tempFilePath, imageBuffer);
      
      const normalizedPath = tempFilePath.replace(/\\/g, '/');
      const customUrl = `rsrch-image://${encodeURIComponent(normalizedPath)}`;
      
      this.sendProgress('Temp image created', 100);
      
      return {
        success: true,
        tempPath: tempFilePath,
        customUrl,
        tempDir,
        hash: imageHash
      };
      
    } catch (error) {
      throw new Error(`Failed to create temp image: ${error.message}`);
    }
  }

  async optimizeImage(data) {
    const { imagePath, quality = 85, maxWidth = 1920, maxHeight = 1080 } = data;
    
    this.sendProgress('Optimizing image...', 20);
    
    try {
      // For now, just copy the image (optimization would require image processing library)
      // In a real implementation, you'd use sharp, jimp, or similar
      const imageBuffer = await fs.readFile(imagePath);
      
      // Simple size check - if image is too large, we could implement basic resizing
      if (imageBuffer.length > 5 * 1024 * 1024) { // 5MB
        console.warn('[ImageWorker] Large image detected, consider implementing resizing');
      }
      
      this.sendProgress('Image optimized', 100);
      
      return {
        success: true,
        originalSize: imageBuffer.length,
        optimizedSize: imageBuffer.length, // Would be different with actual optimization
        savings: 0
      };
      
    } catch (error) {
      throw new Error(`Failed to optimize image: ${error.message}`);
    }
  }

  async generateThumbnail(data) {
    const { imagePath, width = 150, height = 150 } = data;
    
    this.sendProgress('Generating thumbnail...', 30);
    
    try {
      // Placeholder implementation - would use image processing library
      const imageBuffer = await fs.readFile(imagePath);
      
      // Create thumbnail directory
      const tempDir = path.join(os.tmpdir(), `rsrch_thumb_${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      this.tempDirs.add(tempDir);
      
      const fileName = path.basename(imagePath);
      const thumbPath = path.join(tempDir, `thumb_${fileName}`);
      
      // For now, just copy the original (would implement actual thumbnail generation)
      await fs.writeFile(thumbPath, imageBuffer);
      
      this.sendProgress('Thumbnail generated', 100);
      
      return {
        success: true,
        thumbnailPath: thumbPath,
        tempDir
      };
      
    } catch (error) {
      throw new Error(`Failed to generate thumbnail: ${error.message}`);
    }
  }

  async validateImage(data) {
    const { imagePath } = data;
    
    this.sendProgress('Validating image...', 50);
    
    try {
      const stats = await fs.stat(imagePath);
      const imageBuffer = await fs.readFile(imagePath, { encoding: null });
      
      // Basic validation - check file size and magic numbers
      const isValid = stats.size > 0 && imageBuffer.length > 0;
      
      // Check for common image magic numbers
      let format = 'unknown';
      if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) format = 'jpeg';
      else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) format = 'png';
      else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49) format = 'gif';
      else if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49) format = 'webp';
      
      this.sendProgress('Validation complete', 100);
      
      return {
        isValid,
        format,
        size: stats.size,
        dimensions: null // Would implement with image processing library
      };
      
    } catch (error) {
      throw new Error(`Failed to validate image: ${error.message}`);
    }
  }

  async cleanup(data) {
    const { tempDir } = data;
    
    this.sendProgress('Cleaning up...', 50);
    
    try {
      if (tempDir && this.tempDirs.has(tempDir)) {
        await this.cleanupTempDirectory(tempDir);
        this.tempDirs.delete(tempDir);
      }
      
      this.sendProgress('Cleanup complete', 100);
      
      return { success: true };
      
    } catch (error) {
      throw new Error(`Failed to cleanup: ${error.message}`);
    }
  }

  generateImageHash(imageBuffer) {
    return crypto.createHash('sha256').update(imageBuffer).digest('hex').substring(0, 16);
  }

  async cleanupTempDirectory(tempDir) {
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file));
      }
      await fs.rmdir(tempDir);
    } catch (error) {
      console.warn(`[ImageWorker] Failed to cleanup temp directory ${tempDir}:`, error.message);
    }
  }

  sendProgress(message, progress) {
    process.send({
      type: 'progress',
      progress: { message, percent: progress }
    });
  }
}

// Create worker instance
const worker = new ImageWorker();

// Handle messages from parent process
process.on('message', async (message) => {
  if (message.type === 'task') {
    try {
      const result = await worker.processTask(message.data);
      process.send({
        type: 'result',
        data: result
      });
    } catch (error) {
      process.send({
        type: 'error',
        error: error.message
      });
    }
  }
});

// Handle process cleanup
process.on('SIGTERM', async () => {
  console.log('[ImageWorker] Received SIGTERM, cleaning up...');
  
  // Cleanup all temp directories
  for (const tempDir of worker.tempDirs) {
    await worker.cleanupTempDirectory(tempDir);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[ImageWorker] Received SIGINT, cleaning up...');
  
  // Cleanup all temp directories
  for (const tempDir of worker.tempDirs) {
    await worker.cleanupTempDirectory(tempDir);
  }
  
  process.exit(0);
});

console.log('[ImageWorker] Worker process started');

