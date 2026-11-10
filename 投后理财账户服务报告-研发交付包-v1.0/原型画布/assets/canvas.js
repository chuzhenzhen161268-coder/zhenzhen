// =============================================================
//  数据全局：pages / annotations / layout 由运行时加载（见下方 loadDataFile），
//  加载完只落进 state，不另留一份模块级快照——两份会各自漂移。
// =============================================================
// 只给本机偏好（主题 / 分屏宽度 / 上次文档）做命名空间，不承载任何标注或编排数据。
// 按画布所在目录派生而非完整路径：同一个站点用 /prototypes/ 和 /prototypes/index.html
// 两种 URL 打开都落到同一份偏好；演示壳 demo/demo.html 用同一算法取上级目录，与画布共享主题。
const CANVAS_KEY = (location.pathname.replace(/[^/]*$/, "")
  .replace(/[^A-Za-z0-9]+/g, "-").slice(-40)) || "root";

// =============================================================
//  数据文件加载：http(s) 下 fetch json；file:// 或 fetch 失败时退回 <script src="*.js"> 镜像。
//  镜像由 canvas_server.py / build_canvas.py 与 json 同时写出，内容一致。
// =============================================================
window.__CANVAS_DATA__ = window.__CANVAS_DATA__ || {};

// reason 是 json 那一路的失败原因，镜像也失败时一并带进错误消息——两路都哑掉时，
// 只说「镜像加载失败」会把真正的病因（404 / 语法错 / 跨域）藏起来。
function loadMirror(name, reason) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    // name 可能是带子目录的站点内相对路径，且 PRD 文件名常含中文，交给 encodeURI 逐段转义；
    // 它不动 / 与 . ，拼出来的仍是同一个相对路径。
    const src = encodeURI(name) + ".js";
    // file:// 下部分浏览器取不到带 query 的路径，而 file:// 正是镜像存在的理由
    s.src = location.protocol === "file:" ? src : src + "?t=" + Date.now();
    s.onload = () => {
      s.remove();
      const d = window.__CANVAS_DATA__[name];
      d ? resolve(d) : reject(new Error(name + ".js 里没有数据"));
    };
    s.onerror = () => {
      s.remove();
      reject(new Error(name + ".js 加载失败" + (reason ? "（json：" + reason + "）" : "")));
    };
    document.head.appendChild(s);
  });
}

async function loadDataFile(name) {
  let reason = "";
  if (location.protocol !== "file:") {
    try {
      const r = await fetch(name + ".json", { cache: "no-store" });
      if (r.ok) return await r.json();
      reason = "HTTP " + r.status;
    } catch (e) { reason = (e && e.message) || String(e); }   // 退回镜像
  }
  return loadMirror(name, reason);
}

// pages 缺失是致命的；annotations / layout 缺失按空处理（老站点可能没有这两个文件）
async function loadInitialData() {
  const pages = await loadDataFile("pages");
  // 损坏的 pages（数组 / 字符串 / null）后面会在读 demoEntry 处白屏，不如在这里就判死
  if (!pages || typeof pages !== "object") throw new Error("pages.json 内容不是对象");
  const [annotations, layout] = await Promise.all([
    loadDataFile("annotations").catch(() => ({ version: "1", annotations: [], orphans: [] })),
    loadDataFile("layout").catch(() => ({ version: "2", frames: [], shapes: [] }))
  ]);
  return { pages, annotations, layout };
}

function applyInitialData(d) {
  const pages = d.pages, ann = d.annotations, layout = d.layout;
  state.pages = (pages && pages.pages) ? pages.pages : [];
  state.frames = (layout && layout.frames) ? layout.frames.slice() : [];
  state.shapes = (layout && layout.shapes) ? layout.shapes.slice() : [];
  state.annotations = (ann && ann.annotations) ? ann.annotations.slice() : [];
  state.orphans = (ann && ann.orphans) ? ann.orphans.slice() : [];
}

function showFatal(msg) {
  document.body.innerHTML =
    '<div class="fatal"><div class="fatal-title">画布无法加载</div><div class="fatal-msg">' +
    escapeHtml(msg) + '</div><div class="fatal-hint">先运行画布生成得到 pages.json，再打开本页。</div></div>';
}

// 「总览 / 演示」切换条按 pages.json 的 demoEntry 渲染；没有演示入口就不渲染，不留死链。
// 演示统一新开标签页：画布的缩放 / 滚动位置 / 未提交的标注草稿只活在当前标签页。
function renderModeSwitch(demoEntry) {
  if (!demoEntry) return;
  // 挂进左上角堆叠容器而不是 body：切换条与「相关文档」共用一套定位，
  // 谁不渲染另一个都自然顶上去，不用各自算 top。
  const stack = document.getElementById("cornerStack");
  if (!stack) return;
  stack.insertAdjacentHTML("afterbegin",
    '<nav class="mode-switch" aria-label="原型查看模式切换">' +
    '<a href="index.html" class="active"><i class="fa-solid fa-list-check"></i>总览</a>' +
    '<a href="' + escapeHtml(demoEntry) + '" target="_blank" rel="noopener">' +
    '<i class="fa-solid fa-play"></i>演示</a></nav>');
}

// =============================================================
//  Runtime state
// =============================================================
const state = {
  pages: [],               // 以下五项 boot 时由 applyInitialData() 从数据文件填入
  frames: [],              // 画布上的 frame 实例
  shapes: [],              // 画布图形对象（阶段三启用）
  annotations: [],
  orphans: [],
  zoom: 1,
  mode: "browse",          // browse | mark | remount
  tool: "select",          // select | pan | rect | arrow | note | text | flow；与 mode 正交，mode 管标注子系统
  flowVariant: "process",  // 流程图面板选中的形状，决定下一笔画什么
  geoVariant: "rect",      // 基础图形面板选中的形状；取 "rect" 时 R 落的是圈选方框
  arrowRoute: "elbow",     // 箭头面板选中的路由，决定下一笔画直线还是折线
  remountTargetId: null,
  selection: [],           // 选中集合，唯一真理源：[{ kind: "shape" | "frame", id }]，按加入顺序
  selectedShapeId: null,   // 由 selection 派生：恰好选中一个图形时才有值。单选专属 UI 都读它
  selectedFrameId: null,   // 由 selection 派生：恰好选中一个 frame 实例时才有值
  editingShapeId: null,    // 正在编辑文本的图形，ESC 第 1 级的专有判定标志
  editingArrowLabelId: null, // 正在编辑标签的箭头，与 editingShapeId 同级
  locked: false,
  serverMode: false,
  imageUpload: false,      // 服务端是否支持贴图落盘，由 probeServer 读 features 回填
  viewSave: false,         // 服务端是否支持保存站点默认视图（锁定），同上
  dirty: false,
  clipboard: null,         // 复制下来的画布对象载荷。系统剪贴板拿不到时由它兜底
  openCardEl: null,
  theme: "light",          // light | dark；boot() 时由 readTheme() 覆盖
};

const THEME_KEY = "proto-canvas:theme:" + CANVAS_KEY;
const PROBE_ENDPOINT = "/api/canvas/probe";
const SAVE_ENDPOINTS = {
  annotations: "/api/canvas/annotations",
  layout: "/api/canvas/layout",
  view: "/api/canvas/view",      // 站点默认视图（锁定），落进 pages.json 的 viewDefaults
};
const SAVE_KINDS = Object.keys(SAVE_ENDPOINTS);

// =============================================================
//  持久化：文件是唯一真理。
//  服务模式：每次改动 PUT 到本地写服务落成 json（服务端盖 updatedAt）；
//  静态模式（无写 API：任意静态托管或 file://）：改动只在内存，靠「导出」带走。
//  localStorage 不承载任何标注 / 编排数据。
// =============================================================
const pending = { annotations: null, layout: null, view: null };   // 每种只留最新一份待发 payload
const inflight = { annotations: false, layout: false, view: false };
const retryTimers = { annotations: null, layout: null, view: null };
const RETRY_MS = 3000;

function setSaveState(status, detail) {
  const el = document.getElementById("saveState");
  if (!el) return;
  const text = {
    idle: "",
    saving: "保存中…",
    saved: "已保存",
    error: "保存失败，重试中",
    static: "静态副本"
  }[status] || "";
  el.dataset.state = status;
  el.textContent = text;
  el.title = detail ? (text + "：" + detail) : "标注与编排的落盘状态";
}

function persist(kind, payload) {
  state.dirty = true;
  refreshBadges();
  if (!state.serverMode) return;        // 静态模式：内存 + 导出，不落任何本机存储
  pending[kind] = payload;              // 拖拽中的连续写自然合并成最新一份
  flush(kind);
}

