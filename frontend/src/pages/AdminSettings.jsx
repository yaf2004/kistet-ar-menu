import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Loader2, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const FONT_OPTIONS = [
  { value: "modern", label: "Modern Sans", style: "font-sans" },
  { value: "serif", label: "Classic Serif", style: "font-serif" },
  { value: "rounded", label: "Friendly Rounded", style: "font-sans" },
  { value: "mono", label: "Contemporary Mono", style: "font-mono" },
];

const FONT_MAP = {
  modern: "'Inter', 'Helvetica Neue', sans-serif",
  serif: "'Playfair Display', 'Georgia', serif",
  rounded: "'Nunito', 'Trebuchet MS', sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
};

export default function AdminSettings() {
  const [form, setForm] = useState({ name: "", description: "", logo_url: "", cover_image_url: "", address: "", phone: "", currency: "$", theme_primary_color: "#d97706", theme_bg_color: "#fafaf9", theme_card_color: "#ffffff", theme_text_color: "#1c1917", theme_font: "modern", theme_dark_mode: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const restaurants = await base44.entities.Restaurant.list();
      if (restaurants.length > 0) {
        const r = restaurants[0];
        setExistingId(r.id);
        setForm({
          name: r.name || "",
          description: r.description || "",
          logo_url: r.logo_url || "",
          cover_image_url: r.cover_image_url || "",
          address: r.address || "",
          phone: r.phone || "",
          currency: r.currency || "$",
          theme_primary_color: r.theme_primary_color || "#d97706",
          theme_bg_color: r.theme_bg_color || "#fafaf9",
          theme_card_color: r.theme_card_color || "#ffffff",
          theme_text_color: r.theme_text_color || "#1c1917",
          theme_font: r.theme_font || "modern",
          theme_dark_mode: r.theme_dark_mode || false,
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleImageUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, fieldName: "image" });
      setForm(f => ({ ...f, [field]: file_url }));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // In normal use this always updates an existing restaurant — restaurants
      // are only ever CREATED by a super_admin from the "All Restaurants" page,
      // which also creates this admin's login at the same time.
      if (existingId) {
        await base44.entities.Restaurant.update(existingId, form);
      } else {
        toast({ title: "No restaurant found", description: "Contact your platform admin.", variant: "destructive" });
        return;
      }
      toast({ title: "Settings saved!" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-stone-900">Restaurant Settings</h1>
        <p className="text-stone-500 text-sm mt-1">Customize your restaurant info displayed on the menu</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-stone-100 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Restaurant Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Currency Symbol</Label>
            <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="$" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="A brief description of your restaurant..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            {form.logo_url && (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border">
                <img src={form.logo_url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setForm(f => ({ ...f, logo_url: "" }))} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                  <X size={10} />
                </button>
              </div>
            )}
            <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-stone-300 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors text-sm text-stone-600">
              <Upload size={16} /> {uploading ? "Uploading..." : "Upload Logo"}
              <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "logo_url")} />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cover Image</Label>
          <div className="flex items-center gap-4">
            {form.cover_image_url && (
              <div className="relative w-32 h-16 rounded-xl overflow-hidden border">
                <img src={form.cover_image_url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setForm(f => ({ ...f, cover_image_url: "" }))} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                  <X size={10} />
                </button>
              </div>
            )}
            <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-stone-300 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors text-sm text-stone-600">
              <Upload size={16} /> {uploading ? "Uploading..." : "Upload Cover"}
              <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "cover_image_url")} />
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-stone-900 mb-0.5">Brand Theme</h3>
            <p className="text-xs text-stone-500">Customize the look of your customer-facing menu</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Primary Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.theme_primary_color} onChange={e => setForm(f => ({ ...f, theme_primary_color: e.target.value }))} className="w-10 h-10 rounded-lg cursor-pointer border border-stone-200 p-0.5" />
                <Input value={form.theme_primary_color} onChange={e => setForm(f => ({ ...f, theme_primary_color: e.target.value }))} className="text-xs h-9 font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Background</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.theme_bg_color} onChange={e => setForm(f => ({ ...f, theme_bg_color: e.target.value }))} className="w-10 h-10 rounded-lg cursor-pointer border border-stone-200 p-0.5" />
                <Input value={form.theme_bg_color} onChange={e => setForm(f => ({ ...f, theme_bg_color: e.target.value }))} className="text-xs h-9 font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Card Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.theme_card_color} onChange={e => setForm(f => ({ ...f, theme_card_color: e.target.value }))} className="w-10 h-10 rounded-lg cursor-pointer border border-stone-200 p-0.5" />
                <Input value={form.theme_card_color} onChange={e => setForm(f => ({ ...f, theme_card_color: e.target.value }))} className="text-xs h-9 font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Text Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.theme_text_color} onChange={e => setForm(f => ({ ...f, theme_text_color: e.target.value }))} className="w-10 h-10 rounded-lg cursor-pointer border border-stone-200 p-0.5" />
                <Input value={form.theme_text_color} onChange={e => setForm(f => ({ ...f, theme_text_color: e.target.value }))} className="text-xs h-9 font-mono" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Font Style</Label>
              <Select value={form.theme_font} onValueChange={v => setForm(f => ({ ...f, theme_font: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className={o.style}>{o.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Preview</Label>
              <div className="h-9 rounded-lg border border-stone-200 flex items-center px-3 text-sm overflow-hidden" style={{ backgroundColor: form.theme_bg_color, color: form.theme_text_color, fontFamily: FONT_MAP[form.theme_font] }}>
                <span style={{ color: form.theme_primary_color, fontWeight: 600 }}>Menu</span>
                <span className="mx-2 opacity-40">·</span>
                <span className="text-xs opacity-70">{form.name || "Restaurant Name"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100">
          <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700">
            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}