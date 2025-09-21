/**
 * Performance Monitor - Advanced performance tracking and optimization
 * Monitors bot performance, memory usage, and provides optimization suggestions
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      commandCount: 0,
      errorCount: 0,
      memoryPeak: 0,
      averageResponseTime: 0,
      responseTimes: [],
      guilds: new Set(),
      channels: new Set(),
      users: new Set()
    };
    
    this.alerts = [];
    this.optimizationSuggestions = [];
    
    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Track command execution
   * @param {string} commandName - Name of the command
   * @param {number} executionTime - Time taken to execute in ms
   * @param {boolean} success - Whether command succeeded
   */
  trackCommand(commandName, executionTime, success = true) {
    this.metrics.commandCount++;
    
    // Track response time
    this.metrics.responseTimes.push(executionTime);
    
    // Keep only last 100 response times for average calculation
    if (this.metrics.responseTimes.length > 100) {
      this.metrics.responseTimes.shift();
    }
    
    // Calculate average response time
    this.metrics.averageResponseTime = 
      this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
    
    // Track errors
    if (!success) {
      this.metrics.errorCount++;
    }
    
    // Check for performance issues
    this.checkPerformanceIssues(commandName, executionTime);
  }

  /**
   * Track memory usage
   */
  trackMemory() {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    
    // Track peak memory usage
    if (heapUsed > this.metrics.memoryPeak) {
      this.metrics.memoryPeak = heapUsed;
    }
    
    // Check for memory issues
    if (heapUsed > 150 * 1024 * 1024) { // 150MB threshold (reduced from 200MB)
      this.addAlert('HIGH_MEMORY', `High memory usage: ${Math.floor(heapUsed / 1024 / 1024)}MB`);
    }
    
    return memUsage;
  }

  /**
   * Track bot activity
   * @param {object} activity - Activity data
   */
  trackActivity(activity) {
    if (activity.guildId) this.metrics.guilds.add(activity.guildId);
    if (activity.channelId) this.metrics.channels.add(activity.channelId);
    if (activity.userId) this.metrics.users.add(activity.userId);
  }

  /**
   * Check for performance issues
   * @param {string} commandName - Command name
   * @param {number} executionTime - Execution time
   */
  checkPerformanceIssues(commandName, executionTime) {
    // Check for slow commands
    if (executionTime > 5000) { // 5 seconds
      this.addAlert('SLOW_COMMAND', `Slow command: ${commandName} took ${executionTime}ms`);
    }
    
    // Check for high error rate
    const errorRate = this.metrics.errorCount / this.metrics.commandCount;
    if (this.metrics.commandCount > 10 && errorRate > 0.1) { // 10% error rate
      this.addAlert('HIGH_ERROR_RATE', `High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }
    
    // Check for memory leaks
    const memUsage = this.trackMemory();
    if (memUsage.heapUsed > 120 * 1024 * 1024) { // 120MB (reduced from 150MB)
      this.addAlert('MEMORY_LEAK', 'Potential memory leak detected');
    }
  }

  /**
   * Add performance alert
   * @param {string} type - Alert type
   * @param {string} message - Alert message
   */
  addAlert(type, message) {
    const alert = {
      type,
      message,
      timestamp: Date.now(),
      severity: this.getAlertSeverity(type)
    };
    
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
    
    console.log(`⚠️ Performance Alert [${type}]: ${message}`);
  }

  /**
   * Get alert severity
   * @param {string} type - Alert type
   * @returns {string} - Severity level
   */
  getAlertSeverity(type) {
    const severityMap = {
      'HIGH_MEMORY': 'HIGH',
      'MEMORY_LEAK': 'HIGH',
      'SLOW_COMMAND': 'MEDIUM',
      'HIGH_ERROR_RATE': 'HIGH'
    };
    
    return severityMap[type] || 'LOW';
  }

  /**
   * Generate optimization suggestions
   */
  generateOptimizationSuggestions() {
    this.optimizationSuggestions = [];
    
    // Memory optimization suggestions
    if (this.metrics.memoryPeak > 100 * 1024 * 1024) {
      this.optimizationSuggestions.push({
        type: 'MEMORY',
        suggestion: 'Consider reducing cache sizes or implementing more aggressive garbage collection',
        priority: 'HIGH'
      });
    }
    
    // Response time optimization suggestions
    if (this.metrics.averageResponseTime > 2000) {
      this.optimizationSuggestions.push({
        type: 'PERFORMANCE',
        suggestion: 'Consider optimizing command execution or implementing caching',
        priority: 'MEDIUM'
      });
    }
    
    // Error rate optimization suggestions
    const errorRate = this.metrics.errorCount / this.metrics.commandCount;
    if (errorRate > 0.05) { // 5% error rate
      this.optimizationSuggestions.push({
        type: 'RELIABILITY',
        suggestion: 'Investigate and fix common error sources',
        priority: 'HIGH'
      });
    }
    
    return this.optimizationSuggestions;
  }

  /**
   * Get comprehensive performance report
   * @returns {object} - Performance report
   */
  getReport() {
    const uptime = Date.now() - this.metrics.startTime;
    const memUsage = this.trackMemory();
    
    return {
      uptime: Math.floor(uptime / 1000),
      commands: this.metrics.commandCount,
      errors: this.metrics.errorCount,
      errorRate: this.metrics.commandCount > 0 ? 
        ((this.metrics.errorCount / this.metrics.commandCount) * 100).toFixed(2) + '%' : '0%',
      averageResponseTime: Math.floor(this.metrics.averageResponseTime) + 'ms',
      memory: {
        current: Math.floor(memUsage.heapUsed / 1024 / 1024) + 'MB',
        peak: Math.floor(this.metrics.memoryPeak / 1024 / 1024) + 'MB',
        rss: Math.floor(memUsage.rss / 1024 / 1024) + 'MB'
      },
      activity: {
        guilds: this.metrics.guilds.size,
        channels: this.metrics.channels.size,
        users: this.metrics.users.size
      },
      alerts: this.alerts.slice(-10), // Last 10 alerts
      suggestions: this.generateOptimizationSuggestions()
    };
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    // Monitor memory every 30 seconds
    this.memoryInterval = setInterval(() => {
      this.trackMemory();
    }, 30000);
    
    // Generate reports every 5 minutes
    this.reportInterval = setInterval(() => {
      const report = this.getReport();
      console.log('📊 Performance Report:', {
        uptime: report.uptime + 's',
        memory: report.memory.current,
        commands: report.commands,
        errorRate: report.errorRate,
        avgResponse: report.averageResponseTime
      });
    }, 300000);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      startTime: Date.now(),
      commandCount: 0,
      errorCount: 0,
      memoryPeak: 0,
      averageResponseTime: 0,
      responseTimes: [],
      guilds: new Set(),
      channels: new Set(),
      users: new Set()
    };
    this.alerts = [];
    this.optimizationSuggestions = [];
  }
}

module.exports = PerformanceMonitor;
