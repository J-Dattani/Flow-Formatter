/**
 * Form Generator - Smart Document Merger
 * Dynamically generates forms based on admin templates
 */

class FormGenerator {
    constructor() {
        this.templateData = null;
        this.formData = {};
        this.validationErrors = {};
        this.isSubmitting = false;
        
        this.init();
    }

    init() {
        this.loadTemplate();
        this.setupEventListeners();
    }

    async loadTemplate() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const templateId = urlParams.get('template');
            const templateName = urlParams.get('name');
            const tplEmbed = urlParams.get('tpl'); // URL-safe base64 of minimal template

            // If an embedded template is present, prefer it
            if (tplEmbed) {
                try {
                    const embedded = this.decodeEmbeddedTemplate(tplEmbed);
                    const blocks = (embedded?.metadata?.editor?.content) || embedded?.metadata?.content || embedded?.content || [];
                    const elements = this.normalizeBlocksToElements(blocks);
                    if (elements.length > 0) {
                        this.templateData = {
                            id: embedded.id || templateId || 'embedded',
                            name: embedded.name || templateName || 'Template',
                            description: embedded.description || '',
                            elements
                        };
                        this.renderForm();
                        return;
                    }
                    console.warn('Embedded template has no renderable fields. Will try DB fetch.');
                } catch (e) {
                    console.warn('Failed to decode embedded template, trying DB:', e);
                }
            }

            if (!templateId || templateId === 'preview') {
                // Demo fallback
                this.templateData = this.getDemoTemplate(templateName);
            } else {
                // Load actual template from Supabase via TemplateAPI
                const res = await TemplateAPI.getById(templateId);
                if (!res || !res.success || !res.data) {
                    this.showError('Failed to load template from database.');
                    return;
                }
                const tpl = res.data;
                const blocks = (tpl?.metadata?.editor?.content) || tpl?.metadata?.content || tpl?.content || [];
                const elements = this.normalizeBlocksToElements(blocks);
                if (!elements.length) {
                    this.showError('No form fields found in this template.');
                    return;
                }
                this.templateData = {
                    id: tpl.id,
                    name: tpl.name || templateName || 'Template',
                    description: tpl.description || '',
                    elements
                };
            }

