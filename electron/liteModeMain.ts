import os from "node:os";
import {
	FULL_RECORDING_PROFILE,
	LITE_MODE_SETTING_KEY,
	LITE_RECORDING_PROFILE,
	normalizeLiteModePreference,
	type RecordingProfile,
	resolveLiteMode,
} from "../src/lib/liteMode";
import { readAppSetting } from "./appSettingsStore";

const BYTES_PER_GB = 1024 ** 3;

export function getMainHardwareHints() {
	return {
		// Round so a "4 GB" machine reporting 3.8 GB still counts as 4 GB.
		memoryGb: Math.round(os.totalmem() / BYTES_PER_GB),
		cores: os.cpus().length,
	};
}

/**
 * Lite mode as seen by the main process. Read fresh each time so toggling the
 * setting in the dashboard applies to the next recording without a restart.
 */
export function isLiteModeActiveInMain(): boolean {
	let raw: unknown = null;
	try {
		raw = readAppSetting(LITE_MODE_SETTING_KEY);
	} catch {
		raw = null;
	}
	return resolveLiteMode(normalizeLiteModePreference(raw), getMainHardwareHints());
}

export function getMainRecordingProfile(): RecordingProfile {
	return isLiteModeActiveInMain() ? LITE_RECORDING_PROFILE : FULL_RECORDING_PROFILE;
}
