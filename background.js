'use strict';

// ---------------------------------------------------------------------------
// Resolução Robusta da Identidade do PDF
// ---------------------------------------------------------------------------

/**
 * Extrai URL, nome do arquivo e página de forma confiável a partir dos
 * objetos tab e info do Edge/Chromium.
 *
 * Garante que "index.html" NUNCA seja adotado como nome do PDF.
 */
function resolvePdfInfo(tab, info) {
  const candidates = [
    tab?.url,
    info?.frameUrl,
    info?.pageUrl
  ].filter(Boolean);

  let realPdfUrl = '';
  let realPdfName = '';

  for (const raw of candidates) {
    // 1. URL direta terminando em .pdf (sem ser o wrapper da extensão interna)
    const clean = raw.split('?')[0].split('#')[0];
    const isInternal = clean.startsWith('chrome-extension://') || clean.startsWith('edge-extension://');

    if (clean.toLowerCase().endsWith('.pdf') && !isInternal) {
      realPdfUrl = clean;
      const parts = clean.split('/');
      realPdfName = decodeURIComponent(parts[parts.length - 1] || '');
      break;
    }

    // 2. URL wrapper do visualizador interno: chrome-extension://.../index.html?file:///...
    if (raw.includes('?')) {
      const queryPart = raw.slice(raw.indexOf('?') + 1).split('#')[0];
      let potentialUrl = queryPart;

      try {
        const params = new URLSearchParams(queryPart);
        if (params.get('file')) potentialUrl = params.get('file');
        else if (params.get('src')) potentialUrl = params.get('src');
      } catch {}

      try { potentialUrl = decodeURIComponent(potentialUrl); } catch {}
      const cleanPotential = potentialUrl.split('?')[0].split('#')[0];

      if (cleanPotential.toLowerCase().endsWith('.pdf')) {
        realPdfUrl = cleanPotential;
        const parts = cleanPotential.split('/');
        realPdfName = decodeURIComponent(parts[parts.length - 1] || '');
        break;
      }
    }
  }

  // 3. Fallback seguro usando o título da aba
  // No Microsoft Edge, tab.title em abas de PDF é o nome exato do arquivo (ex: "Ogata.pdf")
  if (!realPdfName || realPdfName.toLowerCase() === 'index.html') {
    if (tab?.title) {
      const cleanTitle = tab.title.replace(/\s*-\s*Microsoft\s*Edge.*$/i, '').trim();
      if (cleanTitle.toLowerCase().endsWith('.pdf')) {
        realPdfName = cleanTitle;
        if (!realPdfUrl || realPdfUrl.includes('index.html')) {
          realPdfUrl = (tab?.url && !tab.url.includes('index.html')) ? tab.url : cleanTitle;
        }
      }
    }
  }

  // 4. Último recurso se ainda for index.html ou vazio
  if (!realPdfName || realPdfName.toLowerCase() === 'index.html') {
    realPdfName = (tab?.title && tab.title.toLowerCase() !== 'index.html')
      ? tab.title.replace(/\s*-\s*Microsoft\s*Edge.*$/i, '').trim()
      : 'Documento PDF';
  }

  // 5. Verificação de #page=N explícito na URL
  let page = null;
  for (const raw of candidates) {
    if (raw && raw.includes('#')) {
      const hashPart = raw.slice(raw.indexOf('#') + 1);
      const match = hashPart.match(/(?:^|&)page=(\d+)/i);
      if (match) {
        const p = parseInt(match[1], 10);
        if (p >= 1) {
          page = p;
          break;
        }
      }
    }
  }

  return {
    pdfUrl: realPdfUrl || tab?.url || '',
    pdfName: realPdfName,
    page
  };
}

// ---------------------------------------------------------------------------
// Menu de Contexto
// ---------------------------------------------------------------------------

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'pdf-add-bookmark',
      title: '📌 Adicionar marcador',
      contexts: ['selection', 'page']
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

// ---------------------------------------------------------------------------
// Clique no Menu de Contexto
// ---------------------------------------------------------------------------

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'pdf-add-bookmark') return;

  // Busca o estado mais atualizado da aba
  let currentTab = tab;
  if (tab?.id) {
    try {
      currentTab = await chrome.tabs.get(tab.id);
    } catch {
      currentTab = tab;
    }
  }

  const resolved = resolvePdfInfo(currentTab, info);
  const selectedText = (info.selectionText || '').trim();

  const payload = {
    mode: 'add',
    selectedText: selectedText,
    selectionCaptured: selectedText.length > 0,
    pdfUrl: resolved.pdfUrl,
    pdfName: resolved.pdfName,
    page: resolved.page,
    pageAutoDetected: resolved.page !== null
  };

  await chrome.storage.session.set({ dialogPayload: payload });
  openDialog();
});

// ---------------------------------------------------------------------------
// Abertura do Diálogo
// ---------------------------------------------------------------------------

function openDialog() {
  chrome.windows.create({
    url: chrome.runtime.getURL('dialog.html'),
    type: 'popup',
    width: 440,
    height: 420,
    focused: true
  });
}

// ---------------------------------------------------------------------------
// Comunicação interna com o popup
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'open-add-dialog' || message.type === 'open-edit-dialog') {
    chrome.storage.session.set({ dialogPayload: message.payload }).then(() => {
      openDialog();
      sendResponse({ ok: true });
    });
    return true;
  }
});