async function flush(kind) {
  if (inflight[kind]) return;           // 当前这轮发完会再看一眼 pending
  inflight[kind] = true;
  setSaveState("saving");
  while (pending[kind]) {
    const payload = pending[kind];
    pending[kind] = null;
    let retriable = true;
    try {
      const r = await fetch(SAVE_ENDPOINTS[kind], {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      let body = null;
      try { body = await r.json(); } catch (e2) {}
      if (!r.ok) {
        // 4xx 是这份 payload 本身过不了校验，隔 3 秒原样再发一遍还是同样的 400
        retriable = r.status >= 500;
        throw new Error((body && body.error) || ("HTTP " + r.status));
      }
      // 写服务落盘成功回 {ok: true, updatedAt}。缺这个回执的 2xx 来自别的东西
      // （静态托管的兜底页 / 反代），当成没写进去，否则「已保存」是假的
      if (!body || body.ok !== true) throw new Error("响应不是写服务的落盘回执");
    } catch (e) {
      if (!pending[kind]) pending[kind] = payload;   // 没有更新的 payload 才回填重试
      inflight[kind] = false;
      setSaveState("error", (e && e.message) || String(e));
      // 不重试也要留着 pending 与 dirty：beforeunload 仍拦，下一次编辑再带着新 payload 发
      if (retriable) scheduleRetry(kind);
      return;
    }
  }
  inflight[kind] = false;
  if (allSaveSettled()) {
    state.dirty = false;
    refreshBadges();
    setSaveState("saved");
  }
}

function scheduleRetry(kind) {
  if (retryTimers[kind]) return;
  retryTimers[kind] = setTimeout(() => {
    retryTimers[kind] = null;
    if (pending[kind]) flush(kind);
  }, RETRY_MS);
}

// 所有写通道都空了：没有待发 payload，也没有在飞的请求
function allSaveSettled() {
  return SAVE_KINDS.every(k => !pending[k] && !inflight[k]);
}

function hasUnsavedWork() {
  if (state.serverMode) return !allSaveSettled();
  return state.dirty;
}

function writeLayout() {
  persist("layout", { version: "2", frames: state.frames, shapes: state.shapes });
  historySchedule();
}

function writeAnnotations() {
  persist("annotations", { version: "1", annotations: state.annotations, orphans: state.orphans });
  historySchedule();
}

// =============================================================
//  撤销 / 重做：每次 writer 调用后拍一份内容快照，栈里存的就是快照。
//  快照是四条 JSON 串而不是对象：恢复时必然 parse 出新对象，栈里的历史
//  不可能被后续的原地修改污染；变更检测与分层重渲染都直接比串。
//  同一同步栈里的多次写（移除 frame 先写标注再写编排、导入连写三次）
//  经微任务合并成一步，与用户的一次操作对应。视图偏好（缩放 / 主题 /
//  锁定 / 分屏宽度）不是内容，不入栈。
// =============================================================
const canvasHistory = {
  undo: [], redo: [], present: null,
  ready: false,        // boot 归一化完成前的写不入栈
  muted: false,        // 为真时 writer 照常落盘但不入栈：恢复快照期间、半成品中间态
  scheduled: false,
  cap: 100,
  maxBytes: 8 * 1024 * 1024
};

function historySnapshot() {
  return {
    f: JSON.stringify(state.frames),
    s: JSON.stringify(state.shapes),
    a: JSON.stringify(state.annotations),
    o: JSON.stringify(state.orphans)
  };
}

// 纯函数：快照与 present 全同则不入栈（无实际变化的写不占一步）；
// 有变化才压栈并清空 redo，按步数与字节双上限丢最旧。
function historyPush(h, snap) {
  const p = h.present;
  if (p && p.f === snap.f && p.s === snap.s && p.a === snap.a && p.o === snap.o) return false;
  if (p) h.undo.push(p);
  h.present = snap;
  h.redo.length = 0;
  let bytes = 0;
  for (const s of h.undo) bytes += s.f.length + s.s.length + s.a.length + s.o.length;
  while (h.undo.length && (h.undo.length > h.cap || bytes > h.maxBytes)) {
    const dropped = h.undo.shift();
    bytes -= dropped.f.length + dropped.s.length + dropped.a.length + dropped.o.length;
  }
  return true;
}

// 纯函数：dir 为 "undo" / "redo"。源栈空返回 null；否则 present 压到对侧栈，
// 源栈顶成为新的 present 并返回。
function historyShift(h, dir) {
  const from = dir === "undo" ? h.undo : h.redo;
  const to = dir === "undo" ? h.redo : h.undo;
  if (!from.length) return null;
  to.push(h.present);
  h.present = from.pop();
  return h.present;
}

function historyReset() {
  canvasHistory.undo.length = 0;
  canvasHistory.redo.length = 0;
  canvasHistory.present = historySnapshot();
  canvasHistory.ready = true;
  syncHistoryButtons();
}

// muted 在 writer 同步调用的这一刻判定：微任务真正跑时标志早已复位
function historySchedule() {
  if (!canvasHistory.ready || canvasHistory.muted || canvasHistory.scheduled) return;
  canvasHistory.scheduled = true;
  queueMicrotask(historyFlush);
}

// 同步入栈。微任务只是自动触发器；撤销前还要显式调一次，把收口编辑态
// 刚提交的那笔压进去，否则它会在 pop 之后才跑、diff 为 0 而丢失且无法重做
function historyFlush() {
  canvasHistory.scheduled = false;
  if (!canvasHistory.ready || canvasHistory.muted) return;
  if (historyPush(canvasHistory, historySnapshot())) syncHistoryButtons();
}

// fn 期间的写照常落盘但不入栈。用于半成品中间态：新建标注先落一个空钉，
// 编辑卡关闭时才是用户眼里的一步，中间的空钉不该成为撤销能停下来的状态
function withoutHistory(fn) {
  const prev = canvasHistory.muted;
  canvasHistory.muted = true;
  try { fn(); } finally { canvasHistory.muted = prev; }
}

// 所有拖拽手势按下后把 body 的 userSelect 置 none、抬起时清空，拿它当「手势进行中」
// 的信号：拖到一半撤销会把手势闭包里的对象换成游离的，抬起时写不进 state
function pointerGestureActive() {
  return document.body.style.userSelect === "none";
}

function syncHistoryButtons() {
  const u = document.getElementById("btnUndo");
  const r = document.getElementById("btnRedo");
  if (u) u.disabled = canvasHistory.undo.length === 0;
  if (r) r.disabled = canvasHistory.redo.length === 0;
}

// 收口所有进行中的编辑态，撤销 / 重做 / 锁定共用。图形文本、箭头标签、
// 标注编辑卡一律提交而不是丢弃：与「点卡片外空白处自动保存」同一语义
function settleEditing() {
  flushNudge();                // 待写的方向键微移先落成历史里的一步，撤销才吃得到
  if (state.editingShapeId) commitShapeTextEdit();
  if (state.editingArrowLabelId) commitArrowLabelEdit();
  if (state.openCardEl) {
    if (state.openCardEl._commitEdit) state.openCardEl._commitEdit();
    else closeCurrentCard();
  }
  if (state.mode === "mark") exitMarkMode();
  if (state.mode === "remount") exitRemountMode();
  hidePortGhost();
  endAlign();
}

function undoCanvas() {
  if (state.locked || pointerGestureActive()) return;
  settleEditing();
  historyFlush();
  const snap = historyShift(canvasHistory, "undo");
  if (!snap) return;
  restoreSnapshot(snap);
  showTimedHint("已撤销", 1200);
}

function redoCanvas() {
  if (state.locked || pointerGestureActive()) return;
  settleEditing();
  historyFlush();
  const snap = historyShift(canvasHistory, "redo");
  if (!snap) return;
  restoreSnapshot(snap);
  showTimedHint("已重做", 1200);
}

// 按四条串与恢复前的差异分层重渲染：frame 层重建会让所有 iframe 重载，
// 同 id 集合只是挪了位置时原地改坐标；顺序固定 frames → shapes → pins，
// 图钉定位依赖 frame DOM 已就位。快照四数组是同一时刻拍的、彼此自洽，
// 恢复后不跑 orphanByMissingInstance，否则刚回来的 frame 标注会被踢进孤儿区。
function restoreSnapshot(snap) {
  const before = historySnapshot();
  const framesChanged = snap.f !== before.f;
  const shapesChanged = snap.s !== before.s;
  const annChanged = snap.a !== before.a || snap.o !== before.o;
  // 只替换有差异的数组：没变的那层 DOM 不重建，其闭包（bindShapeDrag 的 sh、
  // bindPinDrag 的 ann）还指着原对象，整体换掉会让下一次拖拽写进游离对象
  if (framesChanged) state.frames = JSON.parse(snap.f);
  if (shapesChanged) state.shapes = JSON.parse(snap.s);
  if (snap.a !== before.a) state.annotations = JSON.parse(snap.a);
  if (snap.o !== before.o) state.orphans = JSON.parse(snap.o);
  pruneSelection();

  if (framesChanged) restoreFrames(JSON.parse(before.f));
  if (shapesChanged) renderShapes();
  else if (framesChanged) refreshArrowGeometry();   // 挂在卡片上的箭头端点跟着卡片走
  syncSelection();     // DOM 重建后高亮与整组框要按恢复出来的集合重新回填
  if (annChanged || framesChanged) refreshPins();
  if (annChanged && document.getElementById("orphanDrawer").classList.contains("open")) renderOrphanDrawer();

  withoutHistory(() => {
    if (framesChanged || shapesChanged) writeLayout();
    if (annChanged) writeAnnotations();
  });

  syncSizer();
  renderViewPanel();
  refreshBadges();
  refreshLayoutBadge();
  syncHistoryButtons();
}

// id 集合与 pageId / frameKey 全同 → 只是挪了位置，原地改坐标不重建卡片（iframe 不重载）
function restoreFrames(prevFrames) {
  const sameSet = prevFrames.length === state.frames.length && state.frames.every((f, i) => {
    const p = prevFrames[i];
    return !!p && p.id === f.id && p.pageId === f.pageId && p.frameKey === f.frameKey;
  });
  if (!sameSet) { renderFrames(); return; }
  for (const f of state.frames) {
    const block = document.querySelector(`.frame-block[data-instance-id="${cssEscape(f.id)}"]`);
    if (!block) continue;
    block.style.left = (f.x || 0) + "px";
    block.style.top = (f.y || 0) + "px";
  }
  syncFrameSelection();
}

function enterStaticMode() {
  state.serverMode = false;
  state.imageUpload = false;
  const banner = document.getElementById("staticBanner");
  if (banner) banner.hidden = false;
  setSaveState("static");
}

async function probeServer() {
  try {
    const r = await fetch(PROBE_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    let info = null;
    try { info = await r.json(); } catch (e) {}
    // 只认写服务自报的 ok 回执：把未知路径也回 2xx 的静态托管（SPA 兜底 / 自定义错误页
    // 配 200 / 反代兜底）当成写服务，用户会一直看着「已保存」，改动全被丢弃，
    // beforeunload 也不拦——唯一的回流手段「导出」他根本不会去用
    if (!info || info.ok !== true) throw new Error("probe 响应不是画布写服务");
    state.serverMode = true;
    // 写服务被拷进各站点目录分发，版本参差；读它自报的 features 判断能不能贴图
    state.imageUpload = !!(info && info.features && info.features.image);
    state.viewSave = !!(info && info.features && info.features.view);
    setSaveState("saved");
  } catch (e) {
    enterStaticMode();   // 任意静态托管、file://、或服务未带写 API
  }
}

// 不变量：凡是整体替换 state.frames 的路径，替换后都必须跟一次本函数调用。
// 宿主实例已不在画布上的 frame 标注迁入孤儿区，避免图钉静默隐身。命名、字段
// （lostReason / lostAt）与 Python 侧 layout.orphan_by_missing_instance 及前端自己的
// removeFrameInstance() 保持一致；kind 为 canvas 的标注没有宿主实例，不参与判定。
// 判据是「宿主实例画得出来」而不是「实例还在数组里」：实例指向的页面 / 状态在本站点
// 不存在时卡片根本不渲染，标注留在 annotations 里就成了既看不见也找不回的黑洞
function orphanByMissingInstance() {
  const dead = deadInstanceIds(state.frames, state.pages);
  const liveIds = new Set(state.frames.map(f => f.id).filter(id => !dead.has(id)));
  const kept = [];
  let moved = 0;
  for (const ann of state.annotations) {
    const a = ann.anchor;
    if (!a || a.kind !== "frame") { kept.push(ann); continue; }
    if (a.instanceId && liveIds.has(a.instanceId)) { kept.push(ann); continue; }
    const o = Object.assign({}, ann);
    o.lostReason = !a.instanceId
      ? `未能在画布上找到 '${a.pageId}#${a.frameKey}' 的实例`
      : dead.has(a.instanceId)
        ? `宿主实例指向的 '${a.pageId}#${a.frameKey}' 在本站点不存在`
        : `宿主实例 '${a.instanceId}' 已不在画布上`;
    o.lostAt = nowIso();
    state.orphans.push(o);
    moved++;
  }
  state.annotations = kept;
  if (moved > 0) writeAnnotations();
  return moved;
}

// =============================================================
//  Theme (light / dark) — 只切画布外壳，iframe 内 APP 原型保持原貌
// =============================================================
// 站点默认（pages.json 的 viewDefaults.theme）随包分发；本机偏好压过它——
// 个人在自己浏览器里切过什么色，回来还是什么色
function readTheme(siteDefault) {
  const base = (siteDefault === "dark" || siteDefault === "light") ? siteDefault : "light";
  try {
    const t = localStorage.getItem(THEME_KEY);
    return (t === "dark" || t === "light") ? t : base;
  } catch (e) { return base; }
}

function writeTheme(t) {
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
}

function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const btn = document.getElementById("btnTheme");
  if (btn) {
    const ic = btn.querySelector("i");
    if (ic) ic.className = t === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
    btn.title = t === "dark" ? "切换到亮色模式" : "切换到暗色模式";
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme(state.theme);
  writeTheme(state.theme);
  // PRD drawer 已打开时让其内的 mermaid 跟随新主题重渲（异步，不阻塞按钮反馈）
  if (typeof rerenderPrdMermaidOnThemeChange === "function") rerenderPrdMermaidOnThemeChange();
}

// =============================================================
//  ID + helpers
// =============================================================
function nowIso() { return new Date().toISOString(); }
function genId() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 8);
  return `ann-${stamp}-${rand}`;
}
function nextNumber() {
  const all = state.annotations.concat(state.orphans);
  return all.reduce((m, a) => Math.max(m, a.number || 0), 0) + 1;
}
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// =============================================================
//  Markdown — full block + inline renderer (no external dep)
//    Supports: headings 1-6, paragraphs, bold/italic/strike/code,
//    links, images, ul/ol/task lists, blockquotes (multi-line),
//    fenced code blocks ```, tables, hr ---.
// =============================================================
function renderMarkdown(src) {
  if (!src) return "";
  const text = String(src).replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const out = [];
  let i = 0;

  // ---- inline formatter ----
  // 处理顺序：先 escape，再按 image/link/code/strong/em/strike 顺序替换。
  // 用占位符避免相互嵌套打架。
  function inline(raw) {
    let t = escapeHtml(raw);
    // images: ![alt](url)
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
      (_, alt, url) => `<img src="${url}" alt="${alt}"/>`);
    // links: [text](url)
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_, txt, url) => `<a href="${url}" target="_blank" rel="noopener">${txt}</a>`);
    // inline code: `code`
    t = t.replace(/`([^`\n]+)`/g, (_, c) => `<code>${c}</code>`);
    // strike: ~~text~~
    t = t.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    // bold: **text**  (must run before single *)
    t = t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    // italic: *text*  (avoid empty / leftover **)
    t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    return t;
  }

  function isHr(line) { return /^\s*---+\s*$/.test(line); }
  function isFence(line) { return /^\s*```/.test(line); }
  function isHeading(line) { return /^(#{1,6})\s+/.test(line); }
  function isUl(line) { return /^[-*]\s+/.test(line) && !/^[-*]\s+\[[ xX]\]\s+/.test(line) ? true : /^[-*]\s+/.test(line); }
  function isTaskItem(line) { return /^[-*]\s+\[[ xX]\]\s+/.test(line); }
  function isOl(line) { return /^\d+\.\s+/.test(line); }
  function isQuote(line) { return /^>\s?/.test(line); }
  function isTableSep(line) { return /^\s*\|?[\s:-]*-+[\s:-]*(\|[\s:-]*-+[\s:-]*)+\|?\s*$/.test(line); }
  function isTableRow(line) { return /^\s*\|.*\|\s*$/.test(line) || line.includes("|"); }

  while (i < lines.length) {
    let line = lines[i];

    // blank line
    if (!line.trim()) { i++; continue; }

    // hr
    if (isHr(line)) { out.push("<hr/>"); i++; continue; }

    // fenced code block
    if (isFence(line)) {
      const lang = (line.match(/^\s*```+\s*([^\s`]*)/) || [])[1] || "";
      const buf = [];
      i++;
      while (i < lines.length && !isFence(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      const code = buf.join("\n");
      if (/^mermaid$/i.test(lang)) {
        // mermaid 流程图:同步阶段先渲染成兜底代码块,DOM 插入后由 renderMermaidIn() 异步替换为 SVG;
        // mermaid 库未加载或语法出错时,这段代码块自然作为降级展示保留。
        out.push(`<div class="mermaid-diagram"><pre><code>${escapeHtml(code)}</code></pre></div>`);
      } else {
        out.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
      }
      continue;
    }

    // heading
    const hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      const level = hm[1].length;
      out.push(`<h${level}>${inline(hm[2])}</h${level}>`);
      i++;
      continue;
    }

    // table:  header row + separator row + body rows
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const splitRow = (l) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(c => c.trim());
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i]) && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      let html = "<table><thead><tr>";
      for (const h of header) html += `<th>${inline(h)}</th>`;
      html += "</tr></thead><tbody>";
      for (const r of rows) {
        html += "<tr>";
        for (const c of r) html += `<td>${inline(c)}</td>`;
        html += "</tr>";
      }
      html += "</tbody></table>";
      out.push(html);
      continue;
    }

    // blockquote (multi-line)
    if (isQuote(line)) {
      const buf = [];
      while (i < lines.length && isQuote(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${buf.map(b => `<p>${inline(b)}</p>`).join("")}</blockquote>`);
      continue;
    }

    // ordered list
    if (isOl(line)) {
      const items = [];
      while (i < lines.length && isOl(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(`<ol>${items.map(it => `<li>${inline(it)}</li>`).join("")}</ol>`);
      continue;
    }

    // unordered / task list (支持嵌套)
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && (/^[-*]\s+/.test(lines[i]) || /^\s+[-*]\s+/.test(lines[i]))) {
        const currentLine = lines[i];
        const indent = currentLine.match(/^(\s*)/)[1].length;

        // 顶层列表项（无缩进）
        if (indent === 0) {
          const raw = currentLine.replace(/^[-*]\s+/, "");
          const tm = raw.match(/^\[([ xX])\]\s+(.*)$/);

          // 收集该项的所有子项（缩进的行）
          const subLines = [];
          let j = i + 1;
          while (j < lines.length && /^\s+[-*]\s+/.test(lines[j])) {
            subLines.push(lines[j]);
            j++;
          }

          if (tm) {
            const checked = tm[1].toLowerCase() === "x" ? " checked" : "";
            items.push(`<li><input type="checkbox" disabled${checked}/> ${inline(tm[2])}</li>`);
          } else {
            let content = inline(raw);
            // 如果有子列表，递归渲染
            if (subLines.length > 0) {
              const subHtml = renderMarkdown(subLines.map(l => l.replace(/^\s{2}/, "")).join("\n"));
              content += subHtml;
            }
            items.push(`<li>${content}</li>`);
          }

          i = j; // 跳过已处理的子项
        } else {
          // 缩进项已在上面处理，这里跳过
          i++;
        }
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // paragraph (consume contiguous non-empty non-block lines)
    const para = [];
    while (i < lines.length && lines[i].trim() &&
           !isHr(lines[i]) && !isFence(lines[i]) && !isHeading(lines[i]) &&
           !isQuote(lines[i]) && !isOl(lines[i]) && !/^[-*]\s+/.test(lines[i]) &&
           !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return out.join("");
}

// renderMarkdown 同步产出的 .mermaid-diagram 占位,在容器插入 DOM 后调用此函数异步渲染为 SVG。
// 主题跟随画布 data-theme;渲染成功替换 innerHTML,失败/库缺失则保留占位里的兜底代码块。
let __mermaidSeq = 0;
async function renderMermaidIn(container) {
  if (!container || typeof window.mermaid === "undefined") return;
  const nodes = container.querySelectorAll(".mermaid-diagram");
  if (!nodes.length) return;
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  try {
    window.mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: dark ? "dark" : "default" });
  } catch (e) { /* initialize 失败则按默认配置继续 */ }
  for (const node of nodes) {
    if (node.dataset.rendered) continue;
    const codeEl = node.querySelector("code");
    const src = (codeEl ? codeEl.textContent : node.textContent || "").trim();
    if (!src) continue;
    try {
      const { svg } = await window.mermaid.render("mmd-" + (++__mermaidSeq), src);
      node.innerHTML = svg;
      node.dataset.rendered = "1";
    } catch (err) {
      node.dataset.rendered = "err"; // 保留兜底代码块,不动 innerHTML
    }
  }
}

// =============================================================
//  Canvas rendering
// =============================================================
// iframe 渲染辅助：sourceFile 用 encodeURI 安全转义（保留路径分隔符），frameKey 用 encodeURIComponent
function buildIframeUrl(page, frameKey) {
  const src = page && page.sourceFile;
  if (!src) return "";
  return encodeURI(src) + "?canvasMode=1#" + encodeURIComponent(frameKey);
}

// 页面视口档位（build_canvas.py 的 resolve_viewport 写入 pages.json）。
// 字段缺失时回退手机壳：viewport 字段是后加的，旧 pages.json 不重跑也要能正常渲染。
const FALLBACK_VIEWPORT = { width: 375, height: 812 };
function pageViewport(page) {
  const vp = (page && page.viewport) || null;
  const w = Number(vp && vp.width);
  const h = Number(vp && vp.height);
  return {
    width:  Number.isFinite(w) && w > 0 ? w : FALLBACK_VIEWPORT.width,
    height: Number.isFinite(h) && h > 0 ? h : FALLBACK_VIEWPORT.height,
  };
}

// 实例的视口档位。画布上一个实例的卡片宽高由它所属页面决定，
// 同一张画布上手机页与中台页可以并排摆，各按各的尺寸。
function instViewport(inst) {
  return pageViewport(state.pages.find(p => p.id === (inst && inst.pageId)));
}

// 回填护栏。iframe 高度回填天然是个正反馈回路：回填改变 iframe 视口高 → 页面里依赖视口高的
// 布局重新算 → 回报新高度。bootstrap v19 起在测量端把「跟视口等高」的撑满约束中和掉，理论上
// 已解耦；这里是防御纵深，挡住尚未预料到的自反路径（例如 height:100vh 元素外还挂着别的内容），
// 免得一页悄悄涨到上万像素。
const HEIGHT_HARD_CAP = 20000;
const RUNAWAY_STREAK = 4;              // 连续这么多次「等量正增长」判定为自反
const autoresizeState = new WeakMap(); // iframe -> { delta, streak, locked }

// 监听 iframe 内 bootstrap 通过 postMessage 回报的内容高度，回填 iframe.style.height
// 浮层（弹窗/toast/sheet 等）固定按 CSS 中的视口档位高度展示，跳过回填
function bindIframeAutoresize() {
  window.addEventListener("message", (e) => {
    const data = e.data;
    if (!data) return;
    // 同源/file:// 场景兼容（后续接 CDN 也安全）
    if (e.origin !== window.location.origin && e.origin !== "null") return;
    if (data.type !== "canvas-frame-ready") return;
    const iframes = document.querySelectorAll(".frame iframe");
    for (const ifr of iframes) {
      if (ifr.contentWindow === e.source) {
        const frameEl = ifr.closest(".frame");
        if (frameEl?.dataset.frameKind === "overlay") break;
        const guard = autoresizeState.get(ifr) || { delta: 0, streak: 0, locked: false };
        if (guard.locked) break;
        // 下限取该页视口档位高度，而非写死手机壳：中台页短内容不该被撑到 812
        const floor = parseInt(frameEl?.dataset.frameH, 10) || FALLBACK_VIEWPORT.height;
        let h = Math.max(parseInt(data.height, 10) || 0, floor);
        const cur = parseInt(ifr.style.height, 10) || 0;
        if (h > HEIGHT_HARD_CAP) {
          h = HEIGHT_HARD_CAP;
          guard.locked = true;
        } else if (cur > 0 && h > cur) {
          // 等量递增是自反的指纹：内容真的变高（图片/字体加载完）时增量不会一次次完全相同
          const delta = h - cur;
          if (Math.abs(delta - guard.delta) <= 1) {
            guard.streak += 1;
          } else {
            guard.delta = delta;
            guard.streak = 1;
          }
          if (guard.streak >= RUNAWAY_STREAK) guard.locked = true;
        } else {
          guard.delta = 0;
          guard.streak = 0;
        }
        autoresizeState.set(ifr, guard);
        if (guard.locked) {
          console.warn(
            `[canvas] frame 高度自反增长已锁定：${frameEl?.dataset.pageId} / ${frameEl?.dataset.frameKey}`,
            `锁定在 ${cur || h}px。检查该页是否有超出 100vh 的固定偏移（多余 margin / 游离文本节点等）。`
          );
          if (cur > 0) break;   // 已有高度就停在原地，别再把这一轮的增量吃进去
        }
        // 去抖：相同高度不重排，避免 reportHeight spam 触发 N 次 refreshPins
        if (h !== cur) {
          ifr.style.height = h + "px";
          // 高度变化会影响 pin-layer 锚点定位与 sizer 高度，重绘
          refreshPins();
          refreshArrowGeometry();   // 卡片变高了，绑在下边与两侧的端点位置跟着变
          syncSizer();
        }
        break;
      }
    }
  });
}

// 从 pages.json 查 frame 的元信息（标题 / 类型），渲染 caption 用。
// pages 显式传入的纯函数形态：导入前要拿另一份数据对账，测试也直接调它
function findFrameMetaIn(pages, pageId, frameKey) {
  const page = (pages || []).find(p => p && p.id === pageId);
  if (!page) return null;
  const s = (page.mainStates || []).find(x => x.key === frameKey);
  if (s) return { kind: "state", label: s.label || s.key, tag: s.tag || "", page: page };
  const o = (page.overlays || []).find(x => x.key === frameKey);
  if (o) return { kind: "overlay", label: o.label || o.key, tag: o.kind || "popup", page: page };
  return null;
}

function findFrameMeta(pageId, frameKey) {
  return findFrameMetaIn(state.pages, pageId, frameKey);
}

// 在这份 pages 下渲染不出来的实例：renderFrameInstance 查不到 meta 就整张卡片不画，
// 挂在上面的标注会跟着一起看不见。导入前拿它对账、导入后拿它把标注转成孤儿
function deadInstanceIds(frames, pages) {
  const out = new Set();
  for (const f of frames || []) {
    if (!f || typeof f.id !== "string") continue;
    if (!findFrameMetaIn(pages, f.pageId, f.frameKey)) out.add(f.id);
  }
  return out;
}

// 箭头端点指向的宿主在这份数据里不存在时，该端悬空。只做纯判定，几何修复交给
// 调用方（要用到渲染尺寸）。正常导入两端都在同一份文件里，结果恒为空
function danglingArrowEnds(shapes, frames) {
  const frameIds = new Set((frames || []).map(f => f && f.id));
  const shapeIds = new Set((shapes || []).map(s => s && s.id));
  const alive = (end) => {
    if (!end || typeof end !== "object") return true;
    if (end.instanceId) return frameIds.has(end.instanceId);
    if (end.shapeId) return shapeIds.has(end.shapeId);
    return true;                              // 自由端本来就是绝对坐标
  };
  const out = [];
  for (const sh of shapes || []) {
    if (!sh || sh.kind !== "arrow") continue;
    const from = alive(sh.from), to = alive(sh.to);
    if (from && to) continue;
    out.push({ id: sh.id, from: from, to: to });
  }
  return out;
}

// 渲染单个 frame 实例。data-instance-id 挂在 .frame-block 与 .frame 上：
// 前者供拖拽与定位，后者供标注锚点解析（resolvePinPosition 按实例查 DOM）
function renderFrameInstance(inst) {
  const meta = findFrameMeta(inst.pageId, inst.frameKey);
  if (!meta) return null;
  const block = document.createElement("div");
  block.className = "frame-block";
  // 选中态跟着重建走：renderCanvas 会整片重建卡片 DOM，不在这里回填就会「删了个图形，
  // 选中的卡片高亮凭空消失」
  const selCls = selectionClass("frame", inst.id);
  if (selCls) block.classList.add(selCls);
  block.style.left = (inst.x || 0) + "px";
  block.style.top = (inst.y || 0) + "px";
  block.dataset.instanceId = inst.id;
  block.dataset.pageId = inst.pageId;
  const url = buildIframeUrl(meta.page, inst.frameKey);
  const pageLabel = meta.page.name || meta.page.id;
  const tagText = meta.kind === "state"
    ? (meta.tag ? ` · ${escapeHtml(meta.tag)}` : "")
    : "";
  // 视口档位变量挂在最外层 block：选中描边、拖拽包围盒都按 block 的宽度算，
  // 挂到内层 .frame 上 block 取不到（CSS 变量只向下继承），中台宽屏页的描边会缩成手机壳宽度。
  const vp = pageViewport(meta.page);
  block.style.setProperty("--frame-w", vp.width + "px");
  block.style.setProperty("--frame-h", vp.height + "px");
  block.innerHTML = `
    <div class="frame-caption">
      <span class="kind-tag">${escapeHtml(meta.kind === "state" ? "state" : meta.tag)}</span>
      ${escapeHtml(pageLabel)} · ${escapeHtml(meta.label)}${tagText}
    </div>
    <div class="frame ${meta.kind === "state" ? "main" : "overlay"}"
         data-frame-h="${vp.height}"
         data-instance-id="${escapeHtml(inst.id)}"
         data-page-id="${escapeHtml(inst.pageId)}"
         data-frame-kind="${escapeHtml(meta.kind)}"
         data-frame-key="${escapeHtml(inst.frameKey)}">
      <iframe data-frame-key="${escapeHtml(inst.frameKey)}" src="${escapeHtml(url)}"
              loading="lazy" tabindex="-1" scrolling="no"></iframe>
    </div>
  `;
  bindFrameDrag(block);
  return block;
}

// 渲染依据是 layout.frames：画布上有哪些实例由用户编排决定，pages.json 只提供每个 frame 的元信息
function renderFrames() {
  const stage = document.getElementById("canvasStage");
  // 只清自己这一层：图形层与图钉层由各自的 render 负责，
  // 画一个便签不该让所有 iframe 重新加载一遍
  stage.querySelectorAll(":scope > .frame-block, :scope > .empty-state").forEach(el => el.remove());
  const pinLayer = document.getElementById("pinLayer");

  if (!state.frames.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = '<i class="fa-solid fa-folder-open"></i>画布是空的，点底部工具条的「+」添加页面';
    stage.insertBefore(empty, pinLayer);
    return;
  }

  for (const inst of state.frames) {
    const el = renderFrameInstance(inst);
    if (el) stage.insertBefore(el, pinLayer);
  }
}

function renderCanvas() {
  renderFrames();
  renderShapes();
  refreshPins();
  syncSizer();
}

// =============================================================
//  图形层：rect / note / text / image 是绝对定位 DOM，arrow 走 SVG
// =============================================================
const SVG_NS = "http://www.w3.org/2000/svg";
const SHAPE_ABBR = { rect: "rect", note: "note", text: "text", arrow: "arw", flow: "flow", image: "img" };
const SHAPE_MIN_W = 40;
const SHAPE_MIN_H = 32;
const NOTE_COLORS = ["yellow", "pink", "blue", "green"];
const NOTE_DEFAULT_W = 200;
const NOTE_DEFAULT_H = 200;

// 形状注册表：一个轮廓一个 key，绝不为「同一个形状的两种叫法」开两条 path。
// groups 决定它出现在哪个面板（geo = R 键基础几何，flow = F 键流程符号），
// 同一轮廓在两种语境下叫法不同的，用 geoLabel 补几何名（decision 在流程里叫判定、
// 在几何里叫菱形）。w / h 是点一下不拖时的默认落笔尺寸，比例按各自轮廓的可读性定。
const SHAPE_DEFS = {
  // 流程符号
  start:       { label: "起止",       groups: ["flow"],        w: 160, h: 56 },
  process:     { label: "处理",       groups: ["flow", "geo"], geoLabel: "圆角矩形",   w: 160, h: 72 },
  decision:    { label: "判定",       groups: ["flow", "geo"], geoLabel: "菱形",       w: 160, h: 90 },
  io:          { label: "输入输出",   groups: ["flow", "geo"], geoLabel: "平行四边形", w: 170, h: 72 },
  data:        { label: "数据",       groups: ["flow", "geo"], geoLabel: "圆柱",       w: 150, h: 90 },
  doc:         { label: "文档",       groups: ["flow"],        w: 160, h: 90 },
  connector:   { label: "连接点",     groups: ["flow", "geo"], geoLabel: "圆",         w: 60,  h: 60 },
  predefined:  { label: "预定义处理", groups: ["flow"],        w: 170, h: 72 },
  manualOp:    { label: "手动操作",   groups: ["flow"],        w: 170, h: 72 },
  manualInput: { label: "手动输入",   groups: ["flow"],        w: 170, h: 72 },
  delay:       { label: "延迟",       groups: ["flow"],        w: 150, h: 72 },
  prep:        { label: "准备",       groups: ["flow", "geo"], geoLabel: "六边形",     w: 170, h: 80 },
  display:     { label: "显示",       groups: ["flow"],        w: 170, h: 72 },
  multidoc:    { label: "多文档",     groups: ["flow"],        w: 160, h: 96 },
  offpage:     { label: "页外连接",   groups: ["flow"],        w: 120, h: 80 },
  // 基础几何
  square:       { label: "矩形",   groups: ["geo"], w: 160, h: 120 },
  triangle:     { label: "三角形", groups: ["geo"], w: 140, h: 120 },
  triangleDown: { label: "倒三角", groups: ["geo"], w: 140, h: 120 },
  trapezoid:    { label: "梯形",   groups: ["geo"], w: 170, h: 100 },
  pentagon:     { label: "五边形", groups: ["geo"], w: 140, h: 130 },
  star:         { label: "星形",   groups: ["geo"], w: 140, h: 130 },
  cross:        { label: "十字",   groups: ["geo"], w: 130, h: 130 },
  arrowRight:   { label: "块箭头", groups: ["geo"], w: 170, h: 90 },
  cloud:        { label: "云形",   groups: ["geo"], w: 180, h: 110 }
};
// 能当流程节点用的图形：可以换形状、四边可以长出连接点。便签换成流程轮廓会丢掉
// 颜色语义、四边外侧还被色板占着；文字图形随内容撑开，没有稳定包围盒可挂东西。
const NODE_KINDS = ["flow", "rect"];
const FLOW_VARIANTS = Object.keys(SHAPE_DEFS);
const FLOW_ORDER = FLOW_VARIANTS.filter(v => SHAPE_DEFS[v].groups.includes("flow"));
// 「方框」是 kind === "rect" 的圈选框，不是 flow 节点，但它在用户眼里就是一种基础
// 图形，放进几何面板首位。落笔分支与切换器都要为它单独判一次 kind。
const GEO_ORDER = ["rect"].concat(FLOW_VARIANTS.filter(v => SHAPE_DEFS[v].groups.includes("geo")));
const RECT_LABEL = "方框";
const RECT_DEFAULT_SIZE = { w: 240, h: 180 };

// 面板显示名：几何组里同一轮廓另有叫法时取 geoLabel
function shapeLabel(v, group) {
  if (v === "rect") return RECT_LABEL;
  const d = SHAPE_DEFS[v];
  if (!d) return v;
  return (group === "geo" && d.geoLabel) ? d.geoLabel : d.label;
}

function shapeDefaultSize(v) {
  if (v === "rect") return RECT_DEFAULT_SIZE;
  return SHAPE_DEFS[v] || SHAPE_DEFS.process;
}

// 坐标取两位小数：三角函数算出来的点会拖一长串浮点尾巴，d 属性凭空胖一圈
function n2(v) { return Math.round(v * 100) / 100; }

// 正多边形顶点，尖朝上，外接椭圆是整个盒子
function polyPoints(sides, w, h) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / sides;
    pts.push([n2(w / 2 + (w / 2) * Math.cos(a)), n2(h / 2 + (h / 2) * Math.sin(a))]);
  }
  return pts;
}

function polyPath(pts) {
  return pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ") + " Z";
}

// 每种轮廓一个生成函数，入参是实际 w / h。所有轮廓都用内联 SVG 描边：clip-path 会把
// 描边一起裁掉，菱形、平行四边形这类非矩形轮廓根本画不出边。path 按实际 w / h 重算
// 而不是靠 viewBox 拉伸，否则窄高的节点描边会被拉成粗细不均。
// .flow-path 是 fill + stroke，凡是「装饰线」（预定义处理的双竖线、多文档的叠层边）
// 一律拆成互不相连的直线子路径：开放折线在 fill 时会被隐式闭合成一块多余的填充区。
const SHAPE_PATH = {
  process(w, h) {
    const r = 4;
    return `M${r} 0 L${w - r} 0 Q${w} 0 ${w} ${r} L${w} ${h - r} Q${w} ${h} ${w - r} ${h}`
         + ` L${r} ${h} Q0 ${h} 0 ${h - r} L0 ${r} Q0 0 ${r} 0 Z`;
  },
  square(w, h) {
    return `M0 0 L${w} 0 L${w} ${h} L0 ${h} Z`;
  },
  decision(w, h) {
    return `M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z`;
  },
  io(w, h) {
    const off = Math.min(w * 0.18, 28);
    return `M${off} 0 L${w} 0 L${w - off} ${h} L0 ${h} Z`;
  },
  data(w, h) {
    // 圆柱：外轮廓（顶弧上凸 + 侧壁 + 底弧下凸）再补一段顶盖的下凸弧当碗口
    const ry = Math.min(h * 0.18, 16);
    const rx = w / 2;
    return `M0 ${ry} A${rx} ${ry} 0 0 1 ${w} ${ry} L${w} ${h - ry} A${rx} ${ry} 0 0 1 0 ${h - ry} Z`
         + ` M${w} ${ry} A${rx} ${ry} 0 0 1 0 ${ry}`;
  },
  doc(w, h) {
    const wave = Math.min(h * 0.18, 16);
    return `M0 0 L${w} 0 L${w} ${h - wave} C${w * 0.75} ${h}, ${w * 0.25} ${h - wave * 2}, 0 ${h - wave} Z`;
  },
  connector(w, h) {
    const rx = w / 2, ry = h / 2;
    return `M0 ${ry} A${rx} ${ry} 0 0 1 ${w} ${ry} A${rx} ${ry} 0 0 1 0 ${ry} Z`;
  },
  start(w, h) {
    // 胶囊用四角独立圆角画，不用「两段跨整条边的大弧」：后者在 w < h 时
    // 上下直边退化成零长度，两端点的距离超出半径能覆盖的弦长，SVG 会按规范
    // 把半径放大到 h/2，两段弧拼成一个溢出边框的整圆。四角写法在 r 取到
    // 短边一半时自然退化成半圆加直边，横盒竖盒都对。
    const r = Math.min(w, h) / 2;
    return `M${r} 0 L${w - r} 0 A${r} ${r} 0 0 1 ${w} ${r} L${w} ${h - r} A${r} ${r} 0 0 1 ${w - r} ${h}`
         + ` L${r} ${h} A${r} ${r} 0 0 1 0 ${h - r} L0 ${r} A${r} ${r} 0 0 1 ${r} 0 Z`;
  },
  predefined(w, h) {
    const bar = Math.min(w * 0.12, 16);
    return `M0 0 L${w} 0 L${w} ${h} L0 ${h} Z`
         + ` M${bar} 0 L${bar} ${h} M${w - bar} 0 L${w - bar} ${h}`;
  },
  manualOp(w, h) {
    const off = Math.min(w * 0.16, 28);
    return `M0 0 L${w} 0 L${w - off} ${h} L${off} ${h} Z`;
  },
  manualInput(w, h) {
    const slope = Math.min(h * 0.3, 24);
    return `M0 ${slope} L${w} 0 L${w} ${h} L0 ${h} Z`;
  },
  delay(w, h) {
    const r = Math.min(h / 2, w);
    return `M0 0 L${w - r} 0 A${r} ${r} 0 0 1 ${w - r} ${h} L0 ${h} Z`;
  },
  prep(w, h) {
    const off = Math.min(w * 0.2, 32);
    return `M${off} 0 L${w - off} 0 L${w} ${h / 2} L${w - off} ${h} L${off} ${h} L0 ${h / 2} Z`;
  },
  display(w, h) {
    const off = Math.min(w * 0.15, 24);
    const r = Math.min(w * 0.22, 32);
    return `M${off} 0 L${w - r} 0 A${r} ${h / 2} 0 0 1 ${w - r} ${h} L${off} ${h} L0 ${h / 2} Z`;
  },
  multidoc(w, h) {
    const wave = Math.min(h * 0.14, 14);
    const off = Math.min(h * 0.1, 10);
    const fw = w - off * 2;
    // 前层是完整的文档轮廓，后两层各只画露出来的顶边与右边，两条线彼此分离
    const front = `M0 ${off * 2} L${fw} ${off * 2} L${fw} ${h - wave}`
                + ` C${fw * 0.75} ${h}, ${fw * 0.25} ${h - wave * 2}, 0 ${h - wave} Z`;
    const mid = ` M${off} ${off} L${w - off} ${off} M${w - off} ${off} L${w - off} ${h - wave - off}`;
    const back = ` M${off * 2} 0 L${w} 0 M${w} 0 L${w} ${h - wave - off * 2}`;
    return front + mid + back;
  },
  offpage(w, h) {
    return `M0 0 L${w} 0 L${w} ${h * 0.62} L${w / 2} ${h} L0 ${h * 0.62} Z`;
  },
  triangle(w, h) {
    return `M${w / 2} 0 L${w} ${h} L0 ${h} Z`;
  },
  triangleDown(w, h) {
    return `M0 0 L${w} 0 L${w / 2} ${h} Z`;
  },
  trapezoid(w, h) {
    const off = Math.min(w * 0.18, 32);
    return `M${off} 0 L${w - off} 0 L${w} ${h} L0 ${h} Z`;
  },
  pentagon(w, h) {
    return polyPath(polyPoints(5, w, h));
  },
  star(w, h) {
    // 十个顶点交替落在外接椭圆与 0.382 倍的内接椭圆上，自交部分靠 nonzero 填充规则填实
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const k = i % 2 ? 0.382 : 1;
      pts.push([n2(w / 2 + (w / 2) * k * Math.cos(a)), n2(h / 2 + (h / 2) * k * Math.sin(a))]);
    }
    return polyPath(pts);
  },
  cross(w, h) {
    const t = Math.min(w, h) * 0.34;
    const x1 = n2((w - t) / 2), x2 = n2((w + t) / 2);
    const y1 = n2((h - t) / 2), y2 = n2((h + t) / 2);
    return `M${x1} 0 L${x2} 0 L${x2} ${y1} L${w} ${y1} L${w} ${y2} L${x2} ${y2} L${x2} ${h}`
         + ` L${x1} ${h} L${x1} ${y2} L0 ${y2} L0 ${y1} L${x1} ${y1} Z`;
  },
  arrowRight(w, h) {
    const hw = Math.min(w * 0.35, 44);      // 箭头部分的长度
    const sy1 = n2(h * 0.25), sy2 = n2(h * 0.75);
    return `M0 ${sy1} L${w - hw} ${sy1} L${w - hw} 0 L${w} ${h / 2} L${w - hw} ${h}`
         + ` L${w - hw} ${sy2} L0 ${sy2} Z`;
  },
  cloud(w, h) {
    // 归一坐标里定义控制点再线性映射到 w / h：SVG 不设 viewBox、描边宽度独立于
    // 坐标系，等比只影响轮廓胖瘦，不会像 viewBox 拉伸那样让描边粗细不均
    const p = (x, y) => n2(x * w) + " " + n2(y * h);
    return `M${p(0.18, 0.92)} C${p(0.08, 0.92)} ${p(0.02, 0.80)} ${p(0.08, 0.70)}`
         + ` C${p(0.02, 0.56)} ${p(0.12, 0.42)} ${p(0.26, 0.46)}`
         + ` C${p(0.30, 0.26)} ${p(0.52, 0.20)} ${p(0.60, 0.36)}`
         + ` C${p(0.70, 0.24)} ${p(0.90, 0.30)} ${p(0.90, 0.48)}`
         + ` C${p(0.98, 0.54)} ${p(0.98, 0.86)} ${p(0.86, 0.92)} Z`;
  }
};

function flowPath(variant, w, h) {
  const fn = SHAPE_PATH[variant] || SHAPE_PATH.process;
  return fn(w, h);
}

// 尺寸变化后重算轮廓。resize 每帧都要跑，只改属性不重建节点。
function syncFlowPath(el, sh) {
  const svg = el.querySelector(".flow-svg");
  if (!svg) return;
  const w = sh.w || SHAPE_DEFS.process.w;
  const h = sh.h || SHAPE_DEFS.process.h;
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  const p = svg.querySelector(".flow-path");
  if (p) p.setAttribute("d", flowPath(sh.variant, w, h));
}

function genShapeId(kind) {
  return "sh-" + (SHAPE_ABBR[kind] || kind) + "-" + Math.random().toString(36).slice(2, 6);
}

function findShape(id) {
  return state.shapes.find(s => s.id === id);
}

// 屏幕坐标转画布坐标。基准与 resolvePinPosition / computeAnchor 一致：
// stage 的 border 为 0，绝对定位子元素的包含块边界与 getBoundingClientRect 重合，
// 不需要额外补 padding。
function toCanvasPoint(clientX, clientY) {
  const b = document.getElementById("canvasStage").getBoundingClientRect();
  return { x: (clientX - b.left) / state.zoom, y: (clientY - b.top) / state.zoom };
}

function renderShapes() {
  const stage = document.getElementById("canvasStage");
  stage.querySelectorAll(":scope > .shape-block").forEach(el => el.remove());
  const old = document.getElementById("arrowLayer");
  if (old) old.remove();

  const layer = document.createElementNS(SVG_NS, "svg");
  layer.setAttribute("class", "arrow-layer");
  layer.id = "arrowLayer";
  stage.insertBefore(layer, document.getElementById("pinLayer"));

  for (const sh of state.shapes) {
    if (!sh || !sh.id) continue;
    if (sh.kind === "arrow") { renderArrow(sh, layer); continue; }
    const el = renderShapeBlock(sh);
    if (el) stage.insertBefore(el, layer);
  }
  renderArrowLabels();
  syncSelection();     // 图形 DOM 刚重建：高亮、整组框、浮条一起按集合回填
}

function renderShapeBlock(sh) {
  const el = document.createElement("div");
  el.className = "shape-block";
  el.dataset.shapeId = sh.id;
  el.dataset.kind = sh.kind;
  if (sh.kind === "note") el.dataset.color = NOTE_COLORS.includes(sh.color) ? sh.color : "yellow";
  if (sh.kind === "flow") el.dataset.variant = FLOW_VARIANTS.includes(sh.variant) ? sh.variant : "process";
  el.style.left = (sh.x || 0) + "px";
  el.style.top = (sh.y || 0) + "px";
  if (sh.kind !== "text") {
    el.style.width = (sh.w || 160) + "px";
    el.style.height = (sh.h || 80) + "px";
  }
  const selCls = selectionClass("shape", sh.id);
  if (selCls) el.classList.add(selCls);

  const body = document.createElement("div");
  body.className = "shape-body";
  if (sh.kind === "image") {
    // 图片没有文字层：它承载的是截图本身，双击编辑文字对它没有意义
    const img = document.createElement("img");
    img.className = "shape-image";
    img.alt = "";
    img.draggable = false;
    img.src = sh.src || "";
    body.appendChild(img);
  } else {
    const txt = document.createElement("div");
    txt.className = "shape-text";
    // 图形文本一律纯文本：只用 textContent，不给 innerHTML 留入口
    txt.textContent = sh.text || "";
    // 粘贴一律降级成纯文本：图形文本的存储与渲染都只认 textContent，
    // 放富文本进 DOM 只会造成「显示的和存下的不一致」。
    // 绑在这里而不是 beginShapeTextEdit：文本没变时 commit 不重建 DOM，
    // 绑在编辑入口会让同一个元素反复进出编辑态时监听层层累积。
    txt.addEventListener("paste", (ev) => {
      ev.preventDefault();
      const t = (ev.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, t);
    });
    // 换行统一交给 insertLineBreak：浏览器对 Enter 的默认处理是拆出嵌套 <div>，
    // 那种结构会让文字层的衬底与内边距按行割裂开。与 paste 同处绑定，理由一致。
    txt.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      document.execCommand("insertLineBreak");
    });
    body.appendChild(txt);
  }
  el.appendChild(body);

  // 轮廓压在文字层下面：SVG 绝对定位铺满整块，文字仍走 shape-body 的 flex 居中
  if (sh.kind === "flow") {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "flow-svg");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "flow-path");
    svg.appendChild(path);
    el.insertBefore(svg, body);
    syncFlowPath(el, sh);
  }

  if (sh.kind === "note") {
    const pal = document.createElement("div");
    pal.className = "shape-palette";
    for (const c of NOTE_COLORS) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.color = c;
      b.title = c;
      // 吞掉 pointerdown，避免点色块被 bindShapeDrag 当成起手拖动
      b.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (state.locked) return;
        sh.color = c;
        el.dataset.color = c;
        writeLayout();
      });
      pal.appendChild(b);
    }
    el.appendChild(pal);
  }

  // 方框内部让出指针（见 .shape-block[data-kind="rect"] 的 pointer-events），
  // 边框一线的命中交给这四条透明边条，它们自己拿回指针
  if (sh.kind === "rect") {
    for (const edge of ["t", "r", "b", "l"]) {
      const hit = document.createElement("div");
      hit.className = "shape-hit-edge";
      hit.dataset.edge = edge;
      el.appendChild(hit);
    }
  }

  if (sh.kind !== "text") {
    for (const dir of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
      const h = document.createElement("div");
      h.className = "sh-handle";
      h.dataset.dir = dir;
      el.appendChild(h);
    }
  }

  // 连接点只给流程节点与方框：便签的四边外侧被色板占着，文字图形没有稳定包围盒
  if (NODE_KINDS.includes(sh.kind)) {
    for (const side of PORT_SIDES) {
      const port = document.createElement("div");
      port.className = "shape-port";
      port.dataset.side = side;
      port.title = "点击接一个节点 · 拖出拉一条线";
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-arrow-right";
      port.appendChild(icon);
      el.appendChild(port);
    }
    bindShapePorts(el, sh);
  }

  el.addEventListener("dblclick", (e) => {
    if (state.tool !== "select" || state.mode !== "browse") return;
    if (sh.kind === "image") return;      // 没有文字层可编辑，让双击落到默认行为
    e.stopPropagation();
    selectShape(sh.id);
    beginShapeTextEdit(sh.id);
  });

  bindShapeDrag(el, sh);
  if (sh.kind !== "text") bindShapeResize(el, sh);
  return el;
}

// =============================================================
//  选中：集合是唯一真理源，两个单选值由它派生
// =============================================================
// 图形与 frame 同住一个集合：它们共用 Delete 键、共用拖拽手感，分成两套会让
// 「现在选的是哪些」不可名状。selectedShapeId / selectedFrameId 只在集合恰好
// 一个成员时有值——八向手柄、连接点、形状浮条、箭头端点手柄这些单选专属 UI
// 全都读派生值，多选时它们读到 null 自动收起，不必各自去判断集合大小。
// DOM 高亮同理分两档：单选 .selected（专属 UI 照常出），多选 .co-selected（只描边）。
// CSS 里手柄与端口是按 :not(.selected) 隐藏的，多选成员不带 .selected，隐藏天然成立。
function isSelected(kind, id) {
  return state.selection.some(m => m.kind === kind && m.id === id);
}

function selectionClass(kind, id) {
  if (!isSelected(kind, id)) return "";
  return state.selection.length > 1 ? "co-selected" : "selected";
}

function setSelection(members) {
  state.selection = (members || []).filter(m => m && m.id);
  syncSelection();
}

function addToSelection(members) {
  const next = state.selection.slice();
  for (const m of members || []) {
    if (!m || !m.id) continue;
    if (!next.some(x => x.kind === m.kind && x.id === m.id)) next.push(m);
  }
  setSelection(next);
}

function toggleSelection(kind, id) {
  const next = state.selection.filter(m => !(m.kind === kind && m.id === id));
  if (next.length === state.selection.length) next.push({ kind, id });
  setSelection(next);
}

function clearSelection() { setSelection([]); }

// 集合里的对象被删掉 / 被撤销掉之后要摘干净：留着游离 id 会让派生值指向不存在的对象，
// 整组拖拽与 Delete 都会对着空气使劲。凡改过 state.frames / state.shapes 的地方都过一次。
function pruneSelection() {
  const alive = state.selection.filter(m => m.kind === "shape"
    ? state.shapes.some(s => s.id === m.id)
    : state.frames.some(f => f.id === m.id));
  state.selection = alive;
  syncSelection();
}

function syncSelection() {
  const one = state.selection.length === 1 ? state.selection[0] : null;
  state.selectedShapeId = one && one.kind === "shape" ? one.id : null;
  state.selectedFrameId = one && one.kind === "frame" ? one.id : null;
  syncSelectionDom();
  syncSelectionBox();
  syncShapeToolbar();
}

function syncSelectionDom() {
  document.querySelectorAll("[data-shape-id]").forEach(el => {
    const cls = selectionClass("shape", el.dataset.shapeId);
    el.classList.toggle("selected", cls === "selected");
    el.classList.toggle("co-selected", cls === "co-selected");
  });
  syncFrameSelection();
}

function syncFrameSelection() {
  document.querySelectorAll(".frame-block[data-instance-id]").forEach(el => {
    const cls = selectionClass("frame", el.dataset.instanceId);
    el.classList.toggle("selected", cls === "selected");
    el.classList.toggle("co-selected", cls === "co-selected");
  });
}

// 单选的糖：现有调用点全部是「就选这一个」的语义，传 null 即清空
function selectShape(id) { setSelection(id ? [{ kind: "shape", id }] : []); }
function selectFrame(id) { setSelection(id ? [{ kind: "frame", id }] : []); }

// 成员的包围盒。三种对象三套算法，整组包围框、框选命中、整组拖拽共用这一处
function memberBox(m) {
  if (m.kind === "frame") {
    const inst = state.frames.find(f => f.id === m.id);
    return inst ? frameBox(inst) : null;
  }
  const sh = findShape(m.id);
  if (!sh) return null;
  return sh.kind === "arrow" ? arrowBox(sh) : shapeBox(sh);
}

// 箭头没有矩形语义，取折线全部拐点的包围盒——只用端点会让绕开的折线漏出框外
function arrowBox(sh) {
  const pts = arrowPoints(sh);
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of pts) {
    x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
  }
  if (!isFinite(x1)) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function selectionBounds(members) {
  let box = null;
  for (const m of (members || state.selection)) {
    const b = memberBox(m);
    if (!b) continue;
    box = box ? {
      x: Math.min(box.x, b.x),
      y: Math.min(box.y, b.y),
      w: Math.max(box.x + box.w, b.x + b.w) - Math.min(box.x, b.x),
      h: Math.max(box.y + box.h, b.y + b.h) - Math.min(box.y, b.y)
    } : b;
  }
  return box;
}

// 整组虚线框：只在多选时出现，让一组对象读起来是一个整体。
// 拖拽期间由 beginGroupDrag 直接平移这个元素，不逐帧重算包围盒。
const SELECTION_BOX_PAD = 6;

// 框选手势进行中：这期间不画整组框——选框本身已经在表达「圈住了哪一片」，
// 两个框叠着看会分不清哪个是手上的那个
let marqueeActive = false;

function syncSelectionBox() {
  const el = document.getElementById("selectionBox");
  if (!el) return;
  const box = (state.selection.length > 1 && !marqueeActive) ? selectionBounds() : null;
  if (!box) { el.hidden = true; return; }
  el.hidden = false;
  el.style.left = (box.x - SELECTION_BOX_PAD) + "px";
  el.style.top = (box.y - SELECTION_BOX_PAD) + "px";
  el.style.width = (box.w + SELECTION_BOX_PAD * 2) + "px";
  el.style.height = (box.h + SELECTION_BOX_PAD * 2) + "px";
}

function removeShape(id) {
  const sh = findShape(id);
  // 降级必须赶在从 state.shapes 里摘掉之前：resolveArrowEnd 要靠它算锚点坐标
  if (sh && sh.kind !== "arrow") detachArrowsFromHost("shapeId", id);
  state.shapes = state.shapes.filter(s => s.id !== id);
  pruneSelection();
  if (state.editingShapeId === id) state.editingShapeId = null;
  if (state.editingArrowLabelId === id) state.editingArrowLabelId = null;
  writeLayout();
  renderShapes();
  syncSizer();
}

// =============================================================
//  连接点：选中节点后从四边长出来的快捷键
//    点一下 = 在那个方向落一个同型节点并自动连线（画流程的主路径）
//    拖出去 = 从这条边直接拉一条箭头，落点仍走 snapToTarget 吸附
// =============================================================
const PORT_SIDES = ["top", "right", "bottom", "left"];
const OPPOSITE_SIDE = { top: "bottom", right: "left", bottom: "top", left: "right" };
const PORT_GAP_H = 100;      // 横向接节点时两块之间留的空
const PORT_GAP_V = 70;       // 纵向留的空比横向小：流程图竖着排更密才读得顺
const PORT_COLLIDE_PAD = 8;
const PORT_MAX_TRIES = 10;

// 落点与既有内容是否打架。text 不算：它随内容撑开，没有可靠包围盒。
function boxCollides(box, selfId) {
  const hit = (b) => !(
    box.x + box.w + PORT_COLLIDE_PAD <= b.x || b.x + b.w + PORT_COLLIDE_PAD <= box.x ||
    box.y + box.h + PORT_COLLIDE_PAD <= b.y || b.y + b.h + PORT_COLLIDE_PAD <= box.y
  );
  for (const sh of state.shapes) {
    if (sh.id === selfId || sh.kind === "arrow" || sh.kind === "text") continue;
    if (hit(shapeBox(sh))) return true;
  }
  for (const inst of state.frames) {
    if (hit(frameBox(inst))) return true;
  }
  return false;
}

// 沿 side 方向逐格外推，直到不与任何东西重叠。推满上限仍冲突就落在最后那一格——
// 摆得挤一点也好过卡住不给节点。
function nextNodeBox(src, side) {
  const box = shapeBox(src);
  const horizontal = side === "left" || side === "right";
  const step = horizontal ? box.w + PORT_GAP_H : box.h + PORT_GAP_V;
  const dx = side === "right" ? 1 : (side === "left" ? -1 : 0);
  const dy = side === "bottom" ? 1 : (side === "top" ? -1 : 0);
  let cand = { x: box.x + dx * step, y: box.y + dy * step, w: box.w, h: box.h };
  for (let i = 2; i <= PORT_MAX_TRIES && boxCollides(cand, src.id); i++) {
    cand = { x: box.x + dx * step * i, y: box.y + dy * step * i, w: box.w, h: box.h };
  }
  return cand;
}

function ghostVariant(src) {
  if (src.kind === "rect") return "square";
  return SHAPE_DEFS[src.variant] ? src.variant : "process";
}

// 预览元素在 HTML 里常驻，只切显隐与内容：ghost 每次 hover 都重建 DOM 没必要，
// 常驻还让它和其它层一样受「引用的 id 必须真实存在」这条不变量保护
function showPortGhost(src, side) {
  const g = document.getElementById("shapeGhost");
  if (!g) return;
  const b = nextNodeBox(src, side);
  g.style.left = b.x + "px";
  g.style.top = b.y + "px";
  g.style.width = b.w + "px";
  g.style.height = b.h + "px";
  g.textContent = "";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "flow-svg");
  svg.setAttribute("width", b.w);
  svg.setAttribute("height", b.h);
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("class", "flow-path");
  p.setAttribute("d", flowPath(ghostVariant(src), b.w, b.h));
  svg.appendChild(p);
  g.appendChild(svg);
  g.hidden = false;
}

function hidePortGhost() {
  const g = document.getElementById("shapeGhost");
  if (!g) return;
  g.hidden = true;
  g.textContent = "";
}

function createLinkedNode(src, side) {
  if (state.locked) return;
  const b = nextNodeBox(src, side);
  const sh = {
    id: genShapeId(src.kind), kind: src.kind,
    x: b.x, y: b.y, w: b.w, h: b.h, text: ""
  };
  if (src.kind === "flow") sh.variant = SHAPE_DEFS[src.variant] ? src.variant : "process";
  const arrow = {
    id: genShapeId("arrow"), kind: "arrow",
    from: { shapeId: src.id, anchor: side },
    to: { shapeId: sh.id, anchor: OPPOSITE_SIDE[side] },
    route: "elbow"
  };
  state.shapes.push(sh, arrow);
  selectShape(sh.id);
  writeLayout();
  renderShapes();
  syncSizer();
  beginShapeTextEdit(sh.id);     // 落下即可直接打字，与手动落节点同一条手感
}

function bindShapePorts(el, sh) {
  el.querySelectorAll(".shape-port").forEach(port => {
    const side = port.dataset.side;
    const usable = () => !state.locked && state.tool === "select" && state.mode === "browse";

    port.addEventListener("pointerenter", () => {
      if (!usable()) return;
      showPortGhost(sh, side);
    });
    port.addEventListener("pointerleave", hidePortGhost);

    port.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !usable()) return;
      e.preventDefault();
      e.stopPropagation();          // 不要冒泡给 bindShapeDrag，否则变成拖整个图形
      selectShape(sh.id);
      const startX = e.clientX, startY = e.clientY;
      let arrow = null;             // 超过阈值才生出来；没生出来就是「点一下接节点」

      const teardown = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
        document.body.style.userSelect = "";
      };

      const onMove = (ev) => {
        const p = toCanvasPoint(ev.clientX, ev.clientY);
        if (!arrow) {
          if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
          hidePortGhost();          // 改成拉线了，落点预览就不该再留着
          document.body.style.userSelect = "none";
          arrow = {
            id: genShapeId("arrow"), kind: "arrow",
            from: { shapeId: sh.id, anchor: side },
            to: { x: p.x, y: p.y },
            route: "elbow"
          };
          state.shapes.push(arrow);
          renderShapes();
        }
        arrow.to = snapToTarget(p, arrow.id) || { x: p.x, y: p.y };
        refreshArrowGeometry();
      };

      const onUp = () => {
        teardown();
        hidePortGhost();
        if (!arrow) { createLinkedNode(sh, side); return; }
        selectShape(arrow.id);
        writeLayout();
        renderShapes();
        syncSizer();
      };

      // 手势被系统打断：半截的线撤掉，什么都不落
      const onCancel = () => {
        teardown();
        hidePortGhost();
        if (!arrow) return;
        state.shapes = state.shapes.filter(s => s.id !== arrow.id);
        renderShapes();
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
    });
  });
}

// =============================================================
//  整组拖动：拖任一成员，选中集合里的所有对象同位移
// =============================================================
// 起手先把每个成员的原始坐标抄一份，之后每帧都从原始坐标 + 本帧总位移重算。
// 累加式（每帧在上一帧结果上加增量）在吸附来回修正时会把误差攒进坐标里，
// 拖一段路组内相对位置就散了。
function beginGroupDrag() {
  const items = [];
  for (const m of state.selection) {
    if (m.kind === "frame") {
      const inst = state.frames.find(f => f.id === m.id);
      if (inst) items.push({ kind: "frame", obj: inst, ox: inst.x || 0, oy: inst.y || 0 });
      continue;
    }
    const sh = findShape(m.id);
    if (!sh) continue;
    if (sh.kind === "arrow") {
      // 绑在宿主上的那一头由宿主带着走，这里只搬自由端；两端都绑住的箭头整条不动
      const ends = ["from", "to"].filter(k => sh[k] && !sh[k].instanceId && !sh[k].shapeId);
      if (ends.length) {
        items.push({
          kind: "arrow", obj: sh, ends,
          ox: ends.map(k => sh[k].x || 0),
          oy: ends.map(k => sh[k].y || 0)
        });
      }
      continue;
    }
    items.push({ kind: "shape", obj: sh, ox: sh.x || 0, oy: sh.y || 0 });
  }

  const box = selectionBounds() || { x: 0, y: 0, w: 0, h: 0 };
  const sbEl = document.getElementById("selectionBox");
  const boxEl = (sbEl && !sbEl.hidden) ? sbEl : null;
  const boxLeft = boxEl ? (parseFloat(boxEl.style.left) || 0) : 0;
  const boxTop = boxEl ? (parseFloat(boxEl.style.top) || 0) : 0;
  const hasFrame = items.some(it => it.kind === "frame");
  let last = { dx: 0, dy: 0 };

  const apply = (dx, dy) => {
    last = { dx, dy };
    for (const it of items) {
      if (it.kind === "arrow") {
        it.ends.forEach((k, i) => {
          it.obj[k].x = it.ox[i] + dx;
          it.obj[k].y = it.oy[i] + dy;
        });
        continue;
      }
      it.obj.x = it.ox + dx;
      it.obj.y = it.oy + dy;
      const sel = it.kind === "frame"
        ? `.frame-block[data-instance-id="${cssEscape(it.obj.id)}"]`
        : `.shape-block[data-shape-id="${cssEscape(it.obj.id)}"]`;
      const el = document.querySelector(sel);
      if (el) {
        el.style.left = it.obj.x + "px";
        el.style.top = it.obj.y + "px";
      }
    }
    // 整组框跟手平移而不是逐帧重算包围盒：重算要读 DOM 尺寸，拖大组时每帧都在强制回流
    if (boxEl) {
      boxEl.style.left = (boxLeft + dx) + "px";
      boxEl.style.top = (boxTop + dy) + "px";
    }
    if (hasFrame) refreshPins();
    refreshArrowGeometry();     // 图形与卡片都是箭头宿主，连线跟着走
  };

  // 下界钳制：canvas-stage 四周留白是常量 CANVAS_PAD，负坐标一旦超出这圈缓冲区，
  // 高倍缩放下换算出的 scrollTo 目标会是负数，被浏览器钳到 0，卡片再也滚不回来。
  // -CANVAS_PAD / 2 在缩放上限 2x 时仍落在可滚动范围内（阈值是 -CANVAS_PAD / zoom），
  // 留了一倍冗余。整组统一补偿同一个差值，组内相对位置不因钳制而变形。
  const clampToFloor = () => {
    const floor = -CANVAS_PAD / 2;
    let fx = 0, fy = 0;
    for (const it of items) {
      if (it.kind !== "frame") continue;
      fx = Math.max(fx, floor - it.obj.x);
      fy = Math.max(fy, floor - it.obj.y);
    }
    if (fx > 0 || fy > 0) apply(last.dx + fx, last.dy + fy);
  };

  return { items, box, apply, clampToFloor, ids: new Set(items.map(it => it.obj.id)) };
}

// 起手时这一下点击对选中集合做什么：
//   Shift 点击     → 加进来 / 摘出去，摘出去之后这一下不再进拖拽
//   点未选中的对象 → 重置成只选它
//   点已选中的对象 → 集合原样留着供整组拖动；最终没拖动的话由 onClick 收敛成只选它
// 返回 false 表示这一下不该进入拖拽手势。
function prepareSelectionForDrag(kind, id, shiftKey) {
  if (shiftKey) {
    toggleSelection(kind, id);
    return isSelected(kind, id);
  }
  if (!isSelected(kind, id)) setSelection([{ kind, id }]);
  return true;
}

// 拖拽手势主体：图形与 frame 共用。超过阈值才算拖动，避免和点击冲突；
// 移动中整组同位移走 beginGroupDrag，落点统一写盘。
// 事件挂 document 而不是目标元素：方框内部与 iframe 都让出了指针，光标一离开命中环，
// 事件就不再经过那个元素，挂在它身上的监听等不到阈值那一下，拖不动。
function startGroupDragGesture(e, opts) {
  const el = opts.el;
  const startX = e.clientX, startY = e.clientY;
  const group = beginGroupDrag();
  let dragging = false;

  const cleanup = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", cleanup);
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    document.body.style.userSelect = "";
    if (opts.dragClass) el.classList.remove(opts.dragClass);
    endAlign();
  };

  const onMove = (ev) => {
    if (ev.buttons === 0) { cleanup(); return; }
    if (!dragging) {
      if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
      dragging = true;
      document.body.style.userSelect = "none";
      if (opts.dragClass) el.classList.add(opts.dragClass);
      if (opts.onDragStart) opts.onDragStart();
      beginAlign(group.ids);      // 自己人不参与吸附，否则整组一动参考线就打在组内
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    }
    const snapped = applyAlign(group.box, (ev.clientX - startX) / state.zoom, (ev.clientY - startY) / state.zoom);
    renderGuides(snapped.guides);
    group.apply(snapped.dx, snapped.dy);
  };

  const onUp = () => {
    const wasDragging = dragging;
    cleanup();
    if (!wasDragging) { if (opts.onClick) opts.onClick(); return; }
    group.clampToFloor();
    writeLayout();
    syncSizer();
    refreshPins();
    syncSelectionBox();     // 拖动期只平移了整组框，落点按真实包围盒重算一次
  };

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", cleanup);
}

// 图形整体移动。与 bindFrameDrag 同构，两者共用 startGroupDragGesture。
function bindShapeDrag(el, sh) {
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (state.tool !== "select") return;
    if (state.mode !== "browse") return;
    if (state.locked) return;
    if (state.editingShapeId === sh.id) return;      // 正在编辑文本，拖动让位给选字
    if (e.target.classList.contains("sh-handle")) return;
    e.stopPropagation();                              // 不要冒泡到 stage 的「点空白取消选中」
    if (!prepareSelectionForDrag("shape", sh.id, e.shiftKey)) return;

    startGroupDragGesture(e, {
      el,
      onClick: () => {
        // 在多选里点了一下没拖：收敛成只选这一个，与 Figma 一致
        if (!e.shiftKey && state.selection.length > 1) selectShape(sh.id);
      }
    });
  });
}

// 八向缩放的系数表：aw / ah 表示鼠标位移对宽 / 高的贡献方向。
// 负系数意味着拖的是左边或上边，此时左上角要跟着钳制后的尺寸反推，
// 不能直接用位移改 x / y——否则拖过最小尺寸后框会继续往反方向跑。
const RESIZE_DIRS = {
  nw: { aw: -1, ah: -1 },
  n:  { aw:  0, ah: -1 },
  ne: { aw:  1, ah: -1 },
  e:  { aw:  1, ah:  0 },
  se: { aw:  1, ah:  1 },
  s:  { aw:  0, ah:  1 },
  sw: { aw: -1, ah:  1 },
  w:  { aw: -1, ah:  0 },
};

// 图片按原始比例约束尺寸：拉变形的截图在评审里读不出东西。
// 角上拖时以位移贡献更大的那一轴为准，边上拖时只有一轴有贡献、另一轴反推。
//
// 宽是唯一自变量，高一律由 ratio 反推——这是比例不崩的关键，下限也只钳宽。
// 分别把宽和高钳到各自的最小值等于放出两个独立自变量，拖过头时会把任意比例的图
// 压成 SHAPE_MIN_W × SHAPE_MIN_H 那一个方框。minW 里带上 SHAPE_MIN_H / ratio，
// 保证反推出来的高同样不低于下限。
function constrainRatio(w0, h0, tw, th, dir) {
  const ratio = h0 / w0;
  if (dir.aw === 0) tw = th / ratio;
  else if (dir.ah === 0) th = tw * ratio;
  else if (Math.abs(tw - w0) * ratio >= Math.abs(th - h0)) th = tw * ratio;
  else tw = th / ratio;
  const minW = Math.max(SHAPE_MIN_W, SHAPE_MIN_H / ratio);
  if (!(tw > minW)) tw = minW;      // 负数、NaN 与过小统一走这条
  return { w: tw, h: tw * ratio };
}

function bindShapeResize(el, sh) {
  el.querySelectorAll(".sh-handle").forEach(handle => {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (state.locked || state.mode !== "browse") return;
      if (state.tool !== "select") return;
      const dir = RESIZE_DIRS[handle.dataset.dir];
      if (!dir) return;
      e.preventDefault();
      e.stopPropagation();
      selectShape(sh.id);

      const startX = e.clientX, startY = e.clientY;
      const x0 = sh.x || 0, y0 = sh.y || 0;
      const w0 = sh.w || el.offsetWidth, h0 = sh.h || el.offsetHeight;
      document.body.style.userSelect = "none";

      const teardown = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        document.body.style.userSelect = "";
      };

      const onMove = (ev) => {
        const dx = (ev.clientX - startX) / state.zoom;
        const dy = (ev.clientY - startY) / state.zoom;
        let w = Math.max(SHAPE_MIN_W, w0 + dir.aw * dx);
        let h = Math.max(SHAPE_MIN_H, h0 + dir.ah * dy);
        if (sh.kind === "image" && w0 > 0 && h0 > 0) {
          const fixed = constrainRatio(w0, h0, w0 + dir.aw * dx, h0 + dir.ah * dy, dir);
          w = fixed.w;
          h = fixed.h;
        }
        sh.w = w;
        sh.h = h;
        sh.x = dir.aw < 0 ? x0 + w0 - w : x0;
        sh.y = dir.ah < 0 ? y0 + h0 - h : y0;
        el.style.left = sh.x + "px";
        el.style.top = sh.y + "px";
        el.style.width = w + "px";
        el.style.height = h + "px";
        if (sh.kind === "flow") syncFlowPath(el, sh);
        refreshArrowGeometry();   // 尺寸变了边中点也变，连线要重算
      };

      // pointercancel 与 pointerup 走同一条收尾：中途被打断时尺寸已经改在 state 上，
      // 落盘保住用户当前看到的结果，比回滚成旧尺寸更符合直觉
      const onUp = () => {
        teardown();
        writeLayout();
        syncSizer();
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  });
}

// contenteditable 里的换行在 DOM 上是 <br> 或块级元素边界，textContent 只拼文本节点，
// 会把换行全部吃掉；innerText 按渲染结果取值，读回来的才与屏幕上看到的一致。
// 顺带把 nbsp 归一成普通空格：编辑态下浏览器会自动把空格换成 nbsp，落盘留着它
// 会让同样的文本在别处（摘要、搜索）对不上。
function readEditableText(el) {
  if (!el) return "";
  const raw = el.innerText != null ? el.innerText : (el.textContent || "");
  return raw.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
}

// 图形文本编辑。state.editingShapeId 是这个态的专有标志，ESC 第 1 级只认它——
// 不能用 isTyping()：它对任意 contenteditable 返回 true，标注编辑卡的 .ann-body
// 正是 contenteditable 且打开即自动聚焦，用它作条件会把「ESC 关闭标注编辑卡」吃掉。
function beginShapeTextEdit(shapeId) {
  if (state.locked) return;
  // 已经在编辑就直接返回：dblclick 绑在外层 .shape-block 上，编辑态下在文字上再双击
  // （原生的选词手势）会冒泡回来，重入会多挂一个 blur 监听，并在下一帧把选区改成全选，
  // 把用户刚选中的那个词吃掉。
  if (state.editingShapeId === shapeId) return;
  const sh = findShape(shapeId);
  if (!sh || sh.kind === "arrow") return;
  const el = document.querySelector(
    `.shape-block[data-shape-id="${cssEscape(shapeId)}"] .shape-text`
  );
  if (!el) return;

  state.editingShapeId = shapeId;
  el.setAttribute("contenteditable", "true");
  el.addEventListener("blur", () => commitShapeTextEdit(), { once: true });

  // 延一帧再 focus：mousedown 阶段浏览器的默认焦点处理会把焦点抢回去
  requestAnimationFrame(() => {
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  });
}

function commitShapeTextEdit() {
  const id = state.editingShapeId;
  if (!id) return;
  state.editingShapeId = null;
  const el = document.querySelector(
    `.shape-block[data-shape-id="${cssEscape(id)}"] .shape-text`
  );
  if (el) {
    el.removeAttribute("contenteditable");
    el.blur();
  }
  const sh = findShape(id);
  if (!sh) return;
  const txt = el ? readEditableText(el) : sh.text;
  // 文字图形没有边框也没有尺寸，内容空了就只剩一个点不中的空元素，直接删掉
  if (sh.kind === "text" && !txt) { removeShape(id); return; }
  if (txt === sh.text) return;
  sh.text = txt;
  writeLayout();
  renderShapes();
  syncSizer();
}

// =============================================================
//  框选：空白处拖出一个框，与框相交的卡片与图形一起进选中集合
// =============================================================
// 相交即选中，不要求把对象整个框住：评审画布上一张卡片就占半屏，要求全包等于逼着
// 用户先缩到很小才框得起来。起手必须落在空白——落在对象上是拖那个对象，两种手势不抢。
const MARQUEE_THRESHOLD = 4;

function boxesIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function marqueeHits(box) {
  const hits = [];
  for (const inst of state.frames) {
    const b = frameBox(inst);
    if (b && boxesIntersect(box, b)) hits.push({ kind: "frame", id: inst.id });
  }
  for (const sh of state.shapes) {
    if (!sh || !sh.id) continue;
    const b = sh.kind === "arrow" ? arrowBox(sh) : shapeBox(sh);
    if (b && boxesIntersect(box, b)) hits.push({ kind: "shape", id: sh.id });
  }
  return hits;
}

function startMarqueeGesture(e) {
  const stage = document.getElementById("canvasStage");
  const p0 = toCanvasPoint(e.clientX, e.clientY);
  const startX = e.clientX, startY = e.clientY;
  const before = state.selection.slice();                  // 手势被打断时还原到这一份
  const base = e.shiftKey ? before : [];                   // Shift 框选 = 在现有选中之上追加
  let el = null, box = null, raf = 0;

  const teardown = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (el) el.remove();
    marqueeActive = false;
    document.body.style.userSelect = "";
  };

  const paint = () => {
    raf = 0;
    if (!el || !box) return;
    el.style.left = box.x + "px";
    el.style.top = box.y + "px";
    el.style.width = box.w + "px";
    el.style.height = box.h + "px";
    setSelection(base.concat(marqueeHits(box)));    // 实时高亮：框拖到哪，亮到哪
  };

  const onMove = (ev) => {
    if (ev.buttons === 0) { onCancel(); return; }
    if (!el) {
      if (Math.abs(ev.clientX - startX) < MARQUEE_THRESHOLD
        && Math.abs(ev.clientY - startY) < MARQUEE_THRESHOLD) return;
      el = document.createElement("div");
      el.className = "marquee";
      stage.insertBefore(el, document.getElementById("pinLayer"));
      marqueeActive = true;
      // 起手那一下不能 preventDefault（要留给编辑中的文本 blur 提交），原生选择因此
      // 可能已经起头了：过阈值时清掉它，再关掉后续的框选文本
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
      document.body.style.userSelect = "none";
    }
    const p = toCanvasPoint(ev.clientX, ev.clientY);
    box = {
      x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y),
      w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y)
    };
    // rAF 节流：命中判定要把所有卡片与图形的包围盒算一遍，pointermove 的原生频率下白算好几轮
    if (!raf) raf = requestAnimationFrame(paint);
  };

  // 手势被系统打断（切应用、触控板三指等）：选中还原成起手前的样子。
  // 不能拿 base 还原——它在非 Shift 框选时是空的，那样一次误触会把原本选好的一组清掉
  const onCancel = () => { teardown(); setSelection(before); };

  const onUp = () => {
    const dragged = !!el;
    if (raf) { cancelAnimationFrame(raf); raf = 0; paint(); }   // 按最后一帧的框落定
    teardown();
    syncSelectionBox();
    // 没拖出框 = 点了一下空白：清空选中
    if (!dragged) clearSelection();
  };

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onCancel);
}

// 图形创建：在 sizer 上一处监听，按当前工具分派。事件仍先从 stage 冒泡上来再到 sizer；
// iframe 是 pointer-events:none，点在原型上的事件照样能冒泡上去，所以卡片上方也能起笔。
function bindShapeCreate() {
  const stage = document.getElementById("canvasStage");
  // 命中宿主是 sizer 不是 stage：stage 的子元素全是绝对定位，撑不开父盒子，它自己的
  // 命中盒只有 padding 撑出的一小块，空白画布上的 pointerdown 根本冒泡不到它身上。
  // sizer 覆盖「内容包围盒 + 四周留白」整片区域，而滚动条属于外层 canvas-scroll、
  // 不在 sizer 内，不会误触发。draft 元素仍插进 stage，坐标基准也仍是 stage。
  const surface = document.getElementById("canvasSizer");

  surface.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (state.locked || state.mode !== "browse") return;

    if (state.tool === "select") {
      // 点在图形或卡片上时交给它们自己的 pointerdown：那两处挂在更深的元素上、冒泡后才
      // 到这里，在这里动选中等于卡片刚选中又立刻被改掉。落在空白才起框选手势
      if (e.target.closest("[data-shape-id]")) return;
      if (e.target.closest(".frame-block")) return;
      startMarqueeGesture(e);
      return;
    }
    if (state.tool === "note") {
      e.preventDefault();
      const p = toCanvasPoint(e.clientX, e.clientY);
      const sh = {
        id: genShapeId("note"), kind: "note",
        x: p.x, y: p.y, w: NOTE_DEFAULT_W, h: NOTE_DEFAULT_H,
        text: "", color: "yellow"
      };
      state.shapes.push(sh);
      selectShape(sh.id);
      writeLayout();
      renderShapes();
      syncSizer();
      setTool("select");
      beginShapeTextEdit(sh.id);    // 落下即可直接打字，省一次双击
      return;
    }

    if (state.tool === "text") {
      e.preventDefault();
      const p = toCanvasPoint(e.clientX, e.clientY);
      const sh = { id: genShapeId("text"), kind: "text", x: p.x, y: p.y, text: "" };
      state.shapes.push(sh);
      selectShape(sh.id);
      // 这里刻意不 writeLayout：空文字对象没有意义，等 commitShapeTextEdit
      // 决定它是被写入还是被删掉，避免磁盘上留一堆看不见的空壳
      renderShapes();
      setTool("select");
      beginShapeTextEdit(sh.id);
      return;
    }

    if (state.tool === "arrow") {
      e.preventDefault();
      const p0 = toCanvasPoint(e.clientX, e.clientY);
      const sh = {
        id: genShapeId("arrow"), kind: "arrow",
        from: snapToTarget(p0, null) || { x: p0.x, y: p0.y },
        to: { x: p0.x, y: p0.y },
        // 路由取箭头面板当前选择；默认折线：画流程是主场景，省一次切换
        route: state.arrowRoute === "straight" ? "straight" : "elbow"
      };
      state.shapes.push(sh);
      renderShapes();

      let moved = false;
      const teardown = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
      };
      const discard = () => {
        state.shapes = state.shapes.filter(s => s.id !== sh.id);
        renderShapes();
        setTool("select");
      };

      const onMove = (ev) => {
        moved = true;
        const p = toCanvasPoint(ev.clientX, ev.clientY);
        sh.to = snapToTarget(p, sh.id) || { x: p.x, y: p.y };
        refreshArrowGeometry();
      };

      const onCancel = () => { teardown(); discard(); };

      const onUp = () => {
        teardown();
        // 没拖动过就是误点，一条零长度箭头既看不见也点不中，直接撤掉
        if (!moved) { discard(); return; }
        selectShape(sh.id);
        writeLayout();
        renderShapes();
        syncSizer();
        setTool("select");
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
      return;
    }

    // geo 与 flow 同一条落笔管线，落下的都是 kind === "flow" 的节点，
    // 差别只在形状取哪个 state 字段——两个面板本来就是同一份形状库的两个视图
    if (state.tool === "flow" || state.tool === "geo") {
      e.preventDefault();
      const pick = state.tool === "geo" ? state.geoVariant : state.flowVariant;
      const variant = SHAPE_DEFS[pick] ? pick : "process";
      const p0 = toCanvasPoint(e.clientX, e.clientY);
      const draft = document.createElement("div");
      draft.className = "shape-block";
      draft.dataset.kind = "flow";
      draft.dataset.variant = variant;
      draft.style.left = p0.x + "px";
      draft.style.top = p0.y + "px";
      const dsvg = document.createElementNS(SVG_NS, "svg");
      dsvg.setAttribute("class", "flow-svg");
      const dpath = document.createElementNS(SVG_NS, "path");
      dpath.setAttribute("class", "flow-path");
      dsvg.appendChild(dpath);
      draft.appendChild(dsvg);
      stage.insertBefore(draft, document.getElementById("pinLayer"));

      let box = null;
      const teardown = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
        draft.remove();
      };

      const onMove = (ev) => {
        const p = toCanvasPoint(ev.clientX, ev.clientY);
        box = {
          x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y),
          w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y)
        };
        draft.style.left = box.x + "px";
        draft.style.top = box.y + "px";
        draft.style.width = box.w + "px";
        draft.style.height = box.h + "px";
        dsvg.setAttribute("width", box.w);
        dsvg.setAttribute("height", box.h);
        dpath.setAttribute("d", flowPath(variant, box.w, box.h));
      };

      const onCancel = () => { teardown(); setTool("select"); };

      const onUp = () => {
        teardown();
        // 与 rect 不同：不拖也落一个默认尺寸的节点。流程图是连续摆节点的活，
        // 每个都要求拖出尺寸太累，点一下就有更顺手。
        const def = shapeDefaultSize(variant);
        const b = (box && box.w >= SHAPE_MIN_W && box.h >= SHAPE_MIN_H)
          ? box
          : { x: p0.x - def.w / 2, y: p0.y - def.h / 2, w: def.w, h: def.h };
        const sh = {
          id: genShapeId("flow"), kind: "flow", variant,
          x: b.x, y: b.y, w: b.w, h: b.h, text: ""
        };
        state.shapes.push(sh);
        selectShape(sh.id);
        writeLayout();
        renderShapes();
        syncSizer();
        setTool("select");
        beginShapeTextEdit(sh.id);    // 落下即可直接打字，省一次双击
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
      return;
    }

    if (state.tool !== "rect") return;

    e.preventDefault();
    const p0 = toCanvasPoint(e.clientX, e.clientY);
    const draft = document.createElement("div");
    draft.className = "shape-block";
    draft.dataset.kind = "rect";
    draft.style.left = p0.x + "px";
    draft.style.top = p0.y + "px";
    draft.innerHTML = '<div class="shape-body"></div>';
    stage.insertBefore(draft, document.getElementById("pinLayer"));

    let box = null;
    const teardown = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      draft.remove();
    };

    const onMove = (ev) => {
      const p = toCanvasPoint(ev.clientX, ev.clientY);
      box = {
        x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y),
        w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y)
      };
      draft.style.left = box.x + "px";
      draft.style.top = box.y + "px";
      draft.style.width = box.w + "px";
      draft.style.height = box.h + "px";
    };

    // 手势被系统打断（切应用、触控板三指等）：草稿撤掉，什么都不落
    const onCancel = () => { teardown(); setTool("select"); };

    const onUp = () => {
      teardown();
      // 没拖出尺寸（当成误点）就不落对象，避免画布攒一堆看不见的空框
      if (!box || box.w < SHAPE_MIN_W || box.h < SHAPE_MIN_H) { setTool("select"); return; }
      const sh = {
        id: genShapeId("rect"), kind: "rect",
        x: box.x, y: box.y, w: box.w, h: box.h, text: ""
      };
      state.shapes.push(sh);
      selectShape(sh.id);
      writeLayout();
      renderShapes();
      syncSizer();
      setTool("select");     // 画完自动回选择工具，和 Figma 单次绘制的手感一致
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
  });

  document.addEventListener("keydown", (e) => {
    if (isTyping()) return;              // 编辑文本时 Backspace 是删字符、方向键是移光标

    if (e.key === "Delete" || e.key === "Backspace") {
      if (state.locked || !state.selection.length) return;
      e.preventDefault();
      // removeCanvasObjects 自带「卡片上还有 N 条标注」的确认框与孤儿区迁移，
      // 误删不会静默丢标注；一组一起删也只弹一次、只占一步撤销
      deleteSelection();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
      if (state.locked || state.tool !== "select" || state.mode !== "browse") return;
      e.preventDefault();
      selectAllObjects();
      return;
    }

    // 复制只读不写，锁定态照样可用：锁着的画布也该能把内容拷去别处
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && shortcutLetter(e) === "c") {
      if (state.tool !== "select" || state.mode !== "browse" || !state.selection.length) return;
      e.preventDefault();
      copySelection();
      return;
    }

    const dir = NUDGE_DIRS[e.key];
    if (dir && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (state.locked || state.tool !== "select" || state.mode !== "browse") return;
      if (!state.selection.length) return;
      e.preventDefault();
      const step = e.shiftKey ? NUDGE_STEP_BIG : NUDGE_STEP;
      nudgeSelection(dir[0] * step, dir[1] * step);
    }
  });
}

// 全选画布上的卡片与图形。标注图钉不在其中：它们挂在宿主上、跟着宿主走，
// 不是可以自由摆放的对象
function selectAllObjects() {
  setSelection(
    state.frames.map(f => ({ kind: "frame", id: f.id }))
      .concat(state.shapes.filter(s => s && s.id).map(s => ({ kind: "shape", id: s.id })))
  );
}

// =============================================================
//  剪贴板：复制 / 粘贴卡片与图形
// =============================================================
// 载荷同时是写进系统剪贴板的 JSON。签名字段是必需的：用户从别处复制一段普通文字
// 再按 Cmd/Ctrl+V 也会走到粘贴分支，没有签名就没法把它和画布内容区分开
const CLIP_SIGNATURE = "clip/1";
// 鼠标停在原处连着粘几次时，每份副本再让开这么多，免得严丝合缝叠成一份看不出来
const PASTE_CASCADE = 24;
let lastPasteAt = null;
let pasteCascade = 0;

// 克隆一组卡片实例与图形：换新 id、整组平移，箭头端点按宿主在不在这组里
// 决定改挂副本还是降级成绝对坐标。
// 纯函数——DOM 与全局 state 的能力全从 ctx 注入，才抠得出来单测。
// ctx = { taken, dx, dy, newShapeId(kind), newInstanceId(), resolveEnd(end) }
function cloneCanvasObjects(payload, ctx) {
  const taken = ctx.taken || new Set();
  const fresh = (make) => {
    let id = make();
    while (taken.has(id)) id = make();   // 随机后缀只有 4 位，粘得多了会撞
    taken.add(id);
    return id;
  };
  const frameMap = new Map();
  const shapeMap = new Map();
  for (const f of (payload.frames || [])) {
    if (f && f.id) frameMap.set(f.id, fresh(() => ctx.newInstanceId()));
  }
  for (const s of (payload.shapes || [])) {
    if (s && s.id) shapeMap.set(s.id, fresh(() => ctx.newShapeId(s.kind)));
  }

  // 端点三种归宿：宿主也在这组里就改挂副本；宿主留在组外则就地求出画布坐标再平移，
  // 成为自由端——保留锚定的话副本会牵回原件；本来就是自由端的直接平移
  const moveEnd = (end) => {
    if (!end || typeof end !== "object") return end;
    if (end.instanceId && frameMap.has(end.instanceId)) {
      return { instanceId: frameMap.get(end.instanceId), anchor: end.anchor };
    }
    if (end.shapeId && shapeMap.has(end.shapeId)) {
      return { shapeId: shapeMap.get(end.shapeId), anchor: end.anchor };
    }
    const at = (end.instanceId || end.shapeId) ? ctx.resolveEnd(end) : end;
    return { x: (at.x || 0) + ctx.dx, y: (at.y || 0) + ctx.dy };
  };

  // 整体深拷贝而不是枚举字段：note 的 color、flow 的 variant、image 的 src、
  // arrow 的 route / mid / label 都自动跟着走，日后加字段不用回来改这里
  const dup = (o) => JSON.parse(JSON.stringify(o));
  const frames = [];
  for (const f of (payload.frames || [])) {
    if (!f || !f.id) continue;
    const n = dup(f);
    n.id = frameMap.get(f.id);
    n.x = (f.x || 0) + ctx.dx;
    n.y = (f.y || 0) + ctx.dy;
    frames.push(n);
  }
  const shapes = [];
  for (const s of (payload.shapes || [])) {
    if (!s || !s.id) continue;
    const n = dup(s);
    n.id = shapeMap.get(s.id);
    if (s.kind === "arrow") {
      n.from = moveEnd(s.from);
      n.to = moveEnd(s.to);
    } else {
      n.x = (s.x || 0) + ctx.dx;
      n.y = (s.y || 0) + ctx.dy;
    }
    shapes.push(n);
  }
  return { frames: frames, shapes: shapes };
}

// 只认带签名的 JSON。剪贴板里的任何文字都会流经这里，认不出来就当没有
function readClipPayload(text) {
  if (!text || text.charAt(0) !== "{") return null;
  let obj = null;
  try { obj = JSON.parse(text); } catch (e) { return null; }
  if (!obj || obj.__protoCanvas !== CLIP_SIGNATURE) return null;
  return obj;
}

function copySelection() {
  if (!state.selection.length) return;
  const frames = [];
  const shapes = [];
  for (const m of state.selection) {
    if (m.kind === "frame") {
      const inst = state.frames.find(f => f.id === m.id);
      if (inst) frames.push(inst);
      continue;
    }
    const sh = findShape(m.id);
    if (sh) shapes.push(sh);
  }
  if (!frames.length && !shapes.length) return;
  // 卡片上的标注不进剪贴板：标注是带全局编号的评审意见，副本再带一份重复意见
  // 没有意义，与移除卡片时把标注迁去孤儿区、而不是跟着卡片走是同一条逻辑
  const box = selectionBounds(state.selection);
  // 存的是快照而非原对象引用：复制完继续改原件，剪贴板里那份不能跟着变
  const payload = JSON.parse(JSON.stringify({
    __protoCanvas: CLIP_SIGNATURE,
    frames: frames,
    shapes: shapes,
    // 对的是整组的中心：粘到哪儿，这一组的中心就落在哪儿
    origin: box ? { x: box.x + box.w / 2, y: box.y + box.h / 2 } : { x: 0, y: 0 }
  }));
  state.clipboard = payload;
  lastPasteAt = null;                    // 换了内容，连续粘贴的让位重新从零算
  writeSystemClipboard(payload);
  showTimedHint("已复制 " + (frames.length + shapes.length) + " 个对象", 1600);
}

// 写系统剪贴板是尽力而为：file:// 与非 secure context 下 navigator.clipboard 不存在，
// 存在时也可能因失焦或权限被拒。内存那份必成、就是它的兜底，所以失败一律静默
function writeSystemClipboard(payload) {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") return;
  try {
    navigator.clipboard.writeText(JSON.stringify(payload)).catch(() => {});
  } catch (e) {}
}

function pasteCanvasObjects(payload) {
  if (state.locked || !payload) return;
  const srcFrames = Array.isArray(payload.frames) ? payload.frames : [];
  const srcShapes = Array.isArray(payload.shapes) ? payload.shapes : [];
  if (!srcFrames.length && !srcShapes.length) return;

  // 跨站点粘来的卡片可能指向本站点没有的页面 / 状态，那样的实例渲染不出来。
  // 与其在画布上留一个看不见的空位，不如当场丢掉并说清楚跳过了几个
  const dead = deadInstanceIds(srcFrames, state.pages);
  const frames = srcFrames.filter(f => f && !dead.has(f.id));

  const at = imageDropPoint();
  if (lastPasteAt && Math.abs(lastPasteAt.x - at.x) < 1 && Math.abs(lastPasteAt.y - at.y) < 1) {
    pasteCascade += 1;
  } else {
    pasteCascade = 0;
  }
  lastPasteAt = { x: at.x, y: at.y };
  const origin = payload.origin || { x: 0, y: 0 };
  const shift = pasteCascade * PASTE_CASCADE;

  // 宿主是这次没落地的卡片时，DOM 里查不到，resolveArrowEnd 会把端点塌到画布原点；
  // 退回载荷里记的宿主坐标，让端点落在它原来的位置附近
  const srcById = new Map();
  for (const o of srcFrames.concat(srcShapes)) {
    if (o && o.id) srcById.set(o.id, o);
  }
  const resolveEnd = (end) => {
    const live = resolveArrowEnd(end);
    if (live.x || live.y) return live;
    const host = srcById.get(end.instanceId || end.shapeId);
    return host ? { x: host.x || 0, y: host.y || 0 } : live;
  };

  const out = cloneCanvasObjects({ frames: frames, shapes: srcShapes }, {
    taken: new Set(state.frames.map(f => f.id).concat(state.shapes.map(s => s.id))),
    dx: at.x - (origin.x || 0) + shift,
    dy: at.y - (origin.y || 0) + shift,
    newShapeId: genShapeId,
    newInstanceId: genInstanceId,
    resolveEnd: resolveEnd
  });
  if (!out.frames.length && !out.shapes.length) return;

  state.frames.push(...out.frames);
  state.shapes.push(...out.shapes);
  // 粘完选中的是副本：可以直接拖走，也可以接着按 Cmd/Ctrl+V 再来一份
  setSelection(
    out.frames.map(f => ({ kind: "frame", id: f.id }))
      .concat(out.shapes.map(s => ({ kind: "shape", id: s.id })))
  );
  writeLayout();                         // 微任务快照让整次粘贴合成一步撤销
  if (out.frames.length) {
    renderCanvas();
    renderViewPanel();
    refreshLayoutBadge();
  } else {
    renderShapes();
    syncSizer();
  }
  const skipped = srcFrames.length - frames.length;
  if (skipped > 0) {
    showTimedHint(skipped + " 个卡片在本站点找不到对应页面 / 状态，已跳过");
  }
}

// =============================================================
//  方向键微移
// =============================================================
const NUDGE_STEP = 1;
const NUDGE_STEP_BIG = 10;
const NUDGE_DIRS = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
};
// 连按方向键是一串各自独立的事件，每下都写盘会在撤销栈里攒出一串「挪了 1px」，
// 想退回原位得按同样多次 Cmd+Z。写盘延到停手之后，一串微移合并成一步。
const NUDGE_SAVE_DELAY = 400;
let nudgeTimer = null;

function nudgeSelection(dx, dy) {
  const group = beginGroupDrag();     // 每下都以当前坐标为基准快照，位移直接叠加
  group.apply(dx, dy);
  group.clampToFloor();
  if (nudgeTimer) clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(commitNudge, NUDGE_SAVE_DELAY);
}

function commitNudge() {
  nudgeTimer = null;
  writeLayout();
  syncSizer();
  syncSelectionBox();
}

// 撤销 / 重做 / 锁定前必须先把待写的微移落下去，否则那一步还没进历史栈，
// 撤销会直接跳过它。settleEditing 是所有「收口进行中的操作」的统一入口。
function flushNudge() {
  if (!nudgeTimer) return;
  clearTimeout(nudgeTimer);
  commitNudge();
}

// =============================================================
//  箭头：端点是联合类型，一端绑卡片一端自由完全合法
//    绑定端 { instanceId, anchor }  anchor 取 top / right / bottom / left
//    自由端 { x, y }
// =============================================================
const ARROW_SNAP_PAD = 24;

function frameBox(inst) {
  // 优先读实际渲染高度：iframe 内容可能通过 canvas-frame-ready 撑高过视口档位的基准高
  const el = document.querySelector(`.frame-block[data-instance-id="${cssEscape(inst.id)}"]`);
  const vp = instViewport(inst);
  return {
    x: inst.x || 0,
    y: inst.y || 0,
    w: vp.width,
    h: el ? el.offsetHeight : vp.height + CAPTION_H
  };
}

// 可以当箭头宿主的图形。text 随内容撑开、没有稳定包围盒；箭头自己更不能当宿主。
const ARROW_SNAP_KINDS = ["rect", "note", "flow", "image"];

// 端点宿主的包围盒。宿主已被删或类型不合法时返回 null，由调用方退回自由坐标。
function targetBox(end) {
  if (end && end.instanceId) {
    const inst = state.frames.find(f => f.id === end.instanceId);
    return inst ? frameBox(inst) : null;
  }
  if (end && end.shapeId) {
    const sh = findShape(end.shapeId);
    return (sh && ARROW_SNAP_KINDS.includes(sh.kind)) ? shapeBox(sh) : null;
  }
  return null;
}

function anchorPoint(box, anchor) {
  if (anchor === "top")    return { x: box.x + box.w / 2, y: box.y };
  if (anchor === "bottom") return { x: box.x + box.w / 2, y: box.y + box.h };
  if (anchor === "left")   return { x: box.x,             y: box.y + box.h / 2 };
  return { x: box.x + box.w, y: box.y + box.h / 2 };     // right
}

function resolveArrowEnd(end) {
  const box = targetBox(end);
  if (box) return anchorPoint(box, end.anchor);
  return { x: (end && end.x) || 0, y: (end && end.y) || 0 };
}

// 主线与两条箭羽写在同一条 path 里：省掉一套 marker 定义，
// 描边颜色自动跟着 .arrow-line 走，不必为选中态再定义一个 marker。
function arrowPath(points, headLen) {
  const p2 = points[points.length - 1];
  // 箭羽角度取最后一段：折线下用首尾连线的角度会让箭头指向和实际入射方向不一致
  const prev = points[points.length - 2] || p2;
  const ang = Math.atan2(p2.y - prev.y, p2.x - prev.x);
  const L = headLen || 12, spread = 0.45;
  const a1x = p2.x - L * Math.cos(ang - spread), a1y = p2.y - L * Math.sin(ang - spread);
  const a2x = p2.x - L * Math.cos(ang + spread), a2y = p2.y - L * Math.sin(ang + spread);
  const main = points.map((p, i) => (i ? "L" : "M") + p.x + " " + p.y).join(" ");
  return `${main} M${a1x} ${a1y} L${p2.x} ${p2.y} L${a2x} ${a2y}`;
}

const ARROW_MID_MIN = 0.05;
const ARROW_MID_MAX = 0.95;

function clampMid(v) {
  const n = (typeof v === "number" && isFinite(v)) ? v : 0.5;
  return Math.min(ARROW_MID_MAX, Math.max(ARROW_MID_MIN, n));
}

// 端点的出线主轴。吸附端由 anchor 决定（左右出线是横向，上下出线是纵向）；
// 自由端没有宿主可问，按两端位移的主方向推断。
function endAxis(end, self, other) {
  if (end && end.anchor) return (end.anchor === "top" || end.anchor === "bottom") ? "v" : "h";
  return Math.abs(other.x - self.x) >= Math.abs(other.y - self.y) ? "h" : "v";
}

// 连线的两种路由。面板的两个格子、dock 按钮的迷你预览、落笔取的默认值都从这里来
const ARROW_ROUTE_ORDER = ["straight", "elbow"];
const ARROW_ROUTE_LABEL = { straight: "直线", elbow: "折线" };

// 面板与 dock 按钮里的迷你预览。点序列交给与画布同一条 arrowPath 画，箭羽按尺寸缩小，
// 不会出现「面板里画的和落下去的不是一种线」
function arrowMiniSvg(route, w, h) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "flow-mini");
  svg.setAttribute("width", w + 2);
  svg.setAttribute("height", h + 2);
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("class", "flow-path");
  const pts = route === "elbow"
    ? [{ x: 2, y: 3 }, { x: w / 2, y: 3 }, { x: w / 2, y: h - 3 }, { x: w - 2, y: h - 3 }]
    : [{ x: 2, y: h / 2 }, { x: w - 2, y: h / 2 }];
  p.setAttribute("d", arrowPath(pts, Math.max(4, Math.round(w * 0.16))));
  // 留 1px 边距再 translate：描边贴着 0/0 画会被视口裁掉半个像素
  p.setAttribute("transform", "translate(1, 1)");
  svg.appendChild(p);
  return svg;
}

// 路由唯一出口：渲染与几何刷新都从这里拿点序列，两条路径不会画出不同的线。
// 直线是两点退化情形；折线按两端主轴组合出 Z 型（同轴，带可拖中段）或 L 型（异轴）。
function arrowPoints(sh) {
  const p1 = resolveArrowEnd(sh.from);
  const p2 = resolveArrowEnd(sh.to);
  // 缺 route 字段的老数据与任何非法值都走直线，既有画布外观一字不变
  if (sh.route !== "elbow") return [p1, p2];

  const mid = clampMid(sh.mid);
  const a1 = endAxis(sh.from, p1, p2);
  const a2 = endAxis(sh.to, p2, p1);

  if (a1 === "h" && a2 === "h") {
    const xm = p1.x + (p2.x - p1.x) * mid;
    return [p1, { x: xm, y: p1.y }, { x: xm, y: p2.y }, p2];
  }
  if (a1 === "v" && a2 === "v") {
    const ym = p1.y + (p2.y - p1.y) * mid;
    return [p1, { x: p1.x, y: ym }, { x: p2.x, y: ym }, p2];
  }
  // 一横一竖：L 型，先沿起点的主轴走出去再折
  return a1 === "h"
    ? [p1, { x: p2.x, y: p1.y }, p2]
    : [p1, { x: p1.x, y: p2.y }, p2];
}

// 折点手柄：只有 Z 型（四点）才有可拖的中段。抽出来给渲染与几何刷新两条路径共用——
// 刷新路径要在 L 型变回 Z 型时把它补回来，只在渲染时创建会让手柄一旦摘掉就永久消失。
function makeMidHandle(sh, pts, g) {
  const m = { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 };
  const h = document.createElementNS(SVG_NS, "circle");
  h.setAttribute("class", "arrow-handle");
  h.setAttribute("r", "5");
  h.setAttribute("cx", m.x);
  h.setAttribute("cy", m.y);
  h.dataset.role = "mid";
  bindArrowMidDrag(h, sh);
  g.appendChild(h);
  return h;
}

function renderArrow(sh, layer) {
  const pts = arrowPoints(sh);
  const p1 = pts[0], p2 = pts[pts.length - 1];
  const d = arrowPath(pts);

  const g = document.createElementNS(SVG_NS, "g");
  g.dataset.shapeId = sh.id;
  const selCls = selectionClass("shape", sh.id);
  if (selCls) g.classList.add(selCls);

  const hit = document.createElementNS(SVG_NS, "path");
  hit.setAttribute("class", "arrow-hit");
  hit.setAttribute("d", d);
  hit.addEventListener("pointerdown", (e) => {
    if (state.tool !== "select" || state.mode !== "browse") return;
    e.stopPropagation();
    // 走与卡片 / 图形同一条选中分支：Shift 点线也能把它加进组、再点一次摘出去
    prepareSelectionForDrag("shape", sh.id, e.shiftKey);
  });
  // 双击线 = 在中段写标签，和双击图形写文字是同一个手势
  hit.addEventListener("dblclick", (e) => {
    if (state.tool !== "select" || state.mode !== "browse") return;
    e.stopPropagation();
    selectShape(sh.id);
    beginArrowLabelEdit(sh.id);
  });
  g.appendChild(hit);

  const line = document.createElementNS(SVG_NS, "path");
  line.setAttribute("class", "arrow-line");
  line.setAttribute("d", d);
  g.appendChild(line);

  for (const [key, p] of [["from", p1], ["to", p2]]) {
    const h = document.createElementNS(SVG_NS, "circle");
    h.setAttribute("class", "arrow-handle");
    h.setAttribute("r", "5");
    h.setAttribute("cx", p.x);
    h.setAttribute("cy", p.y);
    h.dataset.end = key;
    bindArrowEndDrag(h, sh, key);
    g.appendChild(h);
  }

  // 只有 Z 型（四点）才有可拖的中段；L 型没有中段，给手柄会让人以为拖得动
  if (pts.length === 4) {
    makeMidHandle(sh, pts, g);
  }

  layer.appendChild(g);
}

// 只重算已渲染箭头的几何，不重建 DOM——拖卡片时每帧都要跑
function refreshArrowGeometry() {
  const layer = document.getElementById("arrowLayer");
  if (!layer) return;
  for (const sh of state.shapes) {
    if (sh.kind !== "arrow") continue;
    const g = layer.querySelector(`[data-shape-id="${cssEscape(sh.id)}"]`);
    if (!g) continue;
    const pts = arrowPoints(sh);
    const p1 = pts[0], p2 = pts[pts.length - 1];
    const d = arrowPath(pts);
    g.querySelectorAll("path").forEach(p => p.setAttribute("d", d));
    // 按 data 属性精确定位：折点手柄加进来后，按下标取会串位
    const hFrom = g.querySelector('.arrow-handle[data-end="from"]');
    const hTo = g.querySelector('.arrow-handle[data-end="to"]');
    const hMid = g.querySelector('.arrow-handle[data-role="mid"]');
    if (hFrom) { hFrom.setAttribute("cx", p1.x); hFrom.setAttribute("cy", p1.y); }
    if (hTo) { hTo.setAttribute("cx", p2.x); hTo.setAttribute("cy", p2.y); }
    // Z 型退化成 L 型（4 点变 3 点）时直接摘掉手柄：只挪位置会留一个脱离路径、
    // 还能被拖动的悬空圆点，remove() 顺带清掉绑在它上面的拖拽监听
    if (pts.length === 4) {
      if (hMid) {
        hMid.setAttribute("cx", (pts[1].x + pts[2].x) / 2);
        hMid.setAttribute("cy", (pts[1].y + pts[2].y) / 2);
      } else {
        // L 型变回 Z 型：这条路径每帧只刷新几何、不重建 DOM，不在这里补建的话手柄永久消失
        makeMidHandle(sh, pts, g);
      }
    } else if (hMid) {
      hMid.remove();
    }
    syncArrowLabelPos(sh);       // 标签压在中段上，线一动它就得跟着走
  }
  syncShapeToolbar();
}

// 落点在某个宿主包围盒外扩 ARROW_SNAP_PAD 之内就吸到最近的边中点，否则记自由坐标。
// 多个宿主重叠时取遍历到的第一个，不做更复杂的仲裁。
// selfId 是正在拖的箭头自己：自吸会让端点解析成环，线原地打转。
function snapToTarget(pt, selfId) {
  const cands = [];
  // 先图形后卡片：命中顺序跟着视觉层序走（shape z-index 10 压在 frame z-index 1 之上）
  for (const sh of state.shapes) {
    if (sh.id === selfId) continue;
    if (!ARROW_SNAP_KINDS.includes(sh.kind)) continue;
    cands.push({ ref: { shapeId: sh.id }, box: shapeBox(sh) });
  }
  for (const inst of state.frames) {
    cands.push({ ref: { instanceId: inst.id }, box: frameBox(inst) });
  }
  for (const c of cands) {
    const b = c.box;
    if (pt.x < b.x - ARROW_SNAP_PAD || pt.x > b.x + b.w + ARROW_SNAP_PAD) continue;
    if (pt.y < b.y - ARROW_SNAP_PAD || pt.y > b.y + b.h + ARROW_SNAP_PAD) continue;
    let best = "right", bd = Infinity;
    for (const a of ["top", "right", "bottom", "left"]) {
      const p = anchorPoint(b, a);
      const d = (p.x - pt.x) * (p.x - pt.x) + (p.y - pt.y) * (p.y - pt.y);
      if (d < bd) { bd = d; best = a; }
    }
    return Object.assign({ anchor: best }, c.ref);
  }
  return null;
}

// 引用了某宿主的端点降级为绝对坐标，箭头本身保留。
// 必须在宿主还在 state 里时调用——出了这个窗口 resolveArrowEnd 只能返回 (0, 0)。
// key 取 "instanceId"（删 frame 实例）或 "shapeId"（删图形）。
function detachArrowsFromHost(key, id) {
  for (const sh of state.shapes) {
    if (sh.kind !== "arrow") continue;
    for (const k of ["from", "to"]) {
      const end = sh[k];
      if (!end || end[key] !== id) continue;
      const p = resolveArrowEnd(end);
      sh[k] = { x: p.x, y: p.y };
    }
  }
}

function bindArrowEndDrag(handle, sh, key) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (state.locked || state.mode !== "browse" || state.tool !== "select") return;
    e.preventDefault();
    e.stopPropagation();
    selectShape(sh.id);
    document.body.style.userSelect = "none";

    const onMove = (ev) => {
      const p = toCanvasPoint(ev.clientX, ev.clientY);
      sh[key] = snapToTarget(p, sh.id) || { x: p.x, y: p.y };
      refreshArrowGeometry();
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
      writeLayout();
      syncSizer();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}

// 拖中段调折点。mid 存归一化比例而不是绝对坐标：两端移动后折点保持相对位置，
// 卡片一挪线不会拧成奇怪的形状。
function bindArrowMidDrag(handle, sh) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (state.locked || state.mode !== "browse" || state.tool !== "select") return;
    e.preventDefault();
    e.stopPropagation();
    selectShape(sh.id);
    document.body.style.userSelect = "none";

    const onMove = (ev) => {
      const p = toCanvasPoint(ev.clientX, ev.clientY);
      const p1 = resolveArrowEnd(sh.from);
      const p2 = resolveArrowEnd(sh.to);
      // 能拖到这里说明是 Z 型，两端主轴相同，取哪一端算都一样
      const axis = endAxis(sh.from, p1, p2);
      const span = axis === "h" ? (p2.x - p1.x) : (p2.y - p1.y);
      if (!span) return;                        // 两端重合，比例无意义
      const cur = axis === "h" ? (p.x - p1.x) : (p.y - p1.y);
      sh.mid = clampMid(cur / span);
      refreshArrowGeometry();
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
      writeLayout();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}

// =============================================================
//  连线标签：判定分支的「是 / 否」压在线中段
//    数据是 arrow 上的可选字段 label，DOM 在 #arrowLabelLayer 里
//    渲染走 HTML 而不是 SVG <text>：换行、光标、粘贴降级全是原生的
// =============================================================
function arrowLabelEl(id) {
  const layer = document.getElementById("arrowLabelLayer");
  if (!layer) return null;
  return layer.querySelector(`.arrow-label[data-shape-id="${cssEscape(id)}"]`);
}

function ensureArrowLabelEl(sh) {
  const layer = document.getElementById("arrowLabelLayer");
  if (!layer) return null;
  let el = arrowLabelEl(sh.id);
  if (el) return el;
  el = document.createElement("div");
  el.className = "arrow-label";
  el.dataset.shapeId = sh.id;
  el.textContent = sh.label || "";
  // 与图形文本同一条规矩：粘贴一律降级纯文本，存的和显示的不能是两回事
  el.addEventListener("paste", (ev) => {
    ev.preventDefault();
    const t = (ev.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, t);
  });
  el.addEventListener("pointerdown", (ev) => {
    if (state.tool !== "select" || state.mode !== "browse") return;
    ev.stopPropagation();        // 不要冒泡到 stage 的「点空白取消选中」
    prepareSelectionForDrag("shape", sh.id, ev.shiftKey);
  });
  el.addEventListener("dblclick", (ev) => {
    if (state.tool !== "select" || state.mode !== "browse") return;
    ev.stopPropagation();
    beginArrowLabelEdit(sh.id);
  });
  el.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    // Shift+Enter 换行，单独的回车提交：标签是一句短词，默认多行反而挡住线
    if (ev.shiftKey) { document.execCommand("insertLineBreak"); return; }
    commitArrowLabelEdit();
  });
  layer.appendChild(el);
  return el;
}

function syncArrowLabelPos(sh, el) {
  const target = el || arrowLabelEl(sh.id);
  if (!target) return;
  const m = arrowMidPoint(sh);
  target.style.left = m.x + "px";
  target.style.top = m.y + "px";
}

// 有标签的箭头才建 DOM；正在编辑的那条即使还没内容也要留着，否则光标当场丢失
function renderArrowLabels() {
  const layer = document.getElementById("arrowLabelLayer");
  if (!layer) return;
  layer.textContent = "";
  for (const sh of state.shapes) {
    if (sh.kind !== "arrow") continue;
    if (!sh.label && state.editingArrowLabelId !== sh.id) continue;
    syncArrowLabelPos(sh, ensureArrowLabelEl(sh));
  }
}

function beginArrowLabelEdit(id) {
  if (state.locked) return;
  if (state.editingArrowLabelId === id) return;
  const sh = findShape(id);
  if (!sh || sh.kind !== "arrow") return;
  if (state.editingShapeId) commitShapeTextEdit();     // 两个编辑态互斥
  state.editingArrowLabelId = id;
  const el = ensureArrowLabelEl(sh);
  if (!el) { state.editingArrowLabelId = null; return; }
  syncArrowLabelPos(sh, el);
  el.setAttribute("contenteditable", "true");
  el.addEventListener("blur", () => commitArrowLabelEdit(), { once: true });
  // 延一帧再 focus：mousedown 阶段浏览器的默认焦点处理会把焦点抢回去
  requestAnimationFrame(() => {
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  });
}

function commitArrowLabelEdit() {
  const id = state.editingArrowLabelId;
  if (!id) return;
  state.editingArrowLabelId = null;
  const el = arrowLabelEl(id);
  const sh = findShape(id);
  if (!el) return;
  el.removeAttribute("contenteditable");
  el.blur();
  const txt = readEditableText(el);
  // 箭头已被删或标签被清空：DOM 一起摘掉，不留一个空胶囊挡着线
  if (!sh) { el.remove(); return; }
  if (!txt) {
    el.remove();
    if (!sh.label) return;      // 本来就没有标签，纯粹是打开又关掉，不必落盘
    delete sh.label;
    writeLayout();
    return;
  }
  el.textContent = txt;
  if (txt === sh.label) return;
  sh.label = txt;
  writeLayout();
}

// 箭头路径的中段中点，连线标签的落位取这里。
function arrowMidPoint(sh) {
  const pts = arrowPoints(sh);
  const a = pts[Math.max(0, Math.floor(pts.length / 2) - 1)];
  const b = pts[Math.floor(pts.length / 2)];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// 浮条的显隐与位置：选中箭头挂在路径中段，选中图形挂在包围盒上边中点。
function syncShapeToolbar() {
  const bar = document.getElementById("shapeToolbar");
  if (!bar) return;
  const sh = findShape(state.selectedShapeId);
  // 浮条只服务图形节点。箭头不给浮条：路由归 dock 上的箭头面板，标签走双击线
  if (!sh || state.locked || state.tool !== "select" || !NODE_KINDS.includes(sh.kind)) {
    bar.hidden = true;
    // 切换器是挂在浮条上的：浮条一收，它必须跟着收，否则会悬在空中，
    // 点里面的形状还会作用到一个已经取消选中的图形上
    closeShapePicker();
    return;
  }
  bar.hidden = false;

  const box = shapeBox(sh);
  bar.style.left = (box.x + box.w / 2) + "px";
  bar.style.top = box.y + "px";
  const btn = document.getElementById("stbShape");
  const old = btn && btn.querySelector(".flow-mini");
  if (old) {
    const v = sh.kind === "rect" ? "rect" : (SHAPE_DEFS[sh.variant] ? sh.variant : "process");
    btn.replaceChild(shapeMiniSvg(v, "geo", 16, 12), old);
  }
  positionShapePicker();
}

// 换形状：位置与尺寸原样留着，只改轮廓。已连的箭头绑的是 shapeId + anchor、
// 锚点由 shapeBox 现算，换完自动跟上，不必碰箭头数据。
function applyShapeVariant(id, v) {
  const sh = findShape(id);
  if (!sh || state.locked || !NODE_KINDS.includes(sh.kind)) return;
  if (v === "rect") {
    if (sh.kind === "rect") return;
    sh.kind = "rect";
    delete sh.variant;
  } else {
    if (!SHAPE_DEFS[v]) return;
    if (sh.kind === "flow" && sh.variant === v) return;
    sh.kind = "flow";
    sh.variant = v;
  }
  writeLayout();
  renderShapes();          // kind 变了要换整套子元素（边条 / 轮廓 SVG），只改属性不够
  refreshArrowGeometry();
  syncShapeToolbar();
}

function bindShapeToolbar() {
  const bar = document.getElementById("shapeToolbar");
  if (!bar) return;
  // 吞掉 pointerdown：浮条压在画布上，不拦会被当成「点空白取消选中」
  bar.addEventListener("pointerdown", (e) => e.stopPropagation());
  bar.addEventListener("click", (e) => {
    if (state.locked || state.mode !== "browse") return;
    const sh = findShape(state.selectedShapeId);
    if (!sh) return;

    const actBtn = e.target.closest("button[data-act]");
    if (!actBtn) return;
    if (actBtn.dataset.act === "shape") {
      const picker = document.getElementById("shapePicker");
      if (!picker) return;
      // 与 R / F 面板同一条惯例：再点一次收起
      if (!picker.hidden) { picker.hidden = true; return; }
      openShapePicker(sh);
    }
  });
}

// 切换器展示去重全集：几何组在前（方框打头），流程符号补上几何组没有的那些。
// 同一轮廓只出现一次，不为「菱形 / 判定」这类两种叫法排两个格子。
const SHAPE_ALL_ORDER = GEO_ORDER.concat(FLOW_ORDER.filter(v => !GEO_ORDER.includes(v)));

function shapeGroupOf(v) {
  return GEO_ORDER.includes(v) ? "geo" : "flow";
}

function buildShapePicker() {
  const grid = document.getElementById("shapePickerGrid");
  if (!grid) return;
  grid.textContent = "";
  for (const v of SHAPE_ALL_ORDER) {
    const group = shapeGroupOf(v);
    const label = shapeLabel(v, group);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.variant = v;
    btn.title = label;
    // 搜索既认显示名也认另一套叫法：搜「判定」要能找到几何组里叫菱形的那一个
    const alt = SHAPE_DEFS[v] ? [SHAPE_DEFS[v].label, SHAPE_DEFS[v].geoLabel || ""].join(" ") : "";
    btn.dataset.search = (label + " " + v + " " + alt).toLowerCase();
    btn.appendChild(shapeMiniSvg(v, group, 42, 24));
    const cap = document.createElement("span");
    cap.textContent = label;
    btn.appendChild(cap);
    grid.appendChild(btn);
  }
  const empty = document.createElement("div");
  empty.className = "shape-picker-empty";
  empty.textContent = "没有匹配的形状";
  empty.hidden = true;
  grid.appendChild(empty);
}

function filterShapePicker(q) {
  const grid = document.getElementById("shapePickerGrid");
  if (!grid) return;
  const key = (q || "").trim().toLowerCase();
  let shown = 0;
  grid.querySelectorAll("button[data-variant]").forEach(btn => {
    const hit = !key || btn.dataset.search.includes(key);
    btn.hidden = !hit;
    if (hit) shown++;
  });
  const empty = grid.querySelector(".shape-picker-empty");
  if (empty) empty.hidden = shown > 0;
}

// 切换器贴着浮条落位。浮条在 stage 里、跟着 zoom 缩，切换器是 fixed、不缩，
// 两者的坐标系不同，只能拿浮条的屏幕矩形现算。
const PICKER_GAP = 8;        // 与浮条之间的间距
const PICKER_MARGIN = 12;    // 与视口边缘的最小间距

function positionShapePicker() {
  const picker = document.getElementById("shapePicker");
  const bar = document.getElementById("shapeToolbar");
  if (!picker || picker.hidden || !bar || bar.hidden) return;
  const b = bar.getBoundingClientRect();
  const p = picker.getBoundingClientRect();

  // 首选浮条正上方；顶上塞不下就翻到浮条下方——那里会盖住图形，但至少是完整可见的，
  // 比半截露在视口外强
  let top = b.top - p.height - PICKER_GAP;
  if (top < PICKER_MARGIN) top = b.bottom + PICKER_GAP;
  top = Math.max(PICKER_MARGIN, Math.min(top, window.innerHeight - p.height - PICKER_MARGIN));

  let left = b.left + b.width / 2 - p.width / 2;
  left = Math.max(PICKER_MARGIN, Math.min(left, window.innerWidth - p.width - PICKER_MARGIN));

  picker.style.left = left + "px";
  picker.style.top = top + "px";
}

function closeShapePicker() {
  const picker = document.getElementById("shapePicker");
  if (picker) picker.hidden = true;
}

function openShapePicker(sh) {
  const picker = document.getElementById("shapePicker");
  if (!picker) return;
  closeShapePanels(null);          // 与 R / F 面板互斥，同时开会两块面板叠在一起
  const cur = sh.kind === "rect" ? "rect" : sh.variant;
  picker.querySelectorAll("button[data-variant]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.variant === cur);
  });
  const search = document.getElementById("shapePickerSearch");
  if (search) search.value = "";
  filterShapePicker("");
  picker.hidden = false;
  positionShapePicker();           // 要在 hidden 撤掉之后：藏着的时候量不到面板尺寸
  if (search) search.focus();
}

function bindShapePicker() {
  const picker = document.getElementById("shapePicker");
  if (!picker) return;
  picker.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-variant]");
    if (!btn) return;
    picker.hidden = true;
    applyShapeVariant(state.selectedShapeId, btn.dataset.variant);
  });
  const search = document.getElementById("shapePickerSearch");
  if (search) {
    search.addEventListener("input", () => {
      filterShapePicker(search.value);
      positionShapePicker();     // 过滤掉几行后面板变矮，贴浮条的那条边要跟着重贴
    });
    // 搜索框里的 ESC 只收面板，不冒泡给全局 ESC（它会一路退到取消选中）
    search.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      picker.hidden = true;
    });
  }
  document.addEventListener("pointerdown", (e) => {
    if (picker.hidden) return;
    if (e.target.closest("#shapePicker") || e.target.closest("#stbShape")) return;
    picker.hidden = true;
  });
}

// =============================================================
//  图片：粘贴 / 拖入 → 服务端落盘 → 画布上的 image 图形
// =============================================================
// 图片二进制走独立端点落到 assets/canvas-images/，layout 里只留一个相对路径。
// 绝不把 base64 塞进 shape：那会让每一次编排改动都把全部图片重新序列化 PUT 一遍，
// layout.json 也会涨到几 MB，git diff 与团队共享都跟着废掉。
const IMAGE_ENDPOINT = "/api/canvas/image";
const IMAGE_MAX_EDGE = 1600;                  // 落盘前的长边上限，评审阅读够用
const IMAGE_ENCODE_TYPE = "image/webp";
const IMAGE_ENCODE_QUALITY = 0.85;
const IMAGE_KEEP_ORIGINAL_BYTES = 400 * 1024; // 小图留原始编码，见 normalizeImageBlob
const IMAGE_PLACE_MAX_W = 640;                // 落到画布上的初始宽度上限
const IMAGE_ACCEPT_TYPES = ["image/webp", "image/png", "image/jpeg", "image/gif"];

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("这个文件不是能识别的图片")); };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// 落盘前的瘦身。尺寸与体积都在预算内的图直接留原始字节——PNG 截图里的文字过一次
// 有损重编码就会发虚，能不动就不动；超预算的才等比缩到长边上限并转 webp。
async function normalizeImageBlob(file) {
  const img = await loadImageFromBlob(file);
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh) throw new Error("读不出图片尺寸");

  const long = Math.max(nw, nh);
  if (long <= IMAGE_MAX_EDGE && file.size <= IMAGE_KEEP_ORIGINAL_BYTES
      && IMAGE_ACCEPT_TYPES.includes(file.type)) {
    return { blob: file, w: nw, h: nh };
  }

  const scale = Math.min(1, IMAGE_MAX_EDGE / long);
  const w = Math.max(1, Math.round(nw * scale));
  const h = Math.max(1, Math.round(nh * scale));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  cv.getContext("2d").drawImage(img, 0, 0, w, h);
  // 不支持 webp 编码的浏览器上 toBlob 会自行退回 image/png，白名单里两种都收，
  // 上传时的 Content-Type 以 blob.type 实际值为准，不写死
  const blob = await canvasToBlob(cv, IMAGE_ENCODE_TYPE, IMAGE_ENCODE_QUALITY);
  if (!blob) throw new Error("图片编码失败");
  return { blob, w, h };
}

async function uploadImageBlob(blob) {
  const r = await fetch(IMAGE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob
  });
  if (!r.ok) {
    let msg = "";
    try { msg = (await r.json()).error || ""; } catch (e) {}
    throw new Error(msg || ("服务端拒收（HTTP " + r.status + "）"));
  }
  const data = await r.json();
  if (!data || !data.path) throw new Error("服务端没有返回图片路径");
  return data.path;
}

// 贴图落点：跟着鼠标走最符合直觉，但键盘粘贴时鼠标可能压根不在画布上，
// 那就落到当前视口中心——总之要落在用户看得见的地方。
const lastPointer = { cx: null, cy: null };

function imageDropPoint() {
  const scroll = document.getElementById("canvasScroll");
  const rect = scroll.getBoundingClientRect();
  const inside = lastPointer.cx !== null
    && lastPointer.cx >= rect.left && lastPointer.cx <= rect.right
    && lastPointer.cy >= rect.top && lastPointer.cy <= rect.bottom;
  return inside
    ? toCanvasPoint(lastPointer.cx, lastPointer.cy)
    : toCanvasPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

// 贴图能力的前置判定。静态模式下图片二进制没有落点，所以这里直接拦住并说清楚怎么办，
// 而不是给一个刷新就没的内存降级。
function imageUploadBlocker() {
  if (!state.serverMode) {
    return "贴图需要本地写服务：用画布生成后站点目录里的 canvas_server.py 起服务（lan-launcher --canvas-api）";
  }
  if (!state.imageUpload) {
    return "当前站点里的 canvas_server.py 版本不支持贴图：重跑一次画布生成即可覆盖";
  }
  return null;
}

async function placeImageFile(file, at) {
  if (state.locked || state.mode !== "browse") return;
  const blocked = imageUploadBlocker();
  if (blocked) { showTimedHint(blocked, 5000); return; }

  showHint("正在处理图片…");
  try {
    const norm = await normalizeImageBlob(file);
    const path = await uploadImageBlob(norm.blob);
    // 初始尺寸只缩不放：小图保持原尺寸，大图收到 IMAGE_PLACE_MAX_W 以内，
    // 免得一张长截图落下来就盖住半个画布
    const scale = Math.min(1, IMAGE_PLACE_MAX_W / norm.w);
    const w = Math.max(SHAPE_MIN_W, Math.round(norm.w * scale));
    const h = Math.max(SHAPE_MIN_H, Math.round(norm.h * scale));
    const sh = {
      id: genShapeId("image"), kind: "image",
      x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2),
      w, h, src: path
    };
    state.shapes.push(sh);
    selectShape(sh.id);
    writeLayout();
    renderShapes();
    syncSizer();
    hideHint();
  } catch (e) {
    showTimedHint("贴图失败：" + ((e && e.message) || "未知错误"), 5000);
  }
}

function pickImageFile(dt) {
  if (!dt) return null;
  const files = dt.files ? Array.from(dt.files) : [];
  return files.find(f => f.type && f.type.startsWith("image/")) || null;
}

function bindCanvasImageInput() {
  const scroll = document.getElementById("canvasScroll");

  document.addEventListener("pointermove", (e) => {
    lastPointer.cx = e.clientX;
    lastPointer.cy = e.clientY;
  });

  // 三级分流：图片文件落成图形；带签名的 JSON 是别的标签页复制走的画布对象；
  // 都不是就退回本页复制时留在内存里的那份
  document.addEventListener("paste", (e) => {
    if (isTyping()) return;              // 正在编辑文本，让浏览器走原生粘贴
    if (state.locked || state.mode !== "browse") return;
    const dt = e.clipboardData;
    let file = null;
    for (const it of (dt ? dt.items : [])) {
      if (it.kind === "file" && it.type && it.type.startsWith("image/")) {
        file = it.getAsFile();
        break;
      }
    }
    if (file) {
      e.preventDefault();
      placeImageFile(file, imageDropPoint());
      return;
    }
    const payload = readClipPayload(dt ? dt.getData("text/plain") : "") || state.clipboard;
    if (!payload) return;
    e.preventDefault();
    pasteCanvasObjects(payload);
  });

  // 拖入：dragover 必须 preventDefault，否则浏览器默认行为是把这张图当导航目标打开，
  // 整个画布连同未落盘的改动一起被替换掉
  scroll.addEventListener("dragover", (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  scroll.addEventListener("drop", (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
    // 认不认得都要拦下：不拦浏览器就把这个文件当导航目标打开，画布连同未落盘的改动一起没
    e.preventDefault();
    const img = pickImageFile(e.dataTransfer);
    if (img) { placeImageFile(img, toCanvasPoint(e.clientX, e.clientY)); return; }
    // 拖 canvas-state.json 进画布，与工具栏「导入」是同一条路
    const json = pickJsonFile(e.dataTransfer);
    if (!json) return;
    if (state.locked) { showTimedHint("锁定中，解锁后才能导入", 2600); return; }
    openImportModal();
    loadImportFile(json);
  });
}

// =============================================================
//  对齐参考线：拖 frame 卡片与拖图形共用一套
// =============================================================
const ALIGN_THRESHOLD = 6;      // 屏幕像素；比较前要除以 zoom 换到画布坐标
const GUIDE_OVERHANG = 8;       // 参考线两端超出参与对齐的盒子的长度
const X_EDGES = ["left", "centerX", "right"];
const Y_EDGES = ["top", "centerY", "bottom"];

const alignState = { candidates: [] };

// 图形包围盒。text 类不存 w/h（随内容撑开），只能读 DOM；
// DOM 尚未挂载时给一个保守估值，宁可不吸附也不要按错误尺寸吸偏。
function shapeBox(sh) {
  const el = document.querySelector(`.shape-block[data-shape-id="${cssEscape(sh.id)}"]`);
  return {
    x: sh.x || 0,
    y: sh.y || 0,
    w: sh.w || (el ? el.offsetWidth : 120),
    h: sh.h || (el ? el.offsetHeight : 32)
  };
}

function edgeValue(box, key) {
  if (key === "left") return box.x;
  if (key === "centerX") return box.x + box.w / 2;
  if (key === "right") return box.x + box.w;
  if (key === "top") return box.y;
  if (key === "centerY") return box.y + box.h / 2;
  return box.y + box.h;      // bottom
}

// 拖拽起手时快照一次候选盒。每帧重算会把 offsetWidth 的强制重排放进热路径，
// 卡片一多就掉帧；拖拽期间别的对象也不会移动，快照不会失真。
// exclude 收正在被拖的那些 id：单个 id 或一个 Set。自己人必须排掉，
// 否则整组一起动时参考线会打在组内成员之间，永远命中、永远吸住。
function beginAlign(exclude) {
  const skip = exclude instanceof Set ? exclude : new Set(exclude ? [exclude] : []);
  const boxes = [];
  for (const inst of state.frames) {
    if (skip.has(inst.id)) continue;
    boxes.push(frameBox(inst));
  }
  for (const sh of state.shapes) {
    if (skip.has(sh.id)) continue;
    if (sh.kind === "arrow") continue;      // 箭头没有矩形包围盒语义
    boxes.push(shapeBox(sh));
  }
  alignState.candidates = boxes;
}

// box 是拖拽起手时的原始盒，dx / dy 是本帧位移。
// 返回吸附修正后的位移，外加要画的参考线。x / y 两轴各自独立取最近的一条命中。
function applyAlign(box, dx, dy) {
  const tol = ALIGN_THRESHOLD / state.zoom;
  const probe = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
  let bestX = null, bestY = null;

  for (const c of alignState.candidates) {
    for (const sk of X_EDGES) {
      for (const ck of X_EDGES) {
        const d = edgeValue(c, ck) - edgeValue(probe, sk);
        if (Math.abs(d) > tol) continue;
        if (bestX && Math.abs(d) >= Math.abs(bestX.d)) continue;
        bestX = { d, pos: edgeValue(c, ck), other: c };
      }
    }
    for (const sk of Y_EDGES) {
      for (const ck of Y_EDGES) {
        const d = edgeValue(c, ck) - edgeValue(probe, sk);
        if (Math.abs(d) > tol) continue;
        if (bestY && Math.abs(d) >= Math.abs(bestY.d)) continue;
        bestY = { d, pos: edgeValue(c, ck), other: c };
      }
    }
  }

  const out = { dx, dy, guides: [] };
  if (bestX) out.dx = dx + bestX.d;
  if (bestY) out.dy = dy + bestY.d;
  const self = { x: box.x + out.dx, y: box.y + out.dy, w: box.w, h: box.h };
  // 线的跨度覆盖自身盒与对齐目标盒在另一轴上的范围，两端各外延一点，
  // 让人一眼看出是「这两个对象在对齐」，而不是一条贯穿全画布的无主长线
  if (bestX) {
    out.guides.push({
      axis: "x",
      pos: bestX.pos,
      from: Math.min(self.y, bestX.other.y) - GUIDE_OVERHANG,
      to: Math.max(self.y + self.h, bestX.other.y + bestX.other.h) + GUIDE_OVERHANG
    });
  }
  if (bestY) {
    out.guides.push({
      axis: "y",
      pos: bestY.pos,
      from: Math.min(self.x, bestY.other.x) - GUIDE_OVERHANG,
      to: Math.max(self.x + self.w, bestY.other.x + bestY.other.w) + GUIDE_OVERHANG
    });
  }
  return out;
}

function renderGuides(guides) {
  const layer = document.getElementById("guideLayer");
  if (!layer) return;
  layer.textContent = "";
  for (const g of guides) {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("class", "guide-line");
    if (g.axis === "x") {
      line.setAttribute("x1", g.pos); line.setAttribute("x2", g.pos);
      line.setAttribute("y1", g.from); line.setAttribute("y2", g.to);
    } else {
      line.setAttribute("y1", g.pos); line.setAttribute("y2", g.pos);
      line.setAttribute("x1", g.from); line.setAttribute("x2", g.to);
    }
    layer.appendChild(line);
  }
}

function endAlign() {
  alignState.candidates = [];
  const layer = document.getElementById("guideLayer");
  if (layer) layer.textContent = "";
}

// =============================================================
//  Zoom (Ctrl/Cmd + wheel, anchored at cursor)
// =============================================================
// 内容四周的留白(px),营造无限画布手感;单一真源是 CSS 变量 --canvas-pad(stage 静态定位也用它)
const CANVAS_PAD = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--canvas-pad"), 10) || 2000;
// 缩放下限放到 0.2:中台一帧就是 1280,并排比对时 0.3 不足以退到能看全一行的距离
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;

// 首屏缩放:让最宽的一帧完整落进可视区,开局至少能看全一整页。
// APP 原型(375)在任何屏上都 <= 可用宽度,结果恒为 1;中台原型(1280+)在小屏上自动缩到看得全,
// 不会开局只剩半张表格。按画布上实际摆了哪些实例算——没添加进来的页面不占视觉空间。
function computeInitialZoom() {
  const widest = state.frames.reduce((max, inst) => Math.max(max, instViewport(inst).width), 0);
  if (!widest) return 1;
  const scroll = document.getElementById("canvasScroll");
  const avail = scroll.clientWidth - 48;     // 两侧各留一点呼吸位
  if (avail <= 0) return 1;
  return Math.max(MIN_ZOOM, Math.min(1, avail / widest));
}

// 卡片标题条高度，与 layout.py 的 CAPTION_H 同值。
// 卡片本身的宽高不再是常量：按所属页面的视口档位取（instViewport），手机页与中台页可并排。
const CAPTION_H = 24;

// sizer 尺寸 = 缩放后内容包围盒 + 四周 CANVAS_PAD。
// 实例是绝对定位、脱离文档流，撑不开 stage，stage.offsetWidth/Height 反映不出内容尺寸，
// 包围盒只能靠遍历实例坐标自己算。
function syncSizer() {
  const sizer = document.getElementById("canvasSizer");
  const z = state.zoom;
  let maxX = 0, maxY = 0;
  for (const inst of state.frames) {
    // 优先读实际渲染高度：iframe 内容可能通过 canvas-frame-ready 自适应撑高过视口档位的
    // 基准高（见 bindIframeAutoresize）。DOM 还没挂载（如 addFrameInstance 后
    // renderCanvas 尚未跑完）时退回档位估算。
    const el = document.querySelector(`.frame-block[data-instance-id="${cssEscape(inst.id)}"]`);
    const vp = instViewport(inst);
    const h = el ? el.offsetHeight : vp.height + CAPTION_H;
    maxX = Math.max(maxX, (inst.x || 0) + vp.width);
    maxY = Math.max(maxY, (inst.y || 0) + h);
  }
  // 图形也要撑开可滚动区域，否则画在右下角的便签滚不到
  for (const sh of state.shapes) {
    if (sh.kind === "arrow") {
      for (const end of [sh.from, sh.to]) {
        const p = resolveArrowEnd(end);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      continue;
    }
    const el = document.querySelector(`.shape-block[data-shape-id="${cssEscape(sh.id)}"]`);
    const w = el ? el.offsetWidth : (sh.w || 160);
    const h = el ? el.offsetHeight : (sh.h || 80);
    maxX = Math.max(maxX, (sh.x || 0) + w);
    maxY = Math.max(maxY, (sh.y || 0) + h);
  }
  // 空画布也要有可视区域，否则 sizer 塌成 0 后滚动条与平移全失效。
  // 这里没有实例可问档位，按手机壳兜底即可——空画布不涉及中台宽屏的横向可视范围。
  maxX = Math.max(maxX, FALLBACK_VIEWPORT.width);
  maxY = Math.max(maxY, FALLBACK_VIEWPORT.height);
  sizer.style.width = (maxX * z + CANVAS_PAD * 2) + "px";
  sizer.style.height = (maxY * z + CANVAS_PAD * 2) + "px";
}

function applyZoom() {
  const stage = document.getElementById("canvasStage");
  stage.style.transform = `scale(${state.zoom})`;
  document.getElementById("zoomDisplay").textContent = Math.round(state.zoom * 100) + "%";
  syncSizer();
  positionShapePicker();    // 浮条在 stage 里、缩放后屏幕位置就变了，贴着它的切换器要跟上
}

// 围绕 (anchorX, anchorY)（相对 canvas-scroll 视口左上角的像素）调缩放，保持锚点屏幕位置不变
function zoomAround(factor, anchorX, anchorY) {
  const scroll = document.getElementById("canvasScroll");
  const oldZoom = state.zoom;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
  if (newZoom === oldZoom) return;
  const px = anchorX + scroll.scrollLeft;
  const py = anchorY + scroll.scrollTop;
  state.zoom = newZoom;
  applyZoom();
  const ratio = newZoom / oldZoom;
  // 锚点保持:内容点的 scroll 坐标 = CANVAS_PAD + 本地坐标*zoom,留白为常量偏移,只缩放留白内侧部分
  scroll.scrollLeft = CANVAS_PAD + (px - CANVAS_PAD) * ratio - anchorX;
  scroll.scrollTop = CANVAS_PAD + (py - CANVAS_PAD) * ratio - anchorY;
  // 必须补在改完 scroll 之后：applyZoom 里那次跑在滚动补偿之前，读到的浮条屏幕位置
  // 还是旧的。scroll 监听也补不上——赋值后的滚动值若未变（已在边界）根本不触发 scroll。
  positionShapePicker();
}

// 按钮点击：以可视画布中心为锚点缩放
function zoomByStep(factor) {
  const scroll = document.getElementById("canvasScroll");
  const rect = scroll.getBoundingClientRect();
  zoomAround(factor, rect.width / 2, rect.height / 2);
}

function zoomReset() {
  const scroll = document.getElementById("canvasScroll");
  const rect = scroll.getBoundingClientRect();
  zoomAround(1 / state.zoom, rect.width / 2, rect.height / 2);
}

function bindZoom() {
  const scroll = document.getElementById("canvasScroll");
  scroll.addEventListener("wheel", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const rect = scroll.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoomAround(factor, e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });
}

// 鼠标悬在 iframe 上时,iframe 内 bootstrap 把滚轮事件 postMessage 过来(iframe 是静态快照、自身不滚动),
// 这里按修饰键决定平移画布还是以光标为锚点缩放,补上 iframe 区域的滚动死区
function bindIframeWheelRelay() {
  const scroll = document.getElementById("canvasScroll");
  window.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.type !== "canvas-wheel") return;
    // deltaMode: 0=像素 1=行 2=页,统一换算成像素
    const unit = d.deltaMode === 1 ? 16 : (d.deltaMode === 2 ? scroll.clientHeight : 1);
    const dx = (d.deltaX || 0) * unit;
    const dy = (d.deltaY || 0) * unit;
    if (d.ctrlKey || d.metaKey) {
      // Ctrl/Cmd + 滚轮:以光标所在 iframe 内位置映射回画布视口为锚点缩放(与 bindZoom 的鼠标缩放一致)
      let iframe = null;
      for (const f of scroll.querySelectorAll(".frame iframe")) {
        if (f.contentWindow === e.source) { iframe = f; break; }
      }
      const factor = dy < 0 ? 1.1 : 0.9;
      if (iframe) {
        const ib = iframe.getBoundingClientRect();
        const sb = scroll.getBoundingClientRect();
        zoomAround(factor, ib.left - sb.left + d.clientX * state.zoom, ib.top - sb.top + d.clientY * state.zoom);
      } else {
        zoomByStep(factor);
      }
    } else {
      scroll.scrollLeft += dx;
      scroll.scrollTop += dy;
    }
  });
}

// =============================================================
//  Pin rendering + position
// =============================================================
function refreshPins() {
  const layer = document.getElementById("pinLayer");
  layer.innerHTML = "";
  for (const ann of state.annotations) {
    const pos = resolvePinPosition(ann);
    if (!pos) continue;
    const pin = document.createElement("div");
    pin.className = "pin";
    pin.style.left = pos.x + "px";
    pin.style.top = pos.y + "px";
    pin.dataset.annId = ann.id;
    pin.innerHTML = `<div class="pin-bubble">${ann.number}</div>`;
    if (!state.locked) pin.classList.add("draggable");
    bindPinDrag(pin, ann);
    pin.addEventListener("click", (e) => {
      e.stopPropagation();
      if (pin._justDragged) { pin._justDragged = false; return; } // 拖拽刚结束,吞掉随后的 click,不打开卡片
      if (state.mode !== "browse") return;
      openAnnotationViewCard(ann, pin);
    });
    layer.appendChild(pin);
  }
}

// 浏览态下拖动图钉改位置:超过阈值才算拖拽(与点击区分);setPointerCapture 让光标移到 iframe 上时事件仍回 pin,
// 绕开 iframe 吃掉拖拽事件的问题;落点复用 computeAnchor 重算锚点(同 frame 内移动 / 跨 frame 重锚 / 拖到画布空白皆可)。
function bindPinDrag(pin, ann) {
  pin.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || state.locked || state.mode !== "browse") return;
    const stage = document.getElementById("canvasStage");
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const cleanup = () => {
      pin.removeEventListener("pointermove", onMove);
      pin.removeEventListener("pointerup", onUp);
      pin.removeEventListener("pointercancel", onCancel);
      try { pin.releasePointerCapture(e.pointerId); } catch (_) {}
      document.body.style.userSelect = "";
      pin.classList.remove("dragging");
    };
    const onMove = (ev) => {
      // 主键已松开(纯 hover,或 pointerup 丢失后的残留 move):立即清理,不拖动。必须按住才拖。
      if (ev.buttons === 0) { cleanup(); return; }
      if (!dragging) {
        if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
        dragging = true;
        pin.classList.add("dragging");
        document.body.style.userSelect = "none"; // 拖拽期间禁选文字
        closeCurrentCard();
        try { pin.setPointerCapture(e.pointerId); } catch (_) {}
      }
      const sb = stage.getBoundingClientRect();
      pin.style.left = (ev.clientX - sb.left) / state.zoom + "px";
      pin.style.top = (ev.clientY - sb.top) / state.zoom + "px";
    };
    const onUp = (ev) => {
      const wasDragging = dragging;
      cleanup();
      if (!wasDragging) return; // 没拖 = 点击,交给 click 打开卡片
      const sb = stage.getBoundingClientRect();
      ann.anchor = computeAnchor((ev.clientX - sb.left) / state.zoom, (ev.clientY - sb.top) / state.zoom);
      ann.updatedAt = nowIso();
      writeAnnotations();
      pin._justDragged = true; // 吞掉随后的 click;若浏览器拖拽后不补发 click,下一 tick 清掉防误吞后续点击
      setTimeout(() => { pin._justDragged = false; }, 0);
    };
    const onCancel = () => { cleanup(); }; // 取消手势不落点
    pin.addEventListener("pointermove", onMove);
    pin.addEventListener("pointerup", onUp);
    pin.addEventListener("pointercancel", onCancel);
  });
}

function resolvePinPosition(ann) {
  const stage = document.getElementById("canvasStage");
  const stageBox = stage.getBoundingClientRect();
  if (ann.anchor.kind === "canvas") {
    return { x: ann.anchor.x, y: ann.anchor.y };
  }
  // 优先按实例寻址；无 instanceId 的老标注退回 pageId+frameKey 查第一个匹配实例
  let frame = null;
  if (ann.anchor.instanceId) {
    frame = stage.querySelector(`.frame[data-instance-id="${cssEscape(ann.anchor.instanceId)}"]`);
  } else {
    const sel = `.frame[data-page-id="${cssEscape(ann.anchor.pageId)}"][data-frame-kind="${cssEscape(ann.anchor.frameKind)}"][data-frame-key="${cssEscape(ann.anchor.frameKey)}"]`;
    frame = stage.querySelector(sel);
  }
  if (!frame) return null;
  const fb = frame.getBoundingClientRect();
  const left = (fb.left - stageBox.left) / state.zoom;
  const top = (fb.top - stageBox.top) / state.zoom;
  const w = fb.width / state.zoom;
  const h = fb.height / state.zoom;
  return { x: left + ann.anchor.x * w, y: top + ann.anchor.y * h };
}

function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/["\\]/g, "\\$&");
}

// =============================================================
//  Mark mode + click placement
// =============================================================
const COMMENT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 512 512"><path fill="%23CC7D5E" d="M256 32C114.6 32 0 125.1 0 240c0 47.6 19.9 91.2 53 126.2-13.5 35.6-37.5 65.2-37.8 65.5-2.2 2.6-2.8 6.4-1.6 9.6 1.2 3.2 4.2 5.5 7.6 5.7 66.3 4.4 116-22.3 140.8-39.9C201.3 421.5 227.5 432 256 432c141.4 0 256-93.1 256-208S397.4 32 256 32z"/></svg>';

// mark / remount 模式都是「点 stage 选位置」语义：
// stage 的 .mark-active 只作状态标记供后续扩展读取，click 透传打钉靠的是
// 指针权三态开关的默认值（.frame iframe { pointer-events: none }，mark 模式不触发 picking/alt-peek）；
// 真正让 iframe 内 cursor 变 crosshair + 暂时禁选文字的是下面这条 postMessage（默认态可选）
function broadcastMarkActive(active) {
  document.getElementById("canvasStage").classList.toggle("mark-active", active);
  document.querySelectorAll(".frame iframe").forEach(f => {
    try { f.contentWindow.postMessage({ type: 'mark:setActive', active: active }, '*'); } catch (e) {}
  });
}

function enterMarkMode() {
  if (state.locked) return;
  state.mode = "mark";
  document.getElementById("btnMark").classList.add("active");
  document.body.style.cursor = `url('data:image/svg+xml;utf8,${COMMENT_SVG}') 4 4, crosshair`;
  broadcastMarkActive(true);
  showHint('注释模式 · 点画布任意位置新建标注 <kbd>ESC</kbd> 退出');
}

function exitMarkMode() {
  state.mode = "browse";
  document.getElementById("btnMark").classList.remove("active");
  document.body.style.cursor = "";
  broadcastMarkActive(false);
  hideHint();
}

function enterRemountMode(annId) {
  state.mode = "remount";
  state.remountTargetId = annId;
  document.body.style.cursor = "crosshair";
  broadcastMarkActive(true);
  closeDrawer();
  showHint('重新挂载 · 点画布选择新位置 <kbd>ESC</kbd> 取消');
}

function exitRemountMode() {
  state.mode = "browse";
  state.remountTargetId = null;
  document.body.style.cursor = "";
  broadcastMarkActive(false);
  hideHint();
}

// =============================================================
//  Tool state machine（与 mode 正交：mode 管标注子系统，tool 管画布工具）
// =============================================================
const TOOL_SHORTCUTS = {
  "v": "select",
  "h": "pan",
  "r": "rect",
  "a": "arrow",
  "n": "note",
  "t": "text",
  "f": "flow"
};
// geo 不进快捷键表：它没有自己的键，是 R 在「几何面板选了非方框形状」时的落点。
// 与 flow 共用一条落笔管线，只是形状取 state.geoVariant、dock 高亮仍在 R 按钮上。
const TOOLS = Object.values(TOOL_SHORTCUTS).concat(["geo"]);

// 一个 dock 按钮可以对应两个工具值（R 按钮 = rect 或 geo），高亮与 disabled
// 防御都要认这两个，统一走这里查
function dockBtnFor(tool) {
  return document.querySelector(
    `.dock-btn[data-tool="${tool}"], .dock-btn[data-tool-alt="${tool}"]`
  );
}

function setTool(tool) {
  // R 落在哪个工具由几何面板上次选的形状决定：方框走 rect（内部让出指针的圈选框），
  // 其余几何形状走 geo。重定向放在入口，点按钮 / 按快捷键 / 面板选形状三条路径同一结果。
  if (tool === "rect" && state.geoVariant && state.geoVariant !== "rect") tool = "geo";
  if (!TOOLS.includes(tool)) return;
  // 锁定态下图形工具不生效。挡在这里而不是只靠按钮上的 data-lock-disable：那只是 CSS，
  // 拦不住 R / A / N / T 快捷键。select / pan 必须放行——ESC 回 select、画完自动回 select
  // 这两条路径若在锁定态被拦死，工具会永远停在图形态上。
  if (state.locked && tool !== "select" && tool !== "pan") return;
  // 防御：按钮若被标了 disabled，点击与快捷键都不生效
  const btn = dockBtnFor(tool);
  if (btn && btn.hasAttribute("disabled")) return;
  // 切工具先退出标注子系统的模式，保持互斥
  if (state.mode === "mark") exitMarkMode();
  if (state.mode === "remount") exitRemountMode();
  if (window.__pickerDeactivate) window.__pickerDeactivate();
  state.tool = tool;
  // 切到别的工具时收起形状面板：面板留着而 dock 高亮已经在别处，状态自相矛盾。
  // 排除面板自己那两个工具，否则点 dock 按钮时这里先关、bindShapePanel 的 toggle 再打开，
  // 第二次点击就永远关不掉了。
  closeShapePanels(tool);
  document.body.dataset.tool = tool;   // 供 #panOverlay 等按当前工具切显隐的 CSS 选择器读取
  document.querySelectorAll(".dock-btn[data-tool]").forEach(el => {
    el.classList.toggle("active", el.dataset.tool === tool || el.dataset.toolAlt === tool);
  });
  // 浮条只在 select 工具下出现，切工具后必须重算一次：画完图形的收尾是
  // 「先 renderShapes 再 setTool("select")」，不在这里补，新落的图形要等下一次
  // 选中才等到自己的浮条
  syncShapeToolbar();
}

function bindDockTools() {
  document.querySelectorAll(".dock-btn[data-tool]").forEach(btn => {
    btn.addEventListener("click", () => setTool(btn.dataset.tool));
  });
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping()) return;
    const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
    if (!tool) return;
    e.preventDefault();
    setTool(tool);
  });
}

// R（基础几何）/ F（流程符号）/ A（连线路由）是同一个面板的三份配置：展示哪一组选项、
// 选中结果记在 state 的哪个字段、落笔切到哪个工具，其余渲染与开合逻辑完全共用。
// 取名与迷你预览由 labelOf / mini 两个钩子给——形状查形状库，路由查路由表。
const SHAPE_PANELS = {
  geo: {
    panelId: "geoPanel", btnId: "toolRect", order: GEO_ORDER,
    stateKey: "geoVariant", tool: "rect", caption: "图形", hotkey: "R",
    labelOf: (v) => shapeLabel(v, "geo"),
    mini: (v, w, h) => shapeMiniSvg(v, "geo", w, h)
  },
  flow: {
    panelId: "flowPanel", btnId: "toolFlow", order: FLOW_ORDER,
    stateKey: "flowVariant", tool: "flow", caption: "流程图", hotkey: "F",
    labelOf: (v) => shapeLabel(v, "flow"),
    mini: (v, w, h) => shapeMiniSvg(v, "flow", w, h)
  },
  arrow: {
    panelId: "arrowPanel", btnId: "toolArrow", order: ARROW_ROUTE_ORDER,
    stateKey: "arrowRoute", tool: "arrow", caption: "箭头", hotkey: "A",
    labelOf: (v) => ARROW_ROUTE_LABEL[v] || v,
    mini: (v, w, h) => arrowMiniSvg(v, w, h),
    miniW: 34, miniH: 20, anchorToButton: true
  }
};

// 迷你预览由 flowPath 现生成：面板与画布共用一份轮廓定义，不会出现
// 「面板里画的和落下去的不是一个形状」。方框没有 path，用一个直角矩形代表。
function shapeMiniSvg(v, group, w, h) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "flow-mini");
  svg.setAttribute("width", w + 2);
  svg.setAttribute("height", h + 2);
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("class", "flow-path");
  p.setAttribute("d", v === "rect" ? SHAPE_PATH.square(w, h) : flowPath(v, w, h));
  // 留 1px 边距再 translate：描边贴着 0/0 画会被视口裁掉半个像素
  p.setAttribute("transform", "translate(1, 1)");
  if (v === "rect") p.setAttribute("stroke-dasharray", "4 3");   // 圈选框与实心矩形区分开
  svg.appendChild(p);
  return svg;
}

function buildShapePanel(cfg) {
  const panel = document.getElementById(cfg.panelId);
  if (!panel) return;
  panel.textContent = "";
  for (const v of cfg.order) {
    const label = cfg.labelOf(v);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.variant = v;
    btn.title = label;
    btn.appendChild(cfg.mini(v, cfg.miniW || 42, cfg.miniH || 24));
    const cap = document.createElement("span");
    cap.textContent = label;
    btn.appendChild(cap);
    panel.appendChild(btn);
  }
}

// 当前选中项：dock 按钮的迷你预览与面板里的高亮同一份取值。按钮供面板收起时看，
// 面板打开时按钮被压住，得由面板自己显出来——两处都不同步，选完就不知道选中的是哪个
function currentVariant(cfg) {
  return cfg.order.includes(state[cfg.stateKey]) ? state[cfg.stateKey] : cfg.order[0];
}

function syncShapePanelActive(cfg) {
  const panel = document.getElementById(cfg.panelId);
  if (!panel) return;
  const v = currentVariant(cfg);
  panel.querySelectorAll("button[data-variant]").forEach(b => {
    b.classList.toggle("is-on", b.dataset.variant === v);
  });
}

// dock 按钮显示当前形状，不打开面板也知道下一笔画什么
function syncShapeButton(cfg) {
  const btn = document.getElementById(cfg.btnId);
  if (!btn) return;
  const v = currentVariant(cfg);
  btn.title = cfg.caption + " · " + cfg.labelOf(v) + " (" + cfg.hotkey + ")";
  const old = btn.querySelector(".flow-mini");
  if (old) btn.replaceChild(cfg.mini(v, 16, 12), old);
  syncShapePanelActive(cfg);
}

// 切到面板之外的工具时统一收起。keep 是当前正要切入的工具，
// 它自己的面板不动——否则点 dock 按钮会「先关再开」，第二次点击关不掉。
// 形状切换器落位与两块面板重合，任何一次收起都把它一起带上。
function closeShapePanels(keep) {
  for (const cfg of Object.values(SHAPE_PANELS)) {
    if (keep === cfg.tool || (cfg.tool === "rect" && keep === "geo")) continue;
    const p = document.getElementById(cfg.panelId);
    if (p) p.hidden = true;
  }
  const picker = document.getElementById("shapePicker");
  if (picker) picker.hidden = true;
}

// 吸在自己 dock 按钮的正上方。纵向仍由 CSS 的 bottom 管（面板都贴着 dock 上沿），
// 这里只算横向，并夹在视口内不让边上的按钮把面板顶出屏幕。
function positionPanelToButton(cfg) {
  const panel = document.getElementById(cfg.panelId);
  const btn = document.getElementById(cfg.btnId);
  if (!panel || panel.hidden || !btn) return;
  const b = btn.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  let left = b.left + b.width / 2 - p.width / 2;
  left = Math.max(PICKER_MARGIN, Math.min(left, window.innerWidth - p.width - PICKER_MARGIN));
  panel.style.left = left + "px";
}

function positionAnchoredPanels() {
  for (const cfg of Object.values(SHAPE_PANELS)) {
    if (cfg.anchorToButton) positionPanelToButton(cfg);
  }
}

function bindShapePanel(cfg) {
  const panel = document.getElementById(cfg.panelId);
  const btn = document.getElementById(cfg.btnId);
  if (!panel || !btn) return;

  // 按钮的 setTool 由 bindDockTools 统一处理，这里只管面板开合
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.locked) { panel.hidden = true; return; }
    panel.hidden = !panel.hidden;
    if (!panel.hidden && cfg.anchorToButton) positionPanelToButton(cfg);
  });

  panel.addEventListener("click", (e) => {
    if (state.locked) return;
    const b = e.target.closest("button[data-variant]");
    if (!b) return;
    state[cfg.stateKey] = b.dataset.variant;
    panel.hidden = true;
    syncShapeButton(cfg);
    setTool(cfg.tool);
  });

  // 点面板外收起，与添加面板同一条惯例
  document.addEventListener("pointerdown", (e) => {
    if (panel.hidden) return;
    if (e.target.closest("#" + cfg.panelId) || e.target.closest("#" + cfg.btnId)) return;
    panel.hidden = true;
  });
}

function buildShapePanels() {
  for (const cfg of Object.values(SHAPE_PANELS)) buildShapePanel(cfg);
}
function syncShapeButtons() {
  for (const cfg of Object.values(SHAPE_PANELS)) syncShapeButton(cfg);
}
function bindShapePanels() {
  for (const cfg of Object.values(SHAPE_PANELS)) bindShapePanel(cfg);
}

function showHint(html) {
  const h = document.getElementById("modeHint");
  h.innerHTML = html;
  h.classList.add("visible");
}
function hideHint() { document.getElementById("modeHint").classList.remove("visible"); }

// 一次性提示，几秒后自撤。同一块提示区还承载着 mark / remount 的常驻模式提示，
// 超时回调里先比对内容：期间被模式提示接管过就不动它，否则会把「点击落标注」
// 这类必须常驻的指引提前关掉，用户会以为模式已经退出。
let hintTimer = null;
function showTimedHint(html, ms) {
  const h = document.getElementById("modeHint");
  showHint(html);
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    if (h.innerHTML === html) hideHint();
  }, ms || 3200);
}

// =============================================================
//  添加面板：把 frame 实例放上画布
// =============================================================
function genInstanceId() {
  return "fi-" + Math.random().toString(36).slice(2, 8);
}

function countAnnotationsOn(instanceId) {
  return state.annotations.filter(
    a => a.anchor && a.anchor.kind === "frame" && a.anchor.instanceId === instanceId
  ).length;
}

// 落位规则：同页已有实例的最右侧 + 间距；该页在画布上没有实例则落在整体包围盒下方
function nextPositionFor(pageId) {
  const same = state.frames.filter(f => f.pageId === pageId);
  if (same.length) {
    const rightmost = same.reduce((a, b) => ((a.x || 0) >= (b.x || 0) ? a : b));
    return { x: (rightmost.x || 0) + instViewport(rightmost).width + 48, y: rightmost.y || 0 };
  }
  if (!state.frames.length) return { x: 0, y: 0 };
  const maxY = Math.max(...state.frames.map(f => (f.y || 0) + instViewport(f).height + CAPTION_H));
  return { x: 0, y: maxY + 120 };
}

function addFrameInstance(pageId, frameKey) {
  if (state.locked) return;
  const pos = nextPositionFor(pageId);
  state.frames.push({
    id: genInstanceId(),
    pageId: pageId,
    frameKey: frameKey,
    x: pos.x,
    y: pos.y
  });
  writeLayout();
  renderCanvas();
  renderViewPanel();
  refreshLayoutBadge();
}

function removeFrameInstance(instanceId) {
  if (state.locked) return;
  removeCanvasObjects([instanceId], []);
}

// 卡片与图形的批量移除。标注确认只弹一次、落盘与重渲染各跑一次——
// 逐个删会弹 N 次确认框，撤销栈里也会攒出 N 步，删一片得按 N 次 Cmd+Z 才回得来。
// 面板上的单实例移除按钮是它成员数为一的特例，行为与从前一致。
function removeCanvasObjects(instanceIds, shapeIds) {
  const frames = (instanceIds || []).filter(id => state.frames.some(f => f.id === id));
  const shapes = (shapeIds || []).filter(id => state.shapes.some(s => s.id === id));
  if (!frames.length && !shapes.length) return;

  const n = frames.reduce((sum, id) => sum + countAnnotationsOn(id), 0);
  if (n > 0) {
    const who = frames.length > 1
      ? `选中的 ${frames.length} 个 frame 上共有 ${n} 条标注`
      : `这个 frame 上有 ${n} 条标注`;
    if (!confirm(`${who}。移除后标注会进入孤儿区，可在孤儿抽屉重新挂载。确定移除？`)) return;
    const hit = a => a.anchor && a.anchor.kind === "frame" && frames.includes(a.anchor.instanceId);
    for (const a of state.annotations.filter(hit)) {
      const o = Object.assign({}, a);
      o.lostReason = "所在的 frame 已从画布移除";
      o.lostAt = nowIso();
      state.orphans.push(o);
    }
    state.annotations = state.annotations.filter(a => !hit(a));
    writeAnnotations();
  }

  // 顺序要紧：降级要读宿主的坐标，必须赶在它被过滤掉之前
  for (const id of frames) detachArrowsFromHost("instanceId", id);
  for (const id of shapes) {
    const sh = findShape(id);
    if (sh && sh.kind !== "arrow") detachArrowsFromHost("shapeId", id);
  }
  state.frames = state.frames.filter(f => !frames.includes(f.id));
  state.shapes = state.shapes.filter(s => !shapes.includes(s.id));
  if (shapes.includes(state.editingShapeId)) state.editingShapeId = null;
  if (shapes.includes(state.editingArrowLabelId)) state.editingArrowLabelId = null;
  pruneSelection();
  writeLayout();
  renderCanvas();
  renderViewPanel();
  refreshLayoutBadge();
  refreshBadges();
}

// Delete 键的入口：选中集合里有什么删什么，卡片与图形混选也是一次操作、一步撤销
function deleteSelection() {
  if (state.locked || !state.selection.length) return;
  removeCanvasObjects(
    state.selection.filter(m => m.kind === "frame").map(m => m.id),
    state.selection.filter(m => m.kind === "shape").map(m => m.id)
  );
}

// 面板是画布实例的导航入口：点定位按钮把该实例滚到视口中央并高亮
function focusFrameInstance(instanceId) {
  const el = document.querySelector(`.frame-block[data-instance-id="${cssEscape(instanceId)}"]`);
  if (!el) return;
  const scroll = document.getElementById("canvasScroll");
  const sb = scroll.getBoundingClientRect();
  const eb = el.getBoundingClientRect();
  scroll.scrollTo({
    left: scroll.scrollLeft + (eb.left - sb.left) - sb.width / 2 + eb.width / 2,
    top: scroll.scrollTop + (eb.top - sb.top) - 80,
    behavior: "smooth"
  });
  el.classList.add("focused");
  setTimeout(() => el.classList.remove("focused"), 1200);
}

function refreshLayoutBadge() {
  const n = state.frames.length;
  const badge = document.getElementById("viewBadge");
  if (badge) {
    badge.textContent = String(n);
    badge.classList.toggle("muted", n === 0);
  }
  const sub = document.getElementById("viewPanelSub");
  if (sub) sub.textContent = "画布上 " + n + " 个";
}

function renderViewPanel() {
  const body = document.getElementById("viewBody");
  body.innerHTML = "";
  const pages = state.pages
    .filter(p => !p.missing)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!pages.length) {
    body.innerHTML = '<div class="view-empty">没有可用页面</div>';
    return;
  }
  for (const p of pages) {
    const order = (p.order != null) ? String(p.order).padStart(2, "0") : "--";
    const pageRow = document.createElement("div");
    pageRow.className = "view-page-row";
    pageRow.innerHTML = `
      <span class="view-page-tag">${order}</span>
      <span class="view-page-name" title="${escapeHtml(p.name || p.id)}">${escapeHtml(p.name || p.id)}</span>
    `;
    body.appendChild(pageRow);

    const frames = [];
    for (const s of (p.mainStates || [])) frames.push({ kind: "state", key: s.key, label: s.label || s.key });
    for (const o of (p.overlays || [])) frames.push({ kind: "overlay", key: o.key, label: o.label || o.key });
    if (!frames.length) continue;

    const ul = document.createElement("div");
    ul.className = "view-frame-list";
    for (const f of frames) {
      const insts = state.frames.filter(x => x.pageId === p.id && x.frameKey === f.key);
      const row = document.createElement("div");
      // NEW 徽标：pages.json 里有、画布上一个实例都没有
      row.className = "view-frame-row" + (insts.length === 0 ? " is-new" : "");
      row.innerHTML = `
        <span class="view-frame-kind ${f.kind === "overlay" ? "kind-overlay" : ""}">${f.kind}</span>
        <span class="view-frame-label" title="${escapeHtml(f.label)}">${escapeHtml(f.label)}</span>
        <button class="view-add-btn" data-action="add-instance"
          data-page-id="${escapeHtml(p.id)}" data-frame-key="${escapeHtml(f.key)}"
          title="添加一个实例到画布">
          <i class="fa-solid fa-plus"></i>
        </button>
      `;
      ul.appendChild(row);

      if (!insts.length) continue;
      const instList = document.createElement("div");
      instList.className = "view-inst-list";
      insts.forEach((inst, i) => {
        const n = countAnnotationsOn(inst.id);
        const instRow = document.createElement("div");
        instRow.className = "view-inst-row";
        instRow.innerHTML = `
          <span class="view-inst-name">实例${i + 1}</span>
          ${n ? `<span class="view-inst-ann" title="${n} 条标注">${n}</span>` : ""}
          <button class="view-add-btn" data-action="focus-instance" data-instance-id="${escapeHtml(inst.id)}" title="定位到画布">
            <i class="fa-solid fa-location-crosshairs"></i>
          </button>
          <button class="view-add-btn" data-action="remove-instance" data-instance-id="${escapeHtml(inst.id)}" title="从画布移除">
            <i class="fa-solid fa-xmark"></i>
          </button>
        `;
        instList.appendChild(instRow);
      });
      ul.appendChild(instList);
    }
    body.appendChild(ul);
  }
}

function openViewPanel() {
  document.getElementById("viewPanel").classList.add("visible");
  document.getElementById("btnView").classList.add("active");
  renderViewPanel();
}

function closeViewPanel() {
  document.getElementById("viewPanel").classList.remove("visible");
  document.getElementById("btnView").classList.remove("active");
}

function toggleViewPanel() {
  if (document.getElementById("viewPanel").classList.contains("visible")) closeViewPanel();
  else openViewPanel();
}

function bindViewPanel() {
  document.getElementById("viewBody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const act = btn.dataset.action;
    if (act === "add-instance") {
      addFrameInstance(btn.dataset.pageId, btn.dataset.frameKey);
    } else if (act === "focus-instance") {
      focusFrameInstance(btn.dataset.instanceId);
    } else if (act === "remove-instance") {
      removeFrameInstance(btn.dataset.instanceId);
    }
  });
  document.getElementById("viewClose").addEventListener("click", closeViewPanel);
}

function bindCanvasClick() {
  const stage = document.getElementById("canvasStage");
  // 与 bindShapeCreate 同一条理由：宿主必须是覆盖整片画布的 sizer，
  // 否则注释模式在卡片以外的空白区落不下标注。坐标仍以 stage 的 rect 为基准。
  const surface = document.getElementById("canvasSizer");
  surface.addEventListener("click", (e) => {
    if (state.mode === "browse") {
      closeCurrentCard();
      return;
    }
    if (state.locked) return;
    if (e.target.closest(".pin") || e.target.closest(".ann-card") || e.target.closest(".toolbar") || e.target.closest(".shape-toolbar") || e.target.closest(".dock") || e.target.closest(".orphan-drawer") || e.target.closest(".prd-drawer") || e.target.closest(".prd-launcher")) return;
    const stageBox = stage.getBoundingClientRect();
    const cx = (e.clientX - stageBox.left) / state.zoom;
    const cy = (e.clientY - stageBox.top) / state.zoom;
    const anchor = computeAnchor(cx, cy);
    if (state.mode === "mark") {
      const ann = createAnnotation(anchor);
      refreshPins();
      const pinEl = document.querySelector(`.pin[data-ann-id="${cssEscape(ann.id)}"]`);
      if (pinEl) openAnnotationEditCard(ann, pinEl, true);
      exitMarkMode();
    } else if (state.mode === "remount") {
      remountAnnotation(state.remountTargetId, anchor);
      exitRemountMode();
      refreshPins();
    }
  });
}

function computeAnchor(cx, cy) {
  const stage = document.getElementById("canvasStage");
  const stageBox = stage.getBoundingClientRect();
  const frames = stage.querySelectorAll(".frame[data-frame-key]");
  for (const f of frames) {
    const fb = f.getBoundingClientRect();
    const left = (fb.left - stageBox.left) / state.zoom;
    const top = (fb.top - stageBox.top) / state.zoom;
    const w = fb.width / state.zoom;
    const h = fb.height / state.zoom;
    if (cx >= left && cx <= left + w && cy >= top && cy <= top + h) {
      return {
        kind: "frame",
        instanceId: f.dataset.instanceId,
        pageId: f.dataset.pageId,
        frameKind: f.dataset.frameKind,
        frameKey: f.dataset.frameKey,
        x: (cx - left) / w,
        y: (cy - top) / h
      };
    }
  }
  return { kind: "canvas", x: cx, y: cy };
}

function createAnnotation(anchor) {
  const ann = {
    id: genId(),
    number: nextNumber(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    anchor: anchor,
    html: ""
  };
  state.annotations.push(ann);
  // 空钉只是编辑卡打开期间的半成品，编辑卡关闭时才记一步（见 closeCurrentCard）
  withoutHistory(writeAnnotations);
  return ann;
}

function remountAnnotation(id, anchor) {
  const idx = state.orphans.findIndex(o => o.id === id);
  if (idx < 0) return;
  const o = state.orphans[idx];
  delete o.lostReason;
  delete o.lostAt;
  o.anchor = anchor;
  o.updatedAt = nowIso();
  state.orphans.splice(idx, 1);
  state.annotations.push(o);
  writeAnnotations();
  renderOrphanDrawer();
}

// =============================================================
//  Annotation cards (edit + view)
// =============================================================

// 自制编辑器产出 HTML 的白名单清洗:防止粘贴/导入的 HTML 夹带 script/on*=/javascript:
// 即便用户主观威胁面小,也避免后续将 ann.html 注入预览时被浏览器解释成可执行片段
const ANN_ALLOWED_TAGS = new Set([
  "B","STRONG","I","EM","U","OL","UL","LI","FONT","SPAN","BR","P","DIV","H1","H2","H3"
]);
const ANN_DANGEROUS_TAGS = new Set([
  "SCRIPT","STYLE","IFRAME","OBJECT","EMBED","LINK","META","BASE","FORM","INPUT","TEXTAREA","IMG","SVG","MATH","A"
]);
function sanitizeAnnotationHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString("<div id='__ann_root'>" + html + "</div>", "text/html");
  const root = doc.getElementById("__ann_root");
  if (!root) return "";
  const all = Array.from(root.querySelectorAll("*"));
  for (const el of all) {
    if (ANN_DANGEROUS_TAGS.has(el.tagName)) { el.remove(); continue; }
    if (!ANN_ALLOWED_TAGS.has(el.tagName)) {
      // 非白名单标签:拆掉外壳保留文本/子节点
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      // FONT.color 是 execCommand foreColor 默认产物,放行
      if (el.tagName === "FONT" && name === "color") continue;
      // SPAN.style 只允许 color 一项(浏览器有时会用 span style 代替 font color)
      if (el.tagName === "SPAN" && name === "style") {
        const m = /color\s*:\s*([^;]+)/i.exec(attr.value);
        if (m) { el.setAttribute("style", "color: " + m[1].trim()); continue; }
      }
      el.removeAttribute(attr.name);
    }
  }
  return root.innerHTML;
}

function closeCurrentCard() {
  if (!state.openCardEl) return;
  state.openCardEl.remove();
  state.openCardEl = null;
  // 编辑卡的生命周期是一步：新建时的空钉不入栈，关卡时状态已定（提交 / 删除 / 原样），
  // 此刻同步入栈；查看卡走到这里快照与 present 全同，不占步
  historyFlush();
}

function positionCardNearPin(card, pinEl) {
  document.body.appendChild(card);
  const pb = pinEl.getBoundingClientRect();
  const cb = card.getBoundingClientRect();
  let left = pb.right + 8;
  let top = pb.bottom + 4;
  if (left + cb.width > window.innerWidth - 8) left = pb.left - cb.width - 8;
  if (top + cb.height > window.innerHeight - 8) top = pb.top - cb.height - 4;
  card.style.left = Math.max(8, left) + "px";
  card.style.top = Math.max(8, top) + "px";
}

// 自制轻量编辑器调色板:常规 6 色;黑色作"恢复默认"(写回正文色)
const ANN_COLOR_PALETTE = [
  { color: "#1A202C", label: "黑" },
  { color: "#718096", label: "灰" },
  { color: "#E53E3E", label: "红" },
  { color: "#DD6B20", label: "橙" },
  { color: "#38A169", label: "绿" },
  { color: "#3182CE", label: "蓝" }
];

function openAnnotationEditCard(ann, pinEl, isNew) {
  closeCurrentCard();
  if (state.locked) return;
  const card = document.createElement("div");
  card.className = "ann-card ann-card--edit";
  card.style.position = "fixed";
  const colorBtns = ANN_COLOR_PALETTE.map(c =>
    `<button type="button" class="ann-color-btn" data-color="${c.color}" title="${c.label}" style="background:${c.color};"></button>`
  ).join("");
  const initialHtml = sanitizeAnnotationHtml(ann.html || "");
  card.innerHTML = `
    <div class="ann-head">
      <div><span class="ann-num">#${ann.number}</span><span class="ann-meta">${isNew ? "新建" : "编辑"}</span></div>
      <button class="icon-btn" data-act="close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="ann-editor">
      <div class="ann-toolbar" role="toolbar">
        <button type="button" class="ann-toolbar-btn" data-cmd="bold" title="加粗 Cmd/Ctrl+B"><b>B</b></button>
        <button type="button" class="ann-toolbar-btn" data-cmd="italic" title="斜体 Cmd/Ctrl+I"><i class="italic-i">I</i></button>
        <button type="button" class="ann-toolbar-btn" data-cmd="underline" title="下划线 Cmd/Ctrl+U"><u>U</u></button>
        <span class="ann-toolbar-divider"></span>
        <button type="button" class="ann-toolbar-btn" data-block="H1" title="一级标题">H1</button>
        <button type="button" class="ann-toolbar-btn" data-block="H2" title="二级标题">H2</button>
        <button type="button" class="ann-toolbar-btn" data-block="H3" title="三级标题">H3</button>
        <button type="button" class="ann-toolbar-btn" data-block="P" title="正文">¶</button>
        <span class="ann-toolbar-divider"></span>
        <button type="button" class="ann-toolbar-btn" data-cmd="insertOrderedList" title="有序列表">1.</button>
        <button type="button" class="ann-toolbar-btn" data-cmd="insertUnorderedList" title="无序列表">•</button>
        <span class="ann-toolbar-divider"></span>
        <span class="ann-color-row" title="文字颜色">${colorBtns}</span>
      </div>
      <div class="ann-body" contenteditable="true" data-placeholder="支持加粗 / 斜体 / 下划线 / 标题 / 列表 / 颜色">${initialHtml}</div>
    </div>
    <div class="ann-foot">
      <button class="btn" data-act="cancel">取消</button>
      <button class="btn primary" data-act="confirm">确认</button>
    </div>
  `;

  state.openCardEl = card;
  positionCardNearPin(card, pinEl);

  const body = card.querySelector(".ann-body");
  const toolbar = card.querySelector(".ann-toolbar");

  // 选区保存:工具栏 mousedown 会让 body 短暂失焦,失焦那一刻 selection 仍指向 body 内,先存下来
  // 点完按钮 restore,execCommand 才能作用在原选区上
  let savedRange = null;
  function saveRange() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    if (body.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
  }
  function restoreRange() {
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
  body.addEventListener("keyup", saveRange);
  body.addEventListener("mouseup", saveRange);

  // 工具栏 mousedown 阻止默认行为,防止焦点从 body 跑走时 selection 被浏览器清掉(经典 contenteditable 工具栏踩坑点)
  toolbar.addEventListener("mousedown", e => e.preventDefault());
  toolbar.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    body.focus();
    restoreRange();
    if (btn.dataset.cmd) {
      document.execCommand(btn.dataset.cmd, false);
    } else if (btn.dataset.block) {
      document.execCommand("formatBlock", false, btn.dataset.block);
    } else if (btn.dataset.color) {
      document.execCommand("foreColor", false, btn.dataset.color);
    }
    saveRange();
    refreshToolbarState();
  });

  // 工具栏 active 态:bold/italic/underline/list 这类有切换语义的命令,queryCommandState 能查
  function refreshToolbarState() {
    toolbar.querySelectorAll("[data-cmd]").forEach(b => {
      try {
        b.setAttribute("aria-pressed", document.queryCommandState(b.dataset.cmd) ? "true" : "false");
      } catch (_) {}
    });
  }
  body.addEventListener("keyup", refreshToolbarState);
  body.addEventListener("mouseup", refreshToolbarState);

  // 粘贴清洗:外站富文本带的 inline style / 外链 / 表格千奇百怪,统一降级纯文本最稳
  body.addEventListener("paste", e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });

  // 首次聚焦光标置于尾部(编辑老标注时方便接着写)
  setTimeout(() => {
    body.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(body);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    saveRange();
    refreshToolbarState();
  }, 0);

  const getValueHtml = () => body.innerHTML;
  const getValueText = () => (body.innerText || body.textContent || "");

  // 提交保存:有文本则存盘,空文本则删除该标注(不留空钉)。点"确认"与点卡片外空白处共用,committed 防重入
  let committed = false;
  card._commitEdit = () => {
    if (committed) return;
    committed = true;
    const text = getValueText();
    if (!text.trim()) {
      deleteAnnotation(ann.id);
      closeCurrentCard();
      return;
    }
    ann.html = sanitizeAnnotationHtml(getValueHtml());
    ann.updatedAt = nowIso();
    writeAnnotations();
    refreshPins();
    closeCurrentCard();
  };

  card.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "confirm") {
      card._commitEdit();
      return;
    }
    // 取消 / 关闭:丢弃(不存盘),空的新建钉一并删除
    if (isNew && !getValueText().trim()) deleteAnnotation(ann.id);
    closeCurrentCard();
  });
}

function openAnnotationViewCard(ann, pinEl) {
  closeCurrentCard();
  const card = document.createElement("div");
  card.className = "ann-card";
  card.style.position = "fixed";
  card.innerHTML = `
    <div class="ann-head">
      <div><span class="ann-num">#${ann.number}</span><span class="ann-meta">${new Date(ann.updatedAt || ann.createdAt).toLocaleString()}</span></div>
      <div class="ann-actions">
        ${state.locked ? "" : `<button class="icon-btn" data-act="edit" title="编辑"><i class="fa-solid fa-pen"></i></button>`}
        ${state.locked ? "" : `<button class="icon-btn danger" data-act="del" title="删除"><i class="fa-solid fa-trash"></i></button>`}
        <button class="icon-btn" data-act="close"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>
    <div class="ann-preview-body ann-body" style="padding:12px 14px; max-height:560px; overflow-y:auto; min-height:0;">${sanitizeAnnotationHtml(ann.html) || '<span style="color:var(--text-mute);font-size:12px;">（空）</span>'}</div>
  `;
  card.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "close") closeCurrentCard();
    else if (act === "edit") { closeCurrentCard(); openAnnotationEditCard(ann, pinEl, false); }
    else if (act === "del") {
      if (confirm(`删除标注 #${ann.number}？`)) { deleteAnnotation(ann.id); closeCurrentCard(); }
    }
  });
  state.openCardEl = card;
  positionCardNearPin(card, pinEl);
  renderMermaidIn(card).then(() => { if (state.openCardEl === card) positionCardNearPin(card, pinEl); });
}

