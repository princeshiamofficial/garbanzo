import { loadAppSetting, saveAppSetting } from "@/lib/appSettings";

export const TELEPROMPTER_SCRIPT_KEY = "recordly.teleprompter.script";
export const TELEPROMPTER_PREFS_KEY = "recordly.teleprompter.prefs";

export const WPM_MIN = 60;
export const WPM_MAX = 260;
export const WPM_STEP = 10;
export const FONT_MIN = 24;
export const FONT_MAX = 96;
export const FONT_STEP = 4;
/** Where the reading cue sits, as a fraction of the stage height (near the top = near the webcam). */
export const CUE_POSITION = 0.32;

export interface TeleprompterPrefs {
	wpm: number;
	fontSize: number;
	mirror: boolean;
	startWithRecording: boolean;
}

export const DEFAULT_PREFS: TeleprompterPrefs = {
	wpm: 140,
	fontSize: 44,
	mirror: false,
	startWithRecording: true,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(max, Math.max(min, Math.round(value)))
		: fallback;
}

export function normalizePrefs(raw: unknown): TeleprompterPrefs {
	const value = (raw && typeof raw === "object" ? raw : {}) as Partial<TeleprompterPrefs>;
	return {
		wpm: clampNumber(value.wpm, WPM_MIN, WPM_MAX, DEFAULT_PREFS.wpm),
		fontSize: clampNumber(value.fontSize, FONT_MIN, FONT_MAX, DEFAULT_PREFS.fontSize),
		mirror: typeof value.mirror === "boolean" ? value.mirror : DEFAULT_PREFS.mirror,
		startWithRecording:
			typeof value.startWithRecording === "boolean"
				? value.startWithRecording
				: DEFAULT_PREFS.startWithRecording,
	};
}

export function loadPrefs(): TeleprompterPrefs {
	return normalizePrefs(loadAppSetting(TELEPROMPTER_PREFS_KEY));
}

export function savePrefs(prefs: TeleprompterPrefs) {
	saveAppSetting(TELEPROMPTER_PREFS_KEY, prefs);
}

export function loadScript(): string {
	const raw = loadAppSetting<string>(TELEPROMPTER_SCRIPT_KEY);
	return typeof raw === "string" ? raw : "";
}

export function saveScript(script: string) {
	saveAppSetting(TELEPROMPTER_SCRIPT_KEY, script);
}

/** Paragraphs are separated by one or more blank lines; single line breaks are kept. */
export function splitParagraphs(script: string): string[] {
	return script
		.replace(/\r\n?/g, "\n")
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
}

/** Counts words in any script, including Bangla, which also separates words with spaces. */
export function countWords(script: string): number {
	const words = script.trim().split(/\s+/u).filter(Boolean);
	return words.length;
}

/** Scroll speed that keeps the chosen words-per-minute at any text size. */
export function getPixelsPerSecond(contentHeight: number, wordCount: number, wpm: number): number {
	if (contentHeight <= 0 || wordCount <= 0 || wpm <= 0) return 0;
	return (contentHeight / wordCount) * (wpm / 60);
}

export function getRemainingSeconds(progress: number, wordCount: number, wpm: number): number {
	if (wordCount <= 0 || wpm <= 0) return 0;
	const remainingWords = wordCount * (1 - Math.min(1, Math.max(0, progress)));
	return Math.round((remainingWords / wpm) * 60);
}

export function formatDuration(totalSeconds: number): string {
	const seconds = Math.max(0, Math.round(totalSeconds));
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
