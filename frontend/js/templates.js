/**
 * Template Management Logic
 * Handles CRUD operations for templates
 */

document.addEventListener('DOMContentLoaded', function() {
    loadTemplates();
    initializeTemplateHandlers();

    // Wire search/filter if grid is present
    const grid = document.getElementById('templatesGrid');
    if (grid) {
        const searchInput = document.getElementById('templateSearch');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => applyGridFilters(), 250));
        }
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
                tag.classList.add('active');
                applyGridFilters();
            });
        });
    }
});

/**
 * Initialize event handlers
 */
function initializeTemplateHandlers() {
    const saveBtn = document.getElementById('saveTemplateBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', handleCreateTemplate);
    }
}

/**
 * Generate form link for a template
 */
async function generateFormLink(templateId, templateName) {
    const baseUrl = window.location.origin + window.location.pathname.replace('/admin/templates.html', '');
    let formUrl = `${baseUrl}/form.html?template=${templateId}&name=${encodeURIComponent(templateName)}`;

    // Try to embed a compact copy of the template JSON so the public form can render without DB access
    try {
        const res = await TemplateAPI.getById(templateId);
        if (res && res.success && res.data) {
            const tpl = res.data;
            const minimal = {
                id: tpl.id,
                name: tpl.name,
                description: tpl.description || '',
                metadata: tpl.metadata || {}
            };
            const json = JSON.stringify(minimal);
            const b64 = btoa(unescape(encodeURIComponent(json)))
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,''); // URL-safe base64
            formUrl += `&tpl=${b64}`;
        }
    } catch (_) { /* ignore embed errors */ }

    // Show modal with form link
    try {
        await navigator.clipboard.writeText(formUrl);
        showNotification('Form URL copied to clipboard.', 'success');
    } catch (_) { /* clipboard may be blocked */ }

    try {
        showFormLinkModal(formUrl, templateName);
    } catch (e) {
        console.warn('Failed to open modal, fallback to prompt.', e);
        const ok = window.confirm('Copy this form URL?\n\n' + formUrl);
        if (ok) {
            try { await navigator.clipboard.writeText(formUrl); } catch (_) {}
        }
    }
}

/**
 * Show form link modal
 */
function showFormLinkModal(formUrl, templateName) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Form Link Generated</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Share this link with users to fill out the <strong>${templateName}</strong> form:</p>
                    <div class="mb-3">
                        <label class="form-label">Form URL:</label>
                        <div class="input-group">
                            <input type="text" class="form-control" value="${formUrl}" readonly id="formUrlInput">
                            <button class="btn btn-outline-secondary" onclick="copyFormUrl()">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Users can access this form to generate documents based on your template design.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <a href="${formUrl}" class="btn btn-primary" target="_blank">
                        <i class="fas fa-external-link-alt me-2"></i>Open Form
                    </a>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();

    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
}

/**
 * Copy form URL to clipboard
 */
function copyFormUrl() {
    const input = document.getElementById('formUrlInput');
    input.select();
    document.execCommand('copy');
    
    // Show success notification
    showNotification('Form URL copied to clipboard!', 'success');
}

/**
 * Import template
 */
function importTemplate() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const templateData = JSON.parse(e.target.result);
                    console.log('Imported template:', templateData);
                    showNotification('Template imported successfully!', 'success');
                    // Redirect to advanced template editor with imported data
                    window.location.href = `template-editor-advanced.html?import=${encodeURIComponent(JSON.stringify(templateData))}`;
                } catch (error) {
                    showNotification('Invalid template file format.', 'danger');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

/**
 * Load all templates
 */
async function loadTemplates() {
    const tableBody = document.getElementById('templatesTable');
    const grid = document.getElementById('templatesGrid');
    // If neither exists, nothing to do
    if (!tableBody && !grid) return;

    try {
        const result = await TemplateAPI.getAll();
        const list = (result && result.success && Array.isArray(result.data)) ? result.data : [];
        window.__templatesCache = list; // cache for search/filter

        if (grid) {
            renderTemplatesGrid(list);
        }
        if (tableBody) {
            displayTemplates(list);
        }
    } catch (error) {
        console.error('Error loading templates:', error);
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading templates</td></tr>';
        }
        if (grid) {
            grid.insertAdjacentHTML('beforeend', '<div class="col-12 text-center text-danger">Error loading templates</div>');
        }
    }
}

/**
 * Display templates in table
 */
