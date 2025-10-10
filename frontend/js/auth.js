/**
 * Authentication Handler
 * Manages login, logout, and session checks
 */

// Check if user is authenticated on page load
document.addEventListener('DOMContentLoaded', function() {
    // Run asynchronously so we can query Supabase session
    checkAuthentication();
    initializeAuthHandlers();
});

/**
 * Check if user is authenticated
 */
async function checkAuthentication() {
    const currentPage = window.location.pathname;
    const isLoginPage = currentPage.includes('index.html') || currentPage.endsWith('/');
    let isAuthenticated = false;

    try {
        const supa = window.__supabaseClient || window.supabaseClient;
        const token = getAuthToken();

        if (supa && supa.auth && typeof supa.auth.getSession === 'function') {
            const { data } = await supa.auth.getSession();
            const session = data?.session || null;
            if (session && session.user) {
                isAuthenticated = true;
                // Ensure legacy token path is populated so existing code paths work
                if (!token && session.access_token) {
                    setAuthToken(session.access_token);
                }
                // Stash user for UI convenience
                window.currentUser = session.user;
            } else {
                isAuthenticated = !!token;
            }
        } else {
            // Fallback to legacy token if Supabase client isn't available yet
            isAuthenticated = token !== null && token !== undefined;
        }
    } catch (e) {
        console.warn('Auth check error:', e);
    }

    // If not authenticated and not on login page, redirect to login
    if (!isAuthenticated && !isLoginPage) {
        window.location.href = 'index.html';
        return;
    }

    // If authenticated and on login page, check for drafts before redirecting
    if (isAuthenticated && isLoginPage) {
        checkForDraftAndRedirect();
    }
}

/**
 * Check for saved drafts and redirect appropriately
 */
function checkForDraftAndRedirect() {
    try {
        const savedDraft = localStorage.getItem('formatflow_current_draft');
        if (savedDraft) {
            const draftData = JSON.parse(savedDraft);
            const lastSaved = new Date(draftData.lastSaved);
            const confirmLoad = confirm(`A saved draft was found (${lastSaved.toLocaleString()}). Would you like to continue from where you left off?`);
            
            if (confirmLoad) {
                // Redirect to template editor
                window.location.href = 'template-editor-advanced.html';
                return;
            } else {
                // User declined, remove the draft
                localStorage.removeItem('formatflow_current_draft');
            }
        }
        
        // No draft or user declined, go to dashboard
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.warn('Failed to check for draft:', error);
        // If there's an error, just go to dashboard
        window.location.href = 'dashboard.html';
    }
}

/**
 * Initialize authentication event handlers
 */
function initializeAuthHandlers() {
    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout button handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

/**
 * Handle login form submission
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    // Hide any previous errors
    errorMessage.classList.add('d-none');
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';
    
    try {
        // Call login API
        const result = await AuthAPI.login(email, password);
        
        if (result.success) {
            // Store auth token (compat with existing code paths)
            if (result.data && result.data.token) {
                setAuthToken(result.data.token);
            }
            // Store user info in memory
            window.currentUser = result.data.user;
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Show error message
            showError(errorMessage, result.error || 'Login failed. Please try again.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(errorMessage, 'An error occurred. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

/**
 * Handle logout
 */
async function handleLogout(e) {
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    
    try {
        // Call logout API (Supabase signOut + token clear)
        await AuthAPI.logout();
    } catch (error) {
        console.log('Logout API error:', error);
    } finally {
        // Clear auth token and user data
        clearAuthToken();
        window.currentUser = null;

        // Redirect target: admin pages go to the public user login, others go to local index
        const ADMIN_LOGOUT_REDIRECT = 'http://127.0.0.1:3000/user/index.html';
        const isAdmin = (window.location.pathname || '').includes('/admin/');
        window.location.href = isAdmin ? ADMIN_LOGOUT_REDIRECT : 'index.html';
    }
}

/**
 * Show error message
 */
function showError(element, message) {
    element.textContent = message;
    element.classList.remove('d-none');
}

/**
 * Get current user info
 */
function getCurrentUser() {
    return window.currentUser || null;
}

/**
 * Update user display in UI
 */
function updateUserDisplay() {
    const user = getCurrentUser();
    if (user) {
        const adminNameElements = document.querySelectorAll('#adminName');
        adminNameElements.forEach(el => {
            el.textContent = user.name || user.email;
        });
        
        const avatarElements = document.querySelectorAll('.admin-avatar');
        avatarElements.forEach(el => {
            const initial = (user.name || user.email).charAt(0).toUpperCase();
            el.textContent = initial;
        });
    }
}

// Update user display on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateUserDisplay);
} else {
    updateUserDisplay();
}

/**
 * AuthSystem object for backward compatibility and consistent API
 */
const AuthSystem = {
    login: handleLogin,
    logout: handleLogout,
    getCurrentUser: getCurrentUser,
    updateUserDisplay: updateUserDisplay,
    checkAuthentication: checkAuthentication,
    isAuthenticated: () => getAuthToken() !== null
};

// Make AuthSystem globally available
window.AuthSystem = AuthSystem;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthSystem;
}