import { describe, it, expect } from "vitest";
import { GmailIntegration } from "../src/gmail/index.js";
import { CalendarIntegration } from "../src/calendar/index.js";
import { TeslaIntegration } from "../src/tesla/index.js";
import { RobinhoodIntegration } from "../src/robinhood/index.js";
import { SchlageIntegration } from "../src/schlage/index.js";
import { RestClientIntegration } from "../src/rest-client/index.js";

describe("Integration tool definitions", () => {
  it("Gmail should expose correct tools", () => {
    const gmail = new GmailIntegration({
      credentialsPath: "/fake",
      tokenPath: "/fake",
    });
    expect(gmail.name).toBe("gmail");
    const tools = gmail.getToolDefinitions();
    expect(tools.length).toBeGreaterThanOrEqual(6);
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("gmail_list");
    expect(names).toContain("gmail_read");
    expect(names).toContain("gmail_send");
    expect(names).toContain("gmail_search");
    expect(names).toContain("gmail_archive");
    expect(names).toContain("gmail_mark_read");
  });

  it("Calendar should expose correct tools", () => {
    const cal = new CalendarIntegration({
      credentialsPath: "/fake",
      tokenPath: "/fake",
    });
    expect(cal.name).toBe("calendar");
    const tools = cal.getToolDefinitions();
    expect(tools.length).toBeGreaterThanOrEqual(4);
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("calendar_list");
    expect(names).toContain("calendar_create");
    expect(names).toContain("calendar_update");
    expect(names).toContain("calendar_delete");
  });

  it("Tesla should expose correct tools and require approval", () => {
    const tesla = new TeslaIntegration({});
    expect(tesla.name).toBe("tesla");
    expect(tesla.requiresApproval).toBe(true);
    const tools = tesla.getToolDefinitions();
    expect(tools.length).toBeGreaterThanOrEqual(10);
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("tesla_lock");
    expect(names).toContain("tesla_unlock");
    expect(names).toContain("tesla_climate_on");
    expect(names).toContain("tesla_charge_start");
    expect(names).toContain("tesla_honk");
    expect(names).toContain("tesla_trunk");
  });

  it("Robinhood should expose correct tools and require approval", () => {
    const rh = new RobinhoodIntegration({});
    expect(rh.name).toBe("robinhood");
    expect(rh.requiresApproval).toBe(true);
    const tools = rh.getToolDefinitions();
    expect(tools.length).toBeGreaterThanOrEqual(7);
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("robinhood_portfolio");
    expect(names).toContain("robinhood_quote");
    expect(names).toContain("robinhood_buy");
    expect(names).toContain("robinhood_sell");
    expect(names).toContain("robinhood_crypto_quote");
  });

  it("Schlage should expose correct tools and require approval", () => {
    const schlage = new SchlageIntegration({});
    expect(schlage.name).toBe("schlage");
    expect(schlage.requiresApproval).toBe(true);
    const tools = schlage.getToolDefinitions();
    expect(tools.length).toBeGreaterThanOrEqual(7);
    const names = tools.map((t) => t.function.name);
    expect(names).toContain("schlage_lock");
    expect(names).toContain("schlage_unlock");
    expect(names).toContain("schlage_access_codes");
    expect(names).toContain("schlage_add_code");
    expect(names).toContain("schlage_history");
  });

  it("REST client should not require approval", () => {
    const rest = new RestClientIntegration();
    expect(rest.requiresApproval).toBe(false);
  });

  it("All tool names should follow naming convention", () => {
    const allIntegrations = [
      new GmailIntegration({ credentialsPath: "/f", tokenPath: "/f" }),
      new CalendarIntegration({ credentialsPath: "/f", tokenPath: "/f" }),
      new TeslaIntegration({}),
      new RobinhoodIntegration({}),
      new SchlageIntegration({}),
      new RestClientIntegration(),
    ];

    for (const integration of allIntegrations) {
      for (const tool of integration.getToolDefinitions()) {
        expect(tool.function.name).toMatch(
          new RegExp(`^${integration.name}_`),
        );
        expect(tool.function.description).toBeTruthy();
        expect(tool.function.parameters).toBeDefined();
      }
    }
  });
});
