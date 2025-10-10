class AdvancedTemplateEditor {
    constructor() {
        this.currentTemplate = {
            id: null,
            name: '',
            description: '',
            category: '',
            chapters: [], // disabled in UI; keep for backward compatibility
            authors: [],
            variables: [],
            content: []
        };
        this.selectedBlock = null;
        this.blockCounter = 0;
        this.sortableInstance = null;
        this.zoomLevel = 100;
        this.undoStack = [];
        this.redoStack = [];
        this.isLoadingTemplate = false; // Flag to suppress individual block notifications during template loading
        this.hasUnsavedChanges = false; // Dirty tracking

        this.init();
    }

    async init() {
        await this.loadTemplateData();
        // Ensure metadata scaffolding exists
        this.currentTemplate.metadata = this.currentTemplate.metadata || {};
        // Normalize editor content location (persist in metadata.editor.content)
        if (this.currentTemplate.metadata && this.currentTemplate.metadata.editor && Array.isArray(this.currentTemplate.metadata.editor.content)) {
            this.currentTemplate.content = this.currentTemplate.metadata.editor.content;
        }
        this.currentTemplate.metadata.files = Array.isArray(this.currentTemplate.metadata.files) ? this.currentTemplate.metadata.files : [];
        this.setupEventListeners();
        this.initializeSortable();
        this.setupFileUpload();
        // Chapters disabled: skip rendering
        // this.loadChapters();
        this.loadAuthors();
        this.loadVariables();
    }

    async loadTemplateData() {
    const urlParams = new URLSearchParams(window.location.search);
    const templateId = urlParams.get('id');
    const templatePreset = urlParams.get('template'); // e.g., academic-chapter

        if (templateId) {
            try {
                const response = await API.getTemplate(templateId);
                if (response.success && response.data) {
                    // Normalize data shape: content is stored in metadata.editor.content
                    const meta = response.data.metadata || {};
                    const editorMeta = meta.editor || {};
                    const normalizedContent = Array.isArray(editorMeta.content)
                        ? editorMeta.content
                        : (Array.isArray(meta.content) ? meta.content : (response.data.content || []));

                    // Merge the API response data with current template structure
                    this.currentTemplate = {
                        ...this.currentTemplate,
                        ...response.data,
                        metadata: meta,
                        chapters: response.data.chapters || [],
                        authors: response.data.authors || [],
                        variables: response.data.variables || [],
                        content: normalizedContent
                    };

                    if (!Array.isArray(normalizedContent) || normalizedContent.length === 0) {
                        console.warn('[Editor] No content blocks found for template. If this template was previously saved, ensure editor content is under metadata.editor.content.');
                    }
                    this.populateTemplateForm();
                } else {
                    throw new Error('Failed to load template data');
                }
            } catch (error) {
                console.error('Error loading template:', error);
                this.showToast('Error loading template', 'error');
            }
        } else {
            // Create new template (no chapters) - leave id null so backend creates UUID
            if (templatePreset === 'academic-chapter') {
                this.applyAcademicPreset();
            }
        }
    }

    populateTemplateForm() {
        const nameInput = document.getElementById('templateName');
        const descInput = document.getElementById('templateDescription');
        const categorySelect = document.getElementById('templateCategory');

        if (nameInput) nameInput.value = this.currentTemplate.name || '';
        if (descInput) descInput.value = this.currentTemplate.description || '';
        if (categorySelect) categorySelect.value = this.currentTemplate.category || '';

        // Prefer editor content from metadata if available
        const metaContent = this.currentTemplate?.metadata?.editor?.content;
        let blocks = Array.isArray(metaContent) && metaContent.length > 0
            ? metaContent
            : (this.currentTemplate.content || []);

        // Normalize blocks to expected shape
        blocks = this.normalizeBlocks(blocks);
        this.renderDocumentContent(blocks);
    }

    normalizeBlocks(blocks) {
        if (!Array.isArray(blocks)) return [];
        return blocks.map((b, idx) => {
            const id = b.id || `block_${++this.blockCounter || idx + 1}`;
            const type = b.type || 'paragraph';
            let content = b.content;
            if (content && typeof content === 'object' && content.text) {
                content = content.text;
            }
            const properties = b.properties && typeof b.properties === 'object' ? b.properties : {};
            return { id, type, content, properties };
        });
    }

    setupEventListeners() {
        // Template info form listeners with null checks
        const nameInput = document.getElementById('templateName');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.currentTemplate.name = e.target.value;
                this.saveState();
                this.markDirty();
            });
        }

        const descInput = document.getElementById('templateDescription');
        if (descInput) {
            descInput.addEventListener('input', (e) => {
                this.currentTemplate.description = e.target.value;
                this.saveState();
                this.markDirty();
            });
        }

        const categorySelect = document.getElementById('templateCategory');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.currentTemplate.category = e.target.value;
                this.saveState();
                this.markDirty();
            });
        }

        // Custom variable input (optional)
        const customVarEl = document.getElementById('customVariableName');
        if (customVarEl) {
            customVarEl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addCustomVariable();
                }
            });
        }

        // Add click handler to finish editing when clicking outside blocks
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.content-block') && !e.target.closest('.contextual-toolbar')) {
                // Only finish editing if there's actually a block being edited
                const editingBlock = document.querySelector('.content-block.editing');
                if (editingBlock) {
                    this.finishEditing();
                }
            }
        });

        // Click outside to deselect blocks
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.content-block') && !e.target.closest('#propertiesPanel')) {
                this.deselectAllBlocks();
            }
        });

        // Global beforeunload to warn about unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    initializeSortable() {
        const templateCanvas = document.getElementById('templateCanvas');

        if (!templateCanvas) {
            console.warn('Template canvas element not found, retrying in 100ms...');
            // Retry after a short delay to ensure DOM is fully loaded
            setTimeout(() => {
                this.initializeSortable();
            }, 100);
            return;
        }

        this.sortableInstance = Sortable.create(templateCanvas, {
            group: 'template-blocks',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            filter: '.empty-canvas', // Exclude empty canvas from drag
            onEnd: (evt) => {
                this.handleBlockReorder(evt);
            }
        });
    }

    addDefaultChapter() {
        // Chapters disabled: no-op
        this.currentTemplate.chapters = [];
    }

    loadChapters() {
        const container = document.getElementById('chaptersContainer');

        if (!container) {
            console.error('Chapters container not found');
            return;
        }
        // Chapters disabled: hide container
        container.style.display = 'none';
    }

    renderChapterCard(chapter) {
        const statusBadge = chapter.status === 'submitted' ?
            '<span class="badge bg-success">Submitted</span>' :
            '<span class="badge bg-warning">Pending</span>';

        return `
            <div class="chapter-card card mb-2 shadow-sm ${chapter.id === 'chapter_1' ? 'active' : ''}" 
                 onclick="templateEditor.selectChapter('${chapter.id}')">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${chapter.title}</h6>
                            <small class="text-muted">${chapter.author || 'Unassigned'}</small>
                        </div>
                        ${statusBadge}
                    </div>
                </div>
            </div>
        `;
    }

    selectChapter(chapterId) {
        // Remove active class from all chapters
        // Chapters disabled
    }

    addNewChapter() {
        // Chapters disabled
    }

    applyAcademicPreset() {
        // Clear canvas if any
        const templateCanvas = document.getElementById('templateCanvas');
        if (templateCanvas) templateCanvas.innerHTML = '';

        // TOC placeholder
        this.addContentBlock('title');
        updateLastBlockContent('Table of Contents');
        this.addContentBlock('paragraph');
        updateLastBlockContent('[The Table of Contents will be generated automatically based on author submissions.]');
        this.addContentBlock('pagebreak');

        // Chapter heading placeholders (authors will fill later in form)
        this.addContentBlock('title');
        updateLastBlockContent('Chapter Title');
        this.addContentBlock('paragraph');
        updateLastBlockContent('Author Name');
        this.addContentBlock('paragraph');
        updateLastBlockContent('Institution Affiliation');
        this.addContentBlock('divider');
        this.addContentBlock('subtitle');
        updateLastBlockContent('Abstract');
        this.addContentBlock('paragraph');
        updateLastBlockContent('This chapter examines...');
        this.addContentBlock('subtitle');
        updateLastBlockContent('1. Introduction');
        this.addContentBlock('paragraph');
        updateLastBlockContent('This chapter explores...');
    }

    addContentBlock(blockType) {
        const blockId = `block_${++this.blockCounter}`;
        const blockData = this.createBlockData(blockType, blockId);

        const blockElement = this.createBlockElement(blockData);

        // Insert block into template canvas
        const templateCanvas = document.getElementById('templateCanvas');
        const emptyCanvas = templateCanvas.querySelector('.empty-canvas');

        if (emptyCanvas) {
            emptyCanvas.style.display = 'none';
        }

        templateCanvas.appendChild(blockElement);

        // Select the new block
        this.selectBlock(blockElement);

    // Save state and mark dirty
    this.saveState();
    this.markDirty();

        // Only show toast if not in template loading mode
        if (!this.isLoadingTemplate) {
            this.showToast(`${blockType} block added successfully`, 'success');
        }
    }

    createBlockData(blockType, blockId) {
        const baseData = {
            id: blockId,
            type: blockType,
            properties: {}
        };

        switch (blockType) {
            case 'title':
                return {
                    ...baseData,
                    content: 'Document Title',
                    properties: {
                        fontSize: '28px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        color: '#000000',
                        marginBottom: '20px'
                    }
                };
            case 'subtitle':
                return {
                    ...baseData,
                    content: 'Subtitle',
                    properties: {
                        fontSize: '20px',
                        fontWeight: '600',
                        textAlign: 'left',
                        color: '#333333',
                        marginBottom: '15px'
                    }
                };
            case 'paragraph':
                return {
                    ...baseData,
                    content: 'This is a paragraph block. You can edit this text and customize its appearance.',
                    properties: {
                        fontSize: '14px',
                        fontWeight: 'normal',
                        textAlign: 'left',
                        color: '#333333',
                        lineHeight: '1.6',
                        marginBottom: '15px'
                    }
                };
            case 'image':
                return {
                    ...baseData,
                    content: 'https://via.placeholder.com/400x200/6C63FF/ffffff?text=Image+Placeholder',
                    properties: {
                        width: '100%',
                        maxWidth: '400px',
                        height: 'auto',
                        textAlign: 'center',
                        marginBottom: '15px',
                        alt: 'Image placeholder'
                    }
                };
            case 'quote':
                return {
                    ...baseData,
                    content: 'This is a quote block that can be used to highlight important text.',
                    properties: {
                        fontSize: '16px',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        color: '#6C63FF',
                        borderLeft: '4px solid #6C63FF',
                        paddingLeft: '20px',
                        marginBottom: '20px'
                    }
                };
            case 'textfield':
                return {
                    ...baseData,
                    content: '',
                    placeholder: 'Enter text here...',
                    properties: {
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '5px',
                        marginBottom: '15px',
                        required: false
                    }
                };
            case 'textarea':
                return {
                    ...baseData,
                    content: '',
                    placeholder: 'Enter longer text here...',
                    properties: {
                        width: '100%',
                        minHeight: '100px',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '5px',
                        marginBottom: '15px',
                        required: false
                    }
                };
            case 'divider':
                return {
                    ...baseData,
                    properties: {
                        borderTop: '1px solid #dee2e6',
                        margin: '20px 0',
                        width: '100%'
                    }
                };
            case 'pagebreak':
                return {
                    ...baseData,
                    properties: {
                        pageBreakAfter: 'always',
                        margin: '20px 0',
                        textAlign: 'center',
                        color: '#6c757d'
                    }
                };
            case 'table':
                return {
                    ...baseData,
                    content: [
                        ['Header 1', 'Header 2', 'Header 3'],
                        ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
                        ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3']
                    ],
                    properties: {
                        width: '100%',
                        border: '1px solid #dee2e6',
                        borderCollapse: 'collapse',
                        marginBottom: '15px'
                    }
                };
            case 'signature':
                return {
                    ...baseData,
                    content: '',
                    placeholder: 'Click to sign...',
                    properties: {
                        width: '100%',
                        height: '120px',
                        border: '2px dashed #dee2e6',
                        borderRadius: '5px',
                        marginBottom: '15px',
                        textAlign: 'center',
                        backgroundColor: '#f8f9fa'
                    }
                };
            case 'checkbox':
                return {
                    ...baseData,
                    content: 'Checkbox option',
                    checked: false,
                    properties: {
                        marginBottom: '10px',
                        fontSize: '14px'
                    }
                };
            case 'dropdown':
                return {
                    ...baseData,
                    content: ['Option 1', 'Option 2', 'Option 3'],
                    placeholder: 'Select an option...',
                    properties: {
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '5px',
                        marginBottom: '15px'
                    }
                };
            case 'attachment':
                return {
                    ...baseData,
                    content: '',
                    placeholder: 'Click to attach a file...',
                    properties: {
                        width: '100%',
                        padding: '20px',
                        border: '2px dashed #dee2e6',
                        borderRadius: '5px',
                        marginBottom: '15px',
                        textAlign: 'center',
                        backgroundColor: '#f8f9fa'
                    }
                };
            default:
                return baseData;
        }
    }

    createBlockElement(blockData) {
        const blockElement = document.createElement('div');
        blockElement.className = 'template-block content-block';
        blockElement.dataset.blockId = blockData.id;
        blockElement.dataset.blockType = blockData.type;

        const blockControls = `
            <div class="block-controls">
                <div class="btn-group">
                    <button class="btn btn-outline-secondary btn-sm" onclick="templateEditor.duplicateBlock('${blockData.id}')" title="Duplicate">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="templateEditor.deleteBlock('${blockData.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        let blockContent = '';

        switch (blockData.type) {
            case 'title':
                blockContent = `<h1 contenteditable="true" style="${this.propertiesToStyle(blockData.properties)}">${blockData.content}</h1>`;
                break;
            case 'subtitle':
                blockContent = `<h2 contenteditable="true" style="${this.propertiesToStyle(blockData.properties)}">${blockData.content}</h2>`;
                break;
            case 'paragraph':
                blockContent = `<p contenteditable="true" style="${this.propertiesToStyle(blockData.properties)}">${blockData.content}</p>`;
                break;
            case 'image':
                blockContent = `
                    <div style="${this.propertiesToStyle(blockData.properties)}">
                        <img src="${blockData.content}" alt="${blockData.properties.alt || 'Image'}" style="max-width: 100%; height: auto;">
                        <div contenteditable="true" class="image-caption mt-2" style="font-style: italic; color: #666;">
                            ${blockData.properties.caption || 'Image caption...'}
                        </div>
                    </div>
                `;
                break;
            case 'quote':
                blockContent = `<blockquote contenteditable="true" style="${this.propertiesToStyle(blockData.properties)}">${blockData.content}</blockquote>`;
                break;
            case 'textfield':
                blockContent = `
                    <div>
                        <label class="form-label">Text Field</label>
                        <input type="text" class="form-control" placeholder="${blockData.placeholder}" style="${this.propertiesToStyle(blockData.properties)}">
                    </div>
                `;
                break;
            case 'textarea':
                blockContent = `
                    <div>
                        <label class="form-label">Text Area</label>
                        <textarea class="form-control" placeholder="${blockData.placeholder}" style="${this.propertiesToStyle(blockData.properties)}"></textarea>
                    </div>
                `;
                break;
            case 'divider':
                blockContent = `<hr style="${this.propertiesToStyle(blockData.properties)}">`;
                break;
            case 'pagebreak':
                blockContent = `
                    <div style="${this.propertiesToStyle(blockData.properties)}">
                        <i class="fas fa-file-export"></i> Page Break
                    </div>
                `;
                break;
            case 'table':
                let tableHTML = `<table style="${this.propertiesToStyle(blockData.properties)}">`;
                if (Array.isArray(blockData.content)) {
                    blockData.content.forEach((row, rowIndex) => {
                        tableHTML += '<tr>';
                        row.forEach(cell => {
                            const tag = rowIndex === 0 ? 'th' : 'td';
                            tableHTML += `<${tag} contenteditable="true" style="border: 1px solid #dee2e6; padding: 8px;">${cell}</${tag}>`;
                        });
                        tableHTML += '</tr>';
                    });
                }
                tableHTML += '</table>';
                blockContent = tableHTML;
                break;
            case 'signature':
                blockContent = `
                    <div style="${this.propertiesToStyle(blockData.properties)}">
                        <div class="signature-area" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <div class="text-muted">
                                <i class="fas fa-signature"></i> ${blockData.placeholder}
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'checkbox':
                blockContent = `
                    <div style="${this.propertiesToStyle(blockData.properties)}">
                        <label class="form-check-label d-flex align-items-center">
                            <input type="checkbox" class="form-check-input me-2" ${blockData.checked ? 'checked' : ''}>
                            <span contenteditable="true">${blockData.content}</span>
                        </label>
                    </div>
                `;
                break;
            case 'dropdown':
                blockContent = `
                    <div style="${this.propertiesToStyle(blockData.properties)}">
                        <label class="form-label">Dropdown Field</label>
                        <select class="form-select" style="${this.propertiesToStyle(blockData.properties)}">
                            <option value="">${blockData.placeholder}</option>`;
                if (Array.isArray(blockData.content)) {
                    blockData.content.forEach(option => {
                        blockContent += `<option value="${option}">${option}</option>`;
                    });
                }
                blockContent += `</select>
                    </div>
                `;
                break;
            case 'attachment':
                blockContent = `
                    <div style="${this.propertiesToStyle(blockData.properties)}">
                        <div class="attachment-area" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <div class="text-muted">
                                <i class="fas fa-paperclip"></i> ${blockData.placeholder}
                            </div>
                        </div>
                    </div>
                `;
                break;
            default:
                blockContent = `<div>Unknown block type: ${blockData.type}</div>`;
        }

        blockElement.innerHTML = blockContent + blockControls;

        // Add click event listener
        blockElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectBlock(blockElement);
        });

        return blockElement;
    }

    propertiesToStyle(properties) {
        return Object.entries(properties)
            .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
            .join('; ');
    }

    camelToKebab(str) {
        return str.replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    selectBlock(blockElement) {
        this.deselectAllBlocks();
        blockElement.classList.add('selected');
        this.selectedBlock = blockElement;
        this.showBlockProperties();
    }

    deselectAllBlocks() {
        document.querySelectorAll('.template-block').forEach(block => {
            block.classList.remove('selected');
        });
        this.selectedBlock = null;
        this.hideBlockProperties();
    }

    showBlockProperties() {
        if (!this.selectedBlock) return;

        const blockType = this.selectedBlock.dataset.blockType;
        const propertiesPanel = document.getElementById('propertiesPanel');
        const propertyContent = document.getElementById('propertyContent');

        propertiesPanel.style.display = 'block';
        propertyContent.innerHTML = this.generatePropertyControls(blockType);
    }

    hideBlockProperties() {
        const propertiesPanel = document.getElementById('propertiesPanel');
        propertiesPanel.style.display = 'none';
    }

    generatePropertyControls(blockType) {
        let controls = '';

        switch (blockType) {
            case 'title':
            case 'subtitle':
            case 'paragraph':
                controls = `
                    <div class="mb-3">
                        <label class="form-label">Font Size</label>
                        <input type="range" class="form-range" min="10" max="48" value="16" onchange="templateEditor.updateBlockProperty('fontSize', this.value + 'px')">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Text Alignment</label>
                        <select class="form-select" onchange="templateEditor.updateBlockProperty('textAlign', this.value)">
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                            <option value="justify">Justify</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Text Color</label>
                        <input type="color" class="form-control form-control-color" onchange="templateEditor.updateBlockProperty('color', this.value)">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Font Weight</label>
                        <select class="form-select" onchange="templateEditor.updateBlockProperty('fontWeight', this.value)">
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                            <option value="600">Semi-bold</option>
                            <option value="300">Light</option>
                        </select>
                    </div>
                `;
                break;
            case 'image':
                controls = `
                    <div class="mb-3">
                        <label class="form-label">Image URL</label>
                        <input type="url" class="form-control" placeholder="https://..." onchange="templateEditor.updateBlockContent(this.value)">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Alt Text</label>
                        <input type="text" class="form-control" placeholder="Image description" onchange="templateEditor.updateBlockProperty('alt', this.value)">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Width</label>
                        <input type="text" class="form-control" placeholder="100%" onchange="templateEditor.updateBlockProperty('width', this.value)">
                    </div>
                `;
                break;
            case 'textfield':
            case 'textarea':
                controls = `
                    <div class="mb-3">
                        <label class="form-label">Label</label>
                        <input type="text" class="form-control" placeholder="Field label" onchange="templateEditor.updateBlockLabel(this.value)">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Placeholder</label>
                        <input type="text" class="form-control" placeholder="Placeholder text" onchange="templateEditor.updateBlockPlaceholder(this.value)">
                    </div>
                    <div class="mb-3">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" onchange="templateEditor.updateBlockProperty('required', this.checked)">
                            <label class="form-check-label">Required Field</label>
                        </div>
                    </div>
                `;
                break;
            case 'table':
                controls = `
                    <div class="mb-3">
                        <label class="form-label">Border Width</label>
                        <input type="range" class="form-range" min="0" max="5" value="1" onchange="templateEditor.updateBlockProperty('border', this.value + 'px solid #dee2e6')">
                    </div>
                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-primary" onclick="templateEditor.addTableRow()">Add Row</button>
                        <button class="btn btn-sm btn-outline-primary" onclick="templateEditor.addTableColumn()">Add Column</button>
                    </div>
                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-danger" onclick="templateEditor.removeTableRow()">Remove Row</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="templateEditor.removeTableColumn()">Remove Column</button>
                    </div>
                `;
                break;
            case 'signature':
                controls = `
                    <div class="mb-3">
                        <label class="form-label">Height</label>
                        <input type="range" class="form-range" min="80" max="200" value="120" onchange="templateEditor.updateBlockProperty('height', this.value + 'px')">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Border Style</label>
                        <select class="form-select" onchange="templateEditor.updateBlockProperty('border', '2px ' + this.value + ' #dee2e6')">
                            <option value="dashed">Dashed</option>
                            <option value="solid">Solid</option>
                            <option value="dotted">Dotted</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <button class="btn btn-sm btn-outline-primary" onclick="templateEditor.clearSignature()">Clear Signature</button>
                    </div>
                `;
                break;
            case 'checkbox':
                controls = `
                    <div class="mb-3">
                        <label class="form-label">Checkbox Label</label>
                        <input type="text" class="form-control" placeholder="Option text" onchange="templateEditor.updateCheckboxLabel(this.value)">
                    </div>
                    <div class="mb-3">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" onchange="templateEditor.updateCheckboxState(this.checked)">
                            <label class="form-check-label">Default Checked</label>
                        </div>
                    </div>
                `;
                break;
            case 'dropdown':
                controls = `
                    <div class="mb-3">
                        <label class="form-label">Dropdown Options</label>
                        <textarea class="form-control" rows="4" placeholder="Enter options (one per line)" onchange="templateEditor.updateDropdownOptions(this.value)"></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Placeholder</label>
                        <input type="text" class="form-control" placeholder="Select an option..." onchange="templateEditor.updateBlockPlaceholder(this.value)">
                    </div>
                `;
                break;
            case 'attachment':
                controls = `
                    <div class="mb-3">
                        <label class="form-label">Accepted File Types</label>
                        <input type="text" class="form-control" placeholder=".pdf,.doc,.docx" onchange="templateEditor.updateAttachmentTypes(this.value)">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Max File Size (MB)</label>
                        <input type="number" class="form-control" min="1" max="50" value="10" onchange="templateEditor.updateAttachmentMaxSize(this.value)">
                    </div>
                    <div class="mb-3">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" onchange="templateEditor.updateBlockProperty('required', this.checked)">
                            <label class="form-check-label">Required Attachment</label>
                        </div>
                    </div>
                `;
                break;
        }

        return controls;
    }

    updateBlockProperty(property, value) {
        if (!this.selectedBlock) return;

        const blockElement = this.selectedBlock;
        const contentElement = blockElement.querySelector('[contenteditable], input, textarea, img, hr');

        if (contentElement) {
            contentElement.style[property] = value;
        }

        this.saveState();
    }

    updateBlockContent(content) {
        if (!this.selectedBlock) return;

        const blockType = this.selectedBlock.dataset.blockType;
        const blockElement = this.selectedBlock;

        if (blockType === 'image') {
            const imgElement = blockElement.querySelector('img');
            if (imgElement) {
                imgElement.src = content;
            }
        } else {
            const contentElement = blockElement.querySelector('[contenteditable]');
            if (contentElement) {
                contentElement.textContent = content;
            }
        }

        this.saveState();
    }

    editBlock(blockId) {
        console.log('Editing block:', blockId); // Debug log
        const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
        if (blockElement) {
            // Remove editing class from all blocks
            document.querySelectorAll('.content-block').forEach(block => {
                block.classList.remove('editing');
                const existingToolbar = block.querySelector('.contextual-toolbar');
                if (existingToolbar) {
                    existingToolbar.remove();
                }
            });

            // Add editing class and contextual toolbar to selected block
            blockElement.classList.add('editing');

            // Create contextual formatting toolbar
            const toolbar = this.createContextualToolbar(blockElement.dataset.blockType);
            blockElement.insertBefore(toolbar, blockElement.firstChild);

            this.selectBlock(blockElement);
            this.showToast('Click outside the block to finish editing', 'info');
        } else {
            console.error('Block element not found for ID:', blockId); // Debug log
            this.showToast('Block not found', 'error');
        }
    }

    createContextualToolbar(blockType) {
        const toolbar = document.createElement('div');
        toolbar.className = 'contextual-toolbar';

        let toolbarContent = '';

        // Basic formatting for text blocks
        if (['title', 'subtitle', 'paragraph', 'quote'].includes(blockType)) {
            toolbarContent = `
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <!-- Text Formatting -->
                    <div class="btn-group" role="group">
                        <button class="btn btn-outline-secondary btn-sm" onclick="formatText('bold')" title="Bold">
                            <i class="fas fa-bold"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="formatText('italic')" title="Italic">
                            <i class="fas fa-italic"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="formatText('underline')" title="Underline">
                            <i class="fas fa-underline"></i>
                        </button>
                    </div>
                    
                    <div class="vr"></div>
                    
                    <!-- Font Size -->
                    <select class="form-select form-select-sm" style="width: 80px;" onchange="changeFontSize(this.value)">
                        <option value="12">12</option>
                        <option value="14">14</option>
                        <option value="16" selected>16</option>
                        <option value="18">18</option>
                        <option value="20">20</option>
                        <option value="24">24</option>
                        <option value="28">28</option>
                        <option value="32">32</option>
                        <option value="36">36</option>
                        <option value="48">48</option>
                    </select>
                    
                    <div class="vr"></div>
                    
                    <!-- Text Alignment -->
                    <div class="btn-group" role="group">
                        <button class="btn btn-outline-secondary btn-sm" onclick="alignText('left')" title="Align Left">
                            <i class="fas fa-align-left"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="alignText('center')" title="Center">
                            <i class="fas fa-align-center"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="alignText('right')" title="Align Right">
                            <i class="fas fa-align-right"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="alignText('justify')" title="Justify">
                            <i class="fas fa-align-justify"></i>
                        </button>
                    </div>
                    
                    <div class="vr"></div>
                    
                    <!-- Text Color -->
                    <input type="color" class="form-control form-control-color" onchange="changeTextColor(this.value)" title="Text Color" style="width: 40px; height: 32px;">
                    
                    <div class="vr"></div>
                    
                    <!-- Lists -->
                    <div class="btn-group" role="group">
                        <button class="btn btn-outline-secondary btn-sm" onclick="insertList('bullet')" title="Bullet List">
                            <i class="fas fa-list-ul"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="insertList('numbered')" title="Numbered List">
                            <i class="fas fa-list-ol"></i>
                        </button>
                    </div>
                    
                    <div class="vr"></div>
                    
                    <!-- Links -->
                    <button class="btn btn-outline-secondary btn-sm" onclick="insertLink()" title="Insert Link">
                        <i class="fas fa-link"></i>
                    </button>
                    
                    <div class="vr"></div>
                    
                    <!-- Done Editing -->
                    <button class="btn btn-success btn-sm" onclick="templateEditor.finishEditing()" title="Done Editing">
                        <i class="fas fa-check"></i> Done
                    </button>
                </div>
            `;
        } else if (blockType === 'image') {
            toolbarContent = `
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <!-- Image Controls -->
                    <input type="text" class="form-control form-control-sm" placeholder="Image URL" onchange="updateImageSrc(this.value)" style="width: 200px;">
                    
                    <div class="vr"></div>
                    
                    <!-- Image Alignment -->
                    <div class="btn-group" role="group">
                        <button class="btn btn-outline-secondary btn-sm" onclick="alignImage('left')" title="Align Left">
                            <i class="fas fa-align-left"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="alignImage('center')" title="Center">
                            <i class="fas fa-align-center"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="alignImage('right')" title="Align Right">
                            <i class="fas fa-align-right"></i>
                        </button>
                    </div>
                    
                    <div class="vr"></div>
                    
                    <!-- Image Size -->
                    <select class="form-select form-select-sm" style="width: 100px;" onchange="resizeImage(this.value)">
                        <option value="25%">25%</option>
                        <option value="50%">50%</option>
                        <option value="75%">75%</option>
                        <option value="100%" selected>100%</option>
                    </select>
                    
                    <div class="vr"></div>
                    
                    <!-- Done Editing -->
                    <button class="btn btn-success btn-sm" onclick="templateEditor.finishEditing()" title="Done Editing">
                        <i class="fas fa-check"></i> Done
                    </button>
                </div>
            `;
        } else if (blockType === 'table') {
            toolbarContent = `
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <!-- Table Controls -->
                    <div class="btn-group" role="group">
                        <button class="btn btn-outline-primary btn-sm" onclick="templateEditor.addTableRow()" title="Add Row">
                            <i class="fas fa-plus"></i> Row
                        </button>
                        <button class="btn btn-outline-primary btn-sm" onclick="templateEditor.addTableColumn()" title="Add Column">
                            <i class="fas fa-plus"></i> Column
                        </button>
                    </div>
                    
                    <div class="vr"></div>
                    
                    <div class="btn-group" role="group">
                        <button class="btn btn-outline-danger btn-sm" onclick="templateEditor.removeTableRow()" title="Remove Row">
                            <i class="fas fa-minus"></i> Row
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="templateEditor.removeTableColumn()" title="Remove Column">
                            <i class="fas fa-minus"></i> Column
                        </button>
                    </div>
                    
                    <div class="vr"></div>
                    
                    <!-- Done Editing -->
                    <button class="btn btn-success btn-sm" onclick="templateEditor.finishEditing()" title="Done Editing">
                        <i class="fas fa-check"></i> Done
                    </button>
                </div>
            `;
        } else {
            // Basic toolbar for other block types
            toolbarContent = `
                <div class="d-flex align-items-center gap-2">
                    <span class="text-muted">Editing ${blockType} block</span>
                    <button class="btn btn-success btn-sm" onclick="templateEditor.finishEditing()" title="Done Editing">
                        <i class="fas fa-check"></i> Done
                    </button>
                </div>
            `;
        }

        toolbar.innerHTML = toolbarContent;
        return toolbar;
    }

    finishEditing() {
        // Check if any blocks are currently being edited
        const editingBlocks = document.querySelectorAll('.content-block.editing');

        if (editingBlocks.length === 0) {
            return; // No blocks being edited, nothing to finish
        }

        // Remove editing class from all blocks
        editingBlocks.forEach(block => {
            block.classList.remove('editing');
            const existingToolbar = block.querySelector('.contextual-toolbar');
            if (existingToolbar) {
                existingToolbar.remove();
            }
        });

        this.showToast('Editing finished', 'success');
    }

    duplicateBlock(blockId) {
        const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
        if (blockElement) {
            const clonedElement = blockElement.cloneNode(true);
            const newBlockId = `block_${++this.blockCounter}`;
            clonedElement.dataset.blockId = newBlockId;

            // Update controls
            clonedElement.querySelector('.block-controls').innerHTML = clonedElement.querySelector('.block-controls').innerHTML.replace(new RegExp(blockId, 'g'), newBlockId);

            blockElement.parentNode.insertBefore(clonedElement, blockElement.nextSibling);
            this.saveState();
            this.showToast('Block duplicated successfully', 'success');
        }
    }

    deleteBlock(blockId) {
        if (confirm('Are you sure you want to delete this block?')) {
            const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
            if (blockElement) {
                blockElement.remove();
                this.deselectAllBlocks();
                this.saveState();
                this.showToast('Block deleted successfully', 'success');
            }
        }
    }

    renderDocumentContent(content = []) {
        const documentPreview = document.getElementById('templateCanvas');

        if (!documentPreview) {
            console.error('Template canvas element not found');
            return;
        }

        // Clear previous content but preserve an existing empty-canvas placeholder if present
        let emptyCanvas = documentPreview.querySelector('.empty-canvas');
        documentPreview.innerHTML = emptyCanvas ? emptyCanvas.outerHTML : '';
        emptyCanvas = documentPreview.querySelector('.empty-canvas');

        if (content.length === 0) {
            // Show empty state if no content
            if (!emptyCanvas) {
                documentPreview.innerHTML = `
                    <div class="empty-canvas text-center py-5">
                        <i class="fas fa-file-alt fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">Start Building Your Template</h5>
                        <p class="text-muted">Drag blocks from the sidebar or use the rich text toolbar above</p>
                    </div>
                `;
            }
        } else {
            // Remove empty state and show content blocks
            if (emptyCanvas) {
                emptyCanvas.style.display = 'none';
            }
            content.forEach(blockData => {
                const blockElement = this.createBlockElement(blockData);
                documentPreview.appendChild(blockElement);
            });
        }
    }

    loadAuthors() {
        const container = document.getElementById('authorsContainer');

        if (this.currentTemplate.authors.length === 0) {
            container.innerHTML = `
                <div class="text-center py-3">
                    <i class="fas fa-users fa-2x text-muted mb-2"></i>
                    <p class="text-muted small">No authors assigned</p>
                </div>
            `;
        } else {
            container.innerHTML = this.currentTemplate.authors.map(author => this.renderAuthorCard(author)).join('');
        }
    }

    renderAuthorCard(author) {
        return `
            <div class="card mb-2">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${author.name}</h6>
                            <small class="text-muted">${author.role}</small>
                        </div>
                        <button class="btn btn-outline-danger btn-sm" onclick="templateEditor.removeAuthor('${author.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    addAuthor() {
        new bootstrap.Modal(document.getElementById('addAuthorModal')).show();
    }

    loadVariables() {
        const container = document.getElementById('customVariablesContainer');

        if (this.currentTemplate.variables.length === 0) {
            container.innerHTML = '<small class="text-muted">No custom variables</small>';
        } else {
            container.innerHTML = this.currentTemplate.variables.map(variable => `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="small">{${variable.name}}</span>
                    <button class="btn btn-outline-danger btn-sm" onclick="templateEditor.removeVariable('${variable.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    addCustomVariable() {
        const nameInput = document.getElementById('customVariableName');
        const name = nameInput.value.trim();

        if (!name) return;

        const variable = {
            id: 'var_' + Date.now(),
            name: name,
            type: 'text'
        };

        this.currentTemplate.variables.push(variable);
        nameInput.value = '';
        this.loadVariables();
        this.saveState();
        this.showToast('Custom variable added', 'success');
    }

    insertVariable(variableName) {
        if (this.selectedBlock) {
            const contentElement = this.selectedBlock.querySelector('[contenteditable]');
            if (contentElement) {
                const variableText = `{${variableName}}`;
                contentElement.textContent += variableText;
                this.saveState();
                this.showToast('Variable inserted', 'success');
            }
        } else {
            this.showToast('Please select a text block first', 'warning');
        }
    }

    handleBlockReorder(evt) {
        this.saveState();
        this.markDirty();
        this.showToast('Block order updated', 'info');
    }

    saveState() {
        const state = {
            template: JSON.parse(JSON.stringify(this.currentTemplate)),
            timestamp: Date.now()
        };

        this.undoStack.push(state);
        this.redoStack = []; // Clear redo stack when new action is performed

        // Limit undo stack size
        if (this.undoStack.length > 50) {
            this.undoStack.shift();
        }
    }

    undoAction() {
        if (this.undoStack.length > 1) {
            const currentState = this.undoStack.pop();
            this.redoStack.push(currentState);

            const previousState = this.undoStack[this.undoStack.length - 1];
            this.currentTemplate = JSON.parse(JSON.stringify(previousState.template));

            this.renderDocumentContent();
            this.showToast('Action undone', 'info');
        }
    }

    redoAction() {
        if (this.redoStack.length > 0) {
            const redoState = this.redoStack.pop();
            this.undoStack.push(redoState);

            this.currentTemplate = JSON.parse(JSON.stringify(redoState.template));
            this.renderDocumentContent();
            this.showToast('Action redone', 'info');
        }
    }

    zoomIn() {
        this.zoomLevel = Math.min(this.zoomLevel + 10, 200);
        this.applyZoom();
    }

    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel - 10, 50);
        this.applyZoom();
    }

    applyZoom() {
        const documentPreview = document.getElementById('documentPreview');
        documentPreview.style.transform = `scale(${this.zoomLevel / 100})`;
        documentPreview.style.transformOrigin = 'top center';
        document.getElementById('zoomLevel').textContent = `${this.zoomLevel}%`;
    }

    async saveTemplate() {
        if (!this.currentTemplate.name) {
            this.showToast('Please enter a template name', 'warning');
            return;
        }

        try {
            // Collect content from DOM
            this.currentTemplate.content = this.collectContentFromDOM();

            const res = await API.saveTemplate(this.currentTemplate);
            if (!res || !res.success) {
                const msg = (res && res.error) ? res.error : 'Save failed';
                throw new Error(msg);
            }
            // Success path
            if (res.data && res.data.id) {
                this.currentTemplate.id = res.data.id;
                // Ensure URL has ?id=<uuid> for subsequent saves
                const url = new URL(window.location.href);
                if (url.searchParams.get('id') !== this.currentTemplate.id) {
                    url.searchParams.set('id', this.currentTemplate.id);
                    history.replaceState(null, '', url.toString());
                }
            }
            if (res.data && res.data.version) {
                this.currentTemplate.version = res.data.version;
            }
            this.showToast('Template saved successfully!', 'success');
            if (typeof updateSaveIndicator === 'function') {
                updateSaveIndicator('Saved');
            }
            this.hasUnsavedChanges = false;
            return res;
        } catch (error) {
            console.error('Error saving template:', error);
            this.showToast(`Error saving template: ${error.message || 'Unknown error'}`, 'error');
            if (typeof updateSaveIndicator === 'function') {
                updateSaveIndicator('Save failed');
            }
            throw error;
        }
    }

    collectContentFromDOM() {
        const contentBlocks = document.querySelectorAll('.content-block');
        return Array.from(contentBlocks).map(block => {
            const blockId = block.dataset.blockId;
            const blockType = block.dataset.blockType;

            // Extract content and properties from DOM
            return {
                id: blockId,
                type: blockType,
                content: this.extractBlockContent(block),
                properties: this.extractBlockProperties(block)
            };
        });
    }

    extractBlockContent(blockElement) {
        const blockType = blockElement.dataset.blockType;

        switch (blockType) {
            case 'image':
                const imgElement = blockElement.querySelector('img');
                return imgElement ? imgElement.src : '';

            case 'table':
                const table = blockElement.querySelector('table');
                if (table) {
                    const rows = [];
                    table.querySelectorAll('tr').forEach(tr => {
                        const cells = [];
                        tr.querySelectorAll('td, th').forEach(cell => {
                            cells.push(cell.textContent.trim());
                        });
                        if (cells.length > 0) {
                            rows.push(cells);
                        }
                    });
                    return rows;
                }
                return [['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']];

            case 'textfield':
            case 'textarea':
                const inputElement = blockElement.querySelector('input, textarea');
                return {
                    placeholder: inputElement ? inputElement.placeholder : '',
                    label: blockElement.querySelector('label') ? blockElement.querySelector('label').textContent : ''
                };

            case 'checkbox':
                const checkbox = blockElement.querySelector('input[type="checkbox"]');
                const label = blockElement.querySelector('span[contenteditable]');
                return {
                    content: label ? label.textContent : 'Checkbox Option',
                    checked: checkbox ? checkbox.checked : false
                };

            case 'dropdown':
                const select = blockElement.querySelector('select');
                if (select) {
                    const options = [];
                    select.querySelectorAll('option').forEach(option => {
                        if (option.value) {
                            options.push(option.value);
                        }
                    });
                    return options;
                }
                return ['Option 1', 'Option 2', 'Option 3'];

            case 'signature':
            case 'attachment':
                return blockElement.querySelector('.signature-area, .attachment-area') ?
                    blockElement.querySelector('.signature-area, .attachment-area').textContent.trim() :
                    'Click to add';

            default:
                // For text-based content (title, subtitle, paragraph, quote)
                const contentElement = blockElement.querySelector('[contenteditable]');
                if (contentElement) {
                    return contentElement.innerHTML || contentElement.textContent;
                }
                return blockElement.textContent.trim();
        }
    }

    extractBlockProperties(blockElement) {
        const blockType = blockElement.dataset.blockType;
        const properties = {};

        switch (blockType) {
            case 'textfield':
            case 'textarea':
                const input = blockElement.querySelector('input, textarea');
                const label = blockElement.querySelector('label');
                if (input) {
                    properties.placeholder = input.placeholder;
                    properties.required = input.hasAttribute('required');
                }
                if (label) {
                    properties.label = label.textContent;
                }
                break;

            case 'checkbox':
                const checkbox = blockElement.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    properties.checked = checkbox.checked;
                }
                break;

            case 'dropdown':
                const select = blockElement.querySelector('select');
                if (select) {
                    properties.placeholder = select.querySelector('option[value=""]')?.textContent || 'Select an option...';
                }
                break;

            case 'image':
                const img = blockElement.querySelector('img');
                if (img) {
                    properties.alt = img.alt;
                    properties.width = img.style.width;
                    properties.height = img.style.height;
                }
                break;

            case 'table':
                const table = blockElement.querySelector('table');
                if (table) {
                    properties.border = table.style.border;
                    properties.width = table.style.width;
                }
                break;

            default:
                // For text-based content, extract styling
                const contentElement = blockElement.querySelector('[contenteditable], input, textarea, img, hr, table');
                if (contentElement) {
                    const computedStyle = window.getComputedStyle(contentElement);
                    properties.fontSize = computedStyle.fontSize;
                    properties.fontWeight = computedStyle.fontWeight;
                    properties.textAlign = computedStyle.textAlign;
                    properties.color = computedStyle.color;
                    properties.backgroundColor = computedStyle.backgroundColor;
                    properties.fontFamily = computedStyle.fontFamily;
                }
                break;
        }

        return properties;
    }

    previewTemplate() {
        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        const previewContent = this.generatePreviewHTML();
        previewWindow.document.write(previewContent);
        previewWindow.document.close();
    }

    generatePreviewHTML() {
        const content = this.collectContentFromDOM();

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${this.currentTemplate.name} - Preview</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                    .content-block { margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <h1>${this.currentTemplate.name}</h1>
        `;

        content.forEach(block => {
            html += `<div class="content-block">${this.renderBlockForPreview(block)}</div>`;
        });

        html += '</body></html>';
        return html;
    }

    renderBlockForPreview(block) {
        switch (block.type) {
            case 'title':
                return `<h1 style="${this.propertiesToStyle(block.properties)}">${block.content}</h1>`;
            case 'subtitle':
                return `<h2 style="${this.propertiesToStyle(block.properties)}">${block.content}</h2>`;
            case 'paragraph':
                return `<p style="${this.propertiesToStyle(block.properties)}">${block.content}</p>`;
            case 'image':
                return `<img src="${block.content}" style="${this.propertiesToStyle(block.properties)}" alt="${block.properties.alt || 'Image'}">`;
            case 'quote':
                return `<blockquote style="border-left: 4px solid #007bff; padding-left: 16px; margin: 16px 0; font-style: italic; ${this.propertiesToStyle(block.properties)}">${block.content}</blockquote>`;
            case 'divider':
                return `<hr style="border: none; border-top: 2px solid #dee2e6; margin: 20px 0; ${this.propertiesToStyle(block.properties)}">`;
            case 'pagebreak':
                return `<div style="page-break-after: always; border-top: 1px dashed #ccc; margin: 20px 0; padding: 10px; text-align: center; color: #666;">Page Break</div>`;
            case 'textfield':
                return `<div style="margin: 15px 0;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">${block.properties.label || 'Text Field'}</label>
                    <input type="text" placeholder="${block.properties.placeholder || ''}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; ${this.propertiesToStyle(block.properties)}" ${block.properties.required ? 'required' : ''}>
                </div>`;
            case 'textarea':
                return `<div style="margin: 15px 0;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">${block.properties.label || 'Text Area'}</label>
                    <textarea placeholder="${block.properties.placeholder || ''}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-height: 100px; ${this.propertiesToStyle(block.properties)}" ${block.properties.required ? 'required' : ''}></textarea>
                </div>`;
            case 'signature':
                return `<div style="margin: 15px 0;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">Signature</label>
                    <div style="width: 100%; height: 80px; border: 2px dashed #ccc; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #666; ${this.propertiesToStyle(block.properties)}">
                        <span>✍️ Signature Area</span>
                    </div>
                </div>`;
            case 'checkbox':
                return `<div style="margin: 15px 0; ${this.propertiesToStyle(block.properties)}">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" style="margin-right: 8px;" ${block.properties.checked ? 'checked' : ''}>
                        <span>${block.content || 'Checkbox Option'}</span>
                    </label>
                </div>`;
            case 'dropdown':
                return `<div style="margin: 15px 0;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">${block.properties.label || 'Dropdown Field'}</label>
                    <select style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; ${this.propertiesToStyle(block.properties)}">
                        <option value="">${block.properties.placeholder || 'Select an option...'}</option>
                        ${Array.isArray(block.content) ? block.content.map(option => `<option value="${option}">${option}</option>`).join('') : '<option>Option 1</option><option>Option 2</option>'}
                    </select>
                </div>`;
            case 'attachment':
                return `<div style="margin: 15px 0;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">File Attachment</label>
                    <div style="border: 2px dashed #ccc; border-radius: 4px; padding: 20px; text-align: center; color: #666; ${this.propertiesToStyle(block.properties)}">
                        <i>📎 Click to attach file</i><br>
                        <small>Accepted types: ${block.properties.acceptedTypes || '.pdf, .doc, .docx'}</small>
                    </div>
                </div>`;
            case 'table':
                let tableHTML = `<table style="width: 100%; border-collapse: collapse; margin: 15px 0; ${this.propertiesToStyle(block.properties)}">`;
                if (Array.isArray(block.content)) {
                    block.content.forEach((row, rowIndex) => {
                        tableHTML += '<tr>';
                        if (Array.isArray(row)) {
                            row.forEach(cell => {
                                const cellTag = rowIndex === 0 ? 'th' : 'td';
                                tableHTML += `<${cellTag} style="border: 1px solid #dee2e6; padding: 8px; ${rowIndex === 0 ? 'background: #f8f9fa; font-weight: bold;' : ''}">${cell}</${cellTag}>`;
                            });
                        }
                        tableHTML += '</tr>';
                    });
                } else {
                    // Default table structure
                    tableHTML += `
                        <tr>
                            <th style="border: 1px solid #dee2e6; padding: 8px; background: #f8f9fa; font-weight: bold;">Header 1</th>
                            <th style="border: 1px solid #dee2e6; padding: 8px; background: #f8f9fa; font-weight: bold;">Header 2</th>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #dee2e6; padding: 8px;">Cell 1</td>
                            <td style="border: 1px solid #dee2e6; padding: 8px;">Cell 2</td>
                        </tr>
                    `;
                }
                tableHTML += '</table>';
                return tableHTML;
            default:
                return `<div style="${this.propertiesToStyle(block.properties)}">${block.content || 'Unknown block type'}</div>`;
        }
    }

    async publishTemplate() {
        if (!this.currentTemplate.name) {
            this.showToast('Please enter a template name', 'warning');
            return;
        }

        if (confirm('Are you sure you want to publish this template? It will be available for authors to use.')) {
            try {
                // Store status inside metadata to avoid schema change for now
                const meta = this.currentTemplate.metadata || {};
                meta.status = 'published';
                meta.published_at = new Date().toISOString();
                this.currentTemplate.metadata = meta;

                const res = await this.saveTemplate();
                if (!res || !res.success) {
                    throw new Error((res && res.error) || 'Publish failed to save');
                }
                this.showToast('Template published successfully!', 'success');
            } catch (error) {
                console.error('Error publishing template:', error);
                this.showToast(`Error publishing template: ${error.message || 'Unknown error'}`, 'error');
            }
        }
    }

    closeEditor() {
        if (!this.hasUnsavedChanges) {
            window.location.href = 'templates.html';
            return;
        }

        // Prompt user to save before closing
        const shouldSave = confirm('You have unsaved changes. Click OK to save and close, or Cancel to close without saving.');
        if (shouldSave) {
            this.saveTemplate().then(() => {
                window.location.href = 'templates.html';
            }).catch(() => {
                // If save failed, still ask whether to close without saving
                if (confirm('Save failed. Close without saving?')) {
                    window.location.href = 'templates.html';
                }
            });
        } else {
            // Close without saving
            window.location.href = 'templates.html';
        }
    }

    markDirty() {
        this.hasUnsavedChanges = true;
        if (typeof updateSaveIndicator === 'function') {
            updateSaveIndicator('Changes pending');
        }
    }

    showToast(message, type = 'info') {
        // Create toast if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }

        const toastHTML = `
            <div class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'primary'} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        const toastElement = toastContainer.lastElementChild;
        const toast = new bootstrap.Toast(toastElement);
        toast.show();

        // Remove toast element after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    // File Upload Functionality
    setupFileUpload() {
        this.uploadedFiles = [];

        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');
        if (!fileUploadArea || !fileInput) {
            // File upload UI not present on this page; safely no-op
            return;
        }
        const uploadBox = fileUploadArea.querySelector?.('.upload-box');
        if (!uploadBox) return;

        // Click to browse files
        uploadBox.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change event
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        // Drag and drop events
        uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadBox.classList.add('dragover');
        });

        uploadBox.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadBox.classList.remove('dragover');
        });

        uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadBox.classList.remove('dragover');
            this.handleFileSelection(e.dataTransfer.files);
        });
    }

    async handleFileSelection(files) {
        const filesList = document.getElementById('filesList');
        const clearBtn = document.getElementById('clearFilesBtn');

        for (let file of files) {
            if (this.validateFile(file)) {
                const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const fileObj = {
                    id: fileId,
                    file: file,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    uploaded: false,
                    content: null,
                    storagePath: null,
                    signedUrl: null
                };

                this.uploadedFiles.push(fileObj);
                this.renderFileItem(fileObj);
                await this.processFile(fileObj);
            }
        }

        // Show clear button if files exist
        if (this.uploadedFiles.length > 0) {
            clearBtn.style.display = 'block';
        }
    }

    validateFile(file) {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif'
        ];

        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!allowedTypes.includes(file.type)) {
            this.showToast('File type not supported: ' + file.name, 'error');
            return false;
        }

        if (file.size > maxSize) {
            this.showToast('File too large: ' + file.name + ' (max 10MB)', 'error');
            return false;
        }

        return true;
    }

    renderFileItem(fileObj) {
        const filesList = document.getElementById('filesList');
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.id = 'file-item-' + fileObj.id;

        const iconClass = this.getFileIcon(fileObj.type);
        const fileSize = this.formatFileSize(fileObj.size);

        fileItem.innerHTML = `
            <div class="file-info">
                <i class="file-icon ${iconClass}"></i>
                <div>
                    <div class="file-name">${fileObj.name}</div>
                    <div class="file-size">${fileSize}</div>
                    <div class="file-progress">
                        <div class="file-progress-bar" style="width: 0%"></div>
                    </div>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="templateEditor.integrateFile('${fileObj.id}')" title="Integrate">
                    <i class="fas fa-puzzle-piece"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="templateEditor.removeFile('${fileObj.id}')" title="Remove">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        filesList.appendChild(fileItem);
    }

    async processFile(fileObj) {
        const progressBar = document.querySelector(`#file-item-${fileObj.id} .file-progress-bar`);

        try {
            // Begin progress
            this.animateProgress(progressBar, 25);

            // Upload to Supabase Storage (user-uploads bucket)
            const { storagePath, signedUrl } = await this.uploadToStorage(fileObj.file);
            fileObj.storagePath = storagePath;
            fileObj.signedUrl = signedUrl;

            // For text files, also keep local content for extraction convenience
            if (fileObj.type === 'text/plain') {
                fileObj.content = await this.readFileAsText(fileObj.file);
            }

            // Complete progress
            this.animateProgress(progressBar, 100);

            // Persist in template metadata.files list
            const fileMeta = {
                id: fileObj.id,
                name: fileObj.name,
                size: fileObj.size,
                type: fileObj.type,
                path: fileObj.storagePath,
                added_at: new Date().toISOString()
            };
            this.currentTemplate.metadata = this.currentTemplate.metadata || {};
            this.currentTemplate.metadata.files = Array.isArray(this.currentTemplate.metadata.files) ? this.currentTemplate.metadata.files : [];
            this.currentTemplate.metadata.files.push(fileMeta);
            this.markDirty();

            fileObj.uploaded = true;
            this.showToast('File uploaded: ' + fileObj.name, 'success');

        } catch (error) {
            console.error('Error processing file:', error);
            this.showToast('Error processing: ' + fileObj.name, 'error');
            progressBar.style.background = '#dc3545';
        }
    }

    async uploadToStorage(file) {
        const supa = window.__supabaseClient || window.supabaseClient;
        if (!supa) throw new Error('Supabase client not initialized');
        const session = await supa.auth.getSession();
        const userId = session?.data?.session?.user?.id || 'anon';
        const templateId = this.currentTemplate?.id || 'untitled';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${userId}/${templateId}/${timestamp}_${safeName}`;

        const bucket = supa.storage.from('user-uploads');
        const { error: upErr } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        const { data: urlData, error: urlErr } = await bucket.createSignedUrl(path, 3600);
        if (urlErr) throw urlErr;
        return { storagePath: path, signedUrl: urlData.signedUrl };
    }

    animateProgress(progressBar, targetWidth) {
        return new Promise(resolve => {
            let currentWidth = parseInt(progressBar.style.width) || 0;
            const interval = setInterval(() => {
                currentWidth += 2;
                progressBar.style.width = currentWidth + '%';

                if (currentWidth >= targetWidth) {
                    clearInterval(interval);
                    resolve();
                }
            }, 20);
        });
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    getFileIcon(fileType) {
        if (fileType.startsWith('image/')) return 'fas fa-image text-success';
        if (fileType === 'application/pdf') return 'fas fa-file-pdf text-danger';
        if (fileType.includes('word')) return 'fas fa-file-word text-primary';
        if (fileType === 'text/plain') return 'fas fa-file-alt text-info';
        return 'fas fa-file text-muted';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    integrateFile(fileId) {
        const fileObj = this.uploadedFiles.find(f => f.id === fileId);
        if (!fileObj) return;

        if (fileObj.type.startsWith('image/')) {
            // Insert an image block using the signed URL
            this.addContentBlock('image');
            this.setLastImageSrc(fileObj.signedUrl || fileObj.content);
            this.showToast('Image added to document', 'success');
        } else if (fileObj.type === 'text/plain') {
            this.insertTextContent(fileObj);
        } else {
            this.showToast('Integration for this file type coming soon', 'info');
        }
    }

    setLastImageSrc(url) {
        const templateCanvas = document.getElementById('templateCanvas');
        const blocks = templateCanvas.querySelectorAll('.content-block');
        if (!blocks.length) return;
        const last = blocks[blocks.length - 1];
        if (last && last.dataset.blockType === 'image') {
            const img = last.querySelector('img');
            if (img) {
                img.src = url;
                // Mark dirty
                this.markDirty();
            }
        }
    }

    insertImageBlock(fileObj) {
        // Backward-compat: now uses signed URL when available
        this.addContentBlock('image');
        this.setLastImageSrc(fileObj.signedUrl || fileObj.content);
        this.showToast('Image added to document', 'success');
    }

    insertTextContent(fileObj) {
        const lines = fileObj.content.split('\n');
        let blockCounter = 0;

        lines.forEach(line => {
            if (line.trim()) {
                const textBlock = {
                    id: 'block_' + (++this.blockCounter),
                    type: 'paragraph',
                    content: {
                        text: line.trim()
                    },
                    styles: {
                        fontSize: '14px',
                        lineHeight: '1.6',
                        margin: '10px 0'
                    }
                };

                this.addContentBlock(textBlock);
                blockCounter++;
            }
        });

        this.showToast(`Added ${blockCounter} text blocks from file`, 'success');
    }

    removeFile(fileId) {
        this.uploadedFiles = this.uploadedFiles.filter(f => f.id !== fileId);
        const fileItem = document.getElementById('file-item-' + fileId);
        if (fileItem) {
            fileItem.remove();
        }

        // Remove from template metadata.files as well
        if (this.currentTemplate.metadata && Array.isArray(this.currentTemplate.metadata.files)) {
            this.currentTemplate.metadata.files = this.currentTemplate.metadata.files.filter(f => f.id !== fileId);
            this.markDirty();
        }

        // Hide clear button if no files
        if (this.uploadedFiles.length === 0) {
            document.getElementById('clearFilesBtn').style.display = 'none';
        }

        this.showToast('File removed', 'info');
    }

    clearAllFiles() {
        this.uploadedFiles = [];
        document.getElementById('filesList').innerHTML = '';
        document.getElementById('clearFilesBtn').style.display = 'none';
        if (this.currentTemplate.metadata) {
            this.currentTemplate.metadata.files = [];
            this.markDirty();
        }
        this.showToast('All files cleared', 'info');
    }

    extractTextFromFiles() {
        const textFiles = this.uploadedFiles.filter(f => f.type === 'text/plain' && f.content);

        if (textFiles.length === 0) {
            this.showToast('No text files available for extraction', 'warning');
            return;
        }

        let extractedText = '';
        textFiles.forEach(file => {
            extractedText += `\n--- From ${file.name} ---\n${file.content}\n`;
        });

        // Create a text block with extracted content
        const textBlock = {
            id: 'block_' + (++this.blockCounter),
            type: 'paragraph',
            content: {
                text: extractedText.trim()
            },
            styles: {
                fontSize: '14px',
                lineHeight: '1.6',
                margin: '15px 0',
                padding: '15px',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                background: '#f8f9fa'
            }
        };

        this.addContentBlock(textBlock);
        this.showToast('Text extracted and added to document', 'success');
    }

    insertAsImages() {
        const imageFiles = this.uploadedFiles.filter(f => f.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            this.showToast('No images available for insertion', 'warning');
            return;
        }

        imageFiles.forEach(file => {
            this.insertImageBlock(file);
        });

        this.showToast(`Inserted ${imageFiles.length} images`, 'success');
    }

    createTemplateFromFile() {
        if (this.uploadedFiles.length === 0) {
            this.showToast('No files available for template generation', 'warning');
            return;
        }

        // Auto-generate template structure based on uploaded files
        const textFiles = this.uploadedFiles.filter(f => f.type === 'text/plain' && f.content);
        const imageFiles = this.uploadedFiles.filter(f => f.type.startsWith('image/') && f.content);

        // Create title block
        const titleBlock = {
            id: 'block_' + (++this.blockCounter),
            type: 'title',
            content: {
                text: 'Auto-Generated Template',
                level: 1
            },
            styles: {
                fontSize: '28px',
                fontWeight: 'bold',
                textAlign: 'center',
                margin: '20px 0'
            }
        };
        this.addContentBlock(titleBlock);

        // Add text content
        textFiles.forEach((file, index) => {
            const sectionTitle = {
                id: 'block_' + (++this.blockCounter),
                type: 'title',
                content: {
                    text: `Section ${index + 1}: ${file.name.replace(/\.[^/.]+$/, "")}`,
                    level: 2
                },
                styles: {
                    fontSize: '20px',
                    fontWeight: '600',
                    margin: '15px 0 10px 0'
                }
            };
            this.addContentBlock(sectionTitle);

            this.insertTextContent(file);
        });

        // Add images at the end
        if (imageFiles.length > 0) {
            const imagesSectionTitle = {
                id: 'block_' + (++this.blockCounter),
                type: 'title',
                content: {
                    text: 'Images',
                    level: 2
                },
                styles: {
                    fontSize: '20px',
                    fontWeight: '600',
                    margin: '15px 0 10px 0'
                }
            };
            this.addContentBlock(imagesSectionTitle);

            imageFiles.forEach(file => {
                this.insertImageBlock(file);
            });
        }

        this.showToast('Template auto-generated from uploaded files!', 'success');
    }

    // Methods for new block types
    addTableRow() {
        if (!this.selectedBlock || this.selectedBlock.dataset.blockType !== 'table') return;

        const table = this.selectedBlock.querySelector('table');
        if (table) {
            const newRow = table.insertRow();
            const columnCount = table.rows[0].cells.length;

            for (let i = 0; i < columnCount; i++) {
                const cell = newRow.insertCell();
                cell.contentEditable = true;
                cell.style.border = '1px solid #dee2e6';
                cell.style.padding = '8px';
                cell.textContent = `Cell ${table.rows.length}-${i + 1}`;
            }
        }
        this.saveState();
    }

    addTableColumn() {
        if (!this.selectedBlock || this.selectedBlock.dataset.blockType !== 'table') return;

        const table = this.selectedBlock.querySelector('table');
        if (table) {
            for (let i = 0; i < table.rows.length; i++) {
                const cell = table.rows[i].insertCell();
                const tag = i === 0 ? 'th' : 'td';
                cell.contentEditable = true;
                cell.style.border = '1px solid #dee2e6';
                cell.style.padding = '8px';
                cell.textContent = i === 0 ? `Header ${table.rows[0].cells.length}` : `Cell ${i + 1}-${table.rows[0].cells.length}`;
            }
        }
        this.saveState();
    }

    removeTableRow() {
        if (!this.selectedBlock || this.selectedBlock.dataset.blockType !== 'table') return;

        const table = this.selectedBlock.querySelector('table');
        if (table && table.rows.length > 1) {
            table.deleteRow(table.rows.length - 1);
        }
        this.saveState();
    }

    removeTableColumn() {
        if (!this.selectedBlock || this.selectedBlock.dataset.blockType !== 'table') return;

        const table = this.selectedBlock.querySelector('table');
        if (table && table.rows[0].cells.length > 1) {
            for (let i = 0; i < table.rows.length; i++) {
                table.rows[i].deleteCell(table.rows[i].cells.length - 1);
            }
        }
        this.saveState();
    }

    clearSignature() {
        if (!this.selectedBlock || this.selectedBlock.dataset.blockType !== 'signature') return;

        const signatureArea = this.selectedBlock.querySelector('.signature-area');
        if (signatureArea) {
            signatureArea.innerHTML = `
                <div class="text-muted">
                    <i class="fas fa-signature"></i> Click to sign...
                </div>
            `;
        }
        this.saveState();
    }

    updateCheckboxLabel(label) {
        if (!this.selectedBlock || this.selectedBlock.dataset.blockType !== 'checkbox') return;

        const labelSpan = this.selectedBlock.querySelector('span[contenteditable]');
        if (labelSpan) {
            labelSpan.textContent = label;
        }
        this.saveState();
    }

    updateCheckboxState(checked) {
        if (!this.selectedBlock || this.selectedBlock.dataset.blockType !== 'checkbox') return;

        const checkbox = this.selectedBlock.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = checked;
        }
        this.saveState();
    }

    updateDropdownOptions(optionsText) {
        if (!this.selectedBlock || this.selectedBlock.dataset.blockType !== 'dropdown') return;

        const select = this.selectedBlock.querySelector('select');
        if (select) {
            const options = optionsText.split('\n').filter(opt => opt.trim());

            // Keep the placeholder option
            const placeholderOption = select.querySelector('option[value=""]');
            select.innerHTML = '';

            if (placeholderOption) {
                select.appendChild(placeholderOption);
            }

            options.forEach(option => {
                const optElement = document.createElement('option');
                optElement.value = option.trim();
                optElement.textContent = option.trim();
                select.appendChild(optElement);
            });
        }
        this.saveState();
    }

    updateAttachmentTypes(types) {
        if (!this.selectedBlock || this.selectedBlock.dataset.blockType !== 'attachment') return;

        // Store the accepted file types as a data attribute
        this.selectedBlock.dataset.acceptedTypes = types;
        this.saveState();
    }

    updateAttachmentMaxSize(size) {
        if (!this.selectedBlock || this.selectedBlock.dataset.blockType !== 'attachment') return;

        // Store the max file size as a data attribute
        this.selectedBlock.dataset.maxSize = size;
        this.saveState();
    }

    updateBlockLabel(label) {
        if (!this.selectedBlock) return;

        const labelElement = this.selectedBlock.querySelector('label.form-label');
        if (labelElement) {
            labelElement.textContent = label;
        }
        this.saveState();
    }

    updateBlockPlaceholder(placeholder) {
        if (!this.selectedBlock) return;

        const blockType = this.selectedBlock.dataset.blockType;

        if (blockType === 'textfield' || blockType === 'textarea') {
            const input = this.selectedBlock.querySelector('input, textarea');
            if (input) {
                input.placeholder = placeholder;
            }
        } else if (blockType === 'dropdown') {
            const placeholderOption = this.selectedBlock.querySelector('option[value=""]');
            if (placeholderOption) {
                placeholderOption.textContent = placeholder;
            }
        }
        this.saveState();
    }
}

// Global functions for template actions
function saveTemplate() {
    templateEditor.saveTemplate();
}

function previewTemplate() {
    templateEditor.previewTemplate();
}

function publishTemplate() {
    // keep global for existing onclick hooks, delegate to class method
    templateEditor.publishTemplate();
}

function closeEditor() {
    templateEditor.closeEditor();
}

function undoAction() {
    templateEditor.undoAction();
}

function redoAction() {
    templateEditor.redoAction();
}

function insertTable() {
    templateEditor.addContentBlock('table');
}

function insertImage() {
    const url = prompt('Enter image URL:');
    if (url) {
        templateEditor.addContentBlock('image');
        // Update the newly added image block with the provided URL
        setTimeout(() => {
            if (templateEditor.selectedBlock && templateEditor.selectedBlock.dataset.blockType === 'image') {
                templateEditor.updateBlockContent(url);
            }
        }, 100);
    }
}

function insertLink() {
    const url = prompt('Enter link URL:');
    if (url) {
        const text = prompt('Enter link text:') || url;
        document.execCommand('createLink', false, url);
    }
}

function changeTextColor(color) {
    if (templateEditor.selectedBlock) {
        const contentElement = templateEditor.selectedBlock.querySelector('[contenteditable]');
        if (contentElement) {
            contentElement.style.color = color;
            templateEditor.saveState();
        }
    }
}

function updateImageSrc(src) {
    if (templateEditor.selectedBlock && templateEditor.selectedBlock.dataset.blockType === 'image') {
        const img = templateEditor.selectedBlock.querySelector('img');
        if (img && src) {
            img.src = src;
            templateEditor.saveState();
        }
    }
}

function alignImage(alignment) {
    if (templateEditor.selectedBlock && templateEditor.selectedBlock.dataset.blockType === 'image') {
        const imgContainer = templateEditor.selectedBlock.querySelector('div');
        if (imgContainer) {
            imgContainer.style.textAlign = alignment;
            templateEditor.saveState();
        }
    }
}

function resizeImage(size) {
    if (templateEditor.selectedBlock && templateEditor.selectedBlock.dataset.blockType === 'image') {
        const img = templateEditor.selectedBlock.querySelector('img');
        if (img) {
            img.style.width = size;
            img.style.height = 'auto';
            templateEditor.saveState();
        }
    }
}

// Duplicate functions removed - definitions exist below

function clearAllFiles() {
    templateEditor.clearAllFiles();
}

function extractTextFromFiles() {
    templateEditor.extractTextFromFiles();
}

function insertAsImages() {
    templateEditor.insertAsImages();
}

function createTemplateFromFile() {
    templateEditor.createTemplateFromFile();
}

function redoAction() {
    templateEditor.redoAction();
}

function zoomIn() {
    templateEditor.zoomIn();
}

function zoomOut() {
    templateEditor.zoomOut();
}

// Duplicate functions removed - using enhanced versions below

function addAuthor() {
    templateEditor.addAuthor();
}

function addCustomVariable() {
    templateEditor.addCustomVariable();
}

function insertVariable(variableName) {
    templateEditor.insertVariable(variableName);
}

function confirmAddAuthor() {
    // Implementation for adding author
    templateEditor.showToast('Author added successfully', 'success');
    bootstrap.Modal.getInstance(document.getElementById('addAuthorModal')).hide();
}

// File Upload Global Functions
function clearAllFiles() {
    templateEditor.clearAllFiles();
}

function extractTextFromFiles() {
    templateEditor.extractTextFromFiles();
}

function insertAsImages() {
    templateEditor.insertAsImages();
}

function createTemplateFromFile() {
    templateEditor.createTemplateFromFile();
}

// Enhanced Rich Text Editor Functions - Working with Block Content
function formatBlock(tag) {
    const selectedBlock = document.querySelector('.template-block.selected');
    if (selectedBlock && selectedBlock.isContentEditable) {
        // Focus the editable content within the block
        const editableContent = selectedBlock.querySelector('[contenteditable="true"]');
        if (editableContent) {
            editableContent.focus();
            if (tag) {
                document.execCommand('formatBlock', false, tag);
            } else {
                document.execCommand('formatBlock', false, 'p');
            }
            updateToolbarState();
            autoSave();
        }
    }
}

function changeFontFamily(fontFamily) {
    const selectedBlock = document.querySelector('.template-block.selected');
    if (selectedBlock && selectedBlock.isContentEditable) {
        const editableContent = selectedBlock.querySelector('[contenteditable="true"]');
        if (editableContent) {
            editableContent.focus();
            document.execCommand('fontName', false, fontFamily);
            updateToolbarState();
            autoSave();
        }
    }
}

function changeFontSize(size) {
    const selectedBlock = document.querySelector('.template-block.selected');
    if (selectedBlock && selectedBlock.isContentEditable) {
        const editableContent = selectedBlock.querySelector('[contenteditable="true"]');
        if (editableContent) {
            editableContent.focus();
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (!range.collapsed) {
                    const span = document.createElement('span');
                    span.style.fontSize = size + 'px';
                    try {
                        range.surroundContents(span);
                    } catch (e) {
                        document.execCommand('fontSize', false, '7');
                        const fontElements = editableContent.querySelectorAll('font[size="7"]');
                        fontElements.forEach(el => {
                            el.removeAttribute('size');
                            el.style.fontSize = size + 'px';
                        });
                    }
                }
            }
            updateToolbarState();
            autoSave();
        }
    }
}

function formatText(command) {
    const selectedBlock = document.querySelector('.template-block.selected');
    if (selectedBlock && selectedBlock.isContentEditable) {
        const editableContent = selectedBlock.querySelector('[contenteditable="true"]');
        if (editableContent) {
            editableContent.focus();
            document.execCommand(command, false, null);
            updateToolbarState();
            autoSave();
        }
    }
}

function changeTextColor(color) {
    const selectedBlock = document.querySelector('.template-block.selected');
    if (selectedBlock && selectedBlock.isContentEditable) {
        const editableContent = selectedBlock.querySelector('[contenteditable="true"]');
        if (editableContent) {
            editableContent.focus();
            document.execCommand('foreColor', false, color);
            updateToolbarState();
            autoSave();
        }
    }
}

function insertList(type) {
    const selectedBlock = document.querySelector('.template-block.selected');
    if (selectedBlock && selectedBlock.isContentEditable) {
        const editableContent = selectedBlock.querySelector('[contenteditable="true"]');
        if (editableContent) {
            editableContent.focus();
            if (type === 'bullet') {
                document.execCommand('insertUnorderedList', false, null);
            } else if (type === 'numbered') {
                document.execCommand('insertOrderedList', false, null);
            }
            updateToolbarState();
            autoSave();
        }
    }
}

function alignText(alignment) {
    const selectedBlock = document.querySelector('.template-block.selected');
    if (selectedBlock && selectedBlock.isContentEditable) {
        const editableContent = selectedBlock.querySelector('[contenteditable="true"]');
        if (editableContent) {
            editableContent.focus();
            switch (alignment) {
                case 'left':
                    document.execCommand('justifyLeft', false, null);
                    break;
                case 'center':
                    document.execCommand('justifyCenter', false, null);
                    break;
                case 'right':
                    document.execCommand('justifyRight', false, null);
                    break;
                case 'justify':
                    document.execCommand('justifyFull', false, null);
                    break;
            }
            updateToolbarState();
            autoSave();
        }
    }
}

function insertLink() {
    const selectedBlock = document.querySelector('.template-block.selected');
    if (selectedBlock && selectedBlock.isContentEditable) {
        const editableContent = selectedBlock.querySelector('[contenteditable="true"]');
        if (editableContent) {
            editableContent.focus();
            const url = prompt('Enter link URL:');
            if (url) {
                const text = window.getSelection().toString() || prompt('Enter link text:') || url;
                if (window.getSelection().toString()) {
                    document.execCommand('createLink', false, url);
                } else {
                    document.execCommand('insertHTML', false, `<a href="${url}">${text}</a>`);
                }
                updateToolbarState();
                autoSave();
            }
        }
    }
}

// Auto-save functionality with visual feedback
let autoSaveTimeout;
let lastSaveTime = null;

function autoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        const content = getEditorContent();
        // Simulate save to localStorage or API
        localStorage.setItem('template_draft', JSON.stringify({
            content: content,
            timestamp: new Date().toISOString(),
            templateName: document.getElementById('templateName')?.value || 'Untitled Template'
        }));

        lastSaveTime = new Date();
        updateSaveIndicator();
    }, 1000); // Auto-save after 1 second of inactivity
}

function updateSaveIndicator() {
    const indicator = document.getElementById('saveIndicator');
    if (indicator && lastSaveTime) {
        const timeStr = lastSaveTime.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
        indicator.innerHTML = `<i class="fas fa-check-circle text-success me-1"></i>Saved ${timeStr}`;
        indicator.style.display = 'inline-block';
    }
}

function saveTemplate() {
    const content = getEditorContent();
    const templateData = {
        content: content,
        templateName: document.getElementById('templateName')?.value || 'Untitled Template',
        description: document.getElementById('templateDescription')?.value || '',
        category: document.getElementById('templateCategory')?.value || '',
        timestamp: new Date().toISOString(),
        isDraft: false
    };

    // Save to localStorage (in production, this would be an API call)
    localStorage.setItem('template_saved', JSON.stringify(templateData));

    // Show success toast
    showToast('Template saved successfully!', 'success');
    lastSaveTime = new Date();
    updateSaveIndicator();
}

function previewTemplate() {
    const content = getEditorContent();
    const templateName = document.getElementById('templateName')?.value || 'Untitled Template';

    // Show preview in modal
    const previewContent = document.getElementById('previewContent');
    previewContent.innerHTML = `
        <div class="preview-container">
            <h2 class="mb-4">${templateName}</h2>
            <div class="template-preview" style="font-family: 'Inter', sans-serif; line-height: 1.6;">
                ${content}
            </div>
        </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('previewModal'));
    modal.show();
}

