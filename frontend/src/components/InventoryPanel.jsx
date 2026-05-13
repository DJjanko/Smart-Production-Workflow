import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { label } from "../utils/i18n.js";

export function InventoryPanel({ inventory }) {
  const [search, setSearch] = useState("");
  const filteredInventory = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return inventory;
    return inventory.filter((item) =>
      [
        item.productId?.name,
        item.location,
        item.availableQuantity,
        item.reservedQuantity
      ].join(" ").toLowerCase().includes(query)
    );
  }, [inventory, search]);

  return (
    <div className="surface inventory">
      <div className="sectionHeader">
        <h2>{label("productInventory")}</h2>
        <span>{filteredInventory.length} / {inventory.length} {label("countProducts")}</span>
      </div>
      <label className="searchField compactSearch">
        <Search size={17} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={label("searchProducts")} />
      </label>
      <div className="inventoryList">
        {filteredInventory.map((item) => (
          <div className="inventoryItem" key={item._id}>
            <div>
              <strong>{item.productId?.name}</strong>
              <span>{item.location} / {label("finalProducts")}</span>
            </div>
            <div className="stockNumbers">
              <b>{item.availableQuantity}</b>
              <span>rez. {item.reservedQuantity}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
