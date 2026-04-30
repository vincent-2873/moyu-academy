import { describe, it, expect } from "vitest";
import { isSupportedMime, estimateTranscribeCost } from "./file-parser";

describe("file-parser", () => {
  it("isSupportedMime text", () => {
    expect(isSupportedMime("text/plain")).toBe(true);
    expect(isSupportedMime("text/markdown")).toBe(true);
    expect(isSupportedMime("text/csv")).toBe(true);
    expect(isSupportedMime("application/json")).toBe(true);
  });

  it("isSupportedMime audio", () => {
    expect(isSupportedMime("audio/mpeg")).toBe(true);
    expect(isSupportedMime("audio/mp3")).toBe(true);
    expect(isSupportedMime("audio/wav")).toBe(true);
    expect(isSupportedMime("audio/m4a")).toBe(true);
    expect(isSupportedMime("audio/webm")).toBe(true);
  });

  it("isSupportedMime video", () => {
    expect(isSupportedMime("video/mp4")).toBe(true);
    expect(isSupportedMime("video/webm")).toBe(true);
  });

  it("isSupportedMime unsupported", () => {
    expect(isSupportedMime("application/pdf")).toBe(false);
    expect(isSupportedMime("application/x-dosexec")).toBe(false);
    expect(isSupportedMime("application/octet-stream")).toBe(false);
    expect(isSupportedMime("image/jpeg")).toBe(false);
  });

  it("estimateTranscribeCost text = 0", () => {
    const c = estimateTranscribeCost(1024 * 1024, "text/plain");
    expect(c.usd).toBe(0);
    expect(c.provider).toBe("free");
  });

  it("estimateTranscribeCost audio 1MB ≈ $0.00185", () => {
    const c = estimateTranscribeCost(1024 * 1024, "audio/mpeg");
    expect(c.provider).toBe("groq-whisper");
    expect(c.usd).toBeCloseTo(0.00185, 4);
  });

  it("estimateTranscribeCost audio 10MB ≈ $0.0185", () => {
    const c = estimateTranscribeCost(10 * 1024 * 1024, "audio/mp3");
    expect(c.provider).toBe("groq-whisper");
    expect(c.usd).toBeCloseTo(0.0185, 4);
  });
});
