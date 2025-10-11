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
        const uploadArea = document.getElementById('uploadArea');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
        }

        if (uploadArea) {
            uploadArea.addEventListener('click', () => {
                fileInput?.click();
            });

            // Drag and drop events
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('drag-over');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                this.handleFileUpload(e.dataTransfer.files);
            });
        }

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

        // Start merge button
        const startMergeBtn = document.querySelector('.start-merge-btn');
        if (startMergeBtn) {
            startMergeBtn.addEventListener('click', () => {
                this.startMergeProcess();
            });
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
        // Initialize sortable for document arrangement
        const arrangementList = document.getElementById('arrangementList');
        if (arrangementList) {
            new Sortable(arrangementList, {
                animation: 150,
                ghostClass: 'arrangement-ghost',
                onEnd: () => {
                    // Update file order based on DOM
                    const items = arrangementList.querySelectorAll('.arrangement-item');
                    const newOrder = Array.from(items).map(item => parseInt(item.dataset.index));
                    this.reorderFilesByIndices(newOrder);
                }
            });
        }
    }

    // Navigation methods
    goToStep(step) {
        if (step < 1 || step > 4) return;
        
        // Hide all sections
        const sections = ['uploadSection', 'arrangeSection', 'settingsSection', 'downloadSection'];
        sections.forEach(id => {
            const section = document.getElementById(id);
            if (section) {
                section.classList.add('hidden');
            }
        });
        
        // Hide progress section
        const progressSection = document.getElementById('progressSection');
        if (progressSection) {
            progressSection.classList.add('hidden');
        }
        
        // Show the target section
        const targetSection = document.getElementById(sections[step-1]);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }
        
        // Update workflow steps
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
    }
    
    proceedToStep(step) {
        // Validation before proceeding to next step
        if (step === 2) {
            // Check if there are at least 2 files uploaded
            if (this.uploadedFiles.length < 2) {
                this.showToast('Please upload at least 2 files to merge', 'warning');
                return;
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
    handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        // Process each file
        Array.from(files).forEach(file => {
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
                return;
            }
            
            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                this.showToast(`File "${file.name}" is too large. Maximum file size is 10MB.`, 'error');
                return;
            }
            
            // Check for duplicates
            if (this.uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
                this.showToast(`File "${file.name}" is already uploaded.`, 'warning');
                return;
            }
            
            // Add file to list with metadata
            const fileData = {
                name: file.name,
                size: file.size,
                type: file.type,
                uploadTime: new Date(),
                pages: this.estimatePageCount(file), // Estimate page count based on file size
                file: file // Keep reference to the actual file
            };
            
            this.uploadedFiles.push(fileData);
            this.showToast(`File "${file.name}" uploaded successfully.`, 'success');
        });
        
        // Update the UI
        this.updateFileList();
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
        const fileListElement = document.getElementById('uploadedFiles');
        if (!fileListElement) return;
        
        if (this.uploadedFiles.length === 0) {
            fileListElement.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-upload"></i>
                    <p>No files uploaded yet</p>
                </div>
            `;
            return;
        }
        
        fileListElement.innerHTML = '';
        
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
            
            // Add event listeners
            fileItem.querySelector('.preview-btn').addEventListener('click', () => {
                this.previewFile(index);
            });
            
            fileItem.querySelector('.remove-btn').addEventListener('click', () => {
                this.removeFile(index);
            });
            
            fileListElement.appendChild(fileItem);
        });
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
        if (!arrangementList) return;
        
        const items = arrangementList.querySelectorAll('.arrangement-item');
        const newOrder = [];
        const newFiles = [];
        
        items.forEach((item, newIndex) => {
            const oldIndex = parseInt(item.dataset.index);
            newOrder.push(oldIndex);
            newFiles.push(this.uploadedFiles[oldIndex]);
            
            // Update the displayed number
            item.querySelector('.item-number').textContent = (newIndex + 1).toString();
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
        // Validate required fields
        const bookTitle = document.getElementById('outputName')?.value;
        if (!bookTitle || bookTitle.trim() === '') {
            this.showToast('Please enter a book title', 'warning');
            return;
        }
        
        // Hide all sections
        document.querySelectorAll('.merger-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show progress section
        const progressSection = document.getElementById('progressSection');
        if (progressSection) {
            progressSection.classList.remove('hidden');
        }
        
        // Reset progress indicators
        document.querySelector('.progress-percentage').textContent = '0%';
        
        // Reset all progress steps
        const progressSteps = document.querySelectorAll('.progress-step');
        progressSteps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            const icon = step.querySelector('i');
            const status = step.querySelector('.progress-step-status');
            
            if (index === 0) {
                step.classList.add('active');
                icon.className = 'fas fa-circle-notch fa-spin step-active';
                status.textContent = 'In progress';
            } else {
                icon.className = 'fas fa-circle step-pending';
                status.textContent = 'Waiting';
            }
        });
        
        // Simulate merge process
        let progress = 0;
        const progressPercentage = document.querySelector('.progress-percentage');
        const progressCircle = document.querySelector('.progress-circle');
        const progressFill = document.querySelector('.progress-fill');
        
        // Define progress thresholds for each step
        const stepThresholds = [20, 40, 60, 80, 100];
        
        // Add subtle animation to make progress smoother
        const progressInterval = setInterval(() => {
            // Add random increments between 1-4 to make progress appear more realistic
            const increment = Math.floor(Math.random() * 4) + 1;
            progress = Math.min(progress + increment, 100);
            
            // Update progress percentage display with a fade effect
            if (progressPercentage) {
                progressPercentage.style.opacity = '0.5';
                setTimeout(() => {
                    progressPercentage.textContent = `${progress}%`;
                    progressPercentage.style.opacity = '1';
                }, 100);
            }
            
            // Update visual progress indicators with smooth transitions
            progressCircle.style.background = `conic-gradient(var(--primary-color) ${progress * 3.6}deg, var(--glass-bg) 0deg)`;
            
            if (progressFill) {
                progressFill.style.width = `${progress}%`;
            }
            
            // Handle step transitions
            stepThresholds.forEach((threshold, index) => {
                if (progress >= threshold && index < progressSteps.length) {
                    // Complete current step
                    const currentStep = progressSteps[index];
                    if (!currentStep.classList.contains('completed')) {
                        currentStep.classList.remove('active');
                        currentStep.classList.add('completed');
                        currentStep.querySelector('i').className = 'fas fa-check-circle step-complete';
                        currentStep.querySelector('.progress-step-status').textContent = 'Completed';
                    }
                    
                    // Activate next step if available
                    if (index + 1 < progressSteps.length && progress < 100) {
                        const nextStep = progressSteps[index + 1];
                        nextStep.classList.add('active');
                        nextStep.querySelector('i').className = 'fas fa-circle-notch fa-spin step-active';
                        nextStep.querySelector('.progress-step-status').textContent = 'In progress';
                    }
                }
            });
            
            if (progress >= 100) {
                clearInterval(progressInterval);
                
                // Mark final step as completed
                const finalStep = progressSteps[progressSteps.length - 1];
                finalStep.classList.remove('active');
                finalStep.classList.add('completed');
                finalStep.querySelector('i').className = 'fas fa-check-circle step-complete';
                finalStep.querySelector('.progress-step-status').textContent = 'Completed';
                
                // Set book title and stats in the download section
                document.getElementById('finalBookTitle').textContent = bookTitle || 'Your Merged Book';
                document.getElementById('totalPages').textContent = `${this.calculateTotalPages()} pages`;
                document.getElementById('totalChapters').textContent = `${this.uploadedFiles.length} chapters`;
                document.getElementById('fileSize').textContent = `${this.calculateTotalSize()}`;
                
                // Save to recent merges
                this.addToRecentMerges({
                    id: Date.now(),
                    title: bookTitle || 'Merged Document',
                    pages: this.calculateTotalPages(),
                    chapters: this.uploadedFiles.length,
                    size: this.calculateTotalSize(),
                    date: new Date()
                });
                
                // Show success notification
                this.showToast('Document successfully merged!', 'success');
                
                // Show download section after a short delay with fade effect
                setTimeout(() => {
                    this.goToStep(4);
                }, 1200);
            }
        }, 80);
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
        // Add to recent merges list
        this.recentMerges.unshift(mergeData);
        
        // Keep only latest 10 merges
        if (this.recentMerges.length > 10) {
            this.recentMerges.pop();
        }
        
        // Update UI
        this.updateRecentMerges();
        
        // Save to local storage (in a real app)
        // localStorage.setItem('recentMerges', JSON.stringify(this.recentMerges));
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
            mergeItem.querySelector('.download-btn').addEventListener('click', () => {
                this.showToast(`Downloading "${merge.title}"...`, 'info');
            });
            
            mergeItem.querySelector('.view-btn').addEventListener('click', () => {
                this.showToast(`Opening preview for "${merge.title}"...`, 'info');
            });
            
            mergesGrid.appendChild(mergeItem);
        });
    }
    
    loadRecentMerges() {
        // In a real app, would load from localStorage or server
        // For demo, create some sample merges
        this.recentMerges = [
            {
                id: Date.now() - 86400000, // 1 day ago
                title: "Annual Report 2023",
                pages: 42,
                chapters: 6,
                size: "3.2 MB",
                date: new Date(Date.now() - 86400000)
            },
            {
                id: Date.now() - 172800000, // 2 days ago
                title: "Product Specifications",
                pages: 18,
                chapters: 3,
                size: "1.5 MB",
                date: new Date(Date.now() - 172800000)
            },
            {
                id: Date.now() - 259200000, // 3 days ago
                title: "Research Paper Collection",
                pages: 67,
                chapters: 8,
                size: "5.7 MB",
                date: new Date(Date.now() - 259200000)
            },
            {
                id: Date.now() - 345600000, // 4 days ago
                title: "Marketing Strategy",
                pages: 23,
                chapters: 4,
                size: "2.1 MB",
                date: new Date(Date.now() - 345600000)
            }
        ];
        
        this.updateRecentMerges();
    }
    
    downloadMergedDocument() {
        // In a real app, would generate and download the merged document
        const bookTitle = document.getElementById('finalBookTitle').textContent;
        this.showToast(`Downloading "${bookTitle}"...`, 'success');
        
        // Simulate download by creating a dummy PDF link
        setTimeout(() => {
            const link = document.createElement('a');
            link.href = '#'; // Would be a real file URL
            link.download = `${bookTitle.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(link);
            // link.click(); // Uncomment in real app
            document.body.removeChild(link);
        }, 1000);
    }
    
    previewMergedDocument() {
        const bookTitle = document.getElementById('finalBookTitle').textContent;
        this.showToast(`Opening preview for "${bookTitle}"... (Feature coming soon)`, 'info');
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