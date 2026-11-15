import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Loader2 } from "lucide-react";

export default function MenuItemForm({ item, categories, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: item?.name || "",
    description: item?.description || "",
    price: item?.price || "",
    category_id: item?.category_id || "",
    is_available: item?.is_available !== false,
    is_featured: item?.is_featured || false,
    ar_enabled: item?.ar_enabled || false,
    tags: item?.tags?.join(", ") || "",
    image_url: item?.image_url || "",
    model_3d_url: item?.model_3d_url || "",
    sort_order: item?.sort_order || 0,
    ingredients: item?.ingredients || "",
    allergens: item?.allergens?.join(", ") || "",
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    setUploadError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, fieldName: "image" });
      setForm(f => ({ ...f, image_url: file_url }));
    } catch (error) {
      setUploadError(error.message || 'Image upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // .glb files are what make real AR placement work — this replaces the
  // old "AR Preview Image" (a flat photo), which only ever simulated AR.
  const handleModelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingModel(true);
    setUploadError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, fieldName: "model3d" });
      setForm(f => ({ ...f, model_3d_url: file_url, ar_enabled: true }));
    } catch (error) {
      setUploadError(error.message || '3D model upload failed');
    } finally {
      setUploadingModel(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      price: parseFloat(form.price) || 0,
      sort_order: parseInt(form.sort_order) || 0,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      allergens: form.allergens ? form.allergens.split(",").map(t => t.trim()).filter(Boolean) : [],
    };
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Item Name *</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label>Price *</Label>
          <Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category *</Label>
          <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tags (comma separated)</Label>
          <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="spicy, vegan, gluten-free" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Ingredients</Label>
        <Textarea value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))} rows={2} placeholder="e.g. flour, eggs, butter, sugar, vanilla extract" />
      </div>

      <div className="space-y-2">
        <Label>Allergens (comma separated)</Label>
        <Input value={form.allergens} onChange={e => setForm(f => ({ ...f, allergens: e.target.value }))} placeholder="e.g. gluten, eggs, dairy, nuts" />
      </div>

      <div className="space-y-2">
        <Label>Item Photo</Label>
        <div className="flex items-center gap-4">
          {form.image_url && (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
              <img src={form.image_url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setForm(f => ({ ...f, image_url: "" }))} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                <X size={12} />
              </button>
            </div>
          )}
          <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-stone-300 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors text-sm text-stone-600">
            <Upload size={16} /> {uploadingPhoto ? "Uploading..." : "Upload Photo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label>3D Model for AR (.glb file)</Label>
        <p className="text-xs text-stone-500">
          This is what makes real AR work — customers can place this 3D model on their actual table.
          Get one by scanning the dish with an iPhone (LiDAR), or generating one from a photo with an AI 3D tool.
        </p>
        <div className="flex items-center gap-4">
          {form.model_3d_url && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              ✓ Model uploaded
              <button type="button" onClick={() => setForm(f => ({ ...f, model_3d_url: "", ar_enabled: false }))} className="text-green-900">
                <X size={12} />
              </button>
            </div>
          )}
          <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-stone-300 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors text-sm text-stone-600">
            <Upload size={16} /> {uploadingModel ? "Uploading..." : "Upload .glb Model"}
            <input type="file" accept=".glb" className="hidden" onChange={handleModelUpload} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 pt-2">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_available} onCheckedChange={v => setForm(f => ({ ...f, is_available: v }))} />
          <Label className="text-sm">Available</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.is_featured} onCheckedChange={v => setForm(f => ({ ...f, is_featured: v }))} />
          <Label className="text-sm">Featured</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.ar_enabled} disabled={!form.model_3d_url} onCheckedChange={v => setForm(f => ({ ...f, ar_enabled: v }))} />
          <Label className="text-sm">AR Enabled {!form.model_3d_url && <span className="text-stone-400">(upload a model first)</span>}</Label>
        </div>
      </div>

      {uploadError && <p role="alert" className="text-sm text-red-600">{uploadError}</p>}

      <div className="flex gap-3 pt-4 border-t">
        <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700">
          {saving && <Loader2 size={16} className="animate-spin mr-2" />}
          {item ? "Update Item" : "Add Item"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}