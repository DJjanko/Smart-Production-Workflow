import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { InlineDateTimeMenu, InlineStatusMenu } from "../components/InlineControls.jsx";
import { OrderDetailModal } from "../components/OrderDetailModal.jsx";
import { OrderItemsEditor, normalizeOrderItems } from "../components/OrderItemsEditor.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { formatDate } from "../utils/date.js";
import { label, statusLabel } from "../utils/i18n.js";

const emptyForm = {
  customerName: "",
  items: [],
  requestedDeadline: "",
  status: "confirmed"
};

const emptyItem = { productId: "", quantity: 1 };

function orderToForm(order) {
  return {
    id: order._id,
    customerName: order.customerName,
    items: normalizeOrderItems(order.items),
    requestedDeadline: order.requestedDeadline || "",
    status: order.status
  };
}

export function OrdersPage({ session }) {
  const isAdmin = session.user?.role === "admin";
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [editingItem, setEditingItem] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingOrderItemForm, setEditingOrderItemForm] = useState(emptyItem);
  const [editingOrderItem, setEditingOrderItem] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPageData() {
    const [orderData, productData, workOrderData] = await Promise.all([api.orders(), api.products(), api.workOrders()]);
    setOrders(orderData);
    setProducts(productData);
    setWorkOrders(workOrderData);
    if (!itemForm.productId && productData[0]?._id) {
      setItemForm((current) => ({ ...current, productId: productData[0]._id }));
      setEditingOrderItemForm((current) => ({ ...current, productId: productData[0]._id }));
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
  const selectedOrder = selectedOrderId ? orders.find((order) => order._id === selectedOrderId) : null;

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
          items: form.items
        },
        session.token
      );
      setForm(emptyForm);
      setItemForm({ ...emptyItem, productId: products[0]?._id || "" });
      setEditingItem(null);
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
          status: editingOrder.status,
          items: editingOrder.items
        },
        session.token
      );
      setEditingOrder(null);
      setEditingOrderItem(null);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveOrderField(order, patch) {
    setError("");
    setLoading(true);

    try {
      await api.updateOrder(
        order._id,
        {
          customerName: patch.customerName ?? order.customerName,
          requestedDeadline: patch.requestedDeadline ?? order.requestedDeadline ?? undefined,
          status: patch.status ?? order.status,
          items: normalizeOrderItems(order.items)
        },
        session.token
      );
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
          <h1>{label("orders")}</h1>
          <p>{label("ordersSubtitle")}</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className="surface pageSection noTopMargin">
          <div className="sectionHeader">
            <h2>{label("ordersList")}</h2>
            <div className="sectionActions">
              <span>{filteredOrders.length} / {orders.length}</span>
              {isAdmin && <button type="button" className="primary" onClick={() => setShowCreate(true)}>
                <Plus size={17} />
                {label("add")}
              </button>}
            </div>
          </div>
          {isAdmin && showCreate && (
            <form className="inlineCreatePanel" onSubmit={createOrder}>
              <div className="sectionHeader compact">
                <h2>{label("formNewOrder")}</h2>
                <ClipboardList size={18} />
              </div>
              <label>{label("customer")}<input value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} autoFocus /></label>
              <OrderItemsEditor
                title={label("orderItems")}
                products={products}
                items={form.items}
                setItems={(items) => setForm((current) => ({ ...current, items }))}
                itemForm={itemForm}
                setItemForm={setItemForm}
                editingItem={editingItem}
                setEditingItem={setEditingItem}
                setError={setError}
              />
              <label>{label("deadline")}<input type="datetime-local" value={form.requestedDeadline} onChange={(event) => setForm({ ...form, requestedDeadline: event.target.value })} /></label>
              <label>
                {label("status")}
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="draft">{statusLabel("draft")}</option>
                  <option value="confirmed">{statusLabel("confirmed")}</option>
                  <option value="in_production">{statusLabel("in_production")}</option>
                  <option value="completed">{statusLabel("completed")}</option>
                </select>
              </label>
              <div className="formActions formActionsRight">
                <button type="button" className="iconText" onClick={() => { setShowCreate(false); setForm(emptyForm); setEditingItem(null); }}><X size={17} />{label("cancel")}</button>
                <button className="primary" disabled={loading}><Plus size={17} />{label("add")}</button>
              </div>
            </form>
          )}
          <label className="searchField">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={label("searchOrders")} />
          </label>
          <div className="entityList">
            {filteredOrders.map((order) => {
              const isEditing = editingOrder?.id === order._id;

              return (
                <div
                  className={`entityItem ${isEditing ? "entityEditing" : "productEntity"}`}
                  key={order._id}
                  role={isEditing ? undefined : "button"}
                  tabIndex={isEditing ? undefined : 0}
                  onClick={isEditing ? undefined : () => setSelectedOrderId(order._id)}
                  onKeyDown={isEditing ? undefined : (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedOrderId(order._id);
                    }
                  }}
                >
                  {isAdmin && isEditing ? (
                    <>
                      <div className="inlineProductForm">
                        <label>{label("customer")}<input value={editingOrder.customerName} onChange={(event) => setEditingOrder({ ...editingOrder, customerName: event.target.value })} autoFocus /></label>
                        <OrderItemsEditor
                          title={label("orderItems")}
                          products={products}
                          items={editingOrder.items}
                          setItems={(items) => setEditingOrder((current) => ({ ...current, items }))}
                          itemForm={editingOrderItemForm}
                          setItemForm={setEditingOrderItemForm}
                          editingItem={editingOrderItem}
                          setEditingItem={setEditingOrderItem}
                          setError={setError}
                        />
                      </div>
                      <div className="rowActions inlineProductActions">
                        <button type="button" className="primary" onClick={saveOrderEdit} disabled={loading}><Save size={17} />{label("save")}</button>
                        <button type="button" className="iconText" onClick={() => { setEditingOrder(null); setEditingOrderItem(null); }}><X size={17} />{label("cancel")}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>{order.customerName}</strong>
                        <span>{order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}</span>
                        <p>{label("deadline")}: {formatDate(order.requestedDeadline)}</p>
                      </div>
                      {isAdmin ? (
                        <div className="inlineListControls" onClick={(event) => event.stopPropagation()}>
                          <InlineDateTimeMenu label={label("deadline")} value={order.requestedDeadline} onChange={(requestedDeadline) => saveOrderField(order, { requestedDeadline })} disabled={loading} />
                          <InlineStatusMenu
                            label={label("status")}
                            value={order.status}
                            options={["draft", "confirmed", "in_production", "completed"]}
                            onChange={(status) => saveOrderField(order, { status })}
                            disabled={loading}
                          />
                        </div>
                      ) : <StatusBadge value={order.status} />}
                      {isAdmin && <div className="rowActions">
                        <button className="iconButton" onClick={(event) => { event.stopPropagation(); setEditingOrder(orderToForm(order)); }} aria-label="Uredi narocilo"><Pencil size={17} /></button>
                        <button className="dangerButton" onClick={(event) => { event.stopPropagation(); handleDelete(order._id); }}><Trash2 size={17} /></button>
                      </div>}
                    </>
                  )}
                </div>
              );
            })}
            {filteredOrders.length === 0 && <EmptyState label={label("noResults")} />}
          </div>
      </section>
      <OrderDetailModal
        order={selectedOrder}
        workOrders={workOrders}
        onClose={() => setSelectedOrderId(null)}
      />
    </main>
  );
}
