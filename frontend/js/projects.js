/**
 * Projects Management JavaScript - Smart Document Merger
 * Handles project creation, tracking, and document merging
 */

// Project state
let projectData = {
    projects: [],
    currentProject: null
};

// Initialize projects page
document.addEventListener('DOMContentLoaded', function() {
    initializeProjectsPage();
    loadProjects();
    setupEventListeners();
});

/**
 * Initialize projects page
 */
function initializeProjectsPage() {
    console.log('Initializing Projects Management...');
    
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    
    // Set active navigation
    setActiveNavigation('projects');
}

/**
 * Load all projects from API
 */
async function loadProjects() {
    try {
        // Mock data for prototype
        const mockProjects = [
            {
                id: 1,
                name: "Q3 Financial Report",
                description: "Annual report compilation",
                template: "Annual Report 2024",
                authors: [
                    { initials: "JS", name: "John Smith" },
                    { initials: "AD", name: "Alice Davis" },
                    { initials: "MJ", name: "Mike Johnson" }
                ],
                progress: 85,
                status: "review",
                dueDate: "2024-10-15",
                createdAt: "2024-09-01"
            },
            {
                id: 2,
                name: "AI Research Paper",
                description: "Machine learning study",
                template: "Research Paper Template",
                authors: [
                    { initials: "MJ", name: "Mike Johnson" },
                    { initials: "SK", name: "Sarah Kim" }
                ],
                progress: 45,
                status: "active",
                dueDate: "2024-11-30",
                createdAt: "2024-09-15"
            },
            {
                id: 3,
                name: "Company Handbook",
                description: "Employee manual update",
                template: "Document Template",
                authors: [
                    { initials: "HR", name: "HR Team" },
                    { initials: "LG", name: "Legal Group" }
                ],
                progress: 100,
                status: "completed",
                dueDate: "2024-09-20",
                createdAt: "2024-08-01"
            }
        ];
        
        projectData.projects = mockProjects;
        updateProjectStats(mockProjects);
        renderProjectsTable(mockProjects);
        
    } catch (error) {
        console.error('Error loading projects:', error);
        showErrorMessage('Failed to load projects');
    }
}

/**
 * Update project statistics
 */
function updateProjectStats(projects) {
    const stats = {
        active: projects.filter(p => p.status === 'active').length,
        completed: projects.filter(p => p.status === 'completed').length,
        review: projects.filter(p => p.status === 'review').length,
        dueThisWeek: projects.filter(p => isDueThisWeek(p.dueDate)).length
    };
    
    // Update stat cards
    const statCards = document.querySelectorAll('.stats-card h3');
    if (statCards.length >= 4) {
        statCards[0].textContent = projects.length; // Active projects (using total for demo)
        statCards[1].textContent = stats.completed;
        statCards[2].textContent = stats.review;
        statCards[3].textContent = stats.dueThisWeek;
    }
}

/**
 * Render projects table
 */
function renderProjectsTable(projects) {
    const tableBody = document.querySelector('.table tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    projects.forEach(project => {
        const row = createProjectRow(project);
        tableBody.appendChild(row);
    });
}

/**
 * Create project table row
 */
function createProjectRow(project) {
    const row = document.createElement('tr');
    
    const statusBadge = getProjectStatusBadge(project.status);
    const progressColor = getProgressColor(project.progress);
    const authorsHtml = createAuthorsHtml(project.authors);
    const projectIcon = getProjectIcon(project.template);
    
    row.innerHTML = `
        <td>
            <div class="d-flex align-items-center">
                <div class="project-icon me-3">
                    <i class="${projectIcon}"></i>
                </div>
                <div>
                    <h6 class="mb-0 fw-semibold">${project.name}</h6>
                    <small class="text-muted">${project.description}</small>
                </div>
            </div>
        </td>
        <td>${project.template}</td>
        <td>
            <div class="d-flex">
                ${authorsHtml}
            </div>
        </td>
        <td>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar ${progressColor}" style="width: ${project.progress}%"></div>
            </div>
            <small class="text-muted">${project.progress}% ${project.progress === 100 ? 'Complete' : 'Complete'}</small>
        </td>
        <td>${statusBadge}</td>
        <td>${formatDate(project.dueDate)}</td>
        <td>
            <button class="btn btn-sm btn-outline-primary" onclick="viewProject(${project.id})">
                <i class="fas fa-eye"></i>
            </button>
            ${project.progress === 100 ? 
                `<button class="btn btn-sm btn-outline-info" onclick="downloadProject(${project.id})">
                    <i class="fas fa-download"></i>
                </button>` :
                project.status === 'review' ?
                `<button class="btn btn-sm btn-outline-success" onclick="mergeProject(${project.id})">
                    <i class="fas fa-compress-arrows-alt"></i>
                </button>` :
                `<button class="btn btn-sm btn-outline-secondary" disabled>
                    <i class="fas fa-compress-arrows-alt"></i>
                </button>`
            }
        </td>
    `;
    
    return row;
}

/**
 * Create authors HTML
 */
function createAuthorsHtml(authors) {
    const maxVisible = 2;
    let html = '';
    
    for (let i = 0; i < Math.min(authors.length, maxVisible); i++) {
        html += `<div class="avatar-circle me-1" style="width: 28px; height: 28px; font-size: 12px;" title="${authors[i].name}">${authors[i].initials}</div>`;
    }
    
    if (authors.length > maxVisible) {
        const remaining = authors.length - maxVisible;
        html += `<div class="avatar-circle me-1" style="width: 28px; height: 28px; font-size: 12px;" title="And ${remaining} more">+${remaining}</div>`;
    }
    
    return html;
}

