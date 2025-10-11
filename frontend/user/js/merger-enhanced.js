// Document Merger JavaScript

class DocumentMerger {
    constructor() {
        this.uploadedFiles = [];
        this.currentStep = 1; // Track current workflow step
        this.mergeOptions = {
            format: 'pdf',
            order: 'upload',
            includeTableOfContents: true,
            includePageNumbers: true,
            pageNumbering: 'continuous'
        };
        this.recentMerges = [];
        // Backend base URL (aligns with backend/api routes)
        this.apiBase = 'http://127.0.0.1:8000/api';
        // Last merged Blob and URL for download/preview
        this.lastMergedBlob = null;
        this.lastMergedUrl = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeDragAndDrop();
        this.loadRecentMerges();
        this.fixInputSpaceHandling();
        
        // Show the first step (should be visible by default, but ensure it's active)
        this.goToStep(1);
    }

    // Fix the double space issue in text inputs
    fixInputSpaceHandling() {
        // Fix double space issue in all text inputs and textareas
        const textInputs = document.querySelectorAll('input[type="text"], textarea');
        textInputs.forEach(input => {
            input.addEventListener('input', function(e) {
                // Check if the input has consecutive spaces and fix them
                if (this.value.includes('  ')) {
                    // Store cursor position
                    const cursorPos = this.selectionStart;
                    // Remove duplicate spaces (more than one consecutive space)
                    const originalLength = this.value.length;
                    this.value = this.value.replace(/  +/g, ' ');
                    // Calculate new cursor position (adjust if characters were removed)
                    const newPos = cursorPos - (originalLength - this.value.length);
                    // Restore cursor position
                    this.setSelectionRange(newPos, newPos);
                }
            });
        });
    }

