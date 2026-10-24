import { render } from "@testing-library/react";
import { Toaster } from "sonner";
import { BoardView } from "@/components/board/board-view";
import { createDemoState, DEMO_BOARD_ID } from "@/lib/storage/demo-seed";
import { createBoardStore } from "@/store/board-store";
import { BoardStoreProvider } from "@/store/board-store-provider";

export const TEST_NOW = new Date(2026, 9, 23, 9, 0);

/** Renders the demo board with a deterministic store; returns the store for assertions. */
export function renderDemoBoard() {
  let n = 0;
  const store = createBoardStore(createDemoState(TEST_NOW), {
    createId: () => `test-${++n}`,
    now: () => TEST_NOW.toISOString(),
  });
  const result = render(
    <BoardStoreProvider store={store}>
      <BoardView boardId={DEMO_BOARD_ID} now={TEST_NOW} />
      <Toaster />
    </BoardStoreProvider>,
  );
  return { ...result, store, data: () => store.getState().data };
}
