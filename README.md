# StaySwipe

StaySwipe is an early-stage hotel discovery project for Mumbai and Navi Mumbai. The initial foundation includes a responsive landing page and a small Express API. Hotel listings, swipe interactions, group sessions, matching, and authentication are not implemented yet; the landing page is a preview, not a live hotel or booking service.

## Requirements

- Node.js 20.19+ or 22.12+ and npm (Node 24 also works)
- VS Code (recommended)
- MongoDB is **not** required for this phase. The server reads a MongoDB connection string for future use, but does not connect to it yet.

## Setup on Windows PowerShell

Open the project folder in VS Code. Use two separate integrated terminals so the client and API can run at the same time.

### 1. Set up and start the API

In the first terminal:

```powershell
cd "D:\My Code\stayswipe\server"
Copy-Item .env.example .env
npm install
npm run dev
```

`Copy-Item` creates your local server environment file from the example. It is ignored by Git; change its values only if your local ports or origins differ. `npm run dev` starts the API and automatically restarts it when server files change.

### 2. Set up and start the website

In a second terminal:

```powershell
cd "D:\My Code\stayswipe\client"
Copy-Item .env.example .env
npm install
npm run dev
```

`npm run dev` starts the Vite development server. Open the local URL it prints (normally [http://localhost:5173](http://localhost:5173)) in your browser.

The client API base URL is `VITE_API_BASE_URL` in `client/.env`. This is a public frontend setting, so never put secrets or private keys in a `VITE_` variable. The default is `http://localhost:5000/api`.

## Check the API

With the API terminal still running, open [http://localhost:5000/api/health](http://localhost:5000/api/health). A healthy response looks like:

```json
{
  "status": "ok",
  "message": "StaySwipe API is running",
  "timestamp": "2026-10-27T10:54:14.994Z"
}
```

The timestamp will show the time of your request.

## Production builds

Build the client from its own directory:

```powershell
cd "D:\My Code\stayswipe\client"
npm run build
npm run preview
```

Run the API from its directory with:

```powershell
cd "D:\My Code\stayswipe\server"
npm start
```

The client build is written to `client/dist/`. The API listens on `PORT` (default `5000`), allows the origin in `CLIENT_ORIGIN` (default `http://localhost:5173`), and validates `MONGODB_URI` at startup. No MongoDB connection is made yet.

## Project layout

```text
client/   React, Vite, Tailwind CSS, routing, and the browser API client
server/   Express API, environment validation, middleware, and future MongoDB setup
```
