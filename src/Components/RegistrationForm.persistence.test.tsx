import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DRAFT_STORAGE_KEY, DRAFT_VERSION, type DraftValues } from "../lib/draft";
import RegistrationForm from "./RegistrationForm";

const fetchMock = vi.fn();

function makeResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

async function fillValidForm(user: UserEvent): Promise<void> {
  await user.type(screen.getByLabelText(/nome do participante 1/i), "Ana");
  await user.type(screen.getByLabelText(/e-mail do participante 1/i), "ana@example.com");
  await user.type(screen.getByLabelText(/nome do participante 2/i), "Bia");
  await user.type(screen.getByLabelText(/e-mail do participante 2/i), "bia@example.com");
}

async function openConfirm(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Sortear!" }));
  await screen.findByRole("dialog");
}

function storedDraft(): { version: number; savedAt: number; values: DraftValues } | null {
  const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

function dispatchDraft(values: DraftValues, key = DRAFT_STORAGE_KEY) {
  act(() => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: JSON.stringify({ version: DRAFT_VERSION, savedAt: Date.now(), values }),
      }),
    );
  });
}

const otherTabDraft: DraftValues = {
  eventName: "Natal da firma",
  eventDate: "2026-12-19",
  price: "30",
  currency: "dollar",
  participants: [
    { name: "Carla", email: "carla@example.com" },
    { name: "Duda", email: "duda@example.com" },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
  setOnline(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.localStorage.clear();
  setOnline(true);
});

describe("draft persistence", () => {
  it("saves after the debounce and restores the full form on the next visit", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<RegistrationForm />);

    fireEvent.change(screen.getByLabelText(/nome do evento/i), {
      target: { value: "Amigo Secreto da empresa" },
    });
    fireEvent.change(screen.getByLabelText(/data do evento/i), {
      target: { value: "2026-12-24" },
    });
    await user.click(screen.getByRole("button", { name: "Adicionar participante" }));

    await vi.waitFor(() => expect(storedDraft()).not.toBeNull());
    await vi.waitFor(() => expect(storedDraft()?.values.participants).toHaveLength(3));

    expect(storedDraft()?.values.eventName).toBe("Amigo Secreto da empresa");
    expect(storedDraft()?.values.eventDate).toBe("2026-12-24");
    expect(storedDraft()?.values.participants).toHaveLength(3);
    expect(screen.getByText("Rascunho guardado automaticamente.")).toBeInTheDocument();

    unmount();
    render(<RegistrationForm />);

    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Amigo Secreto da empresa");
    expect(screen.getByLabelText(/data do evento/i)).toHaveValue("2026-12-24");
    expect(screen.getAllByRole("group", { name: /participante \d+/i })).toHaveLength(3);
    expect(screen.getByText("Rascunho restaurado neste dispositivo.")).toBeInTheDocument();
  });

  it("does not touch storage before the debounce elapses", () => {
    render(<RegistrationForm />);

    fireEvent.change(screen.getByLabelText(/nome do evento/i), {
      target: { value: "Rascunho instantâneo" },
    });

    expect(storedDraft()).toBeNull();
  });

  it("ignores corrupt and old drafts instead of crashing", () => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, "{not-json");
    const first = render(<RegistrationForm />);
    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Amigo Secreto");
    expect(screen.queryByText(/rascunho/i)).not.toBeInTheDocument();
    first.unmount();

    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ version: DRAFT_VERSION + 1, savedAt: 1, values: otherTabDraft }),
    );
    render(<RegistrationForm />);
    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Amigo Secreto");
    expect(screen.queryByText(/rascunho/i)).not.toBeInTheDocument();
  });

  it("clears the draft on request and starts over", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);

    fireEvent.change(screen.getByLabelText(/nome do evento/i), {
      target: { value: "Amigo Secreto da firma" },
    });
    await vi.waitFor(() => expect(storedDraft()).not.toBeNull());

    await user.click(screen.getByRole("button", { name: "Limpar rascunho" }));

    expect(storedDraft()).toBeNull();
    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Amigo Secreto");
    expect(screen.getByLabelText(/nome do evento/i)).toHaveFocus();
    expect(screen.getByText("Rascunho limpo.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar rascunho" })).not.toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(storedDraft()).toBeNull();
  });

  it("clears the draft after a successful send", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        success: true,
        runId: "run-1",
        token: "token-1",
        sent: 2,
        failedCount: 0,
        failures: [],
        deduped: 0,
      }),
    );

    render(<RegistrationForm />);
    await fillValidForm(user);
    await vi.waitFor(() => expect(storedDraft()).not.toBeNull());

    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));
    await screen.findByRole("status");

    expect(storedDraft()).toBeNull();
    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Amigo Secreto");
  });

  it("clears the draft after retries finish delivery", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(
        makeResponse({
          success: false,
          runId: "run-1",
          token: "token-1",
          sent: 1,
          failedCount: 1,
          failures: [{ email: "ana@example.com", reason: "down" }],
          deduped: 0,
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({ success: true, runId: "run-1", sent: 1, failedCount: 0, failures: [] }),
      );

    render(<RegistrationForm />);
    await fillValidForm(user);
    await vi.waitFor(() => expect(storedDraft()).not.toBeNull());
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));
    await screen.findByRole("status");

    expect(storedDraft()).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Reenviar 1 falha(s)" }));
    await screen.findByText("Reenvio concluído.");

    expect(storedDraft()).toBeNull();
    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Amigo Secreto");
  });

  it("flushes a pending draft when the page is hidden", () => {
    render(<RegistrationForm />);
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(storedDraft()).toBeNull();

    fireEvent.change(screen.getByLabelText(/nome do evento/i), {
      target: { value: "Sorteio relâmpago" },
    });
    act(() => window.dispatchEvent(new Event("pagehide")));

    expect(storedDraft()?.values.eventName).toBe("Sorteio relâmpago");
  });

  it("keeps working when storage refuses writes", async () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });

    render(<RegistrationForm />);
    fireEvent.change(screen.getByLabelText(/nome do evento/i), {
      target: { value: "Amigo Secreto!" },
    });
    await vi.waitFor(() => expect(setItem).toHaveBeenCalled());

    expect(screen.queryByText("Rascunho guardado automaticamente.")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Amigo Secreto!");
    setItem.mockRestore();
  });
});