// legacy global publishTemplate removed in favor of class method

// Updated toolbar state function
function updateToolbarState() {
    const selectedBlock = document.querySelector('.template-block.selected');
    if (!selectedBlock || !selectedBlock.isContentEditable) {
        return;
    }

    const editableContent = selectedBlock.querySelector('[contenteditable="true"]');
    if (!editableContent) return;

    // Update toolbar button states
    const buttons = document.querySelectorAll('.editor-toolbar .btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Check for bold
    if (document.queryCommandState('bold')) {
        document.querySelector('[onclick*="formatText(\'bold\')"]')?.classList.add('active');
    }

    // Check for italic
    if (document.queryCommandState('italic')) {
        document.querySelector('[onclick*="formatText(\'italic\')"]')?.classList.add('active');
    }

    // Check for underline
    if (document.queryCommandState('underline')) {
        document.querySelector('[onclick*="formatText(\'underline\')"]')?.classList.add('active');
    }
}

function getEditorContent() {
    const templateCanvas = document.getElementById('templateCanvas');
    const blocks = templateCanvas.querySelectorAll('.template-block');
    let content = '';

    blocks.forEach(block => {
        const blockContent = block.querySelector('[contenteditable="true"]');
        if (blockContent) {
            content += blockContent.innerHTML + '\n';
        } else {
            content += block.innerHTML + '\n';
        }
    });

    return content;
}

function setEditorContent(html) {
    const templateCanvas = document.getElementById('templateCanvas');
    templateCanvas.innerHTML = html;
}

function exportTemplate() {
    const content = getEditorContent();
    const templateName = document.getElementById('templateName')?.value || 'template';
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName}.html`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Template exported successfully!', 'success');
}

// Enhanced history functions
let historyStack = [];
let historyIndex = -1;

function undoAction() {
    if (historyIndex > 0) {
        historyIndex--;
        const previousState = historyStack[historyIndex];
        setEditorContent(previousState);
        showToast('Undo successful', 'info');
        autoSave();
    }
}

function redoAction() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        const nextState = historyStack[historyIndex];
        setEditorContent(nextState);
        showToast('Redo successful', 'info');
        autoSave();
    }
}

function saveHistoryState() {
    const currentContent = getEditorContent();
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(currentContent);
    historyIndex++;

    // Limit history size
    if (historyStack.length > 50) {
        historyStack.shift();
        historyIndex--;
    }
}

// Toast system
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    const toastId = 'toast_' + Date.now();

    const toastHtml = `
        <div class="toast" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <i class="fas fa-${type === 'success' ? 'check-circle text-success' : type === 'error' ? 'exclamation-circle text-danger' : 'info-circle text-info'} me-2"></i>
                <strong class="me-auto">${type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">${message}</div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toast = new bootstrap.Toast(document.getElementById(toastId));
    toast.show();

    // Auto-remove after 5 seconds
    setTimeout(() => {
        document.getElementById(toastId)?.remove();
    }, 5000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}

// Initialize when page loads
let templateEditor;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing template editor...');
    templateEditor = new AdvancedTemplateEditor();

    // Initialize file upload
    initializeFileUpload();

    // Initialize sidebar functionality
    initializeSidebars();

    // Initialize toolbar state updates only for selected blocks
    const templateCanvas = document.getElementById('templateCanvas');

    // Wait for templateEditor to be fully initialized, then load template from URL
    setTimeout(() => {
        console.log('TemplateEditor initialized, checking for URL template...');
        loadTemplateFromURL();
    }, 300);

    // Set up event listeners for the editor
    const editorElement = document.getElementById('editor');
    if (editorElement) {
        // Update toolbar state when selection changes
        editorElement.addEventListener('mouseup', updateToolbarState);
        editorElement.addEventListener('keyup', updateToolbarState);
        editorElement.addEventListener('focus', updateToolbarState);

        // Update state on paste operations
        editorElement.addEventListener('paste', function () {
            setTimeout(updateToolbarState, 100);
        });

        // Auto-save on content changes
        editorElement.addEventListener('input', debounce(autoSaveTemplate, 2000));
    }

    // Initialize active states for any pre-selected formatting
    updateToolbarState();

    // Load any saved draft (but only if no URL template)
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('template')) {
        loadSavedDraft();
    }

    console.log('FormatFlow template editor fully initialized');
});
// Safely attach canvas-level listeners when element exists
(() => {
    const tc = document.getElementById('templateCanvas');
    if (!tc) return;
    // Add event delegation for block editing
    tc.addEventListener('click', (e) => {
        const block = e.target.closest('.template-block');
        if (block && block.isContentEditable) {
            updateToolbarState();
        }
    });

    tc.addEventListener('keyup', (e) => {
        const block = e.target.closest('.template-block');
        if (block && block.isContentEditable) {
            updateToolbarState();
            autoSave();
            saveHistoryState();
        }
    });

    tc.addEventListener('mouseup', (e) => {
        const block = e.target.closest('.template-block');
        if (block && block.isContentEditable) {
            updateToolbarState();
        }
    });
})();

