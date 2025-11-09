import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

interface WeeklyTrend {
  period: string;
  category: string;
  count: number;
}

interface SeasonalTrend {
  [month: number]: {
    [category: string]: number;
  };
}

interface Hotspot {
  center: {
    lat: number;
    lng: number;
  };
  reports: any[];
  count: number;
  categories: { [key: string]: number };
  severity: { HIGH: number; MEDIUM: number; LOW: number };
  topCategory: string;
  topSeverity: string;
  growthRate: number;
}

interface Prediction {
  historical: any[];
  predicted: { periodIndex: number; predictedCount: number }[];
  trend: string;
}

interface PredictiveAnalyticsData {
  weeklyTrends: WeeklyTrend[];
  seasonalTrends: SeasonalTrend;
  emergingHotspots: Hotspot[];
  predictions: { [category: string]: Prediction };
  generatedAt: string;
}

const PredictiveAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<PredictiveAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('week');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      const response = await axios.get(`${API_BASE_URL}/admin/analytics/predictive`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setAnalytics(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching predictive analytics:', err);
      
      // Handle unauthorized access
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin';
        return;
      }
      
      setError('Failed to load predictive analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || `Month ${month}`;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'POTHOLE': '#f44336',
      'STREET_LIGHT': '#ff9800',
      'GARBAGE_OVERFLOW': '#4caf50',
      'DRAIN_BLOCKAGE': '#2196f3',
      'BROKEN_SIDEWALK': '#9c27b0',
      'WATER_LEAK': '#00bcd4',
      'DAMAGED_SIGN': '#ff5722',
      'ILLEGAL_DUMPING': '#795548',
      'VEGETATION_OVERGROWTH': '#4caf50',
      'OTHER': '#9e9e9e'
    };
    return colors[category] || '#3f51b5';
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading predictive analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-state">
        <div className="error-message">{error}</div>
        <button onClick={fetchAnalytics} className="btn btn-small" style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="empty-state">
        <p>No analytics data available.</p>
      </div>
    );
  }

  // Get unique categories
  const categories = Array.from(
    new Set(analytics.weeklyTrends.map(item => item.category))
  );

  // Filter data based on selected category
  const filteredWeeklyTrends = selectedCategory === 'all' 
    ? analytics.weeklyTrends 
    : analytics.weeklyTrends.filter(item => item.category === selectedCategory);

  // Prepare data for charts
  const prepareWeeklyData = () => {
    // Group by period and category
    const grouped: { [period: string]: { [category: string]: number } } = {};
    
    filteredWeeklyTrends.forEach(item => {
      if (!grouped[item.period]) {
        grouped[item.period] = {};
      }
      if (!grouped[item.period][item.category]) {
        grouped[item.period][item.category] = 0;
      }
      grouped[item.period][item.category] += item.count;
    });

    // Convert to array format
    return Object.entries(grouped).map(([period, categories]) => ({
      period,
      ...categories
    }));
  };

  const weeklyChartData = prepareWeeklyData();

  return (
    <div className="analytics-container">
      {/* Header */}
      <div className="analytics-header">
        <h1>Predictive Analytics Dashboard</h1>
        <button onClick={fetchAnalytics} className="btn btn-small">
          REFRESH DATA
        </button>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card hotspots">
          <h3>Emerging Hotspots</h3>
          <p>{analytics.emergingHotspots.length}</p>
        </div>
        
        <div className="stat-card categories">
          <h3>Categories Tracked</h3>
          <p>{categories.length}</p>
        </div>
        
        <div className="stat-card models">
          <h3>Predictive Models</h3>
          <p>{Object.keys(analytics.predictions).length}</p>
        </div>
        
        <div className="stat-card updated">
          <h3>Last Updated</h3>
          <p>{new Date(analytics.generatedAt).toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="analytics-controls">
        <div>
          <label>Category:</label>
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Emerging Hotspots */}
      <div className="analytics-section">
        <h2>📍 Emerging Hotspots</h2>
        {analytics.emergingHotspots.length > 0 ? (
          <div className="hotspots-grid">
            {analytics.emergingHotspots.map((hotspot, index) => (
              <div key={index} className="hotspot-card">
                <div className="hotspot-header">
                  <h3>Hotspot #{index + 1}</h3>
                  <span className="hotspot-badge">
                    {hotspot.count} reports
                  </span>
                </div>
                
                <div className="hotspot-details">
                  <p><strong>Location:</strong> {hotspot.center.lat.toFixed(4)}, {hotspot.center.lng.toFixed(4)}</p>
                  <p><strong>Primary Issue:</strong> {hotspot.topCategory.replace('_', ' ')}</p>
                  <p><strong>Severity:</strong> {hotspot.topSeverity}</p>
                  <p><strong>Growth Rate:</strong> {hotspot.growthRate.toFixed(1)}%</p>
                </div>
                
                <div className="category-tags">
                  {Object.entries(hotspot.categories).map(([category, count]) => (
                    <span 
                      key={category}
                      className="category-tag"
                      style={{ 
                        backgroundColor: getCategoryColor(category),
                        color: 'white'
                      }}
                    >
                      {category.replace('_', ' ')}: {count}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No emerging hotspots detected in the last 2 weeks.
          </p>
        )}
      </div>

      {/* Weekly Trends */}
      <div className="analytics-section">
        <h2>📈 Weekly Trends</h2>
        {weeklyChartData.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Week</th>
                  {categories.map(category => (
                    <th key={category} style={{ color: getCategoryColor(category) }}>
                      {category.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyChartData.map((weekData, index) => (
                  <tr key={index}>
                    <td>{weekData.period}</td>
                    {categories.map(category => (
                      <td key={category}>
                        {(weekData as any)[category] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No trend data available.</p>
        )}
      </div>

      {/* Seasonal Trends */}
      <div className="analytics-section">
        <h2>🌦️ Seasonal Trends</h2>
        {Object.keys(analytics.seasonalTrends).length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Month</th>
                  {categories.map(category => (
                    <th key={category} style={{ color: getCategoryColor(category) }}>
                      {category.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(analytics.seasonalTrends).map(([month, data]) => (
                  <tr key={month}>
                    <td>{getMonthName(parseInt(month))}</td>
                    {categories.map(category => (
                      <td key={category}>
                        {(data as any)[category] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No seasonal data available.</p>
        )}
      </div>

      {/* Predictions */}
      <div className="analytics-section">
        <h2>🔮 Predictions</h2>
        {Object.keys(analytics.predictions).length > 0 ? (
          <div className="prediction-grid">
            {Object.entries(analytics.predictions).map(([category, prediction]) => (
              <div key={category} className="prediction-card">
                <div className="prediction-header">
                  <h3 style={{ color: getCategoryColor(category) }}>
                    {category.replace('_', ' ')}
                  </h3>
                  <span className={`trend-badge ${prediction.trend}`}>
                    {prediction.trend.charAt(0).toUpperCase() + prediction.trend.slice(1)}
                  </span>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <h4 className="section-subtitle">Historical Data:</h4>
                  <div className="data-points">
                    {prediction.historical.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="data-point historical">
                        <div>Week {item.period}</div>
                        <div>{item.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="section-subtitle">Predicted:</h4>
                  <div className="data-points">
                    {prediction.predicted.slice(0, 4).map((item, idx) => (
                      <div key={idx} className="data-point predicted">
                        <div>Week +{idx + 1}</div>
                        <div>{item.predictedCount}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No predictions available.</p>
        )}
      </div>
    </div>
  );
};

export default PredictiveAnalytics;