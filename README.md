# DanilyLIS — Starter API

Minimal Express + MongoDB API to get you running on Synology NAS or any Node 18+ box.

## Quick start

1. **Upload & install deps**
   ```bash
   cd /volume1/node
   unzip danilylis.zip
   cd danilylis
   cp .env.example .env
   npm install
   ```

2. **Edit `.env`**
   ```env
   PORT=4000
   MONGO_URI=mongodb://192.168.86.118:27017/danilylis
   NODE_ENV=production
   ALLOWED_ORIGINS=http://localhost:5173,http://192.168.86.66:4000
   ```

3. **Run in dev (foreground)**
   ```bash
   npm run dev
   # visit: http://<NAS-IP>:4000/api/health
   ```

4. **Run with PM2 (background)**
   ```bash
   npm install -g pm2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # follow instructions to enable autostart
   ```

## Endpoints

- `GET /api/health` — sanity check.
- `POST /api/patients` — create `{ firstName, lastName, middleInitial?, dob?, mid? }`.
- `GET /api/patients?q=smith` — list/search.
- `GET /api/patients/:id` — fetch one.
- `PUT /api/patients/:id` — update.
- `DELETE /api/patients/:id` — delete.

## Notes

- The `MODULE_NOT_FOUND` error previously seen usually means missing packages or wrong paths.
  This scaffold uses `"type": "module"` and proper `import` paths.
- Your Mongo instance (per our notes) is reachable at `mongodb://192.168.86.118:27017` with no password.
  Adjust `MONGO_URI` if that changes.