// Load saved template if exists
loadSavedTemplate();

// Start autosave indicator updates
setInterval(updateSaveIndicator, 30000); // Update every 30 seconds


// Sidebar functionality
function toggleSidebar(side) {
    const sidebar = document.getElementById(side + 'Sidebar');
    const centerEditor = document.getElementById('centerEditor');
    const toggleBtn = document.getElementById(side + 'Toggle');
    const collapsedToggleBtn = document.getElementById(side + 'CollapsedToggle');
    const mainLayout = document.getElementById('mainLayout');

    if (window.innerWidth <= 768) {
        // Mobile behavior
        sidebar.classList.toggle('sidebar-open');
    } else {
        // Desktop behavior
        sidebar.classList.toggle('sidebar-collapsed');

        if (sidebar.classList.contains('sidebar-collapsed')) {
            // Sidebar is now collapsed
            sidebar.style.width = '50px';
            sidebar.style.minWidth = '50px';

            // Update toggle button icons
            if (toggleBtn) {
                toggleBtn.innerHTML = side === 'left' ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-left"></i>';
            }

            // Update collapsed toggle button icon
            if (collapsedToggleBtn) {
                collapsedToggleBtn.innerHTML = side === 'left' ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-left"></i>';
                collapsedToggleBtn.title = 'Expand Sidebar';
            }
        } else {
            // Sidebar is now expanded
            sidebar.style.width = '300px';
            sidebar.style.minWidth = '300px';

            // Update toggle button icons
            if (toggleBtn) {
                toggleBtn.innerHTML = side === 'left' ? '<i class="fas fa-chevron-left"></i>' : '<i class="fas fa-chevron-right"></i>';
            }

            // Update collapsed toggle button icon
            if (collapsedToggleBtn) {
                collapsedToggleBtn.innerHTML = side === 'left' ? '<i class="fas fa-chevron-left"></i>' : '<i class="fas fa-chevron-right"></i>';
                collapsedToggleBtn.title = 'Toggle Sidebar';
            }
        }

        // Update main layout class for CSS targeting
        const leftSidebar = document.getElementById('leftSidebar');
        const rightSidebar = document.getElementById('rightSidebar');

        // Remove all layout classes first
        mainLayout.classList.remove('left-collapsed', 'right-collapsed', 'both-collapsed');

        // Add appropriate classes based on current state
        const leftCollapsed = leftSidebar.classList.contains('sidebar-collapsed');
        const rightCollapsed = rightSidebar.classList.contains('sidebar-collapsed');

        if (leftCollapsed && rightCollapsed) {
            mainLayout.classList.add('both-collapsed');
        } else if (leftCollapsed) {
            mainLayout.classList.add('left-collapsed');
        } else if (rightCollapsed) {
            mainLayout.classList.add('right-collapsed');
        }
    }
}

