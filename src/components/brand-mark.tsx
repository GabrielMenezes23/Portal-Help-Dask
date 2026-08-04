type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="CAF TI Helpdesk">
      <span className="brand__logo" aria-hidden="true">
        <img src="/branding/ti-symbol.svg" alt="" />
      </span>
      {!compact && (
        <span className="brand__identity">
          <strong>TI</strong>
          <small>Helpdesk CAF Máquinas</small>
        </span>
      )}
    </div>
  );
}
