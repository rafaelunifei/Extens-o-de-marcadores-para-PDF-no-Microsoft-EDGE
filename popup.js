'use strict';

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
let allBookmarks = [];
let searchTerm   = '';

// ---------------------------------------------------------------------------
// Acesso ao storage
// ---------------------------------------------------------------------------

async function loadBookmarks() {
  const result = await chrome.storage.local.get('bookmarks');
  return result.bookmarks || [];
}

async function saveBookmarks(list) {
  await chrome.storage.local.set({ bookmarks: list });
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch {
    return '';
  }
}

function highlight(text, term) {
  const escaped = escapeHtml(text);
  if (!term) return escaped;
  const re = new RegExp(`(${escapeRegex(term)})`, 'gi');
  return escaped.replace(re, '<mark>$1</mark>');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Renderização
// ---------------------------------------------------------------------------

function filterBookmarks(list, term) {
  if (!term) return list;
  const t = term.toLowerCase();
  return list.filter(b =>
    b.title.toLowerCase().includes(t) ||
    (b.pdfName || '').toLowerCase().includes(t) ||
    (b.selectedText || '').toLowerCase().includes(t)
  );
}

function groupByPdf(list) {
  const map = new Map();
  for (const b of list) {
    const key = b.pdfUrl || b.pdfName || '__unknown__';
    if (!map.has(key)) map.set(key, { pdfName: b.pdfName, items: [] });
    map.get(key).items.push(b);
  }
  for (const g of map.values()) {
    g.items.sort((a, b) => (Number(a.page) || 0) - (Number(b.page) || 0));
  }
  return new Map([...map.entries()].sort((a, b) =>
    (a[1].pdfName || '').localeCompare(b[1].pdfName || '', 'pt-BR', { sensitivity: 'base' })
  ));
}

function render() {
  const container = document.getElementById('list-container');
  const emptyMsg  = document.getElementById('empty-msg');
  const footer    = document.getElementById('footer-count');

  const filtered = filterBookmarks(allBookmarks, searchTerm);

  const total = allBookmarks.length;
  const shown = filtered.length;
  if (total === 0) {
    footer.textContent = '';
  } else if (searchTerm) {
    footer.textContent = `${shown} de ${total} marcador${total !== 1 ? 'es' : ''}`;
  } else {
    footer.textContent = `${total} marcador${total !== 1 ? 'es' : ''}`;
  }

  container.querySelectorAll('.bookmark-card, .group-header').forEach(el => el.remove());

  if (filtered.length === 0) {
    emptyMsg.hidden = false;
    if (allBookmarks.length === 0) {
      emptyMsg.innerHTML = 'Nenhum marcador ainda.<br>Abra um PDF no Edge, clique com o botão direito e escolha <strong>Adicionar marcador</strong>.';
    } else {
      emptyMsg.innerHTML = `Nenhum marcador corresponde a <strong>"${escapeHtml(searchTerm)}"</strong>.`;
    }
    return;
  }

  emptyMsg.hidden = true;

  const groups = groupByPdf(filtered);

  for (const [_url, group] of groups) {
    const header = document.createElement('div');
    header.className = 'group-header';
    header.title     = group.pdfName;
    header.textContent = group.pdfName;
    container.appendChild(header);

    for (const bookmark of group.items) {
      container.appendChild(buildCard(bookmark));
    }
  }
}

function buildCard(bookmark) {
  const card = document.createElement('div');
  card.className = 'bookmark-card';
  card.dataset.id = bookmark.id;

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className  = 'card-title';
  title.title      = bookmark.title;
  title.innerHTML  = highlight(bookmark.title, searchTerm);

  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const badgePage = document.createElement('span');
  badgePage.className   = 'badge-page';
  badgePage.textContent = bookmark.page ? `Pág. ${bookmark.page}` : 'Pág. —';

  const dateSpan = document.createElement('span');
  dateSpan.className   = 'card-date';
  dateSpan.textContent = formatDate(bookmark.createdAt);

  meta.append(badgePage, dateSpan);
  body.append(title, meta);

  if (bookmark.selectedText) {
    const excerpt = document.createElement('div');
    excerpt.className   = 'card-excerpt';
    excerpt.title       = bookmark.selectedText;
    excerpt.innerHTML   = highlight(bookmark.selectedText, searchTerm);
    body.appendChild(excerpt);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn edit';
  editBtn.title     = 'Editar marcador';
  editBtn.textContent = '✏️';

  const delBtn = document.createElement('button');
  delBtn.className = 'action-btn delete';
  delBtn.title     = 'Excluir marcador';
  delBtn.textContent = '🗑️';

  actions.append(editBtn, delBtn);
  card.append(body, actions);

  body.addEventListener('click', () => navigateToBookmark(bookmark));

  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditDialog(bookmark);
  });

  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteBookmark(bookmark.id);
  });

  return card;
}

