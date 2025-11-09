const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const fsSync = require('fs');
const sharp = require('sharp');
const path = require('path');

// Initialize Gemini AI - You'll need to set your API key as environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your-gemini-api-key');

class CivicIssueDetector {
  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Predefined civic issue categories
    this.issueCategories = {
      'POTHOLE': {
        priority: 'HIGH',
        description: 'Road surface damage requiring immediate attention',
        department: 'Road Maintenance',
        estimatedCost: 'Medium',
        estimatedTime: '2-3 days'
      },
      'STREET_LIGHT': {
        priority: 'MEDIUM',
        description: 'Street lighting issues affecting safety',
        department: 'Electrical',
        estimatedCost: 'Low',
        estimatedTime: '1-2 days'
      },
      'GARBAGE_OVERFLOW': {
        priority: 'HIGH',
        description: 'Waste management issue requiring immediate cleanup',
        department: 'Sanitation',
        estimatedCost: 'Low',
        estimatedTime: '1 day'
      },
      'DRAIN_BLOCKAGE': {
        priority: 'HIGH',
        description: 'Drainage system blockage potentially causing flooding',
        department: 'Water Management',
        estimatedCost: 'Medium',
        estimatedTime: '2-3 days'
      },
      'BROKEN_SIDEWALK': {
        priority: 'MEDIUM',
        description: 'Sidewalk damage affecting pedestrian safety',
        department: 'Infrastructure',
        estimatedCost: 'Medium',
        estimatedTime: '3-5 days'
      },
      'WATER_LEAK': {
        priority: 'HIGH',
        description: 'Water supply leak requiring urgent repair',
        department: 'Water Supply',
        estimatedCost: 'High',
        estimatedTime: '1-2 days'
      },
      'DAMAGED_SIGN': {
        priority: 'LOW',
        description: 'Traffic or information signage damage',
        department: 'Traffic Management',
        estimatedCost: 'Low',
        estimatedTime: '2-3 days'
      },
      'ILLEGAL_DUMPING': {
        priority: 'MEDIUM',
        description: 'Unauthorized waste disposal requiring cleanup',
        department: 'Sanitation',
        estimatedCost: 'Medium',
        estimatedTime: '1-2 days'
      },
      'VEGETATION_OVERGROWTH': {
        priority: 'LOW',
        description: 'Overgrown vegetation obstructing paths or visibility',
        department: 'Parks & Gardens',
        estimatedCost: 'Low',
        estimatedTime: '2-3 days'
      },
      'OTHER': {
        priority: 'MEDIUM',
        description: 'General civic issue requiring assessment',
        department: 'General Administration',
        estimatedCost: 'Variable',
        estimatedTime: 'Variable'
      }
    };
  }

  async preprocessImage(imagePath) {
    try {
      // Optimize image for AI analysis - reduce size while maintaining quality
      // Use a unique filename to avoid conflicts
      const path = require('path');
      const ext = path.extname(imagePath);
      const basename = path.basename(imagePath, ext);
      const dir = path.dirname(imagePath);
      const processedImagePath = path.join(dir, `${basename}_processed_${Date.now()}${ext}`);
      
      await sharp(imagePath)
        .resize(800, 800, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toFile(processedImagePath);
        
      return processedImagePath;
    } catch (error) {
      console.error('Image preprocessing error:', error);
      return imagePath; // Return original if processing fails
    }
  }

  async analyzeImage(imagePath, userDescription = '') {
    console.log(`Starting AI analysis for image: ${imagePath}`);
    console.log(`User description: ${userDescription || 'None provided'}`);
    
    // Retry logic for AI service overload
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds
    let processedImagePath = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if API key is configured
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key') {
          console.warn('Gemini API key not configured, using fallback analysis');
          return this.fallbackAnalysis(userDescription);
        }

        // Preprocess image
        processedImagePath = await this.preprocessImage(imagePath);
        console.log(`Image preprocessed: ${processedImagePath}`);
        
        // Read image file
        const imageData = await fs.readFile(processedImagePath);
        const base64Image = imageData.toString('base64');
        console.log(`Image read successfully, size: ${imageData.length} bytes`);

        // Create the prompt for civic issue detection
        const prompt = `
          You are an expert AI system for analyzing civic infrastructure issues. 
          
          IMPORTANT: Analyze this image FIRST and determine what civic issue is shown based PRIMARILY on what you see in the image. The user description should only be used as supplementary context if needed.
          
          Analyze this image and determine:
          1. What type of civic issue is shown (if any)
          2. The severity level (LOW, MEDIUM, HIGH)
          3. A brief technical assessment
          4. Safety concerns (if any)
          5. Recommended action priority

          ${userDescription ? `User provided additional context: "${userDescription}"` : 'No additional context provided by user.'}

          Available issue categories:
          - POTHOLE: Road surface damage
          - STREET_LIGHT: Street lighting issues
          - GARBAGE_OVERFLOW: Waste management problems
          - DRAIN_BLOCKAGE: Drainage system issues
          - BROKEN_SIDEWALK: Sidewalk damage
          - WATER_LEAK: Water supply leaks
          - DAMAGED_SIGN: Traffic/information signage damage
          - ILLEGAL_DUMPING: Unauthorized waste disposal
          - VEGETATION_OVERGROWTH: Overgrown vegetation
          - OTHER: General civic issues

          Please respond in JSON format:
          {
            "issueDetected": boolean,
            "category": "category_name",
            "confidence": number (0-100),
            "severity": "LOW|MEDIUM|HIGH",
            "technicalAssessment": "detailed description",
            "safetyConcerns": ["concern1", "concern2"],
            "recommendedActions": ["action1", "action2"],
            "estimatedUrgency": "IMMEDIATE|URGENT|MODERATE|LOW"
          }
        `;

        console.log('Sending request to Gemini API...');
        const result = await this.model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg'
            }
          }
        ]);

        const response = await result.response;
        const text = response.text();
        console.log('Received response from Gemini API:', text.substring(0, 200) + '...');
        
        // Parse JSON response
        const analysis = JSON.parse(text.replace(/```json|```/g, '').trim());
        console.log('Parsed AI analysis:', JSON.stringify(analysis, null, 2));
        
        // Enhance with category metadata
        const categoryInfo = this.issueCategories[analysis.category] || this.issueCategories['OTHER'];
        
        // Clean up processed image
        if (processedImagePath && processedImagePath !== imagePath && fsSync.existsSync(processedImagePath)) {
          try {
            fsSync.unlinkSync(processedImagePath);
          } catch (cleanupError) {
            console.warn('Failed to clean up processed image:', cleanupError);
          }
        }
        
        return {
          ...analysis,
          departmentResponsible: categoryInfo.department,
          estimatedCost: categoryInfo.estimatedCost,
          estimatedRepairTime: categoryInfo.estimatedTime,
          categoryDescription: categoryInfo.description,
          aiProcessed: true,
          processedAt: new Date().toISOString()
        };

      } catch (error) {
        console.error(`AI Analysis attempt ${attempt} error:`, error);
        
        // Clean up processed image if it exists
        if (processedImagePath && processedImagePath !== imagePath && fsSync.existsSync(processedImagePath)) {
          try {
            fsSync.unlinkSync(processedImagePath);
          } catch (cleanupError) {
            console.warn('Failed to clean up processed image:', cleanupError);
          }
        }
        
        // If it's a service overload error and we have more retries, wait and try again
        if (error.status === 503 && attempt < maxRetries) {
          console.log(`AI service overloaded, retrying in ${retryDelay}ms... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // If it's the last attempt or not a retryable error, use fallback
        if (attempt === maxRetries) {
          console.warn('All AI analysis attempts failed, using fallback analysis');
          return this.fallbackAnalysis(userDescription);
        }
        
        // For other errors on non-final attempts, continue to retry
        continue;
      }
    }
  }

  // Fallback analysis when AI is not available
  fallbackAnalysis(description = '') {
    const descriptionLower = description.toLowerCase();
    
    let category = 'OTHER';
    let severity = 'MEDIUM';
    let assessmentText = 'Image submitted for civic issue reporting';
    
    // Simple keyword matching only if description is provided
    if (description && description.trim()) {
      if (descriptionLower.includes('pothole') || descriptionLower.includes('road') || descriptionLower.includes('crack')) {
        category = 'POTHOLE';
        severity = 'HIGH';
      } else if (descriptionLower.includes('light') || descriptionLower.includes('lamp')) {
        category = 'STREET_LIGHT';
        severity = 'MEDIUM';
      } else if (descriptionLower.includes('garbage') || descriptionLower.includes('trash') || descriptionLower.includes('waste')) {
        category = 'GARBAGE_OVERFLOW';
        severity = 'HIGH';
      } else if (descriptionLower.includes('drain') || descriptionLower.includes('water') || descriptionLower.includes('flood')) {
        category = 'DRAIN_BLOCKAGE';
        severity = 'HIGH';
      } else if (descriptionLower.includes('sidewalk') || descriptionLower.includes('pavement')) {
        category = 'BROKEN_SIDEWALK';
        severity = 'MEDIUM';
      } else if (descriptionLower.includes('leak')) {
        category = 'WATER_LEAK';
        severity = 'HIGH';
      } else if (descriptionLower.includes('sign')) {
        category = 'DAMAGED_SIGN';
        severity = 'LOW';
      }
      assessmentText = `Issue categorized based on description keywords: ${description}`;
    } else {
      assessmentText = 'Image submitted without description - manual review required for proper categorization';
    }

    const categoryInfo = this.issueCategories[category];

    return {
      issueDetected: true,
      category: category,
      confidence: description && description.trim() ? 60 : 40, // Lower confidence without description
      severity: severity,
      technicalAssessment: assessmentText,
      safetyConcerns: ['Manual assessment required'],
      recommendedActions: ['Verify issue on-site', 'Assign appropriate department'],
      estimatedUrgency: severity === 'HIGH' ? 'URGENT' : 'MODERATE',
      departmentResponsible: categoryInfo.department,
      estimatedCost: categoryInfo.estimatedCost,
      estimatedRepairTime: categoryInfo.estimatedTime,
      categoryDescription: categoryInfo.description,
      aiProcessed: false,
      processedAt: new Date().toISOString(),
      fallbackUsed: true
    };
  }

  // Get issue statistics and insights
  async getIssueInsights(reports) {
    const insights = {
      totalReports: reports.length,
      categoryDistribution: {},
      severityDistribution: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      departmentWorkload: {},
      averageResolutionTime: null,
      mostCommonIssues: [],
      urgentIssues: reports.filter(r => r.ai_analysis?.estimatedUrgency === 'IMMEDIATE' || r.ai_analysis?.estimatedUrgency === 'URGENT').length
    };

    reports.forEach(report => {
      if (report.ai_analysis) {
        // Category distribution
        const category = report.ai_analysis.category || 'OTHER';
        insights.categoryDistribution[category] = (insights.categoryDistribution[category] || 0) + 1;
        
        // Severity distribution
        const severity = report.ai_analysis.severity || 'MEDIUM';
        insights.severityDistribution[severity]++;
        
        // Department workload
        const dept = report.ai_analysis.departmentResponsible || 'General';
        insights.departmentWorkload[dept] = (insights.departmentWorkload[dept] || 0) + 1;
      }
    });

    // Most common issues
    insights.mostCommonIssues = Object.entries(insights.categoryDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return insights;
  }

  // Compare two images for similarity using Gemini Vision
  async compareImages(imagePath1, imagePath2) {
    // Retry logic for AI service overload
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds
    let processedImage1 = null;
    let processedImage2 = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if API key is configured
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key') {
          console.warn('Gemini API key not configured, using fallback similarity');
          return this.fallbackImageSimilarity(imagePath1, imagePath2);
        }

        // Preprocess both images
        processedImage1 = await this.preprocessImage(imagePath1);
        processedImage2 = await this.preprocessImage(imagePath2);
        
        // Read image files
        const imageData1 = await fs.readFile(processedImage1);
        const imageData2 = await fs.readFile(processedImage2);
        const base64Image1 = imageData1.toString('base64');
        const base64Image2 = imageData2.toString('base64');

        // Create the prompt for image similarity comparison
        const prompt = `
          You are an expert AI system for comparing civic infrastructure images for similarity.
          
          Compare these two images and determine:
          1. Are they showing the same or very similar civic issues?
          2. Are they taken at the same or very nearby location?
          3. What is the overall similarity percentage?
          
          Consider:
          - Same type of issue (pothole, garbage, street light, etc.)
          - Similar location/environment
          - Similar severity and characteristics
          - Even if taken from different angles or at different times
          
          Provide a similarity score from 0-100 where:
          - 90-100: Definitely the same issue (different angles/times)
          - 80-89: Very likely the same issue
          - 60-79: Similar issue, possibly same location
          - 40-59: Similar type of issue, different location
          - 0-39: Different issues
          
          Please respond in JSON format:
          {
            "similarityScore": number (0-100),
            "isSameIssue": boolean,
            "reasoning": "detailed explanation",
            "confidence": number (0-100),
            "sameLocation": boolean,
            "sameIssueType": boolean
          }
        `;

        const result = await this.model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Image1,
              mimeType: 'image/jpeg'
              }
          },
          {
            inlineData: {
              data: base64Image2,
              mimeType: 'image/jpeg'
            }
          }
        ]);

        const response = await result.response;
        const text = response.text();
        
        // Parse JSON response
        const comparison = JSON.parse(text.replace(/```json|```/g, '').trim());
        
        // Clean up processed images
        if (processedImage1 && processedImage1 !== imagePath1 && fsSync.existsSync(processedImage1)) {
          try {
            fsSync.unlinkSync(processedImage1);
          } catch (cleanupError) {
            console.warn('Failed to clean up processed image:', cleanupError);
          }
        }
        if (processedImage2 && processedImage2 !== imagePath2 && fsSync.existsSync(processedImage2)) {
          try {
            fsSync.unlinkSync(processedImage2);
          } catch (cleanupError) {
            console.warn('Failed to clean up processed image:', cleanupError);
          }
        }
        
        return {
          ...comparison,
          aiProcessed: true,
          comparedAt: new Date().toISOString()
        };

      } catch (error) {
        console.error(`Image similarity comparison attempt ${attempt} error:`, error);
        
        // Clean up processed images if they exist
        if (processedImage1 && processedImage1 !== imagePath1 && fsSync.existsSync(processedImage1)) {
          try {
            fsSync.unlinkSync(processedImage1);
          } catch (cleanupError) {
            console.warn('Failed to clean up processed image:', cleanupError);
          }
        }
        if (processedImage2 && processedImage2 !== imagePath2 && fsSync.existsSync(processedImage2)) {
          try {
            fsSync.unlinkSync(processedImage2);
          } catch (cleanupError) {
            console.warn('Failed to clean up processed image:', cleanupError);
          }
        }
        
        // If it's a service overload error and we have more retries, wait and try again
        if (error.status === 503 && attempt < maxRetries) {
          console.log(`AI service overloaded, retrying in ${retryDelay}ms... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // If it's the last attempt or not a retryable error, use fallback
        if (attempt === maxRetries) {
          console.warn('All AI similarity comparison attempts failed, using fallback');
          return this.fallbackImageSimilarity(imagePath1, imagePath2);
        }
        
        // For other errors on non-final attempts, continue to retry
        continue;
      }
    }
  }

  // Fallback image similarity (basic file size and type comparison)
  fallbackImageSimilarity(imagePath1, imagePath2) {
    try {
      const fs = require('fs');
      const stat1 = fs.statSync(imagePath1);
      const stat2 = fs.statSync(imagePath2);
      
      // Simple size-based similarity (not very accurate but better than nothing)
      const sizeDiff = Math.abs(stat1.size - stat2.size);
      const avgSize = (stat1.size + stat2.size) / 2;
      const sizeSimularity = Math.max(0, 100 - (sizeDiff / avgSize) * 100);
      
      return {
        similarityScore: Math.min(50, sizeSimularity), // Cap at 50% for fallback
        isSameIssue: sizeSimularity > 80,
        reasoning: 'Fallback comparison based on file size (AI not available)',
        confidence: 30,
        sameLocation: false,
        sameIssueType: false,
        aiProcessed: false,
        fallbackUsed: true,
        comparedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Fallback image similarity error:', error);
      return {
        similarityScore: 0,
        isSameIssue: false,
        reasoning: 'Could not compare images',
        confidence: 0,
        sameLocation: false,
        sameIssueType: false,
        aiProcessed: false,
        fallbackUsed: true,
        comparedAt: new Date().toISOString()
      };
    }
  }

  // Calculate distance between two coordinates using Haversine formula
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distance = R * c; // in metres
    return distance;
  }

  // Find nearby reports within specified radius
  async findNearbyReports(latitude, longitude, radiusMeters = 50, excludeId = null) {
    return new Promise((resolve, reject) => {
      const db = require('./database');
      
      // Get all active (non-duplicate) reports
      const query = `
        SELECT * FROM reports 
        WHERE is_primary = 1 
        AND status IN ('pending', 'verified') 
        AND id != ?
        ORDER BY created_at DESC
      `;
      
      db.all(query, [excludeId || -1], (err, reports) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Filter by distance
        const nearbyReports = reports.filter(report => {
          const distance = this.calculateDistance(
            latitude, longitude,
            report.latitude, report.longitude
          );
          return distance <= radiusMeters;
        }).map(report => ({
          ...report,
          distance: this.calculateDistance(
            latitude, longitude,
            report.latitude, report.longitude
          )
        }));
        
        resolve(nearbyReports);
      });
    });
  }

  // Compare before and after images to verify issue resolution
  async verifyResolution(beforeImagePath, afterImagePath, issueCategory) {
    // Retry logic for AI service overload
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds
    let processedBefore = null;
    let processedAfter = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if API key is configured
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key') {
          console.warn('Gemini API key not configured, using fallback verification');
          return this.fallbackResolutionVerification();
        }

        // Preprocess both images
        processedBefore = await this.preprocessImage(beforeImagePath);
        processedAfter = await this.preprocessImage(afterImagePath);
        
        // Read image files
        const beforeData = await fs.readFile(processedBefore);
        const afterData = await fs.readFile(processedAfter);
        const base64Before = beforeData.toString('base64');
        const base64After = afterData.toString('base64');

        // Create the prompt for resolution verification
        const prompt = `
          You are an expert AI system for verifying civic issue resolutions by comparing before and after photos.
          
          TASK: Compare these two images to determine if the civic issue has been properly resolved.
          
          CONTEXT:
          - Issue Category: ${issueCategory}
          - Before Image: Shows the original problem
          - After Image: Shows the current state (claimed to be resolved)
          
          ANALYSIS CRITERIA:
          1. Is the original issue visible in the before image?
          2. Has the issue been properly fixed in the after image?
          3. What is the quality/completeness of the resolution?
          4. Are there any remaining concerns or incomplete work?
          5. Does this represent genuine progress/resolution?
          
          VERIFICATION LEVELS:
          - 90-100: Excellent resolution, issue completely fixed
          - 80-89: Good resolution, issue mostly fixed with minor improvements possible
          - 60-79: Partial resolution, issue improved but not fully resolved
          - 40-59: Minimal resolution, some work done but significant issues remain
          - 0-39: No resolution or different location/angle, issue still present
          
          Please respond in JSON format:
          {
            "resolved": boolean,
            "verificationScore": number (0-100),
            "resolution_quality": "EXCELLENT|GOOD|PARTIAL|MINIMAL|NONE",
            "beforeIssueDetected": boolean,
            "afterIssuePresent": boolean,
            "improvementDescription": "detailed description of changes",
            "remainingConcerns": ["concern1", "concern2"],
            "publicRecommendation": "APPROVED|NEEDS_REVIEW|REJECTED",
            "confidence": number (0-100),
            "technicalNotes": "detailed technical assessment"
          }
        `;

        const result = await this.model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Before,
              mimeType: 'image/jpeg'
            }
          },
          {
            inlineData: {
              data: base64After,
              mimeType: 'image/jpeg'
            }
          }
        ]);

        const response = await result.response;
        const text = response.text();
        
        // Parse JSON response
        const verification = JSON.parse(text.replace(/```json|```/g, '').trim());
        
        // Clean up processed images
        if (processedBefore && processedBefore !== beforeImagePath && fsSync.existsSync(processedBefore)) {
          try {
            fsSync.unlinkSync(processedBefore);
          } catch (cleanupError) {
            console.warn('Failed to clean up processed image:', cleanupError);
          }
        }
        if (processedAfter && processedAfter !== afterImagePath && fsSync.existsSync(processedAfter)) {
          try {
            fsSync.unlinkSync(processedAfter);
          } catch (cleanupError) {
            console.warn('Failed to clean up processed image:', cleanupError);
          }
        }
        
        return {
          ...verification,
          aiProcessed: true,
          verifiedAt: new Date().toISOString(),
          issueCategory: issueCategory
        };

      } catch (error) {
        console.error(`Resolution verification attempt ${attempt} error:`, error);
        
        // Clean up processed images if they exist
        if (processedBefore && processedBefore !== beforeImagePath && fsSync.existsSync(processedBefore)) {
          try {
            fsSync.unlinkSync(processedBefore);
          } catch (cleanupError) {
            console.warn('Failed to clean up processed image:', cleanupError);
          }
        }
        if (processedAfter && processedAfter !== afterImagePath && fsSync.existsSync(processedAfter)) {
          try {
            fsSync.unlinkSync(processedAfter);
          } catch (cleanupError) {
            console.warn('Failed to clean up processed image:', cleanupError);
          }
        }
        
        // If it's a service overload error and we have more retries, wait and try again
        if (error.status === 503 && attempt < maxRetries) {
          console.log(`AI service overloaded, retrying in ${retryDelay}ms... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // If it's the last attempt or not a retryable error, use fallback
        if (attempt === maxRetries) {
          console.warn('All AI verification attempts failed, using fallback verification');
          return this.fallbackResolutionVerification();
        }
        
        // For other errors on non-final attempts, continue to retry
        continue;
      }
    }
  }

  // Fallback resolution verification when AI is not available
  fallbackResolutionVerification() {
    return {
      resolved: false,
      verificationScore: 50,
      resolution_quality: 'NEEDS_REVIEW',
      beforeIssueDetected: true,
      afterIssuePresent: true,
      improvementDescription: 'Manual verification required - AI not available',
      remainingConcerns: ['AI verification not available', 'Manual review required'],
      publicRecommendation: 'NEEDS_REVIEW',
      confidence: 30,
      technicalNotes: 'Fallback verification used due to AI unavailability. Manual review recommended.',
      aiProcessed: false,
      fallbackUsed: true,
      verifiedAt: new Date().toISOString()
    };
  }
}

module.exports = new CivicIssueDetector();
