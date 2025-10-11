// Submitted Books Dashboard JavaScript

class SubmissionDashboard {
    constructor() {
        this.submissions = this.getMockSubmissions();
        this.filteredSubmissions = [...this.submissions];
        this.currentFilter = 'all';
        this.currentSort = 'date-desc';
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderSubmissions();
        this.updateStats();
        this.initializeAnimations();
        this.setupFileUpload();
        this.fixInputSpaceHandling(); // Add this new method to fix the double space issue
    }

    // Fix the double space issue in text inputs
    fixInputSpaceHandling() {
        // Fix double space issue in all text inputs and textareas within modals
        const textInputs = document.querySelectorAll('.modal-overlay input[type="text"], .modal-overlay textarea');
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
        // Search functionality
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilter(e.target.dataset.filter));
        });

        // Sort dropdown
        const sortSelect = document.querySelector('.sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => this.handleSort(e.target.value));
        }

        // Click events
        document.addEventListener('click', (e) => {
            // New submission button
            if (e.target.closest('.new-submission-btn')) {
                this.showNewSubmissionModal();
            }

            // Submission card click
            if (e.target.closest('.submission-card')) {
                const submissionId = e.target.closest('.submission-card').dataset.submissionId;
                this.showSubmissionDetails(submissionId);
            }

            // Modal close
            if (e.target.closest('.modal-close') || e.target.classList.contains('modal-overlay')) {
                this.closeModals();
            }

            // Action buttons
            if (e.target.closest('.action-btn')) {
                e.stopPropagation();
                const action = e.target.closest('.action-btn').dataset.action;
                const submissionId = e.target.closest('.submission-card').dataset.submissionId;
                this.handleAction(action, submissionId);
            }

            // Logout button
            if (e.target.closest('.logout-btn')) {
                this.handleLogout();
            }

            // Notification button
            if (e.target.closest('.notification-btn')) {
                this.showNotifications();
            }
        });

        // Form submission
        const newSubmissionForm = document.getElementById('newSubmissionForm');
        if (newSubmissionForm) {
            newSubmissionForm.addEventListener('submit', (e) => this.handleSubmissionSubmit(e));
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    }

    getMockSubmissions() {
        return [
            {
                id: 1,
                title: "Advanced JavaScript Techniques",
                description: "A comprehensive guide covering modern JavaScript patterns, ES6+ features, and advanced programming concepts for professional developers.",
                status: "approved",
                submittedDate: "2024-01-15",
                lastUpdated: "2024-01-20",
                reviewer: "Sarah Johnson",
                category: "Technology",
                expectedChapters: 12,
                files: [
                    { name: "javascript-guide.pdf", size: "2.4 MB", type: "pdf" },
                    { name: "code-examples.zip", size: "1.8 MB", type: "zip" }
                ],
                comments: [
                    {
                        author: "Sarah Johnson",
                        date: "2024-01-20",
                        text: "Excellent content structure and comprehensive coverage. Approved for publication."
                    }
                ]
            },
            {
                id: 2,
                title: "React Best Practices Guide",
                description: "Modern React development patterns, hooks, performance optimization, and testing strategies for building scalable applications.",
                status: "pending",
                submittedDate: "2024-01-22",
                lastUpdated: "2024-01-22",
                reviewer: "Mike Chen",
                category: "Technology",
                expectedChapters: 15,
                files: [
                    { name: "react-guide.docx", size: "1.6 MB", type: "docx" },
                    { name: "component-examples.zip", size: "3.2 MB", type: "zip" }
                ],
                comments: []
            },
            {
                id: 3,
                title: "Python Data Science Handbook",
                description: "Complete guide to data analysis, machine learning, and visualization using Python libraries like pandas, numpy, and scikit-learn.",
                status: "rejected",
                submittedDate: "2024-01-10",
                lastUpdated: "2024-01-18",
                reviewer: "Dr. Lisa Wang",
                category: "Science",
                expectedChapters: 20,
                files: [
                    { name: "data-science-book.pdf", size: "4.1 MB", type: "pdf" },
                    { name: "datasets.zip", size: "12.5 MB", type: "zip" }
                ],
                comments: [
                    {
                        author: "Dr. Lisa Wang",
                        date: "2024-01-18",
                        text: "The content is good but needs more practical examples and better organization of chapters. Please revise sections 3-7."
                    }
                ]
            },
            {
                id: 4,
                title: "Digital Marketing Strategy",
                description: "Modern digital marketing approaches, social media strategies, and analytics for growing online businesses effectively.",
                status: "published",
                submittedDate: "2023-12-05",
                lastUpdated: "2023-12-20",
                reviewer: "Alex Rodriguez",
                category: "Business",
                expectedChapters: 10,
                files: [
                    { name: "marketing-strategy.pdf", size: "3.8 MB", type: "pdf" }
                ],
                comments: [
                    {
                        author: "Alex Rodriguez",
                        date: "2023-12-20",
                        text: "Outstanding work! Published and featured in our marketing section."
                    }
                ]
            },
            {
                id: 5,
                title: "Machine Learning Fundamentals",
                description: "Introduction to machine learning concepts, algorithms, and practical implementations using Python and popular ML libraries.",
                status: "pending",
                submittedDate: "2024-01-25",
                lastUpdated: "2024-01-25",
                reviewer: "Emma Davis",
                category: "Technology",
                expectedChapters: 18,
                files: [
                    { name: "ml-fundamentals.pdf", size: "5.2 MB", type: "pdf" },
                    { name: "notebooks.zip", size: "8.7 MB", type: "zip" }
                ],
                comments: []
            }
        ];
    }

    updateStats() {
        const stats = {
            pending: this.submissions.filter(s => s.status === 'pending').length,
            approved: this.submissions.filter(s => s.status === 'approved').length,
            rejected: this.submissions.filter(s => s.status === 'rejected').length,
            published: this.submissions.filter(s => s.status === 'published').length
        };

        // Update stat cards
        const statCards = document.querySelectorAll('.stat-card');
        statCards[0].querySelector('h3').textContent = stats.pending;
        statCards[1].querySelector('h3').textContent = stats.approved;
        statCards[2].querySelector('h3').textContent = stats.rejected;
        statCards[3].querySelector('h3').textContent = stats.published;
    }

    handleSearch(query) {
        const lowercaseQuery = query.toLowerCase();
        this.filteredSubmissions = this.submissions.filter(submission => 
            submission.title.toLowerCase().includes(lowercaseQuery) ||
            submission.description.toLowerCase().includes(lowercaseQuery) ||
            submission.category.toLowerCase().includes(lowercaseQuery) ||
            submission.reviewer.toLowerCase().includes(lowercaseQuery)
        );

        // Apply current filter
        if (this.currentFilter !== 'all') {
            this.filteredSubmissions = this.filteredSubmissions.filter(s => s.status === this.currentFilter);
        }

        this.sortSubmissions();
        this.renderSubmissions();
    }

    handleFilter(filter) {
        this.currentFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

        // Filter submissions
        if (filter === 'all') {
            this.filteredSubmissions = [...this.submissions];
        } else {
            this.filteredSubmissions = this.submissions.filter(submission => submission.status === filter);
        }

        // Apply search if active
        const searchQuery = document.querySelector('.search-input').value;
        if (searchQuery) {
            this.handleSearch(searchQuery);
        } else {
            this.sortSubmissions();
            this.renderSubmissions();
        }

        this.showToast('success', 'Filter Applied', `Showing ${this.filteredSubmissions.length} submissions`);
    }

    handleSort(sortType) {
        this.currentSort = sortType;
        this.sortSubmissions();
        this.renderSubmissions();
    }

    sortSubmissions() {
        switch (this.currentSort) {
            case 'date-desc':
                this.filteredSubmissions.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
                break;
            case 'date-asc':
                this.filteredSubmissions.sort((a, b) => new Date(a.submittedDate) - new Date(b.submittedDate));
                break;
            case 'title-asc':
                this.filteredSubmissions.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title-desc':
                this.filteredSubmissions.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'status':
                this.filteredSubmissions.sort((a, b) => a.status.localeCompare(b.status));
                break;
        }
    }

    renderSubmissions() {
        const submissionsGrid = document.getElementById('submissionsGrid');
        
        if (this.filteredSubmissions.length === 0) {
            submissionsGrid.innerHTML = this.getEmptyState();
            return;
        }

        submissionsGrid.innerHTML = this.filteredSubmissions.map(submission => 
            this.createSubmissionCard(submission)
        ).join('');

        // Animate cards
        this.animateCards();
    }

    createSubmissionCard(submission) {
        const formattedDate = new Date(submission.submittedDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const daysSince = Math.floor((new Date() - new Date(submission.submittedDate)) / (1000 * 60 * 60 * 24));
        
        const statusLabels = {
            'pending': 'Pending Review',
            'approved': 'Approved',
            'rejected': 'Needs Revision',
            'published': 'Published'
        };
        
        const statusIcons = {
            'pending': 'fa-clock',
            'approved': 'fa-check-circle',
            'rejected': 'fa-exclamation-circle',
            'published': 'fa-globe'
        };

        return `
            <div class="submission-card" data-submission-id="${submission.id}">
                <div class="submission-card-header">
                    <div>
                        <h3 class="submission-card-title">${submission.title}</h3>
                        <div class="submission-card-meta">
                            <div class="meta-item">
                                <i class="fas fa-calendar"></i>
                                <span>${formattedDate}</span>
                            </div>
                            <div class="meta-item">
                                <i class="fas fa-folder"></i>
                                <span>${submission.category}</span>
                            </div>
                        </div>
                    </div>
                    <span class="status-badge ${submission.status}">
                        <i class="fas ${statusIcons[submission.status]}"></i>
                        ${statusLabels[submission.status]}
                    </span>
                </div>
                
                <div class="submission-card-body">
                    <p class="submission-card-description">${submission.description}</p>
                    
                    <div class="submission-card-info">
                        <div class="info-item">
                            <div class="info-item-label">Reviewer</div>
                            <div class="info-item-value">${submission.reviewer}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-item-label">Chapters</div>
                            <div class="info-item-value">${submission.expectedChapters}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-item-label">Files</div>
                            <div class="info-item-value">${submission.files.length} uploaded</div>
                        </div>
                        <div class="info-item">
                            <div class="info-item-label">Days Since</div>
                            <div class="info-item-value">${daysSince} days</div>
                        </div>
                    </div>
                </div>
                
                <div class="submission-card-footer">
                    <div class="submission-card-actions">
                        <button class="action-btn" data-action="view">
                            <i class="fas fa-eye"></i>
                            View Details
                        </button>
                        <button class="action-btn" data-action="download">
                            <i class="fas fa-download"></i>
                            Download
                        </button>
                        ${submission.status === 'rejected' ? 
                            '<button class="action-btn" data-action="edit"><i class="fas fa-edit"></i>Edit</button>' : 
                            ''
                        }
                    </div>
                </div>
            </div>
        `;
    }

    getEmptyState() {
        return `
            <div class="empty-state">
                <i class="fas fa-file-alt"></i>
                <h3>No submissions found</h3>
                <p>You haven't submitted any books yet, or no submissions match your current filter.</p>
                <button class="btn-primary new-submission-btn">
                    <i class="fas fa-plus"></i>
                    Submit Your First Book
                </button>
            </div>
        `;
    }

    showSubmissionDetails(submissionId) {
        const submission = this.submissions.find(s => s.id == submissionId);
        if (!submission) return;

        const modal = document.getElementById('submissionModal');
        
        const statusLabels = {
            'pending': 'Pending Review',
            'approved': 'Approved',
            'rejected': 'Needs Revision',
            'published': 'Published'
        };
        
        const statusIcons = {
            'pending': 'fa-clock',
            'approved': 'fa-check-circle',
            'rejected': 'fa-exclamation-circle',
            'published': 'fa-globe'
        };
        
        // Update modal content
        document.getElementById('modalSubmissionTitle').textContent = submission.title;
        const statusBadge = document.getElementById('modalSubmissionStatus');
        statusBadge.className = `status-badge ${submission.status}`;
        statusBadge.innerHTML = `<i class="fas ${statusIcons[submission.status]}"></i>${statusLabels[submission.status]}`;
        
        // Update detail cards
        document.getElementById('modalSubmittedDate').textContent = new Date(submission.submittedDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        document.getElementById('modalLastUpdated').textContent = new Date(submission.lastUpdated).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        document.getElementById('modalReviewer').textContent = submission.reviewer;
        document.getElementById('modalCategory').textContent = submission.category;
        document.getElementById('modalDescription').textContent = submission.description;

        // Update comments
        const commentsContainer = document.getElementById('modalComments');
        if (submission.comments && submission.comments.length > 0) {
            commentsContainer.innerHTML = submission.comments.map(comment => {
                const initials = comment.author.split(' ').map(n => n[0]).join('').toUpperCase();
                return `
                    <div class="comment-item">
                        <div class="comment-header">
                            <div class="comment-author">
                                <div class="comment-author-avatar">${initials}</div>
                                <span class="comment-author-name">${comment.author}</span>
                            </div>
                            <span class="comment-date">${new Date(comment.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}</span>
                        </div>
                        <p class="comment-text">${comment.text}</p>
                    </div>
                `;
            }).join('');
        } else {
            commentsContainer.innerHTML = `
                <div class="comments-empty">
                    <i class="fas fa-comments"></i>
                    <p>No review comments yet.</p>
                </div>
            `;
        }

        // Update files
        const filesContainer = document.getElementById('modalFiles');
        if (submission.files && submission.files.length > 0) {
            filesContainer.innerHTML = submission.files.map(file => `
                <div class="file-item">
                    <div class="file-item-icon">
                        <i class="fas fa-file-${this.getFileIcon(file.type)}"></i>
                    </div>
                    <div class="file-item-info">
                        <div class="file-item-name">${file.name}</div>
                        <div class="file-item-meta">
                            <span><i class="fas fa-file"></i> ${file.type.toUpperCase()}</span>
                            <span><i class="fas fa-hdd"></i> ${file.size}</span>
                        </div>
                    </div>
                    <div class="file-item-actions">
                        <button class="file-action-btn" onclick="submissionDashboard.previewFile('${file.name}')" title="Preview">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="file-action-btn" onclick="submissionDashboard.downloadFile('${file.name}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            filesContainer.innerHTML = `
                <div class="files-empty">
                    <i class="fas fa-paperclip"></i>
                    <p>No files attached.</p>
                </div>
            `;
        }

        // Show modal
        modal.classList.add('show');
    }

    getFileIcon(type) {
        const icons = {
            pdf: 'pdf',
            doc: 'word',
            docx: 'word',
            txt: 'alt',
            zip: 'archive'
        };
        return icons[type] || 'file';
    }

    showNewSubmissionModal() {
        const modal = document.getElementById('newSubmissionModal');
        modal.classList.add('show');
    }

    closeModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('show');
        });
    }

    closeNewSubmissionModal() {
        this.closeModals();
        // Reset form
        document.getElementById('newSubmissionForm').reset();
        document.getElementById('uploadedFiles').innerHTML = '';
    }

    handleAction(action, submissionId) {
        const submission = this.submissions.find(s => s.id == submissionId);
        
        switch (action) {
            case 'view':
                this.showSubmissionDetails(submissionId);
                break;
            case 'download':
                this.downloadSubmission(submissionId);
                break;
            case 'edit':
                this.editSubmission(submissionId);
                break;
        }
    }

    downloadSubmission(submissionId) {
        const submission = this.submissions.find(s => s.id == submissionId);
        this.showToast('info', 'Download Started', `Downloading "${submission.title}"...`);
        
        // Simulate download
        setTimeout(() => {
            this.showToast('success', 'Download Complete', 'Files have been downloaded to your device');
        }, 2000);
    }

    previewFile(filename) {
        this.showToast('info', 'Preview', `Opening preview for "${filename}"...`);
        
        // In a real app, this would open a file preview modal or new window
        setTimeout(() => {
            this.showToast('info', 'Feature Coming Soon', 'File preview will be available soon');
        }, 800);
    }

    downloadFile(filename) {
        this.showToast('info', 'Download Started', `Downloading "${filename}"...`);
        
        // Simulate download
        setTimeout(() => {
            this.showToast('success', 'Download Complete', `"${filename}" has been downloaded`);
        }, 1500);
    }

    editSubmission(submissionId) {
        this.showToast('info', 'Feature Coming Soon', 'Submission editing will be available soon');
    }

    setupFileUpload() {
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('submissionFiles');
        const uploadedFilesContainer = document.getElementById('uploadedFiles');

        if (!fileUploadArea || !fileInput) return;

        // Click to browse
        fileUploadArea.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag and drop
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
    }

    handleFiles(files) {
        const uploadedFilesContainer = document.getElementById('uploadedFiles');
        
        Array.from(files).forEach(file => {
            if (this.validateFile(file)) {
                this.addUploadedFile(file);
            }
        });
    }

    validateFile(file) {
        const allowedTypes = ['application/pdf', 'application/msword', 
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                            'text/plain'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!allowedTypes.includes(file.type)) {
            this.showToast('error', 'Invalid File Type', 'Please upload PDF, DOC, DOCX, or TXT files only');
            return false;
        }

        if (file.size > maxSize) {
            this.showToast('error', 'File Too Large', 'Please upload files smaller than 10MB');
            return false;
        }

        return true;
    }

    addUploadedFile(file) {
        const uploadedFilesContainer = document.getElementById('uploadedFiles');
        const fileId = Date.now() + Math.random();
        
        const fileElement = document.createElement('div');
        fileElement.className = 'uploaded-file';
        fileElement.dataset.fileId = fileId;
        
        fileElement.innerHTML = `
            <div class="uploaded-file-info">
                <div class="uploaded-file-icon">
                    <i class="fas fa-file-${this.getFileIcon(file.type)}"></i>
                </div>
                <div class="uploaded-file-details">
                    <p class="uploaded-file-name">${file.name}</p>
                    <p class="uploaded-file-size">${this.formatFileSize(file.size)}</p>
                </div>
            </div>
            <button type="button" class="remove-file" onclick="submissionDashboard.removeFile('${fileId}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        uploadedFilesContainer.appendChild(fileElement);
    }

    removeFile(fileId) {
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileElement) {
            fileElement.remove();
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    handleSubmissionSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const submissionData = {
            title: formData.get('bookTitle'),
            description: formData.get('bookDescription'),
            category: formData.get('bookCategory'),
            expectedChapters: parseInt(formData.get('expectedChapters')),
            collaborators: formData.get('collaborators')
        };

        // Validate form
        if (!this.validateSubmissionForm(submissionData)) {
            return;
        }

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        // Simulate submission
        setTimeout(() => {
            this.showToast('success', 'Submission Successful', 'Your book has been submitted for review');
            this.closeNewSubmissionModal();
            
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            
            // Add new submission to list (mock)
            this.addNewSubmission(submissionData);
        }, 2000);
    }

    validateSubmissionForm(data) {
        if (!data.title.trim()) {
            this.showToast('error', 'Validation Error', 'Please enter a book title');
            return false;
        }
        
        if (!data.description.trim()) {
            this.showToast('error', 'Validation Error', 'Please enter a description');
            return false;
        }
        
        if (!data.category) {
            this.showToast('error', 'Validation Error', 'Please select a category');
            return false;
        }
        
        if (!data.expectedChapters || data.expectedChapters < 1) {
            this.showToast('error', 'Validation Error', 'Please enter a valid number of chapters');
            return false;
        }

        const uploadedFiles = document.querySelectorAll('.uploaded-file');
        if (uploadedFiles.length === 0) {
            this.showToast('error', 'Validation Error', 'Please upload at least one file');
            return false;
        }

        return true;
    }

    addNewSubmission(data) {
        const newSubmission = {
            id: this.submissions.length + 1,
            title: data.title,
            description: data.description,
            status: 'pending',
            submittedDate: new Date().toISOString().split('T')[0],
            lastUpdated: new Date().toISOString().split('T')[0],
            reviewer: 'Pending Assignment',
            category: data.category,
            expectedChapters: data.expectedChapters,
            files: [
                { name: 'submission.pdf', size: '2.1 MB', type: 'pdf' }
            ],
            comments: []
        };

        this.submissions.unshift(newSubmission);
        this.filteredSubmissions = [...this.submissions];
        this.updateStats();
        this.renderSubmissions();
    }

    showNotifications() {
        const notifications = [
            { type: 'info', title: 'Review Update', message: 'Your submission "React Guide" is under review' },
            { type: 'success', title: 'Approved', message: 'Congratulations! "JavaScript Techniques" has been approved' },
            { type: 'warning', title: 'Revision Needed', message: 'Please revise "Python Handbook" based on feedback' }
        ];

        notifications.forEach((notif, index) => {
            setTimeout(() => {
                this.showToast(notif.type, notif.title, notif.message);
            }, index * 1000);
        });
    }

    handleLogout() {
        this.showToast('info', 'Logging out...', 'Redirecting to login page');
        setTimeout(() => {
            window.location.href = '../admin/index.html';
        }, 2000);
    }

    showToast(type, title, message) {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add close event
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        toastContainer.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    animateCards() {
        const cards = document.querySelectorAll('.submission-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    initializeAnimations() {
        // Animate stats cards
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });

        // Animate filter section
        const filterSection = document.querySelector('.filter-section');
        if (filterSection) {
            filterSection.style.opacity = '0';
            filterSection.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                filterSection.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                filterSection.style.opacity = '1';
                filterSection.style.transform = 'translateY(0)';
            }, 400);
        }
    }
}

// Initialize submission dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.submissionDashboard = new SubmissionDashboard();
});

// Global functions for onclick handlers
function removeFile(fileId) {
    window.submissionDashboard.removeFile(fileId);
}