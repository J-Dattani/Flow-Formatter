/**
 * Document Merger - FormatFlow
 * Multi-document upload, merge, and formatting system
 */

class DocumentMerger {
    constructor() {
        this.uploadedFiles = [];
        this.selectedTemplate = 'professional';
        this.sortableInstance = null;
        this.totalPages = 0;
        this.totalSize = 0;
        // Backend integration state
        this.apiBase = 'http://127.0.0.1:8000/api';
        this.lastMergedBlob = null;
        this.previewObjectUrl = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupSortable();
        this.updateStats();
    }

    setupEventListeners() {
        // Upload zone events
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');

        uploadZone.addEventListener('click', () => {
            fileInput.click();
        });

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Document title auto-generation
        document.getElementById('documentTitle').addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                this.updateMergeStatus('Configured');
            }
        });
    }

    setupSortable() {
        const filesList = document.getElementById('filesList');
        this.sortableInstance = Sortable.create(filesList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            handle: '.drag-handle',
            onEnd: (evt) => {
                // Update file order in array
                const item = this.uploadedFiles.splice(evt.oldIndex, 1)[0];
                this.uploadedFiles.splice(evt.newIndex, 0, item);
                this.updateFileNumbers();
                this.showToast('Files reordered successfully', 'success');
            }
        });
    }

    async handleFiles(fileList) {
        const files = Array.from(fileList);
        
        for (const file of files) {
            if (this.validateFile(file)) {
                const fileObj = await this.createFileObject(file);
                this.uploadedFiles.push(fileObj);
                this.renderFileItem(fileObj);
                await this.simulateFileProcessing(fileObj);
            }
        }

    this.updateStats();
    // Ask backend for accurate pages/size/words after adding files
    try { refreshFileStats(); } catch {}
        this.showFilesSection();
        this.updateStepStatus('step1', true);
        
        if (this.uploadedFiles.length > 0) {
            this.showMergeSection();
        }
    }

    validateFile(file) {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.oasis.opendocument.text',
            'text/plain',
            'text/markdown'
        ];

        const allowedExtensions = ['.pdf', '.doc', '.docx', '.odt', '.txt', '.md'];
        const maxSize = 50 * 1024 * 1024; // 50MB

        // Check file type
        const isValidType = allowedTypes.includes(file.type) || 
                           allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (!isValidType) {
            this.showToast(`Unsupported file type: ${file.name}`, 'error');
            return false;
        }

        // Check file size
        if (file.size > maxSize) {
            this.showToast(`File too large: ${file.name} (max 50MB)`, 'error');
            return false;
        }

        // Check for duplicates
        if (this.uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
            this.showToast(`File already uploaded: ${file.name}`, 'warning');
            return false;
        }

        return true;
    }

    async createFileObject(file) {
        const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        return {
            id: fileId,
            name: file.name,
            size: file.size,
            type: this.getFileType(file),
            file: file,
            pages: this.estimatePages(file),
            processed: false,
            content: null,
            uploadedAt: new Date()
        };
    }

    getFileType(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        const typeMap = {
            'pdf': 'pdf',
            'doc': 'docx',
            'docx': 'docx',
            'odt': 'odt',
            'txt': 'txt',
            'md': 'md'
        };
        return typeMap[extension] || 'default';
    }

    estimatePages(file) {
        // Simple estimation based on file size and type
        const sizeInKB = file.size / 1024;
        const type = this.getFileType(file);
        
        let estimatedPages;
        switch (type) {
            case 'pdf':
                estimatedPages = Math.max(1, Math.round(sizeInKB / 100));
                break;
            case 'docx':
                estimatedPages = Math.max(1, Math.round(sizeInKB / 50));
                break;
            case 'txt':
                estimatedPages = Math.max(1, Math.round(sizeInKB / 3));
                break;
            default:
                estimatedPages = Math.max(1, Math.round(sizeInKB / 75));
        }
        
        return Math.min(estimatedPages, 999); // Cap at 999 pages
    }

    renderFileItem(fileObj) {
        const filesList = document.getElementById('filesList');
        const fileIndex = this.uploadedFiles.length;
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.id = `file-${fileObj.id}`;
        fileItem.innerHTML = this.getFileItemHTML(fileObj, fileIndex);
        
        filesList.appendChild(fileItem);
        
        // Generate thumbnail after rendering
        this.generateThumbnail(fileObj);
    }

    async generateThumbnail(fileObj) {
        const thumbnailContainer = document.getElementById(`thumbnail-${fileObj.id}`);
        if (!thumbnailContainer) return;

        try {
            let thumbnailHTML = '';

            if (fileObj.type === 'image' || fileObj.file.type.startsWith('image/')) {
                // For images, create a preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    thumbnailHTML = `
                        <img src="${e.target.result}" alt="${fileObj.name}" class="document-thumbnail">
                    `;
                    thumbnailContainer.innerHTML = thumbnailHTML;
                };
                reader.readAsDataURL(fileObj.file);
            } else if (fileObj.type === 'pdf') {
                // For PDFs, show PDF icon with page count
                thumbnailHTML = `
                    <div class="file-icon pdf">
                        <i class="fas fa-file-pdf text-danger"></i>
                        <div class="page-count">${fileObj.pages}</div>
                    </div>
                `;
                thumbnailContainer.innerHTML = thumbnailHTML;
            } else if (fileObj.type === 'text') {
                // For text files, show preview of content
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    const preview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
                    thumbnailHTML = `
                        <div class="text-preview">
                            <i class="fas fa-file-alt text-primary mb-1"></i>
                            <div class="preview-text">${this.escapeHtml(preview)}</div>
                        </div>
                    `;
                    thumbnailContainer.innerHTML = thumbnailHTML;
                };
                reader.readAsText(fileObj.file);
            } else {
                // For other document types, show enhanced icon
                thumbnailHTML = `
                    <div class="file-icon ${fileObj.type}">
                        <i class="fas ${this.getFileIcon(fileObj.type)}"></i>
                        <div class="file-type-label">${fileObj.type.toUpperCase()}</div>
                    </div>
                `;
                thumbnailContainer.innerHTML = thumbnailHTML;
            }
        } catch (error) {
            console.warn('Failed to generate thumbnail for:', fileObj.name, error);
            // Fallback to default icon
            thumbnailContainer.innerHTML = `
                <div class="file-icon ${fileObj.type}">
                    <i class="fas ${this.getFileIcon(fileObj.type)}"></i>
                </div>
            `;
        }
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    getFileItemHTML(fileObj, index) {
        const fileSize = this.formatFileSize(fileObj.size);
        const iconClass = `file-icon ${fileObj.type}`;
        
        return `
            <div class="d-flex align-items-center">
                <div class="drag-handle me-3">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="file-thumbnail me-3" id="thumbnail-${fileObj.id}">
                    <div class="${iconClass}">
                        <i class="fas ${this.getFileIcon(fileObj.type)}"></i>
                    </div>
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${fileObj.name}</h6>
                            <div class="d-flex align-items-center text-muted small">
                                <span class="me-3">
                                    <i class="fas fa-file-alt me-1"></i>
                                    ${fileObj.pages} page${fileObj.pages > 1 ? 's' : ''}
                                </span>
                                <span class="me-3">
                                    <i class="fas fa-hdd me-1"></i>
                                    ${fileSize}
                                </span>
                                <span class="me-3">
                                    <i class="fas fa-clock me-1"></i>
                                    ${fileObj.uploadedAt.toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                        <div class="d-flex align-items-center">
                            <span class="badge bg-primary me-2" id="order-${fileObj.id}">#${index}</span>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-info" onclick="previewFile('${fileObj.id}')" title="Preview">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-outline-danger" onclick="removeFile('${fileObj.id}')" title="Remove">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="progress-bar mt-2" id="progress-${fileObj.id}">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="processing-status mt-1" id="status-${fileObj.id}">
                        <small class="text-muted">Uploaded</small>
                    </div>
                </div>
            </div>
        `;
    }

    getFileIcon(type) {
        const icons = {
            'pdf': 'fa-file-pdf',
            'docx': 'fa-file-word',
            'txt': 'fa-file-alt',
            'odt': 'fa-file-alt',
            'md': 'fa-file-code',
            'default': 'fa-file'
        };
        return icons[type] || icons.default;
    }

    async simulateFileProcessing(fileObj) {
        const progressBar = document.querySelector(`#progress-${fileObj.id} .progress-fill`);
        const statusElement = document.getElementById(`status-${fileObj.id}`);
        
        statusElement.innerHTML = '<small class="text-info">Processing...</small>';
        
        // Simulate processing with progress
        for (let i = 0; i <= 100; i += 10) {
            await this.delay(100);
            progressBar.style.width = `${i}%`;
        }
        
        fileObj.processed = true;
        statusElement.innerHTML = '<small class="text-success"><i class="fas fa-check me-1"></i>Ready</small>';
        progressBar.style.width = '100%';
        
        // Simulate content extraction
        fileObj.content = this.simulateContentExtraction(fileObj);
    }

    simulateContentExtraction(fileObj) {
        // Simulate extracted content structure
        return {
            title: `Content from ${fileObj.name}`,
            sections: [
                {
                    type: 'heading',
                    level: 1,
                    content: `Document: ${fileObj.name.replace(/\.[^/.]+$/, "")}`
                },
                {
                    type: 'paragraph',
                    content: `This is simulated content extracted from ${fileObj.name}. In a real implementation, this would contain the actual parsed content from the document.`
                },
                {
                    type: 'paragraph',
                    content: 'Additional content would appear here with proper formatting, images, tables, and other elements preserved from the original document.'
                }
            ],
            metadata: {
                wordCount: Math.floor(Math.random() * 5000) + 500,
                characterCount: Math.floor(Math.random() * 25000) + 2500,
                extractedAt: new Date()
            }
        };
    }

    updateStats() {
        this.totalPages = this.uploadedFiles.reduce((sum, file) => sum + file.pages, 0);
        this.totalSize = this.uploadedFiles.reduce((sum, file) => sum + file.size, 0);
        
        document.getElementById('totalFiles').textContent = this.uploadedFiles.length;
        document.getElementById('totalPages').textContent = this.totalPages;
        document.getElementById('totalSize').textContent = (this.totalSize / (1024 * 1024)).toFixed(1);
        
        // Auto-generate document title if empty
        const titleInput = document.getElementById('documentTitle');
        if (!titleInput.value.trim() && this.uploadedFiles.length > 0) {
            const baseName = this.uploadedFiles[0].name.replace(/\.[^/.]+$/, "");
            titleInput.value = `Merged Document - ${baseName} and ${this.uploadedFiles.length - 1} other${this.uploadedFiles.length > 2 ? 's' : ''}`;
        }
    }

    updateFileNumbers() {
        this.uploadedFiles.forEach((file, index) => {
            const orderBadge = document.getElementById(`order-${file.id}`);
            if (orderBadge) {
                orderBadge.textContent = `#${index + 1}`;
            }
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    showFilesSection() {
        document.getElementById('filesSection').style.display = 'block';
    }

    showMergeSection() {
        document.getElementById('mergeSection').style.display = 'block';
        this.updateStepStatus('step2', true);
    }

    showPreviewSection() {
        document.getElementById('previewSection').style.display = 'block';
        this.generatePreview();
    }

    updateStepStatus(stepId, completed) {
        const step = document.getElementById(stepId);
        const icon = step.querySelector('i:first-child');
        const checkIcon = step.querySelector('.fa-check');
        
        if (completed) {
            icon.className = icon.className.replace('text-muted', 'text-success');
            checkIcon.style.display = 'inline';
        }
    }

    updateMergeStatus(status) {
        const statusElement = document.getElementById('mergeStatus');
        statusElement.textContent = status;
        
        const statusColors = {
            'Ready': 'text-success',
            'Processing': 'text-warning',
            'Completed': 'text-primary',
            'Error': 'text-danger',
            'Configured': 'text-info'
        };
        
        // Remove all color classes
        Object.values(statusColors).forEach(color => {
            statusElement.classList.remove(color);
        });
        
        // Add new color
        statusElement.classList.add(statusColors[status] || 'text-muted');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // UI Event Handlers
    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }

        const toastId = 'toast_' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
        toast.setAttribute('role', 'alert');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas ${this.getToastIcon(type)} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, { delay: 4000 });
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    getToastIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    generatePreview() {
        const previewContainer = document.getElementById('previewContainer');
        const documentTitle = document.getElementById('documentTitle').value || 'Merged Document';

        // If we have a merged PDF from backend, embed it; otherwise, fall back to static preview
        if (this.lastMergedBlob instanceof Blob) {
            // Revoke previous URL if any
            if (this.previewObjectUrl) {
                URL.revokeObjectURL(this.previewObjectUrl);
                this.previewObjectUrl = null;
            }

            const objectUrl = URL.createObjectURL(this.lastMergedBlob);
            this.previewObjectUrl = objectUrl;

            previewContainer.innerHTML = '';
            const titleEl = document.createElement('div');
            titleEl.className = 'mb-3';
            titleEl.innerHTML = `<h4 class="mb-1">${this.escapeHtml(documentTitle)}</h4><small class="text-muted">Preview of generated PDF</small>`;

            const viewer = document.createElement('iframe');
            viewer.style.width = '100%';
            viewer.style.minHeight = '600px';
            viewer.style.border = '1px solid #e9ecef';
            viewer.src = objectUrl;

            previewContainer.appendChild(titleEl);
            previewContainer.appendChild(viewer);
            return;
        }

        // Fallback: static preview (pre-existing behavior)
        let previewHTML = `
            <div class="document-preview" style="font-family: 'Inter', sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; background: white; padding: 2rem; box-shadow: 0 0 20px rgba(0,0,0,0.1);">
                <div class="text-center mb-4">
                    <h1 style="font-family: 'Playfair Display', serif; font-size: 2.5rem; color: #333; margin-bottom: 1rem;">${documentTitle}</h1>
                    <p class="text-muted">Merged document containing ${this.uploadedFiles.length} source files</p>
                    <hr style="width: 50%; margin: 2rem auto;">
                </div>
        `;

        this.uploadedFiles.forEach((file, index) => {
            previewHTML += `
                <div class="document-section mb-5">
                    <div class="section-header d-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded">
                        <h3 style="font-family: 'Playfair Display', serif; color: #6C63FF; margin-bottom: 0;">
                            Section ${index + 1}: ${file.name.replace(/\.[^/.]+$/, "")}
                        </h3>
                        <small class="text-muted">${file.pages} page${file.pages > 1 ? 's' : ''}</small>
                    </div>
                    
                    <div class="section-content">
                        ${file.content ? this.renderContentSections(file.content.sections) : this.getPlaceholderContent(file)}
                    </div>
                </div>
                
                ${index < this.uploadedFiles.length - 1 ? '<div style="page-break-after: always;"><hr class="my-4"></div>' : ''}
            `;
        });

        previewHTML += `
                <div class="document-footer mt-5 pt-4 border-top text-center">
                    <p class="text-muted small">
                        Generated by FormatFlow Document Merger | 
                        ${new Date().toLocaleDateString()} | 
                        ${this.totalPages} total pages
                    </p>
                </div>
            </div>
        `;

        previewContainer.innerHTML = previewHTML;
    }

    renderContentSections(sections) {
        return sections.map(section => {
            switch (section.type) {
                case 'heading':
                    const headingLevel = Math.min(section.level || 1, 6);
                    return `<h${headingLevel} style="font-family: 'Playfair Display', serif; color: #333; margin: 1.5rem 0 1rem 0;">${section.content}</h${headingLevel}>`;
                case 'paragraph':
                    return `<p style="margin-bottom: 1rem; text-align: justify;">${section.content}</p>`;
                case 'list':
                    const listType = section.ordered ? 'ol' : 'ul';
                    const items = section.items.map(item => `<li>${item}</li>`).join('');
                    return `<${listType} style="margin-bottom: 1rem;">${items}</${listType}>`;
                default:
                    return `<p style="margin-bottom: 1rem;">${section.content}</p>`;
            }
        }).join('');
    }

    getPlaceholderContent(file) {
        return `
            <p style="margin-bottom: 1rem; text-align: justify;">
                This section contains the content from <strong>${file.name}</strong>. 
                In the actual implementation, the document parser would extract and display 
                the real content from this ${file.type.toUpperCase()} file, preserving 
                formatting, images, tables, and other elements.
            </p>
            <p style="margin-bottom: 1rem; text-align: justify;">
                The merged document would maintain the original structure and hierarchy 
                while applying consistent formatting according to the selected template. 
                Headers, footers, page numbers, and cross-references would be properly 
                handled during the merge process.
            </p>
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                <strong>File Info:</strong> ${file.pages} pages, ${this.formatFileSize(file.size)}, 
                processed at ${file.uploadedAt.toLocaleTimeString()}
            </div>
        `;
    }
}

// Global functions for HTML onclick handlers
function selectTemplate(templateName) {
    // Remove selected class from all templates
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selected class to clicked template
    document.querySelector(`[data-template="${templateName}"]`).classList.add('selected');
    
    // Update merger instance
    if (window.documentMerger) {
        window.documentMerger.selectedTemplate = templateName;
        window.documentMerger.showToast(`${templateName.charAt(0).toUpperCase() + templateName.slice(1)} template selected`, 'success');
        window.documentMerger.updateMergeStatus('Configured');
    }
}

function removeFile(fileId) {
    if (window.documentMerger) {
        const fileIndex = window.documentMerger.uploadedFiles.findIndex(f => f.id === fileId);
        if (fileIndex > -1) {
            const fileName = window.documentMerger.uploadedFiles[fileIndex].name;
            window.documentMerger.uploadedFiles.splice(fileIndex, 1);
            
            // Remove DOM element
            document.getElementById(`file-${fileId}`).remove();
            
            // Update stats and file numbers
            window.documentMerger.updateStats();
            try { refreshFileStats(); } catch {}
            window.documentMerger.updateFileNumbers();
            window.documentMerger.showToast(`${fileName} removed`, 'info');
            
            // Hide sections if no files
            if (window.documentMerger.uploadedFiles.length === 0) {
                document.getElementById('filesSection').style.display = 'none';
                document.getElementById('mergeSection').style.display = 'none';
                document.getElementById('previewSection').style.display = 'none';
                window.documentMerger.updateMergeStatus('Ready');
            }
        }
    }
}

function previewFile(fileId) {
    if (window.documentMerger) {
        const file = window.documentMerger.uploadedFiles.find(f => f.id === fileId);
        if (file) {
            window.documentMerger.showToast(`Preview: ${file.name} (${file.pages} pages)`, 'info');
            // In real implementation, this would open a file preview modal
        }
    }
}

function clearAllFiles() {
    if (window.documentMerger && confirm('Remove all uploaded files?')) {
        window.documentMerger.uploadedFiles = [];
        document.getElementById('filesList').innerHTML = '';
        document.getElementById('filesSection').style.display = 'none';
        document.getElementById('mergeSection').style.display = 'none';
        document.getElementById('previewSection').style.display = 'none';
        window.documentMerger.updateStats();
        window.documentMerger.updateMergeStatus('Ready');
        window.documentMerger.showToast('All files removed', 'info');
    }
}

function addMoreFiles() {
    document.getElementById('fileInput').click();
}

function resetMerger() {
    if (confirm('Reset the entire merger? This will remove all files and settings.')) {
        window.location.reload();
    }
}

async function startMerge() {
    if (!window.documentMerger) return;
    
    const merger = window.documentMerger;
    
    // Validate
    if (merger.uploadedFiles.length === 0) {
        merger.showToast('Please upload at least one document', 'error');
        return;
    }
    
    const documentTitle = document.getElementById('documentTitle').value.trim();
    if (!documentTitle) {
        merger.showToast('Please enter a document title', 'error');
        return;
    }
    
    // Check if all files are processed
    const unprocessedFiles = merger.uploadedFiles.filter(f => !f.processed);
    if (unprocessedFiles.length > 0) {
        merger.showToast('Please wait for all files to finish processing', 'warning');
        return;
    }
    
    // Show processing modal
    const processingModal = new bootstrap.Modal(document.getElementById('processingModal'));
    processingModal.show();
    
    merger.updateMergeStatus('Processing');
    merger.updateStepStatus('step3', false);
    
    // Prepare form data with supported types (PDF/DOCX/TXT)
    const supportedFiles = merger.uploadedFiles.filter(f => {
        const name = (f.name || '').toLowerCase();
        const t = (f.file?.type || '').toLowerCase();
        return (
            t === 'application/pdf' || name.endsWith('.pdf') ||
            t.endsWith('officedocument.wordprocessingml.document') || name.endsWith('.docx') ||
            t.startsWith('text/') || name.endsWith('.txt')
        );
    });
    if (supportedFiles.length === 0) {
        merger.showToast('Please upload a PDF, DOCX, or TXT file for merging', 'error');
        processingModal.hide();
        return;
    }

    const formData = new FormData();
    supportedFiles.forEach(f => {
        formData.append('files', f.file, f.name);
    });
    // UI options
    try {
        const pageSizeEl = document.getElementById('pageSize');
        const generateTocEl = document.getElementById('generateToc');
        const addPageBreaksEl = document.getElementById('addPageBreaks');
        const autoNumberingEl = document.getElementById('autoNumbering');
        if (pageSizeEl && pageSizeEl.value) {
            formData.append('page_size', pageSizeEl.value);
        }
        if (generateTocEl) {
            formData.append('generate_toc', generateTocEl.checked ? 'true' : 'false');
        } else {
            formData.append('generate_toc', 'true');
        }
        if (addPageBreaksEl) {
            formData.append('add_page_breaks', addPageBreaksEl.checked ? 'true' : 'false');
        }
        if (autoNumberingEl) {
            formData.append('page_numbers', autoNumberingEl.checked ? 'true' : 'false');
        }
    } catch {}

    // Animate progress while performing the network request
    const steps = [
        'Uploading files...',
        'Analyzing structure...',
        'Detecting headings and TOC...',
        'Merging pages...',
        'Applying layout...',
        'Finalizing PDF...'
    ];

    let progress = 0;
    const progressEl = document.getElementById('processingProgress');
    const textEl = document.getElementById('processingText');

    const animate = async () => {
        for (let i = 0; i < steps.length; i++) {
            textEl.textContent = steps[i];
            progress = Math.min(100, progress + 100 / steps.length);
            progressEl.style.width = `${progress}%`;
            await merger.delay(500);
        }
    };

    try {
        // Run animation and fetch in parallel
        const fetchPromise = fetch(`${merger.apiBase}/merge/generate-toc-from-pdf`, {
            method: 'POST',
            body: formData
        });

        await Promise.race([
            (async () => { await animate(); })(),
            (async () => { await merger.delay(3500); })(), // ensure some animation even if fast
        ]);

        const res = await fetchPromise;
        if (!res.ok) {
            // Try to read error body for diagnostics
            let detail = '';
            try {
                const text = await res.text();
                if (text) detail = `: ${text.substring(0, 400)}`;
            } catch {}
            throw new Error(`Merge failed (${res.status})${detail}`);
        }
        const blob = await res.blob();
        if (!blob || blob.size === 0) {
            throw new Error('Empty PDF received');
        }

        // Store for preview and download
        merger.lastMergedBlob = blob;

        // Complete merge UI
        merger.updateStepStatus('step3', true);
        merger.updateMergeStatus('Completed');

        processingModal.hide();
        merger.showPreviewSection();
        merger.showToast('Documents merged successfully!', 'success');
        document.getElementById('previewSection').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error('Merge error:', err);
        merger.updateMergeStatus('Error');
        document.getElementById('processingText').textContent = 'An error occurred during merging';
        progressEl.style.width = '100%';
        await merger.delay(600);
        processingModal.hide();
        merger.showToast(String(err.message || err), 'error');
    }
}

// Enhance stats: query backend for accurate pages/size/words
async function refreshFileStats() {
    if (!window.documentMerger) return;
    const merger = window.documentMerger;
    if (merger.uploadedFiles.length === 0) return;
    const fd = new FormData();
    merger.uploadedFiles.forEach(f => fd.append('files', f.file, f.name));
    try {
        const res = await fetch(`${merger.apiBase}/merge/inspect`, { method: 'POST', body: fd });
        if (!res.ok) return;
        const json = await res.json();
        const byName = new Map();
        json.files.forEach(info => byName.set(info.name, info));
        let totalPages = 0; let totalSize = 0;
        merger.uploadedFiles.forEach(f => {
            const info = byName.get(f.name);
            if (info) {
                f.pages = info.pages || f.pages || 1;
                f.size = info.size || f.size;
            }
            totalPages += f.pages||0; totalSize += f.size||0;
        });
        merger.totalPages = totalPages; merger.totalSize = totalSize;
        document.getElementById('totalFiles').textContent = merger.uploadedFiles.length;
        document.getElementById('totalPages').textContent = merger.totalPages;
        document.getElementById('totalSize').textContent = (merger.totalSize / (1024 * 1024)).toFixed(1);
        merger.updateFileNumbers();
    } catch {}
}

async function exportDocument(format) {
    if (!window.documentMerger) return;
    
    const merger = window.documentMerger;
    const documentTitle = document.getElementById('documentTitle').value.trim() || 'Merged Document';
    
    if (format.toLowerCase() === 'pdf') {
        if (merger.lastMergedBlob instanceof Blob) {
            const url = URL.createObjectURL(merger.lastMergedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${documentTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            merger.updateStepStatus('step4', true);
            merger.showToast('PDF downloaded', 'success');
            return;
        }
        // If no blob yet, try to merge now
        merger.showToast('No merged PDF yet. Starting merge...', 'info');
        await startMerge();
        return;
    }

    // Other formats not yet supported by backend
    merger.showToast(`${format.toUpperCase()} export is not available yet`, 'warning');
}

function showHelp() {
    alert(`Document Merger Help

1. Upload Documents: Drag and drop or click to select multiple files
2. Reorder Files: Drag files to change merge sequence
3. Configure: Choose template and settings
4. Merge: Click "Merge Documents" to combine files
5. Export: Download in PDF, DOCX, or EPUB format

Supported formats: DOCX, PDF, TXT, ODT, Markdown
Maximum file size: 50MB per file

For technical support, contact support@formatflow.com`);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.documentMerger = new DocumentMerger();
    
    // Auto-select professional template
    selectTemplate('professional');
    
    // Initialize dark mode
    initializeDarkMode();
    
    // Initialize keyboard shortcuts
    initializeKeyboardShortcuts();
    
    // Load saved presets
    loadMergePresets();

    // After initial add, keep stats in sync
    setTimeout(refreshFileStats, 300);
});

// Dark Mode Functions
function initializeDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';

    // Apply saved theme regardless of toggle presence
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        if (darkModeToggle) darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Safeguard: toggle may not exist on some pages
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
}

function toggleDarkMode() {
    const body = document.body;
    const darkModeToggle = document.getElementById('darkModeToggle');
    const currentTheme = body.getAttribute('data-theme');
    
    if (currentTheme === 'dark') {
        body.setAttribute('data-theme', 'light');
        darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    }
}

// Keyboard Shortcuts Functions
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+O - Open File Dialog
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            document.getElementById('fileInput').click();
        }
        
        // Ctrl+M - Start Merge
        if (e.ctrlKey && e.key === 'm') {
            e.preventDefault();
            if (window.documentMerger.uploadedFiles.length > 0) {
                startMerge();
            }
        }
        
        // Ctrl+S - Download Result (if available)
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const downloadBtn = document.querySelector('button[onclick*="downloadMerged"]');
            if (downloadBtn && !downloadBtn.disabled) {
                downloadBtn.click();
            }
        }
        
        // Ctrl+D - Toggle Dark Mode
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            toggleDarkMode();
        }
        
        // F1 - Show Help
        if (e.key === 'F1') {
            e.preventDefault();
            showKeyboardShortcuts();
        }
        
        // Ctrl+Shift+X - Clear All Files
        if (e.ctrlKey && e.shiftKey && e.key === 'X') {
            e.preventDefault();
            clearAllFiles();
        }
        
        // Delete - Remove Selected Files
        if (e.key === 'Delete') {
            removeSelectedFiles();
        }
        
        // Escape - Close modals
        if (e.key === 'Escape') {
            const modals = bootstrap.Modal.getInstance(document.querySelector('.modal.show'));
            if (modals) {
                modals.hide();
            }
        }
    });
}

