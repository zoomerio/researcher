/**
 * Document Processing Worker
 * Handles heavy document operations in a separate process
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createDocumentArchive, extractDocumentArchive, isValidDocumentArchive } from '../documentUtils.js';

// Enable manual garbage collection
if (global.gc) {
  // Run GC every 10 seconds
  setInterval(() => {
    global.gc();
  }, 10000);
}

class DocumentWorker {
  constructor() {
    this.isProcessing = false;
  }

  async processTask(taskData) {
    if (this.isProcessing) {
      throw new Error('Worker is already processing a task');
    }

    this.isProcessing = true;
    
    try {
      const { operation, data } = taskData;
      
      switch (operation) {
        case 'loadDocument':
          return await this.loadDocument(data);
        case 'saveDocument':
          return await this.saveDocument(data);
        case 'extractArchive':
          return await this.extractArchive(data);
        case 'createArchive':
          return await this.createArchive(data);
        case 'validateDocument':
          return await this.validateDocument(data);
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

  async loadDocument(data) {
    const { filePath } = data;
    
    this.sendProgress('Loading document...', 10);
    
    try {
      // Check if it's a new archive format
      if (await isValidDocumentArchive(filePath)) {
        this.sendProgress('Extracting archive...', 50);
        const documentData = await extractDocumentArchive(filePath);
        this.sendProgress('Document loaded', 100);
        return documentData;
      }
      
      // Handle legacy formats
      this.sendProgress('Reading legacy format...', 30);
      const content = await fs.readFile(filePath, 'utf-8');
      
      let documentData = {};
      
      if (content.trim().startsWith('<')) {
        // Legacy XML format
        this.sendProgress('Parsing XML...', 70);
        const extract = (tag) => {
          const m = content.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
          return m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '';
        };
        
        documentData = {
          title: extract('title'),
          description: extract('description'),
          goals: extract('goals'),
          hypotheses: extract('hypotheses'),
          plan: extract('plan'),
          contentHtml: extract('contentHtml'),
          version: 1
        };
      } else {
        // Legacy JSON format
        this.sendProgress('Parsing JSON...', 70);
        documentData = JSON.parse(content);
        documentData.version = documentData.version || 1;
      }
      
      this.sendProgress('Document loaded', 100);
      return documentData;
      
    } catch (error) {
      throw new Error(`Failed to load document: ${error.message}`);
    }
  }

  async saveDocument(data) {
    const { filePath, documentData, asXml = false } = data;
    
    this.sendProgress('Preparing document...', 10);
    
    try {
      if (asXml) {
        // Legacy XML format
        this.sendProgress('Creating XML...', 50);
        const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const xml = [
          '<research>',
          `<title>${escape(documentData.title || '')}</title>`,
          `<description>${escape(documentData.description || '')}</description>`,
          `<goals>${escape(documentData.goals || '')}</goals>`,
          `<hypotheses>${escape(documentData.hypotheses || '')}</hypotheses>`,
          `<plan>${escape(documentData.plan || '')}</plan>`,
          `<contentHtml>${escape(documentData.contentHtml || '')}</contentHtml>`,
          '</research>',
        ].join('');
        
        this.sendProgress('Writing file...', 80);
        await fs.writeFile(filePath, xml, 'utf-8');
      } else {
        // New archive format
        this.sendProgress('Creating archive...', 50);
        await createDocumentArchive(documentData, filePath);
      }
      
      this.sendProgress('Document saved', 100);
      return { success: true, filePath };
      
    } catch (error) {
      throw new Error(`Failed to save document: ${error.message}`);
    }
  }

  async extractArchive(data) {
    const { filePath } = data;
    
    this.sendProgress('Extracting archive...', 20);
    
    try {
      const result = await extractDocumentArchive(filePath);
      this.sendProgress('Archive extracted', 100);
      return result;
    } catch (error) {
      throw new Error(`Failed to extract archive: ${error.message}`);
    }
  }

  async createArchive(data) {
    const { documentData, filePath } = data;
    
    this.sendProgress('Creating archive...', 20);
    
    try {
      await createDocumentArchive(documentData, filePath);
      this.sendProgress('Archive created', 100);
      return { success: true, filePath };
    } catch (error) {
      throw new Error(`Failed to create archive: ${error.message}`);
    }
  }

  async validateDocument(data) {
    const { filePath } = data;
    
    this.sendProgress('Validating document...', 50);
    
    try {
      const isValid = await isValidDocumentArchive(filePath);
      this.sendProgress('Validation complete', 100);
      return { isValid };
    } catch (error) {
      throw new Error(`Failed to validate document: ${error.message}`);
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
const worker = new DocumentWorker();

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
process.on('SIGTERM', () => {
  console.log('[DocumentWorker] Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[DocumentWorker] Received SIGINT, shutting down...');
  process.exit(0);
});

console.log('[DocumentWorker] Worker process started');
