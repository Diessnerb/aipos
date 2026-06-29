import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Activity, Database, Cpu, HardDrive, Wifi, AlertTriangle, CheckCircle, Clock, Server, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SystemHealth {
  database: {
    size_mb: number;
    table_count: number;
    active_connections: number;
    connection_limit: number;
    temp_files_mb?: number;
    wal_size_mb?: number;
    table_bloat_percent?: number;
    unused_indexes?: number;
  };
  performance: {
    avg_query_time_ms: number;
    slow_queries_24h: number;
    cache_hit_ratio: number;
    index_usage: number;
    db_performance_score?: number;
  };
  errors: {
    total_24h: number;
    critical_24h: number;
    warning_24h: number;
    last_error: string | null;
  };
  resources: {
    cpu_usage_percent: number;
    memory_usage_percent: number;
    disk_usage_percent: number;
    network_io_mbps: number;
  };
  memory: {
    shared_buffers_mb: number;
    buffer_cache_hit_ratio: number;
    buffer_alloc_per_sec: number;
    checkpoint_frequency: number;
    memory_for_connections_mb: number;
    work_mem_total_mb: number;
    maintenance_work_mem_mb: number;
    effective_cache_size_mb: number;
    memory_efficiency_score: number;
  };
  cpu: {
    load_avg_1min: number;
    load_avg_5min: number;
    load_avg_15min: number;
    cpu_user_percent: number;
    cpu_system_percent: number;
    cpu_idle_percent: number;
    cpu_iowait_percent: number;
    total_backends: number;
    active_backends: number;
    waiting_backends: number;
    cpu_efficiency_score: number;
  };
  uptime: {
    current_uptime_hours: number;
    uptime_percent_30d: number;
    last_downtime: string;
  };
  metrics_info?: {
    total_users: number;
    total_companies: number;
    optimization_applied: boolean;
    last_optimized: string;
  };
  timestamp: string;
}

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemHealth: SystemHealth | null;
  loading?: boolean;
}

