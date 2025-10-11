// Dashboard JavaScript - User Home Page Functionality

class Dashboard {
    constructor() {
        this.books = this.getMockBooks();
        this.filteredBooks = [...this.books];
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderBooks();
        this.initializeAnimations();
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

            // Logout button
            if (e.target.closest('.logout-btn')) {
                this.handleLogout();
            }
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

    getMockBooks() {
        return [
            {
                id: 1,
                title: "Advanced JavaScript Techniques",
                description: "A comprehensive guide to modern JavaScript patterns and best practices",
                status: "published",
                totalChapters: 12,
                completedChapters: 12,
                progress: 100,
                publishDate: "Jan 2024",
                contributors: [
                    { name: "Sarah Johnson", initials: "SJ" },
                    { name: "Mike Chen", initials: "MC" },
                    { name: "Lisa Wang", initials: "LW" },
                    { name: "David Brown", initials: "DB" },
                    { name: "Emma Davis", initials: "ED" }
                ],
                chapters: [
                    { id: 1, title: "Introduction to Modern JavaScript", status: "completed", author: "Sarah Johnson" },
                    { id: 2, title: "ES6+ Features", status: "completed", author: "Mike Chen" },
                    { id: 3, title: "Async Programming", status: "completed", author: "Lisa Wang" }
                ]
            },
            {
                id: 2,
                title: "React Best Practices",
                description: "Modern React development patterns and performance optimization",
                status: "draft",
                totalChapters: 15,
                completedChapters: 8,
                progress: 65,
                publishDate: "In Progress",
                contributors: [
                    { name: "Alex Rodriguez", initials: "AR" },
                    { name: "Emma Davis", initials: "ED" },
                    { name: "Tom Wilson", initials: "TW" }
                ],
                chapters: [
                    { id: 1, title: "React Fundamentals", status: "completed", author: "Alex Rodriguez" },
                    { id: 2, title: "Component Patterns", status: "completed", author: "Emma Davis" },
                    { id: 3, title: "State Management", status: "in-progress", author: "Tom Wilson" }
                ]
            },
            {
                id: 3,
                title: "Python Data Science Handbook",
                description: "Comprehensive guide to data analysis and machine learning with Python",
                status: "collaboration",
                totalChapters: 20,
                completedChapters: 5,
                progress: 25,
                publishDate: "2 weeks left",
                contributors: [
                    { name: "Data Scientist", initials: "DS" },
                    { name: "ML Engineer", initials: "ML" },
                    { name: "Research Lead", initials: "RL" },
                    { name: "Analytics Expert", initials: "AE" },
                    { name: "Python Developer", initials: "PD" },
                    { name: "Statistics Pro", initials: "SP" },
                    { name: "AI Researcher", initials: "AI" },
                    { name: "Data Engineer", initials: "DE" }
                ],
                chapters: [
                    { id: 1, title: "Introduction to Data Science", status: "completed", author: "Data Scientist" },
                    { id: 2, title: "NumPy Fundamentals", status: "completed", author: "Python Developer" },
                    { id: 3, title: "Pandas for Data Analysis", status: "in-progress", author: "Analytics Expert" }
                ]
            }
        ];
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
            booksGrid.insertBefore(bookCard, addBookCard);
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
                    <button class="btn-primary" onclick="dashboard.viewBookDetails(${book.id})">
                        <i class="fas fa-eye"></i>
                        View Book
                    </button>
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