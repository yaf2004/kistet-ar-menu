// ─────────────────────────────────────────────────────────────────────────
// DROP-IN REPLACEMENT for the old @base44/sdk client.
//
// The rest of the app calls things like:
//   base44.auth.loginViaEmailPassword(email, password)
//   base44.entities.MenuItem.list()
//   base44.entities.MenuItem.create(data)
//
// This file provides those exact same function names, but every one of
// them talks to OUR backend instead of Base44's servers. This is what
// lets us reuse all the existing page code without rewriting each page.
//
// KEY DIFFERENCE FROM BASE44: this app is multi-tenant (many restaurants).
// A logged-in restaurant_admin should only ever see THEIR OWN restaurant's
// categories/items. Rather than make every page pass a restaurant ID
// explicitly, this client automatically figures out "which restaurant
// am I scoped to" from the logged-in user, and applies it to every call.
// super_admins are not scoped to one restaurant — see restaurants.list().
// ─────────────────────────────────────────────────────────────────────────

import { apiClient, API_BASE_URL } from './client';

let cachedUser = null; // simple in-memory cache of "who is logged in", refreshed on login/me()

async function getCurrentUser() {
  if (cachedUser) return cachedUser;
  cachedUser = await apiClient.request('/api/auth/me');
  return cachedUser;
}

// Figures out which restaurant ID the current request should be scoped to.
// - super_admin with no restaurant in context: throws (pages must pass one explicitly)
// - restaurant_admin: always their own restaurant
async function resolveRestaurantId(explicitId) {
  if (explicitId) return explicitId;
  const user = await getCurrentUser();
  if (user.role === 'restaurant_admin' && user.restaurant) {
    return user.restaurant._id || user.restaurant.id || user.restaurant;
  }
  return null; // super_admin with nothing selected — caller must handle this
}

// ── AUTH ───────────────────────────────────────────────────────────────────
const auth = {
  async loginViaEmailPassword(email, password) {
    const data = await apiClient.request('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    apiClient.setCsrfToken(data.csrfToken);
    cachedUser = data.user;
    return data.user;
  },

  async me() {
    const user = await getCurrentUser();
    return apiClient.normalize(user);
  },

  logout() {
    cachedUser = null;
    return apiClient.request('/api/auth/logout', { method: 'POST' }).catch(() => {});
  },

  // Kept as a no-op stub so Login.jsx doesn't crash if Google button is clicked —
  // real Google login isn't set up in this self-hosted version.
  loginWithProvider() {
    alert('Google login is not available in this self-hosted version. Please use email + password.');
  },

  redirectToLogin() {
    window.location.href = '/login';
  }
};

// ── GENERIC ENTITY FACTORY ───────────────────────────────────────────────────
// Builds a {list, create, update, delete} object for a given backend resource,
// matching the shape base44.entities.X used to have.
function makeEntity(resourcePath, { publicPath } = {}) {
  return {
    // list() — restaurant_admins always get their own restaurant's data.
    // For super_admin pages that need a SPECIFIC restaurant's data, pass
    // an options object: list(sortKey, { restaurantId: '...' })
    async list(sortKey, opts = {}) {
      const restaurantId = await resolveRestaurantId(opts.restaurantId);
      if (!restaurantId) return []; // super_admin with nothing selected yet
      const data = await apiClient.request(`/api/${resourcePath}/${restaurantId}`);
      return apiClient.normalize(data);
    },

    async create(payload) {
      const restaurantId = await resolveRestaurantId(payload.restaurant);
      const body = { ...payload, restaurant: restaurantId };
      const data = await apiClient.request(`/api/${resourcePath}`, { method: 'POST', body });
      return apiClient.normalize(data);
    },

    async update(id, payload) {
      const data = await apiClient.request(`/api/${resourcePath}/${id}`, { method: 'PUT', body: payload });
      return apiClient.normalize(data);
    },

    async delete(id) {
      return apiClient.request(`/api/${resourcePath}/${id}`, { method: 'DELETE' });
    }
  };
}

// Restaurant entity is special: super_admin sees ALL restaurants,
// restaurant_admin sees only their own (as a 1-item list, to match the
// "restaurants.list()[0]" pattern the existing AdminSettings page uses).
const Restaurant = {
  async list() {
    const user = await getCurrentUser();
    if (user.role === 'super_admin') {
      const data = await apiClient.request('/api/restaurants');
      return apiClient.normalize(data);
    }
    if (user.restaurant) {
      const id = user.restaurant._id || user.restaurant.id || user.restaurant;
      const data = await apiClient.request(`/api/restaurants/${id}`);
      return [apiClient.normalize(data)];
    }
    return [];
  },
  async create(payload) {
    // Only super_admin can do this — see AdminOnboardRestaurant page
    const data = await apiClient.request('/api/restaurants', { method: 'POST', body: payload });
    return apiClient.normalize(data);
  },
  async update(id, payload) {
    const data = await apiClient.request(`/api/restaurants/${id}`, { method: 'PUT', body: payload });
    return apiClient.normalize(data);
  },
  async toggleActive(id) {
    const data = await apiClient.request(`/api/restaurants/${id}/toggle-active`, { method: 'PUT' });
    return apiClient.normalize(data);
  },
  async delete(id) {
    return apiClient.request(`/api/restaurants/${id}`, { method: 'DELETE' });
  }
};

const entities = {
  Restaurant,
  MenuCategory: makeEntity('categories'),
  MenuItem: makeEntity('items')
};

// ── FILE UPLOADS (photos + 3D models) ─────────────────────────────────────────
const integrations = {
  Core: {
    // Matches base44's shape: UploadFile({ file }) -> { file_url }
    // fieldName lets callers specify 'image' (default) or 'model3d'
    async UploadFile({ file, fieldName = 'image' }) {
      const restaurantId = await resolveRestaurantId();
      const formData = new FormData();
      formData.append(fieldName, file);
      formData.append('restaurant', restaurantId || '');
      // We reuse the items upload endpoint's file handling by uploading
      // through a lightweight dedicated endpoint:
      const data = await apiClient.request('/api/items/upload-only', {
        method: 'POST',
        body: formData,
        isFormData: true
      });
      return { file_url: data.url, asset_id: data.assetId || null, model_metadata: data.modelMetadata || null };
    }
  }
};

export const base44 = { auth, entities, integrations };

// Exposed for pages that need to know the logged-in user's role/restaurant directly
export async function getCurrentUserInfo() {
  return getCurrentUser();
}
export function clearUserCache() {
  cachedUser = null;
}