export const SystemHealthModal: React.FC<SystemHealthModalProps> = ({
  isOpen,
  onClose,
  systemHealth,
  loading = false
}) => {
  const getHealthColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthStatus = (percentage: number) => {
    if (percentage >= 90) return { color: 'text-green-600', bg: 'bg-green-100', status: 'Excellent', icon: CheckCircle };
    if (percentage >= 70) return { color: 'text-yellow-600', bg: 'bg-yellow-100', status: 'Good', icon: Minus };
    return { color: 'text-red-600', bg: 'bg-red-100', status: 'Needs Attention', icon: AlertTriangle };
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getImprovements = (metric: string, value: number) => {
    const improvements: { [key: string]: { immediate: string[], shortTerm: string[], longTerm: string[] } } = {
      overall: {
        immediate: ['Monitor resource spikes', 'Check for blocking processes', 'Clear temporary files'],
        shortTerm: ['Optimize database queries', 'Scale resources if needed', 'Implement monitoring alerts'],
        longTerm: ['Consider load balancing', 'Database partitioning', 'Infrastructure migration']
      },
      memory: {
        immediate: ['Increase shared_buffers for better caching', 'Optimize work_mem settings', 'Review connection pooling'],
        shortTerm: ['Monitor buffer cache efficiency', 'Adjust checkpoint frequency', 'Optimize memory allocation'],
        longTerm: ['Implement memory monitoring', 'Consider memory upgrades', 'Database memory tuning']
      },
      cpu: {
        immediate: ['Optimize slow queries', 'Review I/O wait patterns', 'Check for blocking processes'],
        shortTerm: ['Implement connection pooling', 'Add query indexes', 'Monitor backend limits'],
        longTerm: ['Consider CPU scaling', 'Load balancing', 'Query optimization automation']
      },
      uptime: {
        immediate: ['Check service status', 'Verify connectivity', 'Review recent deployments'],
        shortTerm: ['Implement health checks', 'Set up redundancy', 'Monitor dependency services'],
        longTerm: ['Multi-region deployment', 'Disaster recovery plan', 'Service mesh implementation']
      },
      errors: {
        immediate: ['Review error logs', 'Check recent changes', 'Verify configurations'],
        shortTerm: ['Implement better error handling', 'Add more logging', 'Set up error alerts'],
        longTerm: ['Automated error recovery', 'Better testing coverage', 'Error tracking system']
      },
      response: {
        immediate: ['Check query execution plans', 'Clear query cache', 'Review recent queries'],
        shortTerm: ['Add database indexes', 'Optimize slow queries', 'Implement query caching'],
        longTerm: ['Database sharding', 'Read replicas', 'Query optimization tools']
      }
    };
    return improvements[metric] || improvements.overall;
  };

  const formatUptime = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>System Health</DialogTitle>
            <DialogDescription>Loading system health data...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!systemHealth) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>System Health</DialogTitle>
            <DialogDescription>Failed to load system health data</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <p className="text-lg font-medium">Unable to load system health data</p>
            <p className="text-sm text-muted-foreground">Please try refreshing the page or contact support</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Enhanced health calculations using new scoring system
  const getMemoryHealth = () => {
    if (systemHealth?.memory?.memory_efficiency_score) {
      return systemHealth.memory.memory_efficiency_score;
    }
    // Fallback calculation
    return Math.max(0, 100 - systemHealth.resources.memory_usage_percent);
  };
  
  const getCpuHealth = () => {
    if (systemHealth?.cpu?.cpu_efficiency_score) {
      return systemHealth.cpu.cpu_efficiency_score;
    }
    // Fallback calculation
    return Math.max(0, 100 - systemHealth.resources.cpu_usage_percent);
  };
  
  const memoryHealth = getMemoryHealth();
  const cpuHealth = getCpuHealth();
  
  // Enhanced disk health calculation with thresholds
  const getDiskHealth = () => {
    const usage = systemHealth.resources.disk_usage_percent;
    if (usage < 70) return 95;      // Excellent - plenty of space
    if (usage < 85) return 75;      // Good but monitoring needed
    if (usage < 95) return 50;      // Warning - action needed
    return 25;                      // Critical - immediate action required
  };
  const diskHealth = getDiskHealth();
  
  const performanceHealth = systemHealth.performance.cache_hit_ratio;
  const uptimeHealth = systemHealth.uptime.uptime_percent_30d;
  
  // Weighted scoring: Performance and Memory are most important
  const overallHealth = (
    memoryHealth * 0.25 +        // 25% weight on memory
    cpuHealth * 0.20 +           // 20% weight on CPU
    performanceHealth * 0.25 +    // 25% weight on performance
    uptimeHealth * 0.20 +        // 20% weight on uptime
    diskHealth * 0.10            // 10% weight on disk
  );

  const isOptimized = systemHealth.metrics_info?.optimization_applied;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health Dashboard
          </DialogTitle>
          <DialogDescription>
            Real-time monitoring of system performance and health metrics
          </DialogDescription>
        </DialogHeader>
        
        {/* Enhanced Health Summary with Dropdowns */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Overall Health Card */}
          <Card>
            <CardContent className="pt-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-accent/50 p-2 rounded transition-colors">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Overall Health</p>
                      <p className={`text-2xl font-bold ${getHealthColor(overallHealth)}`}>
                        {overallHealth.toFixed(1)}%
                      </p>
                      {isOptimized && (
                        <p className="text-xs text-green-600 font-medium">✓ Recently Optimized</p>
                      )}
                    </div>
                    <div className="flex flex-col items-center">
                      <CheckCircle className={`h-6 w-6 ${getHealthColor(overallHealth)}`} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground mt-1" />
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 z-50 bg-background border shadow-lg">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getHealthStatus(overallHealth).bg}`}></div>
                    Health Breakdown - {getHealthStatus(overallHealth).status}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="p-2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Memory Health:</span>
                      <span className={getHealthColor(memoryHealth)}>{memoryHealth.toFixed(0)}% (25% weight)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Performance:</span>
                      <span className={getHealthColor(performanceHealth)}>{performanceHealth.toFixed(0)}% (25% weight)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>CPU Health:</span>
                      <span className={getHealthColor(cpuHealth)}>{cpuHealth.toFixed(0)}% (20% weight)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Uptime:</span>
                      <span className={getHealthColor(uptimeHealth)}>{uptimeHealth.toFixed(0)}% (20% weight)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Disk Health:</span>
                      <span className={getHealthColor(diskHealth)}>{diskHealth.toFixed(0)}% (10% weight)</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Improvements:</p>
                    {getImprovements('overall', overallHealth).immediate.slice(0, 2).map((item, index) => (
                      <p key={index} className="text-xs text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
          
          {/* Uptime Card */}
          <Card>
            <CardContent className="pt-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-accent/50 p-2 rounded transition-colors">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Uptime (30d)</p>
                      <p className={`text-2xl font-bold ${getHealthColor(systemHealth.uptime.uptime_percent_30d)}`}>
                        {systemHealth.uptime.uptime_percent_30d}%
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <Clock className={`h-6 w-6 ${getHealthColor(systemHealth.uptime.uptime_percent_30d)}`} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground mt-1" />
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 z-50 bg-background border shadow-lg">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getHealthStatus(systemHealth.uptime.uptime_percent_30d).bg}`}></div>
                    Uptime Analysis - {getHealthStatus(systemHealth.uptime.uptime_percent_30d).status}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="p-2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Current Uptime:</span>
                      <span>{formatUptime(systemHealth.uptime.current_uptime_hours)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>30-Day Average:</span>
                      <span className={getHealthColor(systemHealth.uptime.uptime_percent_30d)}>{systemHealth.uptime.uptime_percent_30d}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Last Downtime:</span>
                      <span className="text-xs">{new Date(systemHealth.uptime.last_downtime).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Target SLA:</span>
                      <span className="text-green-600">99.9%</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recommendations:</p>
                    {getImprovements('uptime', systemHealth.uptime.uptime_percent_30d).immediate.slice(0, 2).map((item, index) => (
                      <p key={index} className="text-xs text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
          
          {/* Errors Card */}
          <Card>
            <CardContent className="pt-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-accent/50 p-2 rounded transition-colors">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Errors (24h)</p>
                      <p className={`text-2xl font-bold ${systemHealth.errors.total_24h > 10 ? 'text-red-600' : systemHealth.errors.total_24h > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {systemHealth.errors.total_24h}
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <AlertTriangle className={`h-6 w-6 ${systemHealth.errors.total_24h > 10 ? 'text-red-600' : systemHealth.errors.total_24h > 0 ? 'text-yellow-600' : 'text-green-600'}`} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground mt-1" />
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 z-50 bg-background border shadow-lg">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${systemHealth.errors.total_24h > 10 ? 'bg-red-100' : systemHealth.errors.total_24h > 0 ? 'bg-yellow-100' : 'bg-green-100'}`}></div>
                    Error Analysis - {systemHealth.errors.total_24h > 10 ? 'Critical' : systemHealth.errors.total_24h > 0 ? 'Monitor' : 'Good'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="p-2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Errors:</span>
                      <span className="text-red-600">{systemHealth.errors.total_24h}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Critical:</span>
                      <span className="text-red-600">{systemHealth.errors.critical_24h}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Warnings:</span>
                      <span className="text-yellow-600">{systemHealth.errors.warning_24h}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Error Rate:</span>
                      <span>{((systemHealth.errors.total_24h / 24) || 0).toFixed(1)}/hour</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Action Items:</p>
                    {getImprovements('errors', systemHealth.errors.total_24h).immediate.slice(0, 2).map((item, index) => (
                      <p key={index} className="text-xs text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
          
          {/* Response Time Card */}
          <Card>
            <CardContent className="pt-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-accent/50 p-2 rounded transition-colors">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Response Time</p>
                      <p className={`text-2xl font-bold ${systemHealth.performance.avg_query_time_ms > 1000 ? 'text-red-600' : systemHealth.performance.avg_query_time_ms > 500 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {systemHealth.performance.avg_query_time_ms}ms
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <Server className={`h-6 w-6 ${systemHealth.performance.avg_query_time_ms > 1000 ? 'text-red-600' : systemHealth.performance.avg_query_time_ms > 500 ? 'text-yellow-600' : 'text-green-600'}`} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground mt-1" />
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 z-50 bg-background border shadow-lg">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${systemHealth.performance.avg_query_time_ms > 1000 ? 'bg-red-100' : systemHealth.performance.avg_query_time_ms > 500 ? 'bg-yellow-100' : 'bg-green-100'}`}></div>
                    Performance Analysis - {systemHealth.performance.avg_query_time_ms > 1000 ? 'Slow' : systemHealth.performance.avg_query_time_ms > 500 ? 'Moderate' : 'Fast'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="p-2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Avg Response:</span>
                      <span className={systemHealth.performance.avg_query_time_ms > 1000 ? 'text-red-600' : 'text-green-600'}>{systemHealth.performance.avg_query_time_ms}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Slow Queries (24h):</span>
                      <span className="text-yellow-600">{systemHealth.performance.slow_queries_24h}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Cache Hit Ratio:</span>
                      <span className={getHealthColor(systemHealth.performance.cache_hit_ratio)}>{systemHealth.performance.cache_hit_ratio}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Target Response:</span>
                      <span className="text-green-600">&lt;200ms</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Optimizations:</p>
                    {getImprovements('response', systemHealth.performance.avg_query_time_ms).immediate.slice(0, 2).map((item, index) => (
                      <p key={index} className="text-xs text-muted-foreground">• {item}</p>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="resources" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="cpu">CPU</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="errors">Errors & Logs</TabsTrigger>
          </TabsList>
          
          <div className="mt-4 overflow-auto max-h-96">
            <TabsContent value="resources" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      CPU Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Current</span>
                        <span className="font-mono">{systemHealth.resources.cpu_usage_percent}%</span>
                      </div>
                      <Progress 
                        value={systemHealth.resources.cpu_usage_percent} 
                        className={getProgressColor(systemHealth.resources.cpu_usage_percent)}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      Memory Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Current</span>
                        <span className="font-mono">{systemHealth.resources.memory_usage_percent}%</span>
                      </div>
                      <Progress 
                        value={systemHealth.resources.memory_usage_percent}
                        className={getProgressColor(systemHealth.resources.memory_usage_percent)}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        Disk Health
                        <Badge className={`${getHealthStatus(diskHealth).bg} ${getHealthStatus(diskHealth).color}`}>
                          {getHealthStatus(diskHealth).status}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 text-sm hover:bg-accent rounded p-1">
                          <span className={getHealthColor(diskHealth)}>{diskHealth.toFixed(1)}%</span>
                          <ChevronDown className="h-3 w-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-80">
                          <DropdownMenuLabel>Disk Health Analysis</DropdownMenuLabel>
                          <div className="p-3 space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span>Disk Usage:</span>
                                <span className="font-medium">{systemHealth.resources.disk_usage_percent}%</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span>Free Space:</span>
                                <span className="font-medium">{(100 - systemHealth.resources.disk_usage_percent).toFixed(1)}% available</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span>Database Size:</span>
                                <span className="font-medium">{systemHealth.database.size_mb} MB</span>
                              </div>
                              {systemHealth.database.temp_files_mb !== undefined && (
                                <div className="flex items-center justify-between text-sm">
                                  <span>Temp Files:</span>
                                  <span className="font-medium">{systemHealth.database.temp_files_mb} MB</span>
                                </div>
                              )}
                              {systemHealth.database.wal_size_mb !== undefined && (
                                <div className="flex items-center justify-between text-sm">
                                  <span>WAL Size:</span>
                                  <span className="font-medium">{systemHealth.database.wal_size_mb} MB</span>
                                </div>
                              )}
                              {systemHealth.database.table_bloat_percent !== undefined && (
                                <div className="flex items-center justify-between text-sm">
                                  <span>Table Bloat:</span>
                                  <span className="font-medium">{systemHealth.database.table_bloat_percent}%</span>
                                </div>
                              )}
                              {systemHealth.database.unused_indexes !== undefined && (
                                <div className="flex items-center justify-between text-sm">
                                  <span>Unused Indexes:</span>
                                  <span className="font-medium">{systemHealth.database.unused_indexes}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-sm">
                                <span>Status:</span>
                                <span className="flex items-center gap-1">
                                  {systemHealth.resources.disk_usage_percent < 70 ? (
                                    <>
                                      <TrendingUp className="h-3 w-3 text-green-600" />
                                      <span className="text-green-600">Healthy</span>
                                    </>
                                  ) : systemHealth.resources.disk_usage_percent < 85 ? (
                                    <>
                                      <Minus className="h-3 w-3 text-yellow-600" />
                                      <span className="text-yellow-600">Monitoring</span>
                                    </>
                                  ) : (
                                    <>
                                      <TrendingDown className="h-3 w-3 text-red-600" />
                                      <span className="text-red-600">Critical</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                            <DropdownMenuSeparator />
                            <div className="space-y-1">
                              <h5 className="text-xs font-semibold text-muted-foreground">IMMEDIATE ACTIONS</h5>
                              <ul className="text-xs space-y-1">
                                {systemHealth.resources.disk_usage_percent > 85 ? (
                                  <>
                                    <li>• <strong>URGENT:</strong> Clear temp files and logs</li>
                                    <li>• Run VACUUM FULL on bloated tables</li>
                                    <li>• Archive or delete old data</li>
                                  </>
                                ) : systemHealth.resources.disk_usage_percent > 70 ? (
                                  <>
                                    <li>• Schedule VACUUM ANALYZE for large tables</li>
                                    <li>• Review table bloat and optimize</li>
                                    <li>• Monitor disk usage trends</li>
                                  </>
                                ) : (
                                  <>
                                    <li>• Regular maintenance scheduled</li>
                                    <li>• Monitor for unusual growth patterns</li>
                                    <li>• Consider data archival strategies</li>
                                  </>
                                )}
                                {systemHealth.database.unused_indexes && systemHealth.database.unused_indexes > 0 && (
                                  <li>• Drop {systemHealth.database.unused_indexes} unused indexes</li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Usage</span>
                        <span className="font-mono">{systemHealth.resources.disk_usage_percent}%</span>
                      </div>
                      <Progress 
                        value={systemHealth.resources.disk_usage_percent}
                        className={getProgressColor(systemHealth.resources.disk_usage_percent)}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Health Score: {diskHealth.toFixed(1)}%</span>
                        <span>{(100 - systemHealth.resources.disk_usage_percent).toFixed(1)}% free</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <Wifi className="h-4 w-4" />
                      Network I/O
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Current</span>
                        <span className="font-mono">{systemHealth.resources.network_io_mbps} Mbps</span>
                      </div>
                      <Progress value={Math.min(systemHealth.resources.network_io_mbps * 10, 100)} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="memory" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      Memory Efficiency Score: {memoryHealth.toFixed(1)}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {systemHealth.memory ? (
                      <>
                        <div className="flex justify-between">
                          <span>Buffer Cache Hit Ratio</span>
                          <span className={`font-mono ${getHealthColor(systemHealth.memory.buffer_cache_hit_ratio)}`}>
                            {systemHealth.memory.buffer_cache_hit_ratio.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shared Buffers</span>
                          <span className="font-mono">{systemHealth.memory.shared_buffers_mb.toFixed(0)} MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Memory for Connections</span>
                          <span className="font-mono">{systemHealth.memory.memory_for_connections_mb.toFixed(0)} MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Buffer Allocations/sec</span>
                          <span className="font-mono">{systemHealth.memory.buffer_alloc_per_sec.toFixed(1)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span>Overall Memory Usage</span>
                        <span className="font-mono">{systemHealth.resources.memory_usage_percent}%</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Memory Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {systemHealth.memory ? (
                      <>
                        <div className="flex justify-between">
                          <span>Work Memory Total</span>
                          <span className="font-mono">{systemHealth.memory.work_mem_total_mb.toFixed(0)} MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Maintenance Work Memory</span>
                          <span className="font-mono">{systemHealth.memory.maintenance_work_mem_mb.toFixed(0)} MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Effective Cache Size</span>
                          <span className="font-mono">{systemHealth.memory.effective_cache_size_mb.toFixed(0)} MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Checkpoint Frequency</span>
                          <Badge variant={systemHealth.memory.checkpoint_frequency > 100 ? 'destructive' : 'secondary'}>
                            {systemHealth.memory.checkpoint_frequency}
                          </Badge>
                        </div>
                      </>
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        Detailed memory metrics not available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {systemHealth.memory && (
                <Card>
                  <CardHeader>
                    <CardTitle>Memory Optimization Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {memoryHealth < 80 && (
                        <>
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                            <div>
                              <p className="font-medium">Immediate Actions:</p>
                              <ul className="text-muted-foreground space-y-1 mt-1">
                                {getImprovements('memory', memoryHealth).immediate.map((item, index) => (
                                  <li key={index}>• {item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                            <div>
                              <p className="font-medium">Short-term Improvements:</p>
                              <ul className="text-muted-foreground space-y-1 mt-1">
                                {getImprovements('memory', memoryHealth).shortTerm.map((item, index) => (
                                  <li key={index}>• {item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </>
                      )}
                      {memoryHealth >= 80 && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>Memory is performing optimally</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="cpu" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      CPU Efficiency Score: {cpuHealth.toFixed(1)}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {systemHealth.cpu ? (
                      <>
                        <div className="flex justify-between">
                          <span>User CPU</span>
                          <span className="font-mono">{systemHealth.cpu.cpu_user_percent.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>System CPU</span>
                          <span className="font-mono">{systemHealth.cpu.cpu_system_percent.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>CPU Idle</span>
                          <span className={`font-mono ${getHealthColor(systemHealth.cpu.cpu_idle_percent)}`}>
                            {systemHealth.cpu.cpu_idle_percent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>I/O Wait</span>
                          <span className={`font-mono ${systemHealth.cpu.cpu_iowait_percent > 10 ? 'text-red-600' : 'text-green-600'}`}>
                            {systemHealth.cpu.cpu_iowait_percent.toFixed(1)}%
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span>Overall CPU Usage</span>
                        <span className="font-mono">{systemHealth.resources.cpu_usage_percent}%</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Load & Backends</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {systemHealth.cpu ? (
                      <>
                        <div className="flex justify-between">
                          <span>Load Average (1m)</span>
                          <span className="font-mono">{systemHealth.cpu.load_avg_1min.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Load Average (5m)</span>
                          <span className="font-mono">{systemHealth.cpu.load_avg_5min.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Load Average (15m)</span>
                          <span className="font-mono">{systemHealth.cpu.load_avg_15min.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Active Backends</span>
                          <Badge variant={systemHealth.cpu.active_backends > systemHealth.cpu.total_backends * 0.8 ? 'destructive' : 'secondary'}>
                            {systemHealth.cpu.active_backends} / {systemHealth.cpu.total_backends}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Waiting Backends</span>
                          <Badge variant={systemHealth.cpu.waiting_backends > 5 ? 'destructive' : 'secondary'}>
                            {systemHealth.cpu.waiting_backends}
                          </Badge>
                        </div>
                      </>
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        Detailed CPU metrics not available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {systemHealth.cpu && (
                <Card>
                  <CardHeader>
                    <CardTitle>CPU Optimization Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {cpuHealth < 80 && (
                        <>
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                            <div>
                              <p className="font-medium">Immediate Actions:</p>
                              <ul className="text-muted-foreground space-y-1 mt-1">
                                {getImprovements('cpu', cpuHealth).immediate.map((item, index) => (
                                  <li key={index}>• {item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                            <div>
                              <p className="font-medium">Short-term Improvements:</p>
                              <ul className="text-muted-foreground space-y-1 mt-1">
                                {getImprovements('cpu', cpuHealth).shortTerm.map((item, index) => (
                                  <li key={index}>• {item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </>
                      )}
                      {cpuHealth >= 80 && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>CPU is performing optimally</span>
                        </div>
                      )}
                      {systemHealth.cpu.cpu_iowait_percent > 10 && (
                        <div className="flex items-start gap-2 mt-2">
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-600">High I/O Wait Detected</p>
                            <p className="text-muted-foreground">Consider disk performance optimization and query tuning</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="database" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Database Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Database Size</span>
                      <span className="font-mono">{systemHealth.database.size_mb} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Table Count</span>
                      <span className="font-mono">{systemHealth.database.table_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Connections</span>
                      <span className="font-mono">
                        {systemHealth.database.active_connections} / {systemHealth.database.connection_limit}
                      </span>
                    </div>
                    <Progress 
                      value={(systemHealth.database.active_connections / systemHealth.database.connection_limit) * 100}
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Query Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Avg Query Time</span>
                      <span className="font-mono">{systemHealth.performance.avg_query_time_ms}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cache Hit Ratio</span>
                      <span className="font-mono">{systemHealth.performance.cache_hit_ratio}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Index Usage</span>
                      <span className="font-mono">{systemHealth.performance.index_usage}%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Query Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Average Query Time</span>
                      <Badge variant="outline">{systemHealth.performance.avg_query_time_ms}ms</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Slow Queries (24h)</span>
                      <Badge variant={systemHealth.performance.slow_queries_24h > 10 ? 'destructive' : 'secondary'}>
                        {systemHealth.performance.slow_queries_24h}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Cache Hit Ratio</span>
                      <Badge variant="outline">{systemHealth.performance.cache_hit_ratio}%</Badge>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Uptime Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Current Uptime</span>
                      <span className="font-mono">{formatUptime(systemHealth.uptime.current_uptime_hours)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>30-Day Uptime</span>
                      <Badge className="bg-green-100 text-green-800">
                        {systemHealth.uptime.uptime_percent_30d}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Downtime</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(systemHealth.uptime.last_downtime).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="errors" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Error Summary (24h)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total Errors</span>
                      <Badge variant={systemHealth.errors.total_24h > 0 ? 'destructive' : 'secondary'}>
                        {systemHealth.errors.total_24h}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Critical Errors</span>
                      <Badge variant={systemHealth.errors.critical_24h > 0 ? 'destructive' : 'secondary'}>
                        {systemHealth.errors.critical_24h}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Warnings</span>
                      <Badge variant={systemHealth.errors.warning_24h > 0 ? 'default' : 'secondary'}>
                        {systemHealth.errors.warning_24h}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {systemHealth.errors.last_error ? (
                      <div className="text-sm">
                        <p className="text-muted-foreground">Last Error:</p>
                        <p className="font-mono text-red-600">{systemHealth.errors.last_error}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>No recent errors</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};