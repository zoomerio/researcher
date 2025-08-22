/**
 * Child Process Manager for Heavy Operations
 * Separates memory-intensive tasks into isolated processes
 */

import { fork } from 'child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ChildProcessManager {
  constructor() {
    this.processes = new Map();
    this.processCounter = 0;
    this.maxProcesses = Math.max(2, Math.floor(os.cpus().length / 2)); // Use half of CPU cores
    this.processQueue = [];
    this.isShuttingDown = false;
  }

  /**
   * Fork a child process for heavy operations
   */
  async forkProcess(taskType, options = {}) {
    if (this.isShuttingDown) {
      throw new Error('Process manager is shutting down');
    }

    const processId = `${taskType}_${++this.processCounter}`;
    
    // Wait if we've reached max processes
    if (this.processes.size >= this.maxProcesses) {
      await this.waitForAvailableSlot();
    }

    try {
      const workerPath = path.join(__dirname, 'workers', `${taskType}Worker.js`);
      
      const child = fork(workerPath, [], {
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV,
          ELECTRON_RUN_AS_NODE: '1'
        },
        execArgv: [
          '--max-old-space-size=128', // Limit child process memory
          '--optimize-for-size',
          '--gc-interval=50',
          '--expose-gc',
          '--no-lazy',
          '--memory-pressure-off'
        ],
        ...options
      });

      // Set process priority (lower priority for background tasks)
      try {
        if (process.platform === 'win32') {
          os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
        } else {
          os.setPriority(child.pid, 10); // Nice value 10 (lower priority)
        }
        console.log(`[ChildProcess] Set priority for ${processId} (PID: ${child.pid})`);
      } catch (error) {
        console.warn(`[ChildProcess] Failed to set process priority for ${processId}:`, error.message);
      }

      this.processes.set(processId, {
        child,
        taskType,
        startTime: Date.now(),
        memoryUsage: 0
      });

      // Monitor process memory usage
      this.monitorProcessMemory(processId);

      // Handle process exit
      child.on('exit', (code, signal) => {
        console.log(`[ChildProcess] ${processId} exited with code ${code}, signal ${signal}`);
        this.processes.delete(processId);
        this.processNextInQueue();
      });

      // Handle process errors
      child.on('error', (error) => {
        console.error(`[ChildProcess] ${processId} error:`, error);
        this.processes.delete(processId);
        this.processNextInQueue();
      });

      console.log(`[ChildProcess] Forked ${processId} (PID: ${child.pid})`);
      return { processId, child };

    } catch (error) {
      console.error(`[ChildProcess] Failed to fork ${taskType}:`, error);
      throw error;
    }
  }

  /**
   * Execute a task in a child process
   */
  async executeTask(taskType, taskData, timeout = 30000) {
    return new Promise(async (resolve, reject) => {
      let processInfo;
      let timeoutId;

      try {
        processInfo = await this.forkProcess(taskType);
        const { processId, child } = processInfo;

        // Set timeout
        timeoutId = setTimeout(() => {
          this.killProcess(processId);
          reject(new Error(`Task ${taskType} timed out after ${timeout}ms`));
        }, timeout);

        // Handle task completion
        child.on('message', (message) => {
          if (message.type === 'result') {
            clearTimeout(timeoutId);
            this.killProcess(processId);
            resolve(message.data);
          } else if (message.type === 'error') {
            clearTimeout(timeoutId);
            this.killProcess(processId);
            reject(new Error(message.error));
          } else if (message.type === 'progress') {
            // Handle progress updates if needed
            console.log(`[ChildProcess] ${processId} progress:`, message.progress);
          }
        });

        // Send task data to child process
        child.send({
          type: 'task',
          data: taskData
        });

      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        if (processInfo) this.killProcess(processInfo.processId);
        reject(error);
      }
    });
  }

  /**
   * Kill a specific process
   */
  killProcess(processId) {
    const processInfo = this.processes.get(processId);
    if (processInfo) {
      try {
        processInfo.child.kill('SIGTERM');
        
        // Force kill after 5 seconds if not terminated
        setTimeout(() => {
          if (this.processes.has(processId)) {
            processInfo.child.kill('SIGKILL');
          }
        }, 5000);
        
      } catch (error) {
        console.error(`[ChildProcess] Failed to kill ${processId}:`, error);
      }
    }
  }

  /**
   * Monitor process memory usage
   */
  monitorProcessMemory(processId) {
    const processInfo = this.processes.get(processId);
    if (!processInfo) return;

    const interval = setInterval(() => {
      if (!this.processes.has(processId)) {
        clearInterval(interval);
        return;
      }

      try {
        const memUsage = process.memoryUsage();
        processInfo.memoryUsage = memUsage.rss;

        // Kill process if it uses too much memory (>100MB)
        if (memUsage.rss > 100 * 1024 * 1024) {
          console.warn(`[ChildProcess] ${processId} using too much memory (${Math.round(memUsage.rss / 1024 / 1024)}MB), killing...`);
          this.killProcess(processId);
        }
      } catch (error) {
        // Process might have already exited
        clearInterval(interval);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Wait for an available process slot
   */
  async waitForAvailableSlot() {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.processes.size < this.maxProcesses) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  /**
   * Process next task in queue
   */
  processNextInQueue() {
    if (this.processQueue.length > 0) {
      const nextTask = this.processQueue.shift();
      nextTask();
    }
  }

  /**
   * Get process statistics
   */
  getProcessStats() {
    const stats = {
      activeProcesses: this.processes.size,
      maxProcesses: this.maxProcesses,
      queueLength: this.processQueue.length,
      processes: []
    };

    for (const [processId, info] of this.processes) {
      stats.processes.push({
        id: processId,
        taskType: info.taskType,
        pid: info.child.pid,
        uptime: Date.now() - info.startTime,
        memoryUsage: info.memoryUsage
      });
    }

    return stats;
  }

  /**
   * Shutdown all child processes
   */
  async shutdown() {
    // Prevent multiple shutdowns
    if (this.isShuttingDown) {
      console.log('[ChildProcess] Shutdown already in progress...');
      return;
    }
    
    this.isShuttingDown = true;
    console.log('[ChildProcess] Shutting down all child processes...');

    const shutdownPromises = [];
    
    for (const [processId, processInfo] of this.processes) {
      shutdownPromises.push(new Promise((resolve) => {
        processInfo.child.on('exit', resolve);
        this.killProcess(processId);
      }));
    }

    // Wait for all processes to exit or timeout after 10 seconds
    await Promise.race([
      Promise.all(shutdownPromises),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);

    this.processes.clear();
    console.log('[ChildProcess] All child processes shut down');
  }
}

// Create singleton instance
export const childProcessManager = new ChildProcessManager();

// Note: Cleanup is handled by main.js in the 'before-quit' event
// Removing duplicate process handlers to prevent double shutdown
