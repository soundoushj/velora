# VELORA — Full-Stack Perfume Store

University project for the **WAMD** module (Web Application and Mobile Development).

Velora is a perfume e-commerce website. The original project was a React front end with a hard-coded
catalogue. This version adds a secure **Node.js / Express REST API**, a **MongoDB** database, **JWT** and
**Google OAuth 2.0** authentication, **rate limiting**, and a separate **administration dashboard**, while
keeping the original Velora design, routes, favourites and shopping bag.

> **Start here:** follow [`SETUP-CHECKLIST.md`](SETUP-CHECKLIST.md) — it lists every step you must do yourself.

---

## 1. Technologies

| Area | Technology |
|---|---|
| Front end | React 18, Vite, React Router, lucide-react (unchanged from the original project) |
| Back end | Node.js, Express 4, JavaScript (CommonJS) |
| Database | MongoDB / MongoDB Atlas, Mongoose 8 |
| Authentication | JSON Web Tokens (`jsonwebtoken`), Google OAuth 2.0 + OpenID Connect (`google-auth-library`), `bcryptjs` |
| Security | Helmet, CORS allow-list, `express-rate-limit`, `express-validator`, custom NoSQL-injection filter |
| Admin dashboard | Plain HTML / CSS / JavaScript served by Express at `/admin/` |
| Testing | Postman collection, automated tests (`node:test` + `supertest`) |

## 2. Project structure

```
velora-fullstack/
├── README.md                  <- this file
├── SETUP-CHECKLIST.md         <- everything YOU must configure
├── frontend/                  <- the existing React shop (now fed by the API)
│   ├── .env.example           <- VITE_API_URL
│   └── src/
│       ├── services/api.js        <- API client + product adapter
│       ├── context/ShopContext.jsx  <- bag + favourites (unchanged logic) + products from the API
│       ├── context/AuthContext.jsx  <- customer login state (JWT)
│       ├── components/DataGate.jsx  <- loading / error states
│       └── pages/Account.jsx, AuthCallback.jsx  <- sign in, register, "Continue with Google"
└── backend/
    ├── server.js              <- start-up (validates config, connects to MongoDB, listens)
    ├── app.js                 <- Express app factory (Helmet, CORS, limiters, routes)
    ├── .env.example           <- all environment variables with placeholders
    ├── config/                <- index.js (env), db.js (MongoDB), google.js (OAuth client)
    ├── models/                <- User.js, Product.js
    ├── controllers/           <- authController, productController, adminController
    ├── routes/                <- authRoutes, productRoutes, adminRoutes
    ├── middleware/            <- auth (JWT + admin), validators, validate, sanitize, rateLimiters, errorHandler
    ├── services/              <- tokenService (JWT), oauthState (one-time login codes)
    ├── utils/                 <- ApiError, asyncHandler, password rules
    ├── scripts/               <- seed-products.js, create-admin.js
    ├── data/catalogue.json    <- the ORIGINAL Velora catalogue (26 perfumes)
    ├── admin/                 <- administration dashboard (index.html, admin.css, admin.js)
    ├── postman/               <- Velora-API.postman_collection.json
    └── tests/api.test.js      <- automated tests
```

## 3. Database models

**User**

| Field | Type | Notes |
|---|---|---|
| `name` | String | 2–60 characters |
| `email` | String | required, lower-cased, **unique index** |
| `passwordHash` | String | bcrypt hash; `select: false` and stripped from every JSON response |
| `role` | `customer` \| `admin` | defaults to `customer`; can **never** be set through the API |
| `authProvider` | `local` \| `google` | |
| `googleId` | String | Google account id (`sub`), only for Google users; never returned |
| `createdAt`, `updatedAt` | Date | timestamps |

**Product** (adapted to the existing Velora catalogue)

| Field | Notes |
|---|---|
| `slug` | the **original Velora product id** (e.g. `dior-sauvage`), unique. Keeps old links, favourites and image names working |
| `name`, `brand`, `description` | text |
| `price` | number, in DZD |
| `category` | e.g. "Eau de parfum" (the original `type`) |
| `imageUrl` | e.g. `/assets/perfumes/dior-sauvage.jpg` |
| `stock` | whole number ≥ 0 (new — the original shop had no stock) |
| `gender` | `Her` \| `Him` \| `Unisex` |
| `family` | fragrance family: Floral, Woody, Oriental, Fresh, Citrus, Gourmand, Musky |
| `familyLabel`, `size`, `bestseller`, `featured`, `smellsLike`, `notes {top, heart, base}` | kept from the original data |
| `sortOrder` | keeps the original catalogue order |
| `createdAt`, `updatedAt` | timestamps |

## 4. API endpoints

