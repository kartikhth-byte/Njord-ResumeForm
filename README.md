# NJORD Ships - Maritime Crew Management System

A comprehensive crew recruitment and management platform built with React, Supabase, and modern web technologies.

## Features

- 📝 20-section application form with auto-save
- 👥 Multi-role team management (Master Recruiter, Recruiter, Coordinator, Viewer)
- 🔐 Role-based access control (RBAC)
- 🔍 AI-powered candidate search
- 📊 Application tracking and status management
- 📧 Email notifications (in development)
- 📅 Interview scheduling (in development)

## Tech Stack

- **Frontend:** React 18, Vite, TailwindCSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **AI/Search:** Supabase Vector (pgvector)
- **Deployment:** Vercel
- **Email:** Resend (planned)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
\`\`\`bash
git clone https://github.com/your-org/njord-ships.git
cd njord-ships
\`\`\`

2. Install dependencies
\`\`\`bash
npm install
\`\`\`

3. Set up environment variables
\`\`\`bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
\`\`\`

4. Run development server
\`\`\`bash
npm run dev
\`\`\`

5. Open http://localhost:5173

## Project Structure

\`\`\`
njord-ships/
├── src/
│   ├── components/          # React components
│   │   ├── auth/           # Authentication components
│   │   ├── form/           # Form sections & layout
│   │   └── layout/         # Layout components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities & configurations
│   ├── utils/              # Helper functions
│   └── App.jsx             # Main app component
├── supabase/
│   └── functions/          # Edge functions
├── public/                 # Static assets
└── package.json
\`\`\`

## Database Schema

Key tables:
- \`applications\` - Job applications
- \`application_data\` - JSONB application form data
- \`profiles\` - User profiles
- \`roles\` - RBAC roles
- \`permissions\` - RBAC permissions
- \`user_roles\` - User-role assignments

## Deployment

### Vercel

1. Push to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Deploy!

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit pull request

## License

Proprietary - NJORD Ships

## Support

Contact: support@njordships.com
\`\`\`

### **1D: Create vercel.json**

Configure Vercel build settings:
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "env": {
    "VITE_SUPABASE_URL": "@supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@supabase_anon_key"
  }
}
```

### **1E: Update package.json Scripts**

Make sure you have these scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0"
  }
}
```

---

## 📦 **STEP 2: INITIALIZE GIT REPOSITORY**

### **2A: Initialize Git (if not already)**
```bash
# In your project root
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: NJORD Ships crew management system

Features:
- 20-section application form
- RBAC system (4 roles)
- AI-powered search
- Team management
- Status workflow
- Overwrite system (no versioning)
"
```

### **2B: Create GitHub Repository**

**Option 1: Via GitHub Website**
1. Go to https://github.com/new
2. Repository name: `njord-ships` (or your choice)
3. Description: "Maritime crew recruitment and management platform"
4. Private repository (recommended for business)
5. **Don't** initialize with README (you already have one)
6. Click "Create repository"

**Option 2: Via GitHub CLI**
```bash
# Install GitHub CLI if needed: https://cli.github.com/

gh repo create njord-ships --private --source=. --remote=origin
```

### **2C: Push to GitHub**
```bash
# Add remote (if not using GitHub CLI)
git remote add origin https://github.com/YOUR-USERNAME/njord-ships.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

---

## 🌐 **STEP 3: DEPLOY TO VERCEL**

### **3A: Install Vercel CLI (Optional but Recommended)**
```bash
npm install -g vercel

# Login to Vercel
vercel login
```

### **3B: Deploy via Vercel Website** ⭐ RECOMMENDED

**1. Go to Vercel Dashboard**
- Visit https://vercel.com/new
- Sign in with GitHub

**2. Import Your Repository**
- Click "Add New" → "Project"
- Select your GitHub account
- Find `njord-ships` repository
- Click "Import"

**3. Configure Project**
- **Framework Preset:** Vite
- **Root Directory:** `./` (leave as is)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

**4. Add Environment Variables**
Click "Environment Variables" and add: