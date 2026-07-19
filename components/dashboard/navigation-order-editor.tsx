"use client";

import { useMemo, useState } from "react";
import { saveNavigationOrder } from "@/app/actions/admin-management";
import type { EditableSiteSection } from "@/lib/content/site-content";

export type NavigationOrderChild = {
  key: string;
  label: string;
};

export type NavigationOrderItem = {
  key: string;
  label: string;
  children: NavigationOrderChild[];
};

type DragState =
  | { type: "category"; index: number }
  | { type: "child"; categoryKey: string; index: number }
  | null;

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function NavigationOrderEditor({
  section,
  initialItems,
}: {
  section: EditableSiteSection;
  initialItems: NavigationOrderItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [dragged, setDragged] = useState<DragState>(null);

  const serialized = useMemo(
    () =>
      JSON.stringify({
        categories: items.map((item) => item.key),
        children: Object.fromEntries(items.map((item) => [item.key, item.children.map((child) => child.key)])),
      }),
    [items],
  );

  function reorderCategory(targetIndex: number) {
    if (!dragged || dragged.type !== "category") return;
    setItems((current) => moveItem(current, dragged.index, targetIndex));
    setDragged({ type: "category", index: targetIndex });
  }

  function reorderChild(categoryKey: string, targetIndex: number) {
    if (!dragged || dragged.type !== "child" || dragged.categoryKey !== categoryKey) return;
    setItems((current) =>
      current.map((item) =>
        item.key === categoryKey
          ? { ...item, children: moveItem(item.children, dragged.index, targetIndex) }
          : item,
      ),
    );
    setDragged({ type: "child", categoryKey, index: targetIndex });
  }

  return (
    <form action={saveNavigationOrder} className="navigation-order-panel" id="menu-order">
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="order_json" value={serialized} readOnly />

      <div className="navigation-order-heading">
        <div>
          <p className="eyebrow">ORDRE DU MENU</p>
          <h2>Déplace les pages avec la souris</h2>
          <p>Maintiens la poignée ⋮⋮, puis glisse une rubrique ou une sous-page à la position voulue.</p>
        </div>
        <button className="btn" type="submit">Enregistrer l’ordre</button>
      </div>

      <div className="navigation-sort-list">
        {items.map((item, categoryIndex) => (
          <article
            className="navigation-sort-category"
            key={item.key}
            draggable
            onDragStart={() => setDragged({ type: "category", index: categoryIndex })}
            onDragEnd={() => setDragged(null)}
            onDragOver={(event) => {
              if (dragged?.type === "category") event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              reorderCategory(categoryIndex);
            }}
          >
            <div className="navigation-sort-category-title">
              <span className="drag-handle" aria-hidden="true">⋮⋮</span>
              <strong>{item.label}</strong>
              <small>{item.children.length > 0 ? `${item.children.length} sous-page(s)` : "Page principale"}</small>
            </div>

            {item.children.length > 0 && (
              <div className="navigation-sort-children">
                {item.children.map((child, childIndex) => (
                  <div
                    className="navigation-sort-child"
                    key={child.key}
                    draggable
                    onDragStart={(event) => {
                      event.stopPropagation();
                      setDragged({ type: "child", categoryKey: item.key, index: childIndex });
                    }}
                    onDragEnd={() => setDragged(null)}
                    onDragOver={(event) => {
                      if (dragged?.type === "child" && dragged.categoryKey === item.key) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      reorderChild(item.key, childIndex);
                    }}
                  >
                    <span className="drag-handle drag-handle-small" aria-hidden="true">⋮⋮</span>
                    <span>{child.label}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="navigation-order-footer">
        <button className="btn" type="submit">Enregistrer l’ordre du menu</button>
      </div>
    </form>
  );
}
