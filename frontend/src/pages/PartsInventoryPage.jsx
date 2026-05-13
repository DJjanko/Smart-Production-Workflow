import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, PackagePlus, PackageX, Pencil, Plus, Save, Search, Send, Trash2, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { label } from "../utils/i18n.js";

const emptyPart = { name: "", sku: "", unit: "kos", minStock: 0 };
const emptyStock = { availableQuantity: 0, reservedQuantity: 0, location: "MAIN" };
const emptyProductStock = { availableQuantity: 0, reservedQuantity: 0, location: "FINISHED" };
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

function productInventoryToForm(row, productId) {
  return {
    id: row?._id || null,
    productId,
    availableQuantity: row?.availableQuantity || 0,
    reservedQuantity: row?.reservedQuantity || 0,
    location: row?.location || "FINISHED"
  };
}

export function PartsInventoryPage({ session, highlightLowStock, supplyAlerts = [] }) {
  const isAdmin = session.user?.role === "admin";
  const [products, setProducts] = useState([]);
  const [productInventory, setProductInventory] = useState([]);
  const [parts, setParts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [alertForm, setAlertForm] = useState(emptyAlert);
  const [partForm, setPartForm] = useState(emptyPart);
  const [editingPart, setEditingPart] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [editingProductStock, setEditingProductStock] = useState(null);
  const [showCreatePart, setShowCreatePart] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPageData() {
    const [productData, productInventoryData, partData, inventoryData] = await Promise.all([
      api.products(),
      api.productInventory(),
      api.parts(),
      api.inventory()
    ]);
    setProducts(productData);
    setProductInventory(productInventoryData);
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
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => {
      const stock = productInventory.find((row) => String(row.productId?._id) === String(product._id));
      return [
        product.name,
        stock?.location || "FINISHED",
        stock?.availableQuantity ?? 0,
        stock?.reservedQuantity ?? 0
      ].join(" ").toLowerCase().includes(query);
    });
  }, [products, productInventory, productSearch]);

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

  async function saveProductStockEdit() {
    setError("");
    setLoading(true);

    try {
      const payload = {
        productId: editingProductStock.productId,
        availableQuantity: Number(editingProductStock.availableQuantity) || 0,
        reservedQuantity: Number(editingProductStock.reservedQuantity) || 0,
        location: editingProductStock.location || "FINISHED"
      };

      if (editingProductStock.id) {
        await api.updateProductInventory(editingProductStock.id, payload, session.token);
      } else {
        await api.createProductInventory(payload, session.token);
      }

      setEditingProductStock(null);
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

  async function deleteProductStock(id) {
    setError("");
    setLoading(true);
    try {
      await api.deleteProductInventory(id, session.token);
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
          <h1>{label("inventory")}</h1>
          <p>{label("inventorySubtitle")}</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}
      {message && <div className="alert successAlert"><Send size={18} />{message}</div>}

      <section className="surface pageSection noTopMargin">
        <div className="sectionHeader">
          <h2>{label("productsOnShelf")}</h2>
          <span>{filteredProducts.length} / {products.length} {label("countProducts")}</span>
        </div>
        <label className="searchField compactSearch">
          <Search size={17} />
          <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder={label("searchProducts")} />
        </label>
        <div className="entityList">
          {filteredProducts.map((product) => {
            const stock = productInventory.find((row) => String(row.productId?._id) === String(product._id));
            const isStockEditing = editingProductStock?.productId === product._id;

            return (
              <div className={`entityItem stockEntity ${isStockEditing ? "entityEditing" : ""}`} key={product._id}>
                {isAdmin && isStockEditing ? (
                  <>
                    <div className="inlineProductForm">
                      <div>
                        <strong>{product.name}</strong>
                        <span>Koncni izdelki v skladiscu</span>
                      </div>
                      <div className="formRow">
                        <label>{label("available")}<input type="number" value={editingProductStock.availableQuantity} onChange={(event) => setEditingProductStock({ ...editingProductStock, availableQuantity: event.target.value })} autoFocus /></label>
                        <label>{label("reserved")}<input type="number" value={editingProductStock.reservedQuantity} onChange={(event) => setEditingProductStock({ ...editingProductStock, reservedQuantity: event.target.value })} /></label>
                      </div>
                      <label>{label("location")}<input value={editingProductStock.location} onChange={(event) => setEditingProductStock({ ...editingProductStock, location: event.target.value })} /></label>
                    </div>
                    <div className="rowActions inlineProductActions">
                      <button type="button" className="primary" onClick={saveProductStockEdit} disabled={loading}><Save size={17} />{label("save")}</button>
                      <button type="button" className="iconText" onClick={() => setEditingProductStock(null)}><X size={17} />{label("cancel")}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>{product.name}</strong>
                      <span>{stock?.location || "FINISHED"} / {label("finalProducts")}</span>
                      <p>Na voljo {stock?.availableQuantity ?? 0}, rez. {stock?.reservedQuantity ?? 0}</p>
                    </div>
                    <div className="stockNumbers">
                      <b>{stock?.availableQuantity ?? 0}</b>
                      <span>rez. {stock?.reservedQuantity ?? 0}</span>
                    </div>
                    {isAdmin && <div className="rowActions">
                      <button className={stock ? "iconButton" : "iconText"} onClick={() => setEditingProductStock(productInventoryToForm(stock, product._id))} aria-label={stock ? "Uredi stanje izdelka" : undefined}>{stock ? <Pencil size={17} /> : label("addStock")}</button>
                      {stock && <button className="dangerButton" onClick={() => deleteProductStock(stock._id)}><X size={17} /></button>}
                    </div>}
                  </>
                )}
              </div>
            );
          })}
          {filteredProducts.length === 0 && <EmptyState label={label("noResults")} />}
        </div>
      </section>

      <section className="surface pageSection">
            <div className="sectionHeader">
              <h2>{label("parts")}</h2>
              <div className="sectionActions">
                <span>{filteredParts.length} / {parts.length}</span>
                {isAdmin && (
                <button type="button" className="primary" onClick={() => setShowCreatePart(true)}>
                  <Plus size={17} />
                  {label("add")}
                </button>
                )}
              </div>
            </div>
            {!isAdmin && (
              <form className="inlineCreatePanel" onSubmit={sendSupplyAlert}>
                <div className="sectionHeader compact"><h2>Opozori admina</h2><PackageX size={18} /></div>
                <label>
                  {label("parts")}
                  <select value={alertForm.partId} onChange={(event) => setAlertForm({ ...alertForm, partId: event.target.value })}>
                    <option value="">{label("selectPart")}</option>
                    {parts.map((part) => <option key={part._id} value={part._id}>{part.name} ({part.sku})</option>)}
                  </select>
                </label>
                <label>{label("description")}<textarea rows={3} value={alertForm.message} onChange={(event) => setAlertForm({ ...alertForm, message: event.target.value })} placeholder="Npr. Pri montazi zmanjkuje DIN letev." /></label>
                <div className="formActions formActionsRight">
                  <button className="primary" disabled={loading}><Send size={17} />{label("sendAlert")}</button>
                </div>
              </form>
            )}
            {isAdmin && showCreatePart && (
              <form className="inlineCreatePanel" onSubmit={createPart}>
                <div className="sectionHeader compact"><h2>{label("formNewPart")}</h2><PackagePlus size={18} /></div>
                <label>{label("name")}<input value={partForm.name} onChange={(event) => setPartForm({ ...partForm, name: event.target.value })} autoFocus /></label>
                <label>SKU<input value={partForm.sku} onChange={(event) => setPartForm({ ...partForm, sku: event.target.value })} /></label>
                <div className="formRow">
                  <label>{label("units")}<input value={partForm.unit} onChange={(event) => setPartForm({ ...partForm, unit: event.target.value })} /></label>
                  <label>Min. zaloga<input type="number" value={partForm.minStock} onChange={(event) => setPartForm({ ...partForm, minStock: event.target.value })} /></label>
                </div>
                <div className="formActions formActionsRight">
                  <button type="button" className="iconText" onClick={() => { setShowCreatePart(false); setPartForm(emptyPart); }}><X size={17} />{label("cancel")}</button>
                  <button className="primary" disabled={loading}><Plus size={17} />{label("add")}</button>
                </div>
              </form>
            )}
            <label className="searchField">
              <Search size={17} />
              <input value={partSearch} onChange={(event) => setPartSearch(event.target.value)} placeholder={label("searchParts")} />
            </label>
            <div className="entityList">
              {filteredParts.map((part) => {
                const isEditing = editingPart?.id === part._id;
                const stock = inventory.find((row) => String(row.partId?._id) === String(part._id));
                const isStockEditing = editingStock?.partId === part._id;
                const isLowStock = Number(stock?.availableQuantity || 0) < Number(part.minStock || 0);
                const hasSupplyAlert = supplyAlerts.some((alert) => String(alert.partId?._id || alert.partId) === String(part._id));
                return (
                  <div className={`entityItem stockEntity ${(isEditing || isStockEditing) ? "entityEditing" : ""} ${isLowStock ? "lowStockItem" : ""} ${hasSupplyAlert ? "supplyAlertItem" : ""}`} key={part._id}>
                    {isAdmin && isEditing ? (
                      <>
                        <div className="inlineProductForm">
                          <label>{label("name")}<input value={editingPart.name} onChange={(event) => setEditingPart({ ...editingPart, name: event.target.value })} autoFocus /></label>
                          <label>SKU<input value={editingPart.sku} onChange={(event) => setEditingPart({ ...editingPart, sku: event.target.value })} /></label>
                          <div className="formRow">
                            <label>{label("units")}<input value={editingPart.unit} onChange={(event) => setEditingPart({ ...editingPart, unit: event.target.value })} /></label>
                            <label>Min. zaloga<input type="number" value={editingPart.minStock} onChange={(event) => setEditingPart({ ...editingPart, minStock: event.target.value })} /></label>
                          </div>
                        </div>
                        <div className="rowActions inlineProductActions">
                          <button type="button" className="primary" onClick={savePartEdit} disabled={loading}><Save size={17} />{label("save")}</button>
                          <button type="button" className="iconText" onClick={() => setEditingPart(null)}><X size={17} />{label("cancel")}</button>
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
                            <label>{label("available")}<input type="number" value={editingStock.availableQuantity} onChange={(event) => setEditingStock({ ...editingStock, availableQuantity: event.target.value })} autoFocus /></label>
                            <label>{label("reserved")}<input type="number" value={editingStock.reservedQuantity} onChange={(event) => setEditingStock({ ...editingStock, reservedQuantity: event.target.value })} /></label>
                          </div>
                          <label>{label("location")}<input value={editingStock.location} onChange={(event) => setEditingStock({ ...editingStock, location: event.target.value })} /></label>
                        </div>
                        <div className="rowActions inlineProductActions">
                          <button type="button" className="primary" onClick={saveStockEdit} disabled={loading}><Save size={17} />{label("save")}</button>
                          <button type="button" className="iconText" onClick={() => setEditingStock(null)}><X size={17} />{label("cancel")}</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <strong>{part.name}</strong>
                          <span>{part.sku} / min {part.minStock} {part.unit}</span>
                          {stock ? <p>{stock.location} / na voljo {stock.availableQuantity}, rez. {stock.reservedQuantity}{isLowStock ? " / premalo zaloge" : ""}</p> : <p>Stanje se ni dodano</p>}
                          {hasSupplyAlert && <span className="status supplyAlertBadge">opozorilo</span>}
                        </div>
                        <div className="stockNumbers">
                          <b>{stock?.availableQuantity ?? "-"}</b>
                          <span>rez. {stock?.reservedQuantity ?? "-"}</span>
                        </div>
                        {isAdmin && <div className="rowActions">
                          <button className="iconButton" onClick={() => setEditingPart(partToForm(part))} aria-label="Uredi del"><Pencil size={17} /></button>
                          <button className={stock ? "iconButton" : "iconText"} onClick={() => setEditingStock(inventoryToForm(stock, part._id))} aria-label={stock ? "Uredi stanje" : undefined}>{stock ? <Pencil size={17} /> : label("addStock")}</button>
                          <button className="dangerButton" onClick={() => deletePart(part._id)}><Trash2 size={17} /></button>
                          {stock && <button className="dangerButton" onClick={() => deleteStock(stock._id)}><X size={17} /></button>}
                        </div>}
                      </>
                    )}
                  </div>
                );
              })}
              {filteredParts.length === 0 && <EmptyState label={label("noResults")} />}
            </div>
      </section>
    </main>
  );
}
