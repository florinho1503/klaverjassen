// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { App } from "../App";

describe("App — render smoketest", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("mount zonder crash: deelt en toont 8 kaarten voor de mens", () => {
    const { container } = render(<App />);
    const humanCards = container.querySelectorAll(".hand .card");
    expect(humanCards).toHaveLength(8);
  });

  it("start in de biedfase en toont de drie tegenstanders als kaartruggen", () => {
    const { container } = render(<App />);
    expect(container.textContent).toContain("Bieden");
    // 3 tegenstanders × 8 kaartruggen = 24 ruggen aan het begin.
    expect(container.querySelectorAll(".card--back")).toHaveLength(24);
  });
});
