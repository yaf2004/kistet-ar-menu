# Security and deployment checklist

## Environment secrets

- Never commit `.env` files. The repository-level `.gitignore` excludes local environment files while keeping `.env.example` templates.
- Configure production values in the hosting provider's encrypted environment-variable settings.
- Generate `JWT_SECRET` with at least 48 random bytes:

  ```sh
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

- Keep `MONGO_URI`, Cloudinary credentials, and all signing keys on the server only.
- Use HTTPS for the frontend and API in production. Set `ALLOWED_ORIGINS` to exact frontend origins, comma-separated.

## Exposed-secret response

A backend environment file was previously committed. Removing it from the current branch does not erase copies in Git history or other branches. Treat every value in that file as compromised:

1. Replace `JWT_SECRET` in the production host and local untracked `backend/.env`. Redeploy; existing sessions will be invalidated.
2. Rotate any third-party or database credentials if they were ever present in the committed file.
3. Merge the branch change that removes `backend/.env` and adds the ignore rules.
4. If history cleanup is required, coordinate a repository-wide history rewrite with every contributor and deployment before force-pushing. Do not rewrite shared history casually.

## Security controls in the API

- HttpOnly session cookies, CSRF token checks, exact-origin CORS, and session revocation via token versions.
- Tenant-scoped authorization for restaurant, category, item, QR, and order operations.
- Atomic database-backed login, public-order, and asset-upload throttles.
- Server-side order price calculation and idempotency keys.
- File signature checks, constrained upload types, tenant-specific Cloudinary folders, and bounded upload sizes.
- Production startup checks for required configuration; readiness endpoint at `/api/health`.

## Operational checks before launch

- Confirm MongoDB backups and restore procedures.
- Configure Cloudinary and verify model/image uploads with production credentials.
- Configure a real payment provider before enabling online payment. The current order flow supports pay-at-restaurant only; it must not represent an unpaid order as paid.
- Run the GitHub Actions quality checks and CodeQL on the exact commit being deployed.