function initializeSidebars() {
    // Close mobile sidebars when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const leftSidebar = document.getElementById('leftSidebar');
            const rightSidebar = document.getElementById('rightSidebar');

            if (!leftSidebar.contains(e.target) && !e.target.closest('[onclick*="toggleSidebar"]')) {
                leftSidebar.classList.remove('sidebar-open');
            }

            if (!rightSidebar.contains(e.target) && !e.target.closest('[onclick*="toggleSidebar"]')) {
                rightSidebar.classList.remove('sidebar-open');
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            document.getElementById('leftSidebar').classList.remove('sidebar-open');
            document.getElementById('rightSidebar').classList.remove('sidebar-open');
        }
    });
}

// Enhanced File Upload System
function initializeFileUpload() {
    const uploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    const filesList = document.getElementById('filesList');
    const clearBtn = document.getElementById('clearFilesBtn');

    // Click to upload
    uploadArea.addEventListener('click', () => fileInput.click());

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Clear all files
    clearBtn.addEventListener('click', clearAllFiles);
}

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (validateFile(file)) {
            uploadFile(file);
        }
    });
}

function validateFile(file) {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
        showToast('File type not supported: ' + file.name, 'error');
        return false;
    }

    if (file.size > maxSize) {
        showToast('File too large: ' + file.name, 'error');
        return false;
    }

    return true;
}

