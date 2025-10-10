/**
 * Dashboard Page Logic
 * Handles loading and displaying dashboard statistics and data
 */

document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
});

/**
 * Load all dashboard data
 */
async function loadDashboardData() {
    await Promise.all([
        loadStats(),
        loadRecentDocuments(),
        loadTemplateStats()
    ]);
}

/**
 * Load dashboard statistics
 */
async function loadStats() {
    try {
        const result = await DashboardAPI.getStats();
        
        if (result.success) {
            updateStats(result.data);
        } else {
            console.log('Failed to load stats:', result.error);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        // Use mock data as fallback
        const mockStats = {
            templates: 24,
            authors: 156,
            pendingSubmissions: 12,
            generatedDocuments: 89
        };
        updateStats(mockStats);
    }
}

/**
 * Update stats in UI with animation
 */
function updateStats(stats) {
    // Update based on the new data structure from our API
    animateValue('totalTemplates', 0, stats.templates || 0, 1000);
    animateValue('totalAuthors', 0, stats.authors || 0, 1000);
    animateValue('pendingSubmissions', 0, stats.pendingSubmissions || 0, 1000);
    animateValue('generatedDocs', 0, stats.generatedDocuments || 0, 1000);
}

/**
 * Animate number counting
 */
function animateValue(elementId, start, end, duration) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            element.textContent = end.toLocaleString();
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
    }, 16);
}

/**
 * Load recent documents
 */
async function loadRecentDocuments() {
    const tableBody = document.getElementById('recentDocsTable');
    if (!tableBody) return;
    
    try {
        const result = await DashboardAPI.getRecentDocuments();
        
        if (result.success && result.data) {
            displayRecentDocuments(result.data);
        } else {
            console.log('Failed to load recent documents:', result.error);
        }
    } catch (error) {
        console.error('Error loading recent documents:', error);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading documents</td></tr>';
    }
}

/**
 * Display recent documents in table
 */
function displayRecentDocuments(documents) {
    const tableBody = document.getElementById('recentDocsTable');
    if (!tableBody) return;
    
    if (documents.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No documents found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = documents.map(doc => {
        const statusClass = {
            'completed': 'bg-success',
            'pending': 'bg-warning',
            'reviewing': 'bg-info'
        }[doc.status.toLowerCase()] || 'bg-secondary';
        
        const timeAgo = formatTimeAgo(new Date(doc.submittedAt));
        
        return `
        <tr>
            <td>${escapeHtml(doc.authorName)}</td>
            <td>${escapeHtml(doc.templateName)}</td>
            <td>${timeAgo}</td>
            <td><span class="badge ${statusClass}">${escapeHtml(doc.status)}</span></td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        Actions
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#"><i class="fas fa-eye me-2"></i>View</a></li>
                        <li><a class="dropdown-item" href="#"><i class="fas fa-download me-2"></i>Download</a></li>
                    </ul>
                </div>
            </td>
        </tr>`;
    }).join('');
}

/**
 * Load template usage statistics
 */
async function loadTemplateStats() {
    const statsContainer = document.getElementById('templateStats');
    if (!statsContainer) return;
    
    try {
        // Mock data for prototype
        const mockStats = [
            { name: 'Report', percentage: 45, color: 'primary' },
            { name: 'Resume', percentage: 30, color: 'success' },
            { name: 'Academic', percentage: 25, color: 'warning' }
        ];
        
        displayTemplateStats(mockStats);
    } catch (error) {
        console.error('Error loading template stats:', error);
        statsContainer.innerHTML = '<p class="text-center text-danger">Error loading statistics</p>';
    }
}

/**
 * Display template statistics
 */
function displayTemplateStats(stats) {
    const statsContainer = document.getElementById('templateStats');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = stats.map(stat => `
        <div class="mb-3">
            <div class="d-flex justify-content-between mb-1">
                <span>${escapeHtml(stat.name)}</span>
                <span>${stat.percentage}%</span>
            </div>
            <div class="progress">
                <div class="progress-bar bg-${stat.color}" role="progressbar" style="width: ${stat.percentage}%"></div>
            </div>
        </div>
    `).join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format time ago from date
 */
function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) {
        return `${minutes} min ago`;
    } else if (hours < 24) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
}