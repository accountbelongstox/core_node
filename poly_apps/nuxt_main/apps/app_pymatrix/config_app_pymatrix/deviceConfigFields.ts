import type { DeviceConfig } from '../../../types/pymatrix';

export type DeviceConfigField =
  | { key: keyof DeviceConfig; label: string; type: 'number'; min: number; max: number; step?: number }
  | {
      key: keyof DeviceConfig;
      label: string;
      type: 'select';
      options: Array<{ label: string; value: string | number }>;
      valueType: 'number' | 'string';
    }
  | { key: keyof DeviceConfig; label: string; type: 'toggle' };

export const DEVICE_CONFIG_FIELDS: DeviceConfigField[] = [
  { key: 'max_size', label: 'Max Resolution (short side, px)', type: 'number', min: 120, max: 4320, step: 10 },
  { key: 'bit_rate', label: 'Bit Rate (bps)', type: 'number', min: 100000, max: 20000000, step: 100000 },
  { key: 'max_fps', label: 'Max FPS', type: 'number', min: 1, max: 120 },
  {
    key: 'codec',
    label: 'Video Codec',
    type: 'select',
    valueType: 'string',
    options: [
      { label: 'H.264', value: 'h264' },
      { label: 'H.265', value: 'h265' },
      { label: 'AV1', value: 'av1' },
    ],
  },
  {
    key: 'locked_video_orientation',
    label: 'Orientation',
    type: 'select',
    valueType: 'number',
    options: [
      { label: 'Auto', value: -1 },
      { label: '0°', value: 0 },
      { label: '90°', value: 1 },
      { label: '180°', value: 2 },
      { label: '270°', value: 3 },
    ],
  },
  { key: 'control', label: 'Enable Control', type: 'toggle' },
];
