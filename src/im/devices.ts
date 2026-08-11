export type Modulation = 'fm' | 'digital';

export interface DeviceMode {
  id: string;
  label: string;
  /** Peak deviation: half the quoted modulation width. */
  deviationHz: number;
  /** The width as the manufacturer quotes it. */
  widthHz: number;
}

export interface Device {
  id: string;
  brand: string;
  model: string;
  modulation: Modulation;
  /** Ascending. Recorded and displayed, never used in the calculation. */
  powersMW: number[];
  /** At least one. The first is the default when none is chosen. */
  modes: DeviceMode[];
}

// Deviations are held in hertz because Wisycom's narrow band is ±17.5 kHz,
// which kilohertz cannot express as an integer. Carrier frequencies remain
// integer kilohertz; only the window threshold is computed in hertz.
const WIDE_56: DeviceMode = {
  id: 'wide',
  label: 'Wide band',
  deviationHz: 28000,
  widthHz: 56000,
};

const NARROW_35: DeviceMode = {
  id: 'narrow',
  label: 'Narrow band',
  deviationHz: 17500,
  widthHz: 35000,
};

export const DEVICES: readonly Device[] = [
  {
    id: 'wisycom-mtp40',
    brand: 'Wisycom',
    model: 'MTP40',
    modulation: 'fm',
    powersMW: [10, 50],
    modes: [WIDE_56],
  },
  {
    id: 'wisycom-mtp41',
    brand: 'Wisycom',
    model: 'MTP41',
    modulation: 'fm',
    powersMW: [10, 50, 100],
    modes: [WIDE_56],
  },
  {
    id: 'wisycom-mtp60',
    brand: 'Wisycom',
    model: 'MTP60',
    modulation: 'fm',
    powersMW: [10, 50, 100],
    modes: [WIDE_56, NARROW_35],
  },
  {
    id: 'wisycom-mtp61',
    brand: 'Wisycom',
    model: 'MTP61',
    modulation: 'fm',
    powersMW: [10, 50, 100],
    modes: [WIDE_56, NARROW_35],
  },
  {
    id: 'wisycom-mtb40s',
    brand: 'Wisycom',
    model: 'MTB40s',
    modulation: 'fm',
    powersMW: [10, 50, 100],
    modes: [WIDE_56],
  },
  {
    id: 'sennheiser-5212',
    brand: 'Sennheiser',
    model: '5212',
    modulation: 'fm',
    powersMW: [10, 50],
    modes: [WIDE_56],
  },
  {
    // One entry for four generations: they share a modulation width, and the
    // calculation cannot tell them apart.
    id: 'sennheiser-evolution',
    brand: 'Sennheiser',
    model: 'Evolution G2/G3/G4/2000',
    modulation: 'fm',
    powersMW: [10, 50],
    modes: [
      { id: 'wide', label: 'Wide band', deviationHz: 24000, widthHz: 48000 },
    ],
  },
  {
    id: 'sound-devices-a10',
    brand: 'Sound Devices',
    model: 'A10',
    modulation: 'digital',
    powersMW: [10, 20, 50],
    modes: [
      {
        id: 'digital',
        label: 'Digital',
        deviationHz: 100000,
        widthHz: 200000,
      },
    ],
  },
  {
    id: 'lectrosonics-us',
    brand: 'Lectrosonics',
    model: 'US models',
    modulation: 'fm',
    powersMW: [50],
    modes: [
      { id: 'wide', label: 'Wide band', deviationHz: 70000, widthHz: 140000 },
    ],
  },
];

export function findDevice(id: string | undefined): Device | null {
  if (id === undefined) return null;
  return DEVICES.find((d) => d.id === id) ?? null;
}

/** Falls back to the device's first mode, which is the wide one throughout. */
export function findMode(device: Device, modeId: string | undefined): DeviceMode {
  if (modeId === undefined) return device.modes[0];
  return device.modes.find((m) => m.id === modeId) ?? device.modes[0];
}

function kHzText(hz: number): string {
  const value = hz / 1000;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatModeWidth(mode: DeviceMode): string {
  return `±${kHzText(mode.deviationHz)} kHz · ${kHzText(mode.widthHz)} kHz wide`;
}
