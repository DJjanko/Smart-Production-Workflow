import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Image, Pencil, Plus, PackagePlus, Save, Search, Trash2, Wrench, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";

const emptyForm = {
  id: null,
  name: "",
  description: "",
  requiredParts: [],
  phases: []
};

const emptyRequiredPart = {
  partId: "",
  quantity: 1
};

const emptyPhase = {
  name: "",
  requiredSkill: "",
  durationMinutes: 30,
  dependsOn: ""
};

function productToForm(product) {
  return {
    id: product._id,
    name: product.name,
    description: product.description || "",
    requiredParts: product.requiredParts?.map((item) => ({
      partId: item.partId?._id || item.partId || "",
      quantity: Number(item.quantity) || 1
    })) || [],
    phases: product.phases?.map((phase) => ({
      name: phase.name || "",
      requiredSkill: phase.requiredSkill || "",
      durationMinutes: Number(phase.durationMinutes) || 30,
      dependsOn: phase.dependsOn || []
    })) || []
  };
}

function makeRequiredPartPayload(source) {
  return {
    partId: source.partId,
    quantity: Number(source.quantity) || 1
  };
}

function makePhasePayload(source) {
  return {
    name: source.name.trim(),
    requiredSkill: source.requiredSkill.trim().toLowerCase(),
    durationMinutes: Number(source.durationMinutes) || 30,
    dependsOn: source.dependsOn ? [source.dependsOn] : []
  };
}

function getPhaseParts(product, phase) {
  const name = `${phase.name} ${phase.requiredSkill}`.toLowerCase();
  const requiredParts = product.requiredParts || [];
  const matched = requiredParts.filter((item) => {
    const partName = `${item.partId?.name || ""} ${item.partId?.sku || ""}`.toLowerCase();
    return name.includes("rez") && partName.includes("ploc")
      || name.includes("var") && partName.includes("varil")
      || name.includes("sest") && (partName.includes("vijak") || partName.includes("din") || partName.includes("uvod"))
      || name.includes("elektro") && (partName.includes("din") || partName.includes("uvod"))
      || name.includes("pak") && partName.includes("vijak");
  });

  return matched.length ? matched : requiredParts;
}

function ProductDetailModal({ product, onClose }) {
  if (!product) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="productDetailTitle" onClick={onClose}>
      <div className="productModal" onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <h2 id="productDetailTitle">{product.name}</h2>
            <span>{product.requiredParts?.length || 0} delov / {product.phases?.length || 0} faz</span>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label="Zapri podrobnosti izdelka">
            <X size={18} />
          </button>
        </div>

        <section className="productDetailHero">
          <div className="productImageBox">
            <Image size={34} />
            <span>Slika izdelka</span>
          </div>
          <div className="productDetailIntro">
            <h3>Opis izdelka</h3>
            <p>{product.description || "Opis izdelka se ni vnesen."}</p>
            <div className="drawingBox">
              <ClipboardList size={20} />
              <div>
                <strong>Nacrt / skica</strong>
                <span>Prostor za tehnicno skico, datoteko nacrta ali dodatna proizvodna navodila.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="detailSection">
          <div className="sectionHeader compact">
            <h3>Potrebni deli</h3>
            <span>{product.requiredParts?.length || 0}</span>
          </div>
          <div className="detailGrid">
            {product.requiredParts?.map((item, index) => (
              <div className="detailCard" key={`${item.partId?._id || item.partId}-${index}`}>
                <strong>{item.partId?.name || "Neznan del"}</strong>
                <span>{item.partId?.sku || "-"} / {item.quantity} {item.partId?.unit || "kos"}</span>
                <p>Minimalna zaloga: {item.partId?.minStock ?? "-"}</p>
              </div>
            ))}
            {(product.requiredParts?.length || 0) === 0 && <EmptyState label="Ni vnesenih delov" />}
          </div>
        </section>

        <section className="detailSection">
          <div className="sectionHeader compact">
            <h3>Faze, postopki in navodila</h3>
            <span>{product.phases?.length || 0}</span>
          </div>
          <div className="phaseDetailList">
            {product.phases?.map((phase, index) => {
              const phaseParts = getPhaseParts(product, phase);

              return (
                <article className="phaseDetailCard" key={`${phase.name}-${index}`}>
                  <div className="phaseDetailHeader">
                    <div>
                      <strong>{index + 1}. {phase.name}</strong>
                      <span>{phase.requiredSkill} / {phase.durationMinutes} min</span>
                    </div>
                    {phase.dependsOn?.length > 0 && <span className="status">po: {phase.dependsOn.join(", ")}</span>}
                  </div>
                  <p>Postopek: pripravi delovno mesto, preveri material in izvedi fazo po internem delovnem standardu za znanje "{phase.requiredSkill}".</p>
                  <div className="phaseParts">
                    {phaseParts.map((item, partIndex) => (
                      <span key={`${item.partId?._id || item.partId}-${partIndex}`}>
                        <Wrench size={14} />
                        {item.partId?.name || "Del"} x {item.quantity}
                      </span>
                    ))}
                  </div>
                  <div className="drawingBox compactDrawing">
                    <ClipboardList size={18} />
                    <span>Dodatna navodila, kontrolne tocke ali skica za fazo.</span>
                  </div>
                </article>
              );
            })}
            {(product.phases?.length || 0) === 0 && <EmptyState label="Ni vnesenih faz" />}
          </div>
        </section>
      </div>
    </div>
  );
}

