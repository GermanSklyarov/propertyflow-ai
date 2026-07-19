export interface ReorderGalleryModelItem {
  id: string;
}

export function moveGalleryItem<TItem extends ReorderGalleryModelItem>(items: TItem[], sourceId: string, targetId: string): TItem[] {
  if (sourceId === targetId) {
    return items;
  }

  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return items;
  }

  const next = [...items];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}

export function moveGalleryItemByStep<TItem extends ReorderGalleryModelItem>(items: TItem[], itemId: string, step: -1 | 1): TItem[] {
  const sourceIndex = items.findIndex((item) => item.id === itemId);
  const targetIndex = sourceIndex + step;

  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}
