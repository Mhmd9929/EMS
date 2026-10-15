/**
 * Pure helpers for self-referencing hierarchies (reporting lines, departments).
 */

/**
 * Would setting `nodeId.parent = newParentId` create a cycle?
 * `getParent` returns the current parent of a node (or null for a root).
 */
export function wouldCreateCycle(
  nodeId: string,
  newParentId: string | null | undefined,
  getParent: (id: string) => string | null | undefined,
  maxDepth = 10_000,
): boolean {
  if (!newParentId) return false;
  let current: string | null | undefined = newParentId;
  let steps = 0;
  const seen = new Set<string>();
  while (current) {
    if (current === nodeId) return true;
    if (seen.has(current)) return true; // existing corrupt cycle — refuse
    seen.add(current);
    current = getParent(current);
    if (++steps > maxDepth) return true;
  }
  return false;
}

export type TreeNode<T> = T & { children: TreeNode<T>[] };

/** Build a forest from a flat list. Items whose parent is missing become roots. */
export function buildTree<T extends { id: string }>(
  items: T[],
  getParentId: (item: T) => string | null | undefined,
): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  for (const item of items) byId.set(item.id, { ...item, children: [] });
  const roots: TreeNode<T>[] = [];
  for (const item of items) {
    const node = byId.get(item.id)!;
    const parentId = getParentId(item);
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** All descendant ids of `rootId` (excluding itself), breadth first. */
export function collectDescendants(
  rootId: string,
  childrenOf: (id: string) => string[],
): string[] {
  const result: string[] = [];
  const seen = new Set([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of childrenOf(id)) {
      if (seen.has(child)) continue;
      seen.add(child);
      result.push(child);
      queue.push(child);
    }
  }
  return result;
}

/** Ids on the path from a root down to `id` (inclusive). */
export function pathToRoot(id: string, getParent: (id: string) => string | null | undefined): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  let current: string | null | undefined = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    path.unshift(current);
    current = getParent(current);
  }
  return path;
}
