import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ClipboardList, Hammer, Pencil, Play, Plus, Save, Search, Trash2, UserRoundCheck, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { formatDate } from "../utils/date.js";

const emptyManual = { customerName: "", requestedDeadline: "", items: [] };
const emptyItem = { productId: "", quantity: 1 };

function workOrderToForm(order) {
  return {
    id: order._id,
    status: order.status,
    startDate: order.startDate,
    dueDate: "",
    inventoryStatus: order.inventoryStatus
  };
}

function phaseToForm(phase) {
  return {
    id: phase._id,
    name: phase.name,
    requiredSkill: phase.requiredSkill,
    assignedTo: phase.assignedTo?._id || phase.assignedTo || "",
    assignedToName: phase.assignedToName,
    start: phase.start,
    end: phase.end,
    dependsOn: phase.dependsOn,
    status: phase.status
  };
}

function WorkOrderDetailModal({
  order,
  phases,
  employees,
  session,
  isAdmin,
  editingPhase,
  setEditingPhase,
  savePhaseEdit,
  loading,
  onClose
}) {
  if (!order) return null;

  const orderPhases = phases.filter((phase) => String(phase.workOrderId?._id || phase.workOrderId) === String(order._id));
  const customerName = order.orderId?.customerName || "Ni vneseno";
  const description = order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ") || "Brez izdelkov";

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="workOrderDetailTitle" onClick={onClose}>
      <div className="productModal workOrderModal" onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <h2 id="workOrderDetailTitle">{order.code}</h2>
            <span>{customerName} / {order.status}</span>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label="Zapri podrobnosti naloga">
            <X size={18} />
          </button>
        </div>

        <section className="workOrderDetailGrid">
          <div className="detailCard">
            <ClipboardList size={18} />
            <strong>Opis</strong>
            <span>{description}</span>
          </div>
          <div className="detailCard">
            <CalendarDays size={18} />
            <strong>Datum</strong>
            <span>Zacetek: {formatDate(order.startDate)} / rok: {formatDate(order.dueDate)}</span>
          </div>
          <div className="detailCard">
            <UserRoundCheck size={18} />
            <strong>Podjetje</strong>
            <span>{customerName}</span>
          </div>
          <div className="detailCard">
            <Hammer size={18} />
            <strong>Naroceno</strong>
            <span>{description}</span>
          </div>
        </section>

        <section className="detailSection">
          <div className="sectionHeader compact">
            <h3>Faze naloga</h3>
            <span>{orderPhases.length}</span>
          </div>
          <div className="phaseDetailList">
            {orderPhases.map((phase) => {
              const isEditing = editingPhase?.id === phase._id;
              const qualified = employees.filter((employee) => employee.skills?.includes(phase.requiredSkill));
              const others = employees.filter((employee) => !employee.skills?.includes(phase.requiredSkill));
              const orderedEmployees = [...qualified, ...others];

              return (
                <article className={`phaseDetailCard ${isEditing ? "phaseDetailEditing" : ""}`} key={phase._id}>
                  <div className="phaseDetailHeader">
                    <div>
                      <strong>{phase.name}</strong>
                      <span>{phase.requiredSkill} / {formatDate(phase.start)} - {formatDate(phase.end)}</span>
                    </div>
                    <StatusBadge value={phase.status} />
                  </div>
                  {isEditing ? (
                    <>
                      <div className="phaseFormGrid">
                        <label>
                          Status
                          <select value={editingPhase.status} onChange={(event) => setEditingPhase({ ...editingPhase, status: event.target.value })}>
                            <option value="planned">planned</option>
                            <option value="in_progress">in_progress</option>
                            <option value="completed">completed</option>
                          </select>
                        </label>
                      </div>
                      {isAdmin && <div className="assigneeGrid">
                        {orderedEmployees.map((employee) => {
                          const hasSkill = employee.skills?.includes(phase.requiredSkill);
                          const isSelected = String(editingPhase.assignedTo || "") === String(employee._id);

                          return (
                            <button
                              type="button"
                              className={`assigneeOption ${hasSkill ? "skillMatch" : "skillWeak"} ${isSelected ? "selected" : ""}`}
                              key={employee._id}
                              onClick={() => setEditingPhase({ ...editingPhase, assignedTo: employee._id, assignedToName: employee.name })}
                            >
                              <strong>{employee.name}</strong>
                              <span>{employee.skills?.join(", ") || "brez znanj"}</span>
                            </button>
                          );
                        })}
                      </div>}
                      <div className="rowActions inlinePhaseActions">
                        <button type="button" className="primary" onClick={savePhaseEdit} disabled={loading}><Save size={17} />Shrani fazo</button>
                        <button type="button" className="iconText" onClick={() => setEditingPhase(null)}><X size={17} />Preklic</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Dodeljeno: {phase.assignedToName || "nedodeljeno"}</p>
                      {(isAdmin || phase.assignedToName === session.user?.name) && <div className="rowActions inlinePhaseActions">
                        <button type="button" className="iconText" onClick={() => setEditingPhase(phaseToForm(phase))}>Uredi fazo</button>
                      </div>}
                    </>
                  )}
                </article>
              );
            })}
            {orderPhases.length === 0 && <EmptyState label="Ta nalog nima faz" />}
          </div>
        </section>
      </div>
    </div>
  );
}