function deleteAnnotation(id) {
  state.annotations = state.annotations.filter(a => a.id !== id);
  writeAnnotations();
  refreshPins();
}

// =============================================================
//  Toolbar bindings
// =============================================================
function refreshBadges() {
  const exportBadge = document.getElementById("exportBadge");
  // 数的是「导出文件里会有多少条」，所以四部分都算：导出的是整份画布状态，
  // 只数标注会让画满图形的画布显示 0，与「回流靠导出」这条工作流对不上。
  const exportCount = state.annotations.length + state.orphans.length
    + state.frames.length + state.shapes.length;
  exportBadge.textContent = exportCount;
  exportBadge.classList.toggle("muted", !state.dirty || state.serverMode);
  exportBadge.classList.toggle("save-dot", false);
  const obtn = document.getElementById("btnOrphan");
  if (state.orphans.length > 0) {
    obtn.style.display = "";
    document.getElementById("orphanBadge").textContent = state.orphans.length;
  } else {
    obtn.style.display = "none";
  }
}

// 锁定是站点默认视图（pages.json 的 viewDefaults.locked），不是画布内容：它不进
// 「导出」的 canvas-state.json，静态模式下没有任何回流手段。存不了的时候必须明说，
// 否则人以为锁上了、发出去却是开的
function viewSaveBlocker() {
  if (!state.serverMode) {
    return "静态模式：锁定只在本次浏览有效，刷新回到站点默认。要让锁定随包发出去，用站点目录里的 canvas_server.py 起服务（lan-launcher --canvas-api）";
  }
  if (!state.viewSave) {
    return "当前站点里的 canvas_server.py 版本存不了锁定状态：重跑一次画布生成即可覆盖";
  }
  return null;
}

