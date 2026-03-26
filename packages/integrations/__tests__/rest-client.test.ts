import { describe, it, expect, vi, beforeEach } from "vitest";
import { RestClientIntegration } from "../src/rest-client/index.js";

describe("RestClientIntegration", () => {
  let rest: RestClientIntegration;

  beforeEach(() => {
    rest = new RestClientIntegration();
  });

  it("should have correct name and description", () => {
    expect(rest.name).toBe("rest");
    expect(rest.description).toContain("HTTP");
  });

  it("should expose tool definitions", () => {
    const tools = rest.getToolDefinitions();
    expect(tools.length).toBeGreaterThanOrEqual(3);

    const names = tools.map((t) => t.function.name);
    expect(names).toContain("rest_get");
    expect(names).toContain("rest_post");
    expect(names).toContain("rest_request");
  });

  it("should execute GET requests", async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map([["content-type", "application/json"]]),
      json: async () => ({ message: "hello" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await rest.execute("get", {
      url: "https://api.example.com/test",
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/test", {
      method: "GET",
      headers: {},
      body: undefined,
    });

    vi.unstubAllGlobals();
  });

  it("should handle fetch errors gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const result = await rest.execute("get", { url: "https://fail.example.com" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Network error");

    vi.unstubAllGlobals();
  });

  it("should pass through POST body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: "Created",
      headers: new Map([["content-type", "application/json"]]),
      json: async () => ({ id: 1 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await rest.execute("post", {
      url: "https://api.example.com/items",
      body: { name: "test" },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "test" }),
      }),
    );

    vi.unstubAllGlobals();
  });
});
