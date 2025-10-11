// Dashboard JavaScript - User Home Page Functionality

class Dashboard {
    constructor() {
        this.books = [];
        this.filteredBooks = [];
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadData();
        this.initializeAnimations();
    }

    // Utility: detect if a string is an email
    isEmail(str) {
        if (!str || typeof str !== 'string') return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
    }

    // Utility: mask an email address for display
    // Keeps first and last character of local-part when length > 2; masks the middle with *
    // Example: "jaimindattani343@gmail.com" -> "j*************3@gmail.com"
    //          "343@gmail.com" -> "3*3@gmail.com"
    maskEmail(email) {
        if (!this.isEmail(email)) return email;
        const [local, domain] = email.split('@');
        if (!domain) return email;
        if (!local || local.length <= 2) return `***@${domain}`;
        const first = local[0];
        const last = local[local.length - 1];
        const maskedMiddle = '*'.repeat(Math.max(local.length - 2, 1));
        return `${first}${maskedMiddle}${last}@${domain}`;
    }

    // Build a URL-safe base64 string
    toBase64Url(str) {
        try {
            const b64 = btoa(unescape(encodeURIComponent(str)));
            return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        } catch (_) {
            // Fallback if Unicode handling fails
            const b64 = btoa(str);
            return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        }
    }