// 锁定落盘。不走 persist()：它会把 state.dirty 置真，而 dirty 的语义是「有未导出的
// 标注 / 编排」，锁定既不在导出文件里，标脏只会让静态模式的人对着一个导不走的红点发愁
function persistLocked() {
  const blocked = viewSaveBlocker();
  if (blocked) { showTimedHint(blocked, 5000); return; }
  pending.view = { locked: state.locked };
  flush("view");
}

// state.locked 到界面的唯一同步点：锁定开关与 boot 时的站点默认都走这里，
// 否则默认锁定会只有状态没有视觉
function applyLocked() {
  // 锁定态要同时作用于三处：toolbar / dock 各自变灰按钮；body 供添加面板、
  // 孤儿抽屉与 frame 卡片光标这些不在两条工具栏内的元素读取
  document.getElementById("toolbar").classList.toggle("locked", state.locked);
  document.getElementById("dock").classList.toggle("locked", state.locked);
  document.body.classList.toggle("locked", state.locked);
  const ic = document.querySelector("#btnLock i");
  if (ic) ic.className = state.locked ? "fa-solid fa-lock" : "fa-solid fa-lock-open";
  if (state.locked && window.__pickerDeactivate) window.__pickerDeactivate();
  // 锁定时把图形工具收回选择：留在图形态上光标是十字，点下去却被锁定守卫吞掉
  if (state.locked && state.tool !== "select" && state.tool !== "pan") setTool("select");
  syncShapeToolbar(); // 锁定态没有其它路径会再刷新浮条，选中箭头时锁定要靠这里收起
  closeCurrentCard();
  refreshPins();
}

