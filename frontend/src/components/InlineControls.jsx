import { CalendarDays, Check, ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDate } from "../utils/date.js";
import { label as t, statusLabel } from "../utils/i18n.js";

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function toTimeInput(value) {
  if (!value) return "08:00";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(11, 16);
}

function makeLocalDateTime(date, time) {
  if (!date) return undefined;
  return `${date}T${time || "08:00"}`;
}

function useCloseOnOutsideClick(open, setOpen) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, setOpen]);

  return ref;
}

export function InlineStatusMenu({ label, value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutsideClick(open, setOpen);

  return (
    <div className="inlineControl" ref={ref}>
      <span>{label}</span>
      <button type="button" className={`inlineControlButton statusValue ${value}`} onClick={() => setOpen((current) => !current)} disabled={disabled}>
        {statusLabel(value)}
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="inlineDropdown">
          {options.map((option) => (
            <button
              type="button"
              className={option === value ? "selected" : ""}
              key={option}
              onClick={() => {
                setOpen(false);
                if (option !== value) onChange(option);
              }}
            >
              {statusLabel(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function InlineDateTimeMenu({ label, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(toDateInput(value));
  const [time, setTime] = useState(toTimeInput(value));
  const ref = useCloseOnOutsideClick(open, setOpen);

  function openEditor() {
    setDate(toDateInput(value));
    setTime(toTimeInput(value));
    setOpen(true);
  }

  function save() {
    setOpen(false);
    onChange(makeLocalDateTime(date, time));
  }

  return (
    <div className="inlineControl" ref={ref}>
      <span>{label}</span>
      <button type="button" className="inlineControlButton" onClick={openEditor} disabled={disabled}>
        {formatDate(value)}
        <CalendarDays size={16} />
      </button>
      {open && (
        <div className="inlineDatePopover">
          <label>
            {t("date")}
            <input type="text" value={date} onChange={(event) => setDate(event.target.value)} placeholder="2026-05-15" />
          </label>
          <label>
            {t("time")}
            <input type="text" value={time} onChange={(event) => setTime(event.target.value)} placeholder="17:34" />
          </label>
          <div className="inlineDateActions">
            <button type="button" className="iconText" onClick={() => setOpen(false)}>
              <X size={15} />
              {t("cancel")}
            </button>
            <button type="button" className="primary" onClick={save}>
              <Check size={15} />
              {t("save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
