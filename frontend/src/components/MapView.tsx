import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Report {
  id: number;
  description: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'verified' | 'resolved';
  timestamp: string;
  created_at: string;
  resolution_photo_url?: string;
  resolution_date?: string;
  ai_verification_score?: number;
  before_after_comparison?: string;
  ai_analysis?: any;
}

const API_BASE_URL = 'http://localhost:5000';

// Create custom markers for different statuses
const createCustomIcon = (status: string, hasResolutionProof: boolean = false) => {
  let color = '#ff6b6b'; // red for pending
  
  switch (status) {
    case 'verified':
      color = '#4ecdc4'; // teal for verified
      break;
    case 'resolved':
      color = hasResolutionProof ? '#4caf50' : '#45b7d1'; // green for resolved with proof, blue for resolved without
      break;
    default:
      color = '#ff6b6b'; // red for pending
  }
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${color}; width: 25px; height: 25px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5]
  });
};

const MapView: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reports`);
      setReports(response.data);
      setError('');
    } catch (error) {
      console.error('Error fetching reports:', error);
      setError('Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string, hasResolutionProof: boolean = false) => {
    switch (status) {
      case 'pending':
        return '#ff6b6b';
      case 'verified':
        return '#4ecdc4';
      case 'resolved':
        return hasResolutionProof ? '#4caf50' : '#45b7d1';
      default:
        return '#ff6b6b';
    }
  };

  // Default center (you can change this to your city's coordinates)
  const defaultCenter: [number, number] = [28.6139, 77.2090]; // New Delhi coordinates

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading reports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="error-message">{error}</div>
        <button onClick={fetchReports} className="btn btn-small" style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Civic Issue Reports</h1>
        <button onClick={fetchReports} className="btn btn-small">
          Refresh Map
        </button>
      </div>
      
      {/* Legend */}
      <div className="analytics-section" style={{ 
        display: 'flex',
        gap: '2rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <strong style={{ color: '#00f0ff' }}>Legend:</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            backgroundColor: getStatusColor('pending'),
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 0 10px rgba(255, 0, 128, 0.5)'
          }}></div>
          <span>Pending</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            backgroundColor: getStatusColor('verified'),
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 0 10px rgba(0, 240, 255, 0.5)'
          }}></div>
          <span>Verified</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            backgroundColor: getStatusColor('resolved'),
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)'
          }}></div>
          <span>Resolved (No Proof)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            backgroundColor: getStatusColor('resolved', true),
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}></div>
          <span>Resolved (With Proof)</span>
        </div>
        <div style={{ marginLeft: 'auto', color: '#666' }}>
          Total Reports: {reports.length}
        </div>
      </div>

      <div className="map-container">
        <MapContainer
          center={defaultCenter}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {reports.map((report) => (
            <Marker
              key={report.id}
              position={[report.latitude, report.longitude]}
              icon={createCustomIcon(report.status, !!report.resolution_photo_url)}
            >
              <Popup maxWidth={350}>
                <div style={{ maxWidth: '330px' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <img
                      src={`${API_BASE_URL}${report.photo_url}`}
                      alt="Issue"
                      style={{ 
                        width: '100%', 
                        height: '150px', 
                        objectFit: 'cover', 
                        borderRadius: '4px' 
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  
                  {/* Show resolution proof for resolved issues */}
                  {report.status === 'resolved' && report.resolution_photo_url && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '0.25rem'
                      }}>
                        <strong>Resolution Proof</strong>
                        {report.ai_verification_score && (
                          <span style={{ 
                            backgroundColor: '#4caf50', 
                            color: 'white', 
                            padding: '0.1rem 0.4rem', 
                            borderRadius: '4px',
                            fontSize: '0.7rem'
                          }}>
                            AI Score: {report.ai_verification_score}%
                          </span>
                        )}
                      </div>
                      <img
                        src={`${API_BASE_URL}${report.resolution_photo_url}`}
                        alt="Resolution"
                        style={{ 
                          width: '100%', 
                          height: '100px', 
                          objectFit: 'cover', 
                          borderRadius: '4px',
                          border: '2px solid #4caf50'
                        }}
                      />
                    </div>
                  )}
                  
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Status:</strong>{' '}
                    <span 
                      className={`status-badge status-${report.status}`}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {report.status}
                      {report.status === 'resolved' && report.resolution_photo_url && ' ✅'}
                    </span>
                  </div>
                  
                  {report.ai_analysis?.category && (
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                      <strong>Category:</strong>{' '}
                      <span style={{ 
                        backgroundColor: '#4caf50', 
                        color: 'white', 
                        padding: '0.1rem 0.4rem', 
                        borderRadius: '4px'
                      }}>
                        {report.ai_analysis.category.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                  
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Description:</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                      {report.description.length > 100 
                        ? `${report.description.substring(0, 100)}...` 
                        : report.description || 'No description provided'}
                    </p>
                  </div>
                  
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                    <strong>Location:</strong> {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                  </div>
                  
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    <strong>Reported:</strong> {formatDate(report.created_at)}
                  </div>
                  
                  {report.status === 'resolved' && report.resolution_date && (
                    <div style={{ fontSize: '0.75rem', color: '#4caf50', marginTop: '0.25rem' }}>
                      <strong>Resolved:</strong> {formatDate(report.resolution_date)}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      
      {reports.length === 0 && (
        <div className="analytics-section" style={{ 
          textAlign: 'center',
          marginTop: '1rem'
        }}>
          <p>No reports found. Be the first to report a civic issue!</p>
        </div>
      )}
    </div>
  );
};

export default MapView;