// Pokemon Card AI Grader
class CardGrader {
    constructor() {
        this.video = document.getElementById('camera-feed');
        this.canvas = document.getElementById('camera-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.stream = null;
        this.cameraReady = false;
        this.tcgData = null;
        this.frontImage = null;
        this.backImage = null;
        this.currentStep = 'front';
        this.lastAnalysis = null;
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.updateGuideText();
        try { await this.setupCamera(); } catch (e) {}
    }
    
    async setupCamera() {
        if (!navigator.mediaDevices) return;
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' }, 
                audio: false 
            });
        } catch {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (this.stream) {
            this.video.srcObject = this.stream;
            await new Promise(r => this.video.onloadedmetadata = () => { 
                this.cameraReady = true; 
                r(); 
            });
        }
    }
    
    setupEventListeners() {
        document.getElementById('capture-btn')?.addEventListener('click', (e) => { 
            e.preventDefault(); 
            this.capture(); 
        });
        document.getElementById('gallery-btn')?.addEventListener('click', () => 
            document.getElementById('file-input')?.click()
        );
        document.getElementById('file-input')?.addEventListener('change', (e) => { 
            if (e.target.files?.[0]) this.handleFile(e.target.files[0]); 
        });
        document.getElementById('close-analysis')?.addEventListener('click', () => {
            document.getElementById('analysis-panel')?.classList.add('hidden');
            this.reset();
        });
        document.getElementById('retry-btn')?.addEventListener('click', () => {
            document.getElementById('analysis-panel')?.classList.add('hidden');
            this.reset();
        });
        document.getElementById('save-btn')?.addEventListener('click', () => this.saveResult());
        document.getElementById('edit-card-btn')?.addEventListener('click', () => this.showCardSearch());
    }
    
    updateGuideText() {
        const guideText = document.querySelector('.guide-text');
        const captureHint = document.querySelector('.capture-hint');
        
        if (this.currentStep === 'front') {
            if (guideText) guideText.textContent = 'Posisikan SISI DEPAN kartu di area ini';
            if (captureHint) captureHint.textContent = 'Tap untuk foto sisi depan';
        } else if (this.currentStep === 'back') {
            if (guideText) guideText.textContent = 'Posisikan SISI BELAKANG kartu di area ini';
            if (captureHint) captureHint.textContent = 'Tap untuk foto sisi belakang';
        }
    }
    
    reset() {
        this.currentStep = 'front';
        this.frontImage = null;
        this.backImage = null;
        this.updateGuideText();
        document.getElementById('full-report')?.classList.add('hidden');
        document.getElementById('score-breakdown')?.remove();
        document.getElementById('card-search')?.remove();
    }
    
    capture() {
        if (!this.cameraReady) { 
            document.getElementById('file-input')?.click(); 
            return; 
        }
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        const imageData = this.canvas.toDataURL('image/jpeg');
        
        if (this.currentStep === 'front') {
            this.frontImage = imageData;
            this.currentStep = 'back';
            this.updateGuideText();
            alert('✅ Sisi depan tersimpan! Sekarang foto sisi belakang kartu.');
        } else if (this.currentStep === 'back') {
            this.backImage = imageData;
            this.analyzeBoth();
        }
    }
    
    handleFile(file) {
        if (!file.type.startsWith('image/')) return alert('Pilih file gambar');
        const reader = new FileReader();
        reader.onload = (e) => {
            if (this.currentStep === 'front') {
                this.frontImage = e.target.result;
                this.currentStep = 'back';
                this.updateGuideText();
                alert('✅ Sisi depan tersimpan! Sekarang upload sisi belakang.');
            } else if (this.currentStep === 'back') {
                this.backImage = e.target.result;
                this.analyzeBoth();
            }
        };
        reader.readAsDataURL(file);
    }
    
    async analyzeBoth() {
        const loading = document.getElementById('loading');
        const loadingText = loading?.querySelector('p');
        loading?.classList.remove('hidden');
        
        if (loadingText) loadingText.textContent = '📸 Memuat gambar...';
        await this.delay(800);
        
        const frontImg = await this.loadImage(this.frontImage);
        const backImg = await this.loadImage(this.backImage);
        
        if (loadingText) loadingText.textContent = '🔧 Preprocessing gambar...';
        await this.delay(1200);
        
        // Analyze front
        const frontData = await this.getImageData(frontImg);
        const frontScores = {
            centering: this.checkCentering(frontData, 500, Math.floor(500 * frontImg.height / frontImg.width)),
            surface: this.checkSurface(frontData, 500, Math.floor(500 * frontImg.height / frontImg.width)),
            corners: this.checkCorners(frontData, 500, Math.floor(500 * frontImg.height / frontImg.width)),
            edges: this.checkEdges(frontData, 500, Math.floor(500 * frontImg.height / frontImg.width)),
            lighting: this.checkLighting(frontData)
        };
        
        if (loadingText) loadingText.textContent = '📐 Analisis sisi belakang...';
        await this.delay(2000);
        
        // Analyze back
        const backData = await this.getImageData(backImg);
        const backScores = {
            centering: this.checkCentering(backData, 500, Math.floor(500 * backImg.height / backImg.width)),
            surface: this.checkSurface(backData, 500, Math.floor(500 * backImg.height / backImg.width)),
            corners: this.checkCorners(backData, 500, Math.floor(500 * backImg.height / backImg.width)),
            edges: this.checkEdges(backData, 500, Math.floor(500 * backImg.height / backImg.width)),
            lighting: this.checkLighting(backData)
        };
        
        if (loadingText) loadingText.textContent = '🧮 Menghitung grade...';
        await this.delay(1000);
        
        const combinedScores = {
            centering: Math.round((frontScores.centering * 0.6 + backScores.centering * 0.4)),
            surface: Math.round((frontScores.surface * 0.6 + backScores.surface * 0.4)),
            corners: Math.round((frontScores.corners * 0.5 + backScores.corners * 0.5)),
            edges: Math.round((frontScores.edges * 0.5 + backScores.edges * 0.5)),
            lighting: Math.round((frontScores.lighting + backScores.lighting) / 2)
        };
        
        const grade = this.calcGrade(combinedScores);
        
        // Show results
        document.getElementById('analyzed-image').src = this.frontImage;
        this.showBackImage(this.backImage);
        
        document.getElementById('analysis-panel')?.classList.remove('hidden');
        document.getElementById('card-info')?.classList.remove('hidden');
        
        this.displayScores(combinedScores);
        document.querySelector('.grade-value').textContent = grade.num;
        document.getElementById('grade-desc').textContent = `${grade.label} - ${grade.desc}`;
        
        this.showDetailBreakdown(frontScores, backScores);
        
        // Store for later
        this.lastAnalysis = { frontScores, backScores, combinedScores, grade };
        
        // Reset and show search
        document.getElementById('card-name').textContent = '--';
        document.getElementById('card-set').textContent = '--';
        document.getElementById('card-rarity').textContent = '--';
        document.getElementById('full-report')?.classList.add('hidden');
        document.getElementById('card-search')?.remove();
        this.showCardSearch();
        
        loading?.classList.add('hidden');
        this.currentStep = 'front';
        this.updateGuideText();
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async getImageData(img) {
        const c = document.createElement('canvas');
        const x = c.getContext('2d');
        c.width = 500;
        c.height = Math.floor(500 * img.height / img.width);
        x.drawImage(img, 0, 0, c.width, c.height);
        return x.getImageData(0, 0, c.width, c.height).data;
    }
    
    loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = src;
        });
    }
    
    checkCentering(d, w, h) {
        const b = Math.floor(w * 0.08);
        const leftSamples = [], rightSamples = [];
        
        for (let y = 0; y < h; y += 8) {
            for (let x = 0; x < b; x += 3) {
                const i = (Math.floor(y) * w + x) * 4;
                leftSamples.push((d[i]+d[i+1]+d[i+2])/3);
            }
            for (let x = w - b; x < w; x += 3) {
                const i = (Math.floor(y) * w + x) * 4;
                rightSamples.push((d[i]+d[i+1]+d[i+2])/3);
            }
        }
        
        const leftAvg = leftSamples.reduce((a,b)=>a+b,0) / leftSamples.length;
        const rightAvg = rightSamples.reduce((a,b)=>a+b,0) / rightSamples.length;
        const diff = Math.abs(leftAvg - rightAvg) / 255;
        
        return Math.round(Math.max(0, Math.min(10, 10 - diff * 4)));
    }
    
    checkSurface(d, w, h) {
        const samples = [];
        const m = 0.15;
        
        for (let y = h * m; y < h * (1-m); y += 5) {
            for (let x = w * m; x < w * (1-m); x += 5) {
                const i = (Math.floor(y) * w + Math.floor(x)) * 4;
                samples.push((d[i]+d[i+1]+d[i+2])/3);
            }
        }
        
        const mean = samples.reduce((a,b)=>a+b,0) / samples.length;
        const variance = samples.reduce((sum,v)=>sum+Math.pow(v-mean,2),0) / samples.length;
        const stdDev = Math.sqrt(variance) / 255;
        
        let score = 10;
        if (stdDev > 0.20) score -= (stdDev - 0.20) * 12;
        if (stdDev < 0.02) score -= 1;
        
        return Math.round(Math.max(0, Math.min(10, score)));
    }
    
    checkCorners(d, w, h) {
        const cs = Math.floor(Math.min(w, h) * 0.10);
        const corners = [[0,0], [w-cs,0], [0,h-cs], [w-cs,h-cs]];
        let total = 0;
        
        for (const [cx, cy] of corners) {
            let bright = 0, count = 0;
            for (let y = cy; y < cy + cs; y += 4) {
                for (let x = cx; x < cx + cs; x += 4) {
                    const i = (Math.floor(y) * w + Math.floor(x)) * 4;
                    const brightness = (d[i]+d[i+1]+d[i+2])/3;
                    if (brightness > 250) bright++;
                    count++;
                }
            }
            total += Math.max(0, 10 - (bright/count) * 15);
        }
        return Math.round(total / 4);
    }
    
    checkEdges(d, w, h) {
        const ew = Math.floor(w * 0.05);
        let bright = 0, count = 0;
        
        const edges = [
            [ew, w-ew, 0, ew],
            [ew, w-ew, h-ew, h],
            [0, ew, ew, h-ew],
            [w-ew, w, ew, h-ew]
        ];
        
        for (const [x1, x2, y1, y2] of edges) {
            for (let y = y1; y < y2; y += 5) {
                for (let x = x1; x < x2; x += 5) {
                    const i = (Math.floor(y) * w + Math.floor(x)) * 4;
                    if ((d[i]+d[i+1]+d[i+2])/3 > 245) bright++;
                    count++;
                }
            }
        }
        return Math.round(Math.max(0, 10 - (bright/count) * 8));
    }
    
    checkLighting(d) {
        const samples = [];
        const step = Math.max(1, Math.floor((d.length/4)/3000));
        
        for (let i = 0; i < d.length; i += step * 4) {
            samples.push((d[i]+d[i+1]+d[i+2])/3);
        }
        
        const avg = samples.reduce((a,b)=>a+b,0) / samples.length;
        const dark = samples.filter(b => b < 30).length / samples.length;
        const bright = samples.filter(b => b > 240).length / samples.length;
        
        let score = 10;
        if (avg < 60) score -= (60 - avg) / 6;
        if (avg > 230) score -= (avg - 230) / 6;
        score -= dark * 10;
        score -= bright * 10;
        
        return Math.round(Math.max(0, Math.min(10, score)));
    }
    
    calcGrade(s) {
        const sum = s.centering*0.20 + s.surface*0.30 + s.corners*0.30 + s.edges*0.10 + s.lighting*0.10;
        if (sum >= 9.5) return {num: sum.toFixed(1), label: 'Gem Mint', desc: 'Kondisi sempurna!'};
        if (sum >= 9.0) return {num: sum.toFixed(1), label: 'Mint', desc: 'Sangat baik'};
        if (sum >= 8.0) return {num: sum.toFixed(1), label: 'NM-Mint', desc: 'Near Mint'};
        if (sum >= 7.0) return {num: sum.toFixed(1), label: 'Near Mint', desc: 'Baik'};
        if (sum >= 6.0) return {num: sum.toFixed(1), label: 'Excellent', desc: 'Cukup baik'};
        if (sum >= 5.0) return {num: sum.toFixed(1), label: 'Good', desc: 'Cukup'};
        return {num: sum.toFixed(1), label: 'Poor', desc: 'Perlu perhatian'};
    }
    
    displayScores(s) {
        for (const [k, v] of Object.entries(s)) {
            const bar = document.getElementById(`score-${k}`);
            const val = document.getElementById(`value-${k}`);
            if (bar) bar.style.width = `${v*10}%`;
            if (val) val.textContent = v;
        }
    }
    
    showBackImage(src) {
        const panel = document.querySelector('.result-image');
        let backImg = document.getElementById('back-image');
        if (!backImg) {
            panel.insertAdjacentHTML('beforeend', `
                <img id="back-image" style="margin-top:10px;max-width:45%;border-radius:8px;border:2px solid #00d9ff;">
                <div id="back-label" style="font-size:12px;color:#aaa;margin-top:5px;">Sisi Belakang</div>
            `);
            backImg = document.getElementById('back-image');
        }
        backImg.src = src;
    }
    
    showDetailBreakdown(front, back) {
        const info = document.getElementById('card-info');
        document.getElementById('score-breakdown')?.remove();
        
        const breakdown = document.createElement('div');
        breakdown.id = 'score-breakdown';
        breakdown.innerHTML = `
            <div style="margin-top:15px;padding:15px;background:rgba(0,217,255,0.1);border-radius:8px;">
                <h4 style="margin:0 0 10px 0;">📊 Detail Analisis</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;">
                    <div>
                        <strong style="color:#00d9ff;">Sisi Depan</strong><br>
                        Centering: ${front.centering}/10<br>
                        Surface: ${front.surface}/10<br>
                        Corners: ${front.corners}/10<br>
                        Edges: ${front.edges}/10
                    </div>
                    <div>
                        <strong style="color:#00d9ff;">Sisi Belakang</strong><br>
                        Centering: ${back.centering}/10<br>
                        Surface: ${back.surface}/10<br>
                        Corners: ${back.corners}/10<br>
                        Edges: ${back.edges}/10
                    </div>
                </div>
            </div>
        `;
        info.insertAdjacentElement('afterbegin', breakdown);
    }
    
    showCardSearch() {
        const info = document.getElementById('card-info');
        document.getElementById('card-search')?.remove();
        
        const searchDiv = document.createElement('div');
        searchDiv.id = 'card-search';
        searchDiv.innerHTML = `
            <div style="margin-top:15px;padding:15px;background:rgba(255,255,255,0.1);border-radius:8px;">
                <h4>🔍 Cari Kartu Pokemon</h4>
                <input id="search-input" style="width:100%;padding:10px;margin:5px 0;border-radius:4px;border:none;font-size:14px;" placeholder="Ketik nama kartu (Charizard, Pikachu)...">
                <div id="search-results" style="max-height:200px;overflow-y:auto;margin-top:10px;"></div>
            </div>`;
        info.appendChild(searchDiv);
        
        const input = document.getElementById('search-input');
        let debounceTimer;
        
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this.searchTCG(e.target.value), 500);
        });
        
        input.focus();
    }
    
    async searchTCG(query) {
        if (!query || query.length < 2) return;
        
        const resultsDiv = document.getElementById('search-results');
        resultsDiv.innerHTML = '<p style="color:#aaa;font-size:12px;">Mencari...</p>';
        
        try {
            const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(query)}"&pageSize=8`);
            const data = await res.json();
            
            if (data.data?.length > 0) {
                resultsDiv.innerHTML = data.data.map(card => `
                    <div class="card-result" data-id="${card.id}" style="padding:10px;margin:5px 0;background:rgba(255,255,255,0.1);border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:10px;">
                        <img src="${card.images.small}" style="width:50px;height:70px;object-fit:contain;border-radius:4px;">
                        <div style="flex:1;">
                            <div style="font-weight:bold;color:#fff;">${card.name}</div>
                            <div style="font-size:12px;color:#aaa;">${card.set.name} • ${card.rarity || 'Common'}</div>
                            ${card.cardmarket?.prices?.averageSellPrice ? `<div style="font-size:12px;color:#00d9ff;">$${card.cardmarket.prices.averageSellPrice}</div>` : ''}
                        </div>
                    </div>
                `).join('');
                
                resultsDiv.querySelectorAll('.card-result').forEach(el => {
                    el.addEventListener('click', () => {
                        const card = data.data.find(c => c.id === el.dataset.id);
                        if (card) this.selectCard(card);
                    });
                });
            } else {
                resultsDiv.innerHTML = '<p style="color:#aaa;font-size:12px;">Kartu tidak ditemukan</p>';
            }
        } catch (err) {
            resultsDiv.innerHTML = '<p style="color:#ff6b6b;font-size:12px;">Error</p>';
        }
    }
    
    selectCard(card) {
        this.tcgData = card;
        document.getElementById('card-name').textContent = card.name;
        document.getElementById('card-set').textContent = card.set.name;
        document.getElementById('card-rarity').textContent = card.rarity || 'Common';
        
        const info = document.getElementById('card-info');
        ['#card-hp','#card-type','#card-price','#card-number'].forEach(sel => info.querySelector(sel)?.remove());
        
        if (card.hp) info.insertAdjacentHTML('beforeend', `<p id="card-hp"><strong>HP:</strong> ${card.hp}</p>`);
        if (card.types?.length) info.insertAdjacentHTML('beforeend', `<p id="card-type"><strong>Type:</strong> ${card.types.join(', ')}</p>`);
        if (card.number) info.insertAdjacentHTML('beforeend', `<p id="card-number"><strong>Number:</strong> ${card.number}/${card.set.printedTotal}</p>`);
        if (card.cardmarket?.prices?.averageSellPrice) {
            info.insertAdjacentHTML('beforeend', `<p id="card-price"><strong>Market Price:</strong> <span style="color:#00d9ff;">$${card.cardmarket.prices.averageSellPrice}</span></p>`);
        }
        
        document.getElementById('card-search')?.remove();
        
        // Update and show report
        if (this.lastAnalysis) {
            this.updateFullReport(
                this.lastAnalysis.frontScores, 
                this.lastAnalysis.backScores, 
                this.lastAnalysis.combinedScores, 
                this.lastAnalysis.grade
            );
        }
    }
    
    updateFullReport(frontScores, backScores, combinedScores, grade) {
        const report = document.getElementById('full-report');
        if (!report) return;
        
        const cardName = document.getElementById('card-name')?.textContent || 'Unknown Card';
        const cardSet = document.getElementById('card-set')?.textContent || '-';
        const cardRarity = document.getElementById('card-rarity')?.textContent || '-';
        const timestamp = new Date().toLocaleString('id-ID');
        
        let recommendation = '';
        if (combinedScores.corners < 6) recommendation += '• Sudut kartu perlu diperhatikan. ';
        if (combinedScores.edges < 6) recommendation += '• Tepi kartu terlihat aus. ';
        if (combinedScores.surface < 6) recommendation += '• Permukaan ada scratches. ';
        if (combinedScores.centering < 7) recommendation += '• Centering kurang sempurna. ';
        if (!recommendation) recommendation = '• Kartu dalam kondisi baik!';
        
        document.getElementById('report-front-img').src = this.frontImage;
        document.getElementById('report-back-img').src = this.backImage;
        document.getElementById('report-name').textContent = cardName;
        document.getElementById('report-set').textContent = cardSet;
        document.getElementById('report-rarity').textContent = cardRarity;
        document.getElementById('report-date').textContent = timestamp;
        document.getElementById('report-centering').textContent = combinedScores.centering;
        document.getElementById('report-surface').textContent = combinedScores.surface;
        document.getElementById('report-corners').textContent = combinedScores.corners;
        document.getElementById('report-edges').textContent = combinedScores.edges;
        document.getElementById('report-lighting').textContent = combinedScores.lighting;
        document.getElementById('report-final').textContent = grade.num;
        document.getElementById('report-recommendation').textContent = recommendation;
        
        report.classList.remove('hidden');
        report.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    saveResult() {
        const grade = document.querySelector('.grade-value')?.textContent || '0';
        const name = document.getElementById('card-name')?.textContent || 'Unknown';
        const c = document.createElement('canvas');
        const x = c.getContext('2d');
        c.width = 800; c.height = 600;
        x.fillStyle = '#1a1a2e'; x.fillRect(0, 0, c.width, c.height);
        x.fillStyle = '#fff'; x.font = 'bold 36px Arial'; x.textAlign = 'center';
        x.fillText(name.substring(0, 30), c.width/2, 80);
        x.font = 'bold 48px Arial';
        x.fillText(`Grade: ${grade}/10`, c.width/2, 150);
        const a = document.createElement('a');
        a.download = `grade-${Date.now()}.png`;
        a.href = c.toDataURL();
        a.click();
        alert('Tersimpan!');
    }
}

document.addEventListener('DOMContentLoaded', () => new CardGrader());
