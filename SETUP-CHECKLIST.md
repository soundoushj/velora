# Your personal setup checklist

Everything below is something only YOU can do (accounts and secrets). The same reminders are written as
`USER ACTION REQUIRED` comments in the files named in each step.

## A. Install the tools
1. Install **Node.js 18 or newer** from <https://nodejs.org> (check with `node -v`).

## B. MongoDB Atlas  →  file: `backend/.env` (`MONGODB_URI`)
2. Create an account: <https://www.mongodb.com/cloud/atlas/register>
3. Create a free **M0** cluster.
4. **Database Access** → *Add New Database User* → remember the username and password.
5. **Network Access** → *Add IP Address* → *Add current IP address*.
6. **Database → Connect → Drivers** → copy the connection string.
7. Paste it into `backend/.env` as `MONGODB_URI`, replacing `<password>` and adding `/velora` before the `?`.

## C. Backend configuration  →  file: `backend/.env`
8. In `backend/`: copy `.env.example` to `.env`.
9. Run `npm install`, then `npm run generate-secret`, and paste the output into `JWT_SECRET`.
10. Run `npm run seed` (imports the 26 existing perfumes).

## D. First administrator  →  file: `backend/.env` (`ADMIN_*`)
11. Fill in `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters, letters and numbers).
12. Run `npm run create-admin`, then **delete the `ADMIN_PASSWORD` line** from `.env`.

## E. Google OAuth  →  file: `backend/.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
13. Open <https://console.cloud.google.com/> and create a project.
14. **APIs & Services → OAuth consent screen** → *External* → fill the app name and your e-mail → add **your own Google account as a Test user**.
15. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
16. Under **Authorized redirect URIs** add exactly: `http://localhost:5000/api/auth/google/callback`
17. Copy the **Client ID** and **Client secret** into `backend/.env`. Never put them in the frontend.

## F. Start everything
18. Backend (in `backend/`): `npm run dev` → <http://localhost:5000/api/health>
19. Frontend (in `frontend/`): copy `.env.example` to `.env`, `npm install`, `npm run dev` → <http://localhost:5173>
20. Admin dashboard: <http://localhost:5000/admin/>

## G. Test and capture screenshots
21. Import `backend/postman/Velora-API.postman_collection.json` into Postman (or Thunder Client), set `adminEmail` / `adminPassword` in its Variables, and run folders 1 → 5.
22. For OAuth open <http://localhost:5000/api/auth/google?response=json> in your browser.
23. (Optional) `npm test` needs `TEST_MONGODB_URI` pointing to a separate database with "test" in its name.

No other API keys are needed, and no dataset must be downloaded.
