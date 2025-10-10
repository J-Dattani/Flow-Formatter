class AuthorsManager {
    constructor() {
        this.authors = [];
        this.currentPage = 1;
        this.authorsPerPage = 12;
        this.filteredAuthors = [];
        
        this.init();
    }

    async init() {
        await this.loadAuthors();
        this.setupEventListeners();
        this.renderAuthors();
    }

    setupEventListeners() {
        // Search functionality
        document.getElementById('searchAuthors').addEventListener('input', (e) => {
            this.filterAuthors(e.target.value, document.getElementById('statusFilter').value);
        });

        // Status filter
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filterAuthors(document.getElementById('searchAuthors').value, e.target.value);
        });

        // Logout functionality
        document.getElementById('logoutBtn2').addEventListener('click', () => {
            AuthSystem.logout();
        });
    }

    async loadAuthors() {
        try {
            const response = await API.getAuthors();
            this.authors = response.data || response;
            this.filteredAuthors = [...this.authors];
        } catch (error) {
            console.error('Error loading authors:', error);
            this.showToast('Error loading authors', 'error');
        }
    }

    filterAuthors(searchTerm, statusFilter) {
        this.filteredAuthors = this.authors.filter(author => {
            const matchesSearch = !searchTerm || 
                author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                author.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                author.department.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesStatus = !statusFilter || author.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
        
        this.currentPage = 1;
        this.renderAuthors();
    }

    renderAuthors() {
        const container = document.getElementById('authorsGrid');
        const startIdx = (this.currentPage - 1) * this.authorsPerPage;
        const endIdx = startIdx + this.authorsPerPage;
        const authorsToShow = this.filteredAuthors.slice(startIdx, endIdx);

        if (authorsToShow.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-users fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No authors found</h5>
                    <p class="text-muted">Try adjusting your search criteria or add a new author.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = authorsToShow.map(author => this.renderAuthorCard(author)).join('');
        this.renderPagination();
    }

    renderAuthorCard(author) {
        const statusBadge = this.getStatusBadge(author.status);
        const roleIcon = this.getRoleIcon(author.role);
        
        return `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="card h-100 shadow-sm author-card" style="border-radius: 1rem; transition: all 0.3s ease;">
                    <div class="card-body">
                        <div class="d-flex align-items-start justify-content-between mb-3">
                            <div class="d-flex align-items-center">
                                <div class="avatar-lg me-3" style="width: 50px; height: 50px; background: linear-gradient(135deg, #6C63FF, #7B8CFF); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-user text-white"></i>
                                </div>
                                <div>
                                    <h6 class="mb-1 fw-bold">${author.name}</h6>
                                    <small class="text-muted">${author.email}</small>
                                </div>
                            </div>
                            ${statusBadge}
                        </div>
                        
                        <div class="mb-3">
                            <div class="d-flex align-items-center mb-2">
                                <i class="${roleIcon} me-2 text-primary"></i>
                                <span class="small fw-medium">${this.formatRole(author.role)}</span>
                            </div>
                            <div class="d-flex align-items-center">
                                <i class="fas fa-building me-2 text-muted"></i>
                                <span class="small text-muted">${author.department}</span>
                            </div>
                        </div>

                        <div class="mb-3">
                            <div class="row text-center">
                                <div class="col-4">
                                    <div class="small text-muted">Documents</div>
                                    <div class="fw-bold text-primary">${author.documents_count || 0}</div>
                                </div>
                                <div class="col-4">
                                    <div class="small text-muted">Pending</div>
                                    <div class="fw-bold text-warning">${author.pending_count || 0}</div>
                                </div>
                                <div class="col-4">
                                    <div class="small text-muted">Completed</div>
                                    <div class="fw-bold text-success">${author.completed_count || 0}</div>
                                </div>
                            </div>
                        </div>

                        ${author.bio ? `<p class="small text-muted mb-3">${author.bio.substring(0, 100)}${author.bio.length > 100 ? '...' : ''}</p>` : ''}
                        
                        <div class="d-flex gap-2">
                            <button class="btn btn-outline-primary btn-sm flex-fill" onclick="authorsManager.editAuthor('${author.id}')">
                                <i class="fas fa-edit me-1"></i>Edit
                            </button>
                            <button class="btn btn-outline-info btn-sm flex-fill" onclick="authorsManager.viewAuthorDetails('${author.id}')">
                                <i class="fas fa-eye me-1"></i>View
                            </button>
                            <div class="dropdown">
                                <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <ul class="dropdown-menu">
                                    <li><a class="dropdown-item" href="#" onclick="authorsManager.sendInvitation('${author.id}')">
                                        <i class="fas fa-envelope me-2"></i>Send Invitation
                                    </a></li>
                                    <li><a class="dropdown-item" href="#" onclick="authorsManager.resetPassword('${author.id}')">
                                        <i class="fas fa-key me-2"></i>Reset Password
                                    </a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger" href="#" onclick="authorsManager.deleteAuthor('${author.id}')">
                                        <i class="fas fa-trash me-2"></i>Delete
                                    </a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getStatusBadge(status) {
        const badges = {
            active: '<span class="badge bg-success">Active</span>',
            pending: '<span class="badge bg-warning">Pending</span>',
            blocked: '<span class="badge bg-danger">Blocked</span>'
        };
        return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
    }

    getRoleIcon(role) {
        const icons = {
            content_writer: 'fas fa-pen',
            editor: 'fas fa-edit',
            reviewer: 'fas fa-check-circle',
            contributor: 'fas fa-user-plus'
        };
        return icons[role] || 'fas fa-user';
    }

    formatRole(role) {
        return role.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredAuthors.length / this.authorsPerPage);
        const pagination = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="authorsManager.changePage(${this.currentPage - 1})">Previous</a>
            </li>
        `;
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHTML += `
                    <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="authorsManager.changePage(${i})">${i}</a>
                    </li>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }
        
        // Next button
        paginationHTML += `
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="authorsManager.changePage(${this.currentPage + 1})">Next</a>
            </li>
        `;
        
        pagination.innerHTML = paginationHTML;
    }

    changePage(page) {
        const totalPages = Math.ceil(this.filteredAuthors.length / this.authorsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderAuthors();
        }
    }

    editAuthor(authorId) {
        const author = this.authors.find(a => a.id === authorId);
        if (author) {
            // Populate edit form
            document.getElementById('editAuthorId').value = author.id;
            document.getElementById('editAuthorName').value = author.name;
            document.getElementById('editAuthorEmail').value = author.email;
            document.getElementById('editAuthorRole').value = author.role;
            document.getElementById('editAuthorDepartment').value = author.department;
            document.getElementById('editAuthorStatus').value = author.status;
            document.getElementById('editAuthorBio').value = author.bio || '';
            
            // Show modal
            new bootstrap.Modal(document.getElementById('editAuthorModal')).show();
        }
    }

    viewAuthorDetails(authorId) {
        const author = this.authors.find(a => a.id === authorId);
        if (author) {
            // Create detailed view modal
            const modalHTML = `
                <div class="modal fade" id="authorDetailsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Author Details</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-4 text-center">
                                        <div class="avatar-xl mb-3" style="width: 120px; height: 120px; background: linear-gradient(135deg, #6C63FF, #7B8CFF); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                                            <i class="fas fa-user text-white" style="font-size: 3rem;"></i>
                                        </div>
                                        <h5>${author.name}</h5>
                                        <p class="text-muted">${this.formatRole(author.role)}</p>
                                        ${this.getStatusBadge(author.status)}
                                    </div>
                                    <div class="col-md-8">
                                        <h6>Contact Information</h6>
                                        <p><strong>Email:</strong> ${author.email}</p>
                                        <p><strong>Department:</strong> ${author.department}</p>
                                        
                                        <h6 class="mt-4">Statistics</h6>
                                        <div class="row">
                                            <div class="col-4">
                                                <div class="text-center p-3 bg-light rounded">
                                                    <h4 class="text-primary">${author.documents_count || 0}</h4>
                                                    <small>Total Documents</small>
                                                </div>
                                            </div>
                                            <div class="col-4">
                                                <div class="text-center p-3 bg-light rounded">
                                                    <h4 class="text-warning">${author.pending_count || 0}</h4>
                                                    <small>Pending</small>
                                                </div>
                                            </div>
                                            <div class="col-4">
                                                <div class="text-center p-3 bg-light rounded">
                                                    <h4 class="text-success">${author.completed_count || 0}</h4>
                                                    <small>Completed</small>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        ${author.bio ? `
                                            <h6 class="mt-4">Biography</h6>
                                            <p>${author.bio}</p>
                                        ` : ''}
                                        
                                        <h6 class="mt-4">Account Information</h6>
                                        <p><strong>Status:</strong> ${this.formatRole(author.status)}</p>
                                        <p><strong>Joined:</strong> ${new Date(author.created_at).toLocaleDateString()}</p>
                                        <p><strong>Last Active:</strong> ${author.last_active ? new Date(author.last_active).toLocaleDateString() : 'Never'}</p>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" onclick="authorsManager.editAuthor('${author.id}')" data-bs-dismiss="modal">Edit Author</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal if any
            const existingModal = document.getElementById('authorDetailsModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // Add new modal
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            new bootstrap.Modal(document.getElementById('authorDetailsModal')).show();
        }
    }

    sendInvitation(authorId) {
        if (confirm('Send invitation email to this author?')) {
            this.showToast('Invitation sent successfully!', 'success');
        }
    }

    resetPassword(authorId) {
        if (confirm('Send password reset email to this author?')) {
            this.showToast('Password reset email sent!', 'success');
        }
    }

    deleteAuthor(authorId) {
        if (confirm('Are you sure you want to delete this author? This action cannot be undone.')) {
            // Remove from array
            this.authors = this.authors.filter(a => a.id !== authorId);
            this.filteredAuthors = this.filteredAuthors.filter(a => a.id !== authorId);
            this.renderAuthors();
            this.showToast('Author deleted successfully!', 'success');
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

// Global functions for adding and updating authors
async function addAuthor() {
    const form = document.getElementById('addAuthorForm');
    const formData = new FormData(form);
    
    const authorData = {
        name: document.getElementById('authorName').value,
        email: document.getElementById('authorEmail').value,
        role: document.getElementById('authorRole').value,
        department: document.getElementById('authorDepartment').value,
        bio: document.getElementById('authorBio').value,
        status: 'pending'
    };

    if (!authorData.name || !authorData.email || !authorData.role) {
        authorsManager.showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        const newAuthor = await API.createAuthor(authorData);
        authorsManager.authors.push(newAuthor);
        authorsManager.filteredAuthors = [...authorsManager.authors];
        authorsManager.renderAuthors();
        
        // Close modal and reset form
        bootstrap.Modal.getInstance(document.getElementById('addAuthorModal')).hide();
        form.reset();
        
        authorsManager.showToast('Author added successfully!', 'success');
    } catch (error) {
        console.error('Error adding author:', error);
        authorsManager.showToast('Error adding author', 'error');
    }
}

async function updateAuthor() {
    const authorId = document.getElementById('editAuthorId').value;
    const authorData = {
        name: document.getElementById('editAuthorName').value,
        email: document.getElementById('editAuthorEmail').value,
        role: document.getElementById('editAuthorRole').value,
        department: document.getElementById('editAuthorDepartment').value,
        status: document.getElementById('editAuthorStatus').value,
        bio: document.getElementById('editAuthorBio').value
    };

    if (!authorData.name || !authorData.email || !authorData.role) {
        authorsManager.showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        const updatedAuthor = await API.updateAuthor(authorId, authorData);
        
        // Update in arrays
        const index = authorsManager.authors.findIndex(a => a.id === authorId);
        if (index !== -1) {
            authorsManager.authors[index] = updatedAuthor;
        }
        
        const filteredIndex = authorsManager.filteredAuthors.findIndex(a => a.id === authorId);
        if (filteredIndex !== -1) {
            authorsManager.filteredAuthors[filteredIndex] = updatedAuthor;
        }
        
        authorsManager.renderAuthors();
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('editAuthorModal')).hide();
        
        authorsManager.showToast('Author updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating author:', error);
        authorsManager.showToast('Error updating author', 'error');
    }
}

// Initialize when page loads
let authorsManager;
document.addEventListener('DOMContentLoaded', () => {
    authorsManager = new AuthorsManager();
});