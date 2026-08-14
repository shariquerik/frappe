import { describe, expect, it } from "vitest";
import { createCommitChannel } from "../commitChannel";
import type { RowAddress } from "../../../components/Fields/types";

function channel() {
  const fired: string[] = [];
  const commits = createCommitChannel({ dispatch: (event) => void fired.push(event) });
  return { commits, fired };
}

const row: RowAddress = { parentfield: "products", key: "row-1" };

describe("createCommitChannel", () => {
  it("fires a top-level field under its own name", () => {
    const { commits, fired } = channel();
    commits.commit("status");
    expect(fired).toEqual(["status"]);
  });

  it("addresses a child field by its table", () => {
    const { commits, fired } = channel();
    commits.commit("qty", row);
    expect(fired).toEqual(["products.qty"]);
  });

  it("fires add and remove on the same dotted family", () => {
    const { commits, fired } = channel();
    commits.rowChanged(row, "add");
    commits.rowChanged(row, "remove");
    expect(fired).toEqual(["products.add", "products.remove"]);
  });

  it("fires nothing while an edit is only pending", () => {
    const { commits, fired } = channel();
    commits.pending("qty");
    expect(fired).toEqual([]);
  });

  it("flushes a pending edit once, then has nothing left to flush", async () => {
    const { commits, fired } = channel();
    commits.pending("qty");
    await commits.flush();
    await commits.flush();
    expect(fired).toEqual(["qty"]);
  });

  it("flushes the pending edit at its row address", async () => {
    const { commits, fired } = channel();
    commits.pending("qty", row);
    await commits.flush();
    expect(fired).toEqual(["products.qty"]);
  });

  it("a commit clears the pending edit, so a later save does not refire it", async () => {
    const { commits, fired } = channel();
    commits.pending("qty");
    commits.commit("qty");
    await commits.flush();
    expect(fired).toEqual(["qty"]);
  });

  it("a row add or remove clears the pending edit", async () => {
    const { commits, fired } = channel();
    commits.pending("qty", row);
    commits.rowChanged(row, "remove");
    await commits.flush();
    expect(fired).toEqual(["products.remove"]);
  });

  it("awaits the handler it flushes, so the save cannot outrun it", async () => {
    const order: string[] = [];
    const commits = createCommitChannel({
      dispatch: async (event) => {
        await Promise.resolve();
        order.push(event);
      },
    });
    commits.pending("qty");
    await commits.flush();
    order.push("before_save");
    expect(order).toEqual(["qty", "before_save"]);
  });
});
