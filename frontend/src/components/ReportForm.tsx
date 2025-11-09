import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

const API_BASE_URL = 'http://localhost:5000';

const ReportForm: React.FC = () => {
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [tempMapLocation, setTempMapLocation] = useState<LocationData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Audio recording states
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Default location (you can change this to your city's coordinates)

  // Default location (you can change this to your city's coordinates)
  const DEFAULT_LOCATION = { latitude: 28.6139, longitude: 77.2090 }; // New Delhi coordinates

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    setErrorMessage('');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log('Location obtained:', { latitude, longitude, accuracy: `${accuracy}m` });
          
          setLocation({ latitude, longitude });
          setIsGettingLocation(false);
          
          // Show accuracy info to user
          if (accuracy > 100) {
            setErrorMessage(`Location obtained with low accuracy (±${Math.round(accuracy)}m). For better accuracy, ensure GPS is enabled and you're not indoors.`);
          }
          
          // Optional: Reverse geocoding to get address
          reverseGeocode(latitude, longitude);
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMessage = 'Unable to get your location. ';
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Please allow location access when prompted by your browser.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information is unavailable. Try refreshing the page or entering coordinates manually.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out. Please try again or enter coordinates manually.';
              break;
            default:
              errorMessage += 'Please ensure location services are enabled and try again, or enter coordinates manually.';
              break;
          }
          
          setErrorMessage(errorMessage);
          setIsGettingLocation(false);
        },
        {
          enableHighAccuracy: true, // Enable high accuracy for better GPS precision
          timeout: 30000, // 30 seconds timeout
          maximumAge: 0 // Don't use cached location, get fresh data
        }
      );
    } else {
      setErrorMessage('Geolocation is not supported by this browser. Please enter coordinates manually.');
      setIsGettingLocation(false);
    }
  };

  const handleManualLocation = () => {
    const lat = parseFloat(manualLatitude);
    const lng = parseFloat(manualLongitude);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setErrorMessage('Please enter valid latitude (-90 to 90) and longitude (-180 to 180) values.');
      return;
    }
    
    setLocation({ latitude: lat, longitude: lng });
    setShowManualLocation(false);
    setErrorMessage('');
    
    // Try to get address for the manual coordinates
    reverseGeocode(lat, lng);
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      // Using OpenStreetMap's Nominatim service for reverse geocoding with proper headers
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CivicReporter/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.display_name) {
          setLocation(prev => prev ? { ...prev, address: data.display_name } : null);
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      // Don't show error to user as this is optional
      // We'll just show coordinates without the readable address
    }
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioURL(URL.createObjectURL(audioBlob));
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      setErrorMessage('');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setErrorMessage('Unable to access microphone. Please check your browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const deleteAudioRecording = () => {
    setAudioBlob(null);
    setAudioURL(null);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrorMessage('Image size must be less than 5MB');
        return;
      }
      
      setPhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Clear any previous error
      setErrorMessage('');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!photo) {
      setErrorMessage('Please select or capture a photo.');
      return;
    }
    
    // Description is now optional - no validation needed
    
    if (!location) {
      setErrorMessage('Location information is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('photo', photo);
      formData.append('description', description);
      formData.append('latitude', location.latitude.toString());
      formData.append('longitude', location.longitude.toString());
      
      // Add audio file if available
      if (audioBlob) {
        formData.append('audioNote', audioBlob, 'audio-note.webm');
      }

      const response = await axios.post(`${API_BASE_URL}/report`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 201) {
        const result = response.data;
        
        if (result.isDuplicate) {
          setSuccessMessage(`Report submitted successfully! Our AI detected this might be similar to an existing report #${result.primaryReportId}. Both reports will be reviewed by administrators.`);
        } else {
          setSuccessMessage('Report submitted successfully! Thank you for helping improve our community.');
        }
        
        // Show AI analysis if available
        if (result.aiAnalysis) {
          setAiAnalysis({
            ...result.aiAnalysis,
            isDuplicate: result.isDuplicate,
            duplicateInfo: result.duplicateInfo,
            nearbyReportsChecked: result.nearbyReportsChecked
          });
          setShowAiAnalysis(true);
        }
        
        // Don't reset the form while showing AI analysis
        // The form will be reset when the user clicks "Submit New Report"
        
        // Scroll to success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      console.error('Submission error:', error);
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.error || 'Failed to submit report. Please try again.');
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Map click handler component
  const MapClickHandler: React.FC<{ onLocationSelect: (lat: number, lng: number) => void }> = ({ onLocationSelect }) => {
    useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
        onLocationSelect(lat, lng);
      },
    });
    return null;
  };

  const handleMapLocationSelect = (lat: number, lng: number) => {
    setTempMapLocation({ latitude: lat, longitude: lng });
  };

  const confirmMapLocation = () => {
    if (tempMapLocation) {
      setLocation(tempMapLocation);
      reverseGeocode(tempMapLocation.latitude, tempMapLocation.longitude);
      setShowMapPicker(false);
      setTempMapLocation(null);
    }
  };

  const cancelMapPicker = () => {
    setShowMapPicker(false);
    setTempMapLocation(null);
  };

  return (
    <div className="form-container">
      <h1 className="form-title">Report Civic Issue</h1>
      
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}
      
      {showAiAnalysis && aiAnalysis && (
        <div className="analytics-section" style={{ margin: '1rem 0' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#00f0ff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🤖 <span className="gradient-text">AI Analysis Results</span>
          </h3>
          
          <div className="ai-stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="ai-stat-box">
              <h4>Category</h4>
              <span className="ai-badge category">
                {aiAnalysis.category?.replace('_', ' ')}
              </span>
            </div>
            
            <div className="ai-stat-box">
              <h4>Severity</h4>
              <span className={`ai-badge severity-${aiAnalysis.severity?.toLowerCase()}`}>
                {aiAnalysis.severity}
              </span>
            </div>
            
            <div className="ai-stat-box">
              <h4>Confidence</h4>
              <div className="ai-stat-value">{aiAnalysis.confidence}%</div>
            </div>
            
            <div className="ai-stat-box">
              <h4>Department</h4>
              <span className="ai-badge department">
                {aiAnalysis.department}
              </span>
            </div>
          </div>
          
          {aiAnalysis.urgent && (
            <div className="ai-urgent-banner" style={{ marginBottom: '1.5rem' }}>
              ⚠️ <strong>URGENT:</strong> This issue requires immediate attention!
            </div>
          )}
          
          <div className="ai-section technical" style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#00f0ff', marginBottom: '0.75rem' }}>Technical Assessment</h4>
            <p style={{ margin: 0, lineHeight: '1.6' }}>
              {aiAnalysis.technicalAssessment}
            </p>
          </div>
          
          <div className="ai-estimates-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="ai-estimate-box">
              <strong>Est. Time:</strong>
              <div className="ai-estimate-value">{aiAnalysis.estimatedTime}</div>
            </div>
            <div className="ai-estimate-box">
              <strong>Est. Cost:</strong>
              <div className="ai-estimate-value">{aiAnalysis.estimatedCost || 'Variable'}</div>
            </div>
            {aiAnalysis.nearbyReportsChecked !== undefined && (
              <div className="ai-estimate-box">
                <strong>Nearby Reports Checked:</strong>
                <div className="ai-estimate-value">{aiAnalysis.nearbyReportsChecked}</div>
              </div>
            )}
          </div>
          
          {aiAnalysis.isDuplicate && aiAnalysis.duplicateInfo && (
            <div style={{
              background: 'rgba(255, 152, 0, 0.1)',
              border: '2px solid rgba(255, 152, 0, 0.5)',
              borderRadius: '12px',
              padding: '1rem',
              marginTop: '1rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#ff9800' }}>
                🔄 Potential Duplicate Detected
              </h4>
              <p style={{ margin: '0 0 1rem 0', color: 'rgba(255, 255, 255, 0.9)' }}>
                {aiAnalysis.duplicateInfo.message}
              </p>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                gap: '0.75rem', 
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                <div>
                  <strong style={{ color: '#ff9800' }}>Similarity:</strong> {aiAnalysis.duplicateInfo.similarityScore}%
                </div>
                <div>
                  <strong style={{ color: '#ff9800' }}>Distance:</strong> {aiAnalysis.duplicateInfo.distance.toFixed(1)}m
                </div>
                <div>
                  <strong style={{ color: '#ff9800' }}>Primary Report:</strong> #{aiAnalysis.duplicateInfo.primaryReportId}
                </div>
              </div>
              {aiAnalysis.duplicateInfo.reasoning && (
                <div style={{ 
                  marginTop: '0.75rem', 
                  fontSize: '0.875rem', 
                  fontStyle: 'italic', 
                  color: 'rgba(255, 255, 255, 0.7)',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(255, 152, 0, 0.3)'
                }}>
                  <strong style={{ color: '#ff9800' }}>AI Reasoning:</strong> {aiAnalysis.duplicateInfo.reasoning}
                </div>
              )}
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', gap: '1rem' }}>
            <button
              onClick={() => {
                // Reset form for a new report
                setDescription('');
                setPhoto(null);
                setPhotoPreview(null);
                setAudioBlob(null);
                setAudioURL(null);
                setRecordingTime(0);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
                setShowAiAnalysis(false);
                setSuccessMessage('');
              }}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #4caf50, #00f0ff)',
                flex: 1
              }}
            >
              Submit New Report
            </button>
            <button
              onClick={() => setShowAiAnalysis(false)}
              className="btn"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                flex: 1
              }}
            >
              Close Analysis
            </button>
          </div>
        </div>
      )}
      
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Photo Upload */}
        <div className="form-group">
          <label className="form-label">Photo of Issue *</label>
          <div className="file-input" onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              capture="environment"
            />
            {photoPreview ? (
              <div>
                <img src={photoPreview} alt="Preview" className="preview-image" />
                <p>Click to change photo</p>
              </div>
            ) : (
              <div>
                <p>📷 Click to take photo or select image</p>
                <p style={{ fontSize: '0.875rem', color: '#666' }}>Max size: 5MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description" className="form-label">Description (Optional)</label>
          <textarea
            id="description"
            className="form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any additional details about the civic issue (optional)..."
          />
        </div>

        {/* Audio Note */}
        <div className="form-group">
          <label className="form-label">
            🎤 Audio Note (Optional)
          </label>
          <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '1rem' }}>
            Record a voice note to describe the issue instead of typing
          </p>
          
          {!audioURL ? (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className="btn"
                style={{
                  background: isRecording 
                    ? 'linear-gradient(135deg, #f44336, #ff9800)' 
                    : 'linear-gradient(135deg, #00f0ff, #b066ff)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {isRecording ? (
                  <>
                    <span style={{ 
                      display: 'inline-block', 
                      width: '10px', 
                      height: '10px', 
                      backgroundColor: 'white', 
                      borderRadius: '2px',
                      animation: 'pulse 1s infinite'
                    }}></span>
                    Stop Recording ({formatTime(recordingTime)})
                  </>
                ) : (
                  <>
                    🎤 Start Recording
                  </>
                )}
              </button>
              
              {isRecording && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  color: '#ff0080',
                  fontSize: '0.875rem',
                  fontWeight: 'bold'
                }}>
                  <span style={{ 
                    width: '8px', 
                    height: '8px', 
                    backgroundColor: '#ff0080', 
                    borderRadius: '50%',
                    animation: 'pulse 1s infinite'
                  }}></span>
                  Recording...
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: 'rgba(0, 240, 255, 0.1)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              borderRadius: '12px',
              padding: '1rem'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <span style={{ color: '#00f0ff', fontWeight: 'bold' }}>
                  🎤 Audio Note ({formatTime(recordingTime)})
                </span>
                <button
                  type="button"
                  onClick={deleteAudioRecording}
                  style={{
                    background: 'rgba(255, 0, 128, 0.2)',
                    border: '1px solid rgba(255, 0, 128, 0.5)',
                    color: '#ff0080',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
              <audio 
                controls 
                src={audioURL} 
                style={{ width: '100%', height: '40px' }}
              />
            </div>
          )}
        </div>

        {/* Location Info */}
        <div className="form-group">
          <label className="form-label">Location *</label>
          {isGettingLocation && (
            <div className="location-info" style={{ 
              background: 'rgba(0, 240, 255, 0.1)',
              border: '1px solid rgba(0, 240, 255, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="spinner" style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(0, 240, 255, 0.3)',
                  borderTop: '2px solid #00f0ff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                📍 Getting your precise location...
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                Please ensure GPS is enabled and allow location access
              </div>
            </div>
          )}
          {location && (
            <div className="location-info" style={{
              background: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid rgba(76, 175, 80, 0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ color: '#4caf50', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    ✓ Location Captured
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </div>
                  {location.address && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                      📍 {location.address}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  style={{
                    background: 'rgba(0, 240, 255, 0.2)',
                    border: '1px solid rgba(0, 240, 255, 0.5)',
                    color: '#00f0ff',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          )}
                    {!location && !isGettingLocation && (
            <div>
              <div style={{ 
                background: 'rgba(255, 152, 0, 0.15)', 
                padding: '1rem', 
                borderRadius: '12px', 
                border: '1px solid rgba(255, 152, 0, 0.5)',
                marginBottom: '1rem'
              }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#ff9800' }}>
                  <strong>📍 Location Required</strong>
                </p>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                  We need your location to map the civic issue accurately.
                </p>
                <div style={{ 
                  background: 'rgba(0, 240, 255, 0.1)', 
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  <strong style={{ color: '#00f0ff' }}>💡 Tips for accurate location:</strong>
                  <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
                    <li>Enable GPS/Location Services on your device</li>
                    <li>Allow browser location access when prompted</li>
                    <li>Move outdoors if indoors for better GPS signal</li>
                    <li>Wait a few seconds for GPS to stabilize</li>
                  </ul>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="btn btn-small"
                  style={{ 
                    background: 'linear-gradient(135deg, #00f0ff, #b066ff)',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  📍 Get Precise Location
                </button>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className="btn btn-small"
                  style={{ 
                    background: 'linear-gradient(135deg, #ff0080, #b066ff)',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  🗺️ Pick on Map
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocation(DEFAULT_LOCATION);
                    // Try to get address for the default coordinates
                    reverseGeocode(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude);
                  }}
                  className="btn btn-small"
                  style={{ 
                    backgroundColor: '#4caf50',
                    color: 'white'
                  }}
                >
                  🏙️ Use Default Location
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualLocation(!showManualLocation)}
                  className="btn btn-small"
                  style={{ 
                    backgroundColor: '#4caf50',
                    color: 'white'
                  }}
                >
                  🏙️ Use Default Location
                </button>
              </div>
            </div>
          )}
          
          {showManualLocation && (
            <div className="analytics-section" style={{ marginTop: '1rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#00f0ff' }}>
                Enter Location Coordinates
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1rem' }}>
                You can find coordinates using Google Maps:
                <br />
                1. Right-click on the location
                <br />
                2. Select "What's here?"
                <br />
                3. Copy the coordinates (e.g., 28.6139, 77.2090)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                    Latitude
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 28.6139"
                    value={manualLatitude}
                    onChange={(e) => setManualLatitude(e.target.value)}
                    step="any"
                    min="-90"
                    max="90"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                    Longitude
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 77.2090"
                    value={manualLongitude}
                    onChange={(e) => setManualLongitude(e.target.value)}
                    step="any"
                    min="-180"
                    max="180"
                    className="form-input"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleManualLocation}
                  className="btn btn-small"
                  style={{
                    backgroundColor: '#4caf50',
                    color: 'white',
                    flex: 1
                  }}
                >
                  Use These Coordinates
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualLocation(false)}
                  className="btn btn-small"
                  style={{
                    backgroundColor: '#f44336',
                    color: 'white'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn"
          disabled={isSubmitting || !photo || !location || showAiAnalysis}
          style={{
            opacity: showAiAnalysis ? 0.5 : 1,
            cursor: showAiAnalysis ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '16px', 
                height: '16px', 
                border: '2px solid #ffffff40', 
                borderTop: '2px solid white', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite' 
              }}></div>
              Analyzing with AI...
            </div>
          ) : showAiAnalysis ? 'Report Submitted' : 'Submit Report'}
        </button>
      </form>

      {/* Map Picker Modal */}
      {showMapPicker && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ 
            width: '90vw', 
            maxWidth: '800px', 
            height: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div className="ai-modal-header">
              <h2 style={{ margin: 0 }}>
                🗺️ <span className="gradient-text">Pick Location on Map</span>
              </h2>
              <button className="ai-close-btn" onClick={cancelMapPicker}>
                ✕
              </button>
            </div>

            <div style={{ 
              background: 'rgba(0, 240, 255, 0.1)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              <strong style={{ color: '#00f0ff' }}>📍 How to use:</strong>
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255, 255, 255, 0.8)' }}>
                Click anywhere on the map to select the exact location of the civic issue
              </p>
            </div>

            {tempMapLocation && (
              <div style={{
                background: 'rgba(76, 175, 80, 0.1)',
                border: '1px solid rgba(76, 175, 80, 0.5)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                <strong style={{ color: '#4caf50' }}>✓ Selected:</strong>{' '}
                <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  {tempMapLocation.latitude.toFixed(6)}, {tempMapLocation.longitude.toFixed(6)}
                </span>
              </div>
            )}

            <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
              <MapContainer
                center={[location?.latitude || DEFAULT_LOCATION.latitude, location?.longitude || DEFAULT_LOCATION.longitude]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapClickHandler onLocationSelect={handleMapLocationSelect} />
                {tempMapLocation && (
                  <Marker position={[tempMapLocation.latitude, tempMapLocation.longitude]} />
                )}
              </MapContainer>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={cancelMapPicker}
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
                onClick={confirmMapLocation}
                disabled={!tempMapLocation}
                className="btn"
                style={{
                  flex: 1,
                  background: tempMapLocation 
                    ? 'linear-gradient(135deg, #00f0ff, #b066ff)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  opacity: tempMapLocation ? 1 : 0.5,
                  cursor: tempMapLocation ? 'pointer' : 'not-allowed'
                }}
              >
                ✓ Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportForm;
