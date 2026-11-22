import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegistrationForm from "./RegistrationForm";

const fetchMock = vi.fn();

function makeResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
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

describe("RegistrationForm", () => {
  it("sends the event and shows a success message", async () => {
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
    await openConfirm(user);

    expect(screen.getByRole("dialog")).toHaveTextContent("5€");
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Convites enviados com sucesso.",
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/email", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.currency).toBe("euro");
    expect(body.exclusions).toEqual([]);
  });

  it("shows the sending state while the request is in flight", async () => {
    const user = userEvent.setup();
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));

    const sending = screen.getAllByRole("button", { name: "Enviando..." });
    expect(sending).toHaveLength(2);
    for (const button of sending) expect(button).toBeDisabled();

    pending.resolve(
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
    expect(await screen.findByRole("status")).toHaveTextContent("Convites enviados com sucesso.");
  });

  it("supports santa mode via the header, including the keyboard", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);

    const header = screen.getByRole("button", { name: /cabeçalho festivo/i });
    header.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.keyboard("a");
    for (let index = 0; index < 5; index += 1) await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "Sortear — Ho Ho Ho!" })).toBeInTheDocument();
  });

  it("shows santa copy during a send", async () => {
    const user = userEvent.setup();
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);

    render(<RegistrationForm />);
    const header = screen.getByRole("button", { name: /cabeçalho festivo/i });
    for (let index = 0; index < 7; index += 1) await user.click(header);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Sortear — Ho Ho Ho!" }));
    await user.click(await screen.findByRole("button", { name: "Confirmar e enviar" }));

    expect(screen.getByRole("button", { name: "Ho Ho Ho..." })).toBeDisabled();
    pending.resolve(
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
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Ho Ho Ho! Convites enviados 🎅🎄",
    );
  });

  it("renders validation errors and blocks the confirmation", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);

    await user.clear(screen.getByLabelText(/nome do evento/i));
    await user.clear(screen.getByLabelText(/preço máximo/i));
    fireEvent.change(screen.getByLabelText(/data do evento/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/moeda/i), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Sortear!" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Nome do evento é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Preço é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Moeda é obrigatória")).toBeInTheDocument();
    expect(screen.getAllByText("Nome é obrigatório")).toHaveLength(2);
    expect(screen.getAllByText("Insira um e-mail válido")).toHaveLength(2);
    expect(screen.getByLabelText(/data do evento/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("shows name-only and email-only participant errors", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);

    await user.type(screen.getByLabelText(/nome do participante 1/i), "Ana");
    await user.type(screen.getByLabelText(/e-mail do participante 1/i), "ana@example.com");
    await user.type(screen.getByLabelText(/e-mail do participante 2/i), "bia@example.com");
    await user.click(screen.getByRole("button", { name: "Sortear!" }));

    expect(screen.getByText("Nome é obrigatório")).toBeInTheDocument();
    expect(screen.queryByText("Insira um e-mail válido")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/nome do participante 2/i), "Bia");
    await user.clear(screen.getByLabelText(/e-mail do participante 2/i));
    await user.type(screen.getByLabelText(/e-mail do participante 2/i), "bad");
    await user.click(screen.getByRole("button", { name: "Sortear!" }));

    expect(screen.getByText("Insira um e-mail válido")).toBeInTheDocument();
  });

  it("adds and removes participants", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);

    expect(screen.getAllByRole("group", { name: /participante \d+/i })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Adicionar participante" }));
    expect(screen.getAllByRole("group", { name: /participante \d+/i })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Remover participante 3" }));
    expect(screen.getAllByRole("group", { name: /participante \d+/i })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Remover participante 2" }));
    expect(screen.getAllByRole("group", { name: /participante \d+/i })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Sortear!" }));
    expect(screen.getByText("Adicione pelo menos 2 participantes")).toBeInTheDocument();
  });

  it("closes the modal from the overlay, the cancel button, and Escape", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);

    await user.click(screen.getByRole("heading", { name: "Confirmar envio" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("a");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await openConfirm(user);
    const overlay = screen.getByRole("dialog").parentElement;
    expect(overlay).not.toBeNull();
    await user.click(overlay!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("retries failed recipients until they succeed", async () => {
    const user = userEvent.setup();
    const retryPending = deferred<Response>();
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
      .mockReturnValueOnce(retryPending.promise)
      .mockResolvedValueOnce(
        makeResponse({ success: true, runId: "run-1", sent: 1, failedCount: 0, failures: [] }),
      );

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "1 convites enviados; 1 falharam.",
    );
    expect(screen.getByRole("button", { name: "Sortear!" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Reenviar 1 falha(s)" }));
    expect(screen.getByRole("button", { name: "Reenviando..." })).toBeDisabled();

    retryPending.resolve(
      makeResponse({
        success: false,
        runId: "run-1",
        sent: 0,
        failedCount: 1,
        failures: [{ email: "ana@example.com", reason: "still down" }],
      }),
    );
    expect(await screen.findByText("0 reenviados; 1 continuam a falhar.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reenviar 1 falha(s)" }));
    expect(await screen.findByText("Reenvio concluído.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reenviar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sortear!" })).toBeEnabled();
  });

  it("shows a server error message", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(makeResponse({ error: "Sorteio impossível." }, false));

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Sorteio impossível.");
  });

  it("falls back to a generic message without a server error", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(makeResponse({}, false));

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Falha ao enviar convites. Tente novamente.",
    );
  });

  it("shows the thrown error message", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));

    expect(await screen.findByRole("status")).toHaveTextContent("network down");
  });

  it("falls back to a generic message on a non-Error rejection", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce("nope");

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Falha ao enviar convites. Tente novamente.",
    );
  });

  it("shows a generic message when a retry fails", async () => {
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
      .mockRejectedValueOnce(new Error("retry exploded"));

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));
    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "Reenviar 1 falha(s)" }));

    expect(await screen.findByText("retry exploded")).toBeInTheDocument();
  });

  it("shows a retry server error message", async () => {
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
      .mockResolvedValueOnce(makeResponse({ error: "retry refused" }, false));

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));
    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "Reenviar 1 falha(s)" }));

    expect(await screen.findByText("retry refused")).toBeInTheDocument();
  });

  it("falls back to a generic message for a retry response without an error", async () => {
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
      .mockResolvedValueOnce(makeResponse({}, false));

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));
    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "Reenviar 1 falha(s)" }));

    expect(await screen.findByText("Falha no reenvio. Tente novamente.")).toBeInTheDocument();
  });

  it("falls back to a generic message on a non-Error retry rejection", async () => {
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
      .mockRejectedValueOnce("nope");

    render(<RegistrationForm />);
    await fillValidForm(user);
    await openConfirm(user);
    await user.click(screen.getByRole("button", { name: "Confirmar e enviar" }));
    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "Reenviar 1 falha(s)" }));

    expect(await screen.findByText("Falha no reenvio. Tente novamente.")).toBeInTheDocument();
  });
});
