import { describe, expect, it } from "vitest";
import { buildMemberListEndpoint } from "./member-list-query";

describe("buildMemberListEndpoint", () => {
  it("uses the paginated members endpoint when there is no filter", () => {
    expect(buildMemberListEndpoint({ pageNumber: 2, pageQuantity: 25 })).toBe(
      "/api/members?pageNumber=2&pageQuantity=25"
    );
  });

  it("sends a normalized search to the regular endpoint", () => {
    expect(
      buildMemberListEndpoint({
        pageNumber: 1,
        pageQuantity: 50,
        querySearch: "  Maria Silva  ",
      })
    ).toBe("/api/members?pageNumber=1&pageQuantity=50&querySearch=Maria+Silva");
  });

  it.each([
    ["federationId", 4],
    ["churchId", 12],
    ["cellId", 30],
  ] as const)(
    "uses the filter endpoint when %s is selected",
    (filterName, filterId) => {
      expect(
        buildMemberListEndpoint({
          pageNumber: 3,
          pageQuantity: 10,
          [filterName]: filterId,
        })
      ).toBe(
        `/api/members/filter?pageNumber=3&pageQuantity=10&${filterName}=${filterId}`
      );
    }
  );

  it("keeps search, pagination and scope filters in the same server request", () => {
    expect(
      buildMemberListEndpoint({
        pageNumber: 1,
        pageQuantity: 100,
        querySearch: "João",
        federationId: 2,
        churchId: 8,
        cellId: 21,
      })
    ).toBe(
      "/api/members/filter?pageNumber=1&pageQuantity=100&querySearch=Jo%C3%A3o&federationId=2&churchId=8&cellId=21"
    );
  });
});
