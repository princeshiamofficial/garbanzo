/**
 * Ultra Lite mode: a performance profile for low-spec PCs (2–4 GB RAM,
 * dual-core CPUs, integrated graphics).
 *
 * The preference is stored as "auto" | "on" | "off" under LITE_MODE_SETTING_KEY.
 * In "auto" the profile turns itself on when the machine looks low-spec.
 *
 * This module is shared by the renderer (src/) and the Electron main process
 * (electron/), so it must not import from either side.
 */

export const LITE_MODE_SETTING_KEY = "recordly.performance.liteMode";

export type LiteModePreference = "auto" | "on" | "off";

/** Machines at or below this much RAM get Lite mode automatically. */
export const LITE_MODE_AUTO_MAX_MEMORY_GB = 4;
/** Machines with this many logical cores or fewer get Lite mode automatically. */
export const LITE_MODE_AUTO_MAX_CORES = 2;

export interface HardwareHints {
	/** Total system memory in GB (may be approximate, e.g. navigator.deviceMemory). */
	memoryGb?: number | null;
	/** Logical CPU cores. */
	cores?: number | null;
}

export interface RecordingProfile {
	frameRate: number;
	minFrameRate: number;
	maxWidth: number;
	maxHeight: number;
	/** Upper bound for the screen recording bitrate (bits/s). */
	maxBitrate: number;
	webcamWidth: number;
	webcamHeight: number;
	webcamFrameRate: number;
	webcamBitrate: number;
}

export interface PreviewProfile {
	maxFps: number;
	antialias: boolean;
	/** Cap for the renderer's device-pixel-ratio. */
	maxResolution: number;
	/** Whether zoom/motion blur filters run in the editor preview. */
	motionBlur: boolean;
}

export const FULL_RECORDING_PROFILE: RecordingProfile = {
	frameRate: 60,
	minFrameRate: 30,
	maxWidth: 3840,
	maxHeight: 2160,
	maxBitrate: Number.POSITIVE_INFINITY,
	webcamWidth: 1280,
	webcamHeight: 720,
	webcamFrameRate: 30,
	webcamBitrate: 8_000_000,
};

export const LITE_RECORDING_PROFILE: RecordingProfile = {
	frameRate: 30,
	minFrameRate: 15,
	maxWidth: 1920,
	maxHeight: 1080,
	maxBitrate: 6_000_000,
	webcamWidth: 640,
	webcamHeight: 480,
	webcamFrameRate: 24,
	webcamBitrate: 1_500_000,
};

export const FULL_PREVIEW_PROFILE: PreviewProfile = {
	maxFps: 60,
	antialias: true,
	maxResolution: Number.POSITIVE_INFINITY,
	motionBlur: true,
};

export const LITE_PREVIEW_PROFILE: PreviewProfile = {
	maxFps: 30,
	antialias: false,
	maxResolution: 1,
	motionBlur: false,
};

/** Frames held in memory during export when Lite mode is on. */
export const LITE_EXPORT_QUEUE = {
	maxEncodeQueue: 8,
	maxDecodeQueue: 4,
	maxPendingFrames: 6,
	maxInFlightNativeWrites: 1,
} as const;

/** V8 heap cap (MB) for renderer processes in Lite mode. */
export const LITE_RENDERER_HEAP_MB = 1024;

export function normalizeLiteModePreference(value: unknown): LiteModePreference {
	return value === "on" || value === "off" ? value : "auto";
}

export function isLowSpecHardware(hints: HardwareHints): boolean {
	const { memoryGb, cores } = hints;
	if (typeof memoryGb === "number" && memoryGb > 0 && memoryGb <= LITE_MODE_AUTO_MAX_MEMORY_GB) {
		return true;
	}
	if (typeof cores === "number" && cores > 0 && cores <= LITE_MODE_AUTO_MAX_CORES) {
		return true;
	}
	return false;
}

export function resolveLiteMode(preference: LiteModePreference, hints: HardwareHints): boolean {
	if (preference === "on") return true;
	if (preference === "off") return false;
	return isLowSpecHardware(hints);
}

// ---------------------------------------------------------------------------
// Renderer-side helpers (safe to call in the main process too; they simply
// fall back to "not lite" when no settings bridge or navigator is present).
// ---------------------------------------------------------------------------

type SettingsBridge = {
	getAppSetting?: (key: string) => unknown;
	setAppSetting?: (key: string, value: unknown) => boolean;
};

let cachedPreference: LiteModePreference | null = null;

function getBridge(): SettingsBridge | null {
	const api = (globalThis as { electronAPI?: SettingsBridge }).electronAPI;
	return api ?? null;
}

export function getRendererHardwareHints(): HardwareHints {
	const nav = (globalThis as { navigator?: Navigator & { deviceMemory?: number } }).navigator;
	return {
		memoryGb: typeof nav?.deviceMemory === "number" ? nav.deviceMemory : null,
		cores: typeof nav?.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
	};
}

export function getLiteModePreference(): LiteModePreference {
	if (cachedPreference) return cachedPreference;
	let raw: unknown = null;
	try {
		raw = getBridge()?.getAppSetting?.(LITE_MODE_SETTING_KEY) ?? null;
	} catch {
		raw = null;
	}
	cachedPreference = normalizeLiteModePreference(raw);
	return cachedPreference;
}

export function setLiteModePreference(preference: LiteModePreference): boolean {
	cachedPreference = preference;
	try {
		return getBridge()?.setAppSetting?.(LITE_MODE_SETTING_KEY, preference) === true;
	} catch {
		return false;
	}
}

/** Test hook: forget the cached preference. */
export function resetLiteModeCache() {
	cachedPreference = null;
}

export function isLiteModeActive(): boolean {
	// Outside the Electron app (unit tests, web previews) there is no settings
	// bridge; never auto-enable there so behaviour does not depend on the host.
	if (!getBridge()?.getAppSetting) return false;
	return resolveLiteMode(getLiteModePreference(), getRendererHardwareHints());
}

export function getRecordingProfile(): RecordingProfile {
	return isLiteModeActive() ? LITE_RECORDING_PROFILE : FULL_RECORDING_PROFILE;
}

export function getPreviewProfile(): PreviewProfile {
	return isLiteModeActive() ? LITE_PREVIEW_PROFILE : FULL_PREVIEW_PROFILE;
}
