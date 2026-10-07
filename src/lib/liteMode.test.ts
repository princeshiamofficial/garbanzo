import { afterEach, describe, expect, it } from "vitest";
import {
	getExportBackpressureProfile,
	getWebCodecsEncodeQueueLimit,
} from "./exporter/exportTuning";
import {
	FULL_RECORDING_PROFILE,
	getLiteModePreference,
	getRecordingProfile,
	isLowSpecHardware,
	LITE_EXPORT_QUEUE,
	LITE_MODE_SETTING_KEY,
	LITE_RECORDING_PROFILE,
	normalizeLiteModePreference,
	resetLiteModeCache,
	resolveLiteMode,
	setLiteModePreference,
} from "./liteMode";

type Global = typeof globalThis & { electronAPI?: unknown };

function installSettingsBridge(initial: Record<string, unknown> = {}) {
	const store = { ...initial };
	(globalThis as Global).electronAPI = {
		getAppSetting: (key: string) => store[key] ?? null,
		setAppSetting: (key: string, value: unknown) => {
			store[key] = value;
			return true;
		},
	};
	resetLiteModeCache();
	return store;
}

afterEach(() => {
	delete (globalThis as Global).electronAPI;
	resetLiteModeCache();
});

describe("lite mode detection", () => {
	it("treats 2–4 GB RAM or dual-core machines as low-spec", () => {
		expect(isLowSpecHardware({ memoryGb: 2, cores: 4 })).toBe(true);
		expect(isLowSpecHardware({ memoryGb: 4, cores: 8 })).toBe(true);
		expect(isLowSpecHardware({ memoryGb: 8, cores: 2 })).toBe(true);
		expect(isLowSpecHardware({ memoryGb: 8, cores: 4 })).toBe(false);
		expect(isLowSpecHardware({ memoryGb: null, cores: null })).toBe(false);
	});

	it("lets an explicit on/off override auto detection", () => {
		expect(resolveLiteMode("on", { memoryGb: 16, cores: 16 })).toBe(true);
		expect(resolveLiteMode("off", { memoryGb: 2, cores: 2 })).toBe(false);
		expect(resolveLiteMode("auto", { memoryGb: 2 })).toBe(true);
	});

	it("normalizes unknown stored values to auto", () => {
		expect(normalizeLiteModePreference("on")).toBe("on");
		expect(normalizeLiteModePreference(undefined)).toBe("auto");
		expect(normalizeLiteModePreference(42)).toBe("auto");
	});
});

describe("lite mode settings", () => {
	it("reads and persists the preference through the settings bridge", () => {
		const store = installSettingsBridge({ [LITE_MODE_SETTING_KEY]: "on" });
		expect(getLiteModePreference()).toBe("on");
		expect(getRecordingProfile()).toBe(LITE_RECORDING_PROFILE);

		setLiteModePreference("off");
		expect(store[LITE_MODE_SETTING_KEY]).toBe("off");
		expect(getRecordingProfile()).toBe(FULL_RECORDING_PROFILE);
	});

	it("caps recording at 1080p/30fps with a low bitrate", () => {
		expect(LITE_RECORDING_PROFILE.frameRate).toBe(30);
		expect(LITE_RECORDING_PROFILE.maxWidth).toBeLessThanOrEqual(1920);
		expect(LITE_RECORDING_PROFILE.maxHeight).toBeLessThanOrEqual(1080);
		expect(LITE_RECORDING_PROFILE.maxBitrate).toBeLessThan(10_000_000);
	});
});

describe("lite mode export tuning", () => {
	it("uses the small low-memory queues when requested", () => {
		const profile = getExportBackpressureProfile({
			encodeBackend: "webcodecs",
			width: 1920,
			height: 1080,
			frameRate: 30,
			lowMemory: true,
		});
		expect(profile.name).toBe("webcodecs-lite");
		expect(profile.maxEncodeQueue).toBe(LITE_EXPORT_QUEUE.maxEncodeQueue);
		expect(profile.maxPendingFrames).toBe(LITE_EXPORT_QUEUE.maxPendingFrames);
		expect(getWebCodecsEncodeQueueLimit(60, "quality", true)).toBe(
			LITE_EXPORT_QUEUE.maxEncodeQueue,
		);
	});

	it("follows the stored preference when lowMemory is not passed", () => {
		installSettingsBridge({ [LITE_MODE_SETTING_KEY]: "on" });
		const profile = getExportBackpressureProfile({
			encodeBackend: "ffmpeg",
			width: 1920,
			height: 1080,
			frameRate: 30,
		});
		expect(profile.name).toBe("breeze-lite");
	});

	it("keeps the normal profiles when Lite mode is off", () => {
		installSettingsBridge({ [LITE_MODE_SETTING_KEY]: "off" });
		const profile = getExportBackpressureProfile({
			encodeBackend: "webcodecs",
			width: 1920,
			height: 1080,
			frameRate: 30,
			hardwareConcurrency: 8,
		});
		expect(profile.name).not.toContain("lite");
		expect(profile.maxEncodeQueue).toBeGreaterThan(LITE_EXPORT_QUEUE.maxEncodeQueue);
	});
});
