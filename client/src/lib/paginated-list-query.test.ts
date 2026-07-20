import { describe, expect, it } from "vitest";
import { buildPaginatedListEndpoint } from "./paginated-list-query";

describe("buildPaginatedListEndpoint", () => {
  it("builds a paginated request", () => {
    expect(buildPaginatedListEndpoint("/api/families", {
      pageNumber: 2,
      pageQuantity: 25,
    })).toBe("/api/families?pageNumber=2&pageQuantity=25");
  });

  it("normalizes and encodes querySearch", () => {
    expect(buildPaginatedListEndpoint("/api/cells", {
      pageNumber: 1,
      pageQuantity: 50,
      querySearch: "  Célula Norte  ",
    })).toBe(
      "/api/cells?pageNumber=1&pageQuantity=50&querySearch=C%C3%A9lula+Norte"
    );
  });

  it("adds only defined server filters", () => {
    expect(buildPaginatedListEndpoint("/api/families/filter", {
      pageNumber: 3,
      pageQuantity: 10,
      querySearch: "Silva",
      filters: { churchId: 8, cellId: undefined },
    })).toBe(
      "/api/families/filter?pageNumber=3&pageQuantity=10&querySearch=Silva&churchId=8"
    );
  });
});