function uploadFile(file) {
    const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const fileItem = createFileItem(file, fileId);

    document.getElementById('filesList').appendChild(fileItem);
    document.getElementById('clearFilesBtn').style.display = 'inline-block';

    // Simulate upload progress
    simulateUpload(fileId, file);
}

function createFileItem(file, fileId) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item uploading';
    fileItem.id = fileId;

    const fileIcon = getFileIcon(file.type);
    const fileSize = formatFileSize(file.size);

    fileItem.innerHTML = `
        <div class="file-info">
            <div class="file-icon">${fileIcon}</div>
            <div>
                <div class="file-name">${file.name}</div>
                <div class="file-size">${fileSize}</div>
            </div>
        </div>
        <div class="file-actions">
            <button class="btn btn-sm btn-outline-primary" onclick="previewFile('${fileId}')" title="Preview">
                <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="removeFile('${fileId}')" title="Remove">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="upload-progress"></div>
    `;

    return fileItem;
}

function getFileIcon(fileType) {
    if (fileType.includes('pdf')) return '<i class="fas fa-file-pdf text-danger"></i>';
    if (fileType.includes('word')) return '<i class="fas fa-file-word text-primary"></i>';
    if (fileType.includes('text')) return '<i class="fas fa-file-alt text-secondary"></i>';
    if (fileType.includes('image')) return '<i class="fas fa-file-image text-success"></i>';
    return '<i class="fas fa-file text-muted"></i>';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function simulateUpload(fileId, file) {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            completeUpload(fileId, file);
        }
        updateUploadProgress(fileId, progress);
    }, 200);
}

