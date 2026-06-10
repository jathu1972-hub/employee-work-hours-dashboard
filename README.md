# Employee Work Hours Automation Dashboard

Track employee check-in/check-out, working hours, and auto-export Excel reports.

---

## How to Run (Windows)

### Option 1 — Double-click (easiest)

1. Open folder: `C:\Users\J VIJAYA KUMARY\employee-work-hours-dashboard`
2. Double-click **`START.bat`**
3. Browser opens automatically

### Option 2 — PowerShell

```powershell
cd "C:\Users\J VIJAYA KUMARY\employee-work-hours-dashboard\server"
node src/index.js
```

Then open in browser:

- Employee: http://localhost:3001
- Admin: http://localhost:3001/admin

**No `npm install` required.**

---

## Login Details

| Role | URL | Password |
|------|-----|----------|
| Employee | http://localhost:3001 | None (just enter name) |
| Admin / Owner | http://localhost:3001/admin | `admin123` |

Change admin password in `server/.env`:

```
ADMIN_PASSWORD=your_new_password
```

---

## Employee Usage

1. Open http://localhost:3001
2. Type your name (e.g. John)
3. Click **CHECK IN** when work starts
4. Click **CHECK OUT** when work ends
5. View today's hours on the status card

---

## Admin Usage

1. Open http://localhost:3001/admin
2. Enter password: `admin123`
3. View dashboard stats, live attendance, rankings
4. Search any employee by name
5. Download Excel / CSV / PDF reports

---

## Excel Reports (auto-updated)

Saved in: `server/exports/`

| File | Contents |
|------|----------|
| Daily Report.xlsx | Today's attendance |
| Monthly Report.xlsx | Current month |
| Employee Report.xlsx | All employees |
| Attendance Master.xlsx | Full history |

Data file: `server/data/attendance.json`

---

## Stop the Server

Press `Ctrl + C` in the terminal window.

---

## Project Folder

```
employee-work-hours-dashboard/
├── START.bat          ← Double-click to run
├── server/
│   ├── src/           ← Backend + API
│   ├── public/        ← Employee + Admin UI
│   ├── data/          ← attendance.json
│   ├── exports/       ← Excel files
│   └── .env           ← Admin password, port
└── README.md
```

---

## Requirements

- **Node.js** installed (v18 or newer)
- Check: `node --version`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "node is not recognized" | Install Node.js from https://nodejs.org |
| Port 3001 in use | Change `PORT=3002` in `server/.env` and use http://localhost:3002 |
| Page not loading | Run `START.bat` again and wait for "Server running" message |
| Wrong admin password | Edit `ADMIN_PASSWORD` in `server/.env` and restart server |