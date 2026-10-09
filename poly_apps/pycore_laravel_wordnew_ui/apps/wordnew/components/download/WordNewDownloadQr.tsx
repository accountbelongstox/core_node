import React, { useEffect, useMemo, useState } from 'react';
import type { QrSymbol } from '../../../laravel-manager/components/views/tools/web/logic/qr';

const QR_MARGIN = 2;
const QR_ECC = 'M';

interface WordNewDownloadQrProps {
  value: string;
  label: string;
  size?: number;
}

function modulePath(symbol: QrSymbol): string {
  const parts: string[] = [];
  symbol.modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end]) end += 1;
      parts.push(`M${x + QR_MARGIN} ${y + QR_MARGIN}h${end - x}v1h${x - end}z`);
      x = end;
    }
  });
  return parts.join('');
}

/** QR code of a download link, drawn by the project's QR encoder (loaded on demand). */
export const WordNewDownloadQr: React.FC<WordNewDownloadQrProps> = ({ value, label, size = 168 }) => {
  const [symbol, setSymbol] = useState<QrSymbol | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSymbol(null);
    import('../../../laravel-manager/components/views/tools/web/logic/qr')
      .then((module) => {
        if (!cancelled) setSymbol(module.encodeQr(value, QR_ECC));
      })
      .catch(() => {
        if (!cancelled) setSymbol(null);
      });
    return () => { cancelled = true; };
  }, [value]);

  const path = useMemo(() => (symbol ? modulePath(symbol) : ''), [symbol]);
  if (!symbol) return null;
  const total = symbol.size + QR_MARGIN * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="rounded-xl bg-white"
    >
      <path fill="#0f172a" d={path} />
    </svg>
  );
};