function displayTemplates(templates) {
    const tableBody = document.getElementById('templatesTable');
    if (!tableBody) return;
    
    if (templates.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No templates found</td></tr>';
        return;
    }

    tableBody.innerHTML = templates.map(t => {
        const meta = t.metadata || {};
        const typography = meta.typography || {};
        const fontFamily = typography.fontFamily || '-';
        const fontSize = typography.fontSize || '-';
        const isPublished = (meta.status === 'published');
        const status = isPublished ? 'Active' : 'Draft';
        const idAttr = `'${String(t.id)}'`; // quote UUIDs safely
        return `
        <tr>
            <td><strong>${escapeHtml(t.name)}</strong></td>
            <td><span class="badge ${getCategoryBadgeClass(t.category)}">${escapeHtml(t.category || 'Other')}</span></td>
            <td>${escapeHtml(fontFamily)}</td>
            <td>${escapeHtml(fontSize)}</td>
            <td><span class="badge ${isPublished ? 'bg-success' : 'bg-secondary'}">${escapeHtml(status)}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editTemplate(${idAttr})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="viewTemplate(${idAttr})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate(${idAttr})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

/**
 * Get badge class based on category
 */
function getCategoryBadgeClass(category) {
    const badgeMap = {
        'Report': 'bg-primary text-white',
        'Resume': 'bg-success text-white',
        'Academic': 'bg-warning text-dark',
        'Letter': 'bg-info text-white',
        'Other': 'bg-secondary text-white'
    };
    return badgeMap[category] || 'bg-secondary text-white';
}

/**
 * Handle create template form submission
 */
async function handleCreateTemplate() {
    const form = document.getElementById('createTemplateForm');
    if (!form || !form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Collect form data
    const formData = new FormData(form);
    const templateData = {
        name: formData.get('name'),
        category: formData.get('category'),
        typography: {
            fontFamily: formData.get('fontFamily'),
            fontSize: formData.get('fontSize'),
            lineSpacing: formData.get('lineSpacing')
        },
        margins: {
            top: formData.get('marginTop'),
            bottom: formData.get('marginBottom'),
            left: formData.get('marginLeft'),
            right: formData.get('marginRight')
        },
        options: {
            includeHeader: formData.get('includeHeader') === 'on',
            includeFooter: formData.get('includeFooter') === 'on',
            includeTOC: formData.get('includeTOC') === 'on',
            includePageNumbers: formData.get('includePageNumbers') === 'on'
        }
    };
    
    // Show loading state
    const saveBtn = document.getElementById('saveTemplateBtn');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';
    
    try {
        const result = await TemplateAPI.create(templateData);
        
        if (result.success) {
            // Close modal
            const modalElement = document.getElementById('createTemplateModal');
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();
            
            // Reset form
            form.reset();
            
            // Show success message
            showAlert('Template created successfully!', 'success');
            
            // Reload templates
            await loadTemplates();
        } else {
            showAlert(result.error || 'Failed to create template', 'danger');
        }
    } catch (error) {
        console.error('Error creating template:', error);
        
        // For prototype: simulate success
        console.log('Template data ready for backend:', templateData);
        
        const modalElement = document.getElementById('createTemplateModal');
        const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
        modal.hide();
        
        form.reset();
        showAlert('Template created successfully! (Prototype Mode)', 'success');
        
        // Reload templates
        await loadTemplates();
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}

/**
 * Edit template
 */
async function editTemplate(id) {
    console.log('Edit template:', id);
    // Redirect to advanced template editor with template ID
    window.location.href = `template-editor-advanced.html?id=${encodeURIComponent(String(id))}`;
}

/**
 * View template
 */
async function viewTemplate(id) {
    console.log('View template:', id);
    showAlert('View functionality will be implemented with backend integration', 'info');
    // TODO: Implement view modal
}

/**
 * Delete template
 */
async function deleteTemplate(id) {
    if (!confirm('Are you sure you want to delete this template?')) {
        return;
    }
    
    try {
        const result = await TemplateAPI.delete(id);
        
        if (result.success) {
            showAlert('Template deleted successfully!', 'success');
            await loadTemplates();
        } else {
            showAlert(result.error || 'Failed to delete template', 'danger');
        }
    } catch (error) {
        console.error('Error deleting template:', error);
        showAlert('Failed to delete template. Please try again.', 'danger');
    }
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3" style="z-index: 9999;" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', alertHtml);
    
    // Auto dismiss after 3 seconds
    setTimeout(() => {
        const alert = document.querySelector('.alert');
        if (alert) {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }
    }, 3000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = (text === null || text === undefined) ? '' : String(text);
    return div.innerHTML || '';
}

/**
 * Duplicate template
 */
async function duplicateTemplate(id) {
    try {
        showAlert('Creating duplicate template...', 'info');
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // In a real app, this would call the API
        showAlert(`Template ${id} duplicated successfully!`, 'success');
        
        // Reload templates to show the new duplicate
        setTimeout(() => {
            loadTemplates();
        }, 1500);
    } catch (error) {
        console.error('Error duplicating template:', error);
        showAlert('Error duplicating template. Please try again.', 'danger');
    }
}

/**
 * Archive template
 */
async function archiveTemplate(id) {
    if (!confirm('Are you sure you want to archive this template? It will no longer be available for new documents.')) {
        return;
    }
    
    try {
        showAlert('Archiving template...', 'info');
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        showAlert(`Template ${id} archived successfully!`, 'success');
        
        // Reload templates to reflect changes
        setTimeout(() => {
            loadTemplates();
        }, 1500);
    } catch (error) {
        console.error('Error archiving template:', error);
        showAlert('Error archiving template. Please try again.', 'danger');
    }
}

/**
 * Export template
 */
async function exportTemplate(id) {
    try {
        showAlert('Preparing PDF export...', 'info');

        // Load full template using the same API path as Edit
        const res = await TemplateAPI.getById(id);
        const tpl = (res && res.success && res.data) ? res.data : {
            id,
            name: `Template_${id}`,
            description: '',
            category: 'general',
            metadata: { editor: { content: [] } },
            version: 1
        };

        // Ensure PreviewRenderer is available (dynamic load if needed)
        async function ensurePreviewRenderer() {
            if (window.PreviewRenderer) return;
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = '../js/preview-renderer.js';
                s.onload = resolve;
                s.onerror = () => reject(new Error('Failed to load preview renderer'));
                document.head.appendChild(s);
            });
        }
        await ensurePreviewRenderer();

        // Build a hidden container using shared PreviewRenderer
    const container = window.PreviewRenderer.buildContainer(tpl, { includeTitle: false });
    const host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.left = '-99999px';
        host.style.top = '0';
        host.style.width = '800px';
        host.appendChild(container);
        document.body.appendChild(host);

        // Ensure html2pdf is present; load dynamically if missing
        async function ensureHtml2Pdf() {
            if (window.html2pdf) return;
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                s.onload = resolve;
                s.onerror = () => reject(new Error('Failed to load html2pdf'));
                document.head.appendChild(s);
            });
        }
        await ensureHtml2Pdf();

    const filename = `${(tpl.name || 'template').toString().replace(/\s+/g, '_')}_${id}.pdf`;
    const target = container.querySelector('.preview-document') || container;

        // Use html2pdf to export the container to PDF
        try {
            // Prepare DOM for better pagination (avoid orphan headings)
            if (window.PreviewRenderer && typeof window.PreviewRenderer.prepareForPdf === 'function') {
                try { window.PreviewRenderer.prepareForPdf(target); } catch (_) {}
            }
            await window.html2pdf()
                .set({
                    margin: [10, 10, 10, 10],
                    filename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'] }
                })
                .from(target)
                .save();
            showAlert('PDF exported successfully.', 'success');
        } catch (pdfErr) {
            console.warn('PDF export failed, falling back to HTML download:', pdfErr);
            // Fallback: download HTML so the user still gets an export
            const html = window.PreviewRenderer.buildHTML(tpl, { includeTitle: false });
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.replace(/\.pdf$/i, '.html');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showAlert('Exported as HTML (PDF fallback).', 'warning');
        } finally {
            // Cleanup temp host regardless of result
            if (host && host.parentNode) {
                document.body.removeChild(host);
            }
        }
    } catch (error) {
        console.error('Error exporting template as PDF:', error);
        showAlert('Error exporting template. Please try again.', 'danger');
    }
}

/**
 * View submissions for template
 */
async function viewSubmissions(id) {
    try {
        showAlert('Loading submissions...', 'info');
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Redirect to submissions page with filter
        window.location.href = `submissions.html?template=${id}`;
    } catch (error) {
        console.error('Error loading submissions:', error);
        showAlert('Error loading submissions. Please try again.', 'danger');
    }
}

/**
 * Publish template
 */
async function publishTemplate(id) {
    if (!confirm('Are you sure you want to publish this template? It will become available for all users.')) {
        return;
    }
    
    try {
        showAlert('Publishing template...', 'info');
        const res = await TemplateAPI.getById(id);
        if (!res.success) throw new Error(res.error || 'Failed to load template');
        const tpl = res.data;
        const metadata = { ...(tpl.metadata || {}), status: 'published', published_at: new Date().toISOString() };
        const saveRes = await TemplateAPI.save({ ...tpl, metadata });
        if (!saveRes.success) throw new Error(saveRes.error || 'Failed to publish');
        showAlert('Template published successfully!', 'success');
        await loadTemplates();
    } catch (error) {
        console.error('Error publishing template:', error);
        showAlert('Error publishing template. Please try again.', 'danger');
    }
}

/**
 * Logout function
 */
function logout() {
    if (typeof AuthSystem !== 'undefined' && AuthSystem.logout) {
        AuthSystem.logout();
    } else {
        // Fallback logout
        if (confirm('Are you sure you want to logout?')) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'index.html';
        }
    }
}

/**
 * Handle template selection from modal
 */
function selectTemplate(templateType) {
    let templateUrl = 'template-editor-advanced.html';
    
    // Add template type as URL parameter
    if (templateType !== 'blank') {
        templateUrl += `?template=${templateType}`;
    }
    
    // Close modal and redirect
    const modal = bootstrap.Modal.getInstance(document.getElementById('templateSelectionModal'));
    if (modal) {
        modal.hide();
    }
    
    // Redirect to editor with template
    window.location.href = templateUrl;
}

/**
 * Toggle sidebar (handled by admin-layout.js, but keeping for compatibility)
 */
function toggleSidebar() {
    if (typeof window.adminLayout !== 'undefined' && window.adminLayout.toggleSidebar) {
        window.adminLayout.toggleSidebar();
    } else {
        // Fallback toggle
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    }
}

// Render card grid for templates.html preserving UI
function renderTemplatesGrid(templates) {
    const grid = document.getElementById('templatesGrid');
    if (!grid) return;

    // Build "Create New Template" card first (match existing markup)
    const createCard = `
        <div class="col-lg-4 col-md-6 mb-4">
            <div class="template-card create-template-card" data-bs-toggle="modal" data-bs-target="#templateSelectionModal" style="cursor: pointer;">
                <div class="create-template-icon">
                    <i class="fas fa-plus"></i>
                </div>
                <h5 class="fw-bold mb-2">Create New Template</h5>
                <p class="mb-0 opacity-75">Start building a new document template</p>
            </div>
        </div>`;

    if (!Array.isArray(templates) || templates.length === 0) {
        grid.innerHTML = createCard + '<div class="col-12 text-center">No templates found</div>';
        return;
    }

    const cards = templates.map(t => templateCardHtml(t)).join('');
    grid.innerHTML = createCard + cards;
}

function templateCardHtml(t) {
    const idStr = String(t.id);
    const safeId = `'${idStr}'`;
    const name = escapeHtml(t.name || 'Untitled Template');
    const description = escapeHtml(t.description || '');
    const category = (t.category || 'document').toLowerCase();
    const iconClass = category.includes('report') ? 'report' : category.includes('research') ? 'research' : 'document';
    const isPublished = (t.metadata && t.metadata.status === 'published');
    const statusText = isPublished ? 'Active' : 'Draft';
    const statusClass = isPublished ? 'status-active' : 'status-draft';
    const updated = t.updated_at ? new Date(t.updated_at) : null;
    const createdText = updated ? `Created: ${updated.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : '';

    // Build embedded template json to ensure public form can render without DB
    let tplParam = '';
    try {
        const minimal = {
            id: t.id,
            name: t.name,
            description: t.description || '',
            metadata: t.metadata || {}
        };
        const json = JSON.stringify(minimal);
        const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        tplParam = `&tpl=${b64}`;
    } catch (_) { /* ignore */ }
    const formUrl = `../form.html?template=${encodeURIComponent(idStr)}&name=${encodeURIComponent(t.name || '')}${tplParam}`;
    const nameArg = JSON.stringify(t.name || '');

    return `
        <div class="col-lg-4 col-md-6 mb-4">
            <div class="template-card" data-template-id="${idStr}">
                <div class="template-status ${statusClass}">${statusText}</div>
                <div class="template-icon ${iconClass}">
                    <i class="fas ${iconClass === 'report' ? 'fa-chart-bar' : iconClass === 'research' ? 'fa-microscope' : 'fa-file-text'}"></i>
                </div>
                <h5 class="fw-semibold mb-2">${name}</h5>
                <p class="text-muted mb-3">${description || ''}</p>
                <div class="template-meta">
                    <div class="template-meta-item">
                        <i class="fas fa-users"></i>
                        <span>0 Authors</span>
                    </div>
                    <div class="template-meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>${createdText}</span>
                    </div>
                </div>
                <div class="template-actions mt-3">
                    <a href="template-editor-advanced.html?id=${encodeURIComponent(idStr)}" class="btn btn-sm btn-primary">
                        <i class="fas fa-edit me-1"></i>Edit
                    </a>
                    <!-- Duplicate button removed -->
                    <button class="btn btn-sm btn-outline-success ${isPublished ? '' : 'disabled'}" ${isPublished ? '' : 'disabled aria-disabled=\"true\"'} onclick="${isPublished ? `generateFormLink(${safeId}, ${nameArg})` : 'return false;'}">
                        <i class="fas fa-link me-1"></i>Form Link
                    </button>
                    <div class="dropdown d-inline">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <ul class="dropdown-menu">
                            ${isPublished ? `
                                <li><a class=\"dropdown-item\" href=\"#\" onclick=\"viewSubmissions(${safeId})\">View Submissions</a></li>
                                <li><a class=\"dropdown-item\" href=\"#\" onclick=\"exportTemplate(${safeId})\">Export Template</a></li>
                                <li><a class=\"dropdown-item\" href=\"${formUrl}\" target=\"_blank\">Preview Form</a></li>
                                <li><hr class=\"dropdown-divider\"></li>
                                <li><a class=\"dropdown-item text-danger\" href=\"#\" onclick=\"deleteTemplate(${safeId})\">Delete</a></li>
                            ` : `
                                <li><a class=\"dropdown-item\" href=\"#\" onclick=\"publishTemplate(${safeId})\">Publish Template</a></li>
                                <li><a class=\"dropdown-item\" href=\"#\" onclick=\"exportTemplate(${safeId})\">Export Template</a></li>
                                <li><hr class=\"dropdown-divider\"></li>
                                <li><a class=\"dropdown-item text-danger\" href=\"#\" onclick=\"deleteTemplate(${safeId})\">Delete</a></li>
                            `}
                        </ul>
                    </div>
                </div>
            </div>
        </div>`;
}

function applyGridFilters() {
    const list = Array.isArray(window.__templatesCache) ? window.__templatesCache : [];
    const search = (document.getElementById('templateSearch')?.value || '').toLowerCase();
    const activeTag = document.querySelector('.filter-tag.active');
    const filter = activeTag ? (activeTag.getAttribute('data-filter') || 'all') : 'all';

    let filtered = list.filter(t => {
        const hay = `${t.name || ''} ${t.description || ''} ${t.category || ''}`.toLowerCase();
        return hay.includes(search);
    });

    if (filter && filter !== 'all') {
        if (['report','research','document'].includes(filter)) {
            filtered = filtered.filter(t => (t.category || '').toLowerCase().includes(filter));
        } else if (filter === 'active') {
            filtered = filtered.filter(t => (t.metadata && t.metadata.status === 'published'));
        } else if (filter === 'draft') {
            filtered = filtered.filter(t => !(t.metadata && t.metadata.status === 'published'));
        }
    }

    renderTemplatesGrid(filtered);
}

// Simple debounce helper for this file
function debounce(fn, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Open public form with embedded template JSON fetched by ID
async function openPreviewForm(templateId, templateName) {
    try {
        const res = await TemplateAPI.getById(templateId);
        if (!res || !res.success || !res.data) {
            showAlert('Failed to load template for preview.', 'danger');
            return;
        }
        const tpl = res.data;
        const minimal = {
            id: tpl.id,
            name: tpl.name,
            description: tpl.description || '',
            metadata: tpl.metadata || {}
        };
        const json = JSON.stringify(minimal);
        const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const baseUrl = window.location.origin + window.location.pathname.replace('/admin/templates.html', '');
        const url = `${baseUrl}/form.html?template=${encodeURIComponent(String(templateId))}&name=${encodeURIComponent(templateName || tpl.name || '')}&tpl=${b64}`;
        const win = window.open(url, '_blank');
        if (!win) {
            // Popup blocked; navigate in same tab as a fallback
            window.location.href = url;
        }
    } catch (e) {
        console.error('openPreviewForm error:', e);
        showAlert('Error preparing preview form link.', 'danger');
    }
}