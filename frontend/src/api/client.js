// ─────────────────────────────────────────────────────────────────────────
// This file replaces the old Base44 SDK client.
// It talks directly to OUR OWN backend (the Node/Express server you run
// locally with `npm start` inside the /backend folder).
//
// WHAT TO KNOW IF YOU NEED TO CHANGE THIS LATER:
// - API_BASE_URL is where your backend lives. While developing on your
//   own computer this is http://localhost:4000. Once you deploy the
//   backend online (e.g. to Render), you'll change this one line.
// - The auth token (proof that you're logged in) is stored in the
//   browser's localStorage under the key "kistet_token".
// ─────────────────────────────────────────────────────────────────────────

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('kistet_token');
}

function setToken(token) {
  if (token) localStorage.setItem('kistet_token', token);
  else localStorage.removeItem('kistet_token');
}

// Generic request helper. Every API call in the app funnels through here.
async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined)
  });

  let data;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

// Normalizes Mongo's `_id` to `id`, since the existing frontend pages
// (built for Base44) expect every object to have an `.id` field.
function normalize(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(normalize);
  if (obj._id && !obj.id) return { ...obj, id: obj._id };
  return obj;
}

export const apiClient = { request, getToken, setToken, normalize };