export function WorkOrdersPage({ session }) {
  const isAdmin = session.user?.role === "admin";
  const [workOrders, setWorkOrders] = useState([]);
  const [phases, setPhases] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [manual, setManual] = useState(emptyManual);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [editingItem, setEditingItem] = useState(null);
  const [editingWorkOrder, setEditingWorkOrder] = useState(null);
  const [editingPhase, setEditingPhase] = useState(null);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(null);
  const [workOrderSearch, setWorkOrderSearch] = useState("");
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
    }
  }

  useEffect(() => {
    loadPageData().catch((err) => setError(err.message));
  }, []);

  const filteredWorkOrders = useMemo(() => {
    const query = workOrderSearch.trim().toLowerCase();
    if (!query) return workOrders;

    return workOrders.filter((order) =>
      [
        order.code,
        order.status,
        order.inventoryStatus,
        order.items?.map((item) => `${item.quantity} ${item.productName}`).join(" ")
      ].join(" ").toLowerCase().includes(query)
    );
  }, [workOrders, workOrderSearch]);

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
        throw new Error("Dodaj vsaj en izdelek v delovni nalog.");
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
          inventoryStatus: editingWorkOrder.inventoryStatus
        },
        session.token
      );
      setEditingWorkOrder(null);
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
          <h1>Delovni nalogi</h1>
          <p>Rocni zagon proizvodnega toka in status faz.</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className={isAdmin ? "crudGrid" : "surface pageSection noTopMargin"}>
        {isAdmin && (
        <form className="surface formPanel" onSubmit={createManual}>
          <div className="sectionHeader">
            <h2>Nov delovni nalog</h2>
            <Hammer size={18} />
          </div>
          <label>Kupec<input value={manual.customerName} onChange={(event) => setManual({ ...manual, customerName: event.target.value })} /></label>
          <div className="formRow">
            <label>Rok<input type="datetime-local" value={manual.requestedDeadline} onChange={(event) => setManual({ ...manual, requestedDeadline: event.target.value })} /></label>
          </div>
          <div className="phaseBuilder">
            <div className="sectionHeader compact">
              <h2>Izdelki v nalogu</h2>
              <span>{manual.items.length}</span>
            </div>
            <div className="phaseFormGrid">
              <label>
                Izdelek
                <select value={itemForm.productId} onChange={(event) => setItemForm({ ...itemForm, productId: event.target.value })}>
                  <option value="">Izberi izdelek</option>
                  {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
                </select>
              </label>
              <label>Kolicina<input type="number" min="1" value={itemForm.quantity} onChange={(event) => setItemForm({ ...itemForm, quantity: event.target.value })} /></label>
            </div>
            <div className="formActions">
              <button type="button" className="iconText" onClick={addManualItem}>
                <Plus size={17} />
                Dodaj izdelek
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
                            Izdelek
                            <select value={editingItem.productId} onChange={(event) => setEditingItem({ ...editingItem, productId: event.target.value })} autoFocus>
                              <option value="">Izberi izdelek</option>
                              {products.map((candidate) => <option key={candidate._id} value={candidate._id}>{candidate.name}</option>)}
                            </select>
                          </label>
                          <label>Kolicina<input type="number" min="1" value={editingItem.quantity} onChange={(event) => setEditingItem({ ...editingItem, quantity: event.target.value })} /></label>
                        </div>
                        <div className="rowActions inlinePhaseActions">
                          <button type="button" className="primary" onClick={saveManualItemEdit}><Save size={17} />Shrani</button>
                          <button type="button" className="iconText" onClick={() => setEditingItem(null)}><X size={17} />Preklic</button>
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
              {manual.items.length === 0 && <EmptyState label="Dodaj prvi izdelek v nalog" />}
            </div>
          </div>
          <div className="formActions formActionsRight">
            <button className="primary" disabled={loading}><Play size={17} />Ustvari nalog</button>
          </div>
        </form>
        )}

        <div className={isAdmin ? "surface" : ""}>
          <div className="sectionHeader"><h2>Nalogi</h2><span>{filteredWorkOrders.length} / {workOrders.length}</span></div>
          <label className="searchField">
            <Search size={17} />
            <input value={workOrderSearch} onChange={(event) => setWorkOrderSearch(event.target.value)} placeholder="Isci delovne naloge" />
          </label>
          <div className="entityList">
            {filteredWorkOrders.map((order) => {
              const isEditing = editingWorkOrder?.id === order._id;

              return (
                <div
                  className={`entityItem ${isEditing ? "entityEditing" : "productEntity"}`}
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
                        <label>
                          Status
                          <select value={editingWorkOrder.status} onChange={(event) => setEditingWorkOrder({ ...editingWorkOrder, status: event.target.value })}>
                            <option value="planned">planned</option>
                            <option value="in_progress">in_progress</option>
                            <option value="completed">completed</option>
                            <option value="delayed">delayed</option>
                          </select>
                        </label>
                        <label>
                          Zaloga
                          <select value={editingWorkOrder.inventoryStatus} onChange={(event) => setEditingWorkOrder({ ...editingWorkOrder, inventoryStatus: event.target.value })}>
                            <option value="available">available</option>
                            <option value="replenished">replenished</option>
                            <option value="missing">missing</option>
                          </select>
                        </label>
                        <label>Nov rok<input type="datetime-local" value={editingWorkOrder.dueDate} onChange={(event) => setEditingWorkOrder({ ...editingWorkOrder, dueDate: event.target.value })} /></label>
                      </div>
                      <div className="rowActions inlineProductActions">
                        <button type="button" className="primary" onClick={saveWorkOrderEdit} disabled={loading}><Save size={17} />Shrani</button>
                        <button type="button" className="iconText" onClick={() => setEditingWorkOrder(null)}><X size={17} />Preklic</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>{order.code}</strong>
                        <span>{order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}</span>
                        <p>Rok: {formatDate(order.dueDate)} / zaloga: {order.inventoryStatus}</p>
                      </div>
                      <StatusBadge value={order.status} />
                      {isAdmin && <div className="rowActions">
                        <button className="iconText" onClick={(event) => { event.stopPropagation(); setEditingWorkOrder(workOrderToForm(order)); }}>Uredi</button>
                        <button className="dangerButton" onClick={(event) => { event.stopPropagation(); deleteWorkOrder(order._id); }}><Trash2 size={17} /></button>
                      </div>}
                    </>
                  )}
                </div>
              );
            })}
            {filteredWorkOrders.length === 0 && <EmptyState label="Ni zadetkov" />}
          </div>
        </div>
      </section>

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
        onClose={() => { setSelectedWorkOrderId(null); setEditingPhase(null); }}
      />
    </main>
  );
}
