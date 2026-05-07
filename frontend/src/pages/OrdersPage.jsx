import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Plus, Save, Search, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { formatDate } from "../utils/date.js";

const emptyForm = {
  customerName: "",
  productId: "",
  quantity: 1,
  requestedDeadline: "",
  status: "confirmed"
};

function orderToForm(order) {
  return {
    id: order._id,
    customerName: order.customerName,
    requestedDeadline: "",
    status: order.status
  };
}

export function OrdersPage({ session }) {
  const isAdmin = session.user?.role === "admin";
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPageData() {
    const [orderData, productData] = await Promise.all([api.orders(), api.products()]);
    setOrders(orderData);
    setProducts(productData);
    if (!form.productId && productData[0]?._id) {
      setForm((current) => ({ ...current, productId: productData[0]._id }));
    }
  }

  useEffect(() => {
    loadPageData().catch((err) => setError(err.message));
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) =>
      [
        order.customerName,
        order.status,
        order.items?.map((item) => `${item.quantity} ${item.productName}`).join(" ")
      ].join(" ").toLowerCase().includes(query)
    );
  }, [orders, search]);

  async function createOrder(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.createOrder(
        {
          customerName: form.customerName,
          requestedDeadline: form.requestedDeadline || undefined,
          status: form.status,
          items: [{ productId: form.productId, quantity: Number(form.quantity) || 1 }]
        },
        session.token
      );
      setForm({ ...emptyForm, productId: products[0]?._id || "" });
      setShowCreate(false);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveOrderEdit() {
    setError("");
    setLoading(true);

    try {
      await api.updateOrder(
        editingOrder.id,
        {
          customerName: editingOrder.customerName,
          requestedDeadline: editingOrder.requestedDeadline || undefined,
          status: editingOrder.status
        },
        session.token
      );
      setEditingOrder(null);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    setError("");
    setLoading(true);
    try {
      await api.deleteOrder(id, session.token);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <h1>Narocila</h1>
          <p>Prodajna narocila pred pretvorbo v delovne naloge.</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className="surface pageSection noTopMargin">
          <div className="sectionHeader">
            <h2>Seznam narocil</h2>
            <div className="sectionActions">
              <span>{filteredOrders.length} / {orders.length}</span>
              {isAdmin && <button type="button" className="primary" onClick={() => setShowCreate(true)}>
                <Plus size={17} />
                Dodaj
              </button>}
            </div>
          </div>
          {isAdmin && showCreate && (
            <form className="inlineCreatePanel" onSubmit={createOrder}>
              <div className="sectionHeader compact">
                <h2>Novo narocilo</h2>
                <ClipboardList size={18} />
              </div>
              <label>Kupec<input value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} autoFocus /></label>
              <div className="formRow">
                <label>
                  Izdelek
                  <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}>
                    <option value="">Izberi izdelek</option>
                    {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
                  </select>
                </label>
                <label>Kolicina<input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
              </div>
              <label>Rok<input type="datetime-local" value={form.requestedDeadline} onChange={(event) => setForm({ ...form, requestedDeadline: event.target.value })} /></label>
              <label>
                Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="draft">draft</option>
                  <option value="confirmed">confirmed</option>
                  <option value="in_production">in_production</option>
                  <option value="completed">completed</option>
                </select>
              </label>
              <div className="formActions formActionsRight">
                <button type="button" className="iconText" onClick={() => { setShowCreate(false); setForm({ ...emptyForm, productId: products[0]?._id || "" }); }}><X size={17} />Preklic</button>
                <button className="primary" disabled={loading}><Plus size={17} />Dodaj</button>
              </div>
            </form>
          )}
          <label className="searchField">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Isci narocila" />
          </label>
          <div className="entityList">
            {filteredOrders.map((order) => {
              const isEditing = editingOrder?.id === order._id;

              return (
                <div className={`entityItem ${isEditing ? "entityEditing" : ""}`} key={order._id}>
                  {isAdmin && isEditing ? (
                    <>
                      <div className="inlineProductForm">
                        <label>Kupec<input value={editingOrder.customerName} onChange={(event) => setEditingOrder({ ...editingOrder, customerName: event.target.value })} autoFocus /></label>
                        <label>Rok<input type="datetime-local" value={editingOrder.requestedDeadline} onChange={(event) => setEditingOrder({ ...editingOrder, requestedDeadline: event.target.value })} /></label>
                        <label>
                          Status
                          <select value={editingOrder.status} onChange={(event) => setEditingOrder({ ...editingOrder, status: event.target.value })}>
                            <option value="draft">draft</option>
                            <option value="confirmed">confirmed</option>
                            <option value="in_production">in_production</option>
                            <option value="completed">completed</option>
                          </select>
                        </label>
                      </div>
                      <div className="rowActions inlineProductActions">
                        <button type="button" className="primary" onClick={saveOrderEdit} disabled={loading}><Save size={17} />Shrani</button>
                        <button type="button" className="iconText" onClick={() => setEditingOrder(null)}><X size={17} />Preklic</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>{order.customerName}</strong>
                        <span>{order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}</span>
                        <p>Rok: {formatDate(order.requestedDeadline)}</p>
                      </div>
                      <StatusBadge value={order.status} />
                      {isAdmin && <div className="rowActions">
                        <button className="iconText" onClick={() => setEditingOrder(orderToForm(order))}>Uredi</button>
                        <button className="dangerButton" onClick={() => handleDelete(order._id)}><Trash2 size={17} /></button>
                      </div>}
                    </>
                  )}
                </div>
              );
            })}
            {filteredOrders.length === 0 && <EmptyState label="Ni zadetkov" />}
          </div>
      </section>
    </main>
  );
}