function updateUploadProgress(fileId, progress) {
    const fileItem = document.getElementById(fileId);
    const progressBar = fileItem.querySelector('.upload-progress');
    progressBar.style.transform = `scaleX(${progress / 100})`;
}

function completeUpload(fileId, file) {
    const fileItem = document.getElementById(fileId);
    fileItem.classList.remove('uploading');

    // Store file data (in production, this would be saved to server)
    fileItem.dataset.fileData = JSON.stringify({
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString()
    });

    showToast(`File uploaded successfully: ${file.name}`, 'success');
}

function removeFile(fileId) {
    const fileItem = document.getElementById(fileId);
    fileItem.remove();

    // Hide clear button if no files
    const filesList = document.getElementById('filesList');
    if (filesList.children.length === 0) {
        document.getElementById('clearFilesBtn').style.display = 'none';
    }

    showToast('File removed', 'info');
}

function clearAllFiles() {
    document.getElementById('filesList').innerHTML = '';
    document.getElementById('clearFilesBtn').style.display = 'none';
    showToast('All files cleared', 'info');
}

function previewFile(fileId) {
    const fileItem = document.getElementById(fileId);
    const fileData = JSON.parse(fileItem.dataset.fileData);
    showToast(`Preview: ${fileData.name}`, 'info');
    // In production, this would open the file preview
}

// Enhanced Chapter System
function addNewChapter() {
    const chapterId = 'chapter_' + Date.now();
    const chapterTitle = prompt('Enter chapter title:') || 'New Chapter';

    const chapter = {
        id: chapterId,
        title: chapterTitle,
        order: document.querySelectorAll('.chapter-card').length + 1
    };

    const chapterCard = createChapterCard(chapter);
    document.getElementById('chaptersContainer').appendChild(chapterCard);

    showToast(`Chapter "${chapterTitle}" added`, 'success');
    autoSave();
}

function createChapterCard(chapter) {
    const card = document.createElement('div');
    card.className = 'chapter-card border rounded p-3 mb-2';
    card.id = chapter.id;

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <h6 class="mb-1">${chapter.title}</h6>
                <small class="text-muted">Chapter ${chapter.order}</small>
            </div>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-danger" onclick="deleteChapter('${chapter.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    return card;
}

function editChapter(chapterId) {
    const chapterCard = document.getElementById(chapterId);
    const titleElement = chapterCard.querySelector('h6');
    const newTitle = prompt('Enter new chapter title:', titleElement.textContent);

    if (newTitle) {
        titleElement.textContent = newTitle;
        showToast('Chapter updated', 'success');
        autoSave();
    }
}

function deleteChapter(chapterId) {
    if (confirm('Are you sure you want to delete this chapter?')) {
        document.getElementById(chapterId).remove();
        showToast('Chapter deleted', 'info');
        autoSave();
    }
}

// Enhanced Modal Functions
function confirmPublish() {
    const title = document.getElementById('publishTitle').value;
    const description = document.getElementById('publishDescription').value;
    const category = document.getElementById('publishCategory').value;
    const featured = document.getElementById('publishFeatured').checked;

    if (!title || !description || !category) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    const templateData = {
        title,
        description,
        category,
        featured,
        content: getEditorContent(),
        publishedAt: new Date().toISOString(),
        status: 'published'
    };

    // Save to localStorage (in production, this would be an API call)
    localStorage.setItem('published_template', JSON.stringify(templateData));

    const modal = bootstrap.Modal.getInstance(document.getElementById('publishModal'));
    modal.hide();

    showToast('Template published successfully!', 'success');
}

function loadSavedTemplate() {
    const saved = localStorage.getItem('template_draft');
    if (saved) {
        const data = JSON.parse(saved);
        document.getElementById('templateName').value = data.templateName || '';
        lastSaveTime = new Date(data.timestamp);
        updateSaveIndicator();
    }
}

// Close editor function
function closeEditor() {
    if (confirm('Are you sure you want to close the editor? Any unsaved changes will be lost.')) {
        window.location.href = 'dashboard.html';
    }
}

// Template Variables Functions
function insertVariable(variableName) {
    const selectedBlock = document.querySelector('.template-block.selected');
    if (selectedBlock) {
        const editableContent = selectedBlock.querySelector('[contenteditable="true"]');
        if (editableContent) {
            editableContent.focus();
            const variable = `{${variableName}}`;
            document.execCommand('insertText', false, variable);
            autoSave();
            showToast(`Variable "${variableName}" inserted`, 'success');
        }
    } else {
        showToast('Please select a block first', 'warning');
    }
}

function addCustomVariable() {
    const variableName = document.getElementById('customVariableName').value.trim();
    if (!variableName) {
        showToast('Please enter a variable name', 'warning');
        return;
    }

    const container = document.getElementById('customVariablesContainer');
    const variableButton = document.createElement('button');
    variableButton.className = 'btn btn-outline-info btn-sm w-100 mb-2';
    variableButton.onclick = () => insertVariable(variableName);
    variableButton.innerHTML = `<i class="fas fa-variable me-2"></i>{${variableName}}`;

    container.appendChild(variableButton);
    document.getElementById('customVariableName').value = '';

    showToast(`Custom variable "${variableName}" added`, 'success');
}

// Authors Management Functions
function addAuthor() {
    // Populate author select with demo data
    const authorSelect = document.getElementById('authorSelect');
    authorSelect.innerHTML = `
        <option value="">Choose an author...</option>
        <option value="john.doe">John Doe</option>
        <option value="jane.smith">Jane Smith</option>
        <option value="mike.johnson">Mike Johnson</option>
        <option value="sarah.williams">Sarah Williams</option>
    `;

    // Populate section checkboxes
    const sectionCheckboxes = document.getElementById('sectionCheckboxes');
    sectionCheckboxes.innerHTML = `
        <div class="form-check">
            <input class="form-check-input" type="checkbox" value="introduction" id="section1">
            <label class="form-check-label" for="section1">Introduction</label>
        </div>
        <div class="form-check">
            <input class="form-check-input" type="checkbox" value="methodology" id="section2">
            <label class="form-check-label" for="section2">Methodology</label>
        </div>
        <div class="form-check">
            <input class="form-check-input" type="checkbox" value="results" id="section3">
            <label class="form-check-label" for="section3">Results</label>
        </div>
        <div class="form-check">
            <input class="form-check-input" type="checkbox" value="conclusion" id="section4">
            <label class="form-check-label" for="section4">Conclusion</label>
        </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('addAuthorModal'));
    modal.show();
}

function confirmAddAuthor() {
    const authorId = document.getElementById('authorSelect').value;
    const role = document.getElementById('authorRole').value;

    if (!authorId || !role) {
        showToast('Please select an author and role', 'warning');
        return;
    }

    const selectedSections = Array.from(document.querySelectorAll('#sectionCheckboxes input:checked'))
        .map(cb => cb.value);

    const authorData = {
        id: authorId,
        role: role,
        sections: selectedSections,
        assignedAt: new Date().toISOString()
    };

    // Add to authors container
    const authorsContainer = document.getElementById('authorsContainer');
    const authorCard = createAuthorCard(authorData);
    authorsContainer.appendChild(authorCard);

    const modal = bootstrap.Modal.getInstance(document.getElementById('addAuthorModal'));
    modal.hide();

    showToast(`Author ${authorId} assigned as ${role}`, 'success');
    autoSave();
}

function createAuthorCard(authorData) {
    const card = document.createElement('div');
    card.className = 'card mb-2';
    card.innerHTML = `
        <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h6 class="card-title mb-1">${authorData.id}</h6>
                    <small class="text-muted">${authorData.role}</small>
                    ${authorData.sections.length > 0 ? `
                        <div class="mt-2">
                            <small class="text-muted">Sections: ${authorData.sections.join(', ')}</small>
                        </div>
                    ` : ''}
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="removeAuthor(this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    return card;
}

function removeAuthor(button) {
    if (confirm('Remove this author assignment?')) {
        button.closest('.card').remove();
        showToast('Author removed', 'info');
        autoSave();
    }
}

// File Integration Functions
function extractTextFromFiles() {
    const files = document.querySelectorAll('#filesList .file-item');
    if (files.length === 0) {
        showToast('No files uploaded', 'warning');
        return;
    }

    // Simulate text extraction
    let extractedText = '';
    files.forEach(file => {
        const fileName = file.querySelector('.file-name').textContent;
        extractedText += `\n\n--- Content from ${fileName} ---\n`;
        extractedText += 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    });

    // Add as new paragraph block
    templateEditor.addContentBlock('paragraph');
    const newBlock = document.querySelector('.template-block:last-child [contenteditable="true"]');
    if (newBlock) {
        newBlock.innerHTML = extractedText.trim();
    }

    showToast('Text extracted and added to template', 'success');
}

function insertAsImages() {
    const imageFiles = Array.from(document.querySelectorAll('#filesList .file-item'))
        .filter(file => file.querySelector('.file-icon i').classList.contains('fa-file-image'));

    if (imageFiles.length === 0) {
        showToast('No image files found', 'warning');
        return;
    }

    imageFiles.forEach(file => {
        templateEditor.addContentBlock('image');
        // In production, this would use the actual file URL
    });

    showToast(`${imageFiles.length} image blocks added`, 'success');
}

function createTemplateFromFile() {
    const files = document.querySelectorAll('#filesList .file-item');
    if (files.length === 0) {
        showToast('No files uploaded', 'warning');
        return;
    }

    // Auto-generate template structure
    templateEditor.addContentBlock('title');
    templateEditor.addContentBlock('paragraph');
    templateEditor.addContentBlock('subtitle');
    templateEditor.addContentBlock('paragraph');
    templateEditor.addContentBlock('quote');

    showToast('Template structure auto-generated from files', 'success');
}

// NOTE: Enhanced toolbar functions are implemented below at line ~3526

function changeFontSize(size) {
    document.execCommand('fontSize', false, '7');
    const fontElements = document.getElementsByTagName('font');
    for (let i = 0; i < fontElements.length; i++) {
        if (fontElements[i].size === '7') {
            fontElements[i].removeAttribute('size');
            fontElements[i].style.fontSize = size + 'px';
        }
    }
}

function changeTextColor(color) {
    document.execCommand('foreColor', false, color);
}

function updateImageSrc(src) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const img = range.commonAncestorContainer.querySelector ?
            range.commonAncestorContainer.querySelector('img') :
            range.commonAncestorContainer.parentElement.querySelector('img');
        if (img) {
            img.src = src;
        }
    }
}

function alignImage(alignment) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const img = range.commonAncestorContainer.querySelector ?
            range.commonAncestorContainer.querySelector('img') :
            range.commonAncestorContainer.parentElement.querySelector('img');
        if (img) {
            img.style.display = 'block';
            img.style.margin = alignment === 'center' ? '0 auto' :
                alignment === 'right' ? '0 0 0 auto' :
                    '0 auto 0 0';
        }
    }
}

function resizeImage(size) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const img = range.commonAncestorContainer.querySelector ?
            range.commonAncestorContainer.querySelector('img') :
            range.commonAncestorContainer.parentElement.querySelector('img');
        if (img) {
            img.style.width = size;
            img.style.height = 'auto';
        }
    }
}

function toggleSidebar(side) {
    const sidebar = document.getElementById(side === 'left' ? 'leftSidebar' : 'rightSidebar');
    const centerEditor = document.getElementById('centerEditor');
    const toggleButton = document.getElementById(side === 'left' ? 'leftToggle' : 'rightToggle');
    const toggleIcon = toggleButton.querySelector('i');

    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');

    if (isCollapsed) {
        // Expand sidebar
        sidebar.classList.remove('sidebar-collapsed');
        centerEditor.classList.remove('center-editor-expanded');

        // Update toggle button icon
        if (side === 'left') {
            toggleIcon.className = 'fas fa-chevron-left';
        } else {
            toggleIcon.className = 'fas fa-chevron-right';
        }

        // Remove mobile class if present
        sidebar.classList.remove('sidebar-open');
    } else {
        // Collapse sidebar
        sidebar.classList.add('sidebar-collapsed');
        centerEditor.classList.add('center-editor-expanded');

        // Update toggle button icon
        if (side === 'left') {
            toggleIcon.className = 'fas fa-chevron-right';
        } else {
            toggleIcon.className = 'fas fa-chevron-left';
        }
    }

    // Handle mobile responsiveness
    if (window.innerWidth <= 768) {
        if (isCollapsed) {
            sidebar.classList.add('sidebar-open');
        } else {
            sidebar.classList.remove('sidebar-open');
        }
    }
}

function initializeSidebars() {
    // Handle window resize for responsive behavior
    window.addEventListener('resize', () => {
        const leftSidebar = document.getElementById('leftSidebar');
        const rightSidebar = document.getElementById('rightSidebar');

        if (window.innerWidth > 768) {
            // Desktop: remove mobile classes
            leftSidebar.classList.remove('sidebar-open');
            rightSidebar.classList.remove('sidebar-open');
        } else {
            // Mobile: ensure collapsed sidebars are hidden
            if (leftSidebar.classList.contains('sidebar-collapsed')) {
                leftSidebar.classList.remove('sidebar-open');
            }
            if (rightSidebar.classList.contains('sidebar-collapsed')) {
                rightSidebar.classList.remove('sidebar-open');
            }
        }
    });

    // Initialize sidebar toggle button states
    const leftToggle = document.getElementById('leftToggle');
    const rightToggle = document.getElementById('rightToggle');

    if (leftToggle) {
        leftToggle.setAttribute('title', 'Toggle Left Sidebar');
    }
    if (rightToggle) {
        rightToggle.setAttribute('title', 'Toggle Right Sidebar');
    }
}

// Enhanced Toolbar Functions for FormatFlow
function changeFontFamily(fontFamily) {
    document.execCommand('fontName', false, fontFamily);

    // Update active state
    const fontSelect = document.querySelector('select[onchange*="changeFontFamily"]');
    if (fontSelect) {
        fontSelect.classList.add('active');
        setTimeout(() => fontSelect.classList.remove('active'), 1000);
    }

    saveFormattingState();
}

function changeFontSize(size) {
    document.execCommand('fontSize', false, '3');
    const fontElements = document.getSelection().getRangeAt(0).commonAncestorContainer;
    if (fontElements.nodeType === 1) {
        fontElements.style.fontSize = size + 'px';
    } else if (fontElements.parentNode.nodeType === 1) {
        fontElements.parentNode.style.fontSize = size + 'px';
    }

    // Update active state
    const sizeInput = document.querySelector('input[onchange*="changeFontSize"]');
    if (sizeInput) {
        sizeInput.classList.add('active');
        setTimeout(() => sizeInput.classList.remove('active'), 1000);
    }

    saveFormattingState();
}

function formatText(command) {
    document.execCommand(command, false, null);
    updateToolbarState();
    saveFormattingState();
}

