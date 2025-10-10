/**
 * Admin Layout Management System
 * Handles common admin page functionality including sidebar loading and navigation
 */

class AdminLayout {
    constructor() {
        this.currentPage = window.location.pathname.split('/').pop();
        this.init();
    }

    /**
     * Initialize the admin layout
     */
    init() {
        this.loadSidebar();
        this.initializeEventListeners();
    }

    /**
     * Load and inject the sidebar component
     */
    loadSidebar() {
        fetch('../components/sidebar-nav.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(html => {
                const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
                if (sidebarPlaceholder) {
                    sidebarPlaceholder.innerHTML = html;
                    this.setActiveNavigation();
                    this.initializeSidebarEvents();
                }
            })
            .catch(error => {
                console.error('Error loading sidebar:', error);
                // Fallback: show basic navigation
                this.showFallbackNavigation();
            });
    }

    /**
     * Set the active navigation item based on current page
     */
    setActiveNavigation() {
        const navLinks = document.querySelectorAll('.sidebar .nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href && href === this.currentPage) {
                link.classList.add('active');
                this.highlightCurrentPageVisually(link);
            }
        });

        // Special cases for navigation highlighting
        this.handleSpecialNavigationCases();
    }

    /**
     * Handle special navigation cases for specific pages
     */
    handleSpecialNavigationCases() {
        // Special case for dashboard if we're on index.html or no specific page
        if (this.currentPage === '' || this.currentPage === 'index.html') {
            const dashboardLink = document.querySelector('.sidebar .nav-link[href="dashboard.html"]');
            if (dashboardLink) {
                dashboardLink.classList.add('active');
                this.highlightCurrentPageVisually(dashboardLink);
            }
        }

        // Special case for template-editor-advanced.html
        if (this.currentPage === 'template-editor-advanced.html') {
            const editorLink = document.querySelector('.sidebar .nav-link[href="template-editor-advanced.html"]');
            if (editorLink) {
                editorLink.classList.add('active');
                this.highlightCurrentPageVisually(editorLink);
            }
        }
    }

    /**
     * Add visual highlighting to current page navigation item
     */
    highlightCurrentPageVisually(navItem) {
        if (navItem) {
            navItem.style.backgroundColor = 'var(--primary-color, #6C63FF)';
            navItem.style.color = 'white';
            navItem.style.borderRadius = '8px';
            navItem.style.fontWeight = '600';
        }
    }

    /**
     * Initialize sidebar-specific event listeners
     */
    initializeSidebarEvents() {
        // Logout functionality - handle multiple logout button patterns
        this.initializeLogoutButtons();

        // Sidebar toggle for mobile
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }
    }

    /**
     * Initialize all logout button functionality
     */
    initializeLogoutButtons() {
        // Handle different logout button patterns
        const logoutSelectors = [
            '#logoutBtn',
            '#headerLogoutBtn', 
            '[onclick*="logout"]',
            '.logout-btn'
        ];

        logoutSelectors.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(btn => {
                // Remove existing listeners to prevent duplicates
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleLogout();
                });
            });
        });
    }

    /**
     * Initialize common event listeners for admin pages
     */
    initializeEventListeners() {
        // Handle responsive navigation
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    /**
     * Handle logout functionality with enhanced fallback
     */
    handleLogout() {
        // Show confirmation dialog
        if (!confirm('Are you sure you want to logout?')) {
            return;
        }

        try {
            if (typeof AuthSystem !== 'undefined' && AuthSystem.logout) {
                AuthSystem.logout();
            } else {
                // Enhanced fallback logout
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('currentUser');
                localStorage.removeItem('adminSession');
                sessionStorage.clear();
                
                // Show logout message
                this.showNotification('Logged out successfully', 'success');
                
                // Redirect after short delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Force logout even if there's an error
            window.location.href = 'index.html';
        }
    }

    /**
     * Toggle sidebar visibility for mobile
     */
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('show');
        }
    }

    /**
     * Handle responsive behavior
     */
    handleResize() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && window.innerWidth > 991) {
            sidebar.classList.remove('show');
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + / for search
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            const searchInput = document.querySelector('input[type="search"]');
            if (searchInput) {
                searchInput.focus();
            }
        }

        // Escape to close modals/dropdowns
        if (e.key === 'Escape') {
            const openDropdowns = document.querySelectorAll('.dropdown-menu.show');
            openDropdowns.forEach(dropdown => {
                const toggle = dropdown.previousElementSibling;
                if (toggle && toggle.click) {
                    toggle.click();
                }
            });
        }
    }

    /**
     * Show fallback navigation if sidebar loading fails
     */
    showFallbackNavigation() {
        const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
        if (sidebarPlaceholder) {
            sidebarPlaceholder.innerHTML = `
                <div class="sidebar">
                    <div class="sidebar-header">
                        <h5>Admin Panel</h5>
                    </div>
                    <nav class="sidebar-nav">
                        <ul class="nav flex-column">
                            <li class="nav-item">
                                <a class="nav-link" href="dashboard.html">Dashboard</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="templates.html">Templates</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="projects.html">Projects</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="authors.html">Authors</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="submissions.html">Submissions</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="settings.html">Settings</a>
                            </li>
                        </ul>
                    </nav>
                </div>
            `;
            this.setActiveNavigation();
        }
    }

    /**
     * Utility method to show notifications
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    /**
     * Utility method to confirm actions
     */
    confirmAction(message, callback) {
        if (confirm(message)) {
            callback();
        }
    }
}

// Auto-initialize admin layout when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminLayout = new AdminLayout();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminLayout;
}