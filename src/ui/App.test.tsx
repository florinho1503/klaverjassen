// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { App } from "../App";

describe("App — render smoketest", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("toont eerst het startscherm met drie niveaus", () => {
    const { container, getByText } = render(<App />);
    expect(container.textContent).toContain("Kies je niveau");
    expect(getByText("Makkelijk")).toBeTruthy();
    expect(getByText("Middel")).toBeTruthy();
    expect(getByText("Moeilijk")).toBeTruthy();
  });

  it("na niveau + start wordt gedeeld: 8 kaarten voor de mens, biedfase", () => {
    const { container, getByText } = render(<App />);
    fireEvent.click(getByText("Makkelijk")); // niveau kiezen
    fireEvent.click(getByText("Start het potje")); // potje starten (standaard 16 rondes)
    expect(container.querySelectorAll(".hand .card")).toHaveLength(8);
    expect(container.textContent).toContain("Bieden");
    // 3 tegenstanders × 8 kaartruggen
    expect(container.querySelectorAll(".card--back")).toHaveLength(24);
  });
});