/**
 * Get project status badge
 */
function getProjectStatusBadge(status) {
    const badges = {
        'active': '<span class="badge bg-primary">Active</span>',
        'review': '<span class="badge bg-warning">In Review</span>',
        'completed': '<span class="badge bg-success">Completed</span>',
        'archived': '<span class="badge bg-secondary">Archived</span>'
    };
    
    return badges[status] || badges['active'];
}

/**
 * Get progress bar color
 */
function getProgressColor(progress) {
    if (progress === 100) return 'bg-success';
    if (progress >= 75) return 'bg-success';
    if (progress >= 50) return 'bg-warning';
    return 'bg-primary';
}

/**
 * Get project icon based on template
 */
function getProjectIcon(template) {
    if (template.toLowerCase().includes('report')) return 'fas fa-chart-line';
    if (template.toLowerCase().includes('research')) return 'fas fa-microscope';
    if (template.toLowerCase().includes('handbook')) return 'fas fa-building';
    return 'fas fa-file-alt';
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Project search
    const searchInput = document.getElementById('projectSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleProjectSearch);
    }
    
    // Filter dropdown
    const filterItems = document.querySelectorAll('[data-filter]');
    filterItems.forEach(item => {
        item.addEventListener('click', handleFilterClick);
    });
}

/**
 * Handle project search
 */
function handleProjectSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const filteredProjects = projectData.projects.filter(project => 
        project.name.toLowerCase().includes(searchTerm) ||
        project.description.toLowerCase().includes(searchTerm) ||
        project.template.toLowerCase().includes(searchTerm)
    );
    renderProjectsTable(filteredProjects);
}

/**
 * Handle filter click
 */
function handleFilterClick(event) {
    event.preventDefault();
    
    const filter = event.target.dataset.filter;
    let filteredProjects = projectData.projects;
    
    if (filter !== 'all') {
        filteredProjects = projectData.projects.filter(project => 
            project.status === filter
        );
    }
    
    renderProjectsTable(filteredProjects);
}

/**
 * Project action functions
 */
function createNewProject() {
    // This would open a modal or redirect to project creation page
    console.log('Creating new project...');
    showSuccessMessage('New project creation feature will be implemented');
}

function viewProject(projectId) {
    const project = projectData.projects.find(p => p.id === projectId);
    console.log('Viewing project:', project);
    
    // This would show project details with submission status
    showProjectDetails(project);
}

function mergeProject(projectId) {
    const project = projectData.projects.find(p => p.id === projectId);
    
    if (confirm(`Are you sure you want to merge all submissions for "${project.name}"? This will create the final document.`)) {
        console.log('Merging project:', project);
        
        // Simulate merge process
        showMergeProgress(projectId);
    }
}

function downloadProject(projectId) {
    const project = projectData.projects.find(p => p.id === projectId);
    console.log('Downloading project:', project);
    
    // Simulate download
    showDownloadOptions(project);
}

/**
 * Show project details modal
 */
function showProjectDetails(project) {
    // This would create and show a modal with project details
    alert(`Project: ${project.name}\nStatus: ${project.status}\nProgress: ${project.progress}%\nAuthors: ${project.authors.map(a => a.name).join(', ')}`);
}

/**
 * Show merge progress
 */
function showMergeProgress(projectId) {
    // This would show a progress modal
    showSuccessMessage('Document merge initiated. You will be notified when complete.');
    
    // Update project status to completed (simulation)
    setTimeout(() => {
        const projectIndex = projectData.projects.findIndex(p => p.id === projectId);
        if (projectIndex !== -1) {
            projectData.projects[projectIndex].status = 'completed';
            projectData.projects[projectIndex].progress = 100;
            renderProjectsTable(projectData.projects);
            updateProjectStats(projectData.projects);
        }
        showSuccessMessage('Document merge completed successfully!');
    }, 2000);
}

/**
 * Show download options
 */
function showDownloadOptions(project) {
    const options = ['PDF', 'Word Document (.docx)', 'Both'];
    const choice = prompt(`Choose download format for "${project.name}":\n1. PDF\n2. Word Document\n3. Both\n\nEnter number (1-3):`);
    
    if (choice >= 1 && choice <= 3) {
        const format = options[choice - 1];
        showSuccessMessage(`Downloading ${project.name} as ${format}...`);
    }
}

/**
 * Utility functions
 */
function isDueThisWeek(dueDate) {
    const due = new Date(dueDate);
    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return due >= today && due <= weekFromNow;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function showSuccessMessage(message) {
    console.log('Success:', message);
    // In a real app, this would show a toast notification
}

function showErrorMessage(message) {
    console.error('Error:', message);
    // In a real app, this would show an error toast
}

function setActiveNavigation(page) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`[href="${page}.html"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

function isAuthenticated() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

/**
 * Toggle sidebar (handled by admin-layout.js, but keeping for compatibility)
 */
function toggleSidebar() {
    if (typeof window.adminLayout !== 'undefined' && window.adminLayout.toggleSidebar) {
        window.adminLayout.toggleSidebar();
    } else {
        // Fallback toggle
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    }
}

/**
 * Logout function
 */
function logout() {
    if (typeof AuthSystem !== 'undefined' && AuthSystem.logout) {
        AuthSystem.logout();
    } else {
        // Fallback logout
        if (confirm('Are you sure you want to logout?')) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'index.html';
        }
    }
}

// Export functions for global access
window.createNewProject = createNewProject;
window.viewProject = viewProject;
window.mergeProject = mergeProject;
window.downloadProject = downloadProject;
window.toggleSidebar = toggleSidebar;
window.logout = logout;