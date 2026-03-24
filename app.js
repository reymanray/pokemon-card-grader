// Pokemon Card AI Grader - Main App
class CardGrader {
    constructor() {
        this.video = document.getElementById('camera-feed');
        this.canvas = document.getElementById('camera-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.model = null;
        this.stream = null;
        
        this.init();
    }
    
    async init() {
        try {
            await this.setupCamera();
            await this.loadModel();
            this.setupEventListeners();
            console.log('CardGrader initialized');
        } catch (err) {
            console.error('Init error:', err);
            alert('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
        }
    }
    
    async setupCamera() {
        try {
            // Try back camera first (mobile), fallback to any camera
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    resolve();
                };
            });
        } catch (err) {
            console.error('Camera error:', err);
            // Fallback to any available camera
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            this.video.srcObject = this.stream;
        }
    }
    
    async loadModel() {
        try {
            this.model = await cocoSsd.load();
            console.log('AI Model loaded');
            this.detectFrame();
        } catch (err) {
            console.error('Model load error:', err);
        }
    }
    
    detectFrame() {
        if (!this.model) return;
        
        this.model.detect(this.video).then(predictions => {
            // Check if card-like object detected
            const cardDetected = predictions.some(p => 
                p.class === 'book' || p.class === 'cell phone' || 
                p.score > 0.3 && this.isRectangular(p.bbox)
            );
            
            const overlay = document.getElementById('detection-overlay');
            if (cardDetected) {
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
            
            requestAnimationFrame(() => this.detectFrame());
        });
    }
    
    isRectangular(bbox) {
        const [x, y, width, height] = bbox;
        const ratio = width / height;
        // Pokemon cards roughly 2.5 x 3.5 inches = 0.714 ratio
        return ratio > 0.6 && ratio < 0.9;
    }
    
    setupEventListeners() {
        // Capture button
        document.getElementById('capture-btn').addEventListener('click', () => {
            this.captureAndGrade();
        });
        
        // Gallery button
        document.getElementById('gallery-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        
        // File input
        document.getElementById('file-input').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleFile(e.target.files[0]);
            }
        });
        
        // Close analysis
        document.getElementById('close-analysis').addEventListener('click', () => {
            document.getElementById('analysis-panel').classList.add('hidden');
        });
        
        // Retry button
        document.getElementById('retry-btn').addEventListener('click', () => {
            document.getElementById('analysis-panel').classList.add('hidden');
        });
        
        // Save button
        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveResult();
        });
    }
    
    captureAndGrade() {
        // Draw video frame to canvas
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        const imageData = this.canvas.toDataURL('image/jpeg');
        this.analyzeImage(imageData);
    }
    
    handleFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.analyzeImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }
    
    async analyzeImage(imageSrc) {
        const loading = document.getElementById('loading');
        loading.classList.remove('hidden');
        
        // Show image in analysis panel
        document.getElementById('analyzed-image').src = imageSrc;
        
        // Simulate AI analysis (replace with real analysis)
        await this.performAnalysis();
        
        loading.classList.add('hidden');
        document.getElementById('analysis-panel').classList.remove('hidden');
    }
    
    async performAnalysis() {
        // Simulate processing delay
        await new Promise(r => setTimeout(r, 1500));
        
        // Generate random scores for demo (replace with real AI analysis)
        const scores = {
            centering: Math.floor(Math.random() * 3) + 7, // 7-10
            surface: Math.floor(Math.random() * 4) + 6,   // 6-10
            corners: Math.floor(Math.random() * 5) + 5,   // 5-10
            edges: Math.floor(Math.random() * 4) + 6,     // 6-10
            lighting: Math.floor(Math.random() * 3) + 7   // 7-10
        };
        
        // Calculate overall grade
        const avg = (scores.centering + scores.surface + scores.corners + scores.edges + scores.lighting) / 5;
        const grade = avg.toFixed(1);
        
        // Update UI
        this.updateScore('centering', scores.centering);
        this.updateScore('surface', scores.surface);
        this.updateScore('corners', scores.corners);
        this.updateScore('edges', scores.edges);
        this.updateScore('lighting', scores.lighting);
        
        // Update grade badge
        const gradeBadge = document.getElementById('grade-badge');
        const gradeValue = document.querySelector('.grade-value');
        const gradeDesc = document.getElementById('grade-desc');
        
        gradeValue.textContent = grade;
        gradeBadge.className = 'grade-badge';
        
        if (avg >= 9) {
            gradeBadge.classList.add('grade-gem-mint');
            gradeDesc.textContent = 'Gem Mint - Kondisi sempurna!';
        } else if (avg >= 7) {
            gradeBadge.classList.add('grade-near-mint');
            gradeDesc.textContent = 'Near Mint - Kondisi sangat baik';
        } else if (avg >= 5) {
            gradeBadge.classList.add('grade-excellent');
            gradeDesc.textContent = 'Excellent - Kondisi baik';
        } else {
            gradeDesc.textContent = 'Perlu perhatian lebih';
        }
        
        // Mock card info
        document.getElementById('card-info').classList.remove('hidden');
        document.getElementById('card-name').textContent = 'Pokemon Card';
        document.getElementById('card-set').textContent = 'Unknown Set';
        document.getElementById('card-rarity').textContent = 'Unknown';
    }
    
    updateScore(type, value) {
        document.getElementById(`score-${type}`).style.width = `${value * 10}%`;
        document.getElementById(`value-${type}`).textContent = value;
    }
    
    saveResult() {
        const grade = document.querySelector('.grade-value').textContent;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 800;
        canvas.height = 600;
        
        // Draw result
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Grade: ${grade}/10`, canvas.width / 2, 100);
        
        // Download
        const link = document.createElement('a');
        link.download = `pokemon-grade-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        alert('Hasil tersimpan!');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new CardGrader();
});
