import { CalendarDays, CheckCircle2, ClipboardList, Hammer, Pencil, Save, UserRoundCheck, X } from "lucide-react";
import { CustomSelect } from "./CustomSelect.jsx";
import { EmptyState } from "./EmptyState.jsx";
import { StatusBadge } from "./StatusBadge.jsx";
import { formatDate } from "../utils/date.js";
import { label, statusLabel } from "../utils/i18n.js";

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

export function WorkOrderDetailModal({
  order,
  phases,
  employees,
  session,
  isAdmin,
  editingPhase,
  setEditingPhase,
  savePhaseEdit,
  loading,
  onApprovePayment,
  onClose
}) {
  if (!order) return null;

  const orderPhases = phases.filter((phase) => String(phase.workOrderId?._id || phase.workOrderId) === String(order._id));
  const customerName = order.orderId?.customerName || "Ni vneseno";
  const description = order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ") || "Brez izdelkov";
  const phaseStatusOptions = [
    { value: "planned", label: statusLabel("planned") },
    { value: "in_progress", label: statusLabel("in_progress") },
    { value: "completed", label: statusLabel("completed") }
  ];

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
            <strong>{label("description")}</strong>
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

        {isAdmin && order.status === "completed" && order.fulfillmentStatus === "awaiting_payment" && (
          <div className="successAlert approvalPanel">
            <div>
              <strong>{label("awaitingPayment")}</strong>
              <span>{description}</span>
            </div>
            <button type="button" className="primary approveButton" onClick={() => onApprovePayment?.(order._id)} disabled={loading}>
              <CheckCircle2 size={17} />
              {label("approvePayment")}
            </button>
          </div>
        )}

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
                        <CustomSelect
                          label={label("status")}
                          value={editingPhase.status}
                          options={phaseStatusOptions}
                          onChange={(status) => setEditingPhase({ ...editingPhase, status })}
                        />
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
                              <span>{employee.skills?.join(", ") || label("noData")}</span>
                            </button>
                          );
                        })}
                      </div>}
                      <div className="rowActions inlinePhaseActions">
                        <button type="button" className="primary" onClick={savePhaseEdit} disabled={loading}><Save size={17} />{label("savePhase")}</button>
                        <button type="button" className="iconText" onClick={() => setEditingPhase(null)}><X size={17} />{label("cancel")}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Dodeljeno: {phase.assignedToName || label("noData")}</p>
                      {(phase.actualStartedAt || phase.actualCompletedAt) && (
                        <p>
                          {phase.actualStartedAt ? `${label("actualStarted")}: ${formatDate(phase.actualStartedAt)}` : ""}
                          {phase.actualStartedAt && phase.actualCompletedAt ? " / " : ""}
                          {phase.actualCompletedAt ? `${label("actualCompleted")}: ${formatDate(phase.actualCompletedAt)}` : ""}
                        </p>
                      )}
                      {(isAdmin || phase.assignedToName === session.user?.name) && <div className="rowActions inlinePhaseActions">
                        <button type="button" className="iconButton" onClick={() => setEditingPhase(phaseToForm(phase))} aria-label="Uredi fazo"><Pencil size={17} /></button>
                      </div>}
                    </>
                  )}
                </article>
              );
            })}
            {orderPhases.length === 0 && <EmptyState label={label("noPhases")} />}
          </div>
        </section>
      </div>
    </div>
  );
}
