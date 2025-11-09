import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  audio_url?: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'verified' | 'resolved';
  timestamp: string;
  created_at: string;
  category?: string;
  severity?: string;
  department?: string;
  ai_confidence?: number;
  urgent?: boolean;
  duplicate_of?: number;
  duplicate_count?: number;
  similarity_score?: number;
  is_primary?: boolean;
  merged_reports?: string;
  resolution_photo_url?: string;
  resolution_date?: string;
  before_after_comparison?: string;
  ai_verification_score?: number;
  public_transparency?: boolean;
  sla_deadline?: string;
  escalated?: boolean;
  escalation_notified?: boolean;
  original_priority?: string;
  blockchain_tx_hash?: string;
  last_blockchain_update?: string;
  ai_analysis?: {
    category: string;
    severity: string;
    confidence: number;
    technicalAssessment: string;
    departmentResponsible: string;
    estimatedTime: string;
    estimatedCost: string;
    urgent: boolean;
    safetyConcerns: string[];
    recommendedActions: string[];
    estimatedUrgency: string;
    aiProcessed: boolean;
    fallbackUsed?: boolean;
  };
}

const API_BASE_URL = 'http://localhost:5000';

const AdminDashboard: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [selectedAiReport, setSelectedAiReport] = useState<Report | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [showResolutionUpload, setShowResolutionUpload] = useState(false);
  const [resolutionReport, setResolutionReport] = useState<Report | null>(null);
  const [resolutionPhoto, setResolutionPhoto] = useState<File | null>(null);
  const [uploadingResolution, setUploadingResolution] = useState(false);
  const [resolutionPreview, setResolutionPreview] = useState<string | null>(null);
  const [verifyingReport, setVerifyingReport] = useState<number | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<number, any>>({});

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      // Get token from localStorage
      const token = localStorage.getItem('adminToken');
      
      const response = await axios.get(`${API_BASE_URL}/admin/reports`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setReports(response.data);
      setError('');
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      
      // Handle unauthorized access
      if (error.response && error.response.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('adminToken');
        window.location.href = '/admin';
        return;
      }
      
      setError('Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId: number, newStatus: 'pending' | 'verified' | 'resolved') => {
    setUpdatingStatus(reportId);
    
    try {
      await axios.patch(`${API_BASE_URL}/report/${reportId}`, { status: newStatus });
      
      // Update local state
      setReports(prevReports => 
        prevReports.map(report => 
          report.id === reportId ? { ...report, status: newStatus } : report
        )
      );
      
      // Update selected report if it's the one being updated
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport({ ...selectedReport, status: newStatus });
      }
      
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update report status. Please try again.');
    } finally {
      setUpdatingStatus(null);
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

  const getStatusCounts = () => {
    return {
      pending: reports.filter(r => r.status === 'pending').length,
      verified: reports.filter(r => r.status === 'verified').length,
      resolved: reports.filter(r => r.status === 'resolved').length
    };
  };

  const openReportMap = (report: Report) => {
    setSelectedReport(report);
    setShowMap(true);
  };

  const openAiAnalysis = (report: Report) => {
    setSelectedAiReport(report);
    setShowAiAnalysis(true);
  };

  const openResolutionUpload = (report: Report) => {
    setResolutionReport(report);
    setShowResolutionUpload(true);
    setResolutionPhoto(null);
    setResolutionPreview(null);
  };

  const verifyOnBlockchain = async (reportId: number) => {
    setVerifyingReport(reportId);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/verify/${reportId}`);
      setVerificationResults(prev => ({
        ...prev,
        [reportId]: response.data
      }));
      
      if (response.data.verifiedOnBlockchain) {
        alert(`✅ Report verified on blockchain!\nTransaction Hash: ${response.data.blockchainTxHash}`);
      } else {
        alert('❌ Report not found on blockchain');
      }
    } catch (error) {
      console.error('Blockchain verification error:', error);
      setError('Failed to verify report on blockchain');
    } finally {
      setVerifyingReport(null);
    }
  };

  const handleResolutionPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      
      setResolutionPhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setResolutionPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const submitResolution = async () => {
    if (!resolutionReport || !resolutionPhoto) {
      setError('Resolution photo is required');
      return;
    }

    setUploadingResolution(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('resolutionPhoto', resolutionPhoto);

      const response = await axios.post(`${API_BASE_URL}/report/${resolutionReport.id}/resolve`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200) {
        // Update the report in local state
        setReports(prevReports => 
          prevReports.map(report => 
            report.id === resolutionReport.id 
              ? { 
                  ...report, 
                  status: 'resolved' as const,
                  resolution_photo_url: response.data.resolutionPhotoUrl,
                  ai_verification_score: response.data.verification.verificationScore
                }
              : report
          )
        );
        
        setShowResolutionUpload(false);
        alert(`Resolution verified! AI Score: ${response.data.verification.verificationScore}% - Quality: ${response.data.verification.quality}`);
      }
    } catch (error) {
      console.error('Resolution upload error:', error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || 'Failed to upload resolution photo');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setUploadingResolution(false);
    }
  };

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

  const statusCounts = getStatusCounts();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={fetchReports} className="btn btn-small">
            Refresh Data
          </button>
          <Link to="/analytics" className="btn btn-small" style={{ textDecoration: 'none' }}>
            Predictive Analytics
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3 className="stat-title" style={{ color: '#ff0080' }}>Pending</h3>
          <p className="stat-value">{statusCounts.pending}</p>
        </div>
        
        <div className="stat-card">
          <h3 className="stat-title" style={{ color: '#00f0ff' }}>Verified</h3>
          <p className="stat-value">{statusCounts.verified}</p>
        </div>
        
        <div className="stat-card">
          <h3 className="stat-title" style={{ color: '#4caf50' }}>Resolved</h3>
          <p className="stat-value">{statusCounts.resolved}</p>
        </div>
        
        <div className="stat-card">
          <h3 className="stat-title" style={{ color: '#b066ff' }}>Total</h3>
          <p className="stat-value">{reports.length}</p>
        </div>
      </div>

      {/* Priority Information */}
      <div className="analytics-section" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#00f0ff' }}>🏆 Reports Sorted by Priority</h3>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)' }}>
          Reports are automatically sorted by: 
          <strong>1) Urgent Issues</strong> → 
          <strong>2) High Severity</strong> → 
          <strong>3) Public Concern (Most Complaints)</strong> → 
          <strong>4) Recent Reports</strong>
        </p>
      </div>
      
      {/* Reports Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Risk</th>
              <th>ID</th>
              <th>Photo</th>
              <th>Description</th>
              <th>AI Analysis</th>
              <th>Location</th>
              <th>Status</th>
              <th>Public Concern</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
                        {reports.map((report) => {
              const getRiskLevel = (report: Report) => {
                if (report.urgent) return { level: 'CRITICAL', color: '#d32f2f', icon: '🚨' };
                if (report.ai_analysis?.severity === 'HIGH') return { level: 'HIGH', color: '#f44336', icon: '⚠️' };
                if (report.ai_analysis?.severity === 'MEDIUM') return { level: 'MEDIUM', color: '#ff9800', icon: '⚡' };
                return { level: 'LOW', color: '#4caf50', icon: '📋' };
              };
              
              const risk = getRiskLevel(report);
              
              return (
                <tr key={report.id}>
                  <td>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexDirection: 'column',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '1.2rem',
                        marginBottom: '0.25rem'
                      }}>
                        {risk.icon}
                      </div>
                      <div style={{
                        backgroundColor: risk.color,
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        minWidth: '60px'
                      }}>
                        {risk.level}
                      </div>
                    </div>
                  </td>
                  <td>{report.id}</td>
                
                <td>
                  <img
                    src={`${API_BASE_URL}${report.photo_url}`}
                    alt="Issue"
                    className="thumbnail"
                    onClick={() => window.open(`${API_BASE_URL}${report.photo_url}`, '_blank')}
                  />
                </td>
                
                <td>
                  <div style={{ maxWidth: '200px' }}>
                    {report.description.length > 80 
                      ? `${report.description.substring(0, 80)}...` 
                      : report.description || 'No description provided'}
                    
                    {report.audio_url && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <audio 
                          controls 
                          src={`${API_BASE_URL}${report.audio_url}`}
                          style={{ width: '100%', height: '30px' }}
                        />
                      </div>
                    )}
                  </div>
                </td>
                
                <td>
                  {report.ai_analysis ? (
                    <div style={{ fontSize: '0.875rem', maxWidth: '180px' }}>
                      <div style={{ marginBottom: '0.25rem' }}>
                        <span style={{
                          backgroundColor: '#4caf50',
                          color: 'white',
                          padding: '0.125rem 0.25rem',
                          borderRadius: '3px',
                          fontSize: '0.75rem'
                        }}>
                          {report.ai_analysis.category?.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong>Severity:</strong>{' '}
                        <span style={{
                          color: report.ai_analysis.severity === 'HIGH' ? '#f44336' : 
                                 report.ai_analysis.severity === 'MEDIUM' ? '#ff9800' : '#4caf50',
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }}>
                          {report.ai_analysis.severity}
                        </span>
                      </div>
                      
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong>Confidence:</strong> {report.ai_analysis.confidence}%
                      </div>
                      
                      {report.ai_analysis.urgent && (
                        <div style={{ 
                          backgroundColor: '#ffebee', 
                          color: '#c62828', 
                          padding: '0.125rem 0.25rem', 
                          borderRadius: '3px',
                          fontSize: '0.7rem',
                          marginBottom: '0.25rem'
                        }}>
                          ⚠️ URGENT
                        </div>
                      )}
                      
                      <button
                        onClick={() => openAiAnalysis(report)}
                        className="btn btn-small"
                        style={{ 
                          fontSize: '0.7rem', 
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#2196f3',
                          color: 'white'
                        }}
                      >
                        🤖 View Full Analysis
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>
                      No AI analysis available
                    </div>
                  )}
                </td>
                
                <td>
                  <div style={{ fontSize: '0.875rem' }}>
                    <div>{report.latitude.toFixed(4)},</div>
                    <div>{report.longitude.toFixed(4)}</div>
                    <button
                      onClick={() => openReportMap(report)}
                      className="btn btn-small"
                      style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}
                    >
                      🗺️ View Map
                    </button>
                  </div>
                </td>
                
                <td>
                  <span className={`status-badge status-${report.status}`}>
                    {report.status}
                  </span>
                </td>
                
                <td>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexDirection: 'column',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '1.8rem',
                      fontWeight: 'bold',
                      color: (report.duplicate_count || 1) > 5 ? '#d32f2f' : 
                             (report.duplicate_count || 1) > 2 ? '#f57c00' : 
                             (report.duplicate_count || 1) > 1 ? '#1976d2' : '#4caf50',
                      marginBottom: '0.25rem'
                    }}>
                      {report.duplicate_count || 1}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#666',
                      fontWeight: 'bold',
                      marginBottom: '0.25rem'
                    }}>
                      {(report.duplicate_count || 1) === 1 ? 'REPORT' : 'COMPLAINTS'}
                    </div>
                    {(report.duplicate_count || 1) > 3 && (
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'white',
                        backgroundColor: '#d32f2f',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '12px',
                        fontWeight: 'bold'
                      }}>
                        🚨 CRITICAL
                      </div>
                    )}
                    {(report.duplicate_count || 1) > 1 && (report.duplicate_count || 1) <= 3 && (
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'white',
                        backgroundColor: '#f57c00',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '12px',
                        fontWeight: 'bold'
                      }}>
                        📈 HIGH CONCERN
                      </div>
                    )}
                  </div>
                </td>
                
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem', flexDirection: 'column' }}>
                    {report.status === 'pending' && (
                      <button
                        onClick={() => updateReportStatus(report.id, 'verified')}
                        className="btn btn-small btn-success"
                        disabled={updatingStatus === report.id}
                      >
                        {updatingStatus === report.id ? 'Updating...' : '✓ Verify'}
                      </button>
                    )}
                    
                    {report.status === 'verified' && (
                      <button
                        onClick={() => openResolutionUpload(report)}
                        className="btn btn-small btn-success"
                        style={{ backgroundColor: '#4caf50' }}
                      >
                        📷 Upload Resolution Photo
                      </button>
                    )}
                    
                    {report.status === 'resolved' && report.resolution_photo_url && (
                      <div style={{ fontSize: '0.75rem', color: '#4caf50', textAlign: 'center' }}>
                        ✓ Resolved with Photo
                        {report.ai_verification_score && (
                          <div>AI Score: {report.ai_verification_score.toFixed(1)}%</div>
                        )}
                      </div>
                    )}
                    
                    {/* Blockchain Verification Button */}
                    <button
                      onClick={() => verifyOnBlockchain(report.id)}
                      className="btn btn-small"
                      style={{ 
                        backgroundColor: '#9c27b0', 
                        color: 'white',
                        marginTop: '0.25rem'
                      }}
                      disabled={verifyingReport === report.id}
                    >
                      {verifyingReport === report.id ? '🔍 Verifying...' : '🔗 Verify on Blockchain'}
                    </button>
                    
                    {report.blockchain_tx_hash && (
                      <div style={{ 
                        fontSize: '0.7rem', 
                        color: '#4caf50', 
                        textAlign: 'center',
                        marginTop: '0.25rem'
                      }}>
                        ✅ Logged
                      </div>
                    )}
                    
                    {report.status !== 'pending' && (
                      <button
                        onClick={() => updateReportStatus(report.id, 'pending')}
                        className="btn btn-small btn-danger"
                        disabled={updatingStatus === report.id}
                      >
                        {updatingStatus === report.id ? 'Updating...' : '↺ Reset'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        
        {reports.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>No reports found.</p>
          </div>
        )}
      </div>

      {/* Map Modal */}
      {showMap && selectedReport && (
        <div className="modal-overlay">
          <div className="modal-content" style={{
            width: '800px',
            height: '600px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div className="ai-modal-header">
              <h3 style={{ margin: 0 }}>
                Report #{selectedReport.id} <span className="gradient-text">Location</span>
              </h3>
              <button
                onClick={() => setShowMap(false)}
                className="ai-close-btn"
              >
                ✕
              </button>
            </div>
            
            <div style={{ flex: 1, borderRadius: '4px', overflow: 'hidden' }}>
              <MapContainer
                center={[selectedReport.latitude, selectedReport.longitude]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[selectedReport.latitude, selectedReport.longitude]}>
                  <Popup>
                    <div>
                      <strong>Report #{selectedReport.id}</strong>
                      <p>{selectedReport.description}</p>
                      <p><strong>Status:</strong> <span className={`status-badge status-${selectedReport.status}`}>{selectedReport.status}</span></p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        </div>
      )}
      
      {/* AI Analysis Modal */}
      {showAiAnalysis && selectedAiReport && selectedAiReport.ai_analysis && (
        <div className="modal-overlay" style={{ overflow: 'auto' }}>
          <div className="modal-content" style={{ width: '700px' }}>
            <div className="ai-modal-header">
              <h2>🤖 AI Analysis - Report #{selectedAiReport.id}</h2>
              <button
                onClick={() => setShowAiAnalysis(false)}
                className="ai-close-btn"
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Main Analysis Results */}
              <div className="ai-stats-grid">
                <div className="ai-stat-box">
                  <h4>Category</h4>
                  <span className="ai-badge category">
                    {selectedAiReport.ai_analysis.category?.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="ai-stat-box">
                  <h4>Severity</h4>
                  <span className={`ai-badge severity-${selectedAiReport.ai_analysis.severity?.toLowerCase()}`}>
                    {selectedAiReport.ai_analysis.severity}
                  </span>
                </div>
                
                <div className="ai-stat-box">
                  <h4>Confidence</h4>
                  <div className="ai-confidence">
                    {selectedAiReport.ai_analysis.confidence}%
                  </div>
                </div>
                
                <div className="ai-stat-box">
                  <h4>Department</h4>
                  <div className="ai-department">
                    {selectedAiReport.ai_analysis.departmentResponsible}
                  </div>
                </div>
              </div>
              
              {selectedAiReport.ai_analysis.urgent && (
                <div className="ai-urgent-banner">
                  <h3>⚠️ URGENT ISSUE</h3>
                  <p>This issue has been flagged as urgent and requires immediate attention!</p>
                </div>
              )}
              
              {/* Technical Assessment */}
              <div className="ai-section technical">
                <h4>Technical Assessment</h4>
                <p>
                  {selectedAiReport.ai_analysis.technicalAssessment}
                </p>
              </div>
              
              {/* Safety Concerns */}
              {selectedAiReport.ai_analysis.safetyConcerns && selectedAiReport.ai_analysis.safetyConcerns.length > 0 && (
                <div className="ai-section safety">
                  <h4>⚠️ Safety Concerns</h4>
                  <ul>
                    {selectedAiReport.ai_analysis.safetyConcerns.map((concern, index) => (
                      <li key={index}>
                        {concern}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Recommended Actions */}
              {selectedAiReport.ai_analysis.recommendedActions && selectedAiReport.ai_analysis.recommendedActions.length > 0 && (
                <div className="ai-section actions">
                  <h4>✅ Recommended Actions</h4>
                  <ul>
                    {selectedAiReport.ai_analysis.recommendedActions.map((action, index) => (
                      <li key={index}>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Estimates */}
              <div className="ai-estimates-grid">
                <div className="ai-estimate-box">
                  <h4>Estimated Time</h4>
                  <div className="ai-estimate-value">
                    {selectedAiReport.ai_analysis.estimatedTime || 'Unknown'}
                  </div>
                </div>
                
                <div className="ai-estimate-box">
                  <h4>Estimated Cost</h4>
                  <div className="ai-estimate-value">
                    {selectedAiReport.ai_analysis.estimatedCost || 'Unknown'}
                  </div>
                </div>
                
                <div className="ai-estimate-box">
                  <h4>Priority Level</h4>
                  <div className="ai-estimate-value">
                    {selectedAiReport.ai_analysis.estimatedUrgency || 'MODERATE'}
                  </div>
                </div>
              </div>
              
              {/* AI Processing Info */}
              <div className="ai-footer">
                {selectedAiReport.ai_analysis.aiProcessed ? (
                  <>🤖 Analyzed using Google Gemini Vision AI</>
                ) : (
                  <>⚙️ Analyzed using fallback keyword detection</>
                )}
                {selectedAiReport.ai_analysis.fallbackUsed && (
                  <div className="ai-footer-note">
                    Note: AI analysis was not available, used keyword-based classification
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Resolution Photo Upload Modal */}
      {showResolutionUpload && resolutionReport && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="ai-modal-header">
              <h2 style={{ margin: 0 }}>
                📷 Upload <span className="gradient-text">Resolution Photo</span>
              </h2>
              <button className="ai-close-btn" onClick={() => setShowResolutionUpload(false)}>
                ✕
              </button>
            </div>
            
            {error && (
              <div className="ai-urgent-banner" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1rem' }}>
                Report #{resolutionReport.id}
              </h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '1rem', 
                marginBottom: '1rem' 
              }}>
                <div>
                  <h4 style={{ 
                    margin: '0 0 0.5rem 0',
                    color: '#00f0ff',
                    fontSize: '0.875rem'
                  }}>
                    Original Issue (Before):
                  </h4>
                  <img 
                    src={`${API_BASE_URL}${resolutionReport.photo_url}`} 
                    alt="Original issue" 
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '2px solid #ff0080'
                    }}
                  />
                </div>
                <div>
                  <h4 style={{ 
                    margin: '0 0 0.5rem 0',
                    color: '#00f0ff',
                    fontSize: '0.875rem'
                  }}>
                    Resolution Photo (After):
                  </h4>
                  {resolutionPreview ? (
                    <img 
                      src={resolutionPreview} 
                      alt="Resolution preview" 
                      style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '2px solid #4caf50'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '150px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '2px dashed rgba(0, 240, 255, 0.3)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255, 255, 255, 0.5)'
                    }}>
                      Upload resolution photo
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                Upload Resolution Photo *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleResolutionPhotoChange}
                className="form-input"
                style={{ 
                  padding: '0.75rem',
                  cursor: 'pointer'
                }}
              />
              <div style={{ 
                fontSize: '0.875rem', 
                color: 'rgba(255, 255, 255, 0.6)', 
                marginTop: '0.5rem' 
              }}>
                This photo will be analyzed by AI to verify the issue has been resolved.
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <button
                onClick={() => setShowResolutionUpload(false)}
                className="btn"
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitResolution}
                disabled={!resolutionPhoto || uploadingResolution}
                className="btn"
                style={{
                  flex: 1,
                  background: resolutionPhoto && !uploadingResolution 
                    ? 'linear-gradient(135deg, #00f0ff, #b066ff)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  opacity: resolutionPhoto && !uploadingResolution ? 1 : 0.5,
                  cursor: resolutionPhoto && !uploadingResolution ? 'pointer' : 'not-allowed'
                }}
              >
                {uploadingResolution ? '🔄 Processing...' : '📷 Upload Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
