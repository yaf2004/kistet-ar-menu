import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "@/api/client";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, Eye, MapPin, Phone, X, Sparkles, AlertTriangle, UtensilsCrossed } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ARViewer from "@/components/customer/ARViewer";
import CustomerOrdering from "@/components/customer/CustomerOrdering";

function CustomerOrderingBridge(props) {
  const [cartSeed, setCartSeed] = React.useState(0);
  React.useEffect(() => {
    const onAdd = () => setCartSeed((value) => value + 1);
    window.addEventListener("kistet:add-to-order", onAdd);
    return () => window.removeEventListener("kistet:add-to-order", onAdd);
  }, []);
  return <CustomerOrdering key={cartSeed} {...props} />;
}

export default function CustomerMenu() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get("table");

  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [arItem, setArItem] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // PUBLIC endpoints — no login needed, this is what customers hit via QR code
        const rRes = await fetch(`${API_BASE_URL}/api/restaurants/public/${slug}`);
        if (!rRes.ok) { setNotFound(true); setLoading(false); return; }
        const r = await rRes.json();
        const restaurantId = r._id || r.id;

        const [cRes, iRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/categories/public/${restaurantId}`),
          fetch(`${API_BASE_URL}/api/items/public/${restaurantId}`)
        ]);
        const c = await cRes.json();
        const i = await iRes.json();

        setRestaurant({ ...r, id: restaurantId });
        setCategories(c.filter((cat) => cat.is_active !== false));
        setItems(i.filter((item) => item.is_available !== false));
      } catch (err) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const currency = restaurant?.currency || "$";

  // Build theme CSS vars from restaurant settings
  const theme = {
    primary: restaurant?.theme_primary_color || "#d97706",
    bg: restaurant?.theme_bg_color || "#fafaf9",
    card: restaurant?.theme_card_color || "#ffffff",
    text: restaurant?.theme_text_color || "#1c1917",
    font: {
      modern: "'Inter', 'Helvetica Neue', sans-serif",
      serif: "'Playfair Display', Georgia, serif",
      rounded: "'Nunito', 'Trebuchet MS', sans-serif",
      mono: "'JetBrains Mono', 'Courier New', monospace"
    }[restaurant?.theme_font || "modern"] || "'Inter', sans-serif"
  };

  const themeStyle = {
    "--tm-primary": theme.primary,
    "--tm-bg": theme.bg,
    "--tm-card": theme.card,
    "--tm-text": theme.text,
    "--tm-font": theme.font,
    backgroundColor: theme.bg,
    color: theme.text,
    fontFamily: theme.font
  };

  const filtered = items.filter((i) => {
    const matchSearch = !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !activeCategory || i.category_id === activeCategory;
    return matchSearch && matchCategory;
  });

  const featuredItems = items.filter((i) => i.is_featured);

  const groupedByCategory = categories.
  map((cat) => ({
    ...cat,
    items: filtered.filter((i) => i.category_id === cat.id)
  })).
  filter((cat) => cat.items.length > 0);

  const uncategorized = filtered.filter((i) => !categories.find((c) => c.id === i.category_id));

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-amber-600 rounded-full animate-spin mx-auto" />
          <p className="text-stone-400 text-sm mt-4">Loading menu...</p>
        </div>
      </div>);

  }

  if (notFound || !restaurant) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-3xl mb-3">🍽️</div>
          <h2 className="text-lg font-semibold text-stone-900">Menu not found</h2>
          <p className="text-stone-500 text-sm mt-1">This restaurant link isn't valid or is no longer active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={themeStyle}>
      {/* Header / Hero */}
      <div className="relative overflow-hidden">
        {restaurant?.cover_image_url ?
        <div className="h-52 sm:h-64">
            <img src={restaurant.cover_image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/40 to-transparent" />
          </div> :

        <div className="h-52 sm:h-64 bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 rounded-[40px]" />
        }

        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <div className="flex items-end gap-4">
            {restaurant?.logo_url &&
            <img src={restaurant.logo_url} alt="" className="w-16 h-16 rounded-2xl border-2 border-white shadow-lg object-cover flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white truncate">
                {restaurant?.name || "Our Menu"}
              </h1>
              {restaurant?.description &&
              <p className="text-white/70 text-sm mt-1 line-clamp-2">{restaurant.description}</p>
              }
            </div>
          </div>
          {(restaurant?.address || restaurant?.phone) &&
          <div className="flex flex-wrap gap-3 mt-3">
              {restaurant.address &&
            <span className="flex items-center gap-1 text-white/60 text-xs">
                  <MapPin size={12} /> {restaurant.address}
                </span>
            }
              {restaurant.phone &&
            <span className="flex items-center gap-1 text-white/60 text-xs">
                  <Phone size={12} /> {restaurant.phone}
                </span>
            }
            </div>
          }
        </div>
      </div>

      {/* Sticky search + categories */}
      <div className="sticky top-0 z-30 backdrop-blur-md border-b" style={{ backgroundColor: theme.bg + "f0", borderColor: theme.text + "18" }}>
        <div className="px-4 sm:px-6 pt-3 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the menu..."
              style={{ backgroundColor: theme.card, borderColor: theme.text + "22", color: theme.text }}
              className="pl-9 rounded-xl h-10" />
            
          </div>
        </div>
        {categories.length > 1 &&
        <div className="px-4 sm:px-6 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            <button
            onClick={() => setActiveCategory(null)}
            style={!activeCategory ? { backgroundColor: theme.text, color: theme.bg } : { backgroundColor: theme.card, color: theme.text, border: `1px solid ${theme.text}22` }}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all">
            
              All
            </button>
            {categories.map((cat) =>
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            style={activeCategory === cat.id ? { backgroundColor: theme.text, color: theme.bg } : { backgroundColor: theme.card, color: theme.text, border: `1px solid ${theme.text}22` }}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all">
            
                {cat.name}
              </button>
          )}
          </div>
        }
      </div>

      {/* Featured Section */}
      {!search && !activeCategory && featuredItems.length > 0 &&
      <div className="px-4 sm:px-6 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">Featured</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {featuredItems.map((item) =>
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ backgroundColor: theme.card, borderColor: theme.text + "12" }}
            className="flex-shrink-0 w-44 rounded-2xl overflow-hidden border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedItem(item)}>
            
                {item.image_url ?
            <img src={item.image_url} alt={item.name} className="w-full h-28 object-cover" /> :

            <div className="w-full h-28 bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                    <Star size={24} className="text-amber-300" />
                  </div>
            }
                <div className="p-3">
                  <p className="text-sm font-semibold truncate" style={{ color: theme.text }}>{item.name}</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color: theme.primary }}>{currency}{item.price?.toFixed(2)}</p>
                </div>
              </motion.div>
          )}
          </div>
        </div>
      }

      {/* Menu Items by Category */}
      <div className="px-4 sm:px-6 py-6 space-y-8">
        {groupedByCategory.map((cat, catIdx) =>
        <motion.div
          key={cat.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: catIdx * 0.05 }}>
          
            <h2 className="text-lg font-heading font-bold text-stone-900 mb-1">{cat.name}</h2>
            {cat.description && <p className="text-xs text-stone-500 mb-3">{cat.description}</p>}

            <div className="space-y-3">
              {cat.items.map((item, idx) =>
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              style={{ backgroundColor: theme.card, borderColor: theme.text + "12" }}
              className="rounded-2xl border overflow-hidden flex cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedItem(item)}>
              
                  <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold truncate" style={{ color: theme.text }}>{item.name}</h3>
                        {item.ar_enabled &&
                    <span className="flex items-center gap-0.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            <Sparkles size={8} /> AR
                          </span>
                    }
                      </div>
                      {item.description &&
                  <p className="text-xs mt-1 line-clamp-2 opacity-60" style={{ color: theme.text }}>{item.description}</p>
                  }
                      {item.tags?.length > 0 &&
                  <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.map((tag) =>
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full opacity-70" style={{ backgroundColor: theme.text + "18", color: theme.text }}>{tag}</span>
                    )}
                        </div>
                  }
                    </div>
                    <p className="font-bold text-base mt-2" style={{ color: theme.primary }}>{currency}{item.price?.toFixed(2)}</p>
                  </div>
                  {item.image_url &&
              <div className="w-28 h-28 flex-shrink-0">
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
              }
                </motion.div>
            )}
            </div>
          </motion.div>
        )}

        {uncategorized.length > 0 &&
        <div>
            <h2 className="text-lg font-heading font-bold text-stone-900 mb-3">Other</h2>
            <div className="space-y-3">
              {uncategorized.map((item) =>
            <div
              key={item.id}
              style={{ backgroundColor: theme.card, borderColor: theme.text + "12" }}
              className="rounded-2xl border overflow-hidden flex cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedItem(item)}>
              
                  <div className="flex-1 p-4 min-w-0">
                    <h3 className="text-sm font-semibold truncate" style={{ color: theme.text }}>{item.name}</h3>
                    {item.description && <p className="text-xs mt-1 line-clamp-2 opacity-60" style={{ color: theme.text }}>{item.description}</p>}
                    <p className="font-bold text-base mt-2" style={{ color: theme.primary }}>{currency}{item.price?.toFixed(2)}</p>
                  </div>
                  {item.image_url &&
              <div className="w-28 h-28 flex-shrink-0">
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
              }
                </div>
            )}
            </div>
          </div>
        }

        {filtered.length === 0 &&
        <div className="text-center py-16">
            <Search size={32} className="text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm">No items found</p>
          </div>
        }
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-xs border-t opacity-40" style={{ color: theme.text, borderColor: theme.text + "20" }}>
        Powered by Digital Menu
      </div>

      {/* Item Detail Modal */}
      <AnimatePresence>
        {selectedItem &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setSelectedItem(null)}>
          
            <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            style={{ backgroundColor: theme.card, color: theme.text, fontFamily: theme.font }}
            className="rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            
              {selectedItem.image_url &&
            <div className="relative h-56">
                  <img src={selectedItem.image_url} alt={selectedItem.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
            }
              <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedItem(null)}
              className="absolute top-3 right-3 bg-black/40 text-white rounded-full hover:bg-black/60 w-9 h-9">
              
                <X size={18} />
              </Button>

              <div className="p-6 space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-heading font-bold" style={{ color: theme.text }}>{selectedItem.name}</h2>
                    <span className="text-xl font-bold flex-shrink-0" style={{ color: theme.primary }}>{currency}{selectedItem.price?.toFixed(2)}</span>
                  </div>
                  <p className="text-xs mt-1 opacity-50" style={{ color: theme.text }}>
                    {categories.find((c) => c.id === selectedItem.category_id)?.name}
                  </p>
                </div>

                {selectedItem.description &&
              <p className="text-sm leading-relaxed opacity-70" style={{ color: theme.text }}>{selectedItem.description}</p>
              }

                {selectedItem.tags?.length > 0 &&
              <div className="flex flex-wrap gap-1.5">
                    {selectedItem.tags.map((tag) =>
                <span key={tag} className="text-xs px-2 py-1 rounded-full opacity-70" style={{ backgroundColor: theme.text + "18", color: theme.text }}>{tag}</span>
                )}
                  </div>
              }

                {selectedItem.ingredients &&
              <div className="rounded-xl p-3.5 space-y-1" style={{ backgroundColor: theme.text + "08" }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <UtensilsCrossed size={13} style={{ color: theme.primary }} />
                      <span className="text-xs font-semibold uppercase tracking-wide opacity-60" style={{ color: theme.text }}>Ingredients</span>
                    </div>
                    <p className="text-xs leading-relaxed opacity-70" style={{ color: theme.text }}>{selectedItem.ingredients}</p>
                  </div>
              }

                {selectedItem.allergens?.length > 0 &&
              <div className="rounded-xl p-3.5" style={{ backgroundColor: "#fff7ed" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle size={13} className="text-orange-500" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-orange-700">Allergens</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedItem.allergens.map((a) =>
                  <span key={a} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{a}</span>
                  )}
                    </div>
                  </div>
              }

                <Button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("kistet:add-to-order", { detail: selectedItem }));
                    setSelectedItem(null);
                  }}
                  className="w-full rounded-xl h-12 bg-stone-900 hover:bg-stone-800 text-white"
                >
                  Add to order
                </Button>

                {selectedItem.ar_enabled && selectedItem.model_3d_url &&
              <Button
                onClick={() => {setSelectedItem(null);setArItem(selectedItem);}}
                className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white rounded-xl h-12">
                
                    <Sparkles size={16} className="mr-2" />
                    View in AR
                  </Button>
              }
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* AR Viewer */}
      {arItem &&
      <ARViewer
        item={{ ...arItem, price: `${currency}${arItem.price?.toFixed(2)}` }}
        onClose={() => setArItem(null)} />

      }

      <CustomerOrderingBridge
        restaurantSlug={slug}
        tableNumber={tableNumber}
        items={items}
        currency={currency}
      />
    </div>);

}