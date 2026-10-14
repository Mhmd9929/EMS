import { describe, expect, it } from "vitest";
import { buildTree, collectDescendants, pathToRoot, wouldCreateCycle } from "@/lib/tree";

// ceo ← dir ← mgr ← staff
const parents: Record<string, string | null> = { ceo: null, dir: "ceo", mgr: "dir", staff: "mgr", other: "ceo" };
const getParent = (id: string) => parents[id];

describe("wouldCreateCycle", () => {
  it("allows normal re-parenting", () => {
    expect(wouldCreateCycle("staff", "other", getParent)).toBe(false);
    expect(wouldCreateCycle("mgr", "ceo", getParent)).toBe(false);
    expect(wouldCreateCycle("dir", null, getParent)).toBe(false);
  });

  it("rejects self-reference", () => {
    expect(wouldCreateCycle("mgr", "mgr", getParent)).toBe(true);
  });

  it("rejects making someone report to their own (indirect) report", () => {
    expect(wouldCreateCycle("ceo", "staff", getParent)).toBe(true);
    expect(wouldCreateCycle("dir", "mgr", getParent)).toBe(true);
  });

  it("refuses when existing data already contains a loop", () => {
    const loop: Record<string, string> = { a: "b", b: "a" };
    expect(wouldCreateCycle("x", "a", (id) => loop[id])).toBe(true);
  });
});

describe("tree helpers", () => {
  const items = Object.entries(parents).map(([id, parent]) => ({ id, parent }));

  it("builds a forest", () => {
    const tree = buildTree(items, (i) => i.parent);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("ceo");
    expect(tree[0].children.map((c) => c.id).sort()).toEqual(["dir", "other"]);
  });

  it("treats orphans as roots", () => {
    const tree = buildTree([{ id: "a", parent: "missing" }], (i) => i.parent);
    expect(tree.map((t) => t.id)).toEqual(["a"]);
  });

  it("collects direct and indirect descendants", () => {
    const childrenOf = (id: string) => items.filter((i) => i.parent === id).map((i) => i.id);
    expect(collectDescendants("dir", childrenOf).sort()).toEqual(["mgr", "staff"]);
    expect(collectDescendants("ceo", childrenOf)).toHaveLength(4);
  });

  it("returns the path from the root", () => {
    expect(pathToRoot("staff", getParent)).toEqual(["ceo", "dir", "mgr", "staff"]);
  });
});
