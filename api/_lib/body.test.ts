import { describe, expect, it } from "vitest";
import { parseRequestBody } from "./body";
import { HttpError } from "./errors";

describe("parseRequestBody", () => {
  it("passes a non-string body through unchanged", () => {
    const body = { hello: "world" };
    expect(parseRequestBody(body)).toBe(body);
  });

  it("parses a JSON string", () => {
    expect(parseRequestBody('{"hello":"world"}')).toEqual({ hello: "world" });
  });

  it("throws a 400 on invalid JSON", () => {
    expect(() => parseRequestBody("{")).toThrow(HttpError);
    expect(() => parseRequestBody("{")).toThrow("Invalid JSON body.");
  });
});
