import { describe, expect, it } from "vitest";
import { moveGalleryItem, moveGalleryItemByStep } from "./reorder-gallery";

const items = [{ id: "cover" }, { id: "living" }, { id: "pool" }];

describe("reorder gallery model", () => {
  it("moves a dragged item before the target item", () => {
    expect(moveGalleryItem(items, "pool", "living").map((item) => item.id)).toEqual(["cover", "pool", "living"]);
  });

  it("keeps the same reference when the drag target is invalid", () => {
    expect(moveGalleryItem(items, "missing", "pool")).toBe(items);
    expect(moveGalleryItem(items, "cover", "missing")).toBe(items);
  });

  it("moves an item by a keyboard-friendly step", () => {
    expect(moveGalleryItemByStep(items, "living", -1).map((item) => item.id)).toEqual(["living", "cover", "pool"]);
    expect(moveGalleryItemByStep(items, "living", 1).map((item) => item.id)).toEqual(["cover", "pool", "living"]);
  });

  it("does not move outside the gallery bounds", () => {
    expect(moveGalleryItemByStep(items, "cover", -1)).toBe(items);
    expect(moveGalleryItemByStep(items, "pool", 1)).toBe(items);
  });
});
