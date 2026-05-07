import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, PackagePlus, PackageX, Plus, Save, Search, Send, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";

const emptyPart = { name: "", sku: "", unit: "kos", minStock: 0 };
const emptyStock = { availableQuantity: 0, reservedQuantity: 0, location: "MAIN" };
const emptyAlert = { partId: "", message: "" };

function partToForm(part) {
  return { id: part._id, name: part.name, sku: part.sku, unit: part.unit, minStock: part.minStock };
}

function inventoryToForm(row, partId) {
  return {
    id: row?._id || null,
    partId,
    availableQuantity: row?.availableQuantity || 0,
    reservedQuantity: row?.reservedQuantity || 0,
    location: row?.location || "MAIN"
  };
}

export function PartsInventoryPage({ session, highlightLowStock }) {
  const isAdmin = session.user?.role === "admin";
  const [parts, setParts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [alertForm, setAlertForm] = useState(emptyAlert);
  const [partForm, setPartForm] = useState(emptyPart);
  const [editingPart, setEditingPart] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [showCreatePart, setShowCreatePart] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPageData() {
    const [partData, inventoryData] = await Promise.all([api.parts(), api.inventory()]);
    setParts(partData);
    setInventory(inventoryData);
  }

  useEffect(() => {
    loadPageData().catch((err) => setError(err.message));
  }, []);

  const filteredParts = useMemo(() => {
    const query = partSearch.trim().toLowerCase();
    if (!query) return parts;
    return parts.filter((part) => [part.name, part.sku, part.unit, part.minStock].join(" ").toLowerCase().includes(query));
  }, [parts, partSearch]);

  async function createPart(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.createPart({ ...partForm, minStock: Number(partForm.minStock) || 0 }, session.token);
      setPartForm(emptyPart);
      setShowCreatePart(false);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function savePartEdit() {
    setError("");
    setLoading(true);

    try {
      await api.updatePart(editingPart.id, { ...editingPart, minStock: Number(editingPart.minStock) || 0 }, session.token);
      setEditingPart(null);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveStockEdit() {
    setError("");
    setLoading(true);

    try {
      const payload = {
        partId: editingStock.partId,
        availableQuantity: Number(editingStock.availableQuantity) || 0,
        reservedQuantity: Number(editingStock.reservedQuantity) || 0,
        location: editingStock.location || "MAIN"
      };

      if (editingStock.id) {
        await api.updateInventory(editingStock.id, payload, session.token);
      } else {
        await api.createInventory(payload, session.token);
      }

      setEditingStock(null);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deletePart(id) {
    setError("");
    setLoading(true);
    try {
      await api.deletePart(id, session.token);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteStock(id) {
    setError("");
    setLoading(true);
    try {
      await api.deleteInventory(id, session.token);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendSupplyAlert(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.createSupplyAlert(alertForm, session.token);
      setAlertForm(emptyAlert);
      setMessage("Opozorilo je poslano adminu.");
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
          <h1>Zaloga</h1>
          <p>Sifrant delov in stanje skladisca.</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}
      {message && <div className="alert successAlert"><Send size={18} />{message}</div>}

      <section className="surface pageSection noTopMargin">
            <div className="sectionHeader">
              <h2>Deli</h2>
              <div className="sectionActions">
                <span>{filteredParts.length} / {parts.length}</span>
                {isAdmin && (
                <button type="button" className="primary" onClick={() => setShowCreatePart(true)}>
                  <Plus size={17} />
                  Dodaj
                </button>
                )}
              </div>
            </div>
            {!isAdmin && (
              <form className="inlineCreatePanel" onSubmit={sendSupplyAlert}>
                <div className="sectionHeader compact"><h2>Opozori admina</h2><PackageX size={18} /></div>
                <label>
                  Del
                  <select value={alertForm.partId} onChange={(event) => setAlertForm({ ...alertForm, partId: event.target.value })}>
                    <option value="">Izberi del</option>
                    {parts.map((part) => <option key={part._id} value={part._id}>{part.name} ({part.sku})</option>)}
                  </select>
                </label>
                <label>Sporocilo<textarea rows={3} value={alertForm.message} onChange={(event) => setAlertForm({ ...alertForm, message: event.target.value })} placeholder="Npr. Pri montazi zmanjkuje DIN letev." /></label>
                <div className="formActions formActionsRight">
                  <button className="primary" disabled={loading}><Send size={17} />Poslji opozorilo</button>
                </div>
              </form>
            )}
            {isAdmin && showCreatePart && (
              <form className="inlineCreatePanel" onSubmit={createPart}>
                <div className="sectionHeader compact"><h2>Nov del</h2><PackagePlus size={18} /></div>
                <label>Naziv<input value={partForm.name} onChange={(event) => setPartForm({ ...partForm, name: event.target.value })} autoFocus /></label>
                <label>SKU<input value={partForm.sku} onChange={(event) => setPartForm({ ...partForm, sku: event.target.value })} /></label>
                <div className="formRow">
                  <label>Enota<input value={partForm.unit} onChange={(event) => setPartForm({ ...partForm, unit: event.target.value })} /></label>
                  <label>Min. zaloga<input type="number" value={partForm.minStock} onChange={(event) => setPartForm({ ...partForm, minStock: event.target.value })} /></label>
                </div>
                <div className="formActions formActionsRight">
                  <button type="button" className="iconText" onClick={() => { setShowCreatePart(false); setPartForm(emptyPart); }}><X size={17} />Preklic</button>
                  <button className="primary" disabled={loading}><Plus size={17} />Dodaj del</button>
                </div>
              </form>
            )}
            <label className="searchField">
              <Search size={17} />
              <input value={partSearch} onChange={(event) => setPartSearch(event.target.value)} placeholder="Isci dele" />
            </label>
            <div className="entityList">
              {filteredParts.map((part) => {
                const isEditing = editingPart?.id === part._id;
                const stock = inventory.find((row) => String(row.partId?._id) === String(part._id));
                const isStockEditing = editingStock?.partId === part._id;
                const isLowStock = Number(stock?.availableQuantity || 0) < Number(part.minStock || 0);
                return (
                  <div className={`entityItem stockEntity ${(isEditing || isStockEditing) ? "entityEditing" : ""} ${highlightLowStock && isLowStock ? "lowStockItem" : ""}`} key={part._id}>
                    {isAdmin && isEditing ? (
                      <>
                        <div className="inlineProductForm">
                          <label>Naziv<input value={editingPart.name} onChange={(event) => setEditingPart({ ...editingPart, name: event.target.value })} autoFocus /></label>
                          <label>SKU<input value={editingPart.sku} onChange={(event) => setEditingPart({ ...editingPart, sku: event.target.value })} /></label>
                          <div className="formRow">
                            <label>Enota<input value={editingPart.unit} onChange={(event) => setEditingPart({ ...editingPart, unit: event.target.value })} /></label>
                            <label>Min. zaloga<input type="number" value={editingPart.minStock} onChange={(event) => setEditingPart({ ...editingPart, minStock: event.target.value })} /></label>
                          </div>
                        </div>
                        <div className="rowActions inlineProductActions">
                          <button type="button" className="primary" onClick={savePartEdit} disabled={loading}><Save size={17} />Shrani</button>
                          <button type="button" className="iconText" onClick={() => setEditingPart(null)}><X size={17} />Preklic</button>
                        </div>
                      </>
                    ) : isAdmin && isStockEditing ? (
                      <>
                        <div className="inlineProductForm">
                          <div>
                            <strong>{part.name}</strong>
                            <span>{part.sku} / min {part.minStock} {part.unit}</span>
                          </div>
                          <div className="formRow">
                            <label>Na voljo<input type="number" value={editingStock.availableQuantity} onChange={(event) => setEditingStock({ ...editingStock, availableQuantity: event.target.value })} autoFocus /></label>
                            <label>Rezervirano<input type="number" value={editingStock.reservedQuantity} onChange={(event) => setEditingStock({ ...editingStock, reservedQuantity: event.target.value })} /></label>
                          </div>
                          <label>Lokacija<input value={editingStock.location} onChange={(event) => setEditingStock({ ...editingStock, location: event.target.value })} /></label>
                        </div>
                        <div className="rowActions inlineProductActions">
                          <button type="button" className="primary" onClick={saveStockEdit} disabled={loading}><Save size={17} />Shrani stanje</button>
                          <button type="button" className="iconText" onClick={() => setEditingStock(null)}><X size={17} />Preklic</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <strong>{part.name}</strong>
                          <span>{part.sku} / min {part.minStock} {part.unit}</span>
                          {stock ? <p>{stock.location} / na voljo {stock.availableQuantity}, rez. {stock.reservedQuantity}</p> : <p>Stanje se ni dodano</p>}
                        </div>
                        <div className="stockNumbers">
                          <b>{stock?.availableQuantity ?? "-"}</b>
                          <span>rez. {stock?.reservedQuantity ?? "-"}</span>
                        </div>
                        {isAdmin && <div className="rowActions">
                          <button className="iconText" onClick={() => setEditingPart(partToForm(part))}>Uredi del</button>
                          <button className="iconText" onClick={() => setEditingStock(inventoryToForm(stock, part._id))}>{stock ? "Uredi stanje" : "Dodaj stanje"}</button>
                          <button className="dangerButton" onClick={() => deletePart(part._id)}><Trash2 size={17} /></button>
                          {stock && <button className="dangerButton" onClick={() => deleteStock(stock._id)}><X size={17} /></button>}
                        </div>}
                      </>
                    )}
                  </div>
                );
              })}
              {filteredParts.length === 0 && <EmptyState label="Ni zadetkov" />}
            </div>
      </section>
    </main>
  );
}
