import { TI_LOGO_DATA_URI } from '@/assets/ti-logo';

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="CAF TI Helpdesk">
      <img
        className="brand__artwork"
        src={compact ? '/branding/ti-favicon.svg' : TI_LOGO_DATA_URI}
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}