function formatBlock(tag) {
    if (tag) {
        document.execCommand('formatBlock', false, tag);
    } else {
        document.execCommand('formatBlock', false, 'p');
    }

    // Update active state for style dropdown
    const styleSelect = document.querySelector('select[onchange*="formatBlock"]');
    if (styleSelect) {
        styleSelect.classList.add('active');
        setTimeout(() => styleSelect.classList.remove('active'), 1000);
    }

    saveFormattingState();
}

function changeTextColor(color) {
    document.execCommand('foreColor', false, color);

    // Update active state
    const colorInput = document.querySelector('input[onchange*="changeTextColor"]');
    if (colorInput) {
        colorInput.classList.add('active');
        setTimeout(() => colorInput.classList.remove('active'), 1500);
    }

    saveFormattingState();
}

function alignText(alignment) {
    // First remove active state from all alignment buttons
    document.querySelectorAll('[onclick*="alignText"]').forEach(btn => {
        btn.classList.remove('active');
    });

    let command;
    switch (alignment) {
        case 'left': command = 'justifyLeft'; break;
        case 'center': command = 'justifyCenter'; break;
        case 'right': command = 'justifyRight'; break;
        case 'justify': command = 'justifyFull'; break;
    }
    document.execCommand(command, false, null);

    // Add active state to clicked alignment button
    const alignButton = document.querySelector(`[onclick*="alignText('${alignment}')"]`);
    if (alignButton) {
        alignButton.classList.add('active');
    }

    saveFormattingState();
}

function insertList(type) {
    const command = type === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList';
    document.execCommand(command, false, null);

    // Toggle active state for list buttons
    const listButton = document.querySelector(`[onclick*="insertList('${type}')"]`);
    if (listButton) {
        const isActive = document.queryCommandState(command);
        listButton.classList.toggle('active', isActive);
    }

    saveFormattingState();
}

function insertLink() {
    const url = prompt('Enter the URL:');
    if (url) {
        document.execCommand('createLink', false, url);

        // Briefly highlight link button
        const linkButton = document.querySelector('[onclick*="insertLink"]');
        if (linkButton) {
            linkButton.classList.add('active');
            setTimeout(() => linkButton.classList.remove('active'), 1000);
        }

        saveFormattingState();
    }
}

function updateToolbarState() {
    // Update formatting button states based on current selection
    const formatButtons = [
        { command: 'bold', selector: '[onclick*="formatText(\'bold\')"]' },
        { command: 'italic', selector: '[onclick*="formatText(\'italic\')"]' },
        { command: 'underline', selector: '[onclick*="formatText(\'underline\')"]' }
    ];

    formatButtons.forEach(({ command, selector }) => {
        const button = document.querySelector(selector);
        if (button) {
            const isActive = document.queryCommandState(command);
            button.classList.toggle('active', isActive);
        }
    });

    // Update alignment states
    const alignStates = {
        'justifyLeft': 'left',
        'justifyCenter': 'center',
        'justifyRight': 'right',
        'justifyFull': 'justify'
    };

    // Remove all alignment active states first
    document.querySelectorAll('[onclick*="alignText"]').forEach(btn => {
        btn.classList.remove('active');
    });

    // Check which alignment is active
    Object.entries(alignStates).forEach(([command, alignment]) => {
        if (document.queryCommandState(command)) {
            const alignButton = document.querySelector(`[onclick*="alignText('${alignment}')"]`);
            if (alignButton) {
                alignButton.classList.add('active');
            }
        }
    });

    // Update list states
    const listButtons = [
        { command: 'insertUnorderedList', type: 'bullet' },
        { command: 'insertOrderedList', type: 'numbered' }
    ];

    listButtons.forEach(({ command, type }) => {
        const button = document.querySelector(`[onclick*="insertList('${type}')"]`);
        if (button) {
            const isActive = document.queryCommandState(command);
            button.classList.toggle('active', isActive);
        }
    });
}

function saveFormattingState() {
    // Auto-save functionality (will implement with persistent storage)
    if (templateEditor && templateEditor.saveState) {
        templateEditor.saveState();
    }
}

// ===== TEMPLATE LOADING AND MANAGEMENT SYSTEM =====

// Template Loading System
function loadTemplateFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const templateType = urlParams.get('template');
    
    console.log('URL search params:', window.location.search);
    console.log('Template parameter received:', templateType);

    if (templateType) {
        loadPredefinedTemplate(templateType);
    }
}

function loadPredefinedTemplate(templateType) {
    console.log('Loading predefined template:', templateType);

    const templates = {
        'research-paper': {
            name: 'Research Paper (IEEE Format)',
            content: generateResearchPaperTemplate(),
            description: 'IEEE format research paper with standard sections and formatting'
        },
        'resume-cv': {
            name: 'Professional Resume/CV',
            content: generateResumeTemplate(),
            description: 'Professional resume template with modern formatting'
        },
        'academic-chapter': {
            name: 'Academic Chapter',
            content: generateAcademicChapterTemplate(),
            description: 'Academic book chapter with proper sectioning and references'
        },
        'blank': {
            name: 'Blank Document',
            content: generateBlankTemplate(),
            description: 'Clean blank document ready for customization'
        }
    };

    console.log('Available templates:', Object.keys(templates));
    console.log('Looking for template:', templateType);
    const template = templates[templateType];
    if (template) {
        console.log('Template found:', template.name);

        // Update template name field
        const nameField = document.getElementById('templateName');
        if (nameField) {
            nameField.value = template.name;
        }

        // Update description field
        const descField = document.getElementById('templateDescription');
        if (descField) {
            descField.value = template.description;
        }

        // Load template content into editor
        const editorElement = document.getElementById('editor');
        if (editorElement) {
            editorElement.innerHTML = template.content;
            console.log('Template content loaded into editor');
        }

        // Auto-generate blocks in canvas based on template structure
        generateTemplateBlocks(templateType, template.content).then(() => {
            // Show success feedback only after blocks are generated
            showToast(`Template "${template.name}" loaded with blocks successfully!`, 'success');
            
            // Save as draft
            autoSaveTemplate();
            
            // Update toolbar state
            setTimeout(updateToolbarState, 500);
        }).catch((error) => {
            console.error('Block generation failed:', error);
            showToast(`Template "${template.name}" loaded but blocks generation failed`, 'warning');
            
            // Still save and update toolbar even if blocks failed
            autoSaveTemplate();
            setTimeout(updateToolbarState, 500);
        });
    } else {
        console.error('Template not found:', templateType);
        showToast('Template not found', 'error');
    }
}

// Template Content Generators
function generateResearchPaperTemplate() {
    return `
        <div style="font-family: 'Times New Roman', serif; line-height: 1.6; max-width: 8.5in; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="font-size: 18pt; font-weight: bold; margin-bottom: 20px;">Research Paper Title</h1>
                <p style="font-size: 12pt; margin-bottom: 10px;"><strong>Author Name</strong></p>
                <p style="font-size: 11pt; font-style: italic;">Institution/University</p>
                <p style="font-size: 11pt;">email@university.edu</p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h2 style="font-size: 12pt; font-weight: bold; margin-bottom: 10px;">Abstract</h2>
                <p style="font-size: 11pt; text-align: justify; font-style: italic;">
                    This paper presents... [Your abstract content here - typically 150-250 words summarizing the research objectives, methodology, key findings, and conclusions.]
                </p>
                <p style="font-size: 11pt; margin-top: 10px;"><strong>Keywords:</strong> keyword1, keyword2, keyword3, keyword4</p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h2 style="font-size: 12pt; font-weight: bold; margin-bottom: 10px;">1. Introduction</h2>
                <p style="font-size: 11pt; text-align: justify;">
                    The introduction should provide background information and clearly state the research problem, objectives, and contribution...
                </p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h2 style="font-size: 12pt; font-weight: bold; margin-bottom: 10px;">2. Literature Review</h2>
                <p style="font-size: 11pt; text-align: justify;">
                    Review of relevant previous work and how this research builds upon or differs from existing studies...
                </p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h2 style="font-size: 12pt; font-weight: bold; margin-bottom: 10px;">3. Methodology</h2>
                <p style="font-size: 11pt; text-align: justify;">
                    Detailed description of the research methodology, experimental setup, data collection procedures...
                </p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h2 style="font-size: 12pt; font-weight: bold; margin-bottom: 10px;">4. Results and Discussion</h2>
                <p style="font-size: 11pt; text-align: justify;">
                    Presentation and analysis of results, including figures, tables, and statistical analysis...
                </p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h2 style="font-size: 12pt; font-weight: bold; margin-bottom: 10px;">5. Conclusion</h2>
                <p style="font-size: 11pt; text-align: justify;">
                    Summary of key findings, implications, limitations, and suggestions for future research...
                </p>
            </div>
            
            <div>
                <h2 style="font-size: 12pt; font-weight: bold; margin-bottom: 10px;">References</h2>
                <p style="font-size: 10pt; margin-bottom: 5px;">[1] Author, A. A. (Year). Title of work. Journal Name, Volume(Issue), pages.</p>
                <p style="font-size: 10pt; margin-bottom: 5px;">[2] Author, B. B., & Author, C. C. (Year). Title of work. Conference Proceedings, pages.</p>
            </div>
        </div>
    `;
}

function generateResumeTemplate() {
    return `
        <div style="font-family: 'Arial', sans-serif; line-height: 1.4; max-width: 8.5in; margin: 0 auto;">
            <header style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 25px;">
                <h1 style="font-size: 28pt; font-weight: bold; margin-bottom: 10px; color: #333;">Your Full Name</h1>
                <p style="font-size: 12pt; margin-bottom: 5px;">Email: your.email@domain.com | Phone: (123) 456-7890</p>
                <p style="font-size: 12pt;">LinkedIn: linkedin.com/in/yourprofile | Location: City, State</p>
            </header>
            
            <section style="margin-bottom: 25px;">
                <h2 style="font-size: 14pt; font-weight: bold; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">Professional Summary</h2>
                <p style="font-size: 11pt; text-align: justify;">
                    Experienced professional with [X] years in [your field]. Proven track record of [key achievements]. 
                    Expertise in [key skills/technologies]. Seeking to leverage [relevant skills] in a [target position] role.
                </p>
            </section>
            
            <section style="margin-bottom: 25px;">
                <h2 style="font-size: 14pt; font-weight: bold; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">Experience</h2>
                
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <h3 style="font-size: 12pt; font-weight: bold; margin-bottom: 5px;">Job Title</h3>
                        <span style="font-size: 11pt; color: #666;">Start Date - End Date</span>
                    </div>
                    <p style="font-size: 11pt; font-weight: bold; margin-bottom: 8px;">Company Name, Location</p>
                    <ul style="font-size: 11pt; margin-left: 20px;">
                        <li>Achievement or responsibility with quantifiable results</li>
                        <li>Another key accomplishment that demonstrates your impact</li>
                        <li>Technical skills or projects you worked on</li>
                    </ul>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <h3 style="font-size: 12pt; font-weight: bold; margin-bottom: 5px;">Previous Job Title</h3>
                        <span style="font-size: 11pt; color: #666;">Start Date - End Date</span>
                    </div>
                    <p style="font-size: 11pt; font-weight: bold; margin-bottom: 8px;">Previous Company Name, Location</p>
                    <ul style="font-size: 11pt; margin-left: 20px;">
                        <li>Key achievement or responsibility</li>
                        <li>Another accomplishment with specific results</li>
                    </ul>
                </div>
            </section>
            
            <section style="margin-bottom: 25px;">
                <h2 style="font-size: 14pt; font-weight: bold; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">Education</h2>
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <div>
                        <h3 style="font-size: 12pt; font-weight: bold; margin-bottom: 5px;">Degree Title</h3>
                        <p style="font-size: 11pt;">University Name, Location</p>
                    </div>
                    <span style="font-size: 11pt; color: #666;">Graduation Year</span>
                </div>
            </section>
            
            <section style="margin-bottom: 25px;">
                <h2 style="font-size: 14pt; font-weight: bold; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px;">Skills</h2>
                <p style="font-size: 11pt;">
                    <strong>Technical:</strong> List your technical skills here<br>
                    <strong>Languages:</strong> Programming languages, spoken languages<br>
                    <strong>Tools:</strong> Software, platforms, frameworks you're proficient in
                </p>
            </section>
        </div>
    `;
}

function generateAcademicChapterTemplate() {
    return `
        <div style="font-family: 'Times New Roman', serif; line-height: 1.6; max-width: 7in; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="font-size: 20pt; font-weight: bold; margin-bottom: 30px;">Chapter Title</h1>
                <p style="font-size: 14pt; margin-bottom: 10px;">Author Name</p>
                <p style="font-size: 12pt; font-style: italic;">Institution Affiliation</p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 16pt; font-weight: bold; margin-bottom: 15px;">Abstract</h2>
                <p style="font-size: 12pt; text-align: justify; font-style: italic;">
                    This chapter examines... [Provide a comprehensive abstract of 200-300 words summarizing the chapter's main arguments, methodology, and contributions to the field.]
                </p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 16pt; font-weight: bold; margin-bottom: 15px;">1. Introduction</h2>
                <p style="font-size: 12pt; text-align: justify;">
                    This chapter explores the fundamental concepts of [topic area]. The significance of this research lies in its potential to [explain importance]. 
                    The following sections will examine [outline of chapter structure]...
                </p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 16pt; font-weight: bold; margin-bottom: 15px;">2. Theoretical Framework</h2>
                <p style="font-size: 12pt; text-align: justify;">
                    The theoretical foundation for this work draws upon [relevant theories]. Key concepts include...
                </p>
                
                <h3 style="font-size: 14pt; font-weight: bold; margin: 20px 0 10px 0;">2.1 Core Concepts</h3>
                <p style="font-size: 12pt; text-align: justify;">
                    Detailed explanation of fundamental concepts and their relationships...
                </p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 16pt; font-weight: bold; margin-bottom: 15px;">3. Methodology</h2>
                <p style="font-size: 12pt; text-align: justify;">
                    This research employs [research methodology] to investigate [research questions]. The approach combines...
                </p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 16pt; font-weight: bold; margin-bottom: 15px;">4. Analysis and Discussion</h2>
                <p style="font-size: 12pt; text-align: justify;">
                    The analysis reveals several key findings. First, [finding 1]. Second, [finding 2]. These results suggest...
                </p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 16pt; font-weight: bold; margin-bottom: 15px;">5. Implications and Future Directions</h2>
                <p style="font-size: 12pt; text-align: justify;">
                    The findings of this chapter have several important implications for [field/practice]. Future research should consider...
                </p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 16pt; font-weight: bold; margin-bottom: 15px;">6. Conclusion</h2>
                <p style="font-size: 12pt; text-align: justify;">
                    This chapter has examined [summary of key points]. The contributions include [list key contributions]. 
                    The work opens new avenues for [future research directions]...
                </p>
            </div>
            
            <div>
                <h2 style="font-size: 16pt; font-weight: bold; margin-bottom: 15px;">References</h2>
                <div style="font-size: 11pt; line-height: 1.4;">
                    <p style="margin-bottom: 8px; text-indent: -0.5in; margin-left: 0.5in;">Author, A. A. (2023). <em>Title of Book</em>. Publisher.</p>
                    <p style="margin-bottom: 8px; text-indent: -0.5in; margin-left: 0.5in;">Author, B. B. (2022). Title of article. <em>Journal Name</em>, 45(2), 123-145.</p>
                    <p style="margin-bottom: 8px; text-indent: -0.5in; margin-left: 0.5in;">Author, C. C., & Author, D. D. (2021). Chapter title. In E. E. Editor (Ed.), <em>Book Title</em> (pp. 67-89). Publisher.</p>
                </div>
            </div>
        </div>
    `;
}

function generateBlankTemplate() {
    return `
        <div style="font-family: 'Inter', sans-serif; line-height: 1.6; max-width: 8.5in; margin: 0 auto; padding: 40px;">
            <h1 style="font-size: 24pt; font-weight: 600; margin-bottom: 30px; color: #333;" contenteditable="true">Document Title</h1>
            
            <p style="font-size: 12pt; margin-bottom: 20px;" contenteditable="true">
                Start writing your content here. This is a clean, professional template ready for customization.
            </p>
            
            <h2 style="font-size: 18pt; font-weight: 500; margin: 30px 0 15px 0; color: #444;" contenteditable="true">Section Heading</h2>
            
            <p style="font-size: 12pt; margin-bottom: 20px;" contenteditable="true">
                Add your content, format it using the toolbar above, and create a professional document.
            </p>
        </div>
    `;
}

