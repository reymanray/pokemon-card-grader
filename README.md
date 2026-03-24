# Pokemon Card AI Grader

Aplikasi grading kartu Pokemon gratis berbasis AI. Bisa dipakai langsung di mobile browser!

## 🚀 Deploy ke Vercel

### Cara 1: Via Vercel CLI (Cepat)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
cd pokemon-grader
vercel login

# Deploy
vercel --prod
```

### Cara 2: Via GitHub + Vercel Dashboard

1. **Push ke GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/username/pokemon-card-grader.git
   git push -u origin main
   ```

2. **Connect ke Vercel:**
   - Buka [vercel.com](https://vercel.com)
   - Login dengan GitHub
   - Click "New Project"
   - Import repo `pokemon-card-grader`
   - Click "Deploy"

3. **Done!** Dapat URL `https://pokemon-card-grader.vercel.app`

## 📱 Fitur

- 📷 Kamera real-time
- 🤖 AI grading otomatis
- 💯 Skor detail (Centering, Surface, Corners, Edges, Lighting)
- 🖼️ Upload dari galeri
- 💾 Save hasil

## 🔧 Tech Stack

- Vanilla JavaScript
- TensorFlow.js (COCO-SSD)
- Canvas API
- CSS Grid/Flexbox

## 📝 Catatan

- Akses kamera butuh HTTPS (Vercel otomatis HTTPS)
- Tested di Chrome Mobile & Safari iOS

## 📄 License

Free to use!
