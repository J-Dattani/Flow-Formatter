// Preview Renderer: builds HTML from template metadata.editor.content for preview/PDF
// Exposes window.PreviewRenderer with two main methods:
// - buildContainer(template): returns a DOM element containing the rendered document
// - buildHTML(template): returns a complete HTML string (doctype, head, body)

(function () {
  // Page CSS for A4 sizing and print-friendly breaks
  const STYLE_TAG_ID = 'preview-renderer-a4-style';
  function ensureGlobalStyles() {
    if (document.getElementById(STYLE_TAG_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_TAG_ID;
    style.textContent = `
  @page { size: A4; margin: 12mm; }
  /* Inline width will override this, kept for print previews */
  .preview-document { min-height: 297mm; margin: 0 auto; background: #fff; color: #000; box-sizing: border-box; }
  /* Typography & wrapping: avoid breaking words mid-character */
  .preview-document, .preview-document * { word-break: normal; overflow-wrap: break-word; white-space: normal; hyphens: auto; }
  .preview-document p { line-height: 1.6; margin: 0 0 12px 0; }
  .preview-document h1 { font-size: 24px; line-height: 1.3; margin: 16px 0 10px; }
  .preview-document h2 { font-size: 18px; line-height: 1.35; margin: 14px 0 8px; }
  .preview-document img { max-width: 100%; height: auto; }
  .preview-document table { width: 100%; border-collapse: collapse; }
  .preview-document table td, .preview-document table th { word-break: normal; overflow-wrap: break-word; }
      .content-block { page-break-inside: avoid; }
  /* Page break markers recognized by html2pdf; eliminate any spacing so next page begins at top */
  .page-break { display: block; break-before: page; page-break-before: always; height: 0; margin: 0 !important; padding: 0; border: 0; line-height: 0; }
  .html2pdf__page-break { display: block; break-before: page; page-break-before: always; height: 0; margin: 0 !important; padding: 0; border: 0; line-height: 0; }
  /* Remove top margin from the first element after a page break so content starts at top of the new page */
  .page-break + .content-block > *:first-child,
  .html2pdf__page-break + .content-block > *:first-child { margin-top: 0 !important; }
  /* Also ensure wrapper itself has no top spacing after break */
  .page-break + .content-block,
  .html2pdf__page-break + .content-block { margin-top: 0 !important; padding-top: 0 !important; }
  /* Extra safety: zero top margin for common first elements after break */
  .page-break + .content-block h1:first-child,
  .page-break + .content-block h2:first-child,
  .page-break + .content-block p:first-child,
  .html2pdf__page-break + .content-block h1:first-child,
  .html2pdf__page-break + .content-block h2:first-child,
  .html2pdf__page-break + .content-block p:first-child { margin-top: 0 !important; }
  /* Use break-after on TOC block instead of a separate breaker to avoid phantom gaps */
  .toc-block { break-after: page; page-break-after: always; margin-bottom: 0 !important; }
  .toc-block + .content-block { margin-top: 0 !important; padding-top: 0 !important; }
  .toc-block + .content-block > *:first-child,
  .toc-block + .content-block h1:first-child,
  .toc-block + .content-block h2:first-child,
  .toc-block + .content-block p:first-child { margin-top: 0 !important; }
      /* TOC styling similar to editor */
      .toc-list { display: block; }
      .toc-line { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; column-gap: 8px; }
      .toc-title { white-space: nowrap; }
      .toc-leader { border-bottom: 1px dotted #999; height: 0.9em; transform: translateY(0.2em); }
      .toc-page { white-space: nowrap; }
    `;
    document.head.appendChild(style);
  }
  function propertiesToStyle(props = {}) {
    if (!props || typeof props !== 'object') return '';
    return Object.entries(props)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => {
        // Ensure CSS property names are kebab-case where needed
        const kebab = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        return `${kebab}: ${v}`;
      })
      .join('; ');
  }

  function normalizeBlocks(blocks) {
    if (!Array.isArray(blocks)) return [];
    return blocks.map((b, i) => {
      const type = b?.type || 'paragraph';
      let content = b?.content;
      if (content && typeof content === 'object' && content.text) {
        content = content.text;
      }
      const properties = (b && typeof b.properties === 'object') ? b.properties : {};
      return { id: b?.id || `block_${i + 1}`, type, content, properties };
    });
  }

  function renderBlock(block) {
    const style = propertiesToStyle(block.properties);
    switch (block.type) {
      case 'title':
        return `<h1 data-level="1" style="${style}">${block.content || ''}</h1>`;
      case 'subtitle':
        return `<h2 data-level="2" style="${style}">${block.content || ''}</h2>`;
      case 'paragraph':
        return `<p style="${style}">${block.content || ''}</p>`;
      case 'image':
        return `<img src="${block.content || ''}" style="${style}" alt="${block.properties?.alt || 'Image'}">`;
      case 'quote':
        return `<blockquote style="border-left: 4px solid #6C63FF; padding-left: 16px; margin: 16px 0; font-style: italic; ${style}">${block.content || ''}</blockquote>`;
      case 'divider':
        return `<hr style="border: none; border-top: 2px solid #dee2e6; margin: 20px 0; ${style}">`;
      case 'pagebreak':
        return `<div style="page-break-after: always; border-top: 1px dashed #ccc; margin: 20px 0; padding: 10px; text-align: center; color: #666; ${style}">Page Break</div>`;
      case 'textfield':
        return `<div style="margin: 15px 0;"><label style="display:block;font-weight:bold;margin-bottom:5px;">${block.properties?.label || 'Text Field'}</label><input type="text" placeholder="${block.properties?.placeholder || ''}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px; ${style}" ${block.properties?.required ? 'required' : ''}></div>`;
      case 'textarea':
        return `<div style="margin: 15px 0;"><label style="display:block;font-weight:bold;margin-bottom:5px;">${block.properties?.label || 'Text Area'}</label><textarea placeholder="${block.properties?.placeholder || ''}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;min-height:100px; ${style}" ${block.properties?.required ? 'required' : ''}></textarea></div>`;
      case 'signature':
        return `<div style="margin: 15px 0;"><label style="display:block;font-weight:bold;margin-bottom:5px;">Signature</label><div style="width:100%;height:80px;border:2px dashed #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#666; ${style}"><span>✍️ Signature Area</span></div></div>`;
      case 'checkbox':
        return `<div style="margin: 15px 0; ${style}"><label style="display:flex;align-items:center;cursor:pointer;"><input type="checkbox" style="margin-right:8px;" ${block.properties?.checked ? 'checked' : ''}><span>${block.content || 'Checkbox Option'}</span></label></div>`;
      case 'dropdown': {
        const opts = Array.isArray(block.content) ? block.content : [];
        const options = [`<option value="">${block.properties?.placeholder || 'Select an option...'}</option>`]
          .concat(opts.map(o => `<option value="${String(o)}">${String(o)}</option>`))
          .join('');
        return `<div style="margin:15px 0;"><label style="display:block;font-weight:bold;margin-bottom:5px;">${block.properties?.label || 'Dropdown Field'}</label><select style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px; ${style}">${options}</select></div>`;
      }
      case 'table': {
        let html = `<table style="width:100%;border-collapse:collapse;margin:15px 0; ${style}">`;
        if (Array.isArray(block.content)) {
          block.content.forEach((row, rowIndex) => {
            html += '<tr>';
            if (Array.isArray(row)) {
              row.forEach(cell => {
                const tag = rowIndex === 0 ? 'th' : 'td';
                html += `<${tag} style="border:1px solid #dee2e6;padding:8px;${rowIndex === 0 ? 'background:#f8f9fa;font-weight:bold;' : ''}">${cell}</${tag}>`;
              });
            }
            html += '</tr>';
          });
        }
        html += '</table>';
        return html;
      }
      default:
        return `<div style="${style}">${block.content || ''}</div>`;
    }
  }

  function buildContainer(template, options = {}) {
    ensureGlobalStyles();
  const includeTitle = options.includeTitle !== false;
    const container = document.createElement('div');
    container.className = 'preview-document';
  // Use fixed pixel width equivalent of A4 at ~96dpi for html2canvas stability
  container.style.width = '794px';
  container.style.margin = '0 auto';
  container.style.padding = '0';
    container.style.fontFamily = 'Arial, sans-serif';

    if (includeTitle) {
      const title = document.createElement('h1');
      title.textContent = template?.name || 'Untitled Document';
      container.appendChild(title);
    }

    let blocks = normalizeBlocks(
      template?.metadata?.editor?.content || template?.metadata?.content || template?.content || []
    );

    // Derive a Table of Contents from heading blocks (title h1 and subtitle h2)
    const headings = [];
    blocks.forEach((b) => {
      if (b.type === 'title' || b.type === 'subtitle') {
        const label = String(b.content || '').trim();
        if (label) headings.push({ label, level: b.type === 'title' ? 1 : 2 });
      }
    });

    // If we have at least one heading, build a TOC at the top
    if (headings.length) {
  const tocEl = document.createElement('div');
  tocEl.className = 'content-block toc-block';
      // Simple page numbers placeholder; actual pagination depends on renderer
      const tocLines = headings.map((h, idx) => {
        const left = h.label;
        // Demo page numbers: 2 + idx*2 to give increasing numbers
        const page = 2 + (idx * 2);
        return `<span class="toc-line"><span class="toc-title">${left}</span><span class="toc-leader"></span><span class="toc-page">${page}</span></span>`;
      }).join('<br>');
      tocEl.innerHTML = `
        <h2 style="margin:0 0 8px 0; text-align:center; font-weight:700;">Table of Contents</h2>
        <p class="toc-list">${tocLines}</p>
        <hr style="border: none; border-top: 2px solid #dee2e6; margin: 12px 0;">
      `;
    container.appendChild(tocEl);
    }
    blocks.forEach(b => {
      const wrapper = document.createElement('div');
      wrapper.className = 'content-block';
      wrapper.style.marginBottom = '20px';
      wrapper.innerHTML = renderBlock(b);
      container.appendChild(wrapper);
    });
    return container;
  }

  function buildHTML(template, options = {}) {
    const container = buildContainer(template, options);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${(template?.name || 'Document')} - Preview</title></head><body>${container.outerHTML}</body></html>`;
  }

  function prepareForPdf(container, opts = {}) {
    // Insert page breaks before headings/subheadings that would otherwise be orphaned at page ends
    if (!container || !container.querySelector) return false;

    // Ensure the container is attached so measurements are correct
    let tempWrapper = null;
    const wasDetached = !document.body.contains(container);
    if (wasDetached) {
      tempWrapper = document.createElement('div');
      tempWrapper.style.cssText = 'position:fixed; left:-10000px; top:0; width:794px; z-index:-1; visibility:hidden;';
      tempWrapper.appendChild(container);
      document.body.appendChild(tempWrapper);
    }

    const pageHeightPx = opts.pageHeightPx || Math.round(297 / 25.4 * 96); // ~1122px at 96dpi CSS px
    const headings = container.querySelectorAll('h1, h2');
    const containerRect = container.getBoundingClientRect();
    headings.forEach(h => {
      // Skip adding a break if there's already an enforced break immediately before this heading
      const block = h.closest('.content-block');
      const prev = block ? block.previousElementSibling : h.previousElementSibling;
      if (prev && (prev.classList?.contains('page-break') || prev.classList?.contains('html2pdf__page-break') || prev.classList?.contains('toc-block'))) {
        return; // already starting a new page
      }
      const rect = h.getBoundingClientRect();
      const relTop = (rect.top - containerRect.top); // in CSS px
      const posInPage = ((relTop % pageHeightPx) + pageHeightPx) % pageHeightPx;
      const minKeep = Math.max(rect.height + 60, h.tagName === 'H1' ? 140 : 100); // px threshold
      const remaining = pageHeightPx - posInPage;
      if (remaining < minKeep) {
        const breaker = document.createElement('div');
        breaker.className = 'page-break html2pdf__page-break';
        h.parentElement?.insertBefore(breaker, h);
      }
    });
    // Detach if we attached temporarily
    if (wasDetached && tempWrapper) {
      document.body.removeChild(tempWrapper);
    }
    return true;
  }

  window.PreviewRenderer = { buildContainer, buildHTML, prepareForPdf };
})();
