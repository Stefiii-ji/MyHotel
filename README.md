# StaySwipe

StaySwipe is an early-stage hotel discovery and group trip-planning project for Mumbai and Navi Mumbai. Hotel discovery reads imported accommodation records from OpenStreetMap (OSM) and MongoDB. OSM coverage and tags vary; ratings and customer reviews are not supplied as verified data. Optional provider offers may be unavailable when credentials or a verified inventory mapping are missing. StaySwipe is not a booking service. Group creation, invitation-based guest membership, and mutual hotel matching are available; permanent accounts are not implemented.

## Requirements

- Node.js 20.19+ or 22.12+ and npm (Node 24 also works)
- VS Code (recommended)
- A MongoDB instance is required for hotel listing and import routes.

## Setup on Windows PowerShell

Open the project folder in VS Code. Use two separate integrated terminals so the client and API can run at the same time.

### 1. Set up and start the API

In the first terminal:

```powershell
cd "D:\My Code\stayswipe\server"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run dev
```

The conditional copy creates `server/.env` only when it does not already exist, so it will not overwrite local credentials. The example contains placeholders only. Set `MONGODB_URI` privately in `server/.env`; never add it to a client/Vite environment file. The server loads that file before validating settings, then connects Mongoose using `process.env.MONGODB_URI`. Connection errors give setup guidance without logging the URI or raw driver error. `npm run dev` starts the API and automatically restarts it when server files change. The health endpoint remains available if MongoDB is offline, but hotel routes return HTTP 503.

For Atlas, replace the placeholder URI with the connection string from your Atlas cluster and the database user's credentials. URL-encode special characters in the password as required by MongoDB connection strings. In Atlas, confirm the database user has access to the intended database and that **Network Access** permits the current client IP. Do not use a broad network allowlist for convenience. Restart the server after changing `.env`.

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

## Hotel discovery

- Open `/discover` to browse records imported from OpenStreetMap. Filter by city, locality, and accommodation type. Drag cards or use the accessible Like/Reject buttons; Undo and `/favorites` keep decisions in React state for this browser session only.
- An empty result means no matching records have been imported (or OSM coverage is incomplete). To populate a local development database with clearly marked fictional examples, follow the seed instructions below.
- OSM does not provide verified hotel ratings or customer reviews. Offer prices are requested separately from a configured provider; they are displayed as unavailable when no provider offer or inventory mapping exists. Images are only stored when their source can be verified; the current importer deliberately leaves images empty.

### Seed development hotel examples

For local UI and API development when live OSM imports are unavailable, seed 16 fictional examples across Mumbai and Navi Mumbai. They use the dedicated `stayswipe_sample` source, stable `demo-hotel-*` IDs, and an `isSampleData` marker; they do not overwrite or delete OSM/provider records. Cards identify them as development samples. No sample prices, ratings, availability, photos, or booking links are created.

With `server/.env` configured for a local development database and `NODE_ENV=development`, run:

```powershell
cd "D:\My Code\stayswipe\server"
npm run seed:development-hotels
```

The command is idempotent and only inserts missing sample IDs. It refuses to run unless the configured environment is `development`. Verify the records with:

```powershell
Invoke-RestMethod "http://localhost:5000/api/hotels?city=Mumbai&page=1&limit=20"
Invoke-RestMethod "http://localhost:5000/api/hotels?city=Navi%20Mumbai&page=1&limit=20"
```

Every sample response item has `isSampleData: true` and `source: "stayswipe_sample"`. Sample entries are fictional UI fixtures, not real businesses or offers.

## OpenStreetMap attribution and limitations