function RequiredPartsEditor({
  parts,
  requiredParts,
  setRequiredParts,
  requiredPartForm,
  setRequiredPartForm,
  editingRequiredPart,
  setEditingRequiredPart,
  setError
}) {
  const partById = useMemo(() => new Map(parts.map((part) => [part._id, part])), [parts]);

  function saveRequiredPart() {
    const requiredPart = makeRequiredPartPayload(requiredPartForm);

    if (!requiredPart.partId) {
      setError("Izberi del izdelka.");
      return;
    }

    setError("");
    setRequiredParts([...requiredParts, requiredPart]);
    setRequiredPartForm(emptyRequiredPart);
  }

  function saveEditedRequiredPart() {
    const requiredPart = makeRequiredPartPayload(editingRequiredPart);

    if (!requiredPart.partId) {
      setError("Izberi del izdelka.");
      return;
    }

    const nextRequiredParts = [...requiredParts];
    nextRequiredParts[editingRequiredPart.index] = requiredPart;
    setError("");
    setRequiredParts(nextRequiredParts);
    setEditingRequiredPart(null);
  }

  function deleteRequiredPart(index) {
    setRequiredParts(requiredParts.filter((_requiredPart, requiredPartIndex) => requiredPartIndex !== index));
    if (editingRequiredPart?.index === index) {
      setEditingRequiredPart(null);
    }
  }

  return (
    <div className="phaseBuilder">
      <div className="sectionHeader compact">
        <h2>Deli na izdelek</h2>
        <span>{requiredParts.length}</span>
      </div>
      <div className="phaseFormGrid">
        <label>
          Del
          <select value={requiredPartForm.partId} onChange={(event) => setRequiredPartForm({ ...requiredPartForm, partId: event.target.value })}>
            <option value="">Izberi del</option>
            {parts.map((part) => <option key={part._id} value={part._id}>{part.name} ({part.sku})</option>)}
          </select>
        </label>
        <label>
          Kolicina
          <input type="number" min="1" value={requiredPartForm.quantity} onChange={(event) => setRequiredPartForm({ ...requiredPartForm, quantity: event.target.value })} />
        </label>
      </div>
      <div className="formActions">
        <button type="button" className="iconText" onClick={saveRequiredPart}>
          <Plus size={17} />
          Dodaj del
        </button>
      </div>
      <div className="phaseObjectList">
        {requiredParts.map((requiredPart, index) => {
          const isEditing = editingRequiredPart?.index === index;
          const part = partById.get(requiredPart.partId);

          return (
            <div className={`phaseObject ${isEditing ? "phaseObjectEditing" : ""}`} key={`${requiredPart.partId}-${index}`}>
              {isEditing ? (
                <>
                  <div className="phaseFormGrid inlinePhaseForm">
                    <label>
                      Del
                      <select value={editingRequiredPart.partId} onChange={(event) => setEditingRequiredPart({ ...editingRequiredPart, partId: event.target.value })} autoFocus>
                        <option value="">Izberi del</option>
                        {parts.map((candidate) => <option key={candidate._id} value={candidate._id}>{candidate.name} ({candidate.sku})</option>)}
                      </select>
                    </label>
                    <label>
                      Kolicina
                      <input type="number" min="1" value={editingRequiredPart.quantity} onChange={(event) => setEditingRequiredPart({ ...editingRequiredPart, quantity: event.target.value })} />
                    </label>
                  </div>
                  <div className="rowActions inlinePhaseActions">
                    <button type="button" className="primary" onClick={saveEditedRequiredPart}>
                      <Save size={17} />
                      Shrani
                    </button>
                    <button type="button" className="iconText" onClick={() => setEditingRequiredPart(null)}>
                      <X size={17} />
                      Preklic
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>{part?.name || "Neznan del"}</strong>
                    <span>{part?.sku || "-"} / {requiredPart.quantity} {part?.unit || "kos"}</span>
                  </div>
                  <div className="rowActions">
                    <button
                      type="button"
                      className="iconButton"
                      onClick={() => setEditingRequiredPart({
                        index,
                        partId: requiredPart.partId,
                        quantity: requiredPart.quantity
                      })}
                      aria-label="Uredi del izdelka"
                    >
                      <Pencil size={16} />
                    </button>
                    <button type="button" className="dangerButton" onClick={() => deleteRequiredPart(index)} aria-label="Izbrisi del izdelka">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {requiredParts.length === 0 && <EmptyState label="Dodaj prvi del izdelka" />}
      </div>
    </div>
  );
}

function PhaseEditor({
  phases,
  setPhases,
  phaseForm,
  setPhaseForm,
  editingPhase,
  setEditingPhase,
  setError
}) {
  function savePhase() {
    const phase = makePhasePayload(phaseForm);

    if (!phase.name || !phase.requiredSkill) {
      setError("Ime faze in zahtevano znanje sta obvezna.");
      return;
    }

    setError("");
    setPhases([...phases, phase]);
    setPhaseForm(emptyPhase);
  }

  function saveEditedPhase() {
    const phase = makePhasePayload(editingPhase);

    if (!phase.name || !phase.requiredSkill) {
      setError("Ime faze in zahtevano znanje sta obvezna.");
      return;
    }

    const nextPhases = [...phases];
    nextPhases[editingPhase.index] = phase;
    setError("");
    setPhases(nextPhases);
    setEditingPhase(null);
  }

  function deletePhase(index) {
    setPhases(phases.filter((_phase, phaseIndex) => phaseIndex !== index));
    if (editingPhase?.index === index) {
      setEditingPhase(null);
    }
  }

  return (
    <div className="phaseBuilder">
      <div className="sectionHeader compact">
        <h2>Faze</h2>
        <span>{phases.length}</span>
      </div>
      <div className="phaseFormGrid">
        <label>
          Ime faze
          <input value={phaseForm.name} onChange={(event) => setPhaseForm({ ...phaseForm, name: event.target.value })} />
        </label>
        <label>
          Znanje
          <input value={phaseForm.requiredSkill} onChange={(event) => setPhaseForm({ ...phaseForm, requiredSkill: event.target.value })} />
        </label>
        <label>
          Trajanje min
          <input type="number" min="1" value={phaseForm.durationMinutes} onChange={(event) => setPhaseForm({ ...phaseForm, durationMinutes: event.target.value })} />
        </label>
        <label>
          Odvisno od
          <select value={phaseForm.dependsOn} onChange={(event) => setPhaseForm({ ...phaseForm, dependsOn: event.target.value })}>
            <option value="">Brez odvisnosti</option>
            {phases.map((phase, index) => <option key={`${phase.name}-${index}`} value={phase.name}>{phase.name}</option>)}
          </select>
        </label>
      </div>
      <div className="formActions">
        <button type="button" className="iconText" onClick={savePhase}>
          <Plus size={17} />
          Dodaj fazo
        </button>
      </div>
      <div className="phaseObjectList">
        {phases.map((phase, index) => {
          const isEditing = editingPhase?.index === index;

          return (
            <div className={`phaseObject ${isEditing ? "phaseObjectEditing" : ""}`} key={`${phase.name}-${index}`}>
              {isEditing ? (
                <>
                  <div className="phaseFormGrid inlinePhaseForm">
                    <label>
                      Ime faze
                      <input value={editingPhase.name} onChange={(event) => setEditingPhase({ ...editingPhase, name: event.target.value })} autoFocus />
                    </label>
                    <label>
                      Znanje
                      <input value={editingPhase.requiredSkill} onChange={(event) => setEditingPhase({ ...editingPhase, requiredSkill: event.target.value })} />
                    </label>
                    <label>
                      Trajanje min
                      <input type="number" min="1" value={editingPhase.durationMinutes} onChange={(event) => setEditingPhase({ ...editingPhase, durationMinutes: event.target.value })} />
                    </label>
                    <label>
                      Odvisno od
                      <select value={editingPhase.dependsOn} onChange={(event) => setEditingPhase({ ...editingPhase, dependsOn: event.target.value })}>
                        <option value="">Brez odvisnosti</option>
                        {phases
                          .filter((_phase, phaseIndex) => phaseIndex !== index)
                          .map((candidate, candidateIndex) => <option key={`${candidate.name}-${candidateIndex}`} value={candidate.name}>{candidate.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="rowActions inlinePhaseActions">
                    <button type="button" className="primary" onClick={saveEditedPhase}>
                      <Save size={17} />
                      Shrani
                    </button>
                    <button type="button" className="iconText" onClick={() => setEditingPhase(null)}>
                      <X size={17} />
                      Preklic
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>{phase.name}</strong>
                    <span>{phase.requiredSkill} / {phase.durationMinutes} min</span>
                    {phase.dependsOn?.length > 0 && <p>Odvisno od: {phase.dependsOn.join(", ")}</p>}
                  </div>
                  <div className="rowActions">
                    <button
                      type="button"
                      className="iconButton"
                      onClick={() => setEditingPhase({
                        index,
                        name: phase.name,
                        requiredSkill: phase.requiredSkill,
                        durationMinutes: phase.durationMinutes,
                        dependsOn: phase.dependsOn?.[0] || ""
                      })}
                      aria-label="Uredi fazo"
                    >
                      <Pencil size={16} />
                    </button>
                    <button type="button" className="dangerButton" onClick={() => deletePhase(index)} aria-label="Izbrisi fazo">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {phases.length === 0 && <EmptyState label="Dodaj prvo fazo izdelave" />}
      </div>
    </div>
  );
}

export function ProductsPage({ session }) {
  const isAdmin = session.user?.role === "admin";
  const [products, setProducts] = useState([]);
  const [parts, setParts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [requiredPartForm, setRequiredPartForm] = useState(emptyRequiredPart);
  const [editingRequiredPart, setEditingRequiredPart] = useState(null);
  const [phaseForm, setPhaseForm] = useState(emptyPhase);
  const [editingPhase, setEditingPhase] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingProductRequiredPartForm, setEditingProductRequiredPartForm] = useState(emptyRequiredPart);
  const [editingProductRequiredPart, setEditingProductRequiredPart] = useState(null);
  const [editingProductPhaseForm, setEditingProductPhaseForm] = useState(emptyPhase);
  const [editingProductPhase, setEditingProductPhase] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPageData() {
    const [productData, partData] = await Promise.all([api.products(), api.parts()]);
    setProducts(productData);
    setParts(partData);
  }

  useEffect(() => {
    loadPageData().catch((err) => setError(err.message));
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) => {
      const searchable = [
        product.name,
        product.description,
        product.requiredParts?.map((item) => `${item.partId?.name || ""} ${item.partId?.sku || ""}`).join(" "),
        product.phases?.map((phase) => `${phase.name} ${phase.requiredSkill}`).join(" ")
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });
  }, [products, search]);

  function resetForm() {
    setForm(emptyForm);
    setRequiredPartForm(emptyRequiredPart);
    setEditingRequiredPart(null);
    setPhaseForm(emptyPhase);
    setEditingPhase(null);
  }

  function startProductEdit(product) {
    setEditingProduct(productToForm(product));
    setEditingProductRequiredPartForm(emptyRequiredPart);
    setEditingProductRequiredPart(null);
    setEditingProductPhaseForm(emptyPhase);
    setEditingProductPhase(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        name: form.name,
        description: form.description,
        requiredParts: form.requiredParts,
        phases: form.phases
      };
      await api.createProduct(payload, session.token);
      resetForm();
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
      await api.deleteProduct(id, session.token);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveProductEdit() {
    setError("");
    setLoading(true);

    try {
      await api.updateProduct(
        editingProduct.id,
        {
          name: editingProduct.name,
          description: editingProduct.description,
          requiredParts: editingProduct.requiredParts,
          phases: editingProduct.phases
        },
        session.token
      );
      setEditingProduct(null);
      setEditingProductRequiredPartForm(emptyRequiredPart);
      setEditingProductRequiredPart(null);
      setEditingProductPhaseForm(emptyPhase);
      setEditingProductPhase(null);
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
          <h1>Izdelki</h1>
          <p>Produktni katalog, sestavni deli in faze izdelave.</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className={isAdmin ? "crudGrid" : "surface pageSection noTopMargin"}>
        {isAdmin && (
        <form className="surface formPanel" onSubmit={handleSubmit}>
          <div className="sectionHeader">
            <h2>Nov izdelek</h2>
            <PackagePlus size={18} />
          </div>
          <label>
            Naziv
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Opis
            <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>

          <RequiredPartsEditor
            parts={parts}
            requiredParts={form.requiredParts}
            setRequiredParts={(requiredParts) => setForm((current) => ({ ...current, requiredParts }))}
            requiredPartForm={requiredPartForm}
            setRequiredPartForm={setRequiredPartForm}
            editingRequiredPart={editingRequiredPart}
            setEditingRequiredPart={setEditingRequiredPart}
            setError={setError}
          />

          <PhaseEditor
            phases={form.phases}
            setPhases={(phases) => setForm((current) => ({ ...current, phases }))}
            phaseForm={phaseForm}
            setPhaseForm={setPhaseForm}
            editingPhase={editingPhase}
            setEditingPhase={setEditingPhase}
            setError={setError}
          />

          <div className="formActions formActionsRight">
            <button className="primary" disabled={loading}><Plus size={17} />Dodaj</button>
          </div>
        </form>
        )}

        <div className={isAdmin ? "surface" : ""}>
          <div className="sectionHeader">
            <h2>Katalog</h2>
            <span>{filteredProducts.length} / {products.length} izdelkov</span>
          </div>
          <label className="searchField">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Isci izdelke"
            />
          </label>
          <div className="entityList">
            {filteredProducts.map((product) => {
              const isEditing = editingProduct?.id === product._id;

              return (
                <div
                  className={`entityItem productEntity ${isEditing ? "productEntityEditing" : ""}`}
                  key={product._id}
                  role={isEditing ? undefined : "button"}
                  tabIndex={isEditing ? undefined : 0}
                  onClick={isEditing ? undefined : () => setSelectedProduct(product)}
                  onKeyDown={isEditing ? undefined : (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedProduct(product);
                    }
                  }}
                >
                  {isEditing ? (
                    <>
                      <div className="inlineProductForm">
                        <label>
                          Naziv
                          <input value={editingProduct.name} onChange={(event) => setEditingProduct({ ...editingProduct, name: event.target.value })} autoFocus />
                        </label>
                        <label>
                          Opis
                          <textarea rows={2} value={editingProduct.description} onChange={(event) => setEditingProduct({ ...editingProduct, description: event.target.value })} />
                        </label>
                        <RequiredPartsEditor
                          parts={parts}
                          requiredParts={editingProduct.requiredParts}
                          setRequiredParts={(requiredParts) => setEditingProduct((current) => ({ ...current, requiredParts }))}
                          requiredPartForm={editingProductRequiredPartForm}
                          setRequiredPartForm={setEditingProductRequiredPartForm}
                          editingRequiredPart={editingProductRequiredPart}
                          setEditingRequiredPart={setEditingProductRequiredPart}
                          setError={setError}
                        />
                        <PhaseEditor
                          phases={editingProduct.phases}
                          setPhases={(phases) => setEditingProduct((current) => ({ ...current, phases }))}
                          phaseForm={editingProductPhaseForm}
                          setPhaseForm={setEditingProductPhaseForm}
                          editingPhase={editingProductPhase}
                          setEditingPhase={setEditingProductPhase}
                          setError={setError}
                        />
                      </div>
                      <div className="rowActions inlineProductActions">
                        <button type="button" className="primary" onClick={saveProductEdit} disabled={loading}>
                          <Save size={17} />
                          Shrani
                        </button>
                        <button type="button" className="iconText" onClick={() => setEditingProduct(null)}>
                          <X size={17} />
                          Preklic
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.requiredParts?.length || 0} delov, {product.phases?.length || 0} faz</span>
                        <p>{product.description}</p>
                      </div>
                      {isAdmin && <div className="rowActions">
                        <button className="iconText" onClick={(event) => { event.stopPropagation(); startProductEdit(product); }}>Uredi</button>
                        <button className="dangerButton" onClick={(event) => { event.stopPropagation(); handleDelete(product._id); }} disabled={loading} aria-label="Izbrisi izdelek">
                          <Trash2 size={17} />
                        </button>
                      </div>}
                    </>
                  )}
                </div>
              );
            })}
            {filteredProducts.length === 0 && <EmptyState label="Ni zadetkov" />}
          </div>
        </div>
      </section>

      <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </main>
  );
}
