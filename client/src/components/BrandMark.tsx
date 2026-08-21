import { FileCheck2 } from "lucide-react";

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-mark" aria-label="Tools Thai">
      <span className="brand-icon" aria-hidden="true">
        <FileCheck2 size={compact ? 17 : 19} strokeWidth={2.25} />
      </span>
      {!compact && (
        <span className="brand-text">
          <strong>Tools</strong>
          <em>Thai</em>
        </span>
      )}
    </div>
  );
}
