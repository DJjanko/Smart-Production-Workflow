import { useEffect, useRef, useState } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { label, statusLabel } from "../utils/i18n.js";

export function StatusFilterMenu({
  value,
  onChange,
  statuses = ["planned", "in_progress", "completed", "sold", "delayed"],
  ariaLabel = "Filter statusa"
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = [{ value: "all", label: label("allStatuses") }, ...statuses.map((status) => ({ value: status, label: statusLabel(status) }))];
  const current = options.find((option) => option.value === value)?.label || label("allStatuses");

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="statusFilterControl" ref={ref}>
      <button type="button" className="statusFilterButton" onClick={() => setOpen((currentOpen) => !currentOpen)} aria-label={ariaLabel}>
        <Filter size={15} />
        <span>{current}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="statusFilterMenu">
          {options.map((option) => (
            <button
              type="button"
              className={option.value === value ? "selected" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
