import { useId } from "react";
import { fromHtmlDate, toHtmlDate } from "../utils.js";

export function Field({
  label,
  htmlFor,
  children,
  isPrivate = false,
  className = "",
}) {
  return (
    <div className={`field ${isPrivate ? "private" : ""} ${className}`.trim()}>
      {label ? (
        <label htmlFor={htmlFor}>
          {label}
          {isPrivate ? <span className="private-tag"> private</span> : null}
        </label>
      ) : null}
      {children}
    </div>
  );
}

export function FieldText({
  label,
  value,
  onChange,
  type = "text",
  isPrivate = false,
  placeholder,
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} isPrivate={isPrivate}>
      <input
        id={id}
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** Date picker storing values as MM-DD-YYYY. */
export function FieldDate({ label, value, onChange, isPrivate = false }) {
  const id = useId();
  const htmlValue = toHtmlDate(value ?? "");
  return (
    <Field label={label} htmlFor={id} isPrivate={isPrivate}>
      <input
        id={id}
        type="date"
        value={htmlValue}
        aria-label={label}
        onChange={(e) => onChange(fromHtmlDate(e.target.value))}
      />
    </Field>
  );
}

export function FieldArea({ label, value, onChange, isPrivate = false }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} isPrivate={isPrivate}>
      <textarea
        id={id}
        value={value ?? ""}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function SelectField({ label, value, onChange, options }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <select
        id={id}
        value={value ?? ""}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({ label, checked, onChange }) {
  const id = useId();
  return (
    <div className="checkbox-row">
      <input
        id={id}
        type="checkbox"
        checked={Boolean(checked)}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function StringListField({
  label,
  values,
  onChange,
  isPrivate = false,
  placeholder = "Add item",
}) {
  const id = useId();
  const list = values ?? [];

  function updateAt(index, next) {
    const copy = [...list];
    copy[index] = next;
    onChange(copy);
  }

  function removeAt(index) {
    onChange(list.filter((_, i) => i !== index));
  }

  return (
    <Field
      label={label}
      htmlFor={list.length ? `${id}-0` : undefined}
      isPrivate={isPrivate}
    >
      <div className="string-list" role="group" aria-label={label}>
        {list.map((value, index) => (
          <div className="string-list-row" key={`${id}-${index}`}>
            <input
              id={`${id}-${index}`}
              value={value}
              aria-label={`${label} item ${index + 1}`}
              onChange={(e) => updateAt(index, e.target.value)}
            />
            <button
              type="button"
              className="btn"
              aria-label={`Remove ${label} item ${index + 1}`}
              data-tooltip={`Remove ${label} item ${index + 1}`}
              onClick={() => removeAt(index)}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          data-tooltip={placeholder}
          onClick={() => onChange([...list, ""])}
        >
          {placeholder}
        </button>
      </div>
    </Field>
  );
}

/** Drop empty strings from string arrays before save */
export function compactStrings(list) {
  return (list ?? []).map((s) => s.trim()).filter(Boolean);
}

/** Remove empty optional string fields and empty arrays from a shallow copy */
export function pruneEmpty(obj) {
  const next = { ...obj };
  for (const [key, value] of Object.entries(next)) {
    if (value === "" || value === undefined || value === null) {
      delete next[key];
    } else if (Array.isArray(value) && value.length === 0) {
      if (
        ![
          "challenges",
          "_challenges",
          "lessons_learned",
          "scale_and_scope",
          "measurable_results",
          "decisions_and_tradeoffs",
          "technologies",
        ].includes(key)
      ) {
        if (
          [
            "teams",
            "skills",
            "silent_tags",
            "languages",
            "frameworks",
            "platforms",
            "tools",
            "projects",
            "committees",
            "highlights",
            "tags",
            "links",
            "roles",
            "bullets",
            "specialties",
            "strengths",
            "interests",
            "disinterests",
          ].includes(key)
        ) {
          delete next[key];
        }
      }
    }
  }
  return next;
}
