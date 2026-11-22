import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the heading and the registration form", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: /organizador de amigo secreto/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cabeçalho festivo/i })).toBeInTheDocument();
  });
});
