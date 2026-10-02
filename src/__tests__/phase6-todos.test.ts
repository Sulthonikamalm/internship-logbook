import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { isTransitionAllowed, getAllowedTargetStageCodes } from "@/features/todos/domain/matrix";
import { calculateEvidenceHealth } from "@/features/todos/domain/health";
import { createTodoSchema, updateTodoSchema, transitionTodoSchema, reorderTodoSchema } from "@/features/todos/schemas/todo.schema";
import { transitionTodo } from "@/features/todos/server/transition-todo";
import { createTodo, updateTodo, reorderTodo, detachTodoEvidence } from "@/features/todos/server/mutations";
import { createActivity } from "@/features/activity/server/create-activity";
import { buildTodoSheet } from "@/features/reports/excel/build-todo-sheet";
import { revalidatePath } from "next/cache";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), auth: vi.fn(), single: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/require-active-user", () => ({ requireActiveUser: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mocks.from, rpc: mocks.rpc }) }));
const owner = "00000000-0000-4000-8000-0000000000a1";
const todoId = "00000000-0000-4000-8000-000000000001";
const stageId = "00000000-0000-4000-8000-000000000002";
const input = { todoId, targetStageId: stageId, expectedVersion: 4, idempotencyKey: "same-request", note: "Reviewed" };
const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), update: vi.fn(), delete: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: mocks.single };
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: owner, timezone: "Asia/Jakarta", isActive: true });
  for (const [name, method] of Object.entries(query)) if (name !== "maybeSingle") method.mockReturnValue(query);
  mocks.from.mockReturnValue(query); mocks.single.mockResolvedValue({ data: null, error: null });
  mocks.rpc.mockResolvedValue({ data: { ok: false, code: "EVIDENCE_REQUIRED", current: 0, minimum: 1, message: "Tambahkan bukti." }, error: null });
});
// Database authority, ownership, atomicity and trigger health are exercised against real
// Postgres by supabase/tests/phase8_integrity.sql, with every fixture rolled back.
  describe("1. Transition Matrix & Health Calculations", () => {
    it("permits standard forward workflow steps", () => {
      expect(isTransitionAllowed("BACKLOG", "TODO")).toBe(true);
      expect(isTransitionAllowed("TODO", "IN_PROGRESS")).toBe(true);
      expect(isTransitionAllowed("IN_PROGRESS", "REVIEW")).toBe(true);
      expect(isTransitionAllowed("REVIEW", "DONE")).toBe(true);
    });

    it("permits one-step backward movements and reopen from DONE", () => {
      expect(isTransitionAllowed("DONE", "REVIEW")).toBe(true);
      expect(isTransitionAllowed("REVIEW", "IN_PROGRESS")).toBe(true);
      expect(isTransitionAllowed("IN_PROGRESS", "TODO")).toBe(true);
      expect(isTransitionAllowed("TODO", "BACKLOG")).toBe(true);
    });

    it("strictly forbids skipping stages (e.g. BACKLOG -> DONE, TODO -> DONE)", () => {
      expect(isTransitionAllowed("BACKLOG", "DONE")).toBe(false);
      expect(isTransitionAllowed("BACKLOG", "IN_PROGRESS")).toBe(false);
      expect(isTransitionAllowed("TODO", "DONE")).toBe(false);
      expect(isTransitionAllowed("IN_PROGRESS", "DONE")).toBe(false);
    });

    it("rejects transition to the same stage", () => {
      expect(isTransitionAllowed("TODO", "TODO")).toBe(false);
      expect(isTransitionAllowed("DONE", "DONE")).toBe(false);
    });

    it("calculates evidence health properly", () => {
      expect(calculateEvidenceHealth("DONE", 1, 1)).toBe("OK");
      expect(calculateEvidenceHealth("DONE", 0, 1)).toBe("EVIDENCE_INCOMPLETE");
      expect(calculateEvidenceHealth("TODO", 0, 1)).toBe("OK");
    });

    it("returns allowed target stage codes for mobile menu", () => {
      expect(getAllowedTargetStageCodes("BACKLOG")).toEqual(["TODO"]);
      expect(getAllowedTargetStageCodes("TODO")).toEqual(["BACKLOG", "IN_PROGRESS"]);
      expect(getAllowedTargetStageCodes("DONE")).toEqual(["REVIEW"]);
    });
  });

  describe("2. Schema Validation", () => {
    it("validates createTodoSchema", () => {
      const valid = createTodoSchema.safeParse({
        title: "Setup CI test",
        priority: "HIGH",
        dueDate: "2026-10-15",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects blank title or excessive title length", () => {
      const empty = createTodoSchema.safeParse({ title: "   " });
      expect(empty.success).toBe(false);

      const tooLong = createTodoSchema.safeParse({ title: "A".repeat(201) });
      expect(tooLong.success).toBe(false);
    });

    it("validates updateTodoSchema with expectedVersion", () => {
      const valid = updateTodoSchema.safeParse({
        id: "00000000-0000-4000-8000-000000000001",
        title: "Updated Title",
        priority: "URGENT",
        expectedVersion: 2,
      });
      expect(valid.success).toBe(true);
    });

    it("validates transitionTodoSchema", () => {
      const valid = transitionTodoSchema.safeParse({
        todoId: "00000000-0000-4000-8000-000000000001",
        targetStageId: "00000000-0000-4000-8000-000000000002",
        expectedVersion: 1,
        idempotencyKey: "idem-123",
        note: "Passed testing",
      });
      expect(valid.success).toBe(true);
    });
  });
describe("Excel Todo sheet", () => {
    it("builds a styled Todos sheet with sanitized content", async () => {
      const wb = new ExcelJS.Workbook();
      const todosData = [
        {
          id: "t-1",
          title: "Build Kanban Board",
          priority: "HIGH",
          dueDate: "2026-10-10",
          stageName: "In Progress",
          startedAt: "2026-10-01T08:00:00Z",
          completedAt: null,
          evidenceCount: 2,
          evidenceHealth: "OK",
          activityCount: 1,
        },
        {
          id: "t-2",
          title: "=SUM(1,2)", // Formula injection attempt
          priority: "MEDIUM",
          dueDate: null,
          stageName: "Done",
          startedAt: "2026-09-20T08:00:00Z",
          completedAt: "2026-09-25T17:00:00Z",
          evidenceCount: 1,
          evidenceHealth: "OK",
          activityCount: 2,
        },
      ];

      buildTodoSheet(wb, todosData);
      const sheet = wb.getWorksheet("Todos");
      expect(sheet).toBeDefined();
      expect(sheet?.views[0]?.state).toBe("frozen");

      const header = sheet!.getRow(1);
      expect(header.getCell(1).value).toBe("No");
      expect(header.getCell(2).value).toBe("Judul Todo");
      expect(header.getCell(5).value).toBe("Tahap");
      expect(header.getCell(8).value).toBe("Evidence");

      const row1 = sheet!.getRow(2);
      expect(row1.getCell(2).value).toBe("Build Kanban Board");
      expect(row1.getCell(3).value).toBe("HIGH");
      expect(row1.getCell(5).value).toBe("In Progress");

      // Verify formula sanitization on row 2
      const row2 = sheet!.getRow(3);
      expect(row2.getCell(2).value).toBe("'=SUM(1,2)");
    });
  });
describe("Todo server boundary", () => {
  it("returns the authoritative gate result without advancing client state", async () => {
    const result = await transitionTodo(input);
    expect(result).toMatchObject({ ok: false, code: "EVIDENCE_REQUIRED", current: 0 });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("transition_todo", { p_todo_id: todoId, p_target_stage_id: stageId, p_expected_version: 4, p_idempotency_key: "same-request", p_note: "Reviewed" });
  });
  it("refreshes Home and Todo only after committed success", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, newVersion: 5, todoId, currentStageId: stageId, message: "Dipindah" }, error: null });
    expect((await transitionTodo(input)).ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/todos"); expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
  it("keeps database errors private", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "postgres private internals" } });
    expect(await transitionTodo(input)).toMatchObject({ ok: false, code: "ERROR" });
    expect(JSON.stringify(await transitionTodo(input))).not.toContain("postgres");
  });
  it("rejects invalid IDs before calling the database", async () => {
    expect((await transitionTodo({ ...input, todoId: "foreign" })).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect((await detachTodoEvidence("fake-relation")).ok).toBe(false);
  });
  it("does not claim a successful edit when optimistic update matches zero rows", async () => {
    const result = await updateTodo({ id: todoId, title: "Updated", priority: "HIGH", expectedVersion: 4 });
    expect(result.ok).toBe(false); expect(query.eq).toHaveBeenCalledWith("version", 4); expect(query.eq).toHaveBeenCalledWith("user_id", owner);
  });
  it("does not claim a successful reorder when the stage or version has changed", async () => {
    expect((await reorderTodo({ todoId, stageId, newSortOrder: 15, expectedVersion: 4 })).ok).toBe(false);
    expect(query.eq).toHaveBeenCalledWith("current_stage_id", stageId);
  });
  it("rejects non-finite ranks and invalid dates", () => {
    expect(reorderTodoSchema.safeParse({ todoId, stageId, newSortOrder: Infinity, expectedVersion: 4 }).success).toBe(false);
    expect(createTodoSchema.safeParse({ title: "Todo", dueDate: "2026-02-30" }).success).toBe(false);
  });
  it("prevents creation directly into a terminal stage", async () => {
    mocks.single.mockResolvedValue({ data: { id: stageId, code: "DONE" }, error: null });
    expect((await createTodo({ title: "Bypass", stageId })).ok).toBe(false);
  });
  it("authenticates before processing a transition", async () => {
    mocks.auth.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(transitionTodo(input)).rejects.toThrow("NEXT_REDIRECT"); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("creates Activity and its Todo link using one atomic database command", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: todoId, todo_id: todoId }, error: null });
    const result = await createActivity({ title: "Work", source: "manual", status: "READY", activityDate: "2026-10-01", idempotencyKey: stageId, todoId });
    expect(result.ok).toBe(true); expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("create_activity", expect.objectContaining({ p_todo_id: todoId, p_source: "todo" }));
  });
  it("reports a denied Todo link as a failure, without a second partial write", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect((await createActivity({ title: "Work", source: "manual", status: "DRAFT", idempotencyKey: stageId, todoId })).ok).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
