// Preview Renderer: builds HTML from template metadata.editor.content for preview/PDF
// Exposes window.PreviewRenderer with two main methods:
// - buildContainer(template): returns a DOM element containing the rendered document
// - buildHTML(template): returns a complete HTML string (doctype, head, body)

(function () {
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
        return `<h1 style="${style}">${block.content || ''}</h1>`;
      case 'subtitle':
        return `<h2 style="${style}">${block.content || ''}</h2>`;
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
    const includeTitle = options.includeTitle !== false;
    const container = document.createElement('div');
    container.className = 'preview-document';
    container.style.maxWidth = '800px';
    container.style.margin = '0 auto';
    container.style.padding = '20px';
    container.style.fontFamily = 'Arial, sans-serif';

    if (includeTitle) {
      const title = document.createElement('h1');
      title.textContent = template?.name || 'Untitled Document';
      container.appendChild(title);
    }

    const blocks = normalizeBlocks(
      template?.metadata?.editor?.content || template?.metadata?.content || template?.content || []
    );
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

  window.PreviewRenderer = { buildContainer, buildHTML };
})();