// ---------------------------------------------------------------------------
// Navegação para o PDF
// ---------------------------------------------------------------------------

async function navigateToBookmark(bookmark) {
  if (!bookmark.pdfUrl) {
    alert(`Documento: ${bookmark.pdfName}\nPágina: ${bookmark.page || '—'}`);
    return;
  }

  const targetUrl = bookmark.page
    ? bookmark.pdfUrl.split('#')[0] + '#page=' + bookmark.page
    : bookmark.pdfUrl;

  const baseUrl = bookmark.pdfUrl.split('#')[0];
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find(t => t.url && t.url.split('#')[0] === baseUrl);

  if (existing) {
    await chrome.tabs.update(existing.id, { url: targetUrl, active: true });
    if (existing.windowId) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: targetUrl });
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

async function deleteBookmark(id) {
  if (!confirm('Excluir este marcador?')) return;
  const list = await loadBookmarks();
  const updated = list.filter(b => b.id !== id);
  await saveBookmarks(updated);
  allBookmarks = updated;
  render();
}

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------

function extractPdfNameSafe(tab) {
  if (!tab) return 'Documento PDF';
  if (tab.title) {
    const cleanTitle = tab.title.replace(/\s*-\s*Microsoft\s*Edge.*$/i, '').trim();
    if (cleanTitle.toLowerCase().endsWith('.pdf')) {
      return cleanTitle;
    }
  }
  if (tab.url) {
    const clean = tab.url.split('?')[0].split('#')[0];
    const last = decodeURIComponent(clean.split('/').pop() || '');
    if (last && last.toLowerCase() !== 'index.html') return last;
  }
  return tab.title || 'Documento PDF';
}

async function openAddDialog() {
  let pdfUrl  = '';
  let pdfName = '';
  let page    = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      pdfUrl  = tab.url || '';
      pdfName = extractPdfNameSafe(tab);
      if (tab.url && tab.url.includes('#page=')) {
        const match = tab.url.match(/#page=(\d+)/i);
        if (match) page = parseInt(match[1], 10);
      }
    }
  } catch { /* ok */ }

  const payload = {
    mode:             'add',
    selectedText:     '',
    selectionCaptured: false,
    pdfUrl,
    pdfName,
    page,
    pageAutoDetected: page !== null
  };

  await chrome.runtime.sendMessage({ type: 'open-add-dialog', payload });
}

function openEditDialog(bookmark) {
  const payload = {
    mode:             'edit',
    id:               bookmark.id,
    title:            bookmark.title,
    page:             bookmark.page ?? null,
    pageAutoDetected: false,
    selectedText:     bookmark.selectedText || '',
    selectionCaptured: Boolean(bookmark.selectedText),
    pdfUrl:           bookmark.pdfUrl,
    pdfName:          bookmark.pdfName
  };
  chrome.runtime.sendMessage({ type: 'open-edit-dialog', payload });
}

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------

async function init() {
  allBookmarks = await loadBookmarks();
  render();

  const searchInput = document.getElementById('search');
  const clearBtn    = document.getElementById('btn-clear-search');

  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim();
    clearBtn.hidden = !searchTerm;
    render();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchTerm = '';
    clearBtn.hidden = true;
    render();
  });

  document.getElementById('btn-add').addEventListener('click', openAddDialog);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.bookmarks) {
      allBookmarks = changes.bookmarks.newValue || [];
      render();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
