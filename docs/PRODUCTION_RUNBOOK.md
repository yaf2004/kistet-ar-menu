# Production Operations Runbook

## Deployment boundary

This repository branch is a release candidate, not a live deployment. Deploy the backend and frontend only after reviewing the pull request and supplying production secrets through the hosting provider's secret manager. Never commit a real `.env` file.

## Backend runtime

- Runtime: Node.js 22 (the backend package supports Node.js 20+).
- Container: `backend/Dockerfile`.
- Start command: `npm start`.
- Readiness probe: `GET /api/health/ready` (returns 200 only while MongoDB is connected).
- Liveness probe: `GET /api/health/live` (checks that the process is responding).
- The server validates required production configuration before listening and initializes MongoDB indexes and the SaaS plan catalog before accepting traffic.
- The process handles SIGTERM/SIGINT and attempts a bounded graceful shutdown.

## Required backend environment

Set these in the hosting provider, not in Git:

- `NODE_ENV=production`
- `MONGO_URI`: MongoDB Atlas or managed MongoDB connection string.
- `JWT_SECRET`: at least 32 random characters; use a fresh, high-entropy secret.
- `BASE_URL`: canonical public frontend origin used by QR generation.
- `ALLOWED_ORIGINS`: comma-separated exact frontend origins, no wildcards.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- `PORT`: supplied by the hosting platform where applicable.

The backend container runs as the unprivileged `node` user. The Docker build excludes local environment files and dependencies.

## Database and backup operations

1. Use a dedicated production MongoDB database and a least-privilege database user.
2. Restrict network access to the hosting provider's outbound IP ranges where practical; avoid public unrestricted access.
3. Enable automated backups / point-in-time recovery on the managed database.
4. Test a restore into a separate staging database before launch and periodically thereafter.
5. Monitor database storage, connection count, slow queries, and index build failures.
6. Keep database backups independent of the application container. Containers are disposable.

The application currently creates/verifies model indexes during startup. For large production datasets, plan index changes as explicit maintenance operations and monitor startup duration.

## SaaS plans (manual billing phase)

The platform seeds Starter, Growth, and Scale plan definitions and provisions a 14-day Starter trial for existing restaurants that do not yet have a subscription. New restaurants receive the same trial at onboarding.

- The super-admin can change a tenant's plan and status from **Admin → Subscriptions**.
- Restaurant admins can view plan limits and current usage from **Admin → My Plan**.
- Server-side admission checks cover menu item count, category count, monthly orders, AR model count, upload size, and active/trial subscription state.
- Payment collection, invoices, automated renewals, proration, dunning, and tax handling are intentionally not implemented.
- Usage checks currently read counts before writes. They are useful product limits but are not atomic quota reservations; simultaneous requests can briefly exceed a limit. Add atomic usage reservations before treating strict quotas as a contractual billing meter.

## AR asset operations

- Upload only self-contained glTF 2.0 binary `.glb` assets.
- The API checks GLB container/chunk structure, rejects external model/image references, estimates vertices and triangles, and stores validation metadata with the menu item.
- Current guardrails: 15 MB maximum upload, 250,000 vertices, 200,000 triangles, and 12 MB per embedded image.
- For best mobile performance, target under 5 MB per dish, under 50,000 triangles, and texture images around 1K–2K resolution. These are production recommendations, not automatic model compression.
- Use HTTPS for customer menus. Native AR handoff is browser/device dependent: Android Scene Viewer, iOS Quick Look, or WebXR support varies by device and browser.
- Keep a high-quality dish photo so the menu remains useful when AR is unavailable.

The server validates the GLB container and declared metadata; it does not yet perform mesh decimation, texture transcoding, Draco compression, thumbnail generation, or a full glTF semantic/security audit. Those require a dedicated asset-processing worker and should be added before accepting large volumes of customer-supplied models.

## Release checklist

- [ ] Rotate any secret that was ever committed to Git; deleting a file from the latest branch does not remove it from history.
- [ ] Configure all required backend secrets and exact CORS origins.
- [ ] Configure frontend `VITE_API_BASE_URL` at build time to the deployed API origin.
- [ ] Confirm the API readiness endpoint returns 200 from the hosting platform.
- [ ] Confirm MongoDB backup and restore procedures.
- [ ] Run the CI workflow and inspect CodeQL/security alerts.
- [ ] Test login, tenant isolation, menu editing, QR URLs, order creation/tracking, subscription limits, and AR on real iOS and Android devices.
- [ ] Confirm Cloudinary uploads, deletion/retention policy, and backup expectations.
- [ ] Keep payment features disabled until a provider and merchant account are deliberately selected.
- [ ] Do not merge this branch or switch production traffic without explicit release approval.

## Incident response

- Use the response `X-Request-Id` to correlate a failed API request with structured server logs.
- If the API is live but readiness is failing, inspect MongoDB connectivity, credentials, network allowlists, and startup index/catalog logs.
- If a tenant is blocked unexpectedly, inspect its restaurant active state and subscription status/trial end in the super-admin subscription screen.
- If a model fails to load, check its GLB validation result, Cloudinary URL, model file availability, and device/browser AR support. Keep the photo fallback enabled.
