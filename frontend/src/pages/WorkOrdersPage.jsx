import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Hammer, Pencil, Play, Plus, Save, Search, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { InlineDateTimeMenu, InlineStatusMenu } from "../components/InlineControls.jsx";
import { OrderItemsEditor, normalizeOrderItems } from "../components/OrderItemsEditor.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { StatusFilterMenu } from "../components/StatusFilterMenu.jsx";
import { WorkOrderDetailModal } from "../components/WorkOrderDetailModal.jsx";
import { WorkOrdersTimeline } from "../components/WorkOrdersTimeline.jsx";
import { formatDate } from "../utils/date.js";
import { label } from "../utils/i18n.js";

const emptyManual = { customerName: "", requestedDeadline: "", items: [] };
const emptyItem = { productId: "", quantity: 1 };

function workOrderToForm(order) {
  return {
    id: order._id,
    customerName: order.orderId?.customerName || "",
    items: normalizeOrderItems(order.items),
    status: order.status,
    startDate: order.startDate,
    dueDate: order.dueDate || "",
    inventoryStatus: order.inventoryStatus
  };
}

export function WorkOrdersPage({ session }) {
  const isAdmin = session.user?.role === "admin";
  const [workOrders, setWorkOrders] = useState([]);
  const [phases, setPhases] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [manual, setManual] = useState(emptyManual);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [showCreateManual, setShowCreateManual] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingWorkOrder, setEditingWorkOrder] = useState(null);
  const [editingWorkOrderItemForm, setEditingWorkOrderItemForm] = useState(emptyItem);
  const [editingWorkOrderItem, setEditingWorkOrderItem] = useState(null);
  const [editingPhase, setEditingPhase] = useState(null);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(null);
  const [workOrderSearch, setWorkOrderSearch] = useState("");
  const [workOrderStatusFilter, setWorkOrderStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPageData() {
    const [workOrderData, phaseData, productData, employeeData] = await Promise.all([
      api.workOrders(),
      api.workOrderPhases(),
      api.products(),
      api.employees()
    ]);
    setWorkOrders(workOrderData);
    setPhases(phaseData);
    setProducts(productData);
    setEmployees(employeeData);
    if (!itemForm.productId && productData[0]?._id) {
      setItemForm((current) => ({ ...current, productId: productData[0]._id }));
      setEditingWorkOrderItemForm((current) => ({ ...current, productId: productData[0]._id }));
    }
  }

  useEffect(() => {
    loadPageData().catch((err) => setError(err.message));
  }, []);

  const filteredWorkOrders = useMemo(() => {
    const query = workOrderSearch.trim().toLowerCase();

    return workOrders.filter((order) =>
      (workOrderStatusFilter === "all" || order.status === workOrderStatusFilter)
      && (!query || [
        order.code,
        order.status,
        order.inventoryStatus,
        order.items?.map((item) => `${item.quantity} ${item.productName}`).join(" ")
      ].join(" ").toLowerCase().includes(query))
    );
  }, [workOrders, workOrderSearch, workOrderStatusFilter]);

  const productById = useMemo(() => new Map(products.map((product) => [product._id, product])), [products]);
  const selectedWorkOrder = selectedWorkOrderId ? workOrders.find((order) => order._id === selectedWorkOrderId) : null;

  function addManualItem() {
    if (!itemForm.productId) {
      setError("Izberi izdelek.");
      return;
    }

    setError("");
    setManual((current) => ({
      ...current,
      items: [...current.items, { productId: itemForm.productId, quantity: Number(itemForm.quantity) || 1 }]
    }));
    setItemForm({ productId: products[0]?._id || "", quantity: 1 });
  }

  function saveManualItemEdit() {
    if (!editingItem.productId) {
      setError("Izberi izdelek.");
      return;
    }

    setManual((current) => {
      const items = [...current.items];
      items[editingItem.index] = { productId: editingItem.productId, quantity: Number(editingItem.quantity) || 1 };
      return { ...current, items };
    });
    setEditingItem(null);
  }

  function deleteManualItem(index) {
    setManual((current) => ({
      ...current,
      items: current.items.filter((_item, itemIndex) => itemIndex !== index)
    }));
    if (editingItem?.index === index) setEditingItem(null);
  }

  async function createManual(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (manual.items.length === 0) {
        throw new Error(label("addProduct"));
      }

      await api.createWorkOrder(
        {
          customerName: manual.customerName,
          items: manual.items,
          requestedDeadline: manual.requestedDeadline || undefined
        },
        session.token
      );
      setManual(emptyManual);
      setItemForm({ productId: products[0]?._id || "", quantity: 1 });
      setEditingItem(null);
      setShowCreateManual(false);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveWorkOrderEdit() {
    setError("");
    setLoading(true);

    try {
      await api.updateWorkOrder(
        editingWorkOrder.id,
        {
          status: editingWorkOrder.status,
          startDate: editingWorkOrder.startDate,
          dueDate: editingWorkOrder.dueDate || undefined,
          inventoryStatus: editingWorkOrder.inventoryStatus,
          customerName: editingWorkOrder.customerName,
          items: editingWorkOrder.items
        },
        session.token
      );
      setEditingWorkOrder(null);
      setEditingWorkOrderItem(null);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveWorkOrderField(order, patch) {
    setError("");
    setLoading(true);

    try {
      await api.updateWorkOrder(
        order._id,
        {
          status: patch.status ?? order.status,
          startDate: order.startDate,
          dueDate: patch.dueDate ?? order.dueDate ?? undefined,
          inventoryStatus: patch.inventoryStatus ?? order.inventoryStatus
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

  async function approvePayment(orderId) {
    setError("");
    setLoading(true);

    try {
      await api.approveWorkOrder(orderId, session.token);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function savePhaseEdit() {
    setError("");
    setLoading(true);

    try {
      await api.updateWorkOrderPhase(editingPhase.id, isAdmin ? editingPhase : { status: editingPhase.status }, session.token);
      setEditingPhase(null);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteWorkOrder(id) {
    setError("");
    setLoading(true);
    try {
      await api.deleteWorkOrder(id, session.token);
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
          <h1>{label("workOrders")}</h1>
          <p>{label("workOrdersSubtitle")}</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className="surface pageSection noTopMargin">
        <div className="sectionHeader">
          <h2>{label("workOrdersList")}</h2>
          <div className="sectionActions">
            <StatusFilterMenu value={workOrderStatusFilter} onChange={setWorkOrderStatusFilter} ariaLabel="Filter statusa delovnih nalogov" />
            <span>{filteredWorkOrders.length} / {workOrders.length}</span>
            {isAdmin && <button type="button" className="primary" onClick={() => setShowCreateManual(true)}><Plus size={17} />{label("add")}</button>}
          </div>
        </div>

        {isAdmin && showCreateManual && (
        <form className="inlineCreatePanel" onSubmit={createManual}>
          <div className="sectionHeader">
            <h2>{label("formNewWorkOrder")}</h2>
            <Hammer size={18} />
          </div>
          <label>{label("customer")}<input value={manual.customerName} onChange={(event) => setManual({ ...manual, customerName: event.target.value })} /></label>
          <div className="formRow">
            <label>{label("deadline")}<input type="datetime-local" value={manual.requestedDeadline} onChange={(event) => setManual({ ...manual, requestedDeadline: event.target.value })} /></label>
          </div>
          <div className="phaseBuilder">
            <div className="sectionHeader compact">
              <h2>{label("orderItems")}</h2>
              <span>{manual.items.length}</span>
            </div>
            <div className="phaseFormGrid">
              <label>
                {label("product")}
                <select value={itemForm.productId} onChange={(event) => setItemForm({ ...itemForm, productId: event.target.value })}>
                  <option value="">{label("selectProduct")}</option>
                  {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
                </select>
              </label>
              <label>{label("quantity")}<input type="number" min="1" value={itemForm.quantity} onChange={(event) => setItemForm({ ...itemForm, quantity: event.target.value })} /></label>
            </div>
            <div className="formActions">
              <button type="button" className="iconText" onClick={addManualItem}>
                <Plus size={17} />
                {label("addProduct")}
              </button>
            </div>
            <div className="phaseObjectList">
              {manual.items.map((item, index) => {
                const product = productById.get(item.productId);
                const isEditing = editingItem?.index === index;

                return (
                  <div className={`phaseObject ${isEditing ? "phaseObjectEditing" : ""}`} key={`${item.productId}-${index}`}>
                    {isEditing ? (
                      <>
                        <div className="phaseFormGrid inlinePhaseForm">
                          <label>
                            {label("product")}
                            <select value={editingItem.productId} onChange={(event) => setEditingItem({ ...editingItem, productId: event.target.value })} autoFocus>
                              <option value="">{label("selectProduct")}</option>
                              {products.map((candidate) => <option key={candidate._id} value={candidate._id}>{candidate.name}</option>)}
                            </select>
                          </label>
                          <label>{label("quantity")}<input type="number" min="1" value={editingItem.quantity} onChange={(event) => setEditingItem({ ...editingItem, quantity: event.target.value })} /></label>
                        </div>
                        <div className="rowActions inlinePhaseActions">
                          <button type="button" className="primary" onClick={saveManualItemEdit}><Save size={17} />{label("save")}</button>
                          <button type="button" className="iconText" onClick={() => setEditingItem(null)}><X size={17} />{label("cancel")}</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <strong>{product?.name || "Neznan izdelek"}</strong>
                          <span>{item.quantity} kos</span>
                        </div>
                        <div className="rowActions">
                          <button
                            type="button"
                            className="iconButton"
                            onClick={() => setEditingItem({ index, productId: item.productId, quantity: item.quantity })}
                            aria-label="Uredi izdelek v nalogu"
                          >
                            <Pencil size={16} />
                          </button>
                          <button type="button" className="dangerButton" onClick={() => deleteManualItem(index)} aria-label="Izbrisi izdelek iz naloga">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {manual.items.length === 0 && <EmptyState label={label("addProduct")} />}
            </div>
          </div>
          <div className="formActions formActionsRight">
            <button type="button" className="iconText" onClick={() => { setShowCreateManual(false); setManual(emptyManual); setEditingItem(null); }}>
              <X size={17} />
              {label("cancel")}
            </button>
            <button className="primary" disabled={loading}><Play size={17} />{label("createWorkOrder")}</button>
          </div>
        </form>
        )}

          <label className="searchField">
            <Search size={17} />
            <input value={workOrderSearch} onChange={(event) => setWorkOrderSearch(event.target.value)} placeholder={label("searchWorkOrders")} />
          </label>
          <div className="entityList">
            {filteredWorkOrders.map((order) => {
              const isEditing = editingWorkOrder?.id === order._id;

              return (
                <div
                  className={`entityItem ${isEditing ? "entityEditing" : "productEntity"} status-${order.status} ${order.status === "completed" && order.fulfillmentStatus === "awaiting_payment" ? "awaitingPayment" : ""}`}
                  key={order._id}
                  role={isEditing ? undefined : "button"}
                  tabIndex={isEditing ? undefined : 0}
                  onClick={isEditing ? undefined : () => setSelectedWorkOrderId(order._id)}
                  onKeyDown={isEditing ? undefined : (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedWorkOrderId(order._id);
                    }
                  }}
                >
                  {isAdmin && isEditing ? (
                    <>
                      <div className="inlineProductForm">
                        <label>{label("customer")}<input value={editingWorkOrder.customerName} onChange={(event) => setEditingWorkOrder({ ...editingWorkOrder, customerName: event.target.value })} autoFocus /></label>
                        <OrderItemsEditor
                          title={label("orderItems")}
                          products={products}
                          items={editingWorkOrder.items}
                          setItems={(items) => setEditingWorkOrder((current) => ({ ...current, items }))}
                          itemForm={editingWorkOrderItemForm}
                          setItemForm={setEditingWorkOrderItemForm}
                          editingItem={editingWorkOrderItem}
                          setEditingItem={setEditingWorkOrderItem}
                          setError={setError}
                        />
                      </div>
                      <div className="rowActions inlineProductActions">
                        <button type="button" className="primary" onClick={saveWorkOrderEdit} disabled={loading}><Save size={17} />{label("save")}</button>
                        <button type="button" className="iconText" onClick={() => { setEditingWorkOrder(null); setEditingWorkOrderItem(null); }}><X size={17} />{label("cancel")}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>{order.code}</strong>
                        <span>{order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}</span>
                        <p>{label("deadline")}: {formatDate(order.dueDate)} / {label("inventory")}: {order.inventoryStatus}</p>
                      </div>
                      {!isAdmin && <StatusBadge value={order.status} />}
                      {isAdmin && <div className="inlineListControls" onClick={(event) => event.stopPropagation()}>
                        <InlineStatusMenu
                          label={label("status")}
                          value={order.status}
                          options={["planned", "in_progress", "completed", "sold", "delayed"]}
                          onChange={(status) => saveWorkOrderField(order, { status })}
                          disabled={loading}
                        />
                        <InlineStatusMenu
                          label={label("inventory")}
                          value={order.inventoryStatus}
                          options={["available", "replenished", "missing"]}
                          onChange={(inventoryStatus) => saveWorkOrderField(order, { inventoryStatus })}
                          disabled={loading}
                        />
                        <InlineDateTimeMenu label={label("deadline")} value={order.dueDate} onChange={(dueDate) => saveWorkOrderField(order, { dueDate })} disabled={loading} />
                      </div>}
                      {isAdmin && <div className="rowActions workOrderRowActions">
                        {order.status === "completed" && order.fulfillmentStatus === "awaiting_payment" && (
                          <button
                            type="button"
                            className="primary approveButton"
                            onClick={(event) => { event.stopPropagation(); approvePayment(order._id); }}
                            disabled={loading}
                          >
                            <CheckCircle2 size={17} />
                            {label("approvePayment")}
                          </button>
                        )}
                        <button className="iconButton workOrderEditButton" onClick={(event) => { event.stopPropagation(); setEditingWorkOrder(workOrderToForm(order)); }} aria-label="Uredi delovni nalog"><Pencil size={17} /></button>
                        <button className="dangerButton" onClick={(event) => { event.stopPropagation(); deleteWorkOrder(order._id); }}><Trash2 size={17} /></button>
                      </div>}
                    </>
                  )}
                </div>
              );
            })}
            {filteredWorkOrders.length === 0 && <EmptyState label={label("noResults")} />}
          </div>
      </section>

      <WorkOrdersTimeline
        workOrders={workOrders}
        onWorkOrderClick={(order) => setSelectedWorkOrderId(order._id)}
      />

      <WorkOrderDetailModal
        order={selectedWorkOrder}
        phases={phases}
        employees={employees}
        session={session}
        isAdmin={isAdmin}
        editingPhase={editingPhase}
        setEditingPhase={setEditingPhase}
        savePhaseEdit={savePhaseEdit}
        loading={loading}
        onApprovePayment={isAdmin ? approvePayment : undefined}
        onClose={() => { setSelectedWorkOrderId(null); setEditingPhase(null); }}
      />
    </main>
  );
}
