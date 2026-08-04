type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="brand" aria-label="CAF TI Helpdesk">
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img">
          <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" />
          <path d="m3.9 7.2 8.1 4.4 8.1-4.4M12 11.6v9.2" />
        </svg>
      </span>
      {!compact && (
        <span className="brand__copy">
          <strong>CAF TI</strong>
          <small>Helpdesk profissional</small>
        </span>
      )}
    </div>
  );
}
