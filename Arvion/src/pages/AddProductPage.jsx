import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function AddProductPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    category: "",
    image: null
  });
  const navigate = useNavigate();

  useEffect(() => {
    getMyStore();
  }, []);

  const getMyStore = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate("/login");

    const { data, error } = await supabase
     .from("stores")
     .select("*")
     .eq("owner_id", user.id)
     .single();

    if (error ||!data) {
      alert("You need to create a store first");
      return navigate("/create-store");
    }
    setStore(data);
  };

  const handleChange = (e) => {
    if (e.target.name === "image") {
      setForm({...form, image: e.target.files[0] });
    } else {
      setForm({...form, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let imagePath = null;

      // Upload image if exists
      if (form.image) {
        const fileName = `${user.id}/${Date.now()}-${form.image.name}`;
        const { error: uploadError } = await supabase.storage
         .from("product-images")
         .upload(fileName, form.image);

        if (uploadError) throw uploadError;
        imagePath = fileName;
      }

      // Insert product
      const { error } = await supabase.from("products").insert({
        store_id: store.id,
        owner_id: user.id,
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        stock: parseInt(form.stock) || 0,
        category: form.category,
        image_path: imagePath,
      });

      if (error) throw error;

      alert("Product posted successfully!");
      navigate(`/store/${store.id}`);

    } catch (err) {
      console.error(err);
      alert("Failed to post: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!store) return <div className="p-6">Loading your store...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow mt-6">
      <h1 className="text-2xl font-bold mb-2">Add New Product</h1>
      <p className="text-gray-500 mb-6">Store: {store.business_name}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Product Name *</label>
          <input name="name" required value={form.name} onChange={handleChange}
            className="w-full border rounded p-2 mt-1" placeholder="e.g. iPhone 15 Pro" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Price (₦) *</label>
            <input name="price" type="number" step="0.01" required value={form.price} onChange={handleChange}
              className="w-full border rounded p-2 mt-1" placeholder="500000" />
          </div>
          <div>
            <label className="block text-sm font-medium">Stock Quantity *</label>
            <input name="stock" type="number" required value={form.stock} onChange={handleChange}
              className="w-full border rounded p-2 mt-1" placeholder="10" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Category</label>
          <select name="category" value={form.category} onChange={handleChange}
            className="w-full border rounded p-2 mt-1">
            <option value="">Select category</option>
            <option value="Electronics">Electronics</option>
            <option value="Fashion">Fashion</option>
            <option value="Food">Food</option>
            <option value="Home">Home & Living</option>
            <option value="Beauty">Beauty</option>
            <option value="Services">Services</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange}
            rows="4" className="w-full border rounded p-2 mt-1" placeholder="Describe your product..." />
        </div>

        <div>
          <label className="block text-sm font-medium">Product Image</label>
          <input name="image" type="file" accept="image/*" onChange={handleChange}
            className="w-full border rounded p-2 mt-1" />
        </div>

        <button disabled={loading}
          className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50">
          {loading? "Posting..." : "Post Product"}
        </button>
      </form>
    </div>
  );
}