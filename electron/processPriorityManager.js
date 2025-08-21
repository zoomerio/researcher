/**
 * Process Priority Manager - Safe Version
 * Manages process priorities for better performance
 */

import os from 'node:os';

class ProcessPriorityManager {
  constructor() {
    this.isWindows = process.platform === 'win32';
    this.isAvailable = false;
    
    // Simple, safe priority values
    this.priorities = {
      HIGH: -10,
      ABOVE_NORMAL: -5,
      NORMAL: 0,
      BELOW_NORMAL: 5,
      LOW: 10,
      IDLE: 19
    };
    
    // Override with Windows constants if available
    if (this.isWindows) {
      try {
        const winPriorities = os.constants?.priority;
        if (winPriorities) {
          this.priorities.HIGH = winPriorities.PRIORITY_HIGH;
          this.priorities.ABOVE_NORMAL = winPriorities.PRIORITY_ABOVE_NORMAL;
          this.priorities.NORMAL = winPriorities.PRIORITY_NORMAL;
          this.priorities.BELOW_NORMAL = winPriorities.PRIORITY_BELOW_NORMAL;
          this.priorities.LOW = winPriorities.PRIORITY_LOW;
          this.priorities.IDLE = winPriorities.PRIORITY_IDLE;
        }
      } catch (error) {
        console.warn('[ProcessPriority] Could not load Windows priority constants, using defaults');
      }
    }
    
    this.processStates = new Map();
    this.inactivityTimer = null;
    this.lastActivity = Date.now();
    
    // Initialize safely
    this.initialize();
  }
  
  initialize() {
    console.log('[ProcessPriority] Initializing...');
    
    // Check if priority management is available
    if (typeof os.setPriority !== 'function') {
      console.warn('[ProcessPriority] Priority management not available on this platform');
      return;
    }
    
    try {
      // Test with current process
      const currentPriority = os.getPriority(process.pid);
      console.log(`[ProcessPriority] Current priority: ${currentPriority}`);
      
      // Try to set priority
      os.setPriority(process.pid, this.priorities.ABOVE_NORMAL);
      console.log('[ProcessPriority] Successfully set main process priority');
      this.isAvailable = true;
      
      this.startInactivityMonitoring();
    } catch (error) {
      console.warn('[ProcessPriority] Failed to initialize:', error.message);
      console.warn('[ProcessPriority] Priority management disabled');
    }
  }
  
  setPriority(pid, priority, reason = '') {
    if (!this.isAvailable) return false;
    
    try {
      const targetPid = pid || process.pid;
      const priorityValue = typeof priority === 'string' ? this.priorities[priority] : priority;
      
      os.setPriority(targetPid, priorityValue);
      
      this.processStates.set(targetPid, {
        priority: priorityValue,
        reason,
        timestamp: Date.now()
      });
      
      console.log(`[ProcessPriority] Set PID ${targetPid} to priority ${priorityValue} (${reason})`);
      return true;
    } catch (error) {
      console.warn(`[ProcessPriority] Failed to set priority for PID ${pid || process.pid}:`, error.message);
      return false;
    }
  }
  
  setBackgroundPriority(pid, reason = 'Background task') {
    return this.setPriority(pid, this.priorities.BELOW_NORMAL, reason);
  }
  
  recordActivity() {
    if (!this.isAvailable) return;
    
    this.lastActivity = Date.now();
    
    // Reset inactivity timer
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    
    // Set timer for inactivity detection
    this.inactivityTimer = setTimeout(() => {
      this.handleInactivity();
    }, 60000); // 1 minute of inactivity
  }
  
  handleInactivity() {
    if (!this.isAvailable) return;
    
    console.log('[ProcessPriority] User inactive, reducing priority');
    this.setPriority(process.pid, this.priorities.NORMAL, 'User inactive');
  }
  
  startInactivityMonitoring() {
    if (!this.isAvailable) return;
    
    // Initial activity record
    this.recordActivity();
    console.log('[ProcessPriority] Inactivity monitoring started');
  }
  
  shutdown() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    
    // Reset to normal priority on shutdown
    if (this.isAvailable) {
      try {
        this.setPriority(process.pid, this.priorities.NORMAL, 'Shutdown');
      } catch (error) {
        console.warn('[ProcessPriority] Error resetting priority on shutdown:', error.message);
      }
    }
    
    console.log('[ProcessPriority] Shutdown complete');
  }
}

// Create and export singleton instance
export const processPriorityManager = new ProcessPriorityManager();