# Memory Reports Guide

## 📊 **Where Memory Reports Are Saved**

### **1. File Locations (Electron App)**

When you save reports in the Electron app, they are saved to:

**Windows**: `C:\Users\[YourUsername]\Documents\Researcher\Memory Reports\`
**macOS**: `/Users/[YourUsername]/Documents/Researcher/Memory Reports/`
**Linux**: `/home/[YourUsername]/Documents/Researcher/Memory Reports/`

### **2. File Types Generated**

Each report creates **two files**:

1. **`.txt` file** - Human-readable report
   ```
   memory-report-2024-01-15T10-30-45-123Z.txt
   ```

2. **`.json` file** - Machine-readable data for analysis
   ```
   memory-report-2024-01-15T10-30-45-123Z.json
   ```

## 🎯 **How to Generate Reports**

### **Method 1: Memory Dashboard (Recommended)**
1. Press `Ctrl+Shift+M` to open Memory Monitor Dashboard
2. Click **"Save Report"** button
3. Files are automatically saved to Documents folder

### **Method 2: Browser Console**
```javascript
// Generate and save report
window.memoryMonitor.generateReport(true);

// Just view in console (no file save)
window.memoryMonitor.generateReport();
```

### **Method 3: Programmatic (In Code)**
```typescript
import { memoryMonitor } from './utils/memoryMonitor';

// Save to file
memoryMonitor.generateReport(true);

// Console only
memoryMonitor.generateReport();
```

## 📋 **Report Contents**

### **Text Report (.txt) Contains:**
```
Memory Usage Report - 1/15/2024, 10:30:45 AM
============================================================

📈 Current Memory: 245.67 MB
📉 Initial Memory: 89.23 MB
🔄 Memory Growth: 156.44 MB
🏔️ Peak Memory: 267.89 MB at 10:28:15 AM
⏱️ Monitoring Duration: 1847s
📊 Total Operations: 23

🔝 Top Memory-Consuming Operations:
----------------------------------------
1. Document Load - Large Document.rsrch: +45.67 MB
   Time: 10:25:30 AM
   Before: 120.45 MB → After: 166.12 MB

2. Image Processing - 4K Image: +23.45 MB
   Time: 10:27:15 AM
   Before: 180.23 MB → After: 203.68 MB
```

### **JSON Report (.json) Contains:**
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "summary": {
    "currentMemory": 257489920,
    "initialMemory": 93552640,
    "memoryGrowth": 163937280,
    "peakMemory": 280723456,
    "peakTimestamp": 1705312095000,
    "totalOperations": 23,
    "monitoringDuration": 1847000
  },
  "memoryHistory": [...],
  "topOperations": [...],
  "allOperations": [...]
}
```

## 🔍 **Analyzing Reports**

### **Key Metrics to Watch:**

1. **Memory Growth** - How much memory increased since start
2. **Peak Memory** - Highest memory usage reached
3. **Top Operations** - Which operations consume most memory
4. **Monitoring Duration** - How long the app has been running

### **Warning Signs:**
- **High Growth**: >500MB growth indicates potential leaks
- **Frequent Peaks**: Memory spikes during normal operations
- **Large Operations**: Single operations using >50MB

### **Using JSON Data:**
```javascript
// Load and analyze JSON report
const report = JSON.parse(reportContent);

// Find memory leaks
const growthRate = report.summary.memoryGrowth / report.summary.monitoringDuration;
console.log(`Memory growth rate: ${growthRate} bytes/ms`);

// Analyze operation patterns
const heavyOps = report.topOperations.filter(op => op.memoryIncrease > 50 * 1024 * 1024);
console.log('Operations using >50MB:', heavyOps);
```

## 🛠 **Automated Reporting**

### **Periodic Reports**
```typescript
// Auto-save report every 10 minutes
setInterval(() => {
  memoryMonitor.generateReport(true);
}, 10 * 60 * 1000);
```

### **Threshold-Based Reports**
```typescript
// Save report when memory exceeds threshold
memoryMonitor.onMemoryThreshold(500 * 1024 * 1024, () => {
  console.warn('High memory usage detected!');
  memoryMonitor.generateReport(true);
});
```

## 📁 **File Management**

### **Report File Naming:**
```
memory-report-YYYY-MM-DDTHH-MM-SS-sssZ.txt
memory-report-YYYY-MM-DDTHH-MM-SS-sssZ.json
```

### **Cleanup Old Reports:**
Reports accumulate over time. Consider cleaning up old files:

**Windows PowerShell:**
```powershell
Get-ChildItem "$env:USERPROFILE\Documents\Researcher\Memory Reports" -Name "memory-report-*.txt" | 
Where-Object {$_.CreationTime -lt (Get-Date).AddDays(-7)} | 
Remove-Item
```

**macOS/Linux:**
```bash
find ~/Documents/Researcher/Memory\ Reports/ -name "memory-report-*.txt" -mtime +7 -delete
```

## 🚨 **Troubleshooting**

### **Reports Not Saving**
1. Check if Documents folder exists and is writable
2. Look for error messages in console
3. Try browser download fallback (if in web mode)

### **Large Report Files**
- JSON files can be large with extensive operation history
- Consider clearing history periodically: `memoryMonitor.clearHistory()`

### **Missing Data**
- Reports only contain data from current session
- Start monitoring early in app lifecycle for complete data

## 💡 **Best Practices**

1. **Save reports before closing app** - Data is lost on restart
2. **Generate reports after heavy operations** - Document load, image processing
3. **Compare reports over time** - Track memory usage patterns
4. **Use JSON for analysis** - Text for human reading, JSON for processing
5. **Monitor during typical usage** - Don't just test empty app

The memory reporting system helps you identify exactly where your app is consuming memory and track improvements over time!