function bindToolbar() {
  document.getElementById("btnMark").addEventListener("click", () => {
    if (state.mode === "mark") { exitMarkMode(); return; }
    // 归位工具：图形工具停在原处会让画布保持十字光标，盖掉打标模式的气泡光标
    setTool("select");
    if (window.__pickerDeactivate) window.__pickerDeactivate();
    enterMarkMode();
  });
  document.getElementById("btnLock").addEventListener("click", () => {
    // 先收口进行中的编辑再锁：正在打的字提交保住，而不是让随后的 blur 在锁定态下落盘
    if (!state.locked) settleEditing();
    state.locked = !state.locked;
    applyLocked();
    persistLocked();
  });
  document.getElementById("btnView").addEventListener("click", toggleViewPanel);
  document.getElementById("btnTheme").addEventListener("click", toggleTheme);
  document.getElementById("btnExport").addEventListener("click", exportCanvasState);
  document.getElementById("btnImport").addEventListener("click", openImportModal);
  document.getElementById("btnZoomOut").addEventListener("click", () => zoomByStep(0.9));
  document.getElementById("btnZoomIn").addEventListener("click", () => zoomByStep(1.1));
  document.getElementById("zoomDisplay").addEventListener("click", zoomReset);
  document.getElementById("btnOrphan").addEventListener("click", () => {
    const d = document.getElementById("orphanDrawer");
    if (d.classList.contains("open")) { closeDrawer(); } else { renderOrphanDrawer(); d.classList.add("open"); }
  });
  document.getElementById("orphanClose").addEventListener("click", closeDrawer);
}