Base URL: `http://localhost:5000`. Responses are JSON: `{ "success": true, "data": ... }` or `{ "success": false, "message": "...", "errors": [...] }`.

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/api/auth/register` | Register (always a *customer*) | Public |
| POST | `/api/auth/login` | Login, returns a JWT | Public (5 / 15 min / IP) |
| GET | `/api/auth/me` | Current user | JWT |
| GET | `/api/auth/google` | Start Google sign-in | Public |
| GET | `/api/auth/google/callback` | Google redirects here | Public |
| POST | `/api/auth/oauth/exchange` | Swap one-time code for a JWT | Public |
| GET | `/api/products` | List (filters: `search`, `gender`, `family`, `category`, `bestseller`, `featured`, `inStock`, `stockLevel`, `minPrice`, `maxPrice`, `sort`, `page`, `limit`) | Public |
| GET | `/api/products/:id` | One product (`:id` = MongoDB id **or** original slug) | Public |
| POST | `/api/products` | Create | **Admin** (JWT + role) |
| PUT | `/api/products/:id` | Update (send the fields to change) | **Admin** |
| PATCH | `/api/products/:id/stock` | Update stock | **Admin** |
| DELETE | `/api/products/:id` | Delete | **Admin** |
| GET | `/api/admin/stats` | Dashboard figures | **Admin** |
| GET | `/api/admin/users` | List users (no hashes) | **Admin** |
| GET | `/api/health` | Health check | Public |

Status codes used: **200** OK, **201** Created, **400** validation/invalid id, **401** missing/invalid token,
**403** not an administrator, **404** not found, **409** duplicate, **413** body too large, **429** rate limit, **500** server error.

## 5. Authentication

### Passwords
Hashed with **bcrypt** (`bcryptjs`, cost 12) before storage. Plain-text passwords are never stored or logged.
Rules: 8–72 bytes with at least one letter and one number (administrators: 12+ characters).
Login answers `Invalid email or password.` for both unknown emails and wrong passwords, and does the same amount
of hashing work in both cases, so attackers cannot discover which emails exist.

### JWT (JSON Web Token)
After a successful login the server returns a signed token:

```
Authorization: Bearer <JWT_TOKEN>
```

* Algorithm **HS256**, signed with `JWT_SECRET` (environment variable, 32+ random characters).
* Payload: user id (`sub`), role, issuer, audience, expiry (`JWT_EXPIRES_IN`, default 1 hour).
* `middleware/auth.js → authenticate` reads the header, verifies signature/expiry/issuer/audience (only HS256 is accepted, so `alg: none` forgeries fail), then **loads the user from the database**. Deleted users are rejected immediately.
* `requireAdmin` checks `role === 'admin'` using the **database** record — never anything sent by the client. Hiding a button in the UI is not security; every admin route is protected on the server.

### OAuth 2.0 / OpenID Connect (Google)
Flow: **Authorization Code with PKCE (S256)**, performed by the backend so the client secret never reaches the browser.

1. Browser opens `GET /api/auth/google`. The server creates `state` (CSRF protection), `nonce` and a PKCE `code_verifier`, keeps them in a short-lived signed **httpOnly** cookie, and redirects to Google with the `code_challenge`.
2. The user signs in at Google and is redirected to `/api/auth/google/callback?code=...&state=...`.
3. The server checks `state`, exchanges the code **together with the PKCE verifier** at Google, and verifies the ID token (signature, issuer, audience = our client id, expiry, `nonce`, `email_verified`).
4. **Account rules:** known Google id → log in; email already used by a *password* account → **not silently merged** (prevents account take-over), the user is asked to sign in with the password; otherwise a new **customer** is created. Google can never create or become an administrator.
5. The server redirects to the React app with a **one-time code** (valid 60 s, single use). The app swaps it for a JWT with `POST /api/auth/oauth/exchange`, so the JWT never appears in a URL.

## 6. Security mechanisms

| Requirement | Implementation |
|---|---|
| Password hashing | bcrypt, cost 12 |
| JWT authentication | `authenticate` middleware on every protected route |
| Administrator authorization | `requireAdmin` on every product-write and `/api/admin/*` route; no self-registration as admin; no hard-coded credentials |
| Input validation | `express-validator` rules for every body/query/param (types, lengths, enums, ids) |
| Sanitization | `sanitize.js` removes `$…` / dotted keys (NoSQL injection); strings are checked as real strings; `<`/`>` rejected in names; image URLs must be `/path` or http(s); search text is regex-escaped; unknown fields are ignored (whitelist, prevents mass assignment) |
| Secure headers | Helmet, including a strict Content-Security-Policy (no inline scripts), no `X-Powered-By` |
| CORS | allow-list from `FRONTEND_URL` / `CORS_ORIGINS`; other browser origins get 403 |
| Brute-force protection | login limited to 5 requests / 15 min / IP |
| General rate limit | 100 requests / 15 min / IP on `/api` |
| Secrets | only in `.env` (git-ignored); the server refuses to start with a weak or missing `JWT_SECRET` |
| Error handling | central handler; clients get generic messages, details are logged on the server only |
| XSS in the dashboard | all server data is inserted with `textContent`, never `innerHTML` |

### Rate limiting
`middleware/rateLimiters.js`, using `express-rate-limit` (counters are per client IP, in memory):

* **General API:** 100 requests per 15 minutes → HTTP **429** afterwards.
* **Login endpoint:** 5 requests per 15 minutes per IP → HTTP **429** afterwards (with `Retry-After`).
* Registration and OAuth code exchange: 20 per 15 minutes.

Values come from `.env` (`API_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_MAX`, …) and default to the assignment values.
Because counters are in memory, restarting the backend resets them.

## 7. Installation

Requirements: **Node.js 18+** and a free **MongoDB Atlas** account.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # Windows PowerShell: copy .env.example .env
#    ... fill in .env (see section 8) ...
npm run seed                  # imports the 26 Velora perfumes into MongoDB
npm run create-admin          # creates your first administrator (section 10)
npm run dev                   # API on http://localhost:5000 , admin on /admin/

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev                   # shop on http://localhost:5173
```

## 8. Environment variables (`backend/.env`)

| Variable | Required | Meaning |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string (database name `velora`) |
| `JWT_SECRET` | yes | 32+ random characters — create with `npm run generate-secret` |
| `JWT_EXPIRES_IN` | no | token lifetime, default `1h` |
| `FRONTEND_URL` | no | default `http://localhost:5173` (CORS + OAuth redirect) |
| `BACKEND_URL` | no | default `http://localhost:5000` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google login | from Google Cloud Console |
| `API_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_MAX` | no | defaults 100 and 5 |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | only for `create-admin` | delete the password line afterwards |
| `TEST_MONGODB_URI` | only for `npm test` | a *separate* database whose name contains `test` |

`frontend/.env`: `VITE_API_URL` (default `http://localhost:5000/api`). Only public values belong there.

## 9. MongoDB setup

1. Create an account at <https://www.mongodb.com/cloud/atlas/register> and a free **M0** cluster.
2. **Database Access** → add a database user (username + password).
3. **Network Access** → add your IP address (or "Allow access from anywhere" for testing).
4. **Database → Connect → Drivers** → copy the connection string, replace `<password>`, add `/velora` before the `?`, and paste it into `MONGODB_URI`.
5. `npm run seed` creates the `products` collection (`npm run seed:reset` wipes and re-imports it). No dataset needs to be downloaded: the catalogue is already in `backend/data/catalogue.json`.

## 10. Administrator account

There is deliberately **no** admin registration endpoint and no default password.

1. In `backend/.env` set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters, letters and numbers).
2. Run `npm run create-admin`. It refuses to run if an admin already exists, and never touches an existing account unless you pass `--promote`.
3. Delete the `ADMIN_PASSWORD` line from `.env`.
4. Open <http://localhost:5000/admin/> and sign in.

The dashboard offers: overview (total perfumes, registered users, inventory units/value, low and out-of-stock), product management (search, filter by audience/family/stock, add, edit, delete, update stock), a read-only user list, and logout. A customer account that tries to sign in is refused, and every API call is checked again on the server.

## 11. Testing the API

**Postman / Thunder Client:** import `backend/postman/Velora-API.postman_collection.json`, open the collection's **Variables** tab, set `adminEmail` and `adminPassword`, and run the folders in order (or click **Run collection**). Each request has test scripts (green ticks are good screenshots) and tokens are saved automatically.

| Folder | What it proves |
|---|---|
| 1 Authentication | register, duplicate email (409), validation (400), login OK, login wrong (401), JWT received, admin login |
| 2 Products | list, filters, get one, **create / update / stock / delete** with an admin token |
| 3 Security | no token (401), bad token (401), **customer → admin route (403)**, invalid id (400), unknown id (404), missing/invalid data (400), NoSQL injection (400), script in a name (400) |
| 5 OAuth | invalid code (400); the Google flow itself is tested in the browser (see below) |
| 4 Rate limiting (**run last**) | send the login request 6 times → 429; `RateLimit-*` headers |

**OAuth in the browser:** with Google configured, open `http://localhost:5000/api/auth/google?response=json`, approve at Google, and the page shows your user and JWT (this helper is disabled when `NODE_ENV=production`). In the shop, use **Account → Continue with Google**.

**Automated tests:** set `TEST_MONGODB_URI` to a *separate* test database, then `npm test` (46 tests: authentication, CRUD, 401/403/400/404/409/429, injection, CORS, headers, and the complete Google flow with Google's two network calls mocked).

**Screenshot ideas for your report:** Postman folders with green tests; the 403 customer response; the 429 response; the dashboard pages; MongoDB Atlas showing `users` (hashed passwords) and `products`; the Google consent screen.

## 12. Known limitations

* The original project used **React Context** (not Redux) for the bag and favourites; that logic was kept as it was.
* Bag and favourites remain in the browser's `localStorage`; orders, payments and server-side carts are out of scope.
* Rate-limit counters and one-time OAuth codes are stored in memory (correct for one server; use Redis for several).
* Tokens are sent as Bearer headers and kept in `sessionStorage` (cleared when the tab closes); there is no refresh-token mechanism.
* There is no e-mail verification or password reset.
* In production use HTTPS, set `NODE_ENV=production` and `TRUST_PROXY` behind a proxy, and add your deployed URLs to Google's redirect URIs.
