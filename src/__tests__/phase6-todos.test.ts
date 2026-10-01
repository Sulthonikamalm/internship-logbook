/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { isTransitionAllowed, getAllowedTargetStageCodes } from "@/features/todos/domain/matrix";
import { calculateEvidenceHealth } from "@/features/todos/domain/health";
import {
  createTodoSchema,
  updateTodoSchema,
  transitionTodoSchema,
} from "@/features/todos/schemas/todo.schema";
import { transitionTodo } from "@/features/todos/server/transition-todo";
import {
  createTodo,
  updateTodo,
  deleteTodo,
  reorderTodo,
  attachTodoEvidence,
  detachTodoEvidence,
} from "@/features/todos/server/mutations";
import { getBoardData } from "@/features/todos/server/get-board-data";
import { getTodoDetail } from "@/features/todos/server/get-todo-detail";
import { buildTodoSheet } from "@/features/reports/excel/build-todo-sheet";

import { createActivity } from "@/features/activity/server/create-activity";
import { getExportData } from "@/features/reports/server/get-export-data";

// Test Users
const userA = {
  userId: "00000000-0000-4000-8000-0000000000a1",
  email: "user_a@internflow.invalid",
  role: "intern" as const,
  displayName: "Sulthon User A",
  timezone: "Asia/Jakarta",
  isActive: true,
  contentReadAll: false,
};

const userB = {
  userId: "00000000-0000-4000-8000-0000000000b2",
  email: "user_b@internflow.invalid",
  role: "intern" as const,
  displayName: "Hacker User B",
  timezone: "Asia/Jakarta",
  isActive: true,
  contentReadAll: false,
};

let currentUser = userA;

// Mock stages
const mockStages = [
  {
    id: "stage-backlog",
    code: "BACKLOG",
    name: "Backlog",
    position: 10,
    requires_evidence_on_enter: false,
    requires_evidence_on_exit: false,
    minimum_evidence_count: 0,
    allowed_evidence_types: null,
    requires_note: false,
    is_terminal: false,
  },
  {
    id: "stage-todo",
    code: "TODO",
    name: "To Do",
    position: 20,
    requires_evidence_on_enter: false,
    requires_evidence_on_exit: false,
    minimum_evidence_count: 0,
    allowed_evidence_types: null,
    requires_note: false,
    is_terminal: false,
  },
  {
    id: "stage-in-progress",
    code: "IN_PROGRESS",
    name: "In Progress",
    position: 30,
    requires_evidence_on_enter: false,
    requires_evidence_on_exit: false,
    minimum_evidence_count: 0,
    allowed_evidence_types: null,
    requires_note: false,
    is_terminal: false,
  },
  {
    id: "stage-review",
    code: "REVIEW",
    name: "Review",
    position: 40,
    requires_evidence_on_enter: true,
    requires_evidence_on_exit: false,
    minimum_evidence_count: 1,
    allowed_evidence_types: ["PHOTO", "LINK"],
    requires_note: false,
    is_terminal: false,
  },
  {
    id: "stage-done",
    code: "DONE",
    name: "Done",
    position: 50,
    requires_evidence_on_enter: true,
    requires_evidence_on_exit: false,
    minimum_evidence_count: 1,
    allowed_evidence_types: ["PHOTO", "LINK"],
    requires_note: false,
    is_terminal: true,
  },
];