function closeDrawer() { document.getElementById("orphanDrawer").classList.remove("open"); }

function downloadJson(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function exportCanvasState() {
  downloadJson("canvas-state.json", {
    version: "1",
    generatedAt: nowIso(),
    annotations: state.annotations,
    orphans: state.orphans,
    frames: state.frames,
    shapes: state.shapes
  });
  state.dirty = false;
  refreshBadges();
}

// 旧版画布在没有写 API 时把标注与编排存进本机 localStorage。用 file:// 或纯静态服务
// 评审过的人，那些数据只在自己这台浏览器里；旧的命名空间取值方式与当前的也对不上，
// 按键名捞都捞不着。启动时扫一遍旧键，整理成与「导出」同格式的文件交还用户，
// 拿回本地画布「导入」即可归位。
function rescueLegacyLocalStorage() {
  const PREFIXES = { annotations: "proto-canvas:annotations:", layout: "proto-canvas:layout:" };
  const FIELDS = { annotations: ["annotations", "orphans"], layout: ["frames", "shapes"] };
  try {
    const groups = new Map();   // 旧命名空间 → 四个数组 + 该组占用的键名
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      for (const kind of Object.keys(PREFIXES)) {
        const prefix = PREFIXES[kind];
        if (k.indexOf(prefix) !== 0) continue;
        let data = null;
        // 解析不了的键原样留着：删掉等于替用户销毁他仅有的一份，哪怕这边读不懂
        try { data = JSON.parse(localStorage.getItem(k)); } catch (e) {}
        if (data && typeof data === "object") {
          const ns = k.slice(prefix.length);
          const g = groups.get(ns) || { annotations: [], orphans: [], frames: [], shapes: [], keys: [] };
          let found = false;
          for (const f of FIELDS[kind]) {
            if (Array.isArray(data[f]) && data[f].length) { g[f] = data[f]; found = true; }
          }
          if (found) { g.keys.push(k); groups.set(ns, g); }
        }
        break;
      }
    }
    if (!groups.size) return;
    if (!confirm("检测到本机浏览器里存有旧版画布的标注 / 编排数据（" + groups.size +
        " 份）。下载为 canvas-state 文件后将从浏览器清除；取消则保留，下次打开再问。")) return;
    for (const entry of groups) {
      const ns = entry[0], g = entry[1];
      downloadJson("legacy-canvas-state-" + ns.replace(/[^A-Za-z0-9._-]+/g, "-") + ".json", {
        version: "1",
        generatedAt: nowIso(),
        annotations: g.annotations,
        orphans: g.orphans,
        frames: g.frames,
        shapes: g.shapes
      });
      for (const k of g.keys) localStorage.removeItem(k);
    }
  } catch (e) {}   // localStorage 不可用（隐私模式、站点数据被禁）时静默跳过
}

