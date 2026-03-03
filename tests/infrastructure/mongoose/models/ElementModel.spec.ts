import { describe, expect, it } from "vitest";

import ElementModel from "@/infrastructure/mongoose/models/ElementModel.js";
import { makeElementProps } from "../../../support/elementFixture.js";

describe("ElementModel schema", () => {
  it("validates a complete element payload", () => {
    const document = new ElementModel(makeElementProps());

    const validationError = document.validateSync();

    expect(validationError).toBeUndefined();
  });

  it("declares unique constraints for symbol and name", () => {
    const symbolPath = ElementModel.schema.path("symbol");
    const namePath = ElementModel.schema.path("name");

    expect(symbolPath.options.unique).toBe(true);
    expect(namePath.options.unique).toBe(true);
  });

  it("rejects payload without required fields", () => {
    const payload = makeElementProps();
    const { summary: _summary, ...payloadWithoutSummary } = payload;
    const document = new ElementModel(payloadWithoutSummary);

    const validationError = document.validateSync();

    expect(validationError).toBeDefined();
    expect(validationError?.errors.summary).toBeDefined();
  });
});
