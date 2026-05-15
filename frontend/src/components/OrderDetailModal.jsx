import { CalendarDays, ClipboardList, Factory, PackageCheck, UserRoundCheck, X } from "lucide-react";
import { StatusBadge } from "./StatusBadge.jsx";
import { formatDate } from "../utils/date.js";
import { label, statusLabel } from "../utils/i18n.js";

export function OrderDetailModal({ order, workOrders = [], onClose }) {
  if (!order) return null;

  const description = order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ") || label("noData");
  const relatedWorkOrders = workOrders.filter((workOrder) => String(workOrder.orderId?._id || workOrder.orderId) === String(order._id));

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="orderDetailTitle" onClick={onClose}>
      <div className="productModal workOrderModal" onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <h2 id="orderDetailTitle">{order.customerName}</h2>
            <span>Narocilo / {order.status}</span>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label="Zapri podrobnosti narocila">
            <X size={18} />
          </button>
        </div>

        <section className="workOrderDetailGrid">
          <div className="detailCard">
            <ClipboardList size={18} />
            <strong>{label("description")}</strong>
            <span>{description}</span>
          </div>
          <div className="detailCard">
            <CalendarDays size={18} />
            <strong>{label("deadline")}</strong>
            <span>{formatDate(order.requestedDeadline)}</span>
          </div>
          <div className="detailCard">
            <UserRoundCheck size={18} />
            <strong>Podjetje</strong>
            <span>{order.customerName}</span>
          </div>
          <div className="detailCard">
            <PackageCheck size={18} />
            <strong>{label("status")}</strong>
            <StatusBadge value={order.status} />
          </div>
        </section>

        <section className="detailSection">
          <div className="sectionHeader compact">
            <h3>{label("orderItems")}</h3>
            <span>{order.items?.length || 0}</span>
          </div>
          <div className="detailGrid">
            {order.items?.map((item, index) => (
              <div className="detailCard" key={`${item.productId?._id || item.productId || item.productName}-${index}`}>
                <PackageCheck size={18} />
                <strong>{item.productName}</strong>
                <span>{label("quantity")}: {item.quantity}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="detailSection">
          <div className="sectionHeader compact">
            <h3>Povezani delovni nalogi</h3>
            <span>{relatedWorkOrders.length}</span>
          </div>
          <div className="phaseDetailList">
            {relatedWorkOrders.map((workOrder) => (
              <article className="phaseDetailCard" key={workOrder._id}>
                <div className="phaseDetailHeader">
                  <div>
                    <strong>{workOrder.code}</strong>
                    <span>{workOrder.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}</span>
                    <p>{label("deadline")}: {formatDate(workOrder.dueDate)} / {label("inventory")}: {statusLabel(workOrder.inventoryStatus)}</p>
                  </div>
                  <StatusBadge value={workOrder.status} />
                </div>
              </article>
            ))}
            {relatedWorkOrders.length === 0 && (
              <div className="drawingBox">
                <Factory size={18} />
                <div>
                  <strong>Ni povezanega delovnega naloga</strong>
                  <span>Narocilo se ni bilo pretvorjeno v proizvodnjo.</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