// Auto-generate template blocks in canvas based on template structure
function generateTemplateBlocks(templateType, templateContent) {
    console.log('🚀 Starting block generation for template:', templateType);

    return new Promise((resolve, reject) => {
        // Clear existing blocks first
        const templateCanvas = document.getElementById('templateCanvas');
        if (!templateCanvas) {
            console.error('❌ templateCanvas element not found!');
            reject('templateCanvas element not found');
            return;
        }
        
        console.log('✅ templateCanvas found, clearing existing blocks...');
    if (!templateCanvas) {
        console.error('Template canvas not found!');
        return;
    }

    console.log('Template canvas found, clearing existing blocks...');

    // Clear all existing blocks except empty canvas message
    const blocks = templateCanvas.querySelectorAll('.template-block');
    console.log('Found', blocks.length, 'existing blocks to remove');
    blocks.forEach(block => block.remove());

    // Show empty canvas message initially
    const emptyCanvas = templateCanvas.querySelector('.empty-canvas');
    if (emptyCanvas) {
        emptyCanvas.style.display = 'flex';
        console.log('Empty canvas message shown');
    }

    // Wait for templateEditor to be fully initialized
    setTimeout(() => {
        if (typeof templateEditor !== 'undefined' && templateEditor && templateEditor.addContentBlock) {
            console.log('TemplateEditor is ready, generating blocks for:', templateType);

            switch (templateType) {
                case 'research-paper':
                    generateResearchPaperBlocks();
                    break;
                case 'resume-cv':
                    generateResumeBlocks();
                    break;
                case 'academic-chapter':
                    generateAcademicChapterBlocks();
                    break;
                case 'blank':
                    generateBlankDocumentBlocks();
                    break;
                default:
                    console.log('Unknown template type, trying to parse content...');
                    // For any other template, try to parse content automatically
                    parseContentAndGenerateBlocks(templateContent);
                    break;
            }

            // Check how many blocks were created
            const newBlocks = templateCanvas.querySelectorAll('.template-block');
            console.log('Generated', newBlocks.length, 'template blocks');

            if (newBlocks.length > 0) {
                // Hide empty canvas message
                if (emptyCanvas) {
                    emptyCanvas.style.display = 'none';
                }
                console.log(`✅ Successfully generated ${newBlocks.length} template blocks`);
                resolve(newBlocks.length); // Resolve the promise with block count
            } else {
                console.warn('❌ No template blocks were generated');
                reject('No template blocks could be generated');
            }
        } else {
            console.warn('Template editor not ready, retrying...');
            // Retry after another delay
            setTimeout(() => {
                generateTemplateBlocks(templateType, templateContent)
                    .then(resolve)
                    .catch(reject);
            }, 1000);
        }
    }, 800);
    }); // Close the Promise
}

// Generate blocks for Research Paper template
function generateResearchPaperBlocks() {
    if (!templateEditor) {
        console.warn('TemplateEditor not available for Research Paper blocks');
        return;
    }

    console.log('Generating Research Paper blocks...');
    
    // Set flag to suppress individual block notifications
    templateEditor.isLoadingTemplate = true;

    // Title section
    templateEditor.addContentBlock('title');
    updateLastBlockContent('Research Paper Title');

    // Author information
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Author Name\nInstitution/University\nemail@university.edu');

    // Add a divider for visual separation
    templateEditor.addContentBlock('divider');

    // Abstract section
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('Abstract');

    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('This paper presents... [Your abstract content here - typically 150-250 words summarizing the research objectives, methodology, key findings, and conclusions.]');

    // Keywords
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Keywords: keyword1, keyword2, keyword3, keyword4');

    // Introduction
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('1. Introduction');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('The introduction should provide background information and clearly state the research problem, objectives, and contribution...');

    // Literature Review  
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('2. Literature Review');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Review of relevant previous work and how this research builds upon or differs from existing studies...');

    // Methodology
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('3. Methodology');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Detailed description of the research methodology, experimental setup, data collection procedures...');

    // Add a table for methodology data
    templateEditor.addContentBlock('table');
    
    // Results and Discussion
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('4. Results and Discussion');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Presentation and analysis of results, including figures, tables, and statistical analysis...');

    // Add image placeholder for results
    templateEditor.addContentBlock('image');

    // Add a quote block for key findings
    templateEditor.addContentBlock('quote');
    updateLastBlockContent('Key finding: "The results demonstrate a significant improvement in performance metrics."');

    // Conclusion
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('5. Conclusion');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Summary of key findings, implications, limitations, and suggestions for future research...');

    // References
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('References');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('[1] Author, A. A. (Year). Title of work. Journal Name, Volume(Issue), pages.\n[2] Author, B. B., & Author, C. C. (Year). Title of work. Conference Proceedings, pages.');

    console.log('Research Paper blocks generation completed');
    
    // Reset flag to allow individual block notifications again
    templateEditor.isLoadingTemplate = false;
}

// Generate blocks for Resume/CV template
function generateResumeBlocks() {
    if (!templateEditor) {
        console.warn('TemplateEditor not available for Resume blocks');
        return;
    }

    console.log('Generating Resume blocks...');

    // Set flag to suppress individual block notifications
    templateEditor.isLoadingTemplate = true;

    // Header with name
    templateEditor.addContentBlock('title');
    updateLastBlockContent('Your Full Name');

    // Contact information
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Email: your.email@domain.com | Phone: (123) 456-7890\nLinkedIn: linkedin.com/in/yourprofile | Location: City, State');

    // Add divider
    templateEditor.addContentBlock('divider');

    // Professional Summary
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('Professional Summary');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Experienced professional with [X] years in [your field]. Proven track record of [key achievements]. Expertise in [key skills/technologies].');

    // Experience section
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('Experience');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Job Title - Company Name, Location (Start Date - End Date)\n• Achievement or responsibility with quantifiable results\n• Another key accomplishment that demonstrates your impact\n• Technical skills or projects you worked on');

    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Previous Job Title - Previous Company Name, Location (Start Date - End Date)\n• Key achievement or responsibility\n• Another accomplishment with specific results');

    // Education section
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('Education');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Degree Title - University Name, Location (Graduation Year)');

    // Skills section with table
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('Skills');
    templateEditor.addContentBlock('table');

    // Add a quote for personal statement
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('Professional Statement');
    templateEditor.addContentBlock('quote');
    updateLastBlockContent('Dedicated professional committed to excellence and continuous learning in the field.');

    // Certifications/Additional Info
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('Certifications & Additional Information');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('• Certification Name - Issuing Organization (Year)\n• Additional relevant information\n• Languages, volunteer work, etc.');

    console.log('Resume blocks generation completed');
    
    // Reset flag to allow individual block notifications again
    templateEditor.isLoadingTemplate = false;
}

// Generate blocks for Academic Chapter template
function generateAcademicChapterBlocks() {
    if (!templateEditor) return;

    // Set flag to suppress individual block notifications
    templateEditor.isLoadingTemplate = true;

    // Chapter title
    templateEditor.addContentBlock('title');
    updateLastBlockContent('Chapter Title');

    // Author information
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Author Name\nInstitution Affiliation');

    // Add divider
    templateEditor.addContentBlock('divider');

    // Abstract
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('Abstract');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('This chapter examines... [Provide a comprehensive abstract of 200-300 words summarizing the chapter\'s main arguments, methodology, and contributions to the field.]');

    // Introduction
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('1. Introduction');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('This chapter explores the fundamental concepts of [topic area]. The significance of this research lies in its potential to [explain importance].');

    // Theoretical Framework
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('2. Theoretical Framework');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('The theoretical foundation for this work draws upon [relevant theories]. Key concepts include...');

    // Core Concepts subsection
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('2.1 Core Concepts');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Detailed explanation of fundamental concepts and their relationships...');

    // Add a table for concept comparison
    templateEditor.addContentBlock('table');

    // Methodology
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('3. Methodology');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('This research employs [research methodology] to investigate [research questions]. The approach combines...');

    // Analysis and Discussion
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('4. Analysis and Discussion');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('The analysis reveals several key findings. First, [finding 1]. Second, [finding 2]. These results suggest...');

    // Add image placeholder for analysis
    templateEditor.addContentBlock('image');

    // Add quote for key insight
    templateEditor.addContentBlock('quote');
    updateLastBlockContent('Key insight: "The findings suggest a fundamental shift in understanding of [topic area]."');

    // Implications and Future Directions
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('5. Implications and Future Directions');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('The findings of this chapter have several important implications for [field/practice]. Future research should consider...');

    // Conclusion
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('6. Conclusion');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('This chapter has examined [summary of key points]. The contributions include [list key contributions]. The work opens new avenues for [future research directions]...');

    // References
    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('References');
    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Author, A. A. (2023). Title of Book. Publisher.\nAuthor, B. B. (2022). Title of article. Journal Name, 45(2), 123-145.');
    
    // Reset flag to allow individual block notifications again
    templateEditor.isLoadingTemplate = false;
}

// Generate blocks for Blank Document template
function generateBlankDocumentBlocks() {
    if (!templateEditor) {
        console.warn('TemplateEditor not available for Blank Document blocks');
        return;
    }

    console.log('Generating Blank Document blocks...');

    // Set flag to suppress individual block notifications
    templateEditor.isLoadingTemplate = true;

    // Simple starter blocks with variety
    templateEditor.addContentBlock('title');
    updateLastBlockContent('Document Title');

    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Start writing your content here. This is a clean, professional template ready for customization.');

    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('Section Heading');

    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Add your content, format it using the toolbar above, and create a professional document.');

    // Add some diverse content blocks for demonstration
    templateEditor.addContentBlock('image');

    templateEditor.addContentBlock('quote');
    updateLastBlockContent('This is a quote block. Use it to highlight important information or citations.');

    templateEditor.addContentBlock('table');

    templateEditor.addContentBlock('divider');

    templateEditor.addContentBlock('subtitle');
    updateLastBlockContent('Additional Section');

    templateEditor.addContentBlock('paragraph');
    updateLastBlockContent('Continue building your document with various content blocks available in the sidebar.');

    console.log('Blank Document blocks generation completed');
    
    // Reset flag to allow individual block notifications again
    templateEditor.isLoadingTemplate = false;
}

// Helper function to update the last added block's content
function updateLastBlockContent(content) {
    const templateCanvas = document.getElementById('templateCanvas');
    if (templateCanvas) {
        const blocks = templateCanvas.querySelectorAll('.template-block');
        const lastBlock = blocks[blocks.length - 1];

        if (lastBlock) {
            console.log('Updating block content:', content.substring(0, 50) + '...');

            // Find the content editable element in the block
            const contentElement = lastBlock.querySelector('[contenteditable="true"]');
            if (contentElement) {
                // Handle multi-line content (for lists, addresses, etc.)
                if (content.includes('\n')) {
                    const lines = content.split('\n');
                    if (lines.length > 1) {
                        contentElement.innerHTML = lines.map(line =>
                            line.startsWith('•') || line.startsWith('[') ? line : line
                        ).join('<br>');
                    } else {
                        contentElement.textContent = content;
                    }
                } else {
                    contentElement.textContent = content;
                }

                // Trigger change event to update any listeners
                const event = new Event('input', { bubbles: true });
                contentElement.dispatchEvent(event);
            } else {
                // Fallback: try to find any text node
                const textElement = lastBlock.querySelector('h1, h2, h3, p, div');
                if (textElement) {
                    textElement.textContent = content;
                    console.log('Updated fallback text element');
                } else {
                    console.warn('No text element found in block to update');
                }
            }
        } else {
            console.warn('No blocks found to update content');
        }
    } else {
        console.warn('Template canvas not found');
    }
}

// Parse existing content and try to generate blocks automatically
function parseContentAndGenerateBlocks(templateContent) {
    if (!templateEditor || !templateContent) return;

    // Create a temporary div to parse the HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = templateContent;

    // Find all headings and paragraphs
    const elements = tempDiv.querySelectorAll('h1, h2, h3, p, div');

    elements.forEach(element => {
        const tagName = element.tagName.toLowerCase();
        const textContent = element.textContent.trim();

        if (!textContent) return; // Skip empty elements

        // Determine block type based on element
        let blockType = 'paragraph';
        if (tagName === 'h1') {
            blockType = 'title';
        } else if (tagName === 'h2' || tagName === 'h3') {
            blockType = 'subtitle';
        }

        // Add the block
        templateEditor.addContentBlock(blockType);
        updateLastBlockContent(textContent);
    });

    // If no elements were found, add a basic structure
    if (elements.length === 0) {
        templateEditor.addContentBlock('title');
        updateLastBlockContent('Document Title');

        templateEditor.addContentBlock('paragraph');
        updateLastBlockContent('Content will appear here...');
    }
}

// Auto-save and Draft Management
function autoSaveTemplate() {
    const editorContent = document.getElementById('templateCanvas')?.innerHTML || '';
    
    // Get template name from templateEditor.currentTemplate if available, otherwise from DOM
    let templateName = 'Untitled Document';
    if (typeof templateEditor !== 'undefined' && templateEditor && templateEditor.currentTemplate && templateEditor.currentTemplate.name) {
        templateName = templateEditor.currentTemplate.name;
    } else {
        templateName = document.getElementById('templateName')?.value || 'Untitled Document';
    }
    
    // Get template description from templateEditor.currentTemplate if available, otherwise from DOM
    let templateDescription = '';
    if (typeof templateEditor !== 'undefined' && templateEditor && templateEditor.currentTemplate && templateEditor.currentTemplate.description) {
        templateDescription = templateEditor.currentTemplate.description;
    } else {
        templateDescription = document.getElementById('templateDescription')?.value || '';
    }

    console.log('Auto-saving - Canvas content length:', editorContent.length);
    console.log('Auto-saving - Template name:', templateName);
    console.log('Auto-saving - Canvas content preview:', editorContent.substring(0, 200));

    const draftData = {
        content: editorContent,
        name: templateName,
        description: templateDescription,
        lastSaved: new Date().toISOString(),
        version: 'draft'
    };

    try {
        localStorage.setItem('formatflow_current_draft', JSON.stringify(draftData));
        updateSaveIndicator('Auto-saved');
        console.log('Draft saved successfully');
    } catch (error) {
        console.warn('Auto-save failed:', error);
        showToast('Auto-save failed - content too large', 'warning');
    }
}

function loadSavedDraft() {
    try {
        const savedDraft = localStorage.getItem('formatflow_current_draft');
        if (savedDraft) {
            const draftData = JSON.parse(savedDraft);

            // Check if we came from login redirect or no template specified
            const urlParams = new URLSearchParams(window.location.search);
            const hasTemplate = urlParams.get('template');
            const fromLogin = document.referrer.includes('index.html');
            
            if (!hasTemplate) {
                // If coming from login, auto-load the draft (user already confirmed)
                // Otherwise ask for confirmation
                let shouldLoad = fromLogin;
                
                if (!fromLogin) {
                    shouldLoad = confirm('A saved draft was found. Would you like to continue from where you left off?');
                }
                
                if (shouldLoad) {
                    // Load draft content into the correct elements
                    const templateCanvas = document.getElementById('templateCanvas');
                    const templateName = document.getElementById('templateName');
                    const templateDescription = document.getElementById('templateDescription');
                    
                    console.log('Loading draft data:', draftData);
                    console.log('Template canvas element:', templateCanvas);
                    console.log('Draft content:', draftData.content);
                    
                    if (templateCanvas && draftData.content) {
                        templateCanvas.innerHTML = draftData.content;
                        console.log('Draft content loaded into canvas');
                    } else {
                        console.log('Failed to load draft content - canvas:', !!templateCanvas, 'content:', !!draftData.content);
                    }
                    
                    if (templateName && draftData.name) {
                        templateName.value = draftData.name;
                        console.log('Template name loaded:', draftData.name);
                        
                        // Also update the templateEditor's currentTemplate.name
                        if (typeof templateEditor !== 'undefined' && templateEditor && templateEditor.currentTemplate) {
                            templateEditor.currentTemplate.name = draftData.name;
                            console.log('TemplateEditor name updated:', draftData.name);
                        }
                    }
                    if (templateDescription && draftData.description) {
                        templateDescription.value = draftData.description;
                        console.log('Template description loaded:', draftData.description);
                        
                        // Also update the templateEditor's currentTemplate.description
                        if (typeof templateEditor !== 'undefined' && templateEditor && templateEditor.currentTemplate) {
                            templateEditor.currentTemplate.description = draftData.description;
                            console.log('TemplateEditor description updated:', draftData.description);
                        }
                    }

                    const lastSaved = new Date(draftData.lastSaved);
                    updateSaveIndicator(`Draft loaded from ${lastSaved.toLocaleString()}`);
                    showToast('Draft loaded successfully', 'info');
                } else {
                    // User declined, remove the draft
                    localStorage.removeItem('formatflow_current_draft');
                }
            }
        }
    } catch (error) {
        console.warn('Failed to load draft:', error);
    }
}

function updateSaveIndicator(message) {
    const indicator = document.getElementById('saveIndicator');
    if (indicator) {
        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        indicator.innerHTML = `<i class="fas fa-check-circle text-success me-1"></i>${message} at ${timestamp}`;
        indicator.style.display = 'inline-block';

        // Fade out after 3 seconds
        setTimeout(() => {
            indicator.style.opacity = '0.6';
        }, 3000);
    }
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Enhanced save functionality
function saveFormattingState() {
    // Auto-save functionality with enhanced formatting preservation
    if (templateEditor && templateEditor.saveState) {
        templateEditor.saveState();
    }

    // Trigger auto-save for the entire document
    autoSaveTemplate();
}