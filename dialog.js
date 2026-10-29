'use strict';

let payload = null;

async function loadBookmarks() {
  const r = await chrome.storage.local.get('bookmarks');
  return r.bookmarks || [];
}

async function saveBookmarks(list) {
  await chrome.storage.local.set({ bookmarks: list });
}

async function init() {
  const session = await chrome.storage.session.get('dialogPayload');
  payload = session.dialogPayload || null;

  if (!payload) {
    window.close();
    return;
  }

  await chrome.storage.session.remove('dialogPayload');

  const isEdit = payload.mode === 'edit';

  // Cabeçalho
  document.getElementById('dialog-header').textContent =
    isEdit ? 'EDITAR MARCADOR' : 'NOVO MARCADOR';

  // Título
  const titleInput = document.getElementById('f-title');
  if (isEdit) {
    titleInput.value = payload.title || '';
  }
  titleInput.focus();
  if (isEdit) titleInput.select();

  // Arquivo (somente leitura)
  const valArquivo = document.getElementById('val-arquivo');
  valArquivo.textContent = payload.pdfName || 'Documento PDF';
  valArquivo.title       = payload.pdfUrl  || '';

  // Página
  const valPagina     = document.getElementById('val-pagina');
  const pageInputWrap = document.getElementById('page-input-wrap');
  const pageInput     = document.getElementById('f-page');

  if (isEdit) {
    // No modo de edição, permite ajustar a página
    pageInputWrap.hidden = false;
    valPagina.hidden     = true;
    pageInput.value      = payload.page ?? '';
  } else if (payload.pageAutoDetected && payload.page) {
    // Detectada automaticamente: somente leitura
    valPagina.textContent = payload.page;
    valPagina.hidden      = false;
    pageInputWrap.hidden  = true;
  } else {
    // Não detectada: fallback simples para digitação
    valPagina.hidden     = true;
    pageInputWrap.hidden = false;
    pageInput.value      = '';
  }

  // Trecho
  const valTrecho = document.getElementById('val-trecho');
  if (payload.selectionCaptured && payload.selectedText) {
    valTrecho.textContent = `"${payload.selectedText}"`;
    valTrecho.classList.remove('unavailable');
    valTrecho.title = payload.selectedText;
  } else {
    valTrecho.textContent = 'Não disponível através do visualizador PDF nativo do Edge.';
    valTrecho.classList.add('unavailable');
    valTrecho.title = '';
  }

  // Eventos
  document.getElementById('btn-cancel').addEventListener('click', () => window.close());
  document.getElementById('bookmark-form').addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();

  const titleInput = document.getElementById('f-title');
  const errTitle   = document.getElementById('err-title');
  const title      = titleInput.value.trim();

  if (!title) {
    titleInput.classList.add('invalid');
    errTitle.hidden = false;
    titleInput.focus();
    return;
  }
  titleInput.classList.remove('invalid');
  errTitle.hidden = true;

  // Página
  let page = null;
  const pageInputWrap = document.getElementById('page-input-wrap');

  if (!pageInputWrap.hidden) {
    const raw = document.getElementById('f-page').value.trim();
    if (raw) {
      const n = parseInt(raw, 10);
      page = (Number.isFinite(n) && n >= 1) ? n : null;
    }
  } else {
    page = payload.page ?? null;
  }

  const list = await loadBookmarks();

  if (payload.mode === 'edit') {
    const idx = list.findIndex(b => b.id === payload.id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        title,
        page,
        updatedAt: new Date().toISOString()
      };
    }
  } else {
    // Cada marcador possui id único (UUID).
    // Múltiplos marcadores podem existir na mesma página sem conflito.
    const newBookmark = {
      id:           crypto.randomUUID(),
      title,
      pdfName:      payload.pdfName || 'Documento PDF',
      pdfUrl:       payload.pdfUrl  || '',
      page:         page,
      selectedText: payload.selectedText || '',
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString()
    };
    list.push(newBookmark);
  }

  await saveBookmarks(list);
  window.close();
}

document.addEventListener('DOMContentLoaded', init);
