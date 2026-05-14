import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Pencil, Play, Plus, Save, Search, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { InlineDateTimeMenu, InlineStatusMenu } from "../components/InlineControls.jsx";
import { OrderDetailModal } from "../components/OrderDetailModal.jsx";
import { OrderItemsEditor, normalizeOrderItems } from "../components/OrderItemsEditor.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { StatusFilterMenu } from "../components/StatusFilterMenu.jsx";
import { formatDate } from "../utils/date.js";
import { label } from "../utils/i18n.js";

const emptyForm = {
  customerName: "",
  items: [],
  requestedDeadline: "",
  status: "draft"
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

export function OrdersPage({ session, dataRefreshKey }) {
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
  const [statusFilter, setStatusFilter] = useState("all");
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
  }, [dataRefreshKey]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) =>
      (statusFilter === "all" || order.status === statusFilter)
      && (!query || [
        order.customerName,
        order.status,
        order.items?.map((item) => `${item.quantity} ${item.productName}`).join(" ")
      ].join(" ").toLowerCase().includes(query))
    );
  }, [orders, search, statusFilter]);
  const selectedOrder = selectedOrderId ? orders.find((order) => order._id === selectedOrderId) : null;

  function getLinkedWorkOrder(order) {
    if (order.workOrderId || order.hasWorkOrder) {
      return workOrders.find((workOrder) => String(workOrder._id) === String(order.workOrderId)) || { code: order.workOrderCode };
    }

    return workOrders.find((workOrder) => String(workOrder.orderId?._id || workOrder.orderId) === String(order._id)) || null;
  }

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

  async function convertToWorkOrder(order) {
    setError("");
    setLoading(true);

    try {
      await api.convertOrderToWorkOrder(order._id, session.token);
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
              <StatusFilterMenu
                value={statusFilter}
                onChange={setStatusFilter}
                statuses={["draft", "confirmed", "in_production", "completed", "sold"]}
                ariaLabel="Filter statusa narocil"
              />
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
                <div className="readonlyStatusField">
                  <StatusBadge value="draft" />
                </div>
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
              const linkedWorkOrder = getLinkedWorkOrder(order);
              const hasWorkOrder = Boolean(linkedWorkOrder);
              const effectiveStatus = hasWorkOrder ? order.status : "draft";

              return (
                <div
                  className={`entityItem status-${effectiveStatus} ${!hasWorkOrder ? "draftOrderItem" : ""} ${isEditing ? "entityEditing" : "productEntity"}`}
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
                        <p>
                          {label("deadline")}: {formatDate(order.requestedDeadline)}
                          {hasWorkOrder && linkedWorkOrder?.code ? ` / ${label("workOrders")}: ${linkedWorkOrder.code}` : ""}
                        </p>
                      </div>
                      {isAdmin ? (
                        <div className="inlineListControls" onClick={(event) => event.stopPropagation()}>
                          <InlineDateTimeMenu label={label("deadline")} value={order.requestedDeadline} onChange={(requestedDeadline) => saveOrderField(order, { requestedDeadline })} disabled={loading} />
                          {hasWorkOrder ? (
                            <InlineStatusMenu
                              label={label("status")}
                              value={effectiveStatus}
                              options={["draft", "confirmed", "in_production", "completed", "sold"]}
                              onChange={(status) => saveOrderField(order, { status })}
                              disabled={loading}
                            />
                          ) : (
                            <div className="inlineControl">
                              <span>{label("status")}</span>
                              <StatusBadge value="draft" />
                            </div>
                          )}
                        </div>
                      ) : <StatusBadge value={effectiveStatus} />}
                      {isAdmin && <div className="rowActions">
                        {!hasWorkOrder && (
                          <button
                            className="iconText convertOrderButton"
                            onClick={(event) => { event.stopPropagation(); convertToWorkOrder(order); }}
                            disabled={loading}
                            aria-label="Ustvari delovni nalog iz narocila"
                          >
                            <Play size={17} />
                            {label("createWorkOrder")}
                          </button>
                        )}
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
