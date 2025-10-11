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
    const currentPage = (window.location.pathname || '').toLowerCase();
    // Treat login/signup and public landing as public pages that should not redirect away
    const isLoginLike = currentPage.endsWith('/user/login.html') || currentPage.endsWith('login.html');
    const isSignupLike = currentPage.endsWith('/user/signup.html') || currentPage.endsWith('signup.html');
    const isUserLanding = currentPage.endsWith('/user/index.html');
    const isRoot = currentPage === '/' || currentPage.endsWith('/index.html');
    const isPublicPage = isLoginLike || isSignupLike || isUserLanding || isRoot;
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

    // If not authenticated and not on a public page, redirect to users index (login page not present)
    if (!isAuthenticated && !isPublicPage) {
        window.location.href = '/user/index.html';
        return;
    }

    // If authenticated and on a public page (login/landing), redirect into app
    if (isAuthenticated && (isLoginLike || isUserLanding || isRoot)) {
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
    
    // Signup form handler
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    // Logout button handler (support both id and class)
    const logoutButtons = document.querySelectorAll('#logoutBtn, .logout-btn');
    logoutButtons.forEach(btn => btn.addEventListener('click', handleLogout));
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
            const user = (result.data && result.data.user) ? result.data.user : null;
            window.currentUser = user;
            try { if (user) localStorage.setItem('currentUser', JSON.stringify(user)); } catch (_) {}
            const userEmail = (user && user.email) ? user.email.toLowerCase() : (email || '').toLowerCase();
            // Redirect based on returned user email
            if (userEmail === 'admin@example.com') {
                window.location.href = '../admin/dashboard.html';
            } else {
                window.location.href = 'dashboard.html';
            }
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
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    
    try {
        // Call logout API (Supabase signOut + token clear)
        await AuthAPI.logout();
    } catch (error) {
        console.log('Logout API error:', error);
    } finally {
        // Clear auth token and user data
        clearAuthToken();
        window.currentUser = null;

        // Always redirect to the users index page (login page not present)
        window.location.href = '/user/index.html';
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
    if (window.currentUser) return window.currentUser;
    try {
        const s = localStorage.getItem('currentUser');
        if (s) {
            const u = JSON.parse(s);
            window.currentUser = u;
            return u;
        }
    } catch (_) {}
    return null;
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

/**
 * Handle signup form submission
 */
async function handleSignup(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm-password')?.value;
    const successEl = document.getElementById('signup-success');
    const errorEl = document.getElementById('signup-error');

    // Reset messages
    if (successEl) { successEl.style.display = 'none'; successEl.textContent = ''; }
    if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

    if (confirm !== undefined && password !== confirm) {
        if (errorEl) { errorEl.textContent = 'Passwords do not match'; errorEl.style.display = 'block'; }
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const original = submitBtn ? submitBtn.innerHTML : null;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...'; }

    try {
        const res = await AuthAPI.signup({ email, password, name: email });
        if (res && res.success) {
            if (successEl) { successEl.textContent = 'Account created. You can sign in now.'; successEl.style.display = 'block'; }
            // Optionally auto-login
            // await handleLogin({ preventDefault: ()=>{}, target: { querySelector: ()=>null } });
            // Or redirect to login page
            setTimeout(() => { window.location.href = 'index.html'; }, 800);
        } else {
            if (errorEl) { errorEl.textContent = res?.error || 'Signup failed'; errorEl.style.display = 'block'; }
        }
    } catch (err) {
        if (errorEl) { errorEl.textContent = err?.message || 'Signup failed'; errorEl.style.display = 'block'; }
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = original; }
    }
}