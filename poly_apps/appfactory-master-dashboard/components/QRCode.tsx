import React, { useEffect, useRef } from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * QR码组件
 * 使用在线API生成QR码（如果npm安装失败）
 */
export const QRCode: React.FC<QRCodeProps> = ({ value, size = 200, level = 'M' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 使用在线QR码API生成
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&ecc=${level}`;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.onerror = () => {
      // 如果API失败，绘制一个占位符
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = size;
      canvas.height = size;
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('QR Code', size / 2, size / 2 - 10);
      ctx.fillText('Loading...', size / 2, size / 2 + 10);
    };
    img.src = apiUrl;
  }, [value, size, level]);

  return (
    <div className="inline-block">
      <canvas
        ref={canvasRef}
        className="border border-slate-200 dark:border-slate-700 rounded-lg"
        style={{ width: size, height: size }}
      />
    </div>
  );
};

