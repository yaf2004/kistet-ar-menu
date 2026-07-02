# Kistet AR Menu — Full System

This is your complete, self-hosted AR menu platform: a backend (database + API)
and a frontend (the admin dashboard + customer-facing menu), both fully owned
by you — no dependency on Base44 or any third-party platform.

## How it's organized

```
kistet-ar-menu/
├── backend/      ← the database + API server (Node.js/Express + MongoDB)
└── frontend/     ← the website (React) — both the admin dashboard AND
                     the customer menu live in this one app
```

## The two account types

- **super_admin** (you) — logs in, sees every restaurant on the platform,
  can create new ones (which auto-creates that restaurant's login too)
- **restaurant_admin** (each client) — logs in, only sees and edits their
  own restaurant's menu, categories, settings, and QR codes

## Running it locally (for development/testing)

You need BOTH the backend and frontend running at the same time, in two
separate terminal windows.

### Terminal 1 — backend
```
cd backend
npm install        (only needed the first time, or after I add new code)
npm start
```
Should print: `Backend running -> http://localhost:4000`

### Terminal 2 — frontend
```
cd frontend
npm install --legacy-peer-deps   (only needed the first time)
npm run dev
```
Should print a link like `http://localhost:5173`

Open that link in your browser — that's your whole app.

## First-time setup

If you haven't already created your super-admin login:
```
cd backend
npm run seed
```
This asks for your name/email/password right in the terminal.

## URLs once it's running

- `http://localhost:5173/login` — admin login (both account types use this)
- `http://localhost:5173/admin` — restaurant_admin dashboard
- `http://localhost:5173/admin/restaurants` — super_admin's "all restaurants" page
- `http://localhost:5173/menu/restaurant-slug` — the public customer-facing menu
  (this is what the QR code points to)

## Adding a new restaurant client

1. Log in as super_admin
2. Go to "All Restaurants" → "Add Restaurant"
3. Fill in their name + an email/password for their login
4. Give that email/password to the restaurant — they log in at `/login`
   and only see their own menu from then on

## Real AR — how it actually works

Each menu item can have a `.glb` 3D model attached (uploaded in the item's
edit form, under "3D Model for AR"). When a customer taps "View in AR" on
an item that has one, it opens a real AR viewer (Google's `<model-viewer>`)
that uses the phone's native AR system — WebXR, Android Scene Viewer, or
iOS Quick Look — to place the actual 3D object on their real table.

Items without a 3D model uploaded yet just show the dish photo instead —
no fake/simulated AR.

### Getting 3D models for your dishes
- iPhone with LiDAR (12 Pro and later): scan the dish with an app like
  "3D Scanner App" (free), export as `.glb`
- AI photo-to-3D tools (Meshy, Tripo, etc.) — upload a photo, get a `.glb`
  back in a few minutes
- Hire a freelance 3D artist for a hero/signature dish

## Deploying online (so QR codes work on real restaurant tables)

This still runs locally right now — QR codes generated will only work on
this computer. To go live:

1. Deploy the `backend` folder to a host like Render.com (free tier works)
2. Deploy the `frontend` folder to a host like Netlify or Vercel (free tier works)
3. Update `frontend/.env`'s `VITE_API_BASE_URL` to point to your deployed backend
4. Update `backend/.env`'s `BASE_URL` to point to your deployed frontend
5. Re-generate QR codes from the admin panel — they'll now point to your live URLs

(Ask me when you're ready for this step — I'll walk you through it.)

## Troubleshooting

**Backend won't connect to database**: check `backend/.env`'s `MONGO_URI` is
correct and that either local MongoDB is running, or your Atlas cluster is
reachable.

**Frontend shows blank page / errors in browser console**: make sure the
backend is running FIRST, then start the frontend. The frontend has nothing
to talk to if the backend isn't up.

**"Network Error" when logging in**: check `frontend/.env`'s
`VITE_API_BASE_URL` matches wherever your backend is actually running.