    // Build the form fill URL for a given template object
    buildFormUrl(tpl) {
        if (!tpl) return '/form.html';
        const id = tpl.id || 'preview';
        const name = tpl.name || 'Template';
        const embedded = {
            id,
            name,
            description: tpl.description || '',
            metadata: {
                editor: {
                    content: (tpl?.metadata?.editor?.content) || tpl?.metadata?.content || tpl?.content || []
                },
                files: Array.isArray(tpl?.metadata?.files) ? tpl.metadata.files : []
            },
            status: tpl.metadata?.status || tpl.status || 'draft',
            published_at: tpl.published_at || tpl.metadata?.published_at || null
        };
        const tplParam = this.toBase64Url(JSON.stringify(embedded));
        return `/form.html?template=${encodeURIComponent(String(id))}&name=${encodeURIComponent(String(name))}&tpl=${tplParam}`;
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

        // General click events
        document.addEventListener('click', (e) => {
            // Add new book
            if (e.target.closest('.book-card-add') || e.target.closest('.btn-add')) {
                this.handleNewBook();
            }

            // Modal close
            if (e.target.closest('.modal-close') || e.target.classList.contains('modal-overlay')) {
                this.closeModal();
            }

            // Menu buttons
            if (e.target.closest('.menu-btn')) {
                e.stopPropagation();
                this.toggleMenu(e.target.closest('.menu-btn'));
            }

            // Notification button
            if (e.target.closest('.notification-btn')) {
                this.showNotifications();
            }

            // Logout button handled by shared auth.js; no-op here
        });

        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.book-menu')) {
                this.closeAllMenus();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeAllMenus();
            }
        });

        // Keyboard navigation for menu items
        document.addEventListener('keydown', (e) => {
            const openMenu = document.querySelector('.menu-dropdown.show');
            if (!openMenu) return;

            const menuItems = Array.from(openMenu.querySelectorAll('.menu-item:not([disabled])'));
            const currentIndex = menuItems.findIndex(item => item === document.activeElement);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % menuItems.length;
                menuItems[nextIndex].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = currentIndex <= 0 ? menuItems.length - 1 : currentIndex - 1;
                menuItems[prevIndex].focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                menuItems[0].focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                menuItems[menuItems.length - 1].focus();
            }
        });
    }

    async loadData() {
        try {
            // Load templates as books (backend-first via TemplateAPI)
            const tplRes = await TemplateAPI.getAll();
            const templates = Array.isArray(tplRes?.data) ? tplRes.data : [];

            // Map templates to dashboard "book" cards
            this.books = templates.map(t => this.templateToBook(t));
            this.filteredBooks = [...this.books];
            this.renderBooks();

            // Update welcome name (mask emails)
            const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : (window.currentUser || null);
            if (user) {
                const el = document.querySelector('.welcome-title .user-name');
                if (el) {
                    const raw = user.name || user.email || 'User';
                    el.textContent = this.isEmail(raw) ? this.maskEmail(raw) : (user.name || (user.email ? this.maskEmail(user.email) : 'User'));
                }
            }

            // Update quick stats from backend dashboard API (fallback handled inside DashboardAPI)
            if (typeof DashboardAPI !== 'undefined' && DashboardAPI.getStats) {
                const statsRes = await DashboardAPI.getStats();
                this.updateQuickStats(statsRes?.data || {});
            } else {
                this.updateQuickStats({ templates: this.books.length, authors: 0, pendingSubmissions: 0, generatedDocuments: 0 });
            }
        } catch (e) {
            console.error('Dashboard load error:', e);
            this.renderBooks();
        }
    }

    templateToBook(tpl) {
        const name = tpl.name || 'Untitled Template';
        const desc = (tpl.metadata && tpl.metadata.description) || tpl.description || '';
        const status = (tpl.metadata && tpl.metadata.status) || 'draft';
        const updated = tpl.updated_at ? new Date(tpl.updated_at).toLocaleDateString() : '';
        // Derive simple progress from metadata if present
        const editor = tpl.metadata?.editor || {};
        const chapters = Array.isArray(tpl.chapters) ? tpl.chapters : [];
        const totalChapters = chapters.length || (editor.totalChapters || 0);
        const completedChapters = editor.completedChapters || 0;
        const progress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : (status === 'published' ? 100 : 0);
        // Contributors unavailable here; keep minimal initials from name
        const contributors = (tpl.contributors && Array.isArray(tpl.contributors)) ? tpl.contributors : [];
        const shapedContribs = contributors.map(c => {
            const rawName = c.name || c.email || 'Contributor';
            const displayName = this.isEmail(rawName) ? this.maskEmail(rawName) : rawName;
            const initialsSource = (c.name || c.email || '?');
            return { name: displayName, initials: initialsSource.slice(0,2).toUpperCase() };
        });
        const formUrl = this.buildFormUrl(tpl);
        return {
            id: tpl.id,
            title: name,
            description: desc,
            status: String(status).toLowerCase(),
            totalChapters: totalChapters || 1,
            completedChapters: Math.min(completedChapters, totalChapters || 1),
            progress,
            publishDate: updated,
            contributors: shapedContribs,
            formUrl,
            chapters: chapters.map((ch, idx) => ({ id: ch.id || idx+1, title: ch.title || `Chapter ${idx+1}`, status: ch.status || 'completed', author: ch.author || '—' }))
        };
    }

    updateQuickStats(stats) {
        // There are 4 stat cards with numbers; update their .stat-number
        const cards = document.querySelectorAll('.quick-stats .stat-card .stat-number');
        if (!cards || cards.length < 4) return;
        // Map: Active Books -> templates length; Published -> estimated published; Contributors -> authors; Pending -> pending submissions
        const activeBooks = this.books.length;
        const published = this.books.filter(b => b.status === 'published').length;
        const contributors = Number(stats.authors || 0);
        const pending = Number(stats.pendingSubmissions || 0);
        const values = [activeBooks, published, contributors, pending];
        values.forEach((v, i) => { if (cards[i]) cards[i].textContent = String(v); });
    }

    handleSearch(query) {
        const lowercaseQuery = query.toLowerCase();
        this.filteredBooks = this.books.filter(book => 
            book.title.toLowerCase().includes(lowercaseQuery) ||
            book.description.toLowerCase().includes(lowercaseQuery) ||
            book.contributors.some(contributor => 
                contributor.name.toLowerCase().includes(lowercaseQuery)
            )
        );

        // Apply current filter as well
        if (this.currentFilter !== 'all') {
            this.filteredBooks = this.filteredBooks.filter(book => book.status === this.currentFilter);
        }

        this.renderBooks();
    }

    handleFilter(filter) {
        this.currentFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

        // Filter books
        if (filter === 'all') {
            this.filteredBooks = [...this.books];
        } else {
            this.filteredBooks = this.books.filter(book => book.status === filter);
        }

        // Apply search if active
        const searchQuery = document.querySelector('.search-input').value;
        if (searchQuery) {
            this.handleSearch(searchQuery);
        } else {
            this.renderBooks();
        }

        this.showToast('success', 'Filter Applied', `Showing ${this.filteredBooks.length} books`);
    }

    renderBooks() {
        const booksGrid = document.querySelector('.books-grid');
        const addBookCard = booksGrid.querySelector('.book-card-add');
        
        // Clear existing book cards (keep add card)
        const existingCards = booksGrid.querySelectorAll('.book-card');
        existingCards.forEach(card => card.remove());

        // Render filtered books
        this.filteredBooks.forEach(book => {
            const bookCard = this.createBookCard(book);
            if (addBookCard) {
                booksGrid.insertBefore(bookCard, addBookCard);
            } else {
                booksGrid.appendChild(bookCard);
            }
        });

        // Animate cards
        this.animateCards();
    }

    createBookCard(book) {
        const statusConfig = {
            published: { icon: 'fas fa-check-circle', label: 'Published' },
            draft: { icon: 'fas fa-edit', label: 'Draft' },
            collaboration: { icon: 'fas fa-users', label: 'Collaboration' }
        };

        const config = statusConfig[book.status];
        const visibleContributors = book.contributors.slice(0, 3);
        const remainingCount = book.contributors.length - 3;

        const contributorsHTML = visibleContributors.map(contributor => 
            `<div class="contributor-avatar" title="${contributor.name}">${contributor.initials}</div>`
        ).join('');

        const remainingHTML = remainingCount > 0 ? 
            `<div class="contributor-avatar more">+${remainingCount}</div>` : '';

        const actionButtons = this.getActionButtons(book);

        const bookCard = document.createElement('div');
        bookCard.className = `book-card ${book.status}`;
        bookCard.dataset.bookId = book.id;
        bookCard.innerHTML = `
            <div class="book-header">
                <div class="book-status">
                    <span class="status-badge ${book.status}">
                        <i class="${config.icon}"></i>
                        ${config.label}
                    </span>
                </div>
                <div class="book-menu">
                    <button class="menu-btn" aria-label="More options">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="menu-dropdown">
                        <button class="menu-item" onclick="dashboard.viewBookDetails(${book.id}); event.preventDefault();">
                            <i class="fas fa-eye"></i>
                            <span>View Details</span>
                        </button>
                        <button class="menu-item" onclick="dashboard.handleEdit(${book.id}); event.preventDefault();">
                            <i class="fas fa-edit"></i>
                            <span>Edit Book</span>
                        </button>
                        <button class="menu-item" onclick="dashboard.handleShare(${book.id}); event.preventDefault();">
                            <i class="fas fa-share-alt"></i>
                            <span>Share</span>
                        </button>
                        <button class="menu-item" onclick="dashboard.handleDownload(${book.id}); event.preventDefault();">
                            <i class="fas fa-download"></i>
                            <span>Download</span>
                        </button>
                        <div class="menu-separator"></div>
                        <button class="menu-item" onclick="dashboard.handleDuplicate(${book.id}); event.preventDefault();">
                            <i class="fas fa-copy"></i>
                            <span>Duplicate</span>
                        </button>
                        <button class="menu-item" onclick="dashboard.handleArchive(${book.id}); event.preventDefault();">
                            <i class="fas fa-archive"></i>
                            <span>Archive</span>
                        </button>
                        <div class="menu-separator"></div>
                        <button class="menu-item danger" onclick="dashboard.handleDelete(${book.id}); event.preventDefault();">
                            <i class="fas fa-trash-alt"></i>
                            <span>Delete</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="book-cover">
                <div class="book-thumbnail">
                    <i class="${this.getBookIcon(book.status)}"></i>
                </div>
            </div>
            
            <div class="book-content">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-description">${book.description}</p>
                
                <div class="book-meta">
                    <div class="meta-item">
                        <i class="fas fa-file-alt"></i>
                        <span>${book.completedChapters}/${book.totalChapters} Chapters</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-users"></i>
                        <span>${book.contributors.length} Authors</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>${book.publishDate}</span>
                    </div>
                </div>
                
                <div class="book-progress">
                    <div class="progress-info">
                        <span class="progress-label">Completion</span>
                        <span class="progress-value">${book.progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${book.progress}%"></div>
                    </div>
                </div>
                
                <div class="book-contributors">
                    <div class="contributors-label">Contributors:</div>
                    <div class="contributors-list">
                        ${contributorsHTML}
                        ${remainingHTML}
                    </div>
                </div>
            </div>
            
            <div class="book-actions">
                ${actionButtons}
            </div>
        `;

        return bookCard;
    }

    getBookIcon(status) {
        const icons = {
            published: 'fas fa-book-open',
            draft: 'fas fa-file-alt',
            collaboration: 'fas fa-users'
        };
        return icons[status] || 'fas fa-book';
    }

    getActionButtons(book) {
        switch (book.status) {
            case 'published':
                return `
                    <a class="btn-primary" href="${book.formUrl}">
                        <i class="fas fa-pen"></i>
                        Fill
                    </a>
                    <button class="btn-secondary" onclick="dashboard.handleShare(${book.id})">
                        <i class="fas fa-share"></i>
                        Share
                    </button>
                `;
            case 'draft':
                return `
                    <button class="btn-primary" onclick="dashboard.handleEdit(${book.id})">
                        <i class="fas fa-edit"></i>
                        Continue Editing
                    </button>
                    <button class="btn-secondary" onclick="dashboard.handleSubmit(${book.id})">
                        <i class="fas fa-paper-plane"></i>
                        Submit
                    </button>
                `;
            case 'collaboration':
                return `
                    <button class="btn-primary" onclick="dashboard.handleJoinCollaboration(${book.id})">
                        <i class="fas fa-users"></i>
                        Join Collaboration
                    </button>
                    <button class="btn-secondary" onclick="dashboard.handleDiscuss(${book.id})">
                        <i class="fas fa-comments"></i>
                        Discuss
                    </button>
                `;
            default:
                return '';
        }
    }

    viewBookDetails(bookId) {
        const book = this.books.find(b => b.id == bookId);
        if (!book) return;

        this.showBookModal(book);
    }

    showBookModal(book) {
        const modal = document.getElementById('bookModal');
        
        // Update modal content
        document.getElementById('modalBookTitle').textContent = book.title;
        document.getElementById('modalBookStatus').textContent = book.status;
        document.getElementById('modalBookStatus').className = `status-badge ${book.status}`;
        document.getElementById('modalTotalChapters').textContent = book.totalChapters;
        document.getElementById('modalCompletedChapters').textContent = book.completedChapters;

        // Update publishers list
        const publishersList = document.getElementById('modalPublishers');
        publishersList.innerHTML = book.contributors.map(contributor => `
            <div class="contributor-item">
                <div class="contributor-avatar">${contributor.initials}</div>
                <span class="contributor-name">${contributor.name}</span>
            </div>
        `).join('');

        // Update chapters list
        const chaptersList = document.getElementById('modalChapters');
        chaptersList.innerHTML = book.chapters.map(chapter => `
            <div class="chapter-item">
                <div class="chapter-info">
                    <h4>${chapter.title}</h4>
                    <p>Author: ${chapter.author}</p>
                </div>
                <span class="status-badge ${chapter.status}">${chapter.status}</span>
            </div>
        `).join('');

        modal.classList.add('show');
    }

    closeModal() {
        const modal = document.getElementById('bookModal');
        modal.classList.remove('show');
    }

    toggleMenu(menuBtn) {
        const dropdown = menuBtn.nextElementSibling;
        const isOpen = dropdown.classList.contains('show');
        
        // Close all menus first
        this.closeAllMenus();
        
        if (!isOpen) {
            // Create backdrop if it doesn't exist
            let backdrop = document.querySelector('.menu-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.className = 'menu-backdrop';
                backdrop.addEventListener('click', () => this.closeAllMenus());
                document.body.appendChild(backdrop);
            }
            
            backdrop.classList.add('show');
            dropdown.classList.add('show');
            
            // Position dropdown to prevent overflow
            this.positionDropdown(dropdown);
            
            // Focus first menu item for keyboard navigation
            setTimeout(() => {
                const firstItem = dropdown.querySelector('.menu-item:not([disabled])');
                if (firstItem) {
                    firstItem.focus();
                }
            }, 100);
        }
    }

    positionDropdown(dropdown) {
        const rect = dropdown.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Check if dropdown goes off the right edge
        if (rect.right > viewportWidth) {
            dropdown.style.left = 'auto';
            dropdown.style.right = '0';
        }

        // Check if dropdown goes off the bottom
        if (rect.bottom > viewportHeight) {
            dropdown.style.top = 'auto';
            dropdown.style.bottom = 'calc(100% + 8px)';
        }
    }

    closeAllMenus() {
        document.querySelectorAll('.menu-dropdown').forEach(menu => {
            menu.classList.remove('show');
        });
        
        // Remove backdrop
        const backdrop = document.querySelector('.menu-backdrop');
        if (backdrop) {
            backdrop.classList.remove('show');
        }
    }

    handleNewBook() {
        this.showToast('info', 'Feature Coming Soon', 'Book creation feature will be available soon');
    }

    showNotifications() {
        const notifications = [
            { type: 'info', title: 'New Collaboration', message: 'You have been invited to "Python Data Science"' },
            { type: 'success', title: 'Chapter Approved', message: 'Your chapter "ES6+ Features" has been approved' },
            { type: 'warning', title: 'Deadline Reminder', message: 'React Best Practices deadline in 3 days' }
        ];

        notifications.forEach((notif, index) => {
            setTimeout(() => {
                this.showToast(notif.type, notif.title, notif.message);
            }, index * 1000);
        });
    }

    // handleLogout removed; shared auth.js handles consistent logout

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
        const cards = document.querySelectorAll('.book-card');
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

    // Menu action handlers
    handleEdit(bookId) {
        this.closeAllMenus();
        const book = this.books.find(b => b.id == bookId);
        this.showToast('info', 'Edit Book', `Opening editor for "${book.title}"`);
    }

    handleShare(bookId) {
        this.closeAllMenus();
        const book = this.books.find(b => b.id == bookId);
        
        // Simulate copying share link to clipboard
        const shareLink = `https://formatflow.com/books/${bookId}`;
        
        // Create temporary input to copy to clipboard
        const tempInput = document.createElement('input');
        tempInput.value = shareLink;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        
        this.showToast('success', 'Link Copied', `Share link for "${book.title}" copied to clipboard`);
    }

    handleDownload(bookId) {
        this.closeAllMenus();
        const book = this.books.find(b => b.id == bookId);
        this.showToast('info', 'Download Started', `Downloading "${book.title}"`);
        
        // Simulate download progress
        setTimeout(() => {
            this.showToast('success', 'Download Complete', `"${book.title}" has been downloaded`);
        }, 2000);
    }

    handleDuplicate(bookId) {
        this.closeAllMenus();
        const book = this.books.find(b => b.id == bookId);
        this.showToast('success', 'Book Duplicated', `Created a copy of "${book.title}"`);
    }

    handleArchive(bookId) {
        this.closeAllMenus();
        const book = this.books.find(b => b.id == bookId);
        this.showToast('info', 'Book Archived', `"${book.title}" moved to archive`);
    }

    handleDelete(bookId) {
        this.closeAllMenus();
        const book = this.books.find(b => b.id == bookId);
        
        // Show confirmation
        if (confirm(`Are you sure you want to delete "${book.title}"? This action cannot be undone.`)) {
            // Remove from books array
            const index = this.books.findIndex(b => b.id == bookId);
            if (index > -1) {
                this.books.splice(index, 1);
                this.filteredBooks = this.filteredBooks.filter(b => b.id != bookId);
                this.renderBooks();
                this.showToast('success', 'Book Deleted', `"${book.title}" has been deleted`);
            }
        }
    }

    handleSubmit(bookId) {
        const book = this.books.find(b => b.id == bookId);
        if (book) {
            this.showToast('info', 'Submitting Book', `"${book.title}" is being submitted for review`);
            // Simulate submission process
            setTimeout(() => {
                this.showToast('success', 'Book Submitted', `"${book.title}" has been submitted successfully`);
            }, 1500);
        }
    }

    handleJoinCollaboration(bookId) {
        const book = this.books.find(b => b.id == bookId);
        if (book) {
            this.showToast('success', 'Joined Collaboration', `You are now collaborating on "${book.title}"`);
        }
    }

    handleDiscuss(bookId) {
        const book = this.books.find(b => b.id == bookId);
        if (book) {
            this.showToast('info', 'Opening Discussion', `Loading discussion for "${book.title}"`);
            // Here you would typically open a discussion panel or redirect
        }
    }

    initializeAnimations() {
        // Animate welcome section
        const welcomeSection = document.querySelector('.welcome-section');
        if (welcomeSection) {
            welcomeSection.style.opacity = '0';
            welcomeSection.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                welcomeSection.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                welcomeSection.style.opacity = '1';
                welcomeSection.style.transform = 'translateY(0)';
            }, 200);
        }

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

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});

// Utility functions for global access
function viewBookDetails(bookId) {
    window.dashboard.viewBookDetails(bookId);
}