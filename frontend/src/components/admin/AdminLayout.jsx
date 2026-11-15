import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, UtensilsCrossed, Tags, Settings, QrCode, Menu, X, Building2, LogOut, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Menu Items", path: "/admin/items", icon: UtensilsCrossed },
  { label: "Categories", path: "/admin/categories", icon: Tags },
  { label: "QR Code", path: "/admin/qr", icon: QrCode },
  { label: "Orders", path: "/admin/orders", icon: ClipboardList },
  { label: "Settings", path: "/admin/settings", icon: Settings },
];

const superAdminItem = { label: "All Restaurants", path: "/admin/restaurants", icon: Building2 };

export default function AdminLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const items = isSuperAdmin ? [superAdminItem, ...navItems] : navItems;

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-stone-900 text-white transform transition-transform duration-300 lg:translate-x-0 flex flex-col ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 border-b border-stone-700">
          <h1 className="text-xl font-heading font-bold tracking-tight">Kistet AR Menu</h1>
          <p className="text-stone-400 text-xs mt-1">{isSuperAdmin ? "Super Admin" : (user?.restaurant?.name || "Restaurant Admin")}</p>
        </div>
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {items.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? "bg-amber-600 text-white" : "text-stone-300 hover:bg-stone-800 hover:text-white"}`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 space-y-2 border-t border-stone-700">
          {!isSuperAdmin && user?.restaurant?.slug && (
            <Link to={`/menu/${user.restaurant.slug}`} target="_blank" className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium transition-colors">
              View Live Menu →
            </Link>
          )}
          <button
            onClick={() => logout(true)}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-stone-800 hover:bg-stone-700 rounded-lg text-sm font-medium transition-colors text-stone-300"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 lg:px-8 h-16 flex items-center">
          <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </Button>
          <div className="text-sm text-stone-500 font-medium">
            {items.find(n => n.path === location.pathname)?.label || "Admin"}
          </div>
        </header>
        <main className="p-4 lg:p-8 max-w-6xl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}