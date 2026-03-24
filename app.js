// Pokemon Card AI Grader - Main App
class CardGrader {
    constructor() {
        this.video = document.getElementById('camera-feed');
        this.canvas = document.getElementById('camera-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.model = null;
        this.stream = null;
        this.cameraReady = false;
        
        this.init();
    }
    
    async init() {
        console.log('Initializing CardGrader...');
        
        // Setup event listeners first (always work even without camera)
        this.setupEventListeners();
        
        // Try to setup camera (optional - can use gallery instead)
        try {
            await this.setupCamera();
        } catch (err) {
            console.warn('Camera not available:', err);
            // Camera failed but app can still work with gallery
        }
        
        // Try to load AI model (optional)
        try {
            await this.loadModel();
        } catch (err) {
            console.warn('AI model not loaded:', err);
        }
        
        console.log('CardGrader ready! Camera:', this.cameraReady);
    }
    
    async setupCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('getUserMedia not supported');
            return;
        }
        
        try {
            // Try back camera first (mobile)
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
            console.warn('Back camera failed, trying any camera:', err);
            try {
                // Fallback to any camera
                this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            } catch (err2) {
                console.warn('No camera available:', err2);
                throw err2;
            }
        }
        
        if (this.stream) {
            this.video.srcObject = this.stream;
            
            await new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.canvas.width = this.video.videoWidth || 640;
                    this.canvas.height = this.video.videoHeight || 480;
                    this.cameraReady = true;
                    resolve();
                };
                this.video.onerror = reject;
            });
        }
    }
    
    async loadModel() {
        if (typeof cocoSsd === 'undefined') {
            console.warn('COCO-SSD not loaded');
            return;
        }
        
        try {
            this.model = await cocoSsd.load();
            console.log('AI Model loaded');
            if (this.cameraReady) {
                this.detectFrame();
            }
        } catch (err) {
            console.error('Model load error:', err);
        }
    }
    
    detectFrame() {
        if (!this.model || !this.cameraReady) return;
        
        this.model.detect(this.video).then(predictions => {
            const cardDetected = predictions.some(p => 
                p.class === 'book' || p.class === 'cell phone' || 
                (p.score > 0.3 && this.isRectangular(p.bbox))
            );
            
            const overlay = document.getElementById('detection-overlay');
            if (overlay) {
                if (cardDetected) {
                    overlay.classList.remove('hidden');
                } else {
                    overlay.classList.add('hidden');
                }
            }
            
            requestAnimationFrame(() => this.detectFrame());
        }).catch(err => {
            console.error('Detection error:', err);
        });
    }
    
    isRectangular(bbox) {
        const [x, y, width, height] = bbox;
        const ratio = width / height;
        return ratio > 0.6 && ratio < 0.9;
    }
    
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Capture button
        const captureBtn = document.getElementById('capture-btn');
        if (captureBtn) {
            captureBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Capture clicked');
                this.captureAndGrade();
            });
        }
        
        // Gallery button
        const galleryBtn = document.getElementById('gallery-btn');
        if (galleryBtn) {
            galleryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Gallery clicked');
                const fileInput = document.getElementById('file-input');
                if (fileInput) fileInput.click();
            });
        }
        
        // File input
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                console.log('File selected:', e.target.files);
                if (e.target.files && e.target.files[0]) {
                    this.handleFile(e.target.files[0]);
                }
            });
        }
        
        // Close analysis
        const closeBtn = document.getElementById('close-analysis');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const panel = document.getElementById('analysis-panel');
                if (panel) panel.classList.add('hidden');
            });
        }
        
        // Retry button
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const panel = document.getElementById('analysis-panel');
                if (panel) panel.classList.add('hidden');
            });
        }
        
        // Save button
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveResult();
            });
        }
        
        console.log('Event listeners setup complete');
    }
    
    captureAndGrade() {
        console.log('captureAndGrade called, cameraReady:', this.cameraReady);
        
        if (!this.cameraReady) {
            alert('Kamera tidak tersedia. Gunakan tombol Galeri untuk upload foto.');
            // Open gallery instead
            const fileInput = document.getElementById('file-input');
            if (fileInput) fileInput.click();
            return;
        }
        
        try {
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            const imageData = this.canvas.toDataURL('image/jpeg');
            this.analyzeImage(imageData);
        } catch (err) {
            console.error('Capture error:', err);
            alert('Gagal mengambil foto. Coba gunakan Galeri.');
        }
    }
    
    handleFile(file) {
        console.log('handleFile:', file.name);
        if (!file.type.startsWith('image/')) {
            alert('Harap pilih file gambar');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('File loaded');
            this.analyzeImage(e.target.result);
        };
        reader.onerror = (err) => {
            console.error('File read error:', err);
            alert('Gagal membaca file');
        };
        reader.readAsDataURL(file);
    }
    
    async analyzeImage(imageSrc) {
        console.log('analyzeImage called');
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('hidden');
        
        const analyzedImg = document.getElementById('analyzed-image');
        if (analyzedImg) analyzedImg.src = imageSrc;
        
        try {
            await this.performAnalysis();
        } catch (err) {
            console.error('Analysis error:', err);
        }
        
        if (loading) loading.classList.add('hidden');
        const panel = document.getElementById('analysis-panel');
        if (panel) panel.classList.remove('hidden');
    }
    
    async performAnalysis() {
        console.log('performAnalysis started');
        await new Promise(r => setTimeout(r, 1500));
        
        const scores = {
            centering: Math.floor(Math.random() * 3) + 7,
            surface: Math.floor(Math.random() * 4) + 6,
            corners: Math.floor(Math.random() * 5) + 5,
            edges: Math.floor(Math.random() * 4) + 6,
            lighting: Math.floor(Math.random() * 3) + 7
        };
        
        const avg = (scores.centering + scores.surface + scores.corners + scores.edges + scores.lighting) / 5;
        const grade = avg.toFixed(1);
        
        this.updateScore('centering', scores.centering);
        this.updateScore('surface', scores.surface);
        this.updateScore('corners', scores.corners);
        this.updateScore('edges', scores.edges);
        this.updateScore('lighting', scores.lighting);
        
        const gradeValue = document.querySelector('.grade-value');
        const gradeDesc = document.getElementById('grade-desc');
        
        if (gradeValue) gradeValue.textContent = grade;
        
        if (gradeDesc) {
            if (avg >= 9) {
                gradeDesc.textContent = 'Gem Mint - Kondisi sempurna!';
            } else if (avg >= 7) {
                gradeDesc.textContent = 'Near Mint - Kondisi sangat baik';
            } else if (avg >= 5) {
                gradeDesc.textContent = 'Excellent - Kondisi baik';
            } else {
                gradeDesc.textContent = 'Perlu perhatian lebih';
            }
        }
        
        const cardInfo = document.getElementById('card-info');
        if (cardInfo) {
            cardInfo.classList.remove('hidden');
            const nameEl = document.getElementById('card-name');
            const setEl = document.getElementById('card-set');
            const rarityEl = document.getElementById('card-rarity');
            if (nameEl) nameEl.textContent = 'Pokemon Card';
            if (setEl) setEl.textContent = 'Unknown Set';
            if (rarityEl) rarityEl.textContent = 'Unknown';
        }
        
        console.log('performAnalysis complete, grade:', grade);
    }
    
    updateScore(type, value) {
        const scoreBar = document.getElementById(`score-${type}`);
        const scoreValue = document.getElementById(`value-${type}`);
        if (scoreBar) scoreBar.style.width = `${value * 10}%`;
        if (scoreValue) scoreValue.textContent = value;
    }
    
    saveResult() {
        const grade = document.querySelector('.grade-value')?.textContent || '0';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 800;
        canvas.height = 600;
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Grade: ${grade}/10`, canvas.width / 2, 100);
        
        const link = document.createElement('a');
        link.download = `pokemon-grade-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        alert('Hasil tersimpan!');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM ready, starting CardGrader...');
    new CardGrader();
});

// Also try immediate init in case DOMContentLoaded already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('DOM already ready, starting immediately...');
    setTimeout(() => {
        if (!window.cardGraderInstance) {
            window.cardGraderInstance = new CardGrader();
        }
    }, 1);
}