function showKeyboardShortcuts() {
    const modal = new bootstrap.Modal(document.getElementById('keyboardShortcutsModal'));
    modal.show();
}

function removeSelectedFiles() {
    const selectedFiles = document.querySelectorAll('.file-item.selected');
    selectedFiles.forEach(item => {
        const fileId = item.dataset.fileId;
        const index = window.documentMerger.uploadedFiles.findIndex(f => f.id === fileId);
        if (index > -1) {
            window.documentMerger.uploadedFiles.splice(index, 1);
        }
        item.remove();
    });
    window.documentMerger.updateStats();
}

function clearAllFiles() {
    if (window.documentMerger.uploadedFiles.length > 0) {
        if (confirm('Are you sure you want to remove all files?')) {
            window.documentMerger.uploadedFiles = [];
            document.getElementById('fileList').innerHTML = '';
            window.documentMerger.updateStats();
        }
    }
}

// Merge Presets Functions
function loadMergePresets() {
    const presets = JSON.parse(localStorage.getItem('mergePresets') || '[]');
    const container = document.getElementById('presetsContainer');
    
    if (presets.length === 0) {
        container.innerHTML = '<p class="text-muted small mb-0">No saved presets yet.</p>';
        return;
    }
    
    container.innerHTML = presets.map(preset => `
        <div class="preset-item mb-2">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong class="d-block">${preset.name}</strong>
                    ${preset.description ? `<small class="text-muted">${preset.description}</small>` : ''}
                </div>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="loadPreset('${preset.id}')">
                        <i class="fas fa-upload"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deletePreset('${preset.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function showPresetModal() {
    const modal = new bootstrap.Modal(document.getElementById('presetModal'));
    document.getElementById('presetName').value = '';
    document.getElementById('presetDescription').value = '';
    modal.show();
}

function saveCurrentPreset() {
    const name = prompt('Enter preset name:');
    if (name && name.trim()) {
        confirmSavePreset(name.trim());
    }
}

function confirmSavePreset(customName = null) {
    const name = customName || document.getElementById('presetName').value.trim();
    const description = document.getElementById('presetDescription').value.trim();
    
    if (!name) {
        alert('Please enter a preset name.');
        return;
    }
    
    const preset = {
        id: 'preset_' + Date.now(),
        name: name,
        description: description,
        template: window.documentMerger.selectedTemplate,
        settings: {
            pageBreaks: document.getElementById('addPageBreaks')?.checked || false,
            toc: document.getElementById('generateToc')?.checked || false,
            headers: document.getElementById('preserveHeaders')?.checked || false,
            numbering: document.getElementById('addNumbering')?.checked || false
        },
        created: new Date().toISOString()
    };
    
    const presets = JSON.parse(localStorage.getItem('mergePresets') || '[]');
    presets.push(preset);
    localStorage.setItem('mergePresets', JSON.stringify(presets));
    
    if (!customName) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('presetModal'));
        modal.hide();
    }
    
    loadMergePresets();
    window.documentMerger.showToast(`Preset "${name}" saved successfully!`, 'success');
}

function loadPreset(presetId) {
    const presets = JSON.parse(localStorage.getItem('mergePresets') || '[]');
    const preset = presets.find(p => p.id === presetId);
    
    if (!preset) {
        window.documentMerger.showToast('Preset not found!', 'error');
        return;
    }
    
    // Apply template
    selectTemplate(preset.template);
    
    // Apply settings
    const settings = preset.settings;
    if (document.getElementById('addPageBreaks')) {
        document.getElementById('addPageBreaks').checked = settings.pageBreaks;
    }
    if (document.getElementById('generateToc')) {
        document.getElementById('generateToc').checked = settings.toc;
    }
    if (document.getElementById('preserveHeaders')) {
        document.getElementById('preserveHeaders').checked = settings.headers;
    }
    if (document.getElementById('addNumbering')) {
        document.getElementById('addNumbering').checked = settings.numbering;
    }
    
    window.documentMerger.showToast(`Preset "${preset.name}" loaded!`, 'success');
}

function deletePreset(presetId) {
    if (confirm('Are you sure you want to delete this preset?')) {
        const presets = JSON.parse(localStorage.getItem('mergePresets') || '[]');
        const filteredPresets = presets.filter(p => p.id !== presetId);
        localStorage.setItem('mergePresets', JSON.stringify(filteredPresets));
        loadMergePresets();
        window.documentMerger.showToast('Preset deleted successfully!', 'success');
    }
}

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocumentMerger;
}