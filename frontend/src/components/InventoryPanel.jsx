export function InventoryPanel({ inventory }) {
  return (
    <div className="surface inventory">
      <div className="sectionHeader">
        <h2>Zaloga</h2>
        <span>{inventory.length} delov</span>
      </div>
      <div className="inventoryList">
        {inventory.map((item) => (
          <div className="inventoryItem" key={item._id}>
            <div>
              <strong>{item.partId?.name}</strong>
              <span>{item.partId?.sku} · {item.location}</span>
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
