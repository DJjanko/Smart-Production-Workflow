import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo } from "react";
import { CustomSelect } from "./CustomSelect.jsx";
import { EmptyState } from "./EmptyState.jsx";
import { label } from "../utils/i18n.js";

const emptyItem = { productId: "", quantity: 1 };

export function normalizeOrderItems(items = []) {
  return items.map((item) => ({
    productId: item.productId?._id || item.productId || "",
    quantity: Number(item.quantity) || 1
  }));
}

export function OrderItemsEditor({
  title = "Izdelki",
  products,
  items,
  setItems,
  itemForm,
  setItemForm,
  editingItem,
  setEditingItem,
  setError
}) {
  const productById = useMemo(() => new Map(products.map((product) => [product._id, product])), [products]);
  const selectProductLabel = label("selectProduct");
  const productOptions = useMemo(
    () => [{ value: "", label: selectProductLabel }, ...products.map((product) => ({ value: product._id, label: product.name }))],
    [products, selectProductLabel]
  );

  function addItem() {
    if (!itemForm.productId) {
      setError("Izberi izdelek.");
      return;
    }

    setError("");
    setItems([...items, { productId: itemForm.productId, quantity: Number(itemForm.quantity) || 1 }]);
    setItemForm({ ...emptyItem, productId: products[0]?._id || "" });
  }

  function saveItemEdit() {
    if (!editingItem.productId) {
      setError("Izberi izdelek.");
      return;
    }

    const nextItems = [...items];
    nextItems[editingItem.index] = { productId: editingItem.productId, quantity: Number(editingItem.quantity) || 1 };
    setError("");
    setItems(nextItems);
    setEditingItem(null);
  }

  function deleteItem(index) {
    setItems(items.filter((_item, itemIndex) => itemIndex !== index));
    if (editingItem?.index === index) setEditingItem(null);
  }

  return (
    <div className="phaseBuilder">
      <div className="sectionHeader compact">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      <div className="phaseFormGrid">
        <CustomSelect
          label={label("product")}
          value={itemForm.productId}
          options={productOptions}
          onChange={(productId) => setItemForm({ ...itemForm, productId })}
        />
        <label>{label("quantity")}<input type="number" min="1" value={itemForm.quantity} onChange={(event) => setItemForm({ ...itemForm, quantity: event.target.value })} /></label>
      </div>
      <div className="formActions">
        <button type="button" className="iconText" onClick={addItem}>
          <Plus size={17} />
          {label("addProduct")}
        </button>
      </div>
      <div className="phaseObjectList">
        {items.map((item, index) => {
          const product = productById.get(item.productId);
          const isEditing = editingItem?.index === index;

          return (
            <div className={`phaseObject ${isEditing ? "phaseObjectEditing" : ""}`} key={`${item.productId}-${index}`}>
              {isEditing ? (
                <>
                  <div className="phaseFormGrid inlinePhaseForm">
                    <CustomSelect
                      label={label("product")}
                      value={editingItem.productId}
                      options={productOptions}
                      onChange={(productId) => setEditingItem({ ...editingItem, productId })}
                    />
                    <label>{label("quantity")}<input type="number" min="1" value={editingItem.quantity} onChange={(event) => setEditingItem({ ...editingItem, quantity: event.target.value })} /></label>
                  </div>
                  <div className="rowActions inlinePhaseActions">
                    <button type="button" className="primary" onClick={saveItemEdit}><Save size={17} />{label("save")}</button>
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
                      aria-label="Uredi izdelek"
                    >
                      <Pencil size={16} />
                    </button>
                    <button type="button" className="dangerButton" onClick={() => deleteItem(index)} aria-label="Izbrisi izdelek">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {items.length === 0 && <EmptyState label={label("addProduct")} />}
      </div>
    </div>
  );
}