            this.renderForm();
        } catch (error) {
            console.error('Error loading template:', error);
            this.showError('Failed to load template. Please try again.');
        }
    }

    // Decode URL-safe base64 embedded template into JSON
    decodeEmbeddedTemplate(b64url) {
        let s = String(b64url || '').replace(/-/g, '+').replace(/_/g, '/');
        // Pad to multiple of 4
        while (s.length % 4) s += '=';
        const binary = atob(s);
        // Convert binary string to Uint8Array
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        let jsonStr;
        if (typeof TextDecoder !== 'undefined') {
            jsonStr = new TextDecoder('utf-8').decode(bytes);
        } else {
            // Fallback for very old browsers
            jsonStr = decodeURIComponent(escape(binary));
        }
        return JSON.parse(jsonStr);
    }

    normalizeBlocksToElements(blocks) {
        const allowed = new Set(['textfield','textarea','checkbox','dropdown','attachment','signature','title','subtitle','paragraph','image','quote','divider','pagebreak','table']);
        return Array.isArray(blocks) ? blocks.filter(b => allowed.has((b?.type)||''))
            .map((b, idx) => ({
                id: b.id || `el_${idx+1}`,
                type: b.type,
                properties: {
                    ...((b && typeof b.properties === 'object') ? b.properties : {}),
                    fieldLabel: (b?.properties?.label || b?.properties?.fieldLabel || (b.type?.charAt(0).toUpperCase()+b.type?.slice(1) || 'Field')),
                    fieldPlaceholder: (b?.properties?.placeholder || b?.properties?.fieldPlaceholder || ''),
                    fieldRequired: !!(b?.properties?.required)
                },
                content: b.content
            })) : [];
    }

    getDemoTemplate(name = 'Sample Template') {
        return {
            id: 'demo-template',
            name: name,
            description: 'A demonstration template showing all available element types',
            elements: [
                {
                    id: 'title_1',
                    type: 'title',
                    properties: {
                        fontSize: 32,
                        fontWeight: 700,
                        textAlign: 'center',
                        marginBottom: 32,
                        fieldLabel: 'Document Title',
                        fieldPlaceholder: 'Enter the main title of your document',
                        fieldRequired: true
                    }
                },
                {
                    id: 'subtitle_1',
                    type: 'subtitle',
                    properties: {
                        fontSize: 20,
                        fontWeight: 600,
                        textAlign: 'left',
                        marginBottom: 24,
                        fieldLabel: 'Subtitle',
                        fieldPlaceholder: 'Enter a subtitle (optional)',
                        fieldRequired: false
                    }
                },
                {
                    id: 'paragraph_1',
                    type: 'paragraph',
                    properties: {
                        fontSize: 16,
                        fontWeight: 400,
                        textAlign: 'left',
                        marginBottom: 24,
                        fieldLabel: 'Introduction',
                        fieldPlaceholder: 'Write your introduction here...',
                        fieldRequired: true
                    }
                },
                {
                    id: 'image_1',
                    type: 'image',
                    properties: {
                        maxWidth: 500,
                        textAlign: 'center',
                        marginBottom: 24,
                        fieldLabel: 'Featured Image',
                        fieldPlaceholder: 'Upload a featured image',
                        fieldRequired: false
                    }
                },
                {
                    id: 'paragraph_2',
                    type: 'paragraph',
                    properties: {
                        fontSize: 16,
                        fontWeight: 400,
                        textAlign: 'left',
                        marginBottom: 24,
                        fieldLabel: 'Main Content',
                        fieldPlaceholder: 'Write your main content here...',
                        fieldRequired: true
                    }
                },
                {
                    id: 'quote_1',
                    type: 'quote',
                    properties: {
                        fontSize: 18,
                        fontWeight: 400,
                        textAlign: 'center',
                        marginBottom: 24,
                        fieldLabel: 'Inspirational Quote',
                        fieldPlaceholder: 'Add an inspirational quote (optional)',
                        fieldRequired: false
                    }
                },
                {
                    id: 'paragraph_3',
                    type: 'paragraph',
                    properties: {
                        fontSize: 16,
                        fontWeight: 400,
                        textAlign: 'left',
                        marginBottom: 24,
                        fieldLabel: 'Conclusion',
                        fieldPlaceholder: 'Write your conclusion here...',
                        fieldRequired: true
                    }
                }
            ]
        };
    }

    async loadTemplateFromAPI(templateId) { /* deprecated by TemplateAPI path */ return this.getDemoTemplate(); }

    renderForm() {
        if (!this.templateData) return;

        // Update header
        document.getElementById('templateTitle').textContent = this.templateData.name;
        document.getElementById('templateDescription').textContent = this.templateData.description;

        // Generate form fields
        const formFields = document.getElementById('formFields');
        formFields.innerHTML = '';

        // Prefer strictly fillable controls; if none exist, fall back to text-like types with field metadata
        const fillableSet = new Set(['textfield','textarea','checkbox','dropdown','attachment','signature']);
        const textLikeSet = new Set(['title','subtitle','paragraph','quote','image']);
        const fillables = this.templateData.elements.filter(el => fillableSet.has(el.type));
        const toRender = fillables.length ? fillables : this.templateData.elements.filter(el => textLikeSet.has(el.type));
        toRender.forEach((element, index) => {
            const fieldHtml = this.generateFieldHTML(element, index);
            if (fieldHtml) formFields.insertAdjacentHTML('beforeend', fieldHtml);
        });

        // Setup form field events
        this.setupFieldEvents();
        this.updateProgress();
        // Restore saved values if any
        this.loadSavedFormData();
    }

    generateFieldHTML(element, index) {
        const { id, type, properties, content } = element;
        const isRequired = properties.fieldRequired;
        const requiredClass = isRequired ? 'required-field' : '';
        const requiredAttr = isRequired ? 'required' : '';

        const fieldTemplates = {
            // New: core fillable controls
            textfield: () => `
                <div class="form-group">
                    <label for="${id}" class="form-label ${requiredClass}">${properties.fieldLabel || 'Text'}</label>
                    <input type="text" class="form-control" id="${id}" name="${id}" placeholder="${properties.fieldPlaceholder || ''}" ${requiredAttr} data-element-type="${type}">
                    <div class="validation-message" id="${id}_error"></div>
                </div>
            `,
            textarea: () => `
                <div class="form-group">
                    <label for="${id}" class="form-label ${requiredClass}">${properties.fieldLabel || 'Text Area'}</label>
                    <textarea class="form-control" id="${id}" name="${id}" placeholder="${properties.fieldPlaceholder || ''}" rows="6" ${requiredAttr} data-element-type="${type}"></textarea>
                    <div class="validation-message" id="${id}_error"></div>
                </div>
            `,
            checkbox: () => `
                <div class="form-group">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="${id}" name="${id}" data-element-type="${type}" ${isRequired ? 'required' : ''}>
                        <label class="form-check-label ${requiredClass}" for="${id}">${properties.fieldLabel || properties.label || 'Checkbox'}</label>
                    </div>
                    <div class="validation-message" id="${id}_error"></div>
                </div>
            `,
            dropdown: () => {
                const options = Array.isArray(content) ? content : (Array.isArray(properties.options) ? properties.options : []);
                const optionsHtml = [`<option value="">${properties.fieldPlaceholder || 'Select an option'}</option>`]
                    .concat(options.map(opt => `<option value="${this.escapeHtml(String(opt))}">${this.escapeHtml(String(opt))}</option>`))
                    .join('');
                return `
                <div class="form-group">
                    <label for="${id}" class="form-label ${requiredClass}">${properties.fieldLabel || 'Dropdown'}</label>
                    <select class="form-select" id="${id}" name="${id}" ${requiredAttr} data-element-type="${type}">${optionsHtml}</select>
                    <div class="validation-message" id="${id}_error"></div>
                </div>`;
            },
            attachment: () => `
                <div class="form-group">
                    <label for="${id}" class="form-label ${requiredClass}">${properties.fieldLabel || 'Attachment'}</label>
                    <input type="file" class="form-control" id="${id}" name="${id}" ${requiredAttr} data-element-type="${type}" ${properties.acceptedTypes ? `accept="${properties.acceptedTypes}"` : ''}>
                    <div class="form-text">${properties.fieldPlaceholder || 'Upload a file'}</div>
                    <div class="validation-message" id="${id}_error"></div>
                </div>
            `,
            signature: () => `
                <div class="form-group">
                    <label class="form-label ${requiredClass}">${properties.fieldLabel || 'Signature'}</label>
                    <input type="text" class="form-control" id="${id}" name="${id}" placeholder="Type your name" ${requiredAttr} data-element-type="${type}">
                    <div class="form-text">This will appear in the signature area.</div>
                    <div class="validation-message" id="${id}_error"></div>
                </div>
            `,
            // Fillable fields mapped from editor blocks
            title: () => `
                <div class="form-group">
                    <label for="${id}" class="form-label ${requiredClass}">${properties.fieldLabel}</label>
                    <input type="text" 
                           class="form-control form-control-lg" 
                           id="${id}" 
                           name="${id}"
                           placeholder="${properties.fieldPlaceholder}"
                           ${requiredAttr}
                           data-element-type="${type}">
                    <div class="form-text">This will be displayed as the main title of your document.</div>
                    <div class="validation-message" id="${id}_error"></div>
                </div>
            `,
            subtitle: () => `
                <div class="form-group">
                    <label for="${id}" class="form-label ${requiredClass}">${properties.fieldLabel}</label>
                    <input type="text" 
                           class="form-control" 
                           id="${id}" 
                           name="${id}"
                           placeholder="${properties.fieldPlaceholder}"
                           ${requiredAttr}
                           data-element-type="${type}">
                    <div class="form-text">A secondary heading for your document.</div>
                    <div class="validation-message" id="${id}_error"></div>
                </div>
            `,
            paragraph: () => `
                <div class="form-group">
                    <label for="${id}" class="form-label ${requiredClass}">${properties.fieldLabel}</label>
                    <textarea class="form-control" 
                              id="${id}" 
                              name="${id}"
                              placeholder="${properties.fieldPlaceholder}"
                              rows="6"
                              ${requiredAttr}
                              data-element-type="${type}"></textarea>
                    <div class="form-text">Enter your content here. This will be formatted as a paragraph in your document.</div>
                    <div class="validation-message" id="${id}_error"></div>
                </div>
            `,
            quote: () => `
                <div class="form-group">
                    <label for="${id}" class="form-label ${requiredClass}">${properties.fieldLabel}</label>
                    <textarea class="form-control" 
                              id="${id}" 
                              name="${id}"
                              placeholder="${properties.fieldPlaceholder}"
                              rows="3"
                              ${requiredAttr}
                              data-element-type="${type}"></textarea>
                    <div class="form-text">This will be displayed as a highlighted quote in your document.</div>
                    <div class="validation-message" id="${id}_error"></div>
                </div>
            `,
            image: () => `
                <div class="form-group">
                    <label for="${id}" class="form-label ${requiredClass}">${properties.fieldLabel}</label>
                    <div class="image-upload-area" onclick="document.getElementById('${id}').click()">
                        <div class="upload-content">
                            <i class="fas fa-cloud-upload-alt fs-2 text-muted mb-2"></i>
                            <div class="fw-bold">Click to upload or drag and drop</div>
                            <div class="text-muted small">PNG, JPG, GIF up to 10MB</div>
                        </div>
                        <img id="${id}_preview" class="image-preview" style="display: none;">
                    </div>
                    <input type="file" 
                           class="form-control d-none" 
                           id="${id}" 
                           name="${id}"
                           accept="image/*"
                           ${requiredAttr}
                           data-element-type="${type}">
                    <div class="form-text">Upload an image that will be placed in your document.</div>
                    <div class="validation-message" id="${id}_error"></div>
                </div>
            `
        };

        // Skip non-fillable layout-only types in the form UI
        if (!fieldTemplates[type]) {
            return '';
        }

        return fieldTemplates[type] ? fieldTemplates[type]() : '';
    }

    setupFieldEvents() {
        // Form validation on input
        const formFields = document.querySelectorAll('#documentForm input, #documentForm textarea, #documentForm select');
        formFields.forEach(field => {
            field.addEventListener('input', () => {
                this.validateField(field);
                this.updateProgress();
                this.saveFormData();
            });

            field.addEventListener('blur', () => {
                this.validateField(field);
            });
        });

        // Image upload handling
        const imageFields = document.querySelectorAll('input[type="file"]');
        imageFields.forEach(field => {
            field.addEventListener('change', (e) => {
                this.handleImageUpload(e.target);
            });
        });

        // Drag and drop for images
        this.setupImageDragDrop();
    }

    setupImageDragDrop() {
        const uploadAreas = document.querySelectorAll('.image-upload-area');
        
        uploadAreas.forEach(area => {
            area.addEventListener('dragover', (e) => {
                e.preventDefault();
                area.classList.add('drag-over');
            });

            area.addEventListener('dragleave', (e) => {
                if (!area.contains(e.relatedTarget)) {
                    area.classList.remove('drag-over');
                }
            });

            area.addEventListener('drop', (e) => {
                e.preventDefault();
                area.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const fileInput = area.parentNode.querySelector('input[type="file"]');
                    fileInput.files = files;
                    this.handleImageUpload(fileInput);
                }
            });
        });
    }

    handleImageUpload(fileInput) {
        const file = fileInput.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showFieldError(fileInput.id, 'Please select a valid image file.');
            return;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            this.showFieldError(fileInput.id, 'File size must be less than 10MB.');
            return;
        }

        // Show preview
        const preview = document.getElementById(fileInput.id + '_preview');
        const uploadContent = fileInput.parentNode.querySelector('.upload-content');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
            uploadContent.style.display = 'none';
        };
        reader.readAsDataURL(file);

        // Clear any previous errors
        this.clearFieldError(fileInput.id);
        this.updateProgress();
    }

    validateField(field) {
        let value;
        if (field.type === 'file') {
            value = field.files.length > 0;
        } else if (field.type === 'checkbox') {
            value = field.checked;
        } else {
            value = (field.value || '').trim();
        }
        const isRequired = field.hasAttribute('required');
        
        if (isRequired && !value) {
            this.showFieldError(field.id, 'This field is required.');
            return false;
        } else {
            this.clearFieldError(field.id);
            return true;
        }
    }

    showFieldError(fieldId, message) {
        const errorElement = document.getElementById(fieldId + '_error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.add('is-invalid');
        }
        
        this.validationErrors[fieldId] = message;
    }

    clearFieldError(fieldId) {
        const errorElement = document.getElementById(fieldId + '_error');
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
        
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.remove('is-invalid');
        }
        
        delete this.validationErrors[fieldId];
    }

    updateProgress() {
        if (!this.templateData) return;

        const controls = document.querySelectorAll('#documentForm input:not(.d-none), #documentForm textarea, #documentForm select');
        const totalFields = controls.length;
        let completedFields = 0;
        controls.forEach(field => {
            let hasValue = false;
            if (field.type === 'file') hasValue = field.files && field.files.length > 0;
            else if (field.type === 'checkbox') hasValue = field.checked;
            else hasValue = ((field.value || '').trim().length > 0);
            if (hasValue) completedFields++;
        });

        const progress = totalFields ? Math.round((completedFields / totalFields) * 100) : 0;
        
        document.getElementById('progressBar').style.width = progress + '%';
        document.getElementById('progressText').textContent = progress + '% Complete';
    }

    saveFormData() {
        const formData = new FormData(document.getElementById('documentForm'));
        this.formData = {};
        
        for (let [key, value] of formData.entries()) {
            this.formData[key] = value;
        }
        
        // Save to localStorage for persistence
        localStorage.setItem('formData_' + this.templateData.id, JSON.stringify(this.formData));
    }

    loadSavedFormData() {
        const savedData = localStorage.getItem('formData_' + this.templateData.id);
        if (savedData) {
            try {
                this.formData = JSON.parse(savedData);
                this.populateForm();
            } catch (error) {
                console.error('Error loading saved form data:', error);
            }
        }
    }

    populateForm() {
        Object.keys(this.formData).forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field) return;
            if (field.type === 'file') return; // cannot restore file programmatically
            if (field.tagName === 'SELECT') {
                field.value = this.formData[fieldId] || '';
            } else if (field.type === 'checkbox') {
                field.checked = !!this.formData[fieldId];
            } else {
                field.value = this.formData[fieldId];
            }
        });
        this.updateProgress();
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('documentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateDocument();
        });

        // Preview button
        document.getElementById('previewBtn').addEventListener('click', () => {
            this.showPreview();
        });

        // Save progress button
        document.getElementById('saveProgressBtn').addEventListener('click', () => {
            this.saveProgress();
        });

        // Download buttons
        document.getElementById('downloadPreviewBtn').addEventListener('click', () => {
            this.downloadDocument(true);
        });

        document.getElementById('downloadDocBtn').addEventListener('click', () => {
            this.downloadDocument();
        });
    }

    validateForm() {
        let isValid = true;
        this.validationErrors = {};

    const formFields = document.querySelectorAll('#documentForm input, #documentForm textarea, #documentForm select');
        formFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    showPreview() {
        // Soft-validate: highlight issues but do not block preview
        const fields = document.querySelectorAll('#documentForm input, #documentForm textarea, #documentForm select');
        fields.forEach(f => this.validateField(f));
        const modalEl = document.getElementById('previewModal');
        if (!modalEl) return this.showError('Preview modal not found.');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
        try {
            this.generatePreview();
        } catch (e) {
            console.error('Preview render failed:', e);
            const preview = document.getElementById('documentPreview');
            if (preview) {
                preview.innerHTML = '<div class="text-danger">Unable to render preview. Please check your fields and try again.</div>';
            }
        }
    }

    generatePreview() {
        const preview = document.getElementById('documentPreview');
        preview.innerHTML = '';

        // Build a display-only template by injecting form values into blocks
        const displayBlocks = [];
        for (const element of this.templateData.elements) {
            const { id, type, properties, content } = element;
            // Map fillable to display value
            const field = document.getElementById(id);
            let value = '';
            if (field) {
                if (field.type === 'file' && field.files.length > 0) {
                    value = URL.createObjectURL(field.files[0]);
                } else {
                    value = field.value;
                }
            }
            // For non-fillable, keep original content
            const finalContent = ['textfield','textarea','title','subtitle','paragraph','quote'].includes(type)
                ? value
                : (type === 'image' && value) ? value : content;

            // If optional field left empty, skip its display block
            if (!finalContent && ['textfield','textarea','title','subtitle','paragraph','image','quote'].includes(type)) {
                continue;
            }

            // Convert certain fillable types to display equivalents
            let displayType = type;
            if (type === 'textfield' || type === 'textarea') displayType = 'paragraph';
            if (type === 'checkbox') {
                if (field && field.checked) {
                    displayType = 'paragraph';
                } else {
                    continue; // omit unchecked by default
                }
            }
            if (type === 'dropdown') displayType = 'paragraph';
            if (type === 'signature') displayType = 'signature';

            displayBlocks.push({
                id,
                type: displayType,
                content: finalContent,
                properties
            });
        }

        // Render via shared PreviewRenderer for consistency
        if (window.PreviewRenderer) {
            const tmpTemplate = {
                name: this.templateData.name,
                metadata: { editor: { content: displayBlocks } }
            };
            const container = window.PreviewRenderer.buildContainer(tmpTemplate, { includeTitle: false });
            preview.appendChild(container);
        } else {
            // Fallback to legacy per-element rendering if PreviewRenderer missing
            this.templateData.elements.forEach(element => {
                const content = this.generateElementPreview(element);
                if (content) preview.insertAdjacentHTML('beforeend', content);
            });
        }
    }

    generateElementPreview(element) {
        const { id, type, properties } = element;
        const field = document.getElementById(id);
        let value = '';
        
        if (field) {
            if (field.type === 'file' && field.files.length > 0) {
                const file = field.files[0];
                value = URL.createObjectURL(file);
            } else {
                value = field.value;
            }
        }

        if (!value && type !== 'divider' && type !== 'pagebreak') {
            return '';
        }

        const styles = this.getPreviewStyles(properties);

        const templates = {
            title: () => `<h1 class="preview-title" style="${styles}">${this.escapeHtml(value)}</h1>`,
            subtitle: () => `<h2 class="preview-subtitle" style="${styles}">${this.escapeHtml(value)}</h2>`,
            paragraph: () => `<p class="preview-paragraph" style="${styles}">${this.escapeHtml(value).replace(/\n/g, '<br>')}</p>`,
            quote: () => `<blockquote class="preview-quote" style="${styles}"><i class="fas fa-quote-left me-2"></i>${this.escapeHtml(value)}</blockquote>`,
            image: () => `<img src="${value}" class="preview-image" style="${styles}" alt="Document image">`,
            attachment: () => `<p class="preview-paragraph" style="${styles}"><i class="fas fa-paperclip me-2"></i>${this.escapeHtml(field?.files?.[0]?.name || value || 'Attachment')}</p>`,
            divider: () => `<hr class="preview-divider" style="${styles}">`,
            pagebreak: () => `<div style="page-break-before: always; margin: 3rem 0;"></div>`
        };

        return templates[type] ? templates[type]() : '';
    }

    getPreviewStyles(properties) {
        const styles = [];
        
        if (properties.fontSize) styles.push(`font-size: ${properties.fontSize}px`);
        if (properties.fontFamily) styles.push(`font-family: ${properties.fontFamily}`);
        if (properties.fontWeight) styles.push(`font-weight: ${properties.fontWeight}`);
        if (properties.textAlign) styles.push(`text-align: ${properties.textAlign}`);
        if (properties.textColor) styles.push(`color: ${properties.textColor}`);
        if (properties.lineHeight) styles.push(`line-height: ${properties.lineHeight}`);
        if (properties.marginTop !== undefined) styles.push(`margin-top: ${properties.marginTop}px`);
        if (properties.marginBottom !== undefined) styles.push(`margin-bottom: ${properties.marginBottom}px`);
        if (properties.maxWidth) styles.push(`max-width: ${properties.maxWidth}px`);
        
        return styles.join('; ');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async generateDocument() {
        if (this.isSubmitting) return;
        
        if (!this.validateForm()) {
            this.showError('Please fill in all required fields.');
            return;
        }

        this.isSubmitting = true;
        const generateBtn = document.getElementById('generateBtn');
        const originalText = generateBtn.innerHTML;
        
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';

        try {
            // Simulate document generation
            await this.processDocumentGeneration();
            
            // Show success modal
            const modal = new bootstrap.Modal(document.getElementById('successModal'));
            modal.show();
            
            // Clear saved form data
            localStorage.removeItem('formData_' + this.templateData.id);
            
        } catch (error) {
            console.error('Document generation error:', error);
            this.showError('Failed to generate document. Please try again.');
        } finally {
            this.isSubmitting = false;
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalText;
        }
    }

    async processDocumentGeneration() {
        // Simulate API processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Here you would send the template and form data to your backend
        const documentData = {
            templateId: this.templateData.id,
            templateData: this.templateData,
            formData: this.formData,
            submittedAt: new Date().toISOString()
        };
        
        console.log('Document data for generation:', documentData);
        
        // Mock successful generation
        return {
            success: true,
            documentId: 'doc_' + Date.now(),
            downloadUrl: '#'
        };
    }

    downloadDocument(isPreview = false) {
        const container = document.getElementById('documentPreview');
        if (!container) return this.showNotification('Nothing to download yet.', 'warning');
        const target = container.querySelector('.preview-document') || container;
        const filename = `${(this.templateData?.name || 'document').replace(/\s+/g,'_')}.pdf`;
        if (!window.html2pdf) return this.showNotification('PDF library not loaded.', 'danger');
        // Prepare DOM for better pagination (avoid orphan headings)
        if (window.PreviewRenderer && typeof window.PreviewRenderer.prepareForPdf === 'function') {
            try { window.PreviewRenderer.prepareForPdf(target); } catch (_) {}
        }
        // Clone into a visible off-screen host to avoid hidden modal issues
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-99999px;top:0;width:820px;z-index:-1;visibility:visible;';
        const clone = target.cloneNode(true);
        host.appendChild(clone);
        document.body.appendChild(host);

        window.html2pdf().set({
            margin: [10,10,10,10],
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        }).from(clone).save().finally(() => {
            if (host && host.parentNode) host.parentNode.removeChild(host);
        });
    }

    saveProgress() {
        this.saveFormData();
        this.showNotification('Progress saved successfully!', 'success');
    }

    showError(message) {
        this.showNotification(message, 'danger');
    }

    showNotification(message, type = 'info') {
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
}

// Initialize form generator when page loads
document.addEventListener('DOMContentLoaded', function() {
    new FormGenerator();
});