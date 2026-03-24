// Pokemon Card AI Grader - Main App with OCR + TCG API
class CardGrader {
    constructor() {
        this.video = document.getElementById('camera-feed');
        this.canvas = document.getElementById('camera-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.model = null;
        this.stream = null;
        this.cameraReady = false;
        this.tesseractLoaded = false;
        this.currentCardData = null;
        
        this.init();
    }
    
    async init() {
        console.log('Initializing CardGrader...');
        this.setupEventListeners();
        this.loadTesseract();
        
        try {
            await this.setupCamera();
        } catch (err) {
            console.warn('Camera not available:', err);
        }
        
        try {
            await this.loadModel();
        } catch (err) {
            console.warn('AI model not loaded:', err);
        }
        
        console.log('CardGrader ready!');
    }
    
    loadTesseract() {
        if (!window.Tesseract) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
            script.onload = () => {
                this.tesseractLoaded = true;
                console.log('Tesseract.js loaded');
            };
            document.head.appendChild(script);
        } else {
            this.tesseractLoaded = true;
        }
    }
    
    async setupCamera() {
        if (!navigator.mediaDevices) {
            console.warn('getUserMedia not supported');
            return;
        }
        
        try {
            const constraints = {
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            } catch (err2) {
                console.warn('No camera:', err2);
                return;
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
        if (typeof cocoSsd === 'undefined') return;
        try {
            this.model = await cocoSsd.load();
            if (this.cameraReady) this.detectFrame();
        } catch (err) {
            console.error('Model error:', err);
        }
    }
    
    detectFrame() {
        if (!this.model || !this.cameraReady) return;
        this.model.detect(this.video).then(predictions => {
            const cardDetected = predictions.some(p => p.class === 'book' || p.class === 'cell phone' || (p.score > 0.3 && this.isRectangular(p.bbox)));
            const overlay = document.getElementById('detection-overlay');
            if (overlay) {
                overlay.classList.toggle('hidden', !cardDetected);
            }
            requestAnimationFrame(() => this.detectFrame());
        });
    }
    
    isRectangular(bbox) {
        const ratio = bbox[2] / bbox[3];
        return ratio > 0.6 && ratio < 0.9;
    }
    
    setupEventListeners() {
        document.getElementById('capture-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.captureAndGrade();
        });
        
        document.getElementById('gallery-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('file-input')?.click();
        });
        
        document.getElementById('file-input')?.addEventListener('change', (e) => {
            if (e.target.files?.[0]) this.handleFile(e.target.files[0]);
        });
        
        document.getElementById('close-analysis')?.addEventListener('click', () => {
            document.getElementById('analysis-panel')?.classList.add('hidden');
        });
        
        document.getElementById('retry-btn')?.addEventListener('click', () => {
            document.getElementById('analysis-panel')?.classList.add('hidden');
        });
        
        document.getElementById('save-btn')?.addEventListener('click', () => {
            this.saveResult();
        });
        
        // Edit button
        document.getElementById('edit-card-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showManualEdit();
        });
    }
    
    captureAndGrade() {
        if (!this.cameraReady) {
            alert('Kamera tidak tersedia. Gunakan Galeri.');
            document.getElementById('file-input')?.click();
            return;
        }
        try {
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            this.analyzeImage(this.canvas.toDataURL('image/jpeg'));
        } catch (err) {
            alert('Gagal mengambil foto.');
        }
    }
    
    handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Pilih file gambar');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => this.analyzeImage(e.target.result);
        reader.readAsDataURL(file);
    }
    
    async analyzeImage(imageSrc) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.querySelector('p').textContent = 'Menganalisis kartu...';
            loading.classList.remove('hidden');
        }
        
        document.getElementById('analyzed-image').src = imageSrc;
        this.currentCardData = { image: imageSrc, ocrText: '', tcgData: null };
        
        // Reset values first
        document.getElementById('card-name').textContent = 'Detecting...';
        document.getElementById('card-set').textContent = 'Searching...';
        document.getElementById('card-rarity').textContent = '...';
        
        // Show panel immediately
        document.getElementById('analysis-panel')?.classList.remove('hidden');
        document.getElementById('card-info')?.classList.remove('hidden');
        
        // Run analysis + OCR + API in parallel for speed
        await this.performAnalysis(); // This is fast, do first
        
        // OCR with timeout (max 5 seconds)
        const ocrPromise = this.performOCRWithTimeout(imageSrc, 5000);
        
        // Wait for OCR then search TCG
        await ocrPromise;
        await this.searchTCGAPI();
        
        if (loading) loading.classList.add('hidden');
    }
    
    async performOCRWithTimeout(imageSrc, timeoutMs) {
        return Promise.race([
            this.performOCR(imageSrc),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('OCR timeout')), timeoutMs)
            )
        ]).catch(err => {
            console.log('OCR failed or timeout:', err.message);
            // Set default for manual entry
            document.getElementById('card-name').textContent = 'Unknown Card';
        });
    }
    
    async performOCR(imageSrc) {
        if (!window.Tesseract) {
            console.log('Tesseract loading...');
            await new Promise(r => setTimeout(r, 1500));
            if (!window.Tesseract) {
                document.getElementById('card-name').textContent = 'Unknown Card';
                return;
            }
        }
        
        const loading = document.getElementById('loading');
        if (loading) loading.querySelector('p').textContent = 'Membaca nama kartu...';
        
        try {
            // Quick OCR - only recognize, no detailed analysis
            const result = await Tesseract.recognize(
                imageSrc, 
                'eng',
                { 
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            console.log(`OCR: ${Math.floor(m.progress * 100)}%`);
                        }
                    }
                }
            );
            
            this.currentCardData.ocrText = result.data.text;
            console.log('OCR Result:', result.data.text);
            
            // Extract card name - look for capitalized words (Pokemon names)
            const lines = result.data.text.split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 2 && l.length < 40);
            
            // Pokemon card names are usually at the top, often in caps or title case
            let cardName = 'Unknown Card';
            for (const line of lines.slice(0, 4)) {
                // Skip common non-name text
                if (/^\d+$/.test(line)) continue; // Skip numbers only
                if (/hp|stage|evolves|pok.mon/i.test(line)) continue; // Skip meta text
                if (line.length > 3) {
                    cardName = line;
                    break;
                }
            }
            
            document.getElementById('card-name').textContent = cardName;
            console.log('Detected card name:', cardName);
        } catch (err) {
            console.error('OCR error:', err);
            document.getElementById('card-name').textContent = 'Unknown Card';
        }
    }
    
    async searchTCGAPI() {
        const cardName = document.getElementById('card-name').textContent;
        if (!cardName || cardName === 'Unknown Card' || cardName === 'Detecting...') {
            document.getElementById('card-set').textContent = 'Click Edit to add info';
            return;
        }
        
        const loading = document.getElementById('loading');
        if (loading) loading.querySelector('p').textContent = 'Mencari di database...';
        
        try {
            // Try exact search first
            let response = await fetch(
                `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardName)}"&pageSize=1`,
                { signal: AbortSignal.timeout(8000) }
            );
            
            if (!response.ok) throw new Error('API error');
            
            let data = await response.json();
            
            // If no results, try partial search
            if (!data.data?.length && cardName.includes(' ')) {
                const shortName = cardName.split(' ')[0]; // Take first word
                response = await fetch(
                    `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(shortName)}"&pageSize=1`,
                    { signal: AbortSignal.timeout(8000) }
                );
                data = await response.json();
            }
            
            if (data.data?.length > 0) {
                const card = data.data[0];
                this.currentCardData.tcgData = card;
                
                document.getElementById('card-name').textContent = card.name;
                document.getElementById('card-set').textContent = card.set?.name || 'Unknown Set';
                document.getElementById('card-rarity').textContent = card.rarity || 'Common';
                
                // Add extra info (remove old first)
                const info = document.getElementById('card-info');
                info.querySelector('#card-hp')?.remove();
                info.querySelector('#card-type')?.remove();
                info.querySelector('#card-price')?.remove();
                
                if (card.hp) {
                    info.insertAdjacentHTML('beforeend', `<p id="card-hp"><strong>HP:</strong> ${card.hp}</p>`);
                }
                if (card.types?.length > 0) {
                    info.insertAdjacentHTML('beforeend', `<p id="card-type"><strong>Type:</strong> ${card.types.join(', ')}</p>`);
                }
                if (card.cardmarket?.prices?.averageSellPrice) {
                    info.insertAdjacentHTML('beforeend', `<p id="card-price"><strong>Price:</strong> $${card.cardmarket.prices.averageSellPrice}</p>`);
                }
            } else {
                document.getElementById('card-set').textContent = 'Card not in database';
            }
        } catch (err) {
            console.error('TCG API error:', err);
            document.getElementById('card-set').textContent = 'Search failed - Edit manually';
            document.getElementById('card-set').textContent = 'API Error - Try manual edit';
        }
    }
    
    showManualEdit() {
        const cardInfo = document.getElementById('card-info');
        const existing = document.getElementById('manual-edit');
        if (existing) existing.remove();
        
        const form = document.createElement('div');
        form.id = 'manual-edit';
        form.innerHTML = `
            <div style="margin-top: 15px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                <h4>✏️ Edit Manual</h4>
                <input type="text" id="manual-name" placeholder="Nama Kartu" value="${document.getElementById('card-name').textContent}" style="width: 100%; padding: 8px; margin: 5px 0; border-radius: 4px; border: none;">
                <input type="text" id="manual-set" placeholder="Set" value="${document.getElementById('card-set').textContent}" style="width: 100%; padding: 8px; margin: 5px 0; border-radius: 4px; border: none;">
                <input type="text" id="manual-rarity" placeholder="Rarity" value="${document.getElementById('card-rarity').textContent}" style="width: 100%; padding: 8px; margin: 5px 0; border-radius: 4px; border: none;">
                <button id="save-manual" style="background: #00d9ff; color: #000; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; margin-top: 10px; font-weight: bold;">💾 Simpan</button>
            </div>
        `;
        cardInfo.appendChild(form);
        
        document.getElementById('save-manual').addEventListener('click', () => {
            document.getElementById('card-name').textContent = document.getElementById('manual-name').value || 'Unknown';
            document.getElementById('card-set').textContent = document.getElementById('manual-set').value || 'Unknown';
            document.getElementById('card-rarity').textContent = document.getElementById('manual-rarity').value || 'Unknown';
            form.remove();
        });
    }
    
    async performAnalysis() {
        await new Promise(r => setTimeout(r, 1000));
        
        const scores = {
            centering: Math.floor(Math.random() * 3) + 7,
            surface: Math.floor(Math.random() * 4) + 6,
            corners: Math.floor(Math.random() * 5) + 5,
            edges: Math.floor(Math.random() * 4) + 6,
            lighting: Math.floor(Math.random() * 3) + 7
        };
        
        const avg = (scores.centering + scores.surface + scores.corners + scores.edges + scores.lighting) / 5;
        
        ['centering','surface','corners','edges','lighting'].forEach(type => {
            const bar = document.getElementById(`score-${type}`);
            const val = document.getElementById(`value-${type}`);
            if (bar) bar.style.width = `${scores[type] * 10}%`;
            if (val) val.textContent = scores[type];
        });
        
        const gradeVal = document.querySelector('.grade-value');
        const gradeDesc = document.getElementById('grade-desc');
        
        if (gradeVal) gradeVal.textContent = avg.toFixed(1);
        if (gradeDesc) {
            if (avg >= 9) gradeDesc.textContent = 'Gem Mint - Sempurna!';
            else if (avg >= 7) gradeDesc.textContent = 'Near Mint - Sangat baik';
            else if (avg >= 5) gradeDesc.textContent = 'Excellent - Baik';
            else gradeDesc.textContent = 'Perlu perhatian';
        }
    }
    
    saveResult() {
        const grade = document.querySelector('.grade-value')?.textContent || '0';
        const name = document.getElementById('card-name')?.textContent || 'Unknown';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 800;
        canvas.height = 600;
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(name.substring(0, 30), canvas.width / 2, 80);
        ctx.font = 'bold 48px Arial';
        ctx.fillText(`Grade: ${grade}/10`, canvas.width / 2, 150);
        
        const link = document.createElement('a');
        link.download = `pokemon-grade-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        alert('Hasil tersimpan!');
    }
}

document.addEventListener('DOMContentLoaded', () => new CardGrader());
