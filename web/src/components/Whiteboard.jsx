import Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Circle,
  Download,
  Edit3,
  Eraser,
  Hand,
  ImagePlus,
  Link2,
  Minus,
  MousePointer2,
  Palette,
  Pencil,
  Plus,
  Redo2,
  Square,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Arrow,
  Circle as KCircle,
  Group,
  Image as KImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import { api } from "../services/api";
import {
  circleFromDrag,
  connectorHandles,
  connectorPath,
  eraseVectorShapes,
  getShapeBounds,
  normalizeBox,
} from "./whiteboard-geometry";
import "./advanced-whiteboard.css";

Konva.capturePointerEventsEnabled = true;

const STAGE_WIDTH = 1200;
const STAGE_HEIGHT = 680;
const HISTORY_LIMIT = 80;
const TOOLS = [
  ["select", MousePointer2, "Selecionar, mover e redimensionar"],
  ["hand", Hand, "Mão: navegar sem alterar objetos"],
  ["pen", Pencil, "Caneta"],
  ["highlighter", Pencil, "Marca-texto"],
  ["eraser", Eraser, "Borracha parcial"],
  ["rect", Square, "Retângulo"],
  ["circle", Circle, "Círculo"],
  ["line", Minus, "Linha"],
  ["arrow", ArrowRight, "Seta livre"],
  ["connector", Link2, "Conectar objetos"],
  ["sticky", StickyNote, "Post-it editável"],
  ["text", Type, "Texto editável"],
];
const cn = (...values) => values.filter(Boolean).join(" ");
const uid = () =>
  `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const blankBoard = (folder = "Geral") => ({
  id: null,
  nome: "Novo quadro",
  pasta: folder,
  shapes: [],
});

function cloneShapes(shapes) {
  return shapes.map((item) => ({
    ...item,
    points: item.points ? [...item.points] : undefined,
  }));
}

function readShapes(json) {
  try {
    const root = JSON.parse(json);
    const layer = root.children?.find((item) => item.className === "Layer");
    const seen = new Set();
    const result = [];
    for (const node of layer?.children || []) {
      const attrs = node.attrs || {};
      if (!attrs.id || seen.has(attrs.id)) continue;
      const type =
        attrs.shapeType || attrs.type || node.className?.toLowerCase();
      if (
        ![
          "line",
          "arrow",
          "rect",
          "circle",
          "text",
          "image",
          "sticky",
          "connector",
        ].includes(type)
      )
        continue;
      seen.add(attrs.id);
      result.push({ ...attrs, type });
    }
    return result;
  } catch {
    return [];
  }
}

function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button {...props} className={cn("btn", `btn-${variant}`, className)}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <section className={cn("glass-panel", "card", className)}>
      {children}
    </section>
  );
}

function Heading({ children, title, sub }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">PLANEJAMENTO</p>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function CanvasImage({ item, common }) {
  const [image, setImage] = useState(null);
  useEffect(() => {
    const next = new window.Image();
    next.onload = () => setImage(next);
    next.src = item.src;
  }, [item.src]);
  return (
    <KImage
      {...common}
      image={image}
      width={item.width || 240}
      height={item.height || 160}
    />
  );
}

export default function Whiteboard({ notify }) {
  const [boards, setBoards] = useState([]);
  const [board, setBoard] = useState(blankBoard());
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#2dd4bf");
  const [size, setSize] = useState(4);
  const [fill, setFill] = useState("transparent");
  const [favorites, setFavorites] = useState(() =>
    JSON.parse(localStorage.getItem("edusystem_colors") || "[]"),
  );
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [redo, setRedo] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [pointer, setPointer] = useState({ x: 0, y: 0, visible: false });
  const [editor, setEditor] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const canvasHostRef = useRef(null);
  const imageInputRef = useRef(null);
  const drawing = useRef(null);
  const shapesRef = useRef([]);
  const interactionBefore = useRef(null);

  const visibleBoards = useMemo(
    () => boards.filter((item) => !board.pasta || item.pasta === board.pasta),
    [boards, board.pasta],
  );
  const selected = board.shapes.find((item) => item.id === selectedId);
  const eraserRadius = Math.max(8, size * 4);

  useEffect(() => {
    api
      .quadros()
      .then((items) => {
        const parsed = items.map((item) => ({
          ...item,
          shapes: readShapes(item.dados_json),
        }));
        setBoards(parsed);
        if (parsed[0]) {
          shapesRef.current = parsed[0].shapes;
          setBoard(parsed[0]);
        }
      })
      .catch(() => notify("Não foi possível carregar os quadros salvos"));
  }, []);

  useEffect(() => {
    shapesRef.current = board.shapes;
  }, [board.shapes]);

  useEffect(() => {
    localStorage.setItem("edusystem_colors", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const onKey = (event) => {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedId &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
      ) {
        event.preventDefault();
        removeSelected();
      }
      if (event.key === "Escape") {
        drawing.current = null;
        setDraft(null);
        setEditor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  useEffect(() => {
    const stage = stageRef.current?.getStage();
    const node = stage?.findOne(`#${selectedId}`);
    const canTransform =
      node && selected && !["connector"].includes(selected.type);
    if (canTransform && transformerRef.current) {
      transformerRef.current.nodes([node]);
      transformerRef.current.getLayer()?.batchDraw();
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedId, selected?.type, board.shapes]);

  function snapshot(shapes = shapesRef.current) {
    return cloneShapes(shapes);
  }

  function replaceShapes(next) {
    shapesRef.current = next;
    setBoard((previous) => ({ ...previous, shapes: next }));
  }

  function pushHistory(before) {
    setHistory((previous) =>
      [...previous, cloneShapes(before)].slice(-HISTORY_LIMIT),
    );
    setRedo([]);
  }

  function commit(next, before = snapshot()) {
    pushHistory(before);
    replaceShapes(next);
  }

  function updateShape(id, changes, record = false) {
    const before = record ? snapshot() : null;
    const next = shapesRef.current.map((item) =>
      item.id === id ? { ...item, ...changes } : item,
    );
    if (record) pushHistory(before);
    replaceShapes(next);
  }

  function logicalPoint(event) {
    const stage = event.target.getStage();
    const point = stage.getRelativePointerPosition();
    if (!point) return null;
    return {
      x: Math.max(0, Math.min(STAGE_WIDTH, point.x)),
      y: Math.max(0, Math.min(STAGE_HEIGHT, point.y)),
    };
  }

  function updatePointer(event) {
    const host = canvasHostRef.current;
    const source = event.evt;
    if (!host || source?.clientX === undefined) return;
    const bounds = host.getBoundingClientRect();
    setPointer({
      x: source.clientX - bounds.left,
      y: source.clientY - bounds.top,
      visible: true,
    });
  }

  function modelIdFromNode(node) {
    const stage = stageRef.current?.getStage();
    let current = node;
    while (current && current !== stage) {
      const id = current.id?.();
      if (id && shapesRef.current.some((item) => item.id === id)) return id;
      current = current.getParent?.();
    }
    return null;
  }

  function idAtPointer() {
    const stage = stageRef.current?.getStage();
    const point = stage?.getPointerPosition();
    if (!stage || !point) return null;
    return modelIdFromNode(stage.getIntersection(point));
  }

  function beginConnector(fromId, point, event) {
    if (!fromId || !point) return;
    if (event) event.cancelBubble = true;
    setSelectedId(fromId);
    drawing.current = {
      kind: "connector",
      fromId,
      start: point,
      before: snapshot(),
    };
    setDraft({
      type: "connector",
      points: [point.x, point.y, point.x, point.y],
    });
  }

  function begin(event) {
    if (event.evt?.button !== undefined && event.evt.button !== 0) return;
    updatePointer(event);
    const point = logicalPoint(event);
    if (!point) return;
    if (tool === "hand") return;
    if (tool === "select") {
      if (!modelIdFromNode(event.target)) setSelectedId(null);
      return;
    }
    if (tool === "eraser") {
      drawing.current = {
        kind: "eraser",
        before: snapshot(),
        changed: false,
      };
      eraseAtPoint(point);
      return;
    }
    if (tool === "connector") {
      beginConnector(modelIdFromNode(event.target), point);
      return;
    }
    if (tool === "pen" || tool === "highlighter") {
      const item = {
        id: uid(),
        type: "line",
        points: [point.x, point.y, point.x + 0.1, point.y + 0.1],
        stroke: color,
        strokeWidth: tool === "highlighter" ? size * 4 : size,
        opacity: tool === "highlighter" ? 0.34 : 1,
        lineCap: "round",
        lineJoin: "round",
      };
      drawing.current = {
        kind: "stroke",
        id: item.id,
        before: snapshot(),
      };
      replaceShapes([...shapesRef.current, item]);
      return;
    }
    drawing.current = { kind: "shape", tool, start: point, before: snapshot() };
  }

  function move(event) {
    updatePointer(event);
    const point = logicalPoint(event);
    const session = drawing.current;
    if (!point || !session) return;
    if (session.kind === "eraser") {
      eraseAtPoint(point);
      return;
    }
    if (session.kind === "stroke") {
      const next = shapesRef.current.map((item) => {
        if (item.id !== session.id) return item;
        const lastX = item.points[item.points.length - 2];
        const lastY = item.points[item.points.length - 1];
        if (Math.hypot(point.x - lastX, point.y - lastY) < 1.5) return item;
        return { ...item, points: [...item.points, point.x, point.y] };
      });
      replaceShapes(next);
      return;
    }
    if (session.kind === "connector") {
      setDraft({
        type: "connector",
        points: [session.start.x, session.start.y, point.x, point.y],
      });
      return;
    }
    const base = {
      type: session.tool,
      startX: session.start.x,
      startY: session.start.y,
      endX: point.x,
      endY: point.y,
      stroke: color,
      strokeWidth: size,
      fill,
    };
    if (["rect", "sticky"].includes(session.tool))
      setDraft({ ...base, ...normalizeBox(session.start, point) });
    else if (session.tool === "circle")
      setDraft({ ...base, ...circleFromDrag(session.start, point) });
    else if (["line", "arrow"].includes(session.tool)) setDraft(base);
  }

  function end(event) {
    updatePointer(event);
    const session = drawing.current;
    if (!session) return;
    const point = logicalPoint(event) || session.start;
    drawing.current = null;
    setDraft(null);
    if (session.kind === "eraser") {
      if (session.changed) pushHistory(session.before);
      return;
    }
    if (session.kind === "stroke") {
      pushHistory(session.before);
      return;
    }
    if (session.kind === "connector") {
      const toId = idAtPointer();
      if (toId && toId !== session.fromId) {
        const connector = {
          id: uid(),
          type: "connector",
          fromId: session.fromId,
          toId,
          stroke: color,
          strokeWidth: Math.max(2, size),
          pointerLength: 11,
          pointerWidth: 11,
        };
        commit([...shapesRef.current, connector], session.before);
        setSelectedId(connector.id);
      } else if (tool === "connector") {
        notify("Arraste até outro objeto para criar a conexão");
      }
      return;
    }

    const start = session.start;
    const distance = Math.hypot(point.x - start.x, point.y - start.y);
    let item = null;
    if (session.tool === "rect") {
      item = {
        id: uid(),
        type: "rect",
        ...normalizeBox(start, point),
        stroke: color,
        strokeWidth: size,
        fill: fill === "transparent" ? undefined : fill,
        cornerRadius: 8,
      };
    }
    if (session.tool === "circle") {
      item = {
        id: uid(),
        type: "circle",
        ...circleFromDrag(start, point),
        stroke: color,
        strokeWidth: size,
        fill: fill === "transparent" ? undefined : fill,
      };
    }
    if (["line", "arrow"].includes(session.tool) && distance >= 3) {
      item = {
        id: uid(),
        type: session.tool,
        points: [start.x, start.y, point.x, point.y],
        stroke: color,
        strokeWidth: size,
        lineCap: "round",
        lineJoin: "round",
        pointerLength: session.tool === "arrow" ? 12 : undefined,
        pointerWidth: session.tool === "arrow" ? 12 : undefined,
      };
    }
    if (session.tool === "sticky") {
      const box = normalizeBox(start, point);
      item = {
        id: uid(),
        type: "sticky",
        x: box.x,
        y: box.y,
        width: Math.max(170, box.width),
        height: Math.max(120, box.height),
        text: "Nova ideia",
        textColor: "#26323d",
        fill: fill === "transparent" ? "#f6d365" : fill,
        stroke: "#f9c74f",
        strokeWidth: 1,
      };
    }
    if (session.tool === "text") {
      item = {
        id: uid(),
        type: "text",
        x: start.x,
        y: start.y,
        width: Math.max(180, Math.abs(point.x - start.x)),
        height: 52,
        text: "Digite aqui",
        fontSize: Math.max(16, size * 5),
        fill: color,
      };
    }
    if (!item) return;
    commit([...shapesRef.current, item], session.before);
    setSelectedId(item.id);
    if (["sticky", "text"].includes(item.type)) {
      setTool("select");
      setEditor({ id: item.id, value: item.text, type: item.type });
    }
  }

  function eraseAtPoint(point) {
    const result = eraseVectorShapes(
      shapesRef.current,
      point,
      eraserRadius,
      uid,
    );
    if (!result.changed) return;
    if (drawing.current?.kind === "eraser") drawing.current.changed = true;
    replaceShapes(result.shapes);
    if (!result.shapes.some((item) => item.id === selectedId))
      setSelectedId(null);
  }

  function selectShape(id) {
    if (tool === "select") setSelectedId(id);
  }

  function startInteraction() {
    interactionBefore.current = snapshot();
  }

  function dragShape(item, event) {
    if (item.type === "connector") return;
    updateShape(item.id, { x: event.target.x(), y: event.target.y() });
  }

  function finishInteraction() {
    if (interactionBefore.current) pushHistory(interactionBefore.current);
    interactionBefore.current = null;
  }

  function finishTransform(event) {
    const node = event.target;
    const item = shapesRef.current.find((shape) => shape.id === node.id());
    if (!item) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    let changes;
    if (item.type === "circle") {
      changes = {
        x: node.x(),
        y: node.y(),
        radius: Math.max(8, item.radius * Math.max(scaleX, scaleY)),
      };
    } else if (["line", "arrow"].includes(item.type)) {
      changes = {
        x: node.x(),
        y: node.y(),
        points: item.points.map(
          (value, index) => value * (index % 2 === 0 ? scaleX : scaleY),
        ),
      };
    } else {
      changes = {
        x: node.x(),
        y: node.y(),
        width: Math.max(24, (item.width || node.width()) * scaleX),
        height: Math.max(24, (item.height || node.height()) * scaleY),
        fontSize:
          item.type === "text"
            ? Math.max(10, (item.fontSize || 18) * scaleY)
            : item.fontSize,
      };
    }
    updateShape(item.id, changes);
    finishInteraction();
  }

  function openEditor(item) {
    if (!["sticky", "text"].includes(item.type)) return;
    setSelectedId(item.id);
    setTool("select");
    setEditor({ id: item.id, value: item.text || "", type: item.type });
  }

  function saveEditor(current = editor) {
    if (!current) return;
    const item = shapesRef.current.find((shape) => shape.id === current.id);
    if (item && item.text !== current.value)
      updateShape(current.id, { text: current.value }, true);
    setEditor(null);
  }

  function applyPrimaryColor(next) {
    setColor(next);
    if (!selected) return;
    if (selected.type === "text")
      updateShape(selected.id, { fill: next }, true);
    else if (selected.type === "sticky")
      updateShape(selected.id, { textColor: next }, true);
    else updateShape(selected.id, { stroke: next }, true);
  }

  function applyFillColor(next) {
    setFill(next);
    if (!selected) return;
    if (["sticky", "rect", "circle"].includes(selected.type))
      updateShape(selected.id, { fill: next }, true);
  }

  function toggleFill() {
    const next = fill === "transparent" ? "#2dd4bf" : "transparent";
    setFill(next);
    if (selected && ["rect", "circle"].includes(selected.type))
      updateShape(
        selected.id,
        { fill: next === "transparent" ? undefined : next },
        true,
      );
  }

  function undo() {
    if (!history.length) return;
    setRedo((previous) => [...previous, snapshot()]);
    replaceShapes(history.at(-1));
    setHistory((previous) => previous.slice(0, -1));
    setSelectedId(null);
    setEditor(null);
  }

  function redoAction() {
    if (!redo.length) return;
    setHistory((previous) => [...previous, snapshot()]);
    replaceShapes(redo.at(-1));
    setRedo((previous) => previous.slice(0, -1));
    setSelectedId(null);
    setEditor(null);
  }

  function addFavorite() {
    if (!favorites.includes(color))
      setFavorites((previous) => [...previous, color].slice(-12));
  }

  function newFolder() {
    const name = window.prompt("Nome da pasta");
    if (name?.trim())
      setBoard((previous) => ({ ...previous, pasta: name.trim() }));
  }

  function newBoard() {
    const next = blankBoard(board.pasta || "Geral");
    shapesRef.current = [];
    setBoard(next);
    setSelectedId(null);
    setHistory([]);
    setRedo([]);
    setEditor(null);
    const stage = stageRef.current?.getStage();
    stage?.position({ x: 0, y: 0 });
    setZoom(1);
  }

  function insertImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const item = {
        id: uid(),
        type: "image",
        src: String(reader.result),
        x: 120,
        y: 90,
        width: 320,
        height: 220,
      };
      commit([...shapesRef.current, item]);
      setTool("select");
      setSelectedId(item.id);
      notify("Imagem adicionada ao quadro");
    };
    reader.onerror = () => notify("Não foi possível ler a imagem");
    reader.readAsDataURL(file);
  }

  function exportPng() {
    if (!stageRef.current) return;
    setSelectedId(null);
    const url = stageRef.current.getStage().toDataURL({ pixelRatio: 2 });
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${board.nome || "quadro"}.png`;
    anchor.click();
    notify("Quadro exportado como PNG");
  }

  async function save() {
    if (!stageRef.current) return;
    if (editor) {
      saveEditor(editor);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    setIsSaving(true);
    try {
      const dados_json = stageRef.current.getStage().toJSON();
      const saved = await api.saveQuadro({
        id: board.id,
        nome: board.nome,
        pasta: board.pasta || "Geral",
        dados_json,
      });
      const next = { ...saved, shapes: shapesRef.current };
      setBoards((previous) =>
        previous.some((item) => item.id === next.id)
          ? previous.map((item) => (item.id === next.id ? next : item))
          : [...previous, next],
      );
      setBoard(next);
      notify("Quadro salvo no SQLite");
    } catch (error) {
      notify(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  function removeSelected() {
    if (!selectedId) return;
    const next = shapesRef.current.filter(
      (item) =>
        item.id !== selectedId &&
        item.fromId !== selectedId &&
        item.toId !== selectedId,
    );
    commit(next);
    setSelectedId(null);
    setEditor(null);
  }

  function nodeCommon(item) {
    const { type, ...attrs } = item;
    return {
      ...attrs,
      id: item.id,
      shapeType: type,
      draggable: tool === "select" && type !== "connector",
      listening: tool !== "hand",
      onClick: () => selectShape(item.id),
      onTap: () => selectShape(item.id),
      onDragStart: startInteraction,
      onDragMove: (event) => dragShape(item, event),
      onDragEnd: (event) => {
        dragShape(item, event);
        finishInteraction();
      },
      onTransformStart: startInteraction,
      onTransformEnd: finishTransform,
    };
  }

  function renderConnector(item) {
    const from = shapesRef.current.find((shape) => shape.id === item.fromId);
    const to = shapesRef.current.find((shape) => shape.id === item.toId);
    const points = connectorPath(from, to);
    if (!points.length) return null;
    return (
      <Arrow
        {...nodeCommon(item)}
        key={item.id}
        points={points}
        fill={item.stroke}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={18}
        tension={0}
      />
    );
  }

  function renderShape(item) {
    const common = nodeCommon(item);
    if (item.type === "line")
      return (
        <Line
          {...common}
          key={item.id}
          hitStrokeWidth={Math.max(16, item.strokeWidth * 2)}
        />
      );
    if (item.type === "arrow")
      return (
        <Arrow
          {...common}
          key={item.id}
          fill={item.stroke}
          hitStrokeWidth={Math.max(18, item.strokeWidth * 2)}
        />
      );
    if (item.type === "rect") return <Rect {...common} key={item.id} />;
    if (item.type === "circle") return <KCircle {...common} key={item.id} />;
    if (item.type === "text")
      return (
        <Text
          {...common}
          key={item.id}
          width={item.width || 220}
          height={item.height || 52}
          wrap="word"
          onDblClick={() => openEditor(item)}
          onDblTap={() => openEditor(item)}
        />
      );
    if (item.type === "image")
      return <CanvasImage key={item.id} item={item} common={common} />;
    if (item.type === "sticky")
      return (
        <Group
          {...common}
          key={item.id}
          width={item.width}
          height={item.height}
          onDblClick={() => openEditor(item)}
          onDblTap={() => openEditor(item)}
        >
          <Rect
            width={item.width}
            height={item.height}
            fill={item.fill || "#f6d365"}
            stroke={item.stroke || "#f9c74f"}
            strokeWidth={item.strokeWidth || 1}
            cornerRadius={8}
            shadowColor="#000"
            shadowBlur={12}
            shadowOpacity={0.25}
            listening={false}
          />
          <Text
            x={14}
            y={14}
            width={item.width - 28}
            height={item.height - 28}
            text={item.text}
            fill={item.textColor || "#26323d"}
            fontSize={17}
            lineHeight={1.35}
            wrap="word"
            listening={false}
          />
        </Group>
      );
    return null;
  }

  function renderHandles() {
    if (!selected || ["connector", "line", "arrow"].includes(selected.type))
      return null;
    return connectorHandles(selected).map((handle) => (
      <KCircle
        key={handle.side}
        x={handle.x}
        y={handle.y}
        radius={7 / zoom}
        fill="#07131d"
        stroke="#62ead6"
        strokeWidth={2 / zoom}
        hitStrokeWidth={18 / zoom}
        onPointerDown={(event) => beginConnector(selected.id, handle, event)}
      />
    ));
  }

  const draftShape =
    draft &&
    (draft.type === "rect" || draft.type === "sticky" ? (
      <Rect
        {...draft}
        id="draft"
        dash={[8, 5]}
        fill={
          draft.type === "sticky"
            ? fill === "transparent"
              ? "#f6d36566"
              : fill
            : fill === "transparent"
              ? undefined
              : fill
        }
        listening={false}
      />
    ) : draft.type === "circle" ? (
      <KCircle
        {...draft}
        id="draft"
        dash={[8, 5]}
        fill={fill === "transparent" ? undefined : fill}
        listening={false}
      />
    ) : ["line", "arrow"].includes(draft.type) ? (
      draft.type === "arrow" ? (
        <Arrow
          id="draft"
          points={[draft.startX, draft.startY, draft.endX, draft.endY]}
          stroke={draft.stroke}
          fill={draft.stroke}
          strokeWidth={draft.strokeWidth}
          pointerLength={12}
          pointerWidth={12}
          dash={[8, 5]}
          listening={false}
        />
      ) : (
        <Line
          id="draft"
          points={[draft.startX, draft.startY, draft.endX, draft.endY]}
          stroke={draft.stroke}
          strokeWidth={draft.strokeWidth}
          dash={[8, 5]}
          listening={false}
        />
      )
    ) : draft.type === "connector" ? (
      <Arrow
        id="connector-draft"
        points={draft.points}
        stroke={color}
        fill={color}
        strokeWidth={Math.max(2, size)}
        pointerLength={11}
        pointerWidth={11}
        dash={[7, 5]}
        listening={false}
      />
    ) : null);

  const editorItem = editor
    ? board.shapes.find((item) => item.id === editor.id)
    : null;
  const editorBounds = getShapeBounds(editorItem);
  const stage = stageRef.current?.getStage();
  const stageContainer = stage?.container?.();
  const hostBounds = canvasHostRef.current?.getBoundingClientRect();
  const stageBounds = stageContainer?.getBoundingClientRect();
  const editorStyle =
    editorItem && editorBounds && hostBounds && stageBounds
      ? {
          left:
            stageBounds.left -
            hostBounds.left +
            stage.x() +
            editorBounds.x * zoom,
          top:
            stageBounds.top -
            hostBounds.top +
            stage.y() +
            editorBounds.y * zoom,
          width: Math.max(180, editorBounds.width * zoom),
          minHeight: Math.max(54, editorBounds.height * zoom),
          color:
            editorItem.type === "sticky"
              ? editorItem.textColor || "#26323d"
              : editorItem.fill || color,
          background:
            editorItem.type === "sticky"
              ? editorItem.fill || "#f6d365"
              : "rgba(8, 16, 28, .92)",
          fontSize: Math.max(15, (editorItem.fontSize || 17) * zoom),
        }
      : undefined;

  function zoomAtPointer(direction) {
    const currentStage = stageRef.current?.getStage();
    if (!currentStage) return;
    const oldScale = zoom;
    const nextScale = Math.max(0.55, Math.min(1.8, oldScale + direction * 0.1));
    const pointerPosition = currentStage.getPointerPosition() || {
      x: currentStage.width() / 2,
      y: currentStage.height() / 2,
    };
    const logical = {
      x: (pointerPosition.x - currentStage.x()) / oldScale,
      y: (pointerPosition.y - currentStage.y()) / oldScale,
    };
    currentStage.position({
      x: pointerPosition.x - logical.x * nextScale,
      y: pointerPosition.y - logical.y * nextScale,
    });
    setZoom(nextScale);
  }

  return (
    <>
      <Heading
        title="Quadro branco"
        sub="Expresse ideias, conecte conceitos e organize cada projeto em seus próprios quadros e pastas."
      >
        <div className="heading-actions">
          <Button variant="ghost" onClick={exportPng}>
            <Download size={16} /> Exportar PNG
          </Button>
          <Button onClick={save} disabled={isSaving}>
            <Download size={16} /> {isSaving ? "Salvando…" : "Salvar quadro"}
          </Button>
        </div>
      </Heading>
      <Card className="whiteboard-card advanced-whiteboard">
        <div className="board-topline">
          <div className="board-select">
            <select
              aria-label="Selecionar quadro"
              value={board.id || ""}
              onChange={(event) => {
                const next = boards.find(
                  (item) => String(item.id) === event.target.value,
                );
                if (next) {
                  shapesRef.current = next.shapes;
                  setBoard(next);
                  setSelectedId(null);
                  setEditor(null);
                  setHistory([]);
                  setRedo([]);
                }
              }}
            >
              <option value="">Quadro novo</option>
              {visibleBoards.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
            <input
              aria-label="Nome do quadro"
              value={board.nome}
              onChange={(event) =>
                setBoard((previous) => ({
                  ...previous,
                  nome: event.target.value,
                }))
              }
            />
          </div>
          <div className="board-actions">
            <select
              aria-label="Pasta do quadro"
              value={board.pasta || "Geral"}
              onChange={(event) =>
                setBoard((previous) => ({
                  ...previous,
                  pasta: event.target.value,
                }))
              }
            >
              <option>Geral</option>
              {[...new Set(boards.map((item) => item.pasta).filter(Boolean))]
                .filter((item) => item !== "Geral")
                .map((item) => (
                  <option key={item}>{item}</option>
                ))}
            </select>
            <button className="tool-label" onClick={newFolder}>
              <Plus size={14} /> Pasta
            </button>
            <button className="tool-label" onClick={newBoard}>
              <Plus size={14} /> Quadro
            </button>
          </div>
        </div>

        <div className="canvas-toolbar advanced-toolbar">
          <div className="tool-group">
            {TOOLS.map(([value, Icon, label]) => (
              <button
                title={label}
                aria-label={label}
                aria-pressed={tool === value}
                className={cn("tool", tool === value && "active")}
                key={value}
                onClick={() => {
                  setTool(value);
                  setDraft(null);
                  drawing.current = null;
                }}
              >
                <Icon size={17} />
              </button>
            ))}
            <button
              title="Inserir imagem"
              aria-label="Inserir imagem"
              className="tool"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlus size={17} />
            </button>
            <input
              ref={imageInputRef}
              hidden
              type="file"
              accept="image/*"
              onChange={insertImage}
            />
          </div>
          <span className="toolbar-sep" />
          <button
            title="Desfazer"
            aria-label="Desfazer"
            className="tool"
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            title="Refazer"
            aria-label="Refazer"
            className="tool"
            onClick={redoAction}
          >
            <Redo2 size={17} />
          </button>
          <span className="toolbar-sep" />
          <div className="color-control">
            <Palette size={15} />
            <label className="sr-only" htmlFor="board-primary-color">
              Cor principal
            </label>
            <input
              id="board-primary-color"
              type="color"
              value={
                selected?.type === "sticky"
                  ? selected.textColor || color
                  : selected?.type === "text"
                    ? selected.fill || color
                    : selected?.stroke || color
              }
              onChange={(event) => applyPrimaryColor(event.target.value)}
            />
            <button
              className="color-favorite"
              title="Adicionar aos favoritos"
              aria-label="Adicionar cor aos favoritos"
              style={{ background: color }}
              onClick={addFavorite}
            >
              +
            </button>
            {favorites.map((item) => (
              <button
                key={item}
                title={`Usar ${item}`}
                aria-label={`Usar cor ${item}`}
                className="favorite-dot"
                style={{ background: item }}
                onClick={() => applyPrimaryColor(item)}
              />
            ))}
          </div>
          <label className="size-control">
            Espessura
            <input
              className="range"
              type="range"
              min="1"
              max="24"
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
          </label>
          <label className="fill-control">
            {selected?.type === "sticky" ? "Fundo do post-it" : "Preenchimento"}
            <input
              type="color"
              value={
                selected?.type === "sticky"
                  ? selected.fill || "#f6d365"
                  : selected?.fill ||
                    (fill === "transparent" ? "#ffffff" : fill)
              }
              onChange={(event) => applyFillColor(event.target.value)}
            />
            {selected?.type !== "sticky" && (
              <button onClick={toggleFill}>
                {fill === "transparent" ? "Vazio" : "Sólido"}
              </button>
            )}
          </label>
          {selected && ["sticky", "text"].includes(selected.type) && (
            <button
              className="tool-label edit-text-button"
              onClick={() => openEditor(selected)}
            >
              <Edit3 size={14} /> Editar texto
            </button>
          )}
          <button
            className="tool"
            title="Excluir selecionado"
            aria-label="Excluir selecionado"
            onClick={removeSelected}
          >
            <Trash2 size={17} />
          </button>
          <button
            className="tool"
            title="Afastar"
            aria-label="Afastar"
            onClick={() => zoomAtPointer(-1)}
          >
            <ZoomOut size={17} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            className="tool"
            title="Aproximar"
            aria-label="Aproximar"
            onClick={() => zoomAtPointer(1)}
          >
            <ZoomIn size={17} />
          </button>
        </div>

        <div
          ref={canvasHostRef}
          className={cn(
            "canvas-wrap",
            "advanced-canvas",
            `canvas-mode-${tool}`,
          )}
          onPointerLeave={() =>
            !drawing.current &&
            setPointer((previous) => ({ ...previous, visible: false }))
          }
        >
          {tool === "eraser" && pointer.visible && (
            <span
              className="eraser-cursor"
              style={{
                left: pointer.x,
                top: pointer.y,
                width: eraserRadius * 2 * zoom,
                height: eraserRadius * 2 * zoom,
              }}
            />
          )}
          {tool === "eraser" && (
            <span className="canvas-hint">
              Borracha parcial · arraste sobre linhas; objetos fechados são
              removidos por inteiro
            </span>
          )}
          {tool === "connector" && (
            <span className="canvas-hint">
              Conector · arraste de um objeto até outro
            </span>
          )}
          {editor && editorItem && editorStyle && (
            <div className="inline-text-editor" style={editorStyle}>
              <textarea
                autoFocus
                aria-label={
                  editor.type === "sticky" ? "Texto do post-it" : "Editar texto"
                }
                value={editor.value}
                onChange={(event) =>
                  setEditor((previous) => ({
                    ...previous,
                    value: event.target.value,
                  }))
                }
                onBlur={() => saveEditor(editor)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setEditor(null);
                  }
                  if (
                    event.key === "Enter" &&
                    (event.ctrlKey || event.metaKey)
                  ) {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
              />
              <small>Ctrl + Enter para concluir · Esc para cancelar</small>
            </div>
          )}
          <Stage
            ref={stageRef}
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            scaleX={zoom}
            scaleY={zoom}
            draggable={tool === "hand"}
            onPointerDown={begin}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onWheel={(event) => {
              if (tool !== "hand") return;
              event.evt.preventDefault();
              zoomAtPointer(event.evt.deltaY > 0 ? -1 : 1);
            }}
          >
            <Layer>
              <Rect
                name="board-background"
                width={STAGE_WIDTH}
                height={STAGE_HEIGHT}
                fill="rgba(0,0,0,0.001)"
              />
              {board.shapes
                .filter((item) => item.type === "connector")
                .map(renderConnector)}
              {board.shapes
                .filter((item) => item.type !== "connector")
                .map(renderShape)}
              {draftShape}
              <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                keepRatio={
                  selected?.type === "circle" || selected?.type === "image"
                }
                enabledAnchors={[
                  "top-left",
                  "top-right",
                  "bottom-left",
                  "bottom-right",
                ]}
                borderStroke="#2dd4bf"
                anchorFill="#07131d"
                anchorStroke="#62ead6"
                anchorSize={9}
              />
              {renderHandles()}
            </Layer>
          </Stage>
        </div>
        <div className="board-footer">
          <span>
            {board.shapes.length} objetos · {board.pasta || "Geral"}
          </span>
          <span>
            {tool === "hand"
              ? "Mão ativa: arraste para navegar sem alterar objetos"
              : selected
                ? "Use os pontos ao redor do objeto para puxar uma conexão"
                : "Selecione um objeto ou escolha uma ferramenta"}
          </span>
        </div>
      </Card>
    </>
  );
}