Hotel/accommodation records are derived from the OpenStreetMap community database and attributed as **© OpenStreetMap contributors**. The data is available under the [Open Database License (ODbL)](https://www.openstreetmap.org/copyright). Review the ODbL attribution and share-alike requirements before redistributing imported database extracts.

The importer queries the public Overpass API only when an administrator explicitly requests a refresh. It is not called during browsing or swiping. The current refresh bounds cover Mumbai and Navi Mumbai; they do not imply complete coverage. OSM entries can be missing, incomplete, outdated, or incorrectly tagged. Location records are not endorsements or confirmation that an accommodation is open, bookable, or suitable.

### Configure and run a restricted import

Set `OVERPASS_URL` to an HTTPS Overpass endpoint in `server/.env`; this is tried first, followed by the built-in public mirrors. Each distinct mirror receives at most one POST request with a 15-second timeout. Configure a private import token (at least 32 characters) in that file as `HOTEL_IMPORT_TOKEN`. Generate a random value with Node.js in PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the generated token private; do not put it in client settings or commit it. The refresh route is disabled until configured, requires the token in the `x-import-token` request header, accepts only the predefined `Mumbai` or `Navi Mumbai` bounds, and is rate-limited to one request per minute per backend process. Restart the server after changing `.env`.

With the API running, use the repository PowerShell helper. It prompts for the token as a secure input and does not store it in the script or print it:

```powershell
cd "D:\My Code\stayswipe"
.\scripts\import-hotels.ps1 -Area Mumbai
```

To import the other supported area, run this separately; wait at least one minute between requests because the endpoint is rate-limited:

```powershell
.\scripts\import-hotels.ps1 -Area "Navi Mumbai"
```

For a non-local API, pass its API base URL explicitly, for example
`.\scripts\import-hotels.ps1 -Area Mumbai -ApiBaseUrl "https://<backend-host>/api"`.
The helper reports HTTP authentication failures, rate limits, timeouts, and
other API errors without displaying the token. Never add the token to command
arguments, browser code, or a Vite environment variable.

The actual route is `POST /api/admin/hotels/refresh`, with a JSON body such as
`{"area":"Mumbai"}` and the `x-import-token` header. The API checks database
readiness before contacting Overpass. Its successful response includes the
selected area, OSM attribution, and import counts: `processed` is the number of
upstream elements, `inserted` is newly created MongoDB records, `updated` is
records whose stored fields changed, `unchanged` is existing matched records
that did not change, `skipped` includes invalid elements and duplicate source
IDs within that response, and `failed` is zero for a successful bulk write.
`imported` remains the number of unique valid OSM records sent to MongoDB for
upsert. If MongoDB rejects the bulk write, the API reports an error instead of
presenting a successful result.

To confirm records are persisted, check the `inserted`/`updated` counts, then
query the public API:

```powershell
Invoke-RestMethod "http://localhost:5000/api/hotels?city=Mumbai&page=1&limit=5"
Invoke-RestMethod "http://localhost:5000/api/hotels?city=Navi%20Mumbai&page=1&limit=5"
```

The same records can be inspected in MongoDB Compass/Atlas using a filter such
as `{"source":"openstreetmap","city":"Mumbai"}` (replace the city for the other
area). The public API returns paginated `items` and OpenStreetMap attribution;
the existing React discovery page reads this API and supports city filters.

Imported records are normalized and upserted by the unique `{source, sourceId}`
OSM identity; duplicate elements are removed before the write. Imports do not
delete other providers' records or remove existing records when an upstream
result is empty. On HTTP 406, 429, 5xx, network errors, or timeouts, the importer
tries each remaining distinct mirror once. Other HTTP errors and malformed JSON
fail safely without further mirror requests. Safe server diagnostics include
only the Overpass hostname, elapsed time, and error category, including which
mirror succeeded. Public Overpass instances have shared capacity and may reject
or delay requests. Imports are manual and rate-limited; MongoDB stores the
retrieved inventory so frontend browsing does not repeatedly call Overpass.
Refresh only when needed and use public endpoints responsibly.

### Hotel API

- `GET /api/hotels?city=Mumbai&region=Maharashtra&locality=Bandra&type=hotel&page=1&limit=20` lists imported records. City, region, locality, and type filters are optional; `page` starts at 1 and `limit` is capped at 100.
- `GET /api/hotels/:id` retrieves one MongoDB hotel record.
- `GET /api/hotels/:id/offers?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=2&currency=INR` checks optional provider offers. Dates must be real calendar dates with check-out after check-in; guests (adults in one room) are limited to 1–8.
- Responses include OSM attribution and pagination metadata.
- `POST /api/admin/hotels/refresh` is the restricted manual import described above.

### Optional hotel offers (Phase 6)

Offer lookups are disabled by default (`HOTEL_OFFERS_PROVIDER=none`). To enable Amadeus, set `HOTEL_OFFERS_PROVIDER=amadeus`, choose `HOTEL_OFFERS_MODE=test` or `production`, and configure `AMADEUS_CLIENT_ID` and `AMADEUS_CLIENT_SECRET` only in `server/.env` or the server's secret manager. Test mode is fixed to Amadeus's test host and is never represented as live inventory. Production mode is fixed to Amadeus's production host and is accepted only with `NODE_ENV=production`. Missing credentials produce an explicit unavailable result without disrupting discovery, swiping, or matching.

The existing hotel IDs are MongoDB ObjectIds, not Amadeus inventory IDs. The offer adapter uses the optional `providerHotelIds.amadeus` mapping only when a reliable provider mapping has been supplied; the OSM importer does not guess or populate that mapping. No offers are requested while browsing cards. A user can explicitly check dates and guest count in a hotel's details. Only confirmed provider amounts and supplied terms are displayed; booking links appear only when the provider supplies a valid HTTPS URL. Confirmed results are cached for `HOTEL_OFFERS_CACHE_TTL_MS` (default 5 minutes); failed and unavailable results are not cached. `HOTEL_OFFERS_TIMEOUT_MS` controls the upstream timeout.

The Amadeus adapter follows its official [Hotel Search OpenAPI specification](https://github.com/amadeus4dev/amadeus-open-api-specification/blob/main/spec/yaml/HotelSearch_v3_swagger_specification.yaml) and uses OAuth client credentials on the server. No Amadeus credentials or provider hotel mappings are included in this repository, so live prices require authorized credentials and reliable inventory mappings. Expedia Rapid is not integrated; its [official setup requirements](https://developers.expediagroup.com/rapid/setup) require partner access and approved credentials. Offers are informational only: they do not create reservations, guarantee availability, or initiate payment.

## Groups and invitations (Phase 4)

Open **Plan a group** or visit `/groups/new` to set the group name, guest display name, destination cities/localities, optional dates, and maximum nightly budget. Verified ratings are not currently available, so no rating preference is applied. A creator becomes the first member automatically. The lobby shows each member's joined/ready state, trip details, and creator-only invitation controls. Group creation/joining does not require a permanent account.

The creator receives a shareable `/join/<token>` link. Use **Copy link** or the Web Share action in the lobby. The token is generated from 256 random bits; only its SHA-256 hash is stored in MongoDB. Joining creates a random guest identity and a separate random membership credential. Only the credential hash is stored; the credential itself is returned only as a group-scoped HTTP-only cookie and is never placed in localStorage or an API response. Cookies are `Secure` in production and use `SameSite=None` for production cross-origin deployment; local development uses `SameSite=Lax`. Production must use HTTPS and set `NODE_ENV=production`.

Group links expire after 7 days, group/member sessions expire after 30 days, and a group is limited to 12 members. The creator can rotate a link (immediately invalidating its previous token), revoke future joins, or remove a member (immediately invalidating that member's cookie on subsequent requests). Join attempts are limited to 20 per IP per 15 minutes; group creation is limited to 5 per IP per hour. These limits are in-memory and per server process, so a multi-instance deployment should replace them with a shared rate-limit store.

**Shared-link limitations:** anyone who obtains an active invitation URL can join until it expires, is revoked, or the group is full. Links can be copied into chat history, browser history, link previews, or other systems; share them privately and rotate them if exposed. Revoking a link stops new joins but does not remove existing members. Membership cookies are device/browser-specific; clearing them loses access, and there is no account-based recovery. Group membership controls access to the private lobby, but it does not verify a person's real-world identity. Do not share a device that has an active membership cookie.

### Group swiping and mutual matches (Phase 5)

Open **Swipe stays** from a group lobby to review hotels whose city matches the group's selected cities and, when selected, whose locality matches one of the group's selected localities. This is the eligible hotel pool for vote completion and matches; the current hotel records do not contain verified prices, so the budget is displayed as trip context and is not used to filter the pool. Your choices are stored per guest member and hotel. Repeating a choice updates that member's existing vote, and previously reviewed hotels are restored as reviewed when you return.

A mutual match is computed on the server and appears only when every current, non-removed group member has explicitly liked the hotel. A rejection or missing vote means there is no match. Progress exposes only per-member completion status (whether all eligible hotels have been reviewed), not individual choices. Removing a member revokes their credential and retains a removal timestamp; their historical swipes remain stored but do not count toward current completion or matches. Group swipes, progress, and matches require the member's HTTP-only cookie.

Group API routes:

- `POST /api/groups` creates a group and sets the creator's membership cookie; it returns the new lobby details and shareable invitation URL.
- `POST /api/groups/join` joins using `{ "token": "...", "displayName": "..." }`.
- `GET /api/groups/:groupId` and `PATCH /api/groups/:groupId/ready` require the device's membership cookie.
- `POST /api/groups/:groupId/swipes` saves or updates the authenticated member's `{ "hotelId": "...", "action": "like" }` decision. `GET /api/groups/:groupId/swipes/me` returns only that member's decisions.
- `GET /api/groups/:groupId/progress` returns eligible hotel/member completion counts without revealing votes; `GET /api/groups/:groupId/matches` returns backend-calculated unanimous likes with hotel detail links.
- `POST /api/groups/:groupId/invitation` rotates the invitation; `DELETE` on that route revokes it.
- `DELETE /api/groups/:groupId/members/:memberId` removes a member. Invitation/member management is creator-only.

All group request bodies and identifiers are validated; group IDs and public member IDs are locators, not authorization secrets. Private routes require the per-group cookie credential. CORS is limited to `CLIENT_ORIGIN`, production uses HTTPS-only origins, and mutating requests are checked against the configured origin.

Run backend tests from the server directory:

```powershell
npm test
```

## Check the API

With the API terminal still running, open [http://localhost:5000/api/health](http://localhost:5000/api/health). A healthy response looks like:

```json
{
  "status": "ok",
  "database": "ready",
  "message": "StaySwipe API is running",
  "timestamp": "2026-10-27T10:54:14.994Z"
}
```

The timestamp will show the time of your request. `status: "ok"` reports API
liveness; `database: "unavailable"` means MongoDB is not ready, so
database-backed requests may return 503 even while the API process is alive.

## Production builds

Build the client from its own directory:

```powershell
cd "D:\My Code\stayswipe\client"
npm test
npm run build
npm run preview
```

Run the API from its directory with:

```powershell
cd "D:\My Code\stayswipe\server"
npm start
```

The client build is written to `client/dist/`. The API listens on `PORT` (default `5000`), allows the origin in `CLIENT_ORIGIN` (default `http://localhost:5173`), and connects to `MONGODB_URI` for hotel routes. The optional `HOTEL_IMPORT_TOKEN` enables restricted imports.

## Setup and deployment preparation

### Prerequisites and local setup

- Node.js 20 or newer and npm.
- A MongoDB instance, such as a MongoDB Atlas cluster.
- Provider access is optional; the application remains usable without live hotel
  offers.

Install the locked dependencies from the repository root:

```powershell
cd "D:\My Code\stayswipe\server"
npm ci
cd "D:\My Code\stayswipe\client"
npm ci
```

Copy `server/.env.example` to `server/.env` and replace the MongoDB placeholder
with a valid connection string. The `.env` file is ignored by Git; keep it
private. For Atlas, create a database user with only the permissions the app
needs, configure the cluster network access list for the backend's actual
outbound IPs where available, and use TLS. Do not commit the connection string
or widen network access unnecessarily.

### Environment variables

Configure these on the backend only. Use placeholders in deployment settings
until real credentials are supplied directly to the host's secret manager.

| Variable | Purpose | Default / example |
|---|---|---|
| `PORT` | HTTP port supplied by the backend host | `5000` locally |
| `NODE_ENV` | Runtime environment; production requires HTTPS frontend origin | `development` |
| `CLIENT_ORIGIN` | Single exact browser origin permitted by CORS and mutation checks | `http://localhost:5173` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority` |
| `OVERPASS_URL` | HTTPS Overpass endpoint used only by the restricted importer | `https://overpass-api.de/api/interpreter` |
| `HOTEL_IMPORT_TOKEN` | Optional random token for protected inventory imports; use at least 32 characters | unset |
| `HOTEL_OFFERS_PROVIDER` | Offer provider selection | `none` |
| `HOTEL_OFFERS_MODE` | Amadeus environment; production requests require production runtime | `test` |
| `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` | Server-only Amadeus credentials; configure both or neither | unset |
| `HOTEL_OFFERS_TIMEOUT_MS` | Upstream provider request timeout | `8000` |
| `HOTEL_OFFERS_CACHE_TTL_MS` | Cache lifetime for confirmed offers only | `300000` |

The client also accepts `VITE_API_BASE_URL`, set at build time to the backend
API base URL, for example `https://<backend-host>/api`. It contains no secret.
If unset, the client uses `http://localhost:5000/api`.

### Running locally

Start the backend in one terminal:

```powershell
cd "D:\My Code\stayswipe\server"
npm run dev
```

Start the frontend in another:

```powershell
cd "D:\My Code\stayswipe\client"
npm run dev
```

The backend retries initial MongoDB connection failures with backoff and exposes
`GET /api/health` for liveness and database readiness. It also handles SIGINT
and SIGTERM by closing the HTTP server and disconnecting MongoDB.

### Deployment preparation

1. Provision a static frontend host, a Node.js backend host, MongoDB Atlas, and
   (optionally) a domain. Each provider may have separate setup requirements,
   account terms, and costs; none is configured or deployed by this repository.
2. Set `VITE_API_BASE_URL=https://<backend-host>/api` in the frontend build
   environment, then build with `npm ci` and `npm run build` in `client/`.
   Publish the resulting `client/dist/` directory. The client must be rebuilt
   when its API base URL changes.
3. Configure the backend host to install `server/package-lock.json` dependencies
   and run `npm start` from `server/`. The server listens on `process.env.PORT`
   and does not serve the frontend build.
4. Configure backend secrets in the host's environment/secret manager:
   `NODE_ENV=production`, `CLIENT_ORIGIN=https://<frontend-domain>`,
   `MONGODB_URI=<Atlas connection string>`, and the host-provided `PORT`.
   Configure Atlas network access for the backend's real outbound IPs where the
   hosting provider supports stable egress. Never put backend secrets in
   frontend build variables.
5. Serve the frontend and API over HTTPS. Production membership cookies are
   `HttpOnly`, `Secure`, and `SameSite=None` for cross-origin frontend/API use.
   Browser third-party-cookie restrictions can still affect cross-site
   deployments; a same-site frontend and API domain or an appropriately
   configured same-site reverse proxy may be needed. CORS is restricted to the
   exact `CLIENT_ORIGIN`; do not use `*`.
6. Configure the host's health check to call `/api/health`. A response with
   `database: "unavailable"` is live but not ready for database-backed traffic.
   Review host logs for safe connection diagnostics and configure log retention
   and access according to your operational needs.
7. Leave hotel offers disabled (`HOTEL_OFFERS_PROVIDER=none`) unless a valid
   provider account, credentials, and reliable inventory mapping are available.
   Only then configure provider credentials server-side and select the intended
   test or production mode. Test mode uses the provider's test endpoint and
   does not represent live offers.

Current limits include 5 group creations/hour/IP, 20 joins/15 minutes/IP,
120 swipes/minute/member, 10 invitation changes/hour/member, 20 removals/hour/
member, and 30 offer lookups/minute/IP. Sensitive endpoint rate limits are
in-memory and per process, not shared between backend instances. The app does
not set Express proxy trust by default; configure proxy trust only according to
the selected host's documented proxy topology. For multi-instance deployments,
adopt a shared limiter store and validate proxy/client-IP behavior before
increasing instances.

### Data and provider limitations

OpenStreetMap inventory coverage and tags are incomplete and are not verified
hotel ratings, prices, or availability. A small Overpass diagnostic request
timed out during this quality-assurance pass; no response body or successful
alternate-endpoint result was obtained. Inventory import therefore remains
best-effort and must not be a prerequisite for group swiping or matching.
Amadeus offers remain unavailable when credentials or a reliable provider hotel
ID mapping are missing. Neither a live provider request nor a production
MongoDB connection was verified as part of this review. A provider outage must
be treated as unavailable pricing, not as a fabricated offer.

### Available checks and manual verification

Run the commands from each package directory:

```powershell
cd "D:\My Code\stayswipe\server"
npm test
cd "D:\My Code\stayswipe\client"
npm test
npm run build
```

Neither package currently defines a lint script. Before deployment, manually
verify that production HTTPS serves both origins, a real Atlas connection is
ready, allowed and disallowed origins behave as expected, membership cookies
survive the chosen browser/deployment topology, invitation rotation and member
removal take effect, hotel import/provider outages show safe unavailable states,
and group progress/matches remain correct after refresh.

## Project layout

```text
client/   React, Vite, Tailwind CSS, routing, and the browser API client
server/   MongoDB-backed Express API, environment validation, and middleware
```
