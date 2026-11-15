const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = (configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:4000' : '')).replace(/\/$/, '');

let csrfToken = null;

function getToken() {
  return null;
}

function setToken() {
  // Remove legacy bearer tokens; authentication now uses HttpOnly server cookies.
  try { localStorage.removeItem('kistet_token'); } catch {}
}

function setCsrfToken(token) {
  csrfToken = typeof token === 'string' ? token : null;
}

async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Could not initialize request security. Refresh the page and try again.');
  const data = await response.json();
  setCsrfToken(data.csrfToken);
  return csrfToken;
}

async function request(path, { method = 'GET', body, isFormData = false, signal } = {}) {
  if (!API_BASE_URL) {
    throw new Error('The API is not configured. Set VITE_API_BASE_URL to the deployed Kistet backend URL.');
  }

  const normalizedMethod = method.toUpperCase();
  const headers = {};
  if (!['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) {
    headers['X-CSRF-Token'] = await ensureCsrfToken();
  }
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: normalizedMethod,
      headers,
      credentials: 'include',
      cache: normalizedMethod === 'GET' ? 'no-store' : 'default',
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
      signal
    });
  } catch (cause) {
    const error = new Error('Could not reach the Kistet API. Check your connection and try again.');
    error.cause = cause;
    throw error;
  }

  if (res.status === 204) return null;
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.requestId = data?.requestId;
    throw error;
  }
  if (data?.csrfToken) setCsrfToken(data.csrfToken);
  return data;
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (typeof File !== 'undefined' && value instanceof File) return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === '__v') continue;
    if (key === '_id') result.id = String(child);
    else result[key] = normalize(child);
  }
  return result;
}

setToken();

export const apiClient = { request, getToken, setToken, setCsrfToken, normalize };
