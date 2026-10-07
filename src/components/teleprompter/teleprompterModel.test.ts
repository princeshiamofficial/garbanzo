import { describe, expect, it } from "vitest";
import {
	countWords,
	DEFAULT_PREFS,
	FONT_MAX,
	formatDuration,
	getPixelsPerSecond,
	getRemainingSeconds,
	normalizePrefs,
	splitParagraphs,
	WPM_MIN,
} from "./teleprompterModel";

describe("teleprompter model", () => {
	it("splits paragraphs on blank lines and keeps single line breaks", () => {
		expect(splitParagraphs("One\ntwo\n\n\nThree\r\n\r\nFour  ")).toEqual([
			"One\ntwo",
			"Three",
			"Four",
		]);
		expect(splitParagraphs("   \n\n  ")).toEqual([]);
	});

	it("counts English and Bangla words", () => {
		expect(countWords("Hello there, world")).toBe(3);
		expect(countWords("আমাদের পোর্টালে প্রতিটি আবেদনের")).toBe(4);
		expect(countWords("   ")).toBe(0);
	});

	it("scrolls at the same words-per-minute regardless of text size", () => {
		const small = getPixelsPerSecond(1000, 100, 120);
		const large = getPixelsPerSecond(2000, 100, 120);
		// Twice the text height means twice the pixels per second for the same wpm.
		expect(large).toBeCloseTo(small * 2);
		expect(small).toBeCloseTo((1000 / 100) * 2);
		expect(getPixelsPerSecond(0, 100, 120)).toBe(0);
	});

	it("estimates time left from progress", () => {
		expect(getRemainingSeconds(0, 140, 140)).toBe(60);
		expect(getRemainingSeconds(0.5, 140, 140)).toBe(30);
		expect(getRemainingSeconds(2, 140, 140)).toBe(0);
		expect(formatDuration(75)).toBe("1:15");
		expect(formatDuration(5)).toBe("0:05");
	});

	it("clamps stored preferences into safe ranges", () => {
		expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
		const prefs = normalizePrefs({
			wpm: 5,
			fontSize: 500,
			mirror: "yes",
			startWithRecording: false,
		});
		expect(prefs.wpm).toBe(WPM_MIN);
		expect(prefs.fontSize).toBe(FONT_MAX);
		expect(prefs.mirror).toBe(false);
		expect(prefs.startWithRecording).toBe(false);
	});
});
