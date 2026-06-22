import { Unit, UnitStatus } from './types';

export const TOTAL_UNITS = 48;

const UNIT_TYPES = ['DRONE', 'SERVER', 'BOT', 'SENSOR'] as const;
const STATUS_WEIGHTS = [
  UnitStatus.ONLINE, UnitStatus.ONLINE, UnitStatus.ONLINE,
  UnitStatus.IDLE, UnitStatus.IDLE,
  UnitStatus.WARNING,
  UnitStatus.CRITICAL,
  UnitStatus.OFFLINE
];

const generateRandomUnit = (index: number): Unit => {
  const type = UNIT_TYPES[Math.floor(Math.random() * UNIT_TYPES.length)];
  const id = `NX-${type.substring(0, 2)}-${String(index + 1).padStart(3, '0')}`;
  
  return {
    id,
    name: `${type} Unit ${index + 1}`,
    type,
    status: STATUS_WEIGHTS[Math.floor(Math.random() * STATUS_WEIGHTS.length)],
    battery: Math.floor(Math.random() * 40) + 60, // 60-100 initial
    cpuLoad: Math.floor(Math.random() * 30) + 10, // 10-40 initial
    temperature: Math.floor(Math.random() * 20) + 30, // 30-50 initial
    location: {
      x: Math.random() * 100,
      y: Math.random() * 100
    },
    firmwareVersion: 'v2.4.1',
    lastPing: Date.now()
  };
};

export const INITIAL_UNITS: Unit[] = Array.from({ length: TOTAL_UNITS }, (_, i) => generateRandomUnit(i));

export const MOCK_LOGS = [
  { id: 'l1', timestamp: Date.now() - 50000, level: 'INFO', message: 'System initialization complete.', source: 'CORE' },
  { id: 'l2', timestamp: Date.now() - 40000, level: 'SUCCESS', message: 'Network grid established.', source: 'NET' },
  { id: 'l3', timestamp: Date.now() - 30000, level: 'WARN', message: 'Latency spike detected in Sector 4.', source: 'MONITOR' },
];
