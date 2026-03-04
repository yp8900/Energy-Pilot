# Energy-Pilot - Industrial Energy Management System

## 🚀 Quick Start for Demo

### Start the Application

**Windows (PowerShell):**
```powershell
.\start-demo.ps1
```

**Alternative (Any Platform):**
```bash
npm run dev
```

The application will start on **http://localhost:5000**

---

## 🔐 Demo Login

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Operator | `operator` | `operator123` |

---

## 📊 Demo Features

### 5 Demo Energy Meters
- **EM-MAIN-INCOMER** - Main Building Supply (550 kW)
- **EM-HVAC-SYSTEM** - HVAC Central Plant (200 kW)
- **EM-LIGHTING-CIRCUIT** - Building Lighting (70 kW)
- **EM-DATA-CENTER** - IT Infrastructure (195 kW)
- **EM-PRODUCTION-LINE** - Manufacturing (365 kW)

### Key Capabilities
- ✅ Real-time monitoring (2-second updates)
- ✅ Advanced analytics and trends
- ✅ AI-powered predictive analysis
- ✅ Custom analytics with user-defined formulas
- ✅ Alarm management with configurable thresholds
- ✅ BACnet IP & Modbus RTU/TCP support
- ✅ BMS integration (Schneider, Siemens)
- ✅ User management with role-based access

---

## 📚 Demo Documentation

- **DEMO-SUMMARY.md** - Complete feature overview
- **DEMO-CHEAT-SHEET.md** - Quick reference guide
- **DEMO-PRESENTATION-OUTLINE.md** - Presentation slides outline

---

## 🛠️ Other Commands

```bash
# Install dependencies
npm install

# Start backend only
npm run dev:backend

# Start frontend only (requires backend running)
npm run dev:frontend

# Build for production
npm run build

# Start production server
npm start

# Database migration (if using PostgreSQL)
npm run db:push
```

---

## ⚙️ Configuration

### Mock Mode (No Database - Default)
The application runs with in-memory demo data by default. Perfect for demonstrations!

**To enable:** Comment out `DATABASE_URL` in `.env`:
```env
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/energy_pilot
```

### Database Mode (PostgreSQL)
**To enable:** Uncomment and configure `DATABASE_URL` in `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/energy_pilot
```

Then run:
```bash
npm run db:push        # Create tables
npm run add-demo-meters  # Load demo data
```

---

## 🌐 Ports

| Service | Port | URL |
|---------|------|-----|
| Full Application | 5000 | http://localhost:5000 |
| Frontend (dev mode) | 5173 | http://localhost:5173 |
| Backend API | 5000 | http://localhost:5000/api |

---

## 🆘 Troubleshooting

### Port Already in Use
```powershell
# Windows - Kill process on port 5000
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
```

### Dependencies Issues
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Login Not Working
- Check that the application started successfully
- Verify you're using the correct credentials
- Clear browser cache/cookies
- Try incognito/private mode

### No Meters Showing
- Ensure mock mode is enabled (DATABASE_URL commented in .env)
- Restart the application
- Check server logs for errors

---

## 📞 Support

For issues or questions:
1. Check the documentation in `/docs` folder
2. Review server logs in console output
3. Check `server-log.txt` for detailed logs

---

## 🎯 Demo Tips

1. **Start with Dashboard** - Show real-time monitoring
2. **Navigate to Analytics** - Demonstrate historical trends
3. **Show Predictive Analysis** - Highlight AI forecasting
4. **Open Alarms** - Display alert management
5. **Visit Custom Analytics** - Show extensibility

**Key Points to Emphasize:**
- Real-time updates (2 seconds)
- Universal protocol support
- AI-powered insights
- Modern, intuitive interface
- Production-ready architecture

---

**Good luck with your demo! 🚀**
