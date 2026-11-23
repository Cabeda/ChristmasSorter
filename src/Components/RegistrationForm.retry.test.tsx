import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DRAFT_STORAGE_KEY, DRAFT_VERSION, type DraftValues } from "../lib/draft";
import { RequestTimeoutError } from "../lib/http";
import {
  RETRY_STORAGE_KEY,
  RETRY_VERSION,
  type PendingRetry,
} from "../lib/retry";
import RegistrationForm from "./RegistrationForm";

const fetchMock = vi.fn();

const retry: PendingRetry = {
  token: "token-1",
  emails: ["ana@example.com"],
  count: 1,
};

const draftValues: DraftValues = {
  eventName: "Natal da firma",
  eventDate: "2026-12-19",
  price: "30",
  currency: "dollar",
  participants: [
    { name: "Carla", email: "carla@example.com" },
    { name: "Duda", email: "duda@example.com" },
  ],
};

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

function storedRetry(): { version: number; savedAt: number } & PendingRetry | null {
  const raw = window.localStorage.getItem(RETRY_STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

function storeRetry(value: PendingRetry): void {
  window.localStorage.setItem(
    RETRY_STORAGE_KEY,
    JSON.stringify({ version: RETRY_VERSION, savedAt: Date.now(), ...value }),
  );
}

function storeDraft(values: DraftValues): void {
  window.localStorage.setItem(
    DRAFT_STORAGE_KEY,
    JSON.stringify({ version: DRAFT_VERSION, savedAt: Date.now(), values }),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("pending retry persistence", () => {
  it("restores a pending retry on load", () => {
    storeRetry(retry);
    render(<RegistrationForm />);

    expect(screen.getByText("1 convite(s) não chegaram. Pode reenviar apenas esses.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar 1 falha(s)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sortear!" })).toBeDisabled();
  });

  it("persists a partial send and can retry it after a reload", async () => {
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

    const first = render(<RegistrationForm />);
    await fillValidForm(user);
    await vi.waitFor(() =>
      expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull(),
    );
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));
    await screen.findByRole("status");

    expect(storedRetry()).toMatchObject({
      token: "token-1",
      emails: ["ana@example.com"],
      count: 1,
    });

    first.unmount();
    render(<RegistrationForm />);

    expect(screen.getByRole("button", { name: "Reenviar 1 falha(s)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reenviar 1 falha(s)" }));

    expect(await screen.findByText("Reenvio concluído.")).toBeInTheDocument();
    expect(storedRetry()).toBeNull();
  });

  it("clears the pending retry with the draft", async () => {
    const user = userEvent.setup();
    storeDraft(draftValues);
    storeRetry(retry);
    render(<RegistrationForm />);

    await user.click(screen.getByRole("button", { name: "Limpar rascunho" }));

    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    expect(storedRetry()).toBeNull();
    expect(screen.queryByRole("button", { name: /Reenviar/ })).not.toBeInTheDocument();
  });

  it("shows the timeout message", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new RequestTimeoutError());

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "O pedido demorou demasiado. Tente novamente.",
    );
  });

  it("clears without crashing when the event-name input is gone", async () => {
    const user = userEvent.setup();
    storeDraft(draftValues);
    render(<RegistrationForm />);

    fireEvent.change(screen.getByLabelText(/nome do evento/i), {
      target: { value: "Sem input" },
    });
    screen.getByLabelText(/nome do evento/i).remove();

    await user.click(screen.getByRole("button", { name: "Limpar rascunho" }));

    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });
});
