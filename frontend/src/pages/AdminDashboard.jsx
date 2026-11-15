import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { UtensilsCrossed, Tags, Eye, Star, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [i, c] = await Promise.all([
        base44.entities.MenuItem.list(),
        base44.entities.MenuCategory.list(),
      ]);
      setItems(i);
      setCategories(c);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  const available = items.filter(i => i.is_available).length;
  const featured = items.filter(i => i.is_featured).length;
  const arEnabled = items.filter(i => i.ar_enabled).length;

  const stats = [
    { label: "Total Items", value: items.length, icon: UtensilsCrossed, color: "bg-amber-50 text-amber-700", link: "/admin/items" },
    { label: "Categories", value: categories.length, icon: Tags, color: "bg-blue-50 text-blue-700", link: "/admin/categories" },
    { label: "Available", value: available, icon: Eye, color: "bg-green-50 text-green-700", link: "/admin/items" },
    { label: "AR Enabled", value: arEnabled, icon: Star, color: "bg-purple-50 text-purple-700", link: "/admin/items" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-bold text-stone-900">Dashboard</h1>
        <p className="text-stone-500 text-sm mt-1">Overview of your digital menu</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link to={stat.link} className="block bg-white rounded-2xl p-5 border border-stone-100 hover:shadow-md transition-shadow group">
                <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
                  <Icon size={18} />
                </div>
                <p className="text-2xl font-bold text-stone-900">{stat.value}</p>
                <p className="text-xs text-stone-500 mt-0.5">{stat.label}</p>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed size={28} className="text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-stone-900">Get started</h3>
          <p className="text-stone-500 text-sm mt-1 mb-6">Add your first category and menu items to build your digital menu</p>
          <div className="flex gap-3 justify-center">
            <Link to="/admin/categories" className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors">
              Add Category
            </Link>
            <Link to="/admin/items" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
              Add Item
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900">Recent Items</h3>
            <Link to="/admin/items" className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1 font-medium">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-stone-50">
            {items.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center">
                    <UtensilsCrossed size={16} className="text-stone-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{item.name}</p>
                  <p className="text-xs text-stone-500">{categories.find(c => c.id === item.category_id)?.name || "Uncategorized"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-stone-900">${item.price?.toFixed(2)}</p>
                  <div className="flex gap-1 mt-0.5">
                    {item.ar_enabled && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">AR</span>}
                    {!item.is_available && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Unavailable</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}