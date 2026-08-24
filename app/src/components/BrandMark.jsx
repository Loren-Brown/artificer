const SPARK_COUNT = 14;

/**
 * Logo with one-shot mana sparks falling from the quill tip on mount.
 */
export function BrandMark({ size = 43, className = "" }) {
  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <img
        className="app-brand-icon"
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt=""
        width={size}
        height={size}
      />
      <span className="brand-mark-sparks">
        {Array.from({ length: SPARK_COUNT }, (_, i) => (
          <span
            key={i}
            className="brand-mark-spark"
            style={{ "--spark-i": i }}
          />
        ))}
      </span>
    </span>
  );
}