// Mock database state
const mockDb = {
  todos: [] as any[],
  todoStages: [...mockStages],
  todoTransitions: [] as any[],
  todoEvidences: [] as any[],
  evidences: [] as any[],
  activities: [] as any[],
  auditLogs: [] as any[],
};

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/require-active-user", () => ({
  requireActiveUser: async () => currentUser,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: async (row: any) => {
        if (table === "audit_logs") {
          mockDb.auditLogs.push(row);
        }
        return { error: null };
      },
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: any) => {
      if (fn === "create_activity_idempotent") {
        const act = {
          id: `act-${crypto.randomUUID()}`,
          user_id: currentUser.userId,
          title: args.p_title,
          description: args.p_description,
          activity_date: args.p_activity_date,
          start_time: args.p_start_time,
          end_time: args.p_end_time,
          source: args.p_source,
          status: args.p_status,
          todo_id: null,
          created_at: new Date().toISOString(),
          deleted_at: null,
        };
        mockDb.activities.push(act);
        return { data: act, error: null };
      }
      return { data: null, error: null };
    },
    from: (table: string) => {
      const filters: { field: string; op: string; val: any }[] = [];
      let isAscending = true;
      let orderField = "created_at";

      const chain: any = {
        select: () => chain,
        eq: (field: string, val: any) => {
          filters.push({ field, op: "eq", val });
          return chain;
        },
        in: (field: string, val: any[]) => {
          filters.push({ field, op: "in", val });
          return chain;
        },
        is: (field: string, val: any) => {
          filters.push({ field, op: "is", val });
          return chain;
        },
        gte: (field: string, val: any) => {
          filters.push({ field, op: "gte", val });
          return chain;
        },
        lte: (field: string, val: any) => {
          filters.push({ field, op: "lte", val });
          return chain;
        },
        order: (field: string, options?: { ascending?: boolean }) => {
          orderField = field;
          isAscending = options?.ascending ?? true;
          return chain;
        },
        limit: () => chain,
        single: () => chain.then((res: any) => ({ data: res.data[0] ?? null, error: null })),
        maybeSingle: () => chain.then((res: any) => ({ data: res.data[0] ?? null, error: null })),
        insert: (row: any) => {
          const inserted = {
            id: row.id || `gen-${crypto.randomUUID()}`,
            deleted_at: null,
            created_at: new Date().toISOString(),
            ...row,
          };
          if (table === "todos") mockDb.todos.push(inserted);
          else if (table === "todo_transitions") mockDb.todoTransitions.push(inserted);
          else if (table === "todo_evidences") mockDb.todoEvidences.push(inserted);

          const payload = { data: inserted, error: null };
          return {
            ...payload,
            select: () => ({
              single: async () => payload,
              maybeSingle: async () => payload,
            }),
            then: (resolve: any) => resolve(payload),
          };
        },
        update: (values: any) => {
          const applyUpdate = (filterMap: Record<string, any>) => {
            const collection = table === "todos" ? mockDb.todos : table === "activities" ? mockDb.activities : [];
            const target = collection.find((item: any) =>
              Object.entries(filterMap).every(([k, v]) => item[k] === v)
            );
            if (target) Object.assign(target, values);
            return target ? { ...target } : null;
          };

          return {
            eq: (field1: string, val1: any) => ({
              eq: (field2: string, val2: any) => ({
                eq: (field3: string, val3: any) => {
                  const updatedItem = applyUpdate({ [field1]: val1, [field2]: val2, [field3]: val3 });
                  return {
                    error: null,
                    select: () => ({ maybeSingle: () => ({ data: updatedItem, error: null }) }),
                  };
                },
                maybeSingle: () => {
                  const updatedItem = applyUpdate({ [field1]: val1, [field2]: val2 });
                  return { data: updatedItem, error: null };
                },
                then: (resolve: any) => {
                  applyUpdate({ [field1]: val1, [field2]: val2 });
                  return resolve({ error: null });
                },
              }),
              then: (resolve: any) => {
                applyUpdate({ [field1]: val1 });
                return resolve({ error: null });
              },
            }),
          };
        },
        delete: () => ({
          eq: (field1: string, val1: any) => ({
            eq: (field2: string, val2: any) => {
              if (table === "todo_evidences") {
                mockDb.todoEvidences = mockDb.todoEvidences.filter(
                  (e) => !(e[field1] === val1 && e[field2] === val2)
                );
              }
              return { error: null };
            },
          }),
        }),
        then: (resolve: any) => {
          let list: any[] = [];
          if (table === "todos") list = [...mockDb.todos];
          else if (table === "todo_stages") list = [...mockDb.todoStages];
          else if (table === "todo_transitions") list = [...mockDb.todoTransitions];
          else if (table === "todo_evidences") list = [...mockDb.todoEvidences];
          else if (table === "evidences") list = [...mockDb.evidences];
          else if (table === "activities") list = [...mockDb.activities];

          for (const f of filters) {
            if (f.op === "eq") list = list.filter((item) => item[f.field] === f.val);
            else if (f.op === "is") list = list.filter((item) => item[f.field] === f.val);
            else if (f.op === "in") list = list.filter((item) => f.val.includes(item[f.field]));
          }

          list.sort((a, b) => {
            const valA = a[orderField] ?? "";
            const valB = b[orderField] ?? "";
            if (valA < valB) return isAscending ? -1 : 1;
            if (valA > valB) return isAscending ? 1 : -1;
            return 0;
          });

          return resolve({ data: list, error: null });
        },
      };
      return chain;
    },
  }),
}));

