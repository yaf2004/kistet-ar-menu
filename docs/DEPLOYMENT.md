# Production deployment

This repository uses a separate Node API and a React frontend. The recommended Netlify deployment keeps browser requests on the frontend origin through the Netlify Function proxy. This avoids relying on third-party cookies for admin sessions.

## 1. Backend service

Deploy the `backend/` directory as a Node 20+ web service. Set:

- `NODE_ENV=production`
- `PORT` (provided by the host)
- `MONGO_URI` (MongoDB Atlas or another production MongoDB URI with TLS and a least-privilege database user)
- `JWT_SECRET` (generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
- `JWT_EXPIRES=12h`
- `JWT_ISSUER=kistet-ar-menu`
- `JWT_AUDIENCE=kistet-ar-menu-web`
- `BASE_URL=https://YOUR-NETLIFY-SITE.example` (the public frontend origin used in QR codes)
- `ALLOWED_ORIGINS=https://YOUR-NETLIFY-SITE.example`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`

Use the backend start command `npm start`. The service must expose `/api/health/live` and `/api/health`. Do not commit real secrets or production environment files.

## 2. Netlify frontend

Set the Netlify site's base directory to `frontend` (as configured in `netlify.toml`). Add the runtime environment variable:

- `API_ORIGIN=https://YOUR-BACKEND-SERVICE.example` (origin only; no trailing `/api` path)

Leave `VITE_API_BASE_URL` empty so the browser uses the same-origin `/api/*` rewrite through `frontend/netlify/functions/api.js`. The function forwards the browser's session and CSRF cookies to the backend and relays the backend's Set-Cookie headers.

If you intentionally use a direct cross-origin API URL instead, set `VITE_API_BASE_URL` to that API origin and add the exact frontend origin to backend `ALLOWED_ORIGINS`. Cross-site cookie behavior varies by browser; the same-origin proxy is the recommended configuration.

## 3. Create the platform administrator

After MongoDB is connected and the backend is deployed, run `npm run seed` from `backend/` once using a secure terminal. Use a unique password of at least 12 characters. Do not create the first administrator through a public signup endpoint.

## 4. Verify before launch

1. Confirm `/api/health` reports a connected database.
2. Log in and confirm the browser receives an HttpOnly `kistet_session` cookie and a CSRF cookie.
3. Confirm `/api/auth/me` works after a full page refresh.
4. Confirm an untrusted origin cannot log in or make authenticated state-changing requests.
5. Create a test restaurant, category, item, GLB upload, QR code, and test order.
6. Verify that one restaurant cannot read or mutate another restaurant's items or orders.
7. Verify the order status path: new → accepted → preparing → ready → completed.
8. Test on a real Android AR-capable device and an iPhone; desktop model viewing is not proof that device AR works.

## 5. Payment and commercial launch gates

Customer orders currently use pay-at-restaurant and remain marked unpaid until a payment integration is selected and implemented. Do not represent an order as paid based on a browser redirect or client-side claim. A production payment integration needs merchant credentials, signed webhook verification, idempotent payment events, refund handling, and reconciliation.

Subscription billing, custom-domain provisioning, restaurant staff invitations/permissions, and plan entitlements still require a dedicated implementation before advertising the product as a complete self-service SaaS.
