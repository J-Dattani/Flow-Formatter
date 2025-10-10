class SubmissionsManager {
    constructor() {
        this.submissions = [];
        this.filteredSubmissions = [];
        this.currentPage = 1;
        this.submissionsPerPage = 10;
        this.currentView = 'table';
        this.currentSubmission = null;
        
        this.init();
    }

    async init() {
        await this.loadSubmissions();
        await this.loadTemplatesForFilter();
        this.setupEventListeners();
        this.renderSubmissions();
        this.updateStatistics();
    }

    setupEventListeners() {
        // Search functionality
        document.getElementById('searchSubmissions').addEventListener('input', (e) => {
            this.applyFilters();
        });

        // Filter functionality
        ['statusFilter', 'templateFilter', 'dateFilter'].forEach(filterId => {
            document.getElementById(filterId).addEventListener('change', () => {
                if (filterId === 'dateFilter' && document.getElementById('dateFilter').value === 'custom') {
                    document.getElementById('customDateRange').style.display = 'block';
                } else if (filterId === 'dateFilter') {
                    document.getElementById('customDateRange').style.display = 'none';
                }
                this.applyFilters();
            });
        });

        // Custom date range
        ['startDate', 'endDate'].forEach(dateId => {
            document.getElementById(dateId).addEventListener('change', () => {
                this.applyFilters();
            });
        });

        // Logout functionality
        document.getElementById('logoutBtn2').addEventListener('click', () => {
            AuthSystem.logout();
        });
    }

    async loadSubmissions() {
        try {
            const response = await API.getSubmissions();
            this.submissions = response.data || response;
            this.filteredSubmissions = [...this.submissions];
        } catch (error) {
            console.error('Error loading submissions:', error);
            this.showToast('Error loading submissions', 'error');
        }
    }

    async loadTemplatesForFilter() {
        try {
            const response = await API.getTemplates();
            const templates = response.data || response;
            const templateFilter = document.getElementById('templateFilter');
            
            templates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                templateFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchSubmissions').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const templateFilter = document.getElementById('templateFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        this.filteredSubmissions = this.submissions.filter(submission => {
            // Search filter
            const matchesSearch = !searchTerm || 
                submission.title.toLowerCase().includes(searchTerm) ||
                submission.author_name.toLowerCase().includes(searchTerm) ||
                submission.template_name.toLowerCase().includes(searchTerm);

            // Status filter
            const matchesStatus = !statusFilter || submission.status === statusFilter;

            // Template filter
            const matchesTemplate = !templateFilter || submission.template_id === templateFilter;

            // Date filter
            let matchesDate = true;
            if (dateFilter) {
                const submissionDate = new Date(submission.created_at);
                const now = new Date();
                
                switch (dateFilter) {
                    case 'today':
                        matchesDate = submissionDate.toDateString() === now.toDateString();
                        break;
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        matchesDate = submissionDate >= weekAgo;
                        break;
                    case 'month':
                        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                        matchesDate = submissionDate >= monthAgo;
                        break;
                    case 'custom':
                        if (startDate && endDate) {
                            const start = new Date(startDate);
                            const end = new Date(endDate);
                            end.setHours(23, 59, 59, 999); // Include end date
                            matchesDate = submissionDate >= start && submissionDate <= end;
                        }
                        break;
                }
            }

            return matchesSearch && matchesStatus && matchesTemplate && matchesDate;
        });

        this.currentPage = 1;
        this.renderSubmissions();
    }

    clearFilters() {
        document.getElementById('searchSubmissions').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('templateFilter').value = '';
        document.getElementById('dateFilter').value = '';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('customDateRange').style.display = 'none';
        
        this.filteredSubmissions = [...this.submissions];
        this.currentPage = 1;
        this.renderSubmissions();
    }

    changeView(view) {
        this.currentView = view;
        
        if (view === 'table') {
            document.getElementById('tableView').style.display = 'block';
            document.getElementById('cardsView').style.display = 'none';
        } else {
            document.getElementById('tableView').style.display = 'none';
            document.getElementById('cardsView').style.display = 'block';
        }
        
        this.renderSubmissions();
    }

    renderSubmissions() {
        const startIdx = (this.currentPage - 1) * this.submissionsPerPage;
        const endIdx = startIdx + this.submissionsPerPage;
        const submissionsToShow = this.filteredSubmissions.slice(startIdx, endIdx);

        if (this.currentView === 'table') {
            this.renderTableView(submissionsToShow);
        } else {
            this.renderCardsView(submissionsToShow);
        }
        
        this.renderPagination();
    }

    renderTableView(submissions) {
        const tbody = document.getElementById('submissionsTableBody');
        
        if (submissions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <i class="fas fa-file-alt fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No submissions found</h5>
                        <p class="text-muted">Try adjusting your search criteria.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = submissions.map(submission => `
            <tr onclick="submissionsManager.viewSubmission('${submission.id}')" style="cursor: pointer;">
                <td class="ps-4">
                    <div class="d-flex align-items-center">
                        <div class="me-3">
                            <i class="fas fa-file-alt fa-lg text-primary"></i>
                        </div>
                        <div>
                            <div class="fw-bold">${submission.title}</div>
                            <small class="text-muted">${submission.description || 'No description'}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-sm me-2" style="width: 30px; height: 30px; background: linear-gradient(135deg, #6C63FF, #7B8CFF); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-user text-white" style="font-size: 12px;"></i>
                        </div>
                        <div>
                            <div class="fw-medium">${submission.author_name}</div>
                            <small class="text-muted">${submission.author_email}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge bg-light text-dark">${submission.template_name}</span>
                </td>
                <td>
                    ${this.getStatusBadge(submission.status)}
                </td>
                <td>
                    <div>${this.formatDate(submission.created_at)}</div>
                    <small class="text-muted">${this.getTimeAgo(submission.created_at)}</small>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-outline-primary btn-sm" onclick="event.stopPropagation(); submissionsManager.viewSubmission('${submission.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-success btn-sm" onclick="event.stopPropagation(); submissionsManager.downloadDocument('${submission.id}')">
                            <i class="fas fa-download"></i>
                        </button>
                        <div class="dropdown">
                            <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" onclick="event.stopPropagation()">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="submissionsManager.approveSubmission('${submission.id}')">
                                    <i class="fas fa-check text-success me-2"></i>Approve
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="submissionsManager.rejectSubmission('${submission.id}')">
                                    <i class="fas fa-times text-danger me-2"></i>Reject
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="#" onclick="submissionsManager.deleteSubmission('${submission.id}')">
                                    <i class="fas fa-trash text-danger me-2"></i>Delete
                                </a></li>
                            </ul>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderCardsView(submissions) {
        const container = document.getElementById('submissionsCardsContainer');
        
        if (submissions.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-file-alt fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No submissions found</h5>
                    <p class="text-muted">Try adjusting your search criteria.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = submissions.map(submission => `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="card h-100 shadow-sm submission-card" style="border-radius: 1rem; transition: all 0.3s ease; cursor: pointer;" onclick="submissionsManager.viewSubmission('${submission.id}')">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div class="flex-grow-1">
                                <h6 class="fw-bold mb-1">${submission.title}</h6>
                                <small class="text-muted">${submission.template_name}</small>
                            </div>
                            ${this.getStatusBadge(submission.status)}
                        </div>
                        
                        <div class="d-flex align-items-center mb-3">
                            <div class="avatar-sm me-2" style="width: 35px; height: 35px; background: linear-gradient(135deg, #6C63FF, #7B8CFF); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-user text-white" style="font-size: 14px;"></i>
                            </div>
                            <div>
                                <div class="fw-medium">${submission.author_name}</div>
                                <small class="text-muted">${submission.author_email}</small>
                            </div>
                        </div>

                        ${submission.description ? `<p class="small text-muted mb-3">${submission.description.substring(0, 100)}${submission.description.length > 100 ? '...' : ''}</p>` : ''}
                        
                        <div class="row text-center mb-3">
                            <div class="col-4">
                                <div class="small text-muted">Words</div>
                                <div class="fw-bold text-primary">${submission.word_count || 0}</div>
                            </div>
                            <div class="col-4">
                                <div class="small text-muted">Pages</div>
                                <div class="fw-bold text-info">${submission.page_count || 1}</div>
                            </div>
                            <div class="col-4">
                                <div class="small text-muted">Version</div>
                                <div class="fw-bold text-success">${submission.version || '1.0'}</div>
                            </div>
                        </div>

                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">${this.getTimeAgo(submission.created_at)}</small>
                            <div class="btn-group">
                                <button class="btn btn-outline-primary btn-sm" onclick="event.stopPropagation(); submissionsManager.downloadDocument('${submission.id}')">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="btn btn-outline-success btn-sm" onclick="event.stopPropagation(); submissionsManager.approveSubmission('${submission.id}')">
                                    <i class="fas fa-check"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    getStatusBadge(status) {
        const badges = {
            pending: '<span class="badge bg-warning">Pending</span>',
            approved: '<span class="badge bg-success">Approved</span>',
            rejected: '<span class="badge bg-danger">Rejected</span>',
            draft: '<span class="badge bg-secondary">Draft</span>'
        };
        return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
    }

    getTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredSubmissions.length / this.submissionsPerPage);
        const pagination = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="submissionsManager.changePage(${this.currentPage - 1})">Previous</a>
            </li>
        `;
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHTML += `
                    <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="submissionsManager.changePage(${i})">${i}</a>
                    </li>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }
        
        // Next button
        paginationHTML += `
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="submissionsManager.changePage(${this.currentPage + 1})">Next</a>
            </li>
        `;
        
        pagination.innerHTML = paginationHTML;
    }

    changePage(page) {
        const totalPages = Math.ceil(this.filteredSubmissions.length / this.submissionsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderSubmissions();
        }
    }

    updateStatistics() {
        const total = this.submissions.length;
        const pending = this.submissions.filter(s => s.status === 'pending').length;
        const approved = this.submissions.filter(s => s.status === 'approved').length;
        const downloads = this.submissions.reduce((sum, s) => sum + (s.download_count || 0), 0);

        // Animate counters
        this.animateCounter('totalSubmissions', total);
        this.animateCounter('pendingSubmissions', pending);
        this.animateCounter('approvedSubmissions', approved);
        this.animateCounter('downloadCount', downloads);
    }

    animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        const startValue = 0;
        const duration = 1000;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
            
            element.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    async viewSubmission(submissionId) {
        try {
            const submission = await API.getSubmission(submissionId);
            this.currentSubmission = submission;
            
            const modalBody = document.getElementById('submissionModalBody');
            modalBody.innerHTML = `
                <div class="row">
                    <div class="col-md-8">
                        <h6>Document Preview</h6>
                        <div class="border rounded p-4 bg-light" style="height: 500px; overflow-y: auto;">
                            ${this.renderDocumentPreview(submission)}
                        </div>
                    </div>
                    <div class="col-md-4">
                        <h6>Submission Details</h6>
                        <div class="card">
                            <div class="card-body">
                                <p><strong>Title:</strong> ${submission.title}</p>
                                <p><strong>Author:</strong> ${submission.author_name}</p>
                                <p><strong>Email:</strong> ${submission.author_email}</p>
                                <p><strong>Template:</strong> ${submission.template_name}</p>
                                <p><strong>Status:</strong> ${this.getStatusBadge(submission.status)}</p>
                                <p><strong>Submitted:</strong> ${this.formatDate(submission.created_at)}</p>
                                <p><strong>Word Count:</strong> ${submission.word_count || 0}</p>
                                <p><strong>Page Count:</strong> ${submission.page_count || 1}</p>
                                ${submission.description ? `<p><strong>Description:</strong> ${submission.description}</p>` : ''}
                            </div>
                        </div>
                        
                        ${submission.comments && submission.comments.length > 0 ? `
                            <h6 class="mt-4">Comments</h6>
                            <div class="card">
                                <div class="card-body">
                                    ${submission.comments.map(comment => `
                                        <div class="mb-3">
                                            <div class="d-flex justify-content-between">
                                                <strong>${comment.author}</strong>
                                                <small class="text-muted">${this.formatDate(comment.created_at)}</small>
                                            </div>
                                            <p class="mb-0">${comment.text}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            new bootstrap.Modal(document.getElementById('submissionModal')).show();
        } catch (error) {
            console.error('Error loading submission:', error);
            this.showToast('Error loading submission details', 'error');
        }
    }

    renderDocumentPreview(submission) {
        // Create a simplified document preview
        let preview = `<div class="document-preview">`;
        
        if (submission.content) {
            submission.content.forEach(section => {
                switch (section.type) {
                    case 'title':
                        preview += `<h1 class="mb-3">${section.content}</h1>`;
                        break;
                    case 'subtitle':
                        preview += `<h2 class="mb-3">${section.content}</h2>`;
                        break;
                    case 'paragraph':
                        preview += `<p class="mb-3">${section.content}</p>`;
                        break;
                    case 'quote':
                        preview += `<blockquote class="blockquote mb-3"><p>"${section.content}"</p></blockquote>`;
                        break;
                    case 'image':
                        preview += `<div class="text-center mb-3"><img src="${section.url}" class="img-fluid" alt="Document Image" style="max-height: 200px;"></div>`;
                        break;
                    case 'divider':
                        preview += `<hr class="my-4">`;
                        break;
                }
            });
        } else {
            preview += `<p class="text-muted">No content preview available.</p>`;
        }
        
        preview += `</div>`;
        return preview;
    }

    async approveSubmission(submissionId) {
        if (!submissionId && this.currentSubmission) {
            submissionId = this.currentSubmission.id;
        }
        
        if (confirm('Approve this submission?')) {
            try {
                await API.updateSubmissionStatus(submissionId, 'approved');
                
                // Update local data
                const submission = this.submissions.find(s => s.id === submissionId);
                if (submission) {
                    submission.status = 'approved';
                }
                
                this.renderSubmissions();
                this.updateStatistics();
                this.showToast('Submission approved successfully!', 'success');
                
                // Close modal if open
                const modal = bootstrap.Modal.getInstance(document.getElementById('submissionModal'));
                if (modal) modal.hide();
            } catch (error) {
                console.error('Error approving submission:', error);
                this.showToast('Error approving submission', 'error');
            }
        }
    }

    async rejectSubmission(submissionId) {
        if (!submissionId && this.currentSubmission) {
            submissionId = this.currentSubmission.id;
        }
        
        if (confirm('Reject this submission?')) {
            try {
                await API.updateSubmissionStatus(submissionId, 'rejected');
                
                // Update local data
                const submission = this.submissions.find(s => s.id === submissionId);
                if (submission) {
                    submission.status = 'rejected';
                }
                
                this.renderSubmissions();
                this.updateStatistics();
                this.showToast('Submission rejected', 'info');
                
                // Close modal if open
                const modal = bootstrap.Modal.getInstance(document.getElementById('submissionModal'));
                if (modal) modal.hide();
            } catch (error) {
                console.error('Error rejecting submission:', error);
                this.showToast('Error rejecting submission', 'error');
            }
        }
    }

    async downloadDocument(submissionId) {
        try {
            const submission = this.submissions.find(s => s.id === submissionId);
            if (submission) {
                // In a real app, this would trigger a download
                this.showToast(`Downloading "${submission.title}"...`, 'info');
                
                // Simulate download process
                setTimeout(() => {
                    this.showToast('Document downloaded successfully!', 'success');
                }, 1500);
            }
        } catch (error) {
            console.error('Error downloading document:', error);
            this.showToast('Error downloading document', 'error');
        }
    }

    deleteSubmission(submissionId) {
        if (confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
            // Remove from arrays
            this.submissions = this.submissions.filter(s => s.id !== submissionId);
            this.filteredSubmissions = this.filteredSubmissions.filter(s => s.id !== submissionId);
            this.renderSubmissions();
            this.updateStatistics();
            this.showToast('Submission deleted successfully!', 'success');
        }
    }

    showToast(message, type = 'info') {
        // Create toast if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }

        const toastHTML = `
            <div class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'} border-0" role="alert">
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
}

// Global functions
function clearFilters() {
    submissionsManager.clearFilters();
}

function changeView(view) {
    submissionsManager.changeView(view);
}

function exportSubmissions() {
    new bootstrap.Modal(document.getElementById('exportModal')).show();
}

function processExport() {
    const format = document.getElementById('exportFormat').value;
    const includeContent = document.getElementById('includeContent').checked;
    const includeMetadata = document.getElementById('includeMetadata').checked;
    const includeComments = document.getElementById('includeComments').checked;
    
    // Simulate export process
    submissionsManager.showToast(`Exporting to ${format.toUpperCase()}...`, 'info');
    
    setTimeout(() => {
        submissionsManager.showToast('Export completed successfully!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('exportModal')).hide();
    }, 2000);
}

/**
 * Approve submission
 */
function approveSubmission() {
    if (!confirm('Are you sure you want to approve this submission?')) {
        return;
    }
    
    submissionsManager.showToast('Submission approved successfully!', 'success');
    
    // Close modal if open
    const modal = bootstrap.Modal.getInstance(document.getElementById('submissionModal'));
    if (modal) {
        modal.hide();
    }
    
    // Refresh submissions list
    setTimeout(() => {
        if (submissionsManager) {
            submissionsManager.loadSubmissions();
        }
    }, 1000);
}

/**
 * Reject submission
 */
function rejectSubmission() {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) {
        return;
    }
    
    submissionsManager.showToast(`Submission rejected: ${reason}`, 'warning');
    
    // Close modal if open
    const modal = bootstrap.Modal.getInstance(document.getElementById('submissionModal'));
    if (modal) {
        modal.hide();
    }
    
    // Refresh submissions list
    setTimeout(() => {
        if (submissionsManager) {
            submissionsManager.loadSubmissions();
        }
    }, 1000);
}

/**
 * Download document
 */
function downloadDocument() {
    submissionsManager.showToast('Preparing document download...', 'info');
    
    // Simulate document generation and download
    setTimeout(() => {
        // Create mock download
        const blob = new Blob(['Mock document content'], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'submission_document.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        submissionsManager.showToast('Document downloaded successfully!', 'success');
    }, 1500);
}

// Initialize when page loads
let submissionsManager;
document.addEventListener('DOMContentLoaded', () => {
    submissionsManager = new SubmissionsManager();
});