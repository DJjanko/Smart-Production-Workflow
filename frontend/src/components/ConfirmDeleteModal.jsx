import { AlertTriangle, Trash2, X } from "lucide-react";

export function ConfirmDeleteModal({ title, description, onConfirm, onCancel }) {
  if (!title) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="confirmDeleteModal" onClick={(e) => e.stopPropagation()}>
        <div className="confirmDeleteIcon">
          <AlertTriangle size={28} />
        </div>
        <div className="confirmDeleteContent">
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        <div className="confirmDeleteActions">
          <button type="button" className="confirmDeleteCancel" onClick={onCancel}>
            <X size={16} />
            Prekliči
          </button>
          <button type="button" className="confirmDeleteConfirm" onClick={onConfirm}>
            <Trash2 size={16} />
            Izbriši
          </button>
        </div>
      </div>
    </div>
  );
}
