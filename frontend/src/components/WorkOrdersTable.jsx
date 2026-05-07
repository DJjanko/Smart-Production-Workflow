import { EmptyState } from "./EmptyState.jsx";
import { StatusBadge } from "./StatusBadge.jsx";
import { formatDate } from "../utils/date.js";

export function WorkOrdersTable({ workOrders }) {
  return (
    <div className="surface workOrders">
      <div className="sectionHeader">
        <h2>Delovni Nalogi</h2>
        <span>{workOrders.length} zadnjih</span>
      </div>
      <div className="table">
        <div className="row head">
          <span>Koda</span>
          <span>Izdelek</span>
          <span>Status</span>
          <span>Rok</span>
        </div>
        {workOrders.map((order) => (
          <div className="row" key={order._id}>
            <strong>{order.code}</strong>
            <span>{order.items?.[0]?.quantity} x {order.items?.[0]?.productName}</span>
            <StatusBadge value={order.status} />
            <span>{formatDate(order.dueDate)}</span>
          </div>
        ))}
        {workOrders.length === 0 && <EmptyState label="Ni delovnih nalogov" />}
      </div>
    </div>
  );
}
