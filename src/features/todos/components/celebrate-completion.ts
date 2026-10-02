/** Short local feedback after a confirmed new completion. */
export function celebrateCompletion(root: HTMLElement | null, todoId: string) {
  if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.requestAnimationFrame(() => {
    const card = root.querySelector<HTMLElement>(`[data-todo-id="${CSS.escape(todoId)}"]`);
    const rect = (card ?? root).getBoundingClientRect();
    const burst = document.createElement("div");
    burst.className = "completion-confetti";
    burst.setAttribute("aria-hidden", "true");
    burst.style.left = `${Math.min(window.innerWidth - 36, Math.max(36, rect.left + rect.width / 2))}px`;
    burst.style.top = `${Math.min(window.innerHeight - 100, Math.max(80, rect.top + 24))}px`;
    const colors = ["#2563eb", "#81b7ff", "#c5a469"];
    for (let index = 0; index < 18; index++) {
      const piece = document.createElement("i");
      const angle = (index / 18) * Math.PI * 2;
      const radius = 52 + (index % 4) * 16;
      piece.style.setProperty("--dx", `${Math.cos(angle) * radius}px`);
      piece.style.setProperty("--dy", `${Math.sin(angle) * radius + 42}px`);
      piece.style.setProperty("--turn", `${(index % 2 ? -1 : 1) * (180 + index * 23)}deg`);
      piece.style.background = colors[index % colors.length];
      burst.appendChild(piece);
    }
    document.body.appendChild(burst);
    window.setTimeout(() => burst.remove(), 1100);
  });
}