describe("offline behaviour", () => {
  it("shows a banner, disables sending, and keeps the draft", async () => {
    const user = userEvent.setup();
    setOnline(false);
    render(<RegistrationForm />);

    expect(screen.getByRole("status")).toHaveTextContent("Sem ligação à internet.");
    expect(screen.getByRole("button", { name: "Sortear!" })).toBeDisabled();

    await fillValidForm(user);
    const form = screen.getByRole("button", { name: "Sortear!" }).closest("form");
    fireEvent.submit(form as HTMLFormElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/nome do evento/i), {
      target: { value: "Sem rede" },
    });
    await vi.waitFor(() => expect(storedDraft()?.values.eventName).toBe("Sem rede"));

    act(() => window.dispatchEvent(new Event("online")));

    expect(screen.queryByText(/Sem ligação à internet/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sortear!" })).toBeEnabled();

    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.getByText(/Sem ligação à internet/)).toBeInTheDocument();
  });
});

describe("multi-tab sync", () => {
  it("adopts a draft written by another tab", () => {
    render(<RegistrationForm />);

    dispatchDraft(otherTabDraft);

    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Natal da firma");
    expect(screen.getByLabelText(/preço máximo/i)).toHaveValue(30);
    expect(screen.getByText("Rascunho sincronizado de outra aba.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar rascunho" })).toBeInTheDocument();
  });

  it("ignores storage events for other keys and corrupt payloads", () => {
    render(<RegistrationForm />);

    dispatchDraft(otherTabDraft, "another-app:key");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: DRAFT_STORAGE_KEY, newValue: "{broken" }),
      );
    });

    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Amigo Secreto");
    expect(screen.queryByText(/Rascunho sincronizado/)).not.toBeInTheDocument();
  });

  it("clears the form when another tab removes the draft", () => {
    render(<RegistrationForm />);
    dispatchDraft(otherTabDraft);
    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Natal da firma");

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: DRAFT_STORAGE_KEY, newValue: null }),
      );
    });

    expect(screen.getByLabelText(/nome do evento/i)).toHaveValue("Amigo Secreto");
    expect(screen.getByText("Rascunho limpo.")).toBeInTheDocument();
  });
});

describe("confirmation dialog focus", () => {
  it("traps Tab, closes on Escape, and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);

    const confirm = screen.getByRole("button", { name: "Confirmar e enviar" });
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    expect(confirm).toHaveFocus();

    await user.tab();
    expect(cancel).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();

    await user.tab();
    expect(confirm).toHaveFocus();

    (document.activeElement as HTMLElement).blur();
    await user.tab();
    expect(cancel).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sortear!" })).toHaveFocus();
  });
});
