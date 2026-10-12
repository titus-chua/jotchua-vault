(() => {
  function uniqueKeywords(list) {
    const seen = new Set();
    const out = [];
    for (const raw of list || []) {
      const tag = String(raw).trim().toLowerCase();
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
    }
    return out;
  }

  const catalog = (window.CATALOG || []).map((item) => {
    const extra = window.KEYWORDS?.[String(item.id)] || window.KEYWORDS?.[item.id] || [];
    const keywords = uniqueKeywords([...(item.keywords || []), ...extra]);
    return {
      ...item,
      keywords,
      haystack: `${item.search || ""} ${keywords.join(" ")}`.toLowerCase(),
    };
  });

  const els = {
    q: document.getElementById("q"),
    filters: document.getElementById("filters"),
    status: document.getElementById("status"),
    grid: document.getElementById("grid"),
    empty: document.getElementById("empty"),
    lightbox: document.getElementById("lightbox"),
    media: document.getElementById("lb-media"),
    title: document.getElementById("lb-title"),
    sub: document.getElementById("lb-sub"),
    caption: document.getElementById("lb-caption"),
    tags: document.getElementById("lb-tags"),
    telegram: document.getElementById("lb-telegram"),
    download: document.getElementById("lb-download"),
    copy: document.getElementById("lb-copy"),
    prev: document.getElementById("lb-prev"),
    next: document.getElementById("lb-next"),
    close: document.getElementById("lb-close"),
    kwSide: document.getElementById("kw-side"),
    kwList: document.getElementById("kw-list"),
    kwFilter: document.getElementById("kw-filter"),
    kwFilterClear: document.getElementById("kw-filter-clear"),
    qClear: document.getElementById("q-clear"),
    kwOpen: document.getElementById("kw-open"),
    kwClose: document.getElementById("kw-close"),
    kwMask: document.getElementById("kw-mask"),
    logo: document.getElementById("logo"),
  };

  const TYPES = ["all", "photo", "video", "sticker", "file", "audio"];
  const state = {
    query: "",
    type: "all",
    keyword: "",
    kwQuery: "",
    visible: catalog.slice(),
    index: -1,
    mediaGen: 0,
    copyTimer: 0,
  };

  const IMAGE_TYPES = new Set(["photo", "sticker"]);
  const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseQuery(raw) {
    const out = { type: null, author: null, terms: [] };
    for (const token of raw.match(/"[^"]+"|\S+/g) || []) {
      const lower = token.toLowerCase();
      if (lower.startsWith("type:")) out.type = lower.slice(5);
      else if (lower.startsWith("author:")) out.author = lower.slice(7);
      else if (lower.startsWith("tag:")) out.tag = lower.slice(4);
      else out.terms.push(lower.replace(/^"|"$/g, ""));
    }
    return out;
  }

  function termHits(term, haystack) {
    const parts = term.split(/[^a-z0-9]+/).filter(Boolean);
    if (!parts.length) return true;
    const tokens = haystack.split(/[^a-z0-9]+/).filter(Boolean);
    return parts.every((part) =>
      tokens.some((token) => token === part || token.startsWith(part))
    );
  }

  function matches(item, parsed, typeFilter, keywordFilter) {
    const type = parsed.type || typeFilter;
    if (type && type !== "all" && item.type !== type) return false;
    if (parsed.author && !item.author.toLowerCase().includes(parsed.author)) return false;
    const tag = parsed.tag || keywordFilter;
    if (tag && !item.keywords.includes(tag)) return false;
    return parsed.terms.every((term) => termHits(term, item.haystack));
  }

  function filter() {
    const parsed = parseQuery(state.query.trim());
    state.visible = catalog.filter((item) =>
      matches(item, parsed, state.type, state.keyword)
    );
    render();
    syncUrl();
  }

  function typeCounts() {
    const parsed = parseQuery(state.query.trim());
    const out = { all: 0 };
    for (const item of catalog) {
      if (!matches(item, parsed, "all", state.keyword)) continue;
      out.all += 1;
      out[item.type] = (out[item.type] || 0) + 1;
    }
    return out;
  }

  function keywordCounts() {
    const parsed = parseQuery(state.query.trim());
    const out = {};
    for (const item of catalog) {
      if (!matches(item, parsed, state.type, "")) continue;
      for (const tag of item.keywords) out[tag] = (out[tag] || 0) + 1;
    }
    return out;
  }

  function badge(item) {
    if (item.type === "video") return item.duration ? `video ${item.duration}` : "video";
    return item.type;
  }

  function mediaUrl(item) {
    if (!item?.src) return "";
    return new URL(item.src, location.href).href;
  }

  function isCopyableImage(item) {
    if (!item?.src) return false;
    if (item.type === "video" || item.type === "audio" || item.type === "file") return false;
    return IMAGE_TYPES.has(item.type) || IMAGE_EXT.test(item.src) || IMAGE_EXT.test(item.filename || "");
  }

  function resetCopyLabel() {
    if (state.copyTimer) {
      clearTimeout(state.copyTimer);
      state.copyTimer = 0;
    }
    if (els.copy) els.copy.textContent = "Copy";
  }

  function stopMedia() {
    state.mediaGen += 1;
    for (const player of els.media.querySelectorAll("video, audio")) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      player.removeAttribute("src");
      for (const source of player.querySelectorAll("source")) source.remove();
      try {
        player.load();
      } catch {
        /* ignore */
      }
    }
    for (const img of els.media.querySelectorAll("img")) {
      img.onload = null;
      img.onerror = null;
      img.removeAttribute("src");
    }
    els.media.innerHTML = "";
  }

  function renderFilters() {
    const c = typeCounts();
    els.filters.innerHTML = TYPES.filter((type) => type === "all" || c[type])
      .map((type) => {
        const n = c[type] || 0;
        const active = state.type === type ? " active" : "";
        return `<button type="button" class="chip${active}" data-type="${type}">${esc(type)} ${n}</button>`;
      })
      .join("");
  }

  function renderKeywords() {
    const counts = keywordCounts();
    const typed = state.kwQuery.trim().toLowerCase();
    const needle = state.keyword && typed === state.keyword ? "" : typed;
    const rows = Object.entries(counts)
      .filter(([tag]) => !needle || tag.includes(needle))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    els.kwList.innerHTML = rows
      .map(([tag, n]) => {
        const active = state.keyword === tag ? " active" : "";
        return `<button type="button" class="kw-item${active}" data-kw="${esc(tag)}" role="option" aria-selected="${state.keyword === tag}">
          <span>${esc(tag)}</span><span class="n">${n}</span>
        </button>`;
      })
      .join("");
    if (els.kwOpen) {
      els.kwOpen.textContent = state.keyword ? `Keywords · ${state.keyword}` : "Keywords";
      els.kwOpen.classList.toggle("active", Boolean(state.keyword));
    }
  }

  function renderGrid() {
    const html = state.visible
      .map((item, i) => {
        const src = encodeURI(item.thumb);
        const play =
          item.type === "video" || item.type === "audio"
            ? `<span class="play" aria-hidden="true">▶</span>`
            : "";
        const img =
          item.type === "audio"
            ? `<div class="placeholder" aria-hidden="true">♪</div>`
            : `<img src="${src}" alt="" loading="lazy" decoding="async">`;
        return `<button type="button" class="card" data-type="${esc(item.type)}" data-i="${i}" title="${esc(item.author)} · #${item.id}">
          ${img}
          ${play}
          <span class="badge">${esc(badge(item))}</span>
        </button>`;
      })
      .join("");
    els.grid.innerHTML = html;
    els.empty.classList.toggle("hidden", state.visible.length > 0);
    const tagged = catalog.filter((item) => item.keywords.length).length;
    els.status.textContent = `${state.visible.length.toLocaleString()} shown · ${catalog.length.toLocaleString()} total · ${tagged} tagged`;
  }

  function render() {
    renderFilters();
    renderKeywords();
    renderGrid();
  }

  function setKeyword(tag) {
    if (!tag || state.keyword === tag) {
      state.keyword = "";
      state.kwQuery = "";
      els.kwFilter.value = "";
    } else {
      state.keyword = tag;
      state.kwQuery = tag;
      els.kwFilter.value = tag;
    }
    closeKwDrawer();
    filter();
  }

  function openKwDrawer() {
    els.kwSide.classList.add("open");
    els.kwMask.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeKwDrawer() {
    els.kwSide.classList.remove("open");
    els.kwMask.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function markStage(stage, gen, status) {
    if (gen !== state.mediaGen || !stage.isConnected) return;
    stage.classList.remove("loading", "ready", "error");
    stage.classList.add(status);
  }

  function bindStage(stage, gen, eventName) {
    const media = stage.querySelector("img.lb-full, video, audio");
    if (!media) {
      markStage(stage, gen, "ready");
      return;
    }
    const ok = () => markStage(stage, gen, "ready");
    const err = () => markStage(stage, gen, "error");
    media.addEventListener(eventName, ok, { once: true });
    media.addEventListener("error", err, { once: true });
    if (eventName === "load" && media.complete && media.naturalWidth) ok();
    if (eventName === "canplay" && media.readyState >= 3) ok();
  }

  function mediaHTML(item) {
    const thumb = encodeURI(item.thumb || "");
    const src = item.src ? encodeURI(item.src) : "";
    const name = esc(item.filename || `${item.id}`);
    if (item.type === "audio") {
      return `<div class="lb-stage audio loading">
        <div class="placeholder" aria-hidden="true">♪</div>
        ${src ? `<audio controls preload="auto" src="${src}"></audio>` : ""}
        <p class="lb-loading">Loading audio…</p>
        <p class="lb-error">Can't play here. Download or open in Telegram.</p>
      </div>`;
    }
    if (item.type === "video") {
      return `<div class="lb-stage video loading">
        <video controls playsinline webkit-playsinline preload="auto" poster="${thumb}"${src ? ` src="${src}"` : ""}></video>
        <p class="lb-loading">Loading video…</p>
        <p class="lb-error">Can't play here. Download or open in Telegram.</p>
      </div>`;
    }
    if (item.type === "file" || !src) {
      return `<div class="lb-stage file ready">
        ${item.thumb ? `<img class="lb-poster" src="${thumb}" alt="">` : `<div class="placeholder" aria-hidden="true">📄</div>`}
        <button type="button" class="lb-file" data-download>${name}</button>
      </div>`;
    }
    return `<div class="lb-stage image loading">
      <img class="lb-poster" src="${thumb}" alt="" decoding="async">
      <img class="lb-full" src="${src}" alt="" decoding="async">
      <p class="lb-loading">Loading full image…</p>
      <p class="lb-error">Can't show the full file here. Download or open in Telegram.</p>
    </div>`;
  }

  let lockedScrollY = 0;
  let pageLocked = false;

  function lockPage() {
    if (pageLocked) return;
    lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.paddingRight = gap > 0 ? `${gap}px` : "";
    document.documentElement.classList.add("lb-open");
    pageLocked = true;
  }

  function unlockPage() {
    if (!pageLocked) return;
    const y = lockedScrollY;
    document.documentElement.classList.remove("lb-open");
    document.body.style.top = "";
    document.body.style.paddingRight = "";
    pageLocked = false;
    window.scrollTo(0, y);
  }

  function scrollablePopup(target) {
    let el = target instanceof Element ? target : null;
    while (el && els.lightbox.contains(el)) {
      const style = getComputedStyle(el);
      const canScroll = style.overflowY === "auto" || style.overflowY === "scroll";
      if (canScroll && el.scrollHeight > el.clientHeight + 1) return el;
      el = el.parentElement;
    }
    return null;
  }

  function atScrollEdge(el, deltaY) {
    if (deltaY < 0 && el.scrollTop <= 0) return true;
    if (deltaY > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return true;
    return false;
  }

  function openAt(index) {
    if (index < 0 || index >= state.visible.length) return;
    stopMedia();
    resetCopyLabel();
    state.index = index;
    const gen = state.mediaGen;
    const item = state.visible[index];
    els.media.innerHTML = mediaHTML(item);
    const stage = els.media.querySelector(".lb-stage");
    if (stage) {
      if (item.type === "video" || item.type === "audio") bindStage(stage, gen, "canplay");
      else if (item.type === "file" || !item.src) markStage(stage, gen, "ready");
      else bindStage(stage, gen, "load");
    }
    els.title.textContent = `${item.type} #${item.id}`;
    els.sub.textContent = [item.author, item.dateLabel].filter(Boolean).join(" · ");
    els.caption.textContent = item.caption || "";
    if (item.keywords.length) {
      els.tags.innerHTML = item.keywords
        .map((tag) => `<button type="button" class="tag" data-kw="${esc(tag)}">${esc(tag)}</button>`)
        .join("");
    } else {
      els.tags.innerHTML = `<span class="tag placeholder">none yet</span>`;
    }
    const url = mediaUrl(item);
    if (els.download) {
      els.download.href = url || item.telegram;
      els.download.setAttribute("download", item.filename || String(item.id));
      if (url) els.download.removeAttribute("target");
      else {
        els.download.target = "_blank";
        els.download.removeAttribute("download");
      }
    }
    els.telegram.href = item.telegram;
    els.telegram.textContent = "Open in Telegram";
    els.lightbox.classList.remove("hidden");
    els.lightbox.querySelectorAll(".lb-card, .lb-meta, .lb-copy").forEach((el) => {
      el.scrollTop = 0;
    });
    lockPage();
    syncUrl();
  }

  function closeLightbox() {
    stopMedia();
    resetCopyLabel();
    state.index = -1;
    els.lightbox.classList.add("hidden");
    unlockPage();
    syncUrl({ dropHash: true });
  }

  function triggerDownload() {
    if (els.download) els.download.click();
  }

  async function toPngBlob(blob) {
    if (blob.type === "image/png") return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return new Promise((resolve, reject) => {
      canvas.toBlob((out) => (out ? resolve(out) : reject(new Error("toBlob"))), "image/png");
    });
  }

  async function copyImage(item) {
    const url = mediaUrl(item);
    const blobPromise = fetch(url).then((res) => {
      if (!res.ok) throw new Error("fetch");
      return res.blob();
    });
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": blobPromise.then(toPngBlob),
      }),
    ]);
  }

  async function copyLink(item) {
    const url = mediaUrl(item) || item.telegram;
    await navigator.clipboard.writeText(url);
  }

  function syncUrl(options) {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.type !== "all") params.set("type", state.type);
    if (state.keyword) params.set("tag", state.keyword);
    const qs = params.toString();
    let hash = "";
    if (!options?.dropHash) {
      if (state.index >= 0 && state.visible[state.index]) hash = String(state.visible[state.index].id);
      else hash = location.hash.replace(/^#/, "");
    }
    const next = `${location.pathname}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
    history.replaceState(null, "", next);
  }

  function restoreSearchFields() {
    if (els.q.value !== state.query) els.q.value = state.query;
    if (els.kwFilter.value !== state.kwQuery) els.kwFilter.value = state.kwQuery;
  }

  function openFromHash() {
    const id = Number(location.hash.replace(/^#/, ""));
    if (!id) return;
    const index = state.visible.findIndex((item) => item.id === id);
    if (index >= 0) openAt(index);
  }

  els.logo.addEventListener("click", () => {
    if (location.search || location.hash) {
      location.assign(location.pathname);
      return;
    }
    state.kwQuery = "";
    els.kwFilter.value = "";
    renderKeywords();
    closeKwDrawer();
    window.scrollTo(0, 0);
  });

  function clearInput(input) {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  els.qClear.addEventListener("pointerdown", () => {
    els.qClear.dataset.keepFocus = document.activeElement === els.q ? "1" : "";
  });
  els.qClear.addEventListener("click", () => {
    const keepFocus = els.qClear.dataset.keepFocus === "1";
    delete els.qClear.dataset.keepFocus;
    clearInput(els.q);
    if (keepFocus) els.q.focus();
  });
  els.kwFilterClear.addEventListener("pointerdown", () => {
    els.kwFilterClear.dataset.keepFocus = document.activeElement === els.kwFilter ? "1" : "";
  });
  els.kwFilterClear.addEventListener("click", () => {
    const keepFocus = els.kwFilterClear.dataset.keepFocus === "1";
    delete els.kwFilterClear.dataset.keepFocus;
    clearInput(els.kwFilter);
    if (keepFocus) els.kwFilter.focus();
  });

  els.q.addEventListener("input", () => {
    state.query = els.q.value;
    filter();
  });
  els.q.addEventListener("focus", restoreSearchFields);
  els.kwFilter.addEventListener("focus", restoreSearchFields);
  window.addEventListener("pageshow", () => {
    restoreSearchFields();
    setTimeout(restoreSearchFields, 0);
  });

  els.filters.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-type]");
    if (!btn) return;
    state.type = btn.dataset.type;
    filter();
  });

  els.kwList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-kw]");
    if (!btn) return;
    setKeyword(btn.dataset.kw);
  });

  els.kwFilter.addEventListener("input", () => {
    state.kwQuery = els.kwFilter.value;
    const typed = state.kwQuery.trim().toLowerCase();
    if (state.keyword && typed !== state.keyword) {
      state.keyword = "";
      filter();
      return;
    }
    renderKeywords();
  });

  els.kwOpen.addEventListener("click", openKwDrawer);
  els.kwClose.addEventListener("click", closeKwDrawer);
  els.kwMask.addEventListener("click", closeKwDrawer);

  els.grid.addEventListener("click", (event) => {
    const card = event.target.closest(".card");
    if (!card) return;
    openAt(Number(card.dataset.i));
  });

  els.tags.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-kw]");
    if (!btn) return;
    closeLightbox();
    setKeyword(btn.dataset.kw);
  });

  els.close.addEventListener("click", closeLightbox);
  els.prev.addEventListener("click", () => openAt(state.index - 1));
  els.next.addEventListener("click", () => openAt(state.index + 1));
  els.lightbox.addEventListener("click", (event) => {
    if (event.target === els.lightbox) closeLightbox();
  });
  let popupTouchY = 0;
  let swipe = null;

  function arrowsHidden() {
    return getComputedStyle(els.prev).display === "none";
  }

  els.lightbox.addEventListener("touchstart", (event) => {
    if (event.touches.length) popupTouchY = event.touches[0].clientY;
  }, { passive: true });
  els.lightbox.addEventListener("touchmove", (event) => {
    if (!pageLocked || !event.touches.length) return;
    const y = event.touches[0].clientY;
    const delta = popupTouchY - y;
    popupTouchY = y;
    const scroller = scrollablePopup(event.target);
    if (!scroller || atScrollEdge(scroller, delta)) event.preventDefault();
  }, { passive: false });
  els.lightbox.addEventListener("pointerdown", (event) => {
    if (!pageLocked || !event.isPrimary || !arrowsHidden()) {
      swipe = null;
      return;
    }
    swipe = { x: event.clientX, y: event.clientY, axis: "", id: event.pointerId };
  });
  els.lightbox.addEventListener("pointermove", (event) => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (!swipe.axis && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      swipe.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
    }
    if (swipe.axis === "x") event.preventDefault();
  });
  els.lightbox.addEventListener("pointerup", (event) => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    const axis = swipe.axis;
    swipe = null;
    if (axis !== "x" || Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    openAt(state.index + (dx < 0 ? 1 : -1));
  });
  els.lightbox.addEventListener("pointercancel", () => {
    swipe = null;
  });
  els.lightbox.addEventListener("wheel", (event) => {
    if (!pageLocked) return;
    const scroller = scrollablePopup(event.target);
    if (!scroller || atScrollEdge(scroller, event.deltaY)) event.preventDefault();
  }, { passive: false });
  els.media.addEventListener("click", (event) => {
    if (!event.target.closest("[data-download]")) return;
    triggerDownload();
  });

  els.copy.addEventListener("click", async () => {
    const item = state.visible[state.index];
    if (!item) return;
    let label = "Copy";
    try {
      if (isCopyableImage(item) && window.ClipboardItem && navigator.clipboard?.write) {
        try {
          await copyImage(item);
          label = "Copied";
        } catch {
          await copyLink(item);
          label = "Copied link";
        }
      } else if (navigator.clipboard?.writeText) {
        await copyLink(item);
        label = "Copied link";
      } else {
        triggerDownload();
        label = "Downloading";
      }
    } catch {
      triggerDownload();
      label = "Downloading";
    }
    resetCopyLabel();
    els.copy.textContent = label;
    state.copyTimer = setTimeout(() => {
      if (els.copy) els.copy.textContent = "Copy";
      state.copyTimer = 0;
    }, 1400);
  });

  document.addEventListener("keydown", (event) => {
    if (els.lightbox.classList.contains("hidden")) {
      if (event.key === "/" && document.activeElement !== els.q && document.activeElement !== els.kwFilter) {
        event.preventDefault();
        els.q.focus();
      }
      if (event.key === "Escape") closeKwDrawer();
      return;
    }
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") openAt(state.index - 1);
    if (event.key === "ArrowRight") openAt(state.index + 1);
  });

  const params = new URLSearchParams(location.search);
  state.query = params.get("q") || "";
  state.type = params.get("type") || "all";
  state.keyword = (params.get("tag") || "").toLowerCase();
  state.kwQuery = state.keyword;
  els.q.value = state.query;
  els.kwFilter.value = state.keyword;
  filter();
  openFromHash();
})();
