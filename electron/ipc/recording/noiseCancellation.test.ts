import os from "node:os";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: { getPath: () => os.tmpdir(), isPackaged: false, getAppPath: () => process.cwd() },
}));

import {
	getNoiseCancellationFilters,
	normalizeNoiseCancellationLevel,
} from "../../../src/lib/noiseCancellation";
import {
	applyNoiseCancellationToMicFile,
	buildNoiseCancellationArgs,
	getNoiseCancellationCodecArgs,
} from "./noiseCancellation";

describe("noise cancellation (ANC)", () => {
	it("defaults unknown values to off", () => {
		expect(normalizeNoiseCancellationLevel(undefined)).toBe("off");
		expect(normalizeNoiseCancellationLevel("loud")).toBe("off");
		expect(normalizeNoiseCancellationLevel("strong")).toBe("strong");
	});

	it("uses no filters when off and stronger chains as the level rises", () => {
		expect(getNoiseCancellationFilters("off")).toEqual([]);
		const light = getNoiseCancellationFilters("light");
		const strong = getNoiseCancellationFilters("strong");
		expect(light.some((filter) => filter.startsWith("afftdn"))).toBe(true);
		expect(strong.some((filter) => filter.startsWith("agate"))).toBe(true);
		expect(strong.length).toBeGreaterThan(light.length);
	});

	it("keeps the sidecar's container format", () => {
		expect(getNoiseCancellationCodecArgs("/r/rec.mic.wav")).toEqual(["-c:a", "pcm_s16le"]);
		expect(getNoiseCancellationCodecArgs("/r/rec.mic.m4a")).toContain("aac");
	});

	it("builds an ffmpeg command that filters audio only", () => {
		const args = buildNoiseCancellationArgs("in.mic.wav", "out.mic.wav", "light");
		expect(args).toContain("-vn");
		expect(args[args.indexOf("-af") + 1]).toBe(getNoiseCancellationFilters("light").join(","));
		expect(args.at(-1)).toBe("out.mic.wav");
	});

	it("does nothing when ANC is off or there is no mic file", async () => {
		await expect(applyNoiseCancellationToMicFile("/missing.mic.wav", "off")).resolves.toBe(
			"off",
		);
		await expect(applyNoiseCancellationToMicFile(null, "strong")).resolves.toBe("off");
	});

	it("leaves the original alone when processing fails", async () => {
		await expect(
			applyNoiseCancellationToMicFile("/definitely/missing.mic.wav", "light"),
		).resolves.toBe("off");
	});
});