// =============================================================
//  导入：覆盖式还原
//  导出文件是画布内容的整份快照，导入就是把画布换成那一份，不做按 id 合并——
//  合并的结果是两份状态的并集，演示时删掉 / 挪走的东西还留在原地，不是演示态。
//  误导入可 Cmd/Ctrl+Z 整体撤回：两个 writer 的快照在同一调用栈里合并成一步。
// =============================================================

const IMPORT_KEYS = ["annotations", "orphans", "frames", "shapes"];
const IMPORT_LABELS = { annotations: "注释点", orphans: "孤儿", frames: "卡片实例", shapes: "图形" };
const DEAD_FRAME_SAMPLE = 6;         // 缺页清单最多列几条，其余折成「等 N 个」
const DANGLING_ARROW_OFFSET = 160;   // 悬空端贴着活着那端放的距离，画布坐标

let importPending = null;            // 已解析待确认的导入内容；确认或关掉弹窗时清空

// 解析文件文本并与当前站点对账。解析不了就抛，由调用方转成弹窗里的错误态
function analyzeImport(text, fileName) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("顶层不是一个对象");
  }
  const incoming = {};
  let usable = 0;
  for (const key of IMPORT_KEYS) {
    const list = Array.isArray(data[key]) ? data[key] : [];
    // 畸形条目在这里就滤掉：覆盖式没有第二道关口，脏数据进了 state 就会落盘
    incoming[key] = list.filter(x => x && typeof x === "object" && typeof x.id === "string");
    usable += incoming[key].length;
  }
  if (!usable && !IMPORT_KEYS.some(k => Array.isArray(data[k]))) {
    throw new Error("没有 annotations / orphans / frames / shapes 中的任何一项");
  }
  const dead = deadInstanceIds(incoming.frames, state.pages);
  const hitDead = (ann) => {
    const a = ann && ann.anchor;
    return !!(a && a.kind === "frame" && a.instanceId && dead.has(a.instanceId));
  };
  return {
    fileName: fileName || "",
    generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : "",
    incoming: incoming,
    deadFrames: incoming.frames.filter(f => dead.has(f.id)),
    deadAnnotations: incoming.annotations.filter(hitDead).length,
    dangling: danglingArrowEnds(incoming.shapes, incoming.frames).length,
  };
}

function renderImportReport(info) {
  const rows = IMPORT_KEYS.map(key =>
    `<tr><td>${IMPORT_LABELS[key]}</td><td>${state[key].length}</td>` +
    `<td class="import-next">${info.incoming[key].length}</td></tr>`
  ).join("");

  let html =
    `<div class="import-file">${escapeHtml(info.fileName)}` +
    (info.generatedAt ? " · 导出于 " + escapeHtml(info.generatedAt) : "") + "</div>" +
    `<table><thead><tr><th></th><th>当前</th><th>导入后</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<div class="import-note warn">导入整体替换当前画布内容，不做合并。误操作可 Cmd/Ctrl+Z 撤回。</div>`;

  if (info.deadFrames.length) {
    const sample = info.deadFrames.slice(0, DEAD_FRAME_SAMPLE)
      .map(f => `<li>${escapeHtml(String(f.pageId))}#${escapeHtml(String(f.frameKey))}</li>`).join("");
    const rest = info.deadFrames.length - DEAD_FRAME_SAMPLE;
    html += `<div class="import-note warn">有 ${info.deadFrames.length} 个卡片在本站点找不到对应页面：` +
      `<ul>${sample}${rest > 0 ? `<li>…等 ${rest} 个</li>` : ""}</ul>` +
      (info.deadAnnotations ? `它们的 ${info.deadAnnotations} 条注释点将进孤儿抽屉。` : "它们不会显示在画布上。") +
      "</div>";
  }
  if (info.dangling) {
    html += `<div class="import-note warn">有 ${info.dangling} 条箭头的端点在这份文件里找不到宿主，` +
      "会被挪到另一端旁边等待重接；两端都找不到的整条丢弃。</div>";
  }
  if (!state.serverMode) {
    html += '<div class="import-note">当前是静态副本，导入结果只在内存、刷新即丢。要带走请再次「导出」。</div>';
  }

  const box = document.getElementById("importReport");
  box.innerHTML = html;
  box.hidden = false;
  document.getElementById("importDrop").hidden = true;
  document.getElementById("importReset").hidden = false;
  document.getElementById("importConfirm").disabled = false;
}

function showImportError(msg) {
  importPending = null;
  const box = document.getElementById("importReport");
  box.innerHTML = `<div class="import-note error">${escapeHtml(msg)}</div>`;
  box.hidden = false;
  document.getElementById("importDrop").hidden = false;
  document.getElementById("importReset").hidden = true;
  document.getElementById("importConfirm").disabled = true;
}

function openImportModal() {
  if (state.locked) return;
  importPending = null;
  const box = document.getElementById("importReport");
  box.hidden = true;
  box.innerHTML = "";
  document.getElementById("importDrop").hidden = false;
  document.getElementById("importDrop").classList.remove("dragging");
  document.getElementById("importReset").hidden = true;
  document.getElementById("importConfirm").disabled = true;
  document.getElementById("importModal").hidden = false;
}

function closeImportModal() {
  importPending = null;
  document.getElementById("importModal").hidden = true;
}

function importModalOpen() {
  return !document.getElementById("importModal").hidden;
}

function loadImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => showImportError("这个文件读不出来，换一份试试。");
  reader.onload = () => {
    let info;
    try {
      info = analyzeImport(String(reader.result || ""), file.name);
    } catch (err) {
      showImportError("这份文件不是画布状态：" + ((err && err.message) || "解析失败"));
      return;
    }
    importPending = info;
    renderImportReport(info);
  };
  reader.readAsText(file);
}

// 端点的宿主不在这份数据里（手拼或损坏的文件）时 resolveArrowEnd 会退回 (0, 0)，
// 线全堆到画布左上角。有一端还活着就贴着它放，两端都悬空的箭头没有位置信息，整条丢弃
function repairDanglingArrows() {
  const bad = new Map(danglingArrowEnds(state.shapes, state.frames).map(d => [d.id, d]));
  if (!bad.size) return;
  const kept = [];
  for (const sh of state.shapes) {
    const d = sh && sh.kind === "arrow" ? bad.get(sh.id) : null;
    if (!d) { kept.push(sh); continue; }
    if (!d.from && !d.to) continue;
    const live = resolveArrowEnd(d.from ? sh.from : sh.to);
    const fallback = { x: live.x + DANGLING_ARROW_OFFSET, y: live.y + DANGLING_ARROW_OFFSET };
    if (d.from) sh.to = fallback; else sh.from = fallback;
    kept.push(sh);
  }
  state.shapes = kept;
}

function applyImport() {
  if (state.locked) return;
  const info = importPending;
  if (!info) return;
  for (const key of IMPORT_KEYS) state[key] = info.incoming[key];
  closeImportModal();
  clearSelection();
  state.editingShapeId = null;
  state.editingArrowLabelId = null;
  repairDanglingArrows();
  // 指向本站点没有的页面 / 状态的实例画不出来，挂在上面的注释点先归位再落盘
  orphanByMissingInstance();
  writeAnnotations();
  writeLayout();
  renderCanvas();
  renderViewPanel();
  refreshBadges();
  refreshLayoutBadge();
}

function bindImportModal() {
  const modal = document.getElementById("importModal");
  const drop = document.getElementById("importDrop");
  const fileInput = document.getElementById("importFile");

  document.getElementById("importClose").addEventListener("click", closeImportModal);
  document.getElementById("importCancel").addEventListener("click", closeImportModal);
  document.getElementById("importConfirm").addEventListener("click", applyImport);
  document.getElementById("importReset").addEventListener("click", openImportModal);
  modal.addEventListener("pointerdown", (e) => { if (e.target === modal) closeImportModal(); });
  // 拖到弹窗上但没落进拖放区里的，也要拦下来：不拦浏览器就拿这个文件替换掉整个画布页面
  for (const type of ["dragover", "drop"]) {
    modal.addEventListener(type, (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
      e.preventDefault();
    });
  }

  drop.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    // 清空 value，否则连着挑同一个文件时 change 不会再触发
    e.target.value = "";
    loadImportFile(file);
  });
  // 弹窗盖在画布上，拖放事件不能漏到底下的图片落盘那条路
  for (const type of ["dragenter", "dragover"]) {
    drop.addEventListener(type, (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      drop.classList.add("dragging");
    });
  }
  drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    drop.classList.remove("dragging");
    const file = pickJsonFile(e.dataTransfer);
    if (!file) { showImportError("拖进来的不是 .json 文件。"); return; }
    loadImportFile(file);
  });
}

function pickJsonFile(dt) {
  if (!dt) return null;
  const files = dt.files ? Array.from(dt.files) : [];
  return files.find(f => f.type === "application/json" || /\.json$/i.test(f.name || "")) || null;
}

function renderOrphanDrawer() {
  const body = document.getElementById("orphanBody");
  body.innerHTML = "";
  if (!state.orphans.length) {
    body.innerHTML = '<div class="empty-state" style="padding:40px 20px;"><i class="fa-solid fa-circle-check"></i>没有孤儿标注</div>';
    return;
  }
  for (const o of state.orphans) {
    const item = document.createElement("div");
    item.className = "orphan-item";
    const _tmp = document.createElement("div");
    _tmp.innerHTML = sanitizeAnnotationHtml(o.html || "");
    const summary = ((_tmp.textContent || "").trim() || "").replace(/\s+/g, " ").slice(0, 80) || "（空）";
    item.innerHTML = `
      <div class="orphan-head"><span class="orphan-num">#${o.number}</span></div>
      <div class="orphan-summary">${escapeHtml(summary)}</div>
      <div class="lost-reason">${escapeHtml(o.lostReason || "未知原因")}</div>
      <div class="orphan-actions">
        <button class="btn primary" data-act="remount" data-id="${escapeHtml(o.id)}">重新挂载</button>
        <button class="btn" data-act="drop" data-id="${escapeHtml(o.id)}">删除</button>
      </div>
    `;
    body.appendChild(item);
  }
  body.addEventListener("click", orphanDrawerClick, { once: true });
}

function orphanDrawerClick(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn) { renderOrphanDrawer(); return; }
  const id = btn.dataset.id;
  const act = btn.dataset.act;
  // 抽屉的 click 监听是 once：任何早退都要重挂，否则抽屉直到关掉重开都点不动
  if (state.locked) { renderOrphanDrawer(); return; }
  if (act === "remount") {
    if (window.__pickerDeactivate) window.__pickerDeactivate();
    enterRemountMode(id);
  } else if (act === "drop") {
    if (confirm("删除该孤儿标注？")) {
      state.orphans = state.orphans.filter(o => o.id !== id);
      writeAnnotations();
      renderOrphanDrawer();
    } else {
      renderOrphanDrawer();
    }
  }
}

// =============================================================
//  isTyping — 焦点是否在输入框 / 可编辑区
// =============================================================
// 供空格平移、dock 工具快捷键、ESC 链共用：焦点在输入框 / 可编辑区时，
// 单键快捷键一律让位给文字输入。
function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// =============================================================
//  Option/Alt 临时放开 iframe 指针权
// =============================================================
// 按住 Option/Alt 把指针权临时还给 iframe，用于选中复制原型内的文字。
// blur 兜底必须有：切换应用时收不到 keyup，不清会永久卡在放开态。
function bindAltPeek() {
  const exit = () => document.body.classList.remove("alt-peek");
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Alt" || e.repeat) return;
    document.body.classList.add("alt-peek");
  });
  document.addEventListener("keyup", (e) => { if (e.key === "Alt") exit(); });
  window.addEventListener("blur", exit);
  // 在 iframe 内 mousedown 选文字会把浏览器焦点切到该 iframe 的 browsing context，
  // 之后松开 Option 的 keyup 派发给 iframe 文档、到不了这里，window 也没失焦、blur 兜底同样够不着；
  // 靠 pointerdown/pointermove 上的 e.altKey 校正，用户松开 Option 后只要挪一下鼠标就会恢复。
  const syncFromPointerEvent = (e) => {
    const active = document.body.classList.contains("alt-peek");
    if (e.altKey !== active) document.body.classList.toggle("alt-peek", e.altKey);
  };
  // capture 阶段注册：bindFrameDrag 的 pointerdown 挂在更深的 .frame-block 上，
  // 冒泡阶段会先于本监听执行——alt-peek 卡在 ON 时第一次拖拽会读到校正前的旧状态而被吞。
  // capture 阶段自顶向下先跑，保证校正总是先于目标元素的冒泡监听生效。
  document.addEventListener("pointerdown", syncFromPointerEvent, { capture: true });
  document.addEventListener("pointermove", syncFromPointerEvent);
}

// =============================================================
//  frame 拖拽
// =============================================================
// 拖动 frame 实例改坐标。手势主体与图形共用 startGroupDragGesture：超过阈值才算拖拽，
// 避免和点击冲突；落点写回 layout 并持久化。
// 实例按 id 现查而不是闭包持有：撤销会整体替换 state.frames，闭包里的旧对象
// 会让拖拽视觉上动了、落盘的却是 state 里那个没改过的新对象
function bindFrameDrag(block) {
  block.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (state.locked) return;
    if (state.tool !== "select") return;
    if (state.mode !== "browse") return;
    if (document.body.classList.contains("picking")) return;
    if (document.body.classList.contains("alt-peek")) return;
    const inst = state.frames.find(f => f.id === block.dataset.instanceId);
    if (!inst) return;
    // 与 bindShapeDrag 同一条惯例：起手即定选中集合，不等拖动阈值。单纯点一下也要有反馈
    if (!prepareSelectionForDrag("frame", inst.id, e.shiftKey)) return;

    startGroupDragGesture(e, {
      el: block,
      dragClass: "dragging",
      onDragStart: closeCurrentCard,
      onClick: () => {
        if (!e.shiftKey && state.selection.length > 1) selectFrame(inst.id);
      }
    });
  });
}

// =============================================================
//  空格 + 拖动平移(Figma 手型)
// =============================================================
// 空格按住 → 盖透明遮罩(grab 光标)捕获 iframe/pin 之上的拖动 → 转成原生滚动平移;
// 编辑器/输入框聚焦时空格照常输入,不进入平移。
function bindSpacePan() {
  const scroll = document.getElementById("canvasScroll");
  const overlay = document.getElementById("panOverlay");
  let spaceActive = false, dragging = false, pid = null;
  let sx = 0, sy = 0, sl = 0, st = 0;

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    overlay.classList.remove("dragging");
    try { if (pid != null) overlay.releasePointerCapture(pid); } catch (_) {}
    pid = null;
  };
  const exitSpace = () => {
    spaceActive = false;
    document.body.classList.remove("space-pan");
    endDrag();
  };

  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat) return;
    if (isTyping()) return;            // 编辑器/输入框内空格照常输入
    spaceActive = true;
    document.body.classList.add("space-pan");
    e.preventDefault();               // 阻止页面滚动 / 聚焦按钮的空格触发
  });
  document.addEventListener("keyup", (e) => { if (e.code === "Space") exitSpace(); });
  window.addEventListener("blur", exitSpace);  // 切窗兜底,避免卡在平移态

  overlay.addEventListener("pointerdown", (e) => {
    // 覆盖两种进入方式：按住空格的临时平移，与 dock「平移」工具（H）的常驻平移
    if (!spaceActive && state.tool !== "pan") return;
    dragging = true;
    pid = e.pointerId;
    sx = e.clientX; sy = e.clientY;
    sl = scroll.scrollLeft; st = scroll.scrollTop;
    overlay.classList.add("dragging");
    try { overlay.setPointerCapture(pid); } catch (_) {}
    e.preventDefault();
  });
  overlay.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    scroll.scrollLeft = sl - (e.clientX - sx);
    scroll.scrollTop = st - (e.clientY - sy);
  });
  overlay.addEventListener("pointerup", endDrag);
  overlay.addEventListener("pointercancel", endDrag);
}

// =============================================================
//  Global keys + resize
// =============================================================
// 快捷键字母：拉丁布局按键帽字母（AZERTY 上 Z 键的 e.code 是 KeyW，按物理键位会错），
// 键帽不是拉丁字母的布局（西里尔等）退回物理键位
function shortcutLetter(e) {
  const k = (e.key || "").toLowerCase();
  if (/^[a-z]$/.test(k)) return k;
  const m = /^Key([A-Z])$/.exec(e.code || "");
  return m ? m[1].toLowerCase() : "";
}

function bindHistory() {
  const u = document.getElementById("btnUndo");
  const r = document.getElementById("btnRedo");
  if (!u || !r) return;
  u.addEventListener("click", undoCanvas);
  r.addEventListener("click", redoCanvas);
  document.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    // 焦点在 contenteditable / 输入框里是浏览器原生的文本撤销，交给它
    if (isTyping()) return;
    const letter = shortcutLetter(e);
    let action = null;
    if (letter === "z") action = e.shiftKey ? "redo" : "undo";
    else if (letter === "y" && e.ctrlKey && !e.metaKey) action = "redo";
    if (!action) return;
    e.preventDefault();
    if (action === "undo") undoCanvas(); else redoCanvas();
  });
}