describe("Phase 6: Todo Kanban & Evidence Gates", () => {
  beforeEach(() => {
    currentUser = userA;
    mockDb.todos = [];
    mockDb.todoTransitions = [];
    mockDb.todoEvidences = [];
    mockDb.evidences = [];
    mockDb.activities = [];
    mockDb.auditLogs = [];
  });

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

  describe("3. Authoritative Server Transition & Evidence Gate", () => {
    it("blocks transition to REVIEW if evidence requirement is not met", async () => {
      // Todo in IN_PROGRESS with 0 attached evidence
      mockDb.todos.push({
        id: "todo-gate-1",
        user_id: userA.userId,
        title: "Feature Without Evidence",
        current_stage_id: "stage-in-progress",
        version: 1,
        deleted_at: null,
      });

      const res = await transitionTodo({
        todoId: "todo-gate-1",
        targetStageId: "stage-review",
        expectedVersion: 1,
        idempotencyKey: "idem-gate-fail",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("EVIDENCE_REQUIRED");
        expect(res.minimum).toBe(1);
        expect(res.current).toBe(0);
      }
    });

    it("permits transition to REVIEW when valid AVAILABLE evidence is attached", async () => {
      mockDb.todos.push({
        id: "todo-gate-2",
        user_id: userA.userId,
        title: "Feature With Evidence",
        current_stage_id: "stage-in-progress",
        version: 1,
        deleted_at: null,
      });

      // User's available evidence
      mockDb.evidences.push({
        id: "ev-proof-1",
        user_id: userA.userId,
        type: "PHOTO",
        status: "AVAILABLE",
        deleted_at: null,
      });

      mockDb.todoEvidences.push({
        id: "rel-1",
        todo_id: "todo-gate-2",
        evidence_id: "ev-proof-1",
        attached_by: userA.userId,
      });

      const res = await transitionTodo({
        todoId: "todo-gate-2",
        targetStageId: "stage-review",
        expectedVersion: 1,
        idempotencyKey: "idem-gate-pass",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.newVersion).toBe(2);
        expect(res.currentStageId).toBe("stage-review");
      }

      // Check transition history
      expect(mockDb.todoTransitions.length).toBe(1);
      expect(mockDb.todoTransitions[0].from_stage_id).toBe("stage-in-progress");
      expect(mockDb.todoTransitions[0].to_stage_id).toBe("stage-review");
      expect(mockDb.todoTransitions[0].evidence_count).toBe(1);
    });

    it("ignores BROKEN or deleted evidence for gate evaluation", async () => {
      mockDb.todos.push({
        id: "todo-gate-3",
        user_id: userA.userId,
        title: "Broken Evidence Todo",
        current_stage_id: "stage-in-progress",
        version: 1,
        deleted_at: null,
      });

      // Evidence is marked BROKEN
      mockDb.evidences.push({
        id: "ev-broken-1",
        user_id: userA.userId,
        type: "PHOTO",
        status: "BROKEN",
        deleted_at: null,
      });

      mockDb.todoEvidences.push({
        id: "rel-broken",
        todo_id: "todo-gate-3",
        evidence_id: "ev-broken-1",
        attached_by: userA.userId,
      });

      const res = await transitionTodo({
        todoId: "todo-gate-3",
        targetStageId: "stage-review",
        expectedVersion: 1,
        idempotencyKey: "idem-broken",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("EVIDENCE_REQUIRED");
        expect(res.current).toBe(0);
      }
    });

    it("rejects on optimistic lock version mismatch (409 CONFLICT)", async () => {
      mockDb.todos.push({
        id: "todo-conflict-1",
        user_id: userA.userId,
        title: "Stale Todo",
        current_stage_id: "stage-todo",
        version: 3, // Current version is 3
        deleted_at: null,
      });

      const res = await transitionTodo({
        todoId: "todo-conflict-1",
        targetStageId: "stage-in-progress",
        expectedVersion: 2, // Client had stale version 2
        idempotencyKey: "idem-stale",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("CONFLICT");
        expect(res.message).toContain("Todo telah berubah");
      }
    });

    it("manages timestamps: sets started_at upon IN_PROGRESS and completed_at upon DONE", async () => {
      mockDb.todos.push({
        id: "todo-time-1",
        user_id: userA.userId,
        title: "Time Tracker",
        current_stage_id: "stage-todo",
        version: 1,
        started_at: null,
        completed_at: null,
        deleted_at: null,
      });

      // Move TODO -> IN_PROGRESS
      const res1 = await transitionTodo({
        todoId: "todo-time-1",
        targetStageId: "stage-in-progress",
        expectedVersion: 1,
        idempotencyKey: "idem-time-1",
      });

      expect(res1.ok).toBe(true);
      const todoInDb = mockDb.todos.find((t) => t.id === "todo-time-1");
      expect(todoInDb.started_at).not.toBeNull();

      // Attach evidence for Review & Done
      mockDb.evidences.push({
        id: "ev-time",
        user_id: userA.userId,
        type: "LINK",
        status: "AVAILABLE",
        deleted_at: null,
      });
      mockDb.todoEvidences.push({
        id: "rel-time",
        todo_id: "todo-time-1",
        evidence_id: "ev-time",
        attached_by: userA.userId,
      });

      // Move IN_PROGRESS -> REVIEW
      await transitionTodo({
        todoId: "todo-time-1",
        targetStageId: "stage-review",
        expectedVersion: 2,
        idempotencyKey: "idem-time-2",
      });

      // Move REVIEW -> DONE
      const res3 = await transitionTodo({
        todoId: "todo-time-1",
        targetStageId: "stage-done",
        expectedVersion: 3,
        idempotencyKey: "idem-time-3",
      });

      expect(res3.ok).toBe(true);
      expect(todoInDb.completed_at).not.toBeNull();

      // Reopen from DONE -> REVIEW (clears completed_at)
      const res4 = await transitionTodo({
        todoId: "todo-time-1",
        targetStageId: "stage-review",
        expectedVersion: 4,
        idempotencyKey: "idem-time-4",
      });

      expect(res4.ok).toBe(true);
      expect(todoInDb.completed_at).toBeNull();
    });

    it("respects idempotency key and prevents duplicate transition records", async () => {
      mockDb.todos.push({
        id: "todo-idem",
        user_id: userA.userId,
        title: "Idempotent Todo",
        current_stage_id: "stage-todo",
        version: 1,
        deleted_at: null,
      });

      const key = "key-repeat-123";

      // First call
      const res1 = await transitionTodo({
        todoId: "todo-idem",
        targetStageId: "stage-in-progress",
        expectedVersion: 1,
        idempotencyKey: key,
      });
      expect(res1.ok).toBe(true);

      // Second call with same idempotencyKey
      const res2 = await transitionTodo({
        todoId: "todo-idem",
        targetStageId: "stage-in-progress",
        expectedVersion: 2,
        idempotencyKey: key,
      });
      expect(res2.ok).toBe(true);
      expect(mockDb.todoTransitions.length).toBe(1); // Still only 1 transition recorded
    });
  });

  describe("4. Multi-User Isolation & Security", () => {
    it("prevents User A from reading or modifying User B's Todos", async () => {
      mockDb.todos.push({
        id: "todo-secret-b",
        user_id: userB.userId,
        title: "Secret User B Task",
        current_stage_id: "stage-todo",
        version: 1,
        deleted_at: null,
      });

      currentUser = userA;

      // User A attempts to transition User B's Todo
      const transRes = await transitionTodo({
        todoId: "todo-secret-b",
        targetStageId: "stage-in-progress",
        expectedVersion: 1,
        idempotencyKey: "hacker-trans",
      });
      expect(transRes.ok).toBe(false);
      if (!transRes.ok) {
        expect(transRes.code).toBe("NOT_FOUND");
      }

      // User A attempts to get User B's Todo details
      const detail = await getTodoDetail("todo-secret-b");
      expect(detail).toBeNull();
    });

    it("prevents attaching User B's evidence to User A's Todo", async () => {
      mockDb.todos.push({
        id: "todo-a-secure",
        user_id: userA.userId,
        title: "User A Todo",
        current_stage_id: "stage-todo",
        version: 1,
        deleted_at: null,
      });

      mockDb.evidences.push({
        id: "ev-b-confidential",
        user_id: userB.userId, // Owned by User B
        title: "User B Evidence",
        status: "AVAILABLE",
        deleted_at: null,
      });

      currentUser = userA;
      const attachRes = await attachTodoEvidence({
        todoId: "todo-a-secure",
        evidenceId: "ev-b-confidential",
      });

      expect(attachRes.ok).toBe(false);
      if (!attachRes.ok) {
        expect(attachRes.code).toBe("NOT_FOUND");
      }
      expect(mockDb.todoEvidences.length).toBe(0);
    });

    it("prevents attaching User A's evidence to User B's Todo", async () => {
      mockDb.todos.push({
        id: "todo-b-victim",
        user_id: userB.userId,
        title: "User B Todo",
        current_stage_id: "stage-todo",
        version: 1,
        deleted_at: null,
      });

      mockDb.evidences.push({
        id: "ev-a-valid",
        user_id: userA.userId,
        title: "User A Evidence",
        status: "AVAILABLE",
        deleted_at: null,
      });

      currentUser = userA;
      const attachRes = await attachTodoEvidence({
        todoId: "todo-b-victim",
        evidenceId: "ev-a-valid",
      });

      expect(attachRes.ok).toBe(false);
      if (!attachRes.ok) {
        expect(attachRes.code).toBe("NOT_FOUND");
      }
      expect(mockDb.todoEvidences.length).toBe(0);
    });

    it("guards Activity creation with todoId against cross-owner or deleted Todos", async () => {
      const foreignTodoId = "00000000-0000-4000-8000-0000000000b9";
      const deletedTodoId = "00000000-0000-4000-8000-0000000000a8";
      const activeTodoId = "00000000-0000-4000-8000-0000000000a7";

      // User B's todo
      mockDb.todos.push({
        id: foreignTodoId,
        user_id: userB.userId,
        title: "User B Foreign Todo",
        current_stage_id: "stage-todo",
        version: 1,
        deleted_at: null,
      });

      // User A's deleted todo
      mockDb.todos.push({
        id: deletedTodoId,
        user_id: userA.userId,
        title: "User A Deleted Todo",
        current_stage_id: "stage-todo",
        version: 1,
        deleted_at: new Date().toISOString(),
      });

      // User A's valid active todo
      mockDb.todos.push({
        id: activeTodoId,
        user_id: userA.userId,
        title: "User A Active Todo",
        current_stage_id: "stage-todo",
        version: 1,
        deleted_at: null,
      });

      currentUser = userA;

      // 1. Cross-owner todoId attempt
      const resCross = await createActivity({
        title: "Activity for Foreign Todo",
        activityDate: "2026-10-01",
        source: "manual",
        status: "READY",
        todoId: foreignTodoId,
        idempotencyKey: crypto.randomUUID(),
      });
      expect(resCross.ok).toBe(false);

      // 2. Deleted todoId attempt
      const resDel = await createActivity({
        title: "Activity for Deleted Todo",
        activityDate: "2026-10-01",
        source: "manual",
        status: "READY",
        todoId: deletedTodoId,
        idempotencyKey: crypto.randomUUID(),
      });
      expect(resDel.ok).toBe(false);

      // 3. Valid active todoId
      const resValid = await createActivity({
        title: "Activity for Active Todo",
        activityDate: "2026-10-01",
        source: "manual",
        status: "READY",
        todoId: activeTodoId,
        idempotencyKey: crypto.randomUUID(),
      });
      expect(resValid.ok).toBe(true);
      const createdAct = mockDb.activities.find((a) => a.title === "Activity for Active Todo");
      expect(createdAct).toBeDefined();
      expect(createdAct.todo_id).toBe(activeTodoId);
    });
  });

  describe("5. Todo CRUD & Board Querying", () => {
    it("creates a Todo, updates it, reorders it, and soft deletes it", async () => {
      currentUser = userA;

      // Create Todo
      const createRes = await createTodo({
        title: "Implement dnd-kit kanban",
        priority: "HIGH",
        dueDate: "2026-10-05",
      });
      expect(createRes.ok).toBe(true);
      const createdId = (createRes as any).data.id;

      // Board data includes the new Todo
      const board1 = await getBoardData();
      expect(board1.todos.some((t) => t.id === createdId)).toBe(true);

      // Update Todo
      const updateRes = await updateTodo({
        id: createdId,
        title: "Implement dnd-kit kanban with touch support",
        priority: "URGENT",
        expectedVersion: 1,
      });
      expect(updateRes.ok).toBe(true);
      expect((updateRes as any).data.version).toBe(2);

      // Reorder Todo
      const reorderRes = await reorderTodo({
        todoId: createdId,
        stageId: "stage-backlog",
        newSortOrder: 500,
        expectedVersion: 2,
      });
      expect(reorderRes.ok).toBe(true);

      // Soft delete Todo
      const delRes = await deleteTodo(createdId);
      expect(delRes.ok).toBe(true);

      // Verify excluded from boardData
      const board2 = await getBoardData();
      expect(board2.todos.some((t) => t.id === createdId)).toBe(false);
    });

    it("derives EVIDENCE_INCOMPLETE on board data when DONE Todo has broken/missing evidence", async () => {
      currentUser = userA;

      // Todo in DONE
      mockDb.todos.push({
        id: "todo-health-check",
        user_id: userA.userId,
        title: "DONE Todo with evidence",
        current_stage_id: "stage-done",
        evidence_health: "OK",
        version: 1,
        deleted_at: null,
      });

      // Evidence is marked BROKEN
      mockDb.evidences.push({
        id: "ev-broken-done",
        user_id: userA.userId,
        status: "BROKEN",
        deleted_at: null,
      });

      mockDb.todoEvidences.push({
        todo_id: "todo-health-check",
        evidence_id: "ev-broken-done",
        attached_by: userA.userId,
      });

      const board = await getBoardData();
      const todo = board.todos.find((t) => t.id === "todo-health-check");
      expect(todo).toBeDefined();
      expect(todo?.evidenceCount).toBe(0); // Only AVAILABLE counts!
      expect(todo?.evidenceHealth).toBe("EVIDENCE_INCOMPLETE");
    });

    it("detaches evidence and updates health accordingly", async () => {
      currentUser = userA;

      mockDb.todos.push({
        id: "todo-detach-test",
        user_id: userA.userId,
        title: "Detach Evidence Test",
        current_stage_id: "stage-done",
        evidence_health: "OK",
        version: 1,
        deleted_at: null,
      });

      mockDb.todoEvidences.push({
        id: "rel-detach-1",
        todo_id: "todo-detach-test",
        evidence_id: "ev-proof-1",
        attached_by: userA.userId,
      });

      const detachRes = await detachTodoEvidence("rel-detach-1");
      expect(detachRes.ok).toBe(true);
      expect(mockDb.todoEvidences.some((r) => r.id === "rel-detach-1")).toBe(false);
    });
  });

  describe("6. Export Aggregation & Excel Todo Sheet", () => {
    it("aggregates evidence count and linked activities count for export", async () => {
      currentUser = userA;

      mockDb.todos.push({
        id: "todo-export-1",
        user_id: userA.userId,
        title: "Exported Todo",
        priority: "HIGH",
        due_date: "2026-10-20",
        current_stage_id: "stage-todo",
        evidence_health: "OK",
        started_at: "2026-10-01T08:00:00Z",
        completed_at: null,
        created_at: "2026-10-01T08:00:00Z",
        deleted_at: null,
      });

      mockDb.todoEvidences.push({
        todo_id: "todo-export-1",
        evidence_id: "ev-proof-1",
        attached_by: userA.userId,
      });

      mockDb.activities.push({
        id: "act-linked-1",
        user_id: userA.userId,
        title: "Linked Activity 1",
        activity_date: "2026-10-01",
        todo_id: "todo-export-1",
        deleted_at: null,
      });

      const exportData = await getExportData({
        from: "2026-10-01",
        to: "2026-10-31",
        includeEvidence: true,
        evidenceLinkMode: "APP_PRIVATE",
      });

      expect(exportData.todos).toBeDefined();
      const expTodo = exportData.todos?.find((t) => t.id === "todo-export-1");
      expect(expTodo).toBeDefined();
      expect(expTodo?.evidenceCount).toBe(1);
      expect(expTodo?.activityCount).toBe(1);
    });
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
});
