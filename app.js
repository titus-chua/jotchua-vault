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
    copy: document.getElementById("lb-copy"),
    prev: document.getElementById("lb-prev"),
    next: document.getElementById("lb-next"),
    close: document.getElementById("lb-close"),
    kwSide: document.getElementById("kw-side"),
    kwList: document.getElementById("kw-list"),
    kwFilter: document.getElementById("kw-filter"),
    kwClear: document.getElementById("kw-clear"),
    kwOpen: document.getElementById("kw-open"),
    kwClose: document.getElementById("kw-close"),
    kwMask: document.getElementById("kw-mask"),
  };

  const TYPES = ["all", "photo", "video", "sticker", "file", "audio"];
  const state = {
    query: "",
    type: "all",
    keyword: "",
    kwQuery: "",
    visible: catalog.slice(),
    index: -1,
  };

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

  function matches(item, parsed, typeFilter, keywordFilter) {
    const type = parsed.type || typeFilter;
    if (type && type !== "all" && item.type !== type) return false;
    if (parsed.author && !item.author.toLowerCase().includes(parsed.author)) return false;
    const tag = parsed.tag || keywordFilter;
    if (tag && !item.keywords.includes(tag)) return false;
    return parsed.terms.every((term) => item.haystack.includes(term));
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

  function telegramLabel(item) {
    if (item.type === "video") return "Watch on Telegram";
    if (item.type === "audio") return "Listen on Telegram";
    return "Open original in Telegram";
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
    els.kwClear.classList.toggle("hidden", !state.keyword);
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

  function previewHTML(item) {
    const href = esc(item.telegram);
    const label = esc(telegramLabel(item));
    if (item.type === "audio") {
      return `<a class="lb-preview audio" href="${href}" target="_blank" rel="noreferrer">
        <div class="placeholder">♪</div>
        <span class="play-icon" aria-hidden="true">▶</span>
        <span class="play-hint">${label}</span>
      </a>`;
    }
    const src = encodeURI(item.thumb);
    const extra = item.type === "video" ? " video" : "";
    return `<a class="lb-preview${extra}" href="${href}" target="_blank" rel="noreferrer">
      <img src="${src}" alt="">
      <span class="play-icon" aria-hidden="true">▶</span>
      <span class="play-hint">${label}</span>
    </a>`;
  }

  function openAt(index) {
    if (index < 0 || index >= state.visible.length) return;
    state.index = index;
    const item = state.visible[index];
    els.media.innerHTML = previewHTML(item);
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
    els.telegram.href = item.telegram;
    els.telegram.textContent = telegramLabel(item);
    els.lightbox.classList.remove("hidden");
    location.hash = String(item.id);
  }

  function closeLightbox() {
    state.index = -1;
    els.lightbox.classList.add("hidden");
    els.media.innerHTML = "";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.type !== "all") params.set("type", state.type);
    if (state.keyword) params.set("tag", state.keyword);
    const qs = params.toString();
    const hash =
      state.index >= 0
        ? String(state.visible[state.index].id)
        : location.hash.replace(/^#/, "");
    const next = `${location.pathname}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
    history.replaceState(null, "", next);
  }

  function openFromHash() {
    const id = Number(location.hash.replace(/^#/, ""));
    if (!id) return;
    const index = state.visible.findIndex((item) => item.id === id);
    if (index >= 0) openAt(index);
  }

  els.q.addEventListener("input", () => {
    state.query = els.q.value;
    filter();
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

  els.kwClear.addEventListener("click", () => setKeyword(""));
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
  els.copy.addEventListener("click", async () => {
    const item = state.visible[state.index];
    if (!item) return;
    await navigator.clipboard.writeText(item.telegram);
    els.copy.textContent = "Copied";
    setTimeout(() => {
      els.copy.textContent = "Copy Telegram link";
    }, 1200);
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