function bindGlobals() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // 优先级链：导入弹窗 > 文本编辑（图形 / 连线标签）> 标注模式 > 卡片 > 面板/抽屉 > 选中 > 图形工具回 select
      if (importModalOpen()) closeImportModal();
      else if (state.editingShapeId) commitShapeTextEdit();
      else if (state.editingArrowLabelId) commitArrowLabelEdit();
      else if (state.mode === "mark") exitMarkMode();
      else if (state.mode === "remount") exitRemountMode();
      else if (state.openCardEl) closeCurrentCard();
      else if (document.getElementById("viewPanel").classList.contains("visible")) closeViewPanel();
      else if (document.getElementById("orphanDrawer").classList.contains("open")) closeDrawer();
      else if (state.selection.length) clearSelection();
      else if (state.tool !== "select") setTool("select");
    }
  });
  window.addEventListener("resize", () => {
    refreshPins();
    positionShapePicker();
    positionAnchoredPanels();
  });
  // 横幅只是开场提醒，看过就能收走；工具栏里的「静态副本」承担常驻提示
  const bannerClose = document.getElementById("staticBannerClose");
  if (bannerClose) {
    bannerClose.addEventListener("click", () => {
      const banner = document.getElementById("staticBanner");
      if (banner) banner.hidden = true;
    });
  }
  // 滚动/平移时关闭查看卡(随锚点漂移);编辑卡是 fixed 弹窗、滚动不漂移,保持打开避免丢失在编辑的内容
  document.getElementById("canvasScroll").addEventListener("scroll", () => {
    if (state.openCardEl && !state.openCardEl._commitEdit) closeCurrentCard();
    positionShapePicker();    // 切换器贴的是浮条的屏幕位置，画布一滚就得重贴
  });
  // 编辑时点击卡片外空白处 = 自动保存并关闭(点取消/关闭键、按 ESC 仍丢弃)
  document.addEventListener("pointerdown", (e) => {
    const card = state.openCardEl;
    if (!card || !card._commitEdit) return;            // 仅对编辑卡生效
    if (card.contains(e.target)) return;                // 卡片内(含工具栏/正文/颜色按钮)不触发
    card._commitEdit();
  }, true);
  // 服务模式下拦的是「还没 PUT 成功的那几笔」，静态模式下拦的是「整份没导出的改动」
  window.addEventListener("beforeunload", (e) => {
    if (!hasUnsavedWork()) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

// =============================================================
//  相关文档 — 左上角 refs/ 清单（只读列表，点开走新标签页）
// =============================================================
const REFS_ENDPOINT = "/api/canvas/refs";
const REFS_DIR = "refs/";
const REFS_COLLAPSED_KEY = "proto-canvas:refs-collapsed:" + CANVAS_KEY;

const refsState = {
  files: [],
  collapsed: false,
};

function loadRefsCollapsed() {
  try { return localStorage.getItem(REFS_COLLAPSED_KEY) === "1"; } catch (e) { return false; }
}

function saveRefsCollapsed(collapsed) {
  try { localStorage.setItem(REFS_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch (e) {}
}

// 起了本地写服务就走实时端点：文档扔进 refs/ 刷新页面即可见，不必重跑画布生成。
// 静态托管把未知路径回成 200 + 一张 HTML 404 页是常事，所以 ok 之外还要 files 真是数组；
// 这两关任一不过就退回构建期落盘的 refs-index（file:// 下本来就只有这一条路）。
async function loadRefsIndex() {
  if (location.protocol !== "file:") {
    try {
      const r = await fetch(REFS_ENDPOINT, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        if (d && Array.isArray(d.files)) return d.files;
      }
    } catch (e) {}
  }
  try {
    const d = await loadDataFile("refs-index");
    return (d && Array.isArray(d.files)) ? d.files : [];
  } catch (e) { return []; }
}

function renderRefsPanel() {
  const panel = document.getElementById("refsPanel");
  if (!panel) return;
  const files = refsState.files;
  panel.hidden = files.length === 0;   // 一篇都没有时整块不占地方，左上角回到只有切换条
  if (!files.length) return;
  document.getElementById("refsCount").textContent = files.length;
  panel.classList.toggle("collapsed", refsState.collapsed);
  document.getElementById("refsToggle").setAttribute("aria-expanded", refsState.collapsed ? "false" : "true");
  document.getElementById("refsList").innerHTML = files.map(f => {
    const href = REFS_DIR + encodeURIComponent(f.file);
    return '<a class="refs-item" href="' + escapeHtml(href) + '" target="_blank" rel="noopener" title="' +
      escapeHtml(f.file) + '"><span class="refs-item-name">' + escapeHtml(f.title || f.file) +
      '</span><i class="fa-solid fa-arrow-up-right-from-square"></i></a>';
  }).join("");
}

function toggleRefsPanel() {
  refsState.collapsed = !refsState.collapsed;
  saveRefsCollapsed(refsState.collapsed);
  renderRefsPanel();
}

async function refreshRefs(btn) {
  const icon = btn ? btn.querySelector("i") : null;
  if (icon) icon.classList.add("fa-spin");
  refsState.files = await loadRefsIndex();
  if (icon) icon.classList.remove("fa-spin");
  renderRefsPanel();
}

function bindRefsPanel() {
  refsState.collapsed = loadRefsCollapsed();
  document.getElementById("refsToggle").addEventListener("click", toggleRefsPanel);
  document.getElementById("refsCaret").addEventListener("click", toggleRefsPanel);
  const refresh = document.getElementById("refsRefresh");
  refresh.addEventListener("click", () => refreshRefs(refresh));
  refreshRefs(null);   // 故意不 await：清单晚一步补上，不挡首屏
}

// =============================================================
//  PRD Drawer — 右侧需求文档分屏（纯查阅 + 下载，复用 renderMarkdown + renderMermaidIn）
// =============================================================
const PRD_INDEX_NAME = "dev-prd-index";
const PRD_DEV_PRD_DIR = "dev-prd/";
const PRD_WIDTH_KEY = "proto-canvas:prd-width:" + CANVAS_KEY;
const PRD_LAST_FILE_KEY = "proto-canvas:prd-last:" + CANVAS_KEY;
const PRD_TOC_KEY = "proto-canvas:prd-toc-collapsed:" + CANVAS_KEY;
// 目录列到二级为止：三级往下是段内细目，列出来反而淹没主结构
const PRD_TOC_LEVELS = "h1, h2";
// 分屏窄于此宽度时目录自动让位，与 canvas.css 的 @container 阈值同源
const PRD_TOC_MIN_WIDTH = 560;

const prdState = {
  files: [],
  currentFile: null,
  open: false,
  tocCollapsed: false,
  tocHeadings: [],
  tocActive: -1,
};

function loadPrdWidth() {
  try {
    const v = localStorage.getItem(PRD_WIDTH_KEY);
    if (v) document.documentElement.style.setProperty("--prd-drawer-w", v);
  } catch (e) {}
}

function savePrdWidth(width) {
  try { localStorage.setItem(PRD_WIDTH_KEY, width); } catch (e) {}
}

function loadPrdLastFile() {
  try { return localStorage.getItem(PRD_LAST_FILE_KEY); } catch (e) { return null; }
}

function savePrdLastFile(file) {
  try { localStorage.setItem(PRD_LAST_FILE_KEY, file); } catch (e) {}
}

function loadPrdTocCollapsed() {
  try { return localStorage.getItem(PRD_TOC_KEY) === "1"; } catch (e) { return false; }
}

function savePrdTocCollapsed(collapsed) {
  try { localStorage.setItem(PRD_TOC_KEY, collapsed ? "1" : "0"); } catch (e) {}
}

async function fetchPrdIndex() {
  try {
    return await loadDataFile(PRD_INDEX_NAME);
  } catch (e) { return null; }
}

// 正文和索引一样要过 file:// 这一关：fetch 那路走不通时退回 dev-prd/<文件名>.js 镜像。
// 镜像的 key 用站点内相对路径 dev-prd/<文件名>，与 loadMirror 拼 script src 的 name 同源。
async function loadPrdMarkdown(filename) {
  const name = PRD_DEV_PRD_DIR + filename;
  let reason = "";
  if (location.protocol !== "file:") {
    try {
      const r = await fetch(PRD_DEV_PRD_DIR + encodeURIComponent(filename), { cache: "no-store" });
      if (r.ok) return await r.text();
      reason = "HTTP " + r.status;
    } catch (e) { reason = (e && e.message) || String(e); }   // 退回镜像
  }
  const text = await loadMirror(name, reason);
  if (typeof text !== "string") throw new Error(name + ".js 里不是 markdown 文本");
  return text;
}

async function refreshPrdIndex() {
  const data = await fetchPrdIndex();
  prdState.files = (data && Array.isArray(data.files)) ? data.files : [];
  renderPrdPickerPanel();
  updatePrdLauncherEnabled();
  const last = loadPrdLastFile();
  const hit = prdState.files.find(f => f.file === last);
  const target = hit ? hit.file : (data && data.latest);
  if (target) {
    await selectPrdFile(target);
  } else {
    showPrdEmpty();
  }
}

function updatePrdLauncherEnabled() {
  const launcher = document.getElementById("prdLauncher");
  if (!prdState.files.length) {
    launcher.classList.add("disabled");
    launcher.title = "项目尚未生成研发交付 PRD";
  } else {
    launcher.classList.remove("disabled");
    launcher.title = prdState.open ? "收起需求文档分屏" : "展开需求文档分屏";
  }
}

function showPrdEmpty() {
  document.getElementById("prdEmpty").hidden = false;
  document.getElementById("prdContent").innerHTML = "";
  document.getElementById("prdPickerName").textContent = "无可用文档";
  document.getElementById("prdPickerVersion").textContent = "";
  document.getElementById("prdDrawerSub").textContent = "请先生成研发交付 PRD";
  prdState.currentFile = null;
  clearPrdToc();
}

async function selectPrdFile(filename) {
  const f = prdState.files.find(x => x.file === filename);
  if (!f) { showPrdEmpty(); return; }
  prdState.currentFile = filename;
  savePrdLastFile(filename);
  document.getElementById("prdEmpty").hidden = true;

  document.getElementById("prdPickerName").textContent = f.product || f.name || filename;
  document.getElementById("prdPickerVersion").textContent = f.version ? ("v" + f.version) : "";
  const mtime = f.mtimeIso ? new Date(f.mtimeIso) : null;
  document.getElementById("prdDrawerSub").textContent =
    f.file + (mtime ? " · 更新于 " + mtime.toLocaleString("zh-CN") : "");
  renderPrdPickerPanel();

  const content = document.getElementById("prdContent");
  content.innerHTML = '<div class="prd-empty"><i class="fa-solid fa-spinner fa-spin"></i><div class="prd-empty-title">加载中…</div></div>';
  clearPrdToc();
  try {
    const text = await loadPrdMarkdown(filename);
    let html = renderMarkdown(text);
    html = rewritePrdImagePaths(html);
    content.innerHTML = html;
    await renderMermaidIn(content);
    content.scrollTop = 0;
    buildPrdToc(content);
  } catch (err) {
    content.innerHTML = `<div class="prd-empty"><i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);"></i><div class="prd-empty-title">加载失败</div><div class="prd-empty-sub">${escapeHtml(err.message)}</div></div>`;
    clearPrdToc();
  }
}

// markdown 里相对路径 ![](xxx) / ![](./img/x.png) 需重写到 dev-prd/ 下；http(s) / data: / 根路径不动
function rewritePrdImagePaths(html) {
  return html.replace(/<img\s+([^>]*?)src="([^"]+)"/g, (m, pre, src) => {
    if (/^(https?:|data:|\/|dev-prd\/)/i.test(src)) return m;
    const clean = src.replace(/^\.\//, "");
    return `<img ${pre}src="${PRD_DEV_PRD_DIR}${clean}"`;
  });
}

// ---- PRD 目录（大纲）----
// 锚点 id 在这里就地补，不进 renderMarkdown()：那个函数注释预览也在用，
// 让它吐全局 id 会在画布里播撒重名锚点，副作用锁死在 PRD 分屏内更安全。
function buildPrdToc(content) {
  const toc = document.getElementById("prdToc");
  const list = document.createElement("div");
  list.className = "prd-toc-list";

  const heads = Array.from(content.querySelectorAll(PRD_TOC_LEVELS));
  prdState.tocHeadings = heads;
  prdState.tocActive = -1;

  if (!heads.length) {
    toc.innerHTML = '<div class="prd-toc-head">目录</div>'
      + '<div class="prd-toc-empty">这份文档没有一级 / 二级标题</div>';
    toc.hidden = false;
    syncPrdTocToggle();
    return;
  }

  heads.forEach((h, idx) => {
    h.id = "prd-h-" + idx;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "prd-toc-item lv" + (h.tagName === "H1" ? "1" : "2");
    item.dataset.idx = String(idx);
    item.textContent = h.textContent.trim();
    item.title = item.textContent;
    list.appendChild(item);
  });

  toc.innerHTML = '<div class="prd-toc-head">目录</div>';
  toc.appendChild(list);
  toc.hidden = false;
  toc.scrollTop = 0;

  list.addEventListener("click", (e) => {
    const item = e.target.closest(".prd-toc-item");
    if (!item) return;
    const idx = Number(item.dataset.idx);
    const target = prdState.tocHeadings[idx];
    if (!target) return;
    // scrollIntoView 会顺带滚动祖先，drawer 是 fixed 层，手算偏移更可控
    const top = content.scrollTop
      + target.getBoundingClientRect().top
      - content.getBoundingClientRect().top
      - 12;
    content.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    setPrdTocActive(idx);
  });

  updatePrdTocSpy();
  syncPrdTocToggle();
}

function clearPrdToc() {
  const toc = document.getElementById("prdToc");
  if (!toc) return;
  toc.innerHTML = "";
  toc.hidden = true;
  prdState.tocHeadings = [];
  prdState.tocActive = -1;
  syncPrdTocToggle();
}

function setPrdTocActive(idx) {
  if (idx === prdState.tocActive) return;
  prdState.tocActive = idx;
  const toc = document.getElementById("prdToc");
  toc.querySelectorAll(".prd-toc-item.active").forEach(el => el.classList.remove("active"));
  if (idx < 0) return;
  const item = toc.querySelector('.prd-toc-item[data-idx="' + idx + '"]');
  if (!item) return;
  item.classList.add("active");
  item.scrollIntoView({ block: "nearest" });
}

// 高亮「正文视口顶部之上最后一个标题」；一个都没越过时高亮第一条
function updatePrdTocSpy() {
  const heads = prdState.tocHeadings;
  if (!heads.length) return;
  const content = document.getElementById("prdContent");
  const top = content.getBoundingClientRect().top;
  let idx = 0;
  for (let i = 0; i < heads.length; i++) {
    if (heads[i].getBoundingClientRect().top - top <= 16) idx = i;
    else break;
  }
  setPrdTocActive(idx);
}

function bindPrdTocSpy() {
  const content = document.getElementById("prdContent");
  let queued = false;
  content.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      updatePrdTocSpy();
    });
  }, { passive: true });
}

// 目录有内容、分屏够宽，开关才可用；按钮亮色代表目录当前展开
function syncPrdTocToggle() {
  const btn = document.getElementById("prdTocToggle");
  if (!btn) return;
  const body = document.getElementById("prdDrawerBody");
  const hasToc = prdState.tocHeadings.length > 0
    || !document.getElementById("prdToc").hidden;
  const tooNarrow = body.clientWidth > 0 && body.clientWidth <= PRD_TOC_MIN_WIDTH;
  btn.disabled = !hasToc || tooNarrow;
  const shown = hasToc && !tooNarrow && !prdState.tocCollapsed;
  btn.classList.toggle("active", shown);
  btn.title = tooNarrow
    ? "分屏太窄，拖宽后可显示目录"
    : (prdState.tocCollapsed ? "展开目录" : "收起目录");
}

function applyPrdTocCollapsed() {
  document.getElementById("prdDrawerBody")
    .classList.toggle("toc-collapsed", prdState.tocCollapsed);
  syncPrdTocToggle();
}

function togglePrdToc() {
  prdState.tocCollapsed = !prdState.tocCollapsed;
  savePrdTocCollapsed(prdState.tocCollapsed);
  applyPrdTocCollapsed();
}

function renderPrdPickerPanel() {
  const panel = document.getElementById("prdPickerPanel");
  if (!prdState.files.length) {
    panel.innerHTML = '<div class="prd-empty-sub" style="padding:12px;">无可用文档</div>';
    return;
  }
  panel.innerHTML = prdState.files.map(f => {
    const active = f.file === prdState.currentFile ? " active" : "";
    const name = escapeHtml(f.product || f.name || f.file);
    const ver = f.version ? ("v" + f.version) : "";
    return `<div class="prd-picker-item${active}" data-file="${escapeHtml(f.file)}">`
      + `<span class="prd-picker-item-name">${name}</span>`
      + `<span class="prd-picker-item-version">${ver}</span></div>`;
  }).join("");
  panel.querySelectorAll(".prd-picker-item").forEach(el => {
    el.addEventListener("click", async () => {
      hidePrdPicker();
      await selectPrdFile(el.dataset.file);
    });
  });
}

function togglePrdPicker() {
  const panel = document.getElementById("prdPickerPanel");
  panel.hidden = !panel.hidden;
}
function hidePrdPicker() {
  document.getElementById("prdPickerPanel").hidden = true;
}

function openPrdDrawer() {
  prdState.open = true;
  document.getElementById("prdDrawer").classList.add("open");
  document.getElementById("prdLauncher").classList.add("with-drawer");
  updatePrdLauncherEnabled();
}
function closePrdDrawer() {
  prdState.open = false;
  document.getElementById("prdDrawer").classList.remove("open");
  document.getElementById("prdLauncher").classList.remove("with-drawer");
  hidePrdPicker();
  updatePrdLauncherEnabled();
}
function togglePrdDrawer() {
  if (prdState.open) closePrdDrawer();
  else openPrdDrawer();
}

function downloadCurrentPrd() {
  if (!prdState.currentFile) return;
  const a = document.createElement("a");
  a.href = PRD_DEV_PRD_DIR + encodeURIComponent(prdState.currentFile);
  a.download = prdState.currentFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function bindPrdResizer() {
  const drawer = document.getElementById("prdDrawer");
  const resizer = document.getElementById("prdResizer");
  let dragging = false;
  resizer.addEventListener("pointerdown", (e) => {
    dragging = true;
    drawer.classList.add("dragging");
    try { resizer.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  resizer.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const fromRight = window.innerWidth - e.clientX;
    const min = 320;
    const max = window.innerWidth * 0.65;
    const w = Math.max(min, Math.min(max, fromRight));
    document.documentElement.style.setProperty("--prd-drawer-w", w + "px");
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    drawer.classList.remove("dragging");
    const w = getComputedStyle(document.documentElement).getPropertyValue("--prd-drawer-w").trim();
    if (w) savePrdWidth(w);
  };
  resizer.addEventListener("pointerup", end);
  resizer.addEventListener("pointercancel", end);
}

// 暗色切换时让 PRD drawer 内 mermaid 跟随新主题：drawer 打开且当前有文档时，简单重渲当前文件。
async function rerenderPrdMermaidOnThemeChange() {
  if (!prdState.open || !prdState.currentFile) return;
  await selectPrdFile(prdState.currentFile);
}

function bindPrdPanel() {
  loadPrdWidth();
  bindPrdResizer();
  prdState.tocCollapsed = loadPrdTocCollapsed();
  applyPrdTocCollapsed();
  bindPrdTocSpy();
  document.getElementById("prdTocToggle").addEventListener("click", togglePrdToc);
  // 拖宽 / 拖窄分屏时目录的可用性跟着变，@container 负责藏，这里负责同步开关态
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => syncPrdTocToggle())
      .observe(document.getElementById("prdDrawerBody"));
  }
  document.getElementById("prdLauncher").addEventListener("click", togglePrdDrawer);
  document.getElementById("prdClose").addEventListener("click", closePrdDrawer);
  document.getElementById("prdRefresh").addEventListener("click", refreshPrdIndex);
  document.getElementById("prdDownload").addEventListener("click", downloadCurrentPrd);
  document.getElementById("prdPickerBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    togglePrdPicker();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#prdPickerPanel") && !e.target.closest("#prdPickerBtn")) {
      hidePrdPicker();
    }
  });
  refreshPrdIndex();
}

// =============================================================
//  Boot
// =============================================================
async function boot() {
  let data;
  try {
    // 与 probe 并行：serverMode 要在第一次落盘（下面的孤儿归位）之前定下来
    [data] = await Promise.all([loadInitialData(), probeServer()]);
  } catch (e) {
    showFatal((e && e.message) || String(e));
    return;
  }
  applyInitialData(data);
  renderModeSwitch(data.pages.demoEntry);
  // 站点默认视图：随 pages.json 分发，「发出去的这份长什么样」由构建方决定
  const viewDefaults = (data.pages && data.pages.viewDefaults) || {};
  state.theme = readTheme(viewDefaults.theme);
  applyTheme(state.theme);
  state.locked = viewDefaults.locked === true;
  orphanByMissingInstance();
  historyReset();               // 启动归一化不成为撤销步
  renderCanvas();
  state.zoom = computeInitialZoom();  // 必须在 applyZoom 前定,否则 sizer 按 1 倍算错
  applyZoom();
  // 初始视图:滚到内容左上角,四周留白藏在视口外,复刻原首屏位置
  const scroll = document.getElementById("canvasScroll");
  scroll.scrollLeft = CANVAS_PAD;
  scroll.scrollTop = CANVAS_PAD;
  bindZoom();
  bindIframeWheelRelay();
  bindCanvasClick();
  bindToolbar();
  bindGlobals();
  bindHistory();
  bindSpacePan();
  bindAltPeek();
  bindIframeAutoresize();
  bindViewPanel();
  refreshLayoutBadge();
  bindDockTools();
  buildShapePanels();
  bindShapePanels();
  syncShapeButtons();
  buildShapePicker();
  bindShapePicker();
  bindShapeCreate();
  bindShapeToolbar();
  bindCanvasImageInput();
  bindImportModal();
  bindPrdPanel();
  bindRefsPanel();
  refreshBadges();
  applyLocked();                // 等两条工具栏与 dock 都绑好再同步，站点默认锁定才有视觉
  rescueLegacyLocalStorage();   // 放最后：弹窗前先让画布正常渲染出来，用户才知道自己在哪
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// =============================================================
//  Picker 元素拾取工具：跨多个 iframe 累积选中元素，复制 selector-style prompt
//  独立于画布自带的「注释」系统（注释是给画布外壳贴位置标签的，与此并行）
// =============================================================
(function() {
  // ===== 桥接 script：注入到每个 iframe.contentDocument =====
  const BRIDGE_SOURCE = `(function(){
    if (window.__pickerBridge) return;
    window.__pickerBridge = true;
    const HL_ID = '__picker_hl__';
    let frameKey = null;
    try {
      const u = new URL(location.href);
      frameKey = (u.hash || '').replace(/^#/, '') || null;
      if (!frameKey) {
        const m = (location.search || '').match(/canvasFrame=([^&]+)/);
        if (m) frameKey = decodeURIComponent(m[1]);
      }
    } catch(e) {}

    function ensureHl() {
      let hl = document.getElementById(HL_ID);
      if (!hl) {
        hl = document.createElement('div');
        hl.id = HL_ID;
        hl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #F93838;background:rgba(249,56,56,0.08);transition:all .08s;display:none;box-sizing:border-box;border-radius:2px;';
        document.documentElement.appendChild(hl);
      }
      return hl;
    }

    function cssPath(el) {
      if (!(el instanceof Element)) return '';
      const parts = [];
      while (el && el.nodeType === 1 && parts.length < 6) {
        let seg = el.nodeName.toLowerCase();
        if (el.id) { seg += '#' + el.id; parts.unshift(seg); break; }
        if (el.className && typeof el.className === 'string') {
          const cls = el.className.trim().split(/\\s+/).filter(c => c && !c.startsWith('__picker')).slice(0, 2).join('.');
          if (cls) seg += '.' + cls;
        }
        const parent = el.parentNode;
        if (parent && parent.nodeType === 1) {
          const sib = Array.from(parent.children).filter(s => s.nodeName === el.nodeName);
          if (sib.length > 1) seg += ':nth-of-type(' + (sib.indexOf(el) + 1) + ')';
        }
        parts.unshift(seg);
        el = el.parentElement;
      }
      return parts.join(' > ');
    }

    function metaFor(el) {
      const r = el.getBoundingClientRect();
      const text = (el.innerText || el.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 80);
      let html = el.outerHTML || '';
      if (html.length > 240) html = html.slice(0, 240) + '...';
      return {
        frameKey: frameKey,
        tag: el.nodeName.toLowerCase(),
        selector: cssPath(el),
        text: text,
        html: html,
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
      };
    }

    function setHl(el) {
      const hl = ensureHl();
      if (!el) { hl.style.display = 'none'; return; }
      const r = el.getBoundingClientRect();
      hl.style.display = 'block';
      hl.style.left = r.left + 'px';
      hl.style.top = r.top + 'px';
      hl.style.width = r.width + 'px';
      hl.style.height = r.height + 'px';
    }

    let active = false;
    function onMove(e) {
      if (!active) return;
      const el = e.target;
      if (!el || el.id === HL_ID) return;
      setHl(el);
    }
    function onClick(e) {
      if (!active) return;
      const el = e.target;
      if (!el || el.id === HL_ID) return;
      e.preventDefault(); e.stopPropagation();
      try { parent.postMessage({ type: 'picker:select', payload: metaFor(el) }, '*'); } catch(err) {}
    }
    function onLeave() { if (active) setHl(null); }

    document.addEventListener('mouseover', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('mouseleave', onLeave, true);

    window.addEventListener('message', function(e) {
      const d = e.data || {};
      if (d.type === 'picker:setActive') {
        active = !!d.active;
        if (!active) setHl(null);
      }
    });

    try { parent.postMessage({ type: 'picker:bridgeReady', frameKey: frameKey }, '*'); } catch(e) {}
  })();`;

  // ===== 外壳 UI =====
  // 注意：toggle 按钮 #btnPicker 静态预置在底部 dock 里，这里只接管它即可
  const state = {
    active: false,
    items: [],
    seq: 0,
    injected: new WeakSet(),
  };

  const btn = document.getElementById('btnPicker');
  if (!btn) return;
  const $btnCount = document.getElementById('pickerCount');

  const panel = document.createElement('div');
  panel.className = 'picker-panel';
  panel.id = 'pickerPanel';
  panel.innerHTML = `
    <div class="picker-panel-head">
      <div class="picker-panel-title">选中元素</div>
      <span class="picker-panel-hint">在画布上点元素</span>
    </div>
    <div class="picker-panel-body" id="pickerBody">
      <div class="picker-empty">开启「选元素」模式后，<br>点击 iframe 内任意元素 →<br>会出现在这个列表里。<br><br>每条写指令，最后一次性复制。</div>
    </div>
    <div class="picker-panel-foot">
      <button class="picker-btn picker-btn-clear" id="pickerClear">清空</button>
      <button class="picker-btn picker-btn-copy" id="pickerCopy" disabled>
        <i class="fa-solid fa-copy"></i> 复制 Prompt
      </button>
    </div>
  `;
  document.body.appendChild(panel);

  const $body = panel.querySelector('#pickerBody');
  const $count = $btnCount;
  const $copy = panel.querySelector('#pickerCopy');
  const $clear = panel.querySelector('#pickerClear');

  function syncCount() {
    if (!$count) return;
    $count.textContent = state.items.length;
    $count.classList.toggle('muted', state.items.length === 0);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function render() {
    syncCount();
    $copy.disabled = state.items.length === 0;
    if (state.items.length === 0) {
      $body.innerHTML = '<div class="picker-empty">开启「选元素」模式后，<br>点击 iframe 内任意元素 →<br>会出现在这个列表里。<br><br>每条写指令，最后一次性复制。</div>';
      return;
    }
    $body.innerHTML = state.items.map((it, i) => `
      <div class="picker-item" data-id="${it.id}">
        <div class="picker-item-head">
          <div class="picker-item-num">${i + 1}</div>
          <div class="picker-item-meta">
            <span class="picker-item-frame">${escapeHtml(it.pageName || '?')} / ${escapeHtml(it.frameKey || '?')}</span>
            <div class="picker-item-tag">${escapeHtml(it.tag)} · ${escapeHtml(it.selector)}</div>
            <div class="picker-item-text">${escapeHtml(it.text || '(无文本)')}</div>
          </div>
          <button class="picker-item-del" data-del="${it.id}" title="删除">×</button>
        </div>
        <textarea class="picker-item-textarea" data-id="${it.id}" placeholder="给 AI 写指令…例如：这里间距太挤，加大到 16px">${escapeHtml(it.instruction || '')}</textarea>
      </div>
    `).join('');
  }

  $body.addEventListener('input', e => {
    const id = e.target.dataset.id;
    if (!id) return;
    const item = state.items.find(x => x.id === id);
    if (item) item.instruction = e.target.value;
  });

  $body.addEventListener('click', e => {
    const id = e.target.dataset.del;
    if (!id) return;
    state.items = state.items.filter(x => x.id !== id);
    render();
  });

  $clear.addEventListener('click', () => {
    if (state.items.length === 0) return;
    if (!confirm('清空所有选中？')) return;
    state.items = [];
    render();
  });

  $copy.addEventListener('click', () => {
    if (state.items.length === 0) return;
    const lines = ['Page: 画布原型评审', ''];
    state.items.forEach((it, i) => {
      lines.push(`${i + 1}. [${it.pageName || '?'} / ${it.frameKey || '?'}] ${it.tag}`);
      lines.push(`   selector: ${it.selector}`);
      if (it.text) lines.push(`   text: "${it.text}"`);
      if (it.html) lines.push(`   html: ${it.html}`);
      if (it.instruction) lines.push(`   instruction: ${it.instruction}`);
      lines.push('');
    });
    const text = lines.join('\n');

    const showCopied = () => {
      $copy.classList.add('copied');
      $copy.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
      setTimeout(() => {
        $copy.classList.remove('copied');
        $copy.innerHTML = '<i class="fa-solid fa-copy"></i> 复制 Prompt';
      }, 1500);
    };

    // 必须 focus + 在 viewport 内（fixed 偏移而非 left:-9999px）才能保证 execCommand('copy') 拿到选区
    const fallbackCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
      if (ok) showCopied();
      else {
        window.prompt('自动复制失败，请按 Cmd/Ctrl+C 手动复制：', text);
      }
    };

    // file:// 或非 secure context 下 navigator.clipboard 可能不存在；存在时也可能因失焦/权限 reject
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(showCopied).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  });

  // ===== iframe 注入（同源兜底路径）=====
  // 主路径是原型自带的 bootstrap 内置 bridge（patch_prototype.py 的 setupPicker）：file:// 下每个
  // 文件都是独立 origin，下面的 contentDocument 恒为 null，注入必然失败，picker 只能靠自带那份。
  // 本函数保留给 http:// 同源场景 + 尚未升到新版 bootstrap 的存量 HTML；两边靠 iframe 内的
  // window.__pickerBridge 去重，谁先到谁生效，不会重复绑事件。
  function injectBridge(iframe) {
    let doc;
    try { doc = iframe.contentDocument; } catch(_) { return false; }
    if (!doc) return false;
    // 文档尚未真正加载（about:blank / 仍在 loading）时不要注入，否则脚本会被随后到来的真正文档整页替换掉，但 WeakSet 已落点导致永远不会重试
    try {
      const href = doc.location && doc.location.href;
      if (!doc.body || href === 'about:blank' || doc.readyState === 'loading') return false;
    } catch(_) { return false; }
    if (state.injected.has(iframe)) return true;
    try {
      const s = doc.createElement('script');
      s.textContent = BRIDGE_SOURCE;
      (doc.body || doc.documentElement).appendChild(s);
      state.injected.add(iframe);
      try { iframe.contentWindow.postMessage({ type: 'picker:setActive', active: state.active }, '*'); } catch(e) {}
      return true;
    } catch(e) {
      return false;
    }
  }

  function broadcastActive() {
    document.querySelectorAll('iframe').forEach(f => {
      injectBridge(f);
      try { f.contentWindow.postMessage({ type: 'picker:setActive', active: state.active }, '*'); } catch(e) {}
    });
  }

  function setActive(on) {
    state.active = !!on;
    btn.classList.toggle('active', state.active);
    panel.classList.toggle('visible', state.active);
    // 指针权三态开关的一态：picking 态放开给 iframe，同时让 bindFrameDrag 短路，避免选元素模式下卡片被拖走
    document.body.classList.toggle('picking', state.active);
    if (state.active) {
      // 互斥：开启选元素时关掉「注释」模式（btnMark.click 会调 exitMarkMode）
      const btnMark = document.getElementById('btnMark');
      if (btnMark && btnMark.classList.contains('active')) btnMark.click();
      broadcastActive();
    } else {
      document.querySelectorAll('iframe').forEach(f => {
        try { f.contentWindow.postMessage({ type: 'picker:setActive', active: false }, '*'); } catch(e) {}
      });
    }
  }

  // 暴露给 toolbar.btnMark / btnLock 在开启它们时反向关掉本工具，避免两个模式同时生效
  window.__pickerDeactivate = () => setActive(false);

  btn.addEventListener('click', () => {
    // 开启前先把画布工具归位，否则图形工具与 picker 同时生效：点卡片进 iframe 拾取元素，
    // 点空白却画出一个图形。注意这里的 state 是本 IIFE 自己的，工具状态只能走 setTool。
    // 此刻 picker 本就关着，setTool 内部的 __pickerDeactivate 是空操作。
    if (!state.active) setTool('select');
    setActive(!state.active);
  });

  function attachIframeLoad(iframe) {
    iframe.addEventListener('load', () => {
      // 切页面会销毁旧 iframe DOM 但新 iframe 复用元素的边界场景下，旧注入标记会让 injectBridge 短路；load 触发即视为新文档，先清记录再重试
      state.injected.delete(iframe);
      if (state.active) injectBridge(iframe);
    });
  }

  const mo = new MutationObserver(muts => {
    for (const mut of muts) {
      for (const node of mut.addedNodes) {
        if (!node || node.nodeType !== 1) continue;
        if (node.tagName === 'IFRAME') attachIframeLoad(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('iframe').forEach(attachIframeLoad);
        }
      }
    }
    if (state.active) broadcastActive();
  });
  mo.observe(document.body, { childList: true, subtree: true });

  document.querySelectorAll('iframe').forEach(f => {
    attachIframeLoad(f);
  });

  window.addEventListener('message', e => {
    const d = e.data || {};
    if (d.type === 'picker:select' && d.payload) {
      let pageName = '';
      try {
        document.querySelectorAll('iframe').forEach(f => {
          if (f.contentWindow === e.source) {
            const card = f.closest('.frame-card, [data-page-name]');
            if (card) pageName = card.dataset.pageName || card.querySelector('.frame-title, .frame-label')?.textContent || '';
            if (!pageName) {
              const src = f.src || '';
              const m = src.match(/\/([^\/]+\.html)/);
              if (m) pageName = decodeURIComponent(m[1].replace(/\.html$/, ''));
            }
          }
        });
      } catch(err) {}
      const item = {
        id: 'p' + (++state.seq),
        pageName: pageName,
        ...d.payload,
        instruction: ''
      };
      state.items.push(item);
      render();
    }
  });

  render();
})();
