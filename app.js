// Pokemon Card AI Grader - REAL Implementation
class CardGrader {
    constructor() {
        this.video = document.getElementById('camera-feed');
        this.canvas = document.getElementById('camera-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.stream = null;
        this.cameraReady = false;
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        try { await this.setupCamera(); } catch (e) {}
    }
    
    async setupCamera() {
        if (!navigator.mediaDevices) return;
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        } catch {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (this.stream) {
            this.video.srcObject = this.stream;
            await new Promise(r => this.video.onloadedmetadata = () => { this.cameraReady = true; r(); });
        }
    }
    
    setupEventListeners() {
        document.getElementById('capture-btn')?.addEventListener('click', (e) => { e.preventDefault(); this.captureAndGrade(); });
        document.getElementById('gallery-btn')?.addEventListener('click', () => document.getElementById('file-input')?.click());
        document.getElementById('file-input')?.addEventListener('change', (e) => { if (e.target.files?.[0]) this.handleFile(e.target.files[0]); });
        document.getElementById('close-analysis')?.addEventListener('click', () => document.getElementById('analysis-panel')?.classList.add('hidden'));
        document.getElementById('retry-btn')?.addEventListener('click', () => document.getElementById('analysis-panel')?.classList.add('hidden'));
        document.getElementById('save-btn')?.addEventListener('click', () => this.saveResult());
        document.getElementById('edit-card-btn')?.addEventListener('click', () => this.showManualEdit());
    }
    
    captureAndGrade() {
        if (!this.cameraReady) { document.getElementById('file-input')?.click(); return; }
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        this.analyzeImage(this.canvas.toDataURL('image/jpeg'));
    }
    
    handleFile(file) {
        if (!file.type.startsWith('image/')) return alert('Pilih file gambar');
        const reader = new FileReader();
        reader.onload = (e) => this.analyzeImage(e.target.result);
        reader.readAsDataURL(file);
    }
    
    async analyzeImage(src) {
        const loading = document.getElementById('loading');
        loading?.classList.remove('hidden');
        
        const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
        document.getElementById('analyzed-image').src = src;
        document.getElementById('analysis-panel')?.classList.remove('hidden');
        document.getElementById('card-info')?.classList.remove('hidden');
        
        const scores = this.analyze(img);
        this.displayScores(scores);
        
        const grade = this.calcGrade(scores);
        document.querySelector('.grade-value').textContent = grade.num;
        document.getElementById('grade-desc').textContent = `${grade.label} - ${grade.desc}`;
        
        document.getElementById('card-name').textContent = 'Unknown';
        document.getElementById('card-set').textContent = 'Click Edit to add info';
        document.getElementById('card-rarity').textContent = '-';
        
        loading?.classList.add('hidden');
    }
    
    analyze(img) {
        const c = document.createElement('canvas');
        const x = c.getContext('2d');
        c.width = 400;
        c.height = Math.floor(400 * img.height / img.width);
        x.drawImage(img, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        
        return {
            centering: this.checkCentering(d, c.width, c.height),
            surface: this.checkSurface(d, c.width, c.height),
            corners: this.checkCorners(d, c.width, c.height),
            edges: this.checkEdges(d, c.width, c.height),
            lighting: this.checkLighting(d)
        };
    }
    
    checkCentering(d, w, h) {
        const b = Math.floor(w * 0.05);
        let ls = 0, rs = 0, lc = 0, rc = 0;
        for (let y = 0; y < h; y += 10) {
            for (let x = 0; x < b; x++) { const i = (y * w + x) * 4; ls += (d[i]+d[i+1]+d[i+2])/3; lc++; }
            for (let x = w - b; x < w; x++) { const i = (y * w + x) * 4; rs += (d[i]+d[i+1]+d[i+2])/3; rc++; }
        }
        const diff = Math.abs(ls/lc - rs/rc) / 255;
        return Math.round(Math.max(0, Math.min(10, 10 - diff * 5)));
    }
    
    checkSurface(d, w, h) {
        let v = 0, m = 0, s = [];
        for (let y = h*0.2; y < h*0.8; y += 5) {
            for (let x = w*0.2; x < w*0.8; x += 5) {
                const i = (Math.floor(y) * w + Math.floor(x)) * 4;
                const g = (d[i]+d[i+1]+d[i+2])/3;
                s.push(g); m += g;
            }
        }
        m /= s.length;
        for (const val of s) v += Math.pow(val - m, 2);
        v = Math.sqrt(v/s.length) / 255;
        let score = 10;
        if (v > 0.15) score -= (v - 0.15) * 20;
        return Math.round(Math.max(0, Math.min(10, score)));
    }
    
    checkCorners(d, w, h) {
        const cs = Math.floor(Math.min(w, h) * 0.15);
        const corners = [[0,0], [w-cs,0], [0,h-cs], [w-cs,h-cs]];
        let total = 0;
        for (const [cx, cy] of corners) {
            let dmg = 0, cnt = 0;
            for (let y = cy; y < cy + cs; y += 2) {
                for (let x = cx; x < cx + cs; x += 2) {
                    const i = (y * w + x) * 4;
                    if ((d[i]+d[i+1]+d[i+2])/3 > 240) dmg++;
                    cnt++;
                }
            }
            total += Math.max(0, 10 - (dmg/cnt) * 20);
        }
        return Math.round(total / 4);
    }
    
    checkEdges(d, w, h) {
        const ew = Math.floor(w * 0.08);
        let dmg = 0, cnt = 0;
        const edges = [[ew, w-ew, 0, ew], [ew, w-ew, h-ew, h], [0, ew, ew, h-ew], [w-ew, w, ew, h-ew]];
        for (const [x1, x2, y1, y2] of edges) {
            for (let y = y1; y < y2; y += 3) {
                for (let x = x1; x < x2; x += 3) {
                    const i = (Math.floor(y) * w + Math.floor(x)) * 4;
                    if ((d[i]+d[i+1]+d[i+2])/3 > 230) dmg++;
                    cnt++;
                }
            }
        }
        return Math.round(Math.max(0, 10 - (dmg/cnt) * 15));
    }
    
    checkLighting(d) {
        let t = 0, dk = 0, br = 0;
        const step = Math.floor(d.length / 4 / 10000) || 1;
        for (let i = 0; i < d.length; i += step * 4) {
            const b = (d[i]+d[i+1]+d[i+2])/3;
            t += b;
            if (b < 30) dk++;
            if (b > 240) br++;
        }
        const avg = t / (d.length / 4 / step);
        let s = 10;
        if (avg < 80) s -= (80 - avg) / 10;
        if (avg > 220) s -= (avg - 220) / 10;
        return Math.round(Math.max(0, Math.min(10, s)));
    }
    
    calcGrade(s) {
        const sum = s.centering*0.25 + s.surface*0.3 + s.corners*0.25 + s.edges*0.15 + s.lighting*0.05;
        const g = sum >= 9.5 ? ['Gem Mint', 'Kondisi sempurna!'] : sum >= 9 ? ['Mint', 'Sangat baik'] : sum >= 8 ? ['NM-Mint', 'Near Mint'] : sum >= 7 ? ['Near Mint', 'Baik'] : sum >= 6 ? ['Excellent', 'Cukup baik'] : sum >= 5 ? ['Good', 'Cukup'] : ['Poor', 'Perlu perhatian'];
        return { num: sum.toFixed(1), label: g[0], desc: g[1] };
    }
    
    displayScores(s) {
        for (const [k, v] of Object.entries(s)) {
            const bar = document.getElementById(`score-${k}`);
            const val = document.getElementById(`value-${k}`);
            if (bar) bar.style.width = `${v * 10}%`;
            if (val) val.textContent = v;
        }
    }
    
    showManualEdit() {
        const info = document.getElementById('card-info');
        document.getElementById('manual-edit')?.remove();
        
        const form = document.createElement('div');
        form.id = 'manual-edit';
        form.innerHTML = `
            <div style="margin-top:15px;padding:15px;background:rgba(255,255,255,0.1);border-radius:8px;">
                <h4>✏️ Edit Info</h4>
                <input id="en" value="${document.getElementById('card-name').textContent}" style="width:100%;padding:8px;margin:5px 0;border-radius:4px;border:none;" placeholder="Nama Kartu">
                <input id="es" value="${document.getElementById('card-set').textContent}" style="width:100%;padding:8px;margin:5px 0;border-radius:4px;border:none;" placeholder="Set">
                <input id="er" value="${document.getElementById('card-rarity').textContent}" style="width:100%;padding:8px;margin:5px 0;border-radius:4px;border:none;" placeholder="Rarity">
                <button id="sv" style="background:#00d9ff;color:#000;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;margin-top:10px;font-weight:bold;">💾 Simpan</button>
            </div>`;
        info.appendChild(form);
        
        document.getElementById('sv').addEventListener('click', () => {
            document.getElementById('card-name').textContent = document.getElementById('en').value || 'Unknown';
            document.getElementById('card-set').textContent = document.getElementById('es').value || 'Unknown';
            document.getElementById('card-rarity').textContent = document.getElementById('er').value || 'Unknown';
            form.remove();
        });
    }
    
    saveResult() {
        const grade = document.querySelector('.grade-value')?.textContent || '0';
        const c = document.createElement('canvas');
        const x = c.getContext('2d');
        c.width = 800; c.height = 600;
        x.fillStyle = '#1a1a2e'; x.fillRect(0, 0, c.width, c.height);
        x.fillStyle = '#fff'; x.font = 'bold 48px Arial'; x.textAlign = 'center';
        x.fillText(`Grade: ${grade}/10`, c.width/2, 150);
        const a = document.createElement('a');
        a.download = `grade-${Date.now()}.png`;
        a.href = c.toDataURL();
        a.click();
        alert('Tersimpan!');
    }
}

document.addEventListener('DOMContentLoaded', () => new CardGrader());
