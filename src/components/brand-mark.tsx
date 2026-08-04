type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="CAF TI Helpdesk">
      <img
        className="brand__artwork"
        src={compact ? '/branding/ti-favicon.svg' : '/branding/ti-logo.png'}
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}
