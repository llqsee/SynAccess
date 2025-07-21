import React, { useState, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { performanceMonitor } from '../utils/embeddingUtils';
import { api } from '../services/api';
import './PerformanceDashboard.css';

const PerformanceDashboard = () => {
  const [metrics, setMetrics] = useState({
    renderTimes: [],
    apiCalls: [],
    memoryUsage: [],
    userInteractions: [],
    embeddingMetrics: null
  });
  const [isVisible, setIsVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch performance data
  const fetchMetrics = useCallback(async () => {
    try {
      // Get client-side metrics
      const clientMetrics = performanceMonitor.getMetricsSummary();
      
      // Get server-side metrics
      const serverMetrics = await api.getEmbeddingMetrics();
      
      setMetrics(prev => ({
        ...prev,
        renderTimes: performanceMonitor.metrics.renderTimes,
        apiCalls: performanceMonitor.metrics.apiCalls,
        memoryUsage: performanceMonitor.metrics.memoryUsage,
        userInteractions: performanceMonitor.metrics.userInteractions,
        embeddingMetrics: serverMetrics,
        clientSummary: clientMetrics
      }));
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, []);

  // Auto-refresh metrics
  useEffect(() => {
    if (autoRefresh && isVisible) {
      const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, isVisible, fetchMetrics]);

  // Initial fetch
  useEffect(() => {
    if (isVisible) {
      fetchMetrics();
    }
  }, [isVisible, fetchMetrics]);

  // Prepare chart data
  const renderTimeData = metrics.renderTimes.map(rt => ({
    time: String(rt.timestamp),
    duration: rt.duration,
    component: rt.component
  }));

  const apiCallData = metrics.apiCalls.map(call => ({
    time: String(call.timestamp),
    duration: call.duration,
    endpoint: call.endpoint,
    status: call.status
  }));

  const memoryData = metrics.memoryUsage.map(mem => ({
    time: String(mem.timestamp),
    used: (mem.used / 1024 / 1024).toFixed(2), // MB
    total: (mem.total / 1024 / 1024).toFixed(2), // MB
    percentage: ((mem.used / mem.total) * 100).toFixed(1)
  }));

  const interactionData = metrics.userInteractions.reduce((acc, interaction) => {
    acc[interaction.action] = (acc[interaction.action] || 0) + 1;
    return acc;
  }, {});

  const interactionChartData = Object.entries(interactionData).map(([action, count]) => ({
    action,
    count
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (!isVisible) {
    return (
      <div className="performance-dashboard-toggle">
        <button 
          className="toggle-button"
          onClick={() => setIsVisible(true)}
          title="Show Performance Dashboard"
        >
          📊 Performance
        </button>
      </div>
    );
  }

  return (
    <div className="performance-dashboard">
      <div className="dashboard-header">
        <h2>Performance Dashboard</h2>
        <div className="dashboard-controls">
          <label>
            <input 
              type="checkbox" 
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button onClick={fetchMetrics} disabled={autoRefresh}>
            Refresh Now
          </button>
          <button onClick={() => setIsVisible(false)}>
            Close
          </button>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button 
          className={selectedTab === 'overview' ? 'active' : ''}
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </button>
        <button 
          className={selectedTab === 'rendering' ? 'active' : ''}
          onClick={() => setSelectedTab('rendering')}
        >
          Rendering
        </button>
        <button 
          className={selectedTab === 'api' ? 'active' : ''}
          onClick={() => setSelectedTab('api')}
        >
          API Performance
        </button>
        <button 
          className={selectedTab === 'memory' ? 'active' : ''}
          onClick={() => setSelectedTab('memory')}
        >
          Memory Usage
        </button>
        <button 
          className={selectedTab === 'interactions' ? 'active' : ''}
          onClick={() => setSelectedTab('interactions')}
        >
          User Activity
        </button>
      </div>

      <div className="dashboard-content">
        {selectedTab === 'overview' && (
          <div className="overview-section">
            <div className="metrics-grid">
              <div className="metric-card">
                <h3>Render Performance</h3>
                <div className="metric-value">
                  {metrics.clientSummary?.averageRenderTime?.toFixed(2) || 0}ms
                </div>
                <div className="metric-label">Average Render Time</div>
              </div>
              
              <div className="metric-card">
                <h3>API Performance</h3>
                <div className="metric-value">
                  {metrics.clientSummary?.averageApiResponseTime?.toFixed(2) || 0}ms
                </div>
                <div className="metric-label">Average Response Time</div>
              </div>
              
              <div className="metric-card">
                <h3>Memory Usage</h3>
                <div className="metric-value">
                  {metrics.clientSummary?.currentMemoryUsage?.used 
                    ? (metrics.clientSummary.currentMemoryUsage.used / 1024 / 1024).toFixed(1) + 'MB'
                    : 'N/A'}
                </div>
                <div className="metric-label">Current Usage</div>
              </div>
              
              <div className="metric-card">
                <h3>User Activity</h3>
                <div className="metric-value">
                  {metrics.clientSummary?.userInteractionCount || 0}
                </div>
                <div className="metric-label">Total Interactions</div>
              </div>
            </div>

            {metrics.embeddingMetrics && (
              <div className="server-metrics">
                <h3>Server Metrics</h3>
                <div className="server-metrics-grid">
                  <div className="server-metric">
                    <span className="metric-label">Total Embeddings:</span>
                    <span className="metric-value">
                      {metrics.embeddingMetrics.embedding_metrics?.total_computations || 0}
                    </span>
                  </div>
                  <div className="server-metric">
                    <span className="metric-label">Cache Hit Rate:</span>
                    <span className="metric-value">
                      {(metrics.embeddingMetrics.embedding_metrics?.cache_hit_rate * 100 || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="server-metric">
                    <span className="metric-label">Average Compute Time:</span>
                    <span className="metric-value">
                      {metrics.embeddingMetrics.embedding_metrics?.average_computation_time?.toFixed(2) || 0}s
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'rendering' && (
          <div className="rendering-section">
            <h3>Component Render Times</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={renderTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="duration" 
                  stroke="#8884d8" 
                  name="Render Time (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedTab === 'api' && (
          <div className="api-section">
            <h3>API Call Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={apiCallData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="duration" fill="#82ca9d" name="Response Time (ms)" />
              </BarChart>
            </ResponsiveContainer>
            
            <div className="api-stats">
              <h4>API Call Statistics</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <span>Total Calls:</span>
                  <span>{metrics.apiCalls.length}</span>
                </div>
                <div className="stat-item">
                  <span>Successful Calls:</span>
                  <span>{metrics.apiCalls.filter(call => call.status === 200).length}</span>
                </div>
                <div className="stat-item">
                  <span>Failed Calls:</span>
                  <span>{metrics.apiCalls.filter(call => call.status !== 200).length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'memory' && (
          <div className="memory-section">
            <h3>Memory Usage Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={memoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="used" 
                  stroke="#ff7300" 
                  name="Used Memory (MB)"
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#387908" 
                  name="Total Memory (MB)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedTab === 'interactions' && (
          <div className="interactions-section">
            <h3>User Interaction Patterns</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={interactionChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {interactionChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="interaction-details">
              <h4>Recent Interactions</h4>
              <div className="interaction-list">
                {metrics.userInteractions.slice(-10).reverse().map((interaction, index) => (
                  <div key={index} className="interaction-item">
                    <span className="interaction-time">
                      {String(interaction.timestamp)}
                    </span>
                    <span className="interaction-action">{interaction.action}</span>
                    {interaction.details && Object.keys(interaction.details).length > 0 && (
                      <span className="interaction-details-text">
                        {JSON.stringify(interaction.details)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceDashboard; 