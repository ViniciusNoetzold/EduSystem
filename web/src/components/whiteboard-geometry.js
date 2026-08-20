export function normalizeBox(start, point) {
  return {
    x: Math.min(start.x, point.x),
    y: Math.min(start.y, point.y),
    width: Math.abs(point.x - start.x),
    height: Math.abs(point.y - start.y),
  };
}

export function circleFromDrag(start, point) {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  return {
    x: start.x + dx / 2,
    y: start.y + dy / 2,
    radius: Math.max(2, Math.hypot(dx, dy) / 2),
  };
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function worldPolyline(item) {
  const offsetX = Number(item.x || 0);
  const offsetY = Number(item.y || 0);
  const result = [];
  for (let index = 0; index < (item.points || []).length; index += 2) {
    result.push({
      x: Number(item.points[index]) + offsetX,
      y: Number(item.points[index + 1]) + offsetY,
    });
  }
  return result;
}

function samplePolyline(points, step) {
  if (points.length < 2) return points;
  const sampled = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = pointDistance(from, to);
    const divisions = Math.max(1, Math.ceil(length / step));
    for (let part = 1; part <= divisions; part += 1) {
      const ratio = part / divisions;
      sampled.push({
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      });
    }
  }
  return sampled;
}

function splitOutsideCircle(points, center, radius) {
  const chunks = [];
  let current = [];
  let touched = false;
  for (const point of points) {
    if (pointDistance(point, center) <= radius) {
      touched = true;
      if (current.length > 1) chunks.push(current);
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length > 1) chunks.push(current);
  return { chunks, touched };
}

function flattenPoints(points) {
  return points.flatMap((point) => [point.x, point.y]);
}

export function getShapeBounds(item) {
  if (!item) return null;
  if (item.type === "circle") {
    const radius = Number(item.radius || 0);
    return {
      x: Number(item.x || 0) - radius,
      y: Number(item.y || 0) - radius,
      width: radius * 2,
      height: radius * 2,
    };
  }
  if (["line", "arrow"].includes(item.type)) {
    const points = worldPolyline(item);
    if (!points.length) return null;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x,
      y,
      width: Math.max(1, Math.max(...xs) - x),
      height: Math.max(1, Math.max(...ys) - y),
    };
  }
  return {
    x: Number(item.x || 0),
    y: Number(item.y || 0),
    width: Math.max(24, Number(item.width || 180)),
    height: Math.max(
      24,
      Number(item.height || (item.type === "text" ? item.fontSize * 1.5 : 100)),
    ),
  };
}

function circleTouchesBox(point, radius, bounds) {
  const nearestX = Math.max(
    bounds.x,
    Math.min(point.x, bounds.x + bounds.width),
  );
  const nearestY = Math.max(
    bounds.y,
    Math.min(point.y, bounds.y + bounds.height),
  );
  return Math.hypot(point.x - nearestX, point.y - nearestY) <= radius;
}

export function eraseVectorShapes(shapes, point, radius, makeId) {
  const removedIds = new Set();
  let changed = false;
  const next = [];

  for (const item of shapes) {
    if (item.type === "connector") {
      next.push(item);
      continue;
    }

    if (["line", "arrow"].includes(item.type)) {
      const sampled = samplePolyline(
        worldPolyline(item),
        Math.max(2, Math.min(8, radius / 3)),
      );
      const result = splitOutsideCircle(sampled, point, radius);
      if (!result.touched) {
        next.push(item);
        continue;
      }

      changed = true;
      removedIds.add(item.id);
      result.chunks.forEach((chunk, index) => {
        const keepsOriginalArrowHead =
          item.type === "arrow" && index === result.chunks.length - 1;
        next.push({
          ...item,
          id: index === 0 ? item.id : makeId(),
          type: keepsOriginalArrowHead ? "arrow" : "line",
          x: 0,
          y: 0,
          points: flattenPoints(chunk),
        });
      });
      if (result.chunks.length) removedIds.delete(item.id);
      continue;
    }

    const bounds = getShapeBounds(item);
    const hit =
      item.type === "circle"
        ? Math.hypot(point.x - item.x, point.y - item.y) <=
          Number(item.radius || 0) + radius
        : bounds && circleTouchesBox(point, radius, bounds);
    if (hit) {
      changed = true;
      removedIds.add(item.id);
    } else next.push(item);
  }

  const cleaned = next.filter(
    (item) =>
      item.type !== "connector" ||
      (!removedIds.has(item.fromId) && !removedIds.has(item.toId)),
  );
  return { shapes: cleaned, changed };
}

function center(bounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

export function connectorPath(fromItem, toItem) {
  const fromBounds = getShapeBounds(fromItem);
  const toBounds = getShapeBounds(toItem);
  if (!fromBounds || !toBounds) return [];
  const fromCenter = center(fromBounds);
  const toCenter = center(toBounds);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const direction = dx >= 0 ? 1 : -1;
    const start = {
      x: direction > 0 ? fromBounds.x + fromBounds.width : fromBounds.x,
      y: fromCenter.y,
    };
    const end = {
      x: direction > 0 ? toBounds.x : toBounds.x + toBounds.width,
      y: toCenter.y,
    };
    const middleX = start.x + (end.x - start.x) / 2;
    return [start.x, start.y, middleX, start.y, middleX, end.y, end.x, end.y];
  }

  const direction = dy >= 0 ? 1 : -1;
  const start = {
    x: fromCenter.x,
    y: direction > 0 ? fromBounds.y + fromBounds.height : fromBounds.y,
  };
  const end = {
    x: toCenter.x,
    y: direction > 0 ? toBounds.y : toBounds.y + toBounds.height,
  };
  const middleY = start.y + (end.y - start.y) / 2;
  return [start.x, start.y, start.x, middleY, end.x, middleY, end.x, end.y];
}

export function connectorHandles(item) {
  const bounds = getShapeBounds(item);
  if (!bounds) return [];
  return [
    { side: "top", x: bounds.x + bounds.width / 2, y: bounds.y },
    {
      side: "right",
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height / 2,
    },
    {
      side: "bottom",
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height,
    },
    { side: "left", x: bounds.x, y: bounds.y + bounds.height / 2 },
  ];
}
