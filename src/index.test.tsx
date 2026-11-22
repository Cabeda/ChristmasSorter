import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("bootstrap", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetModules();
  });

  it("mounts the app into #root", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await act(async () => {
      await import("./index");
    });
    expect(document.getElementById("root")?.textContent).toContain(
      "Organizador de Amigo Secreto",
    );
  });
});