    bindEvents() {
    // File upload
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea'); // old layout
    const uploadZone = document.getElementById('uploadZone'); // new layout

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                await this.handleFileUpload(e.target.files);
            });
        }

        const bindDropArea = (areaEl) => {
            if (!areaEl) return;
            areaEl.addEventListener('click', () => fileInput?.click());
            areaEl.addEventListener('dragover', (e) => { e.preventDefault(); areaEl.classList.add('drag-over'); });
            areaEl.addEventListener('dragleave', () => areaEl.classList.remove('drag-over'));
            areaEl.addEventListener('drop', async (e) => {
                e.preventDefault();
                areaEl.classList.remove('drag-over');
                await this.handleFileUpload(e.dataTransfer.files);
            });
        };
        bindDropArea(uploadArea);
        bindDropArea(uploadZone);

        // Next step buttons
        document.querySelectorAll('.next-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const nextStep = parseInt(btn.dataset.step || '0');
                if (nextStep > 0) {
                    this.proceedToStep(nextStep);
                }
            });
        });

        // Back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prevStep = parseInt(btn.dataset.step || '0');
                if (prevStep > 0) {
                    this.goToStep(prevStep);
                }
            });
        });

        // Start merge button (old layout)
        const startMergeBtn = document.querySelector('.start-merge-btn');
        if (startMergeBtn) {
            startMergeBtn.addEventListener('click', async () => { await this.startMergeProcess(); });
        }

        // Start over button
        const startOverBtn = document.querySelector('.start-over-btn');
        if (startOverBtn) {
            startOverBtn.addEventListener('click', () => {
                this.startOver();
            });
        }

        // Clear all button
        const clearAllBtn = document.querySelector('.clear-all-btn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllFiles();
            });
        }

        // Download book button
        const downloadBtn = document.querySelector('.download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadMergedDocument();
            });
        }

        // Preview button
        const previewBtn = document.querySelector('.preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.previewMergedDocument();
            });
        }

        // Share button
        const shareBtn = document.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                this.shareMergedDocument();
            });
        }
    }

    initializeDragAndDrop() {
        // Initialize sortable for document arrangement (old and new layout)
        const arrangementList = document.getElementById('arrangementList');
        const filesList = document.getElementById('filesList');
        const initSortable = (el) => {
            if (!el) return;
            new Sortable(el, {
                animation: 150,
                ghostClass: 'arrangement-ghost',
                onEnd: () => {
                    // Update file order based on DOM
                    const items = el.querySelectorAll('[data-index]');
                    const newOrder = Array.from(items).map(item => parseInt(item.dataset.index));
                    this.reorderFilesByIndices(newOrder);
                }
            });
        };
        initSortable(arrangementList);
        initSortable(filesList);
    }

    // Navigation methods
    goToStep(step) {
        if (step < 1 || step > 4) return;
        
        // Hide all sections (old layout)
        const sections = ['uploadSection', 'arrangeSection', 'settingsSection', 'downloadSection'];
        sections.forEach(id => {
            const section = document.getElementById(id);
            if (section) {
                section.classList.add('hidden');
            }
        });
        
        // Hide progress section (old layout)
        const progressSection = document.getElementById('progressSection');
        if (progressSection) {
            progressSection.classList.add('hidden');
        }
        
        // Show the target section (old layout)
        const targetSection = document.getElementById(sections[step-1]);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }
        
        // Update workflow steps (old layout)
        document.querySelectorAll('.workflow-step').forEach(workflowStep => {
            const stepNum = parseInt(workflowStep.getAttribute('data-step'));
            workflowStep.classList.remove('active');
            if (stepNum <= step) {
                workflowStep.classList.add('active');
            }
        });
        
        this.currentStep = step;
        
        // If going to arrange step, populate the arrangement list
        if (step === 2) {
            this.updateArrangementList();
        }
        // Update sidebar steps (new layout)
        this.updateSidebarSteps(step);
    }
    
    proceedToStep(step) {
        // Validation before proceeding to next step
        if (step === 2) {
            // Allow at least 1 file (merge can still run), but warn for better experience
            if (this.uploadedFiles.length < 1) {
                this.showToast('Please upload at least 1 file', 'warning');
                return;
            }
            if (this.uploadedFiles.length === 1) {
                this.showToast('Merging a single file — no reordering needed.', 'info');
            }
        }
        
        if (step === 3) {
            // Any validation before settings
        }
        
        this.goToStep(step);
    }
    
    startOver() {
        // Clear files and go back to step 1
        this.uploadedFiles = [];
        this.updateFileList();
        this.goToStep(1);
        this.showToast('Starting a new merge', 'info');
    }

    // File handling methods
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        // Process each file
        const justAdded = [];
        for (const file of Array.from(files)) {
            // Validate file type
            const allowedTypes = [
                'application/pdf', 
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
                'application/rtf'
            ];
            
            if (!allowedTypes.includes(file.type)) {
                this.showToast(`File "${file.name}" is not supported. Please upload PDF, DOC, DOCX, TXT, or RTF files.`, 'error');
                continue;
            }
            
            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                this.showToast(`File "${file.name}" is too large. Maximum file size is 10MB.`, 'error');
                continue;
            }
            
            // Check for duplicates
            if (this.uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
                this.showToast(`File "${file.name}" is already uploaded.`, 'warning');
                continue;
            }
            
            // Add file to list with metadata
            const fileData = {
                name: file.name,
                size: file.size,
                type: file.type,
                uploadTime: new Date(),
                pages: this.estimatePageCount(file), // Initial estimate; will refine via backend
                file: file // Keep reference to the actual file
            };
            
            this.uploadedFiles.push(fileData);
            justAdded.push(fileData);
            this.showToast(`File "${file.name}" uploaded successfully.`, 'success');
        }
        
    // Update the UI
    this.updateFileList();
    this.setSidebarStepComplete(1);
    this.setMergeStatus('Files ready', false);

        // Ask backend for actual per-file pages/words for the newly added files
        try {
            await this.refreshFileStats(justAdded);
        } catch (err) {
            console.warn('inspect failed', err);
        }
    }
    
    clearAllFiles() {
        if (this.uploadedFiles.length === 0) {
            this.showToast('No files to clear', 'info');
            return;
        }
        
        this.uploadedFiles = [];
        this.updateFileList();
        this.showToast('All files cleared', 'info');
    }
    
    removeFile(index) {
        if (index >= 0 && index < this.uploadedFiles.length) {
            const fileName = this.uploadedFiles[index].name;
            this.uploadedFiles.splice(index, 1);
            this.updateFileList();
            this.showToast(`File "${fileName}" removed`, 'info');
        }
    }
    
    previewFile(index) {
        if (index >= 0 && index < this.uploadedFiles.length) {
            const file = this.uploadedFiles[index];
            this.showToast(`Previewing "${file.name}"... (Feature coming soon)`, 'info');
        }
    }
    
    estimatePageCount(file) {
        // Estimate page count based on file size and type
        // This is just a rough estimate for demonstration
        const sizeInKB = file.size / 1024;
        
        if (file.type === 'application/pdf') {
            return Math.ceil(sizeInKB / 30); // ~30KB per page for PDF
        } else if (file.type.includes('word')) {
            return Math.ceil(sizeInKB / 25); // ~25KB per page for Word docs
        } else {
            return Math.ceil(sizeInKB / 4); // ~4KB per page for text files
        }
    }

    updateFileList() {
        const legacyList = document.getElementById('uploadedFiles');
        const newList = document.getElementById('filesList');

        // Handle legacy layout
        if (legacyList) {
            if (this.uploadedFiles.length === 0) {
                legacyList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-file-upload"></i>
                        <p>No files uploaded yet</p>
                    </div>
                `;
            } else {
                legacyList.innerHTML = '';
                this.uploadedFiles.forEach((file, index) => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.innerHTML = `
                        <div class="file-icon">
                            <i class="fas fa-file-${this.getFileIcon(file.type)}"></i>
                        </div>
                        <div class="file-info">
                            <div class="file-name">${file.name}</div>
                            <div class="file-meta">
                                <span class="file-type">${this.getFileTypeLabel(file.type)}</span>
                                <span class="file-size">${this.formatFileSize(file.size)}</span>
                                <span class="file-pages">${file.pages || '?'} pages</span>
                            </div>
                        </div>
                        <div class="file-actions">
                            <button class="file-action preview-btn" title="Preview">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="file-action remove-btn" title="Remove">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    `;
                    fileItem.querySelector('.preview-btn').addEventListener('click', () => this.previewFile(index));
                    fileItem.querySelector('.remove-btn').addEventListener('click', () => this.removeFile(index));
                    legacyList.appendChild(fileItem);
                });
            }
        }

        // Handle new layout
        if (newList) {
            const filesSection = document.getElementById('filesSection');
            const mergeSection = document.getElementById('mergeSection');
            if (this.uploadedFiles.length === 0) {
                newList.innerHTML = '';
                if (filesSection) filesSection.style.display = 'none';
                if (mergeSection) mergeSection.style.display = 'none';
            } else {
                if (filesSection) filesSection.style.display = '';
                if (mergeSection) mergeSection.style.display = '';
                newList.innerHTML = '';
                this.uploadedFiles.forEach((file, index) => {
                    const row = document.createElement('div');
                    row.className = 'sortable-item d-flex align-items-center justify-content-between border rounded p-2 mb-2';
                    row.dataset.index = index.toString();
                    row.innerHTML = `
                        <div class="d-flex align-items-center">
                            <i class="fas fa-grip-vertical me-2 text-muted"></i>
                            <i class="fas fa-file-${this.getFileIcon(file.type)} me-2 text-primary"></i>
                            <div>
                                <div class="fw-semibold">${file.name}</div>
                                <div class="text-muted small">${this.getFileTypeLabel(file.type)} • ${this.formatFileSize(file.size)} • ${file.pages || '?'} pages</div>
                            </div>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-secondary me-2 preview-btn"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-sm btn-outline-danger remove-btn"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                    row.querySelector('.preview-btn').addEventListener('click', () => this.previewFile(index));
                    row.querySelector('.remove-btn').addEventListener('click', () => this.removeFile(index));
                    newList.appendChild(row);
                });
                // Re-init sortable each time to pick up new items
                this.initializeDragAndDrop();
            }
        }
    }
    
    updateArrangementList() {
        const arrangementList = document.getElementById('arrangementList');
        if (!arrangementList) return;
        
        arrangementList.innerHTML = '';
        
        this.uploadedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'arrangement-item';
            item.dataset.index = index.toString();
            
            item.innerHTML = `
                <div class="drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="item-number">${index + 1}</div>
                <div class="file-icon">
                    <i class="fas fa-file-${this.getFileIcon(file.type)}"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">
                        <span class="file-pages">${file.pages} pages</span>
                        <span class="file-size">${this.formatFileSize(file.size)}</span>
                    </div>
                </div>
            `;
            
            arrangementList.appendChild(item);
        });
        
        // Reinitialize sortable
        new Sortable(arrangementList, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'arrangement-ghost',
            onEnd: () => {
                // Update file order
                this.updateFileOrderFromDOM();
            }
        });
    }
    
    updateFileOrderFromDOM() {
        const arrangementList = document.getElementById('arrangementList');
        const filesList = document.getElementById('filesList');
        const source = arrangementList || filesList;
        if (!source) return;
        
        const items = source.querySelectorAll('[data-index]');
        const newOrder = [];
        const newFiles = [];
        
        items.forEach((item, newIndex) => {
            const oldIndex = parseInt(item.dataset.index);
            newOrder.push(oldIndex);
            newFiles.push(this.uploadedFiles[oldIndex]);
            
            // Update the displayed number
            const numEl = item.querySelector('.item-number');
            if (numEl) numEl.textContent = (newIndex + 1).toString();
        });
        
        this.uploadedFiles = newFiles;
        
        // Update data-index attributes for future reordering
        items.forEach((item, index) => {
            item.dataset.index = index.toString();
        });
    }
    
    reorderFilesByIndices(indices) {
        if (!indices || indices.length !== this.uploadedFiles.length) return;
        
        const newFiles = indices.map(index => this.uploadedFiles[index]);
        this.uploadedFiles = newFiles;
    }

    // Merge process methods
    startMergeProcess() {
        // Validate required fields (support both layouts)
        const bookTitle = (document.getElementById('documentTitle')?.value || document.getElementById('outputName')?.value || '').trim();
        if (!bookTitle || bookTitle.trim() === '') {
            this.showToast('Please enter a book title', 'warning');
            return;
        }
        // Prepare options from settings (both layouts)
        const includeToc = (document.getElementById('generateToc')?.checked ?? document.getElementById('includeToc')?.checked) !== false;
        const pageNumbers = (document.getElementById('autoNumbering')?.checked ?? document.getElementById('pageNumbers')?.checked) === true;
        const chapterBreaks = (document.getElementById('addPageBreaks')?.checked ?? document.getElementById('chapterBreaks')?.checked) !== false;
        const pageSize = (document.getElementById('pageSize')?.value || 'a4');
        const template = null; // could be extended later

        // Progress UI (old layout) — no-op if missing
        const pp = document.querySelector('.progress-percentage'); if (pp) pp.textContent = '0%';
        const progressSteps = document.querySelectorAll('.progress-step');
        if (progressSteps && progressSteps.length) {
            progressSteps.forEach((step, index) => {
                step.classList.remove('active', 'completed');
                const icon = step.querySelector('i');
                const status = step.querySelector('.progress-step-status');
                if (index === 0) {
                    step.classList.add('active');
                    if (icon) icon.className = 'fas fa-circle-notch fa-spin step-active';
                    if (status) status.textContent = 'In progress';
                } else {
                    if (icon) icon.className = 'fas fa-circle step-pending';
                    if (status) status.textContent = 'Waiting';
                }
            });
        }

        // Sidebar steps (new layout)
        this.setSidebarStepComplete(2); // configured
        this.setSidebarActive(3);
        this.setMergeStatus('Merging…', false);
        
        // Begin real merge with backend
        this.runMergeRequest({ includeToc, pageNumbers, chapterBreaks, pageSize, template, title: bookTitle }).catch(err => {
            console.error(err);
            this.showToast(`Merge failed: ${err.message || err}`, 'error');
            // fallback: return to settings
            this.setMergeStatus('Failed', false);
        });
    }
    
    calculateTotalPages() {
        // Sum all page estimates
        return this.uploadedFiles.reduce((total, file) => total + (file.pages || 0), 0);
    }
    
    calculateTotalSize() {
        // Sum file sizes and format
        const totalBytes = this.uploadedFiles.reduce((total, file) => total + file.size, 0);
        return this.formatFileSize(totalBytes);
    }
    
    addToRecentMerges(mergeData) {
        // Add to recent merges list (most recent first)
        this.recentMerges.unshift(mergeData);
        // Keep only latest 10 merges
        if (this.recentMerges.length > 10) {
            this.recentMerges.length = 10;
        }
        // Persist metadata only
        try {
            const toSave = this.recentMerges.map(m => ({
                id: m.id,
                title: m.title,
                pages: m.pages,
                chapters: m.chapters,
                size: m.size,
                date: m.date instanceof Date ? m.date.toISOString() : m.date
            }));
            localStorage.setItem('ff_recent_merges', JSON.stringify(toSave));
        } catch {}
        // Update UI
        this.updateRecentMerges();
    }
    
    updateRecentMerges() {
        const mergesGrid = document.getElementById('mergesGrid');
        if (!mergesGrid) return;
        
        if (this.recentMerges.length === 0) {
            mergesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>No recent merges</p>
                </div>
            `;
            return;
        }
        
        mergesGrid.innerHTML = '';
        
        this.recentMerges.forEach(merge => {
            const mergeItem = document.createElement('div');
            mergeItem.className = 'merge-item';
            
            const date = new Date(merge.date);
            const formattedDate = date.toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
            });
            
            mergeItem.innerHTML = `
                <h3 class="merge-title">${merge.title}</h3>
                <div class="merge-info">
                    <span>${merge.pages} pages</span>
                    <span>${merge.chapters} chapters</span>
                    <span>${merge.size}</span>
                </div>
                <div class="merge-date">
                    <i class="far fa-calendar-alt"></i>
                    <span>${formattedDate}</span>
                </div>
                <div class="merge-actions">
                    <button class="merge-button view-btn">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="merge-button download-btn">
                        <i class="fas fa-download"></i>
                        Download
                    </button>
                </div>
            `;
            
            // Add event listeners for the buttons
            const dlBtn = mergeItem.querySelector('.download-btn');
            const viewBtn = mergeItem.querySelector('.view-btn');
            if (this.lastMergedBlob && merge.id === this.lastMergedId) {
                dlBtn.addEventListener('click', () => this.downloadMergedDocument());
                viewBtn.addEventListener('click', () => this.previewMergedDocument());
            } else {
                dlBtn.addEventListener('click', () => this.showToast('This file is from a previous session and is not cached for download.', 'info'));
                viewBtn.addEventListener('click', () => this.showToast('This preview is not available in this session.', 'info'));
            }
            
            mergesGrid.appendChild(mergeItem);
        });
    }
    
    loadRecentMerges() {
        // Load from localStorage if available; otherwise empty
        try {
            const raw = localStorage.getItem('ff_recent_merges');
            if (raw) {
                const arr = JSON.parse(raw);
                this.recentMerges = (Array.isArray(arr) ? arr : []).map(m => ({
                    ...m,
                    date: m.date ? new Date(m.date) : new Date()
                }));
            } else {
                this.recentMerges = [];
            }
        } catch {
            this.recentMerges = [];
        }
        this.updateRecentMerges();
    }
    
    downloadMergedDocument() {
        const bookTitle = document.getElementById('finalBookTitle').textContent || 'Merged_Document';
        if (!this.lastMergedBlob) {
            this.showToast('No merged document available yet', 'warning');
            return;
        }
        const url = this.lastMergedUrl || URL.createObjectURL(this.lastMergedBlob);
        this.lastMergedUrl = url;
        const a = document.createElement('a');
        a.href = url;
        a.download = `${bookTitle.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    
    previewMergedDocument() {
        const bookTitle = document.getElementById('finalBookTitle').textContent || 'Merged_Document';
        if (!this.lastMergedBlob) {
            this.showToast('No merged document to preview', 'warning');
            return;
        }
        const url = this.lastMergedUrl || URL.createObjectURL(this.lastMergedBlob);
        this.lastMergedUrl = url;
        window.open(url, '_blank');
    }
    
    shareMergedDocument() {
        const bookTitle = document.getElementById('finalBookTitle').textContent;
        this.showToast(`Preparing to share "${bookTitle}"... (Feature coming soon)`, 'info');
    }

    // Helper methods
    getFileIcon(type) {
        const icons = {
            'application/pdf': 'pdf',
            'application/msword': 'word',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
            'text/plain': 'alt',
            'application/rtf': 'alt'
        };
        
        return icons[type] || 'file';
    }
    
    getFileTypeLabel(type) {
        const types = {
            'application/pdf': 'PDF',
            'application/msword': 'DOC',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
            'text/plain': 'TXT',
            'application/rtf': 'RTF'
        };
        
        return types[type] || type.split('/')[1].toUpperCase();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = this.getToastIcon(type);
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icon}"></i>
            </div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Show animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
        
        // Auto close
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
    
    getToastIcon(type) {
        switch (type) {
            case 'success': return 'fas fa-check-circle';
            case 'error': return 'fas fa-times-circle';
            case 'warning': return 'fas fa-exclamation-triangle';
            default: return 'fas fa-info-circle';
        }
    }
}

// Initialize the document merger
const mergerDashboard = new DocumentMerger();

// Backend helpers wired into the class prototype to keep layout unchanged
DocumentMerger.prototype.refreshFileStats = async function(justAdded) {
    const filesToInspect = (justAdded && justAdded.length ? justAdded : this.uploadedFiles);
    if (!filesToInspect.length) return;
    const form = new FormData();
    for (const fd of filesToInspect) {
        form.append('files', fd.file, fd.name);
    }
    const resp = await fetch(`${this.apiBase}/merge/inspect`, { method: 'POST', body: form });
    if (!resp.ok) return;
    const json = await resp.json().catch(() => null);
    if (!json || !Array.isArray(json.files)) return;
    // Update local entries by name match
    for (const info of json.files) {
        const idx = this.uploadedFiles.findIndex(f => f.name === info.name);
        if (idx !== -1) {
            if (typeof info.pages === 'number') this.uploadedFiles[idx].pages = info.pages;
            if (typeof info.size === 'number') this.uploadedFiles[idx].size = info.size;
        }
    }
    this.updateFileList();
};

DocumentMerger.prototype.updateProgressUI = function(progress) {
    const pct = Math.max(0, Math.min(100, progress|0));
    const progressPercentage = document.querySelector('.progress-percentage');
    const progressCircle = document.querySelector('.progress-circle');
    const progressFill = document.querySelector('.progress-fill');
    if (progressPercentage) progressPercentage.textContent = `${pct}%`;
    if (progressCircle) progressCircle.style.background = `conic-gradient(var(--primary-color) ${pct * 3.6}deg, var(--glass-bg) 0deg)`;
    if (progressFill) progressFill.style.width = `${pct}%`;
    // Steps mapping
    const thresholds = [20, 40, 60, 80, 100];
    const steps = document.querySelectorAll('.progress-step');
    thresholds.forEach((t, i) => {
        if (!steps[i]) return;
        const step = steps[i];
        if (pct >= t) {
            step.classList.add('completed');
            step.classList.remove('active');
            const icon = step.querySelector('i');
            const status = step.querySelector('.progress-step-status');
            if (icon) icon.className = 'fas fa-check-circle step-complete';
            if (status) status.textContent = 'Completed';
            if (steps[i+1] && pct < 100) {
                steps[i+1].classList.add('active');
                const nicon = steps[i+1].querySelector('i');
                const nstatus = steps[i+1].querySelector('.progress-step-status');
                if (nicon) nicon.className = 'fas fa-circle-notch fa-spin step-active';
                if (nstatus) nstatus.textContent = 'In progress';
            }
        }
    });
};

DocumentMerger.prototype.runMergeRequest = async function({ includeToc, pageNumbers, chapterBreaks, pageSize, template, title }) {
    // Build multipart form
    const form = new FormData();
    for (const f of this.uploadedFiles) {
        form.append('files', f.file, f.name);
    }
    form.append('page_size', pageSize || 'a4');
    form.append('generate_toc', includeToc ? 'true' : 'false');
    form.append('add_page_breaks', chapterBreaks ? 'true' : 'false');
    form.append('page_numbers', pageNumbers ? 'true' : 'false');
    if (template) form.append('template', template);

    // Stage 1: Validating
    this.updateProgressUI(10);
    await new Promise(r => setTimeout(r, 200));
    this.updateProgressUI(20);
    await new Promise(r => setTimeout(r, 200));
    // Stage 2: Converting formats
    this.updateProgressUI(40);
    // Stage 3: Merging content (animate while waiting for server)
    let animProgress = 40;
    const anim = setInterval(() => {
        animProgress = Math.min(animProgress + 3, 70);
        this.updateProgressUI(animProgress);
    }, 250);
    const resp = await fetch(`${this.apiBase}/merge/generate-toc-from-pdf`, { method: 'POST', body: form });
    clearInterval(anim);
    if (!resp.ok) {
        let msg = 'Merge failed';
        try { const j = await resp.json(); msg = j.detail || msg; } catch {}
        throw new Error(msg);
    }
    // Stage 4: Generating TOC
    this.updateProgressUI(85);
    // Read headers for metadata
    const dupHeader = resp.headers.get('X-Duplicates-Skipped');
    if (dupHeader) {
        const count = dupHeader.split(';').filter(Boolean).length;
        if (count > 0) this.showToast(`Skipped ${count} duplicate item(s)`, 'info');
    }
    // Get PDF blob
    const blob = await resp.blob();
    this.lastMergedBlob = blob;
    if (this.lastMergedUrl) {
        try { URL.revokeObjectURL(this.lastMergedUrl); } catch {}
        this.lastMergedUrl = null;
    }
    // Stage 5: Finalizing
    this.updateProgressUI(95);
    await new Promise(r => setTimeout(r, 250));
    this.updateProgressUI(100);

    // Fill download section stats
    document.getElementById('finalBookTitle').textContent = title || 'Your Merged Book';
    // Try to open PDF to count pages for accurate stats; fallback to estimates
    try {
        // Counting PDF pages on client is non-trivial without a PDF lib; fallback to estimate
        document.getElementById('totalPages').textContent = `${this.calculateTotalPages()} pages`;
    } catch {
        document.getElementById('totalPages').textContent = `${this.calculateTotalPages()} pages`;
    }
    document.getElementById('totalChapters').textContent = `${this.uploadedFiles.length} chapters`;
    const sizeMB = (blob.size / (1024*1024)).toFixed(2) + ' MB';
    document.getElementById('fileSize').textContent = sizeMB;

    // Add to recent merges dynamically
    const mergeId = Date.now();
    this.lastMergedId = mergeId;
    this.addToRecentMerges({
        id: mergeId,
        title: title || 'Merged Document',
        pages: this.calculateTotalPages(),
        chapters: this.uploadedFiles.length,
        size: sizeMB,
        date: new Date()
    });

    // Render an embedded PDF viewer in the download section like admin page
    try { this.renderMergedPdfPreview(title || 'Your Merged Book'); } catch {}

    // Move to download step
    this.goToStep(4);
    this.setSidebarStepComplete(3);
    this.setSidebarStepComplete(4);
    this.setMergeStatus('Complete', true);
    this.showToast('Document successfully merged!', 'success');
};

// Insert an iframe PDF viewer into the download section result preview
DocumentMerger.prototype.renderMergedPdfPreview = function(title) {
    if (!this.lastMergedBlob) return;
    const container = document.querySelector('.download-section .result-preview');
    if (!container) return;
    // Revoke previous URL if any
    if (this.lastMergedUrl) {
        try { URL.revokeObjectURL(this.lastMergedUrl); } catch {}
        this.lastMergedUrl = null;
    }
    const objectUrl = URL.createObjectURL(this.lastMergedBlob);
    this.lastMergedUrl = objectUrl;

    // Build viewer similar to admin implementation
    container.innerHTML = '';
    const titleEl = document.createElement('div');
    titleEl.className = 'mb-3';
    titleEl.innerHTML = `<h4 class="mb-1">${(title || 'Merged Document')}</h4><small class="text-muted">Preview of generated PDF</small>`;
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.minHeight = '600px';
    iframe.style.border = '1px solid #e9ecef';
    iframe.src = objectUrl;
    container.appendChild(titleEl);
    container.appendChild(iframe);
};

// Sidebar helpers (new layout)
DocumentMerger.prototype.setSidebarStepComplete = function(stepNum) {
    const el = document.getElementById(`step${stepNum}`);
    if (!el) return;
    const check = el.querySelector('.fa-check');
    if (check) check.style.display = '';
};
DocumentMerger.prototype.setSidebarActive = function(stepNum) {
    // Could highlight the active step; for now, ensure previous checks shown
    const el = document.getElementById(`step${stepNum}`);
    if (!el) return;
};
DocumentMerger.prototype.updateSidebarSteps = function(step) {
    // Map old steps to new sidebar (best-effort)
    for (let i = 1; i <= 4; i++) {
        if (i < step) this.setSidebarStepComplete(i);
    }
};
DocumentMerger.prototype.setMergeStatus = function(text, success) {
    const el = document.getElementById('mergeStatus');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('text-success', !!success);
    el.classList.toggle('text-danger', text?.toLowerCase().includes('fail'));
};

// Global wrappers for new layout inline handlers
// Namespaced wrappers to avoid collisions with any admin/global scripts
window.ffStartMerge = () => { try { mergerDashboard.startMergeProcess(); } catch (e) { console.error(e); } };
window.ffResetMerger = () => { try { mergerDashboard.startOver(); } catch (e) { console.error(e); } };
window.ffAddMoreFiles = () => { try { document.getElementById('fileInput')?.click(); } catch (e) { console.error(e); } };
window.ffClearAllFiles = () => { try { mergerDashboard.clearAllFiles(); } catch (e) { console.error(e); } };
window.ffSelectTemplate = (name) => { mergerDashboard.showToast(`Template \"${name}\" selected (not applied to backend)`, 'info'); };
window.ffExportDocument = (fmt) => { if (fmt === 'pdf') return mergerDashboard.downloadMergedDocument(); mergerDashboard.showToast(`Export to ${fmt.toUpperCase()} is not implemented yet`, 'info'); };
window.ffSaveCurrentPreset = () => mergerDashboard.showToast('Preset saved (demo)', 'success');
window.ffShowPresetModal = () => mergerDashboard.showToast('Preset modal coming soon', 'info');
window.ffShowKeyboardShortcuts = () => mergerDashboard.showToast('Shortcuts: Del to remove, Enter to merge', 'info');