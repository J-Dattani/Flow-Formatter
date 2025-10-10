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
document.addEventListener('DOMContentLoaded', async function() {
    initializeProjectsPage();
    setupEventListeners();

    // Wait for Supabase client to be ready (avoid race with supabase-client.js initialization)
    try {
        await awaitSupabaseClient(5000);
    } catch (e) {
        console.warn('Supabase client did not become available within timeout; continuing without it.', e);
    }

    // Now run data load and realtime subscription (they'll check client presence internally)
    await loadProjects();
    setupProjectsRealtimeSubscription();
});

/**
 * Await the Supabase client object on window (polling).
 * Resolves when window.__supabaseClient exists or rejects after timeoutMs.
 */
function awaitSupabaseClient(timeoutMs = 5000, intervalMs = 100) {
    return new Promise((resolve, reject) => {
        if (window.__supabaseClient) return resolve(window.__supabaseClient);
        const start = Date.now();
        const iv = setInterval(() => {
            if (window.__supabaseClient) {
                clearInterval(iv);
                return resolve(window.__supabaseClient);
            }
            if (Date.now() - start > timeoutMs) {
                clearInterval(iv);
                return reject(new Error('timeout waiting for supabase client'));
            }
        }, intervalMs);
    });
}

/**
 * Run a direct select('*') against templates and show raw JSON on the page for debugging
 */
async function testTemplatesFetch() {
    // diagnostics removed
}

/**
 * Initialize projects page
 */
function initializeProjectsPage() {
    console.log('Initializing Projects Management...');
    
    // Check authentication
    // Allow unauthenticated read-only access so templates can be viewed as projects.
    if (!isAuthenticated()) {
        console.warn('Not authenticated — showing read-only projects view.');
        // continue without redirecting so templates (if publicly readable) can be fetched
    }
    
    // Set active navigation
    setActiveNavigation('projects');
}

/**
 * Load all projects from API
 */
async function loadProjects() {
    try {
        // If Supabase client is available, fetch live projects. Otherwise show empty list.
        let projects = [];
        if (window.__supabaseClient || window.supabaseClient) {
            try {
                const supa = window.__supabaseClient || window.supabaseClient;
                console.debug('Supabase client object:', supa);
                // Use templates as projects: map templates -> project-like rows
                const firstQuery = await supa.from('templates').select('id,name,description,category,metadata,updated_at').order('updated_at', { ascending: false });
                const data = firstQuery.data;
                const error = firstQuery.error;
                console.debug('Templates first query result:', { data, error, status: firstQuery.status });
                // If the query returned no rows, try a broader select('*') in case columns differ or RLS acts differently
                if (!error && Array.isArray(data) && data.length === 0) {
                    console.info('Initial templates query returned 0 rows, trying fallback select(*) to gather more debug info');
                    const fallback = await supa.from('templates').select('*').limit(20);
                    console.debug('Templates fallback query result:', { data: fallback.data, error: fallback.error, status: fallback.status });
                    // If fallback returned rows, use them
                    if (!fallback.error && Array.isArray(fallback.data) && fallback.data.length > 0) {
                        projects = fallback.data.map(t => ({
                            id: t.id,
                            name: t.name,
                            description: t.description || (t.metadata && t.metadata.description) || '',
                            template: t.name || '',
                            authors: [],
                            progress: 0,
                            status: (t.metadata && t.metadata.status) || 'active',
                            dueDate: null,
                            createdAt: t.updated_at || t.created_at || null
                        }));
                    }
                }
                if (!error && Array.isArray(data) && data.length > 0) {
                    projects = data.map(t => ({
                        id: t.id,
                        name: t.name,
                        description: t.description || (t.metadata && t.metadata.description) || '',
                        template: t.name || '',
                        authors: [], // templates do not include authors in this schema
                        progress: 0,
                        status: (t.metadata && t.metadata.status) || 'active',
                        dueDate: null,
                        createdAt: t.updated_at || null
                    }));
                } else {
                    // If there is an error, surface it clearly; otherwise, warn that data is empty
                    if (error) {
                        console.warn('Supabase templates fetch error', error);
                        // Common cause: RLS/policies blocking anon access. Add a helpful hint.
                        if (error.message && /permission|policy|forbidden|not authorized|authentication/i.test(error.message)) {
                            console.warn('Permission error detected. If your Supabase project has Row Level Security (RLS) enabled, ensure the anon role or the current user has a SELECT policy for the `templates` table.');
                        }
                    } else {
                        console.warn('Supabase templates fetch returned no rows (empty array)');
                    }
                }
            } catch (fetchErr) {
                console.warn('Error fetching templates as projects:', fetchErr);
            }
        }

        projectData.projects = projects;
            updateProjectStats(projects);
            console.info('Loaded templates as projects:', projects);
            renderProjectsTable(projects);
        
    } catch (error) {
        console.error('Error loading projects:', error);
        showErrorMessage('Failed to load projects');
    }
}

/**
 * Setup realtime subscription for projects table (Supabase Realtime)
 */
function setupProjectsRealtimeSubscription() {
    try {
        const supa = window.__supabaseClient || window.supabaseClient;
        if (!supa || typeof supa.channel !== 'function') {
            // Older CDN builds may use supa.realtime - try fallback
            if (!supa) return;
        }

        // Avoid duplicate subscriptions
        if (window.__projectsRealtimeSubscribed) return;

        // Use Postgres changes subscription
        try {
            const channel = supa.channel('templates_changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'templates' }, payload => {
                    handleProjectRealtimeEvent(payload);
                })
                .subscribe();

            window.__projectsRealtimeChannel = channel;
            window.__projectsRealtimeSubscribed = true;
        } catch (e) {
            // Some Supabase builds (older) use from('projects').on() API
            try {
                supa.from('templates').on('*', payload => handleProjectRealtimeEvent(payload)).subscribe();
                window.__projectsRealtimeSubscribed = true;
            } catch (e2) {
                console.warn('Realtime subscription not available', e2);
            }
        }
    } catch (e) {
        console.warn('Failed to setup projects realtime subscription', e);
    }
}

function handleProjectRealtimeEvent(payload) {
    try {
        // payload will contain eventType and new/old records depending on the client
        const type = payload.eventType || payload.type || payload.event;
        const newRecord = payload.new || payload.record || payload.new_record || null;
        const oldRecord = payload.old || payload.old_record || null;

        if (type === 'INSERT' || type === 'insert') {
            const p = mapProjectRow(newRecord);
            projectData.projects.unshift(p);
        } else if (type === 'UPDATE' || type === 'update') {
            const p = mapProjectRow(newRecord);
            const idx = projectData.projects.findIndex(x => String(x.id) === String(p.id));
            if (idx !== -1) projectData.projects[idx] = p;
        } else if (type === 'DELETE' || type === 'delete') {
            const id = oldRecord?.id || payload.old?.id;
            projectData.projects = projectData.projects.filter(x => String(x.id) !== String(id));
        }

        updateProjectStats(projectData.projects);
        renderProjectsTable(projectData.projects);
    } catch (e) {
        console.warn('Error handling realtime project event', e);
    }
}

function mapProjectRow(p) {
    if (!p) return null;
    return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        // Some payloads (templates table) use `name` rather than `template`
        template: p.template || p.name || '',
        authors: Array.isArray(p.authors) ? p.authors : [],
        progress: p.progress || 0,
        status: p.status || 'active',
        dueDate: p.due_date || p.dueDate || null,
        createdAt: p.created_at || p.createdAt || null
    };
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
    
    if (!projects || projects.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="text-center text-muted py-4">No projects found — your templates table is empty.</td>`;
        tableBody.appendChild(tr);
        return;
    }

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
    // Guard against missing or non-string template values
    const t = (template || '').toString().toLowerCase();
    if (t.includes('report')) return 'fas fa-chart-line';
    if (t.includes('research')) return 'fas fa-microscope';
    if (t.includes('handbook')) return 'fas fa-building';
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
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
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