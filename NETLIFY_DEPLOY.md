# Deploy Attendance Hub to Netlify

## Quick deploy

```powershell
cd "C:\Users\J VIJAYA KUMARY\employee-work-hours-dashboard"
npm install
npx netlify login
npx netlify init
npx netlify deploy --prod
```

## Environment variables (Netlify UI → Site settings → Environment)

| Variable | Value |
|----------|--------|
| `ADMIN_PASSWORD` | Your secure admin password |
| `USE_BLOB_DB` | `1` (set automatically in functions) |

## URLs after deploy

- Employee kiosk: `https://YOUR-SITE.netlify.app`
- Admin: `https://YOUR-SITE.netlify.app/admin`

## Architecture on Netlify

- **Static UI:** `server/public` (employee + admin pages)
- **API:** Netlify Function `api` (Express via serverless-http)
- **Database:** Netlify Blobs (persistent attendance records)
- **Excel/CSV:** Generated on-demand per request

## Local Netlify preview

```powershell
npx netlify dev
```

Opens http://localhost:8888 with functions + static files.

## Local development (without Netlify)

```powershell
cd server
node src/index.js
```

Uses SQLite at `server/data/attendance.db`.