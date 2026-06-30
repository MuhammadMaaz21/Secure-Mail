# UOL Secure Email System — Windows Setup Guide

This guide walks you through running the project on a **Windows** PC from start
to finish, including the **AI threat-detection model**. Follow the steps in
order. No coding knowledge required.

> 📄 **Related documents in this package**
> - `AI_MODEL_GUIDE.md` — how the AI works and which models are used
> - `SAMPLE_TEST_EMAILS.md` — ready-made emails to test spam/phishing detection
> - `README.md` — short project overview
> - `FEATURES_DOCUMENTATION.md` — full feature list

---

## 0. What you are installing

| Software | Why | Where to get it |
|---|---|---|
| **Node.js** (v18 or v20 LTS) | Runs the backend + frontend | https://nodejs.org/ |
| **MongoDB Community Server** | The database that stores users & emails | https://www.mongodb.com/try/download/community |

The **AI models are already included** in this package (`backend/.models/`), so
you do **not** need to download them separately. Everything runs **locally** on
your PC — no internet needed after installation.

---

## 1. Install Node.js

1. Go to https://nodejs.org/ and download the **LTS** version (e.g. 20.x).
2. Run the installer. Keep clicking **Next** and accept the defaults.
   - ✅ Make sure **"Add to PATH"** is ticked (it is by default).
3. Verify: open **Command Prompt** (press `Win`, type `cmd`, Enter) and run:
   ```cmd
   node --version
   npm --version
   ```
   You should see version numbers (e.g. `v20.11.0`).

---

## 2. Install MongoDB

1. Download **MongoDB Community Server** (MSI) from
   https://www.mongodb.com/try/download/community
2. Run the installer:
   - Choose **Complete** setup.
   - ✅ Tick **"Install MongoDB as a Service"** (so it starts automatically).
   - ✅ (Optional) Tick **"Install MongoDB Compass"** — a visual tool to view the database.
3. Finish the install. MongoDB now runs in the background on
   `mongodb://localhost:27017` (this is exactly what the app expects).
4. (Optional) Verify it is running: press `Win`, type **Services**, open it, find
   **MongoDB** in the list and check the status is **Running**.

---

## 3. Extract the project

1. Copy the `UOL-Secure-Email-System.zip` to your Desktop.
2. Right-click → **Extract All…** → extract it.
3. You should now have a folder like:
   ```
   UOL Secure Email System\
   ├── backend\
   ├── frontend\
   ├── package.json
   ├── SETUP_GUIDE_WINDOWS.md   (this file)
   ├── AI_MODEL_GUIDE.md
   └── SAMPLE_TEST_EMAILS.md
   ```

---

## 4. Install project dependencies

Open **Command Prompt**, go into the project folder, and install everything.

```cmd
cd "%USERPROFILE%\Desktop\UOL Secure Email System"
npm run install:all
```

`install:all` installs the root, backend, and frontend packages one after
another. This downloads `node_modules` and may take a few minutes.

> If `npm run install:all` errors, install each part manually instead:
> ```cmd
> npm install
> cd backend && npm install && cd ..
> cd frontend && npm install && cd ..
> ```

---

## 5. (Optional) Confirm the AI model is ready

The AI models are already bundled in `backend\.models\`. To confirm the AI
engine works, run:

```cmd
cd backend
npm run test:ai
cd ..
```

You should see **`Score: 7/7 correct.`** and **`Detection engine: REAL AI MODEL ✅`**.

> If you ever see "heuristic fallback" instead, the model files are missing —
> download them once with `npm run setup:ai` (needs internet). See
> `AI_MODEL_GUIDE.md` section 6.

---

## 6. Start the application

Make sure MongoDB is running (Step 2), then from the **project root** run:

```cmd
npm run dev
```

This starts the backend and frontend together. Wait until you see:

```
[0] Server is running on http://localhost:5001
[0] MongoDB connected successfully
[1] Server started at http://localhost:5173
```

✅ Both servers are now running.

---

## 7. Open the app

Open your browser and go to:

### 👉 http://localhost:5173

- Register a user account, then register a second one (to send emails between them).
- Compose and send emails. The AI checks every email automatically.
- Use the samples in **`SAMPLE_TEST_EMAILS.md`** to see spam/phishing detection
  in action — harmful emails land in the **Spam** folder with a warning; safe
  emails land in the **Inbox**.

---

## 8. Stopping the app

- In the Command Prompt window running `npm run dev`, press **`Ctrl + C`**.
- MongoDB keeps running as a Windows service in the background (that is normal).

---

## 9. Ports used

| Service | Address |
|---|---|
| Frontend (open this) | http://localhost:5173 |
| Backend API | http://localhost:5001 |
| MongoDB | localhost:27017 |

You do **not** need to create any `.env` file for the frontend — it connects to
`http://localhost:5001/api` by default. The backend's `.env` is already included.

---

## 10. Troubleshooting

**"node is not recognized" / "npm is not recognized"**
- Node.js was not added to PATH. Reinstall Node.js and ensure "Add to PATH" is ticked, then reopen Command Prompt.

**"MongoDB connection error" / backend keeps closing**
- MongoDB is not running. Open **Services**, find **MongoDB**, right-click → **Start**.

**Frontend error mentioning `@rollup/rollup-win32-x64-msvc` or `esbuild`**
- This is a known npm bug with optional packages. Fix:
  ```cmd
  cd frontend
  rmdir /s /q node_modules
  del package-lock.json
  npm install
  cd ..
  ```

**`npm run test:ai` says "heuristic fallback"**
- The AI model files are missing. From the `backend` folder run `npm run setup:ai`
  (requires internet, one-time ~450 MB download).

**Port already in use (5001 or 5173)**
- Another program is using the port. Close it, or restart the PC, then run `npm run dev` again.

---

## Quick reference

```cmd
:: one-time setup
npm run install:all

:: run the whole app (backend + frontend)
npm run dev

:: open in browser
http://localhost:5173

:: test the AI from the backend folder
cd backend && npm run test:ai

:: (only if model files are missing) re-download AI models
cd backend && npm run setup:ai
```
