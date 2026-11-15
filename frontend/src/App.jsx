import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminItems from '@/pages/AdminItems';
import AdminCategories from '@/pages/AdminCategories';
import AdminQR from '@/pages/AdminQR';
import AdminSettings from '@/pages/AdminSettings';
import AdminRestaurants from '@/pages/AdminRestaurants';
import AdminOrders from '@/pages/AdminOrders';
import CustomerMenu from '@/pages/CustomerMenu';
import Login from '@/pages/Login';
import Home from '@/pages/Home';

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

function AppRoutes() {
  const { isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      {/* Customer-facing menu, reached via QR code: /menu/:slug?table=N */}
      <Route path="/menu/:slug" element={<CustomerMenu />} />

      {/* Protected admin area — requires login (either role) */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/items" element={<AdminItems />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/qr" element={<AdminQR />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          {/* Super-admin only in practice — page itself returns nothing useful for restaurant_admins */}
          <Route path="/admin/restaurants" element={<AdminRestaurants />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
