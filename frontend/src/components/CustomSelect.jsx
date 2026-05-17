import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function CustomSelect({ label, value, options, onChange, disabled, className = "", statusColors = false, phaseColors = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find((option) => option.value === value) || options[0];

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
    <div className={`customSelect ${className}`} ref={ref}>
      {label && <span>{label}</span>}
      <button
        type="button"
        className={`customSelectButton${statusColors ? ` statusBtn ${current?.value || ""}` : ""}${phaseColors ? ` phaseBtn` : ""}`}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        disabled={disabled}
      >
        {statusColors && <span className={`statusDot ${current?.value || ""}`} />}
        {phaseColors && <span className={`phaseIndicator ${current?.value || ""}`} />}
        <span>{current?.label || "-"}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="customSelectMenu">
          {options.map((option) => (
            <button
              type="button"
              className={`${option.value === value ? "selected" : ""}${statusColors ? ` statusOpt ${option.value}` : ""}${phaseColors ? ` phaseOpt ${option.value}` : ""}`}
              key={option.value}
              onClick={() => {
                setOpen(false);
                if (option.value !== value) onChange(option.value);
              }}
            >
              {statusColors && <span className={`statusDot ${option.value}`} />}
              {phaseColors && <span className={`phaseIndicator ${option.value}`} />}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
