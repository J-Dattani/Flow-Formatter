/**
 * API Handler - Smart Document Merger Prototype
 * Works with mock data for demonstration purposes
 */

const API_CONFIG = {
    PROTOTYPE_MODE: false, // Set true to force pure mock mode
    BASE_URL: 'http://127.0.0.1:8000/api',
    ENDPOINTS: {
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        SIGNUP: '/auth/signup',
        DASHBOARD_STATS: '/dashboard/stats',
        RECENT_DOCS: '/dashboard/recent-documents',
        TEMPLATES: '/templates',
        TEMPLATE_BY_ID: '/templates/:id',
        DOCUMENTS: '/documents',
        USERS: '/users'
    }
};

// Lightweight localStorage fallback for templates to preserve prior UX when not authenticated
const LocalTemplateStore = (() => {
    const KEY = 'templates_store_v1';
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
    const write = (arr) => { localStorage.setItem(KEY, JSON.stringify(arr)); };
    const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    const now = () => new Date().toISOString();
    return {
        getAll: () => ({ success: true, data: read().sort((a,b)=> (b.updated_at||'').localeCompare(a.updated_at||'')) }),
        create: (tpl) => {
            const list = read();
            const id = uuid();
            const item = {
                id,
                name: tpl.name || 'Untitled Template',
                description: tpl.description || '',
                category: tpl.category || 'general',
                structure: tpl.structure || {},
                chapters: tpl.chapters || [],
                variables: tpl.variables || [],
                metadata: tpl.metadata || { typography: tpl.typography||null, margins: tpl.margins||null, options: tpl.options||null, status: 'draft' },
                version: 1,
                updated_at: now()
            };
            list.push(item); write(list);
            return { success: true, data: { id: item.id, version: item.version, name: item.name, category: item.category, updated_at: item.updated_at, metadata: item.metadata } };
        },
        getById: (id) => {
            const list = read();
            const item = list.find(x => String(x.id) === String(id));
            return item ? { success: true, data: item } : { success: false, error: 'Not found' };
        },
        save: (tpl) => {
            const list = read();
            const idx = list.findIndex(x => String(x.id) === String(tpl.id));
            if (idx === -1) { return LocalTemplateStore.create(tpl); }
            const nextVersion = (list[idx].version || 1) + 1;
            const merged = { ...list[idx], ...tpl, version: nextVersion, updated_at: now() };
            list[idx] = merged; write(list);
            return { success: true, data: { id: merged.id, version: merged.version, name: merged.name, category: merged.category, updated_at: merged.updated_at, metadata: merged.metadata } };
        },
        delete: (id) => {
            const list = read().filter(x => String(x.id) !== String(id));
            write(list);
            return { success: true, data: { id } };
        }
    };
})();

// Minimal mock data to satisfy references when prototype mode is off
const MOCK_DATA = {
    users: [],
    dashboardStats: { templates: 0, authors: 0, pendingSubmissions: 0, generatedDocuments: 0 },
    recentSubmissions: [],
    authors: [],
    settings: {}
};

/**
 * TEMPLATE API
 */
const TemplateAPI = {
    getAll: async () => {
        try {
            try {
                const resp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TEMPLATES}`);
                const j = await resp.json().catch(() => ({}));
                if (resp.ok && j && j.success && Array.isArray(j.data)) return { success: true, data: j.data };
            } catch (_) {}
            const supa = window.__supabaseClient || window.supabaseClient;
            if (supa) {
                const { data, error } = await supa
                    .from('templates')
                    .select('id, name, category, updated_at, metadata')
                    .order('updated_at', { ascending: false });
                if (!error && Array.isArray(data)) return { success: true, data };
            }
            return LocalTemplateStore.getAll();
        } catch (e) {
            return LocalTemplateStore.getAll();
        }
    },
    create: async (templateData) => {
        try {
            try {
                const resp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TEMPLATES}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(templateData)
                });
                const j = await resp.json().catch(() => ({}));
                if (resp.ok && j && j.success) return { success: true, data: j.data };
            } catch (_) {}
            const supa = window.__supabaseClient || window.supabaseClient;
            const session = supa ? await supa.auth.getSession() : null;
            const userId = session?.data?.session?.user?.id || null;
            if (!supa || !userId) return LocalTemplateStore.create(templateData);
            const metaBase = templateData.metadata || {};
            const editorMeta = metaBase.editor || {};
            if (templateData.content) editorMeta.content = templateData.content;
            metaBase.editor = editorMeta;
            if (!metaBase.status) metaBase.status = 'draft';
            const extras = { structure: (templateData.structure !== undefined) ? templateData.structure : {}, chapters: (templateData.chapters !== undefined) ? templateData.chapters : [], variables: (templateData.variables !== undefined) ? templateData.variables : [] };
            const payload = { name: templateData.name || 'Untitled Template', description: templateData.description || '', category: templateData.category || 'general', metadata: metaBase, created_by: userId, version: 1, ...extras };
            let insertRes = await supa.from('templates').insert(payload).select('id, version, name, category, updated_at, metadata').single();
            if (insertRes.error && /column .* does not exist/i.test(insertRes.error.message || '')) {
                const { structure, chapters, variables, ...withoutExtras } = payload;
                insertRes = await supa.from('templates').insert(withoutExtras).select('id, version, name, category, updated_at, metadata').single();
            } else if (insertRes.error && /invalid input syntax/i.test(insertRes.error.message || '')) {
                const retryPayload = { ...payload, structure: '{}' };
                insertRes = await supa.from('templates').insert(retryPayload).select('id, version, name, category, updated_at, metadata').single();
            }
            if (insertRes.error) throw insertRes.error;
            return { success: true, data: insertRes.data };
        } catch (e) {
            try { const supa = window.__supabaseClient || window.supabaseClient; const session = await supa.auth.getSession(); const userId = session?.data?.session?.user?.id || null; if (userId) return { success: false, error: e.message }; } catch (_) {}
            return LocalTemplateStore.create(templateData);
        }
    },
    getById: async (id) => {
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            if (supa) {
                const { data, error } = await supa.from('templates').select('id, name, description, category, metadata, version, created_by, updated_at').eq('id', id).single();
                if (!error && data) return { success: true, data };
            }
            try { const resp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TEMPLATES}/${encodeURIComponent(String(id))}`); const j = await resp.json().catch(() => ({})); if (resp.ok && j && j.success && j.data) return { success: true, data: j.data }; } catch (_) {}
        } catch (e) {}
        return LocalTemplateStore.getById(id);
    },
    save: async (templateData) => {
        try {
            if (!templateData.id) return TemplateAPI.create(templateData);
            const nextVersion = (templateData.version || 1) + 1;
            const metaBase = templateData.metadata || {};
            const editorMeta = metaBase.editor || {};
            if (templateData.content) editorMeta.content = templateData.content;
            metaBase.editor = editorMeta;
            const extras = { structure: (templateData.structure !== undefined) ? templateData.structure : {}, chapters: (templateData.chapters !== undefined) ? templateData.chapters : [], variables: (templateData.variables !== undefined) ? templateData.variables : [] };
            const backendPayload = { ...templateData, metadata: metaBase, version: nextVersion, ...extras };
            try { const resp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TEMPLATES}/${encodeURIComponent(String(templateData.id))}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(backendPayload) }); const j = await resp.json().catch(() => ({})); if (resp.ok && j && j.success) return { success: true, data: j.data }; } catch (_) {}
            const supa = window.__supabaseClient || window.supabaseClient; const session = supa ? await supa.auth.getSession() : null; const userId = session?.data?.session?.user?.id || null; if (!supa || !userId) return LocalTemplateStore.save(templateData);
            const payload = { name: templateData.name, description: templateData.description, category: templateData.category || 'general', metadata: metaBase, version: nextVersion, created_by: templateData.created_by || userId, ...extras };
            let updateRes = await supa.from('templates').update(payload).eq('id', templateData.id).select('id, version, name, category, updated_at, metadata').single();
            if (updateRes.error && /column .* does not exist/i.test(updateRes.error.message || '')) {
                const { structure, chapters, variables, ...withoutExtras } = payload;
                updateRes = await supa.from('templates').update(withoutExtras).eq('id', templateData.id).select('id, version, name, category, updated_at, metadata').single();
            } else if (updateRes.error && /invalid input syntax/i.test(updateRes.error.message || '')) {
                const retryPayload = { ...payload, structure: '{}' };
                updateRes = await supa.from('templates').update(retryPayload).eq('id', templateData.id).select('id, version, name, category, updated_at, metadata').single();
            }
            if (updateRes.error) throw updateRes.error;
            return { success: true, data: updateRes.data };
        } catch (e) {
            try { const supa = window.__supabaseClient || window.supabaseClient; const session = await supa.auth.getSession(); const userId = session?.data?.session?.user?.id || null; if (userId) return { success: false, error: e.message }; } catch (_) {}
            return LocalTemplateStore.save(templateData);
        }
    },
    delete: async (id) => {
        try {
            try { const resp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TEMPLATES}/${encodeURIComponent(String(id))}`, { method: 'DELETE' }); const j = await resp.json().catch(() => ({})); if (resp.ok && j && j.success) return { success: true, data: { id } }; } catch (_) {}
            const supa = window.__supabaseClient || window.supabaseClient; if (supa) { const { error } = await supa.from('templates').delete().eq('id', id); if (!error) return { success: true, data: { id } }; }
            throw new Error('Delete failed');
        } catch (e) { return LocalTemplateStore.delete(id); }
    }
};

/**
 * Authentication helpers
 */
function getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

function setAuthToken(token) {
    localStorage.setItem('authToken', token);
}

function clearAuthToken() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('adminSession');
    sessionStorage.removeItem('authToken');
    sessionStorage.clear();
}

/**
 * Simulate API delay for realistic experience
 */
function simulateDelay(ms = 300) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * USERS API (profiles)
 * Matches the screenshot table 'users' with columns: id(uuid PK), email, name, role, department
 */
const UsersAPI = {
    getProfile: async ({ id, email }) => {
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) throw new Error('Supabase client not initialized');
            let query = supa.from('users').select('id,email,name,role,department').limit(1);
            if (id) query = query.eq('id', id);
            else if (email) query = query.eq('email', email);
            const { data, error } = await query.single();
            if (error) return { success: false, error: error.message };
            return { success: true, data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },
    getOrCreateProfile: async ({ id, email }) => {
        // Try get first
        const existing = await UsersAPI.getProfile({ id, email });
        if (existing.success) return existing;
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) throw new Error('Supabase client not initialized');
            // Create minimal profile. RLS should allow insert when id = auth.uid()
            const payload = { id, email, name: email, role: 'admin' };
            const { data, error } = await supa.from('users').insert(payload).select('id,email,name,role,department').single();
            if (error) return { success: false, error: error.message };
            return { success: true, data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
};

/**
 * Handle mock API calls for prototype
 */
async function handleMockApiCall(endpoint, method, body) {
    await simulateDelay();
    
    console.log(`Mock API Call: ${method} ${endpoint}`, body);
    
    switch (endpoint) {
        case API_CONFIG.ENDPOINTS.LOGIN:
            return handleMockLogin(body);
            
        case API_CONFIG.ENDPOINTS.DASHBOARD_STATS:
            return { success: true, data: MOCK_DATA.dashboardStats };
            
        case API_CONFIG.ENDPOINTS.RECENT_DOCS:
            return { success: true, data: MOCK_DATA.recentSubmissions };
            
        default:
            return { success: true, data: { message: 'Mock API response' } };
    }
}

/**
 * Handle mock login
 */
function handleMockLogin(credentials) {
    const { email, password } = credentials;

    // Special case for admin user to bypass password check for this demo
    if (email === 'admin@example.com') {
        const user = (MOCK_DATA.users.find(u => u.email === email)) || { id: 'admin-local', email: 'admin@example.com', name: 'Admin', role: 'admin' };
        const token = 'mock-token-' + Math.random().toString(36).substring(7);
        return {
            success: true,
            data: {
                token,
                user: { id: user.id, email: user.email, name: user.name, role: user.role }
            }
        };
    }
    
    const user = MOCK_DATA.users.find(u => u.email === email && u.password === password);
    
    if (user) {
        const token = 'mock-token-' + Math.random().toString(36).substring(7);
        return {
            success: true,
            data: {
                token,
                user: { id: user.id, email: user.email, name: user.name, role: user.role }
            }
        };
    } else {
        return {
            success: false,
            error: 'Invalid email or password'
        };
    }
}

/**
 * Main API call function
 */
async function apiCall(endpoint, options = {}) {
    const { method = 'GET', body, headers = {} } = options;
    
    // If prototype mode, return mock data
    if (API_CONFIG.PROTOTYPE_MODE) {
        return handleMockApiCall(endpoint, method, body);
    }
    
    // Real API call logic for when backend is ready
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    const config = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    };
    
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }
        
        return { success: true, data };
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * AUTH API
 */
const AuthAPI = {
    // Backend-first auth; falls back to local mock. No Supabase Auth.
    login: async (email, password) => {
        try {
            const inputEmail = (email || '').trim();
            const normalized = inputEmail.toLowerCase() === 'admin' ? 'admin@example.com' : inputEmail;
            // Try backend minimal auth (users table + bcrypt)
            try {
                const resp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: normalized, password })
                });
                const data = await resp.json().catch(() => ({}));
                if (resp.ok && data && (data.success === true || data.token || data.data)) {
                    return data.success !== undefined ? data : { success: true, data };
                }
            } catch (_) {
                // ignore and fall through
            }

            // Fallback to mock users
            const mock = handleMockLogin({ email: normalized, password });
            if (mock.success) {
                return mock;
            }

            return { success: false, error: 'Login failed (backend unavailable and no mock user match)' };
        } catch (e) {
            return { success: false, error: e.message || 'Login failed' };
        }
    },

    signup: async ({ email, password, name, role = 'admin' }) => {
        try {
            const resp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SIGNUP}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name, role })
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok && data) return data;
            return { success: false, error: data?.detail || data?.error || 'Signup failed' };
        } catch (e) {
            return { success: false, error: e.message || 'Signup failed' };
        }
    },

    logout: async () => {
        // With backend-managed auth, just clear token locally
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            if (supa && supa.auth && typeof supa.auth.signOut === 'function') {
                await supa.auth.signOut();
            }
        } catch (e) { /* ignore */ }
        clearAuthToken();
        return { success: true, data: { message: 'Logged out successfully' } };
    }
};

/**
 * DASHBOARD API
 */
const DashboardAPI = {
    // [ADDED]: Step Dashboard - Fetch real stats from Supabase
    getStats: async () => {
        try {
            // Backend first
            try {
                const resp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD_STATS}`);
                const j = await resp.json().catch(() => ({}));
                if (resp.ok && j && j.success && j.data) {
                    return { success: true, data: j.data };
                }
            } catch (_) { /* fallback to Supabase */ }

            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) throw new Error('Supabase client not initialized');

            const [tRes, aRes, pRes, gRes] = await Promise.all([
                supa.from('templates').select('id', { count: 'exact', head: true }),
                supa.from('users').select('id', { count: 'exact', head: true }).in('role', ['author', 'editor', 'reviewer']),
                supa.from('form_submissions').select('id', { count: 'exact', head: true }).eq('is_draft', false).lt('progress_percentage', 100),
                supa.from('documents').select('id', { count: 'exact', head: true }).in('status', ['completed', 'published'])
            ]);

            const data = {
                templates: (tRes && typeof tRes.count === 'number') ? tRes.count : 0,
                authors: (aRes && typeof aRes.count === 'number') ? aRes.count : 0,
                pendingSubmissions: (pRes && typeof pRes.count === 'number') ? pRes.count : 0,
                generatedDocuments: (gRes && typeof gRes.count === 'number') ? gRes.count : 0
            };
            return { success: true, data };
        } catch (error) {
            console.error('Dashboard stats error:', error);
            return { success: true, data: { templates: 0, authors: 0, pendingSubmissions: 0, generatedDocuments: 0 } };
        }
    },
    
    // [ADDED]: Step Dashboard - Fetch recent documents and enrich with names
    getRecentDocuments: async () => {
        try {
            // Backend first
            try {
                const resp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RECENT_DOCS}`);
                const j = await resp.json().catch(() => ({}));
                if (resp.ok && j && j.success && Array.isArray(j.data)) {
                    return { success: true, data: j.data };
                }
            } catch (_) { /* fallback to Supabase */ }

            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) throw new Error('Supabase client not initialized');

            const { data: docs, error } = await supa
                .from('documents')
                .select('id, title, status, created_at, created_by, template_id')
                .order('created_at', { ascending: false })
                .limit(10);
            if (error) throw error;

            if (!docs || docs.length === 0) return { success: true, data: [] };

            const userIds = Array.from(new Set(docs.map(d => d.created_by).filter(Boolean)));
            const templateIds = Array.from(new Set(docs.map(d => d.template_id).filter(Boolean)));

            const [uRes, tRes] = await Promise.all([
                userIds.length ? supa.from('users').select('id, name, email').in('id', userIds) : Promise.resolve({ data: [] }),
                templateIds.length ? supa.from('templates').select('id, name').in('id', templateIds) : Promise.resolve({ data: [] })
            ]);

            const userMap = (uRes.data || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
            const templateMap = (tRes.data || []).reduce((acc, t) => { acc[t.id] = t; return acc; }, {});

            const shaped = docs.map(d => ({
                authorName: (userMap[d.created_by]?.name || userMap[d.created_by]?.email || 'Unknown'),
                templateName: (templateMap[d.template_id]?.name || 'Untitled'),
                submittedAt: d.created_at,
                status: d.status || 'pending'
            }));

            return { success: true, data: shaped };
        } catch (error) {
            console.error('Recent documents error:', error);
            return { success: true, data: [] };
        }
    }
};

/**
 * TEMPLATE API
 */

/**
 * AUTHORS API
 */
const AuthorsAPI = {
    getAll: async () => {
        if (API_CONFIG.PROTOTYPE_MODE) {
            await simulateDelay();
            return { success: true, data: MOCK_DATA.authors };
        }

        // Backend-first for reliability and admin exclusion
        try {
            try {
                const resp = await fetch(`${API_CONFIG.BASE_URL}/authors`);
                const j = await resp.json().catch(() => ({}));
                if (resp.ok && j && j.success && Array.isArray(j.data)) {
                    return { success: true, data: j.data };
                }
            } catch (_) { /* fallback to Supabase */ }

            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) {
                // Fallback to existing backend endpoint
                return await apiCall('/authors');
            }

            // Fetch user profiles
            const { data: users, error: usersErr } = await supa
                .from('users')
                .select('id, name, email, role, department, status, bio, created_at, last_active')
                .neq('role', 'admin')
                .neq('email', 'admin@example.com')
                .order('created_at', { ascending: false });

            if (usersErr) {
                console.warn('Supabase users fetch failed, falling back to backend:', usersErr.message || usersErr);
                return await apiCall('/authors');
            }

            const userIds = (users || []).map(u => u.id).filter(Boolean);
            let docs = [];
            if (userIds.length) {
                const { data: docsData, error: docsErr } = await supa
                    .from('documents')
                    .select('created_by, status')
                    .in('created_by', userIds);

                if (docsErr) {
                    console.warn('Supabase documents fetch failed (counts will be zero):', docsErr.message || docsErr);
                } else {
                    docs = docsData || [];
                }
            }

            // Map users to author shape expected by UI, computing counts from documents
            const filteredUsers = (users || []).filter(u => (u.role || '').toLowerCase() !== 'admin' && (u.email || '').toLowerCase() !== 'admin@example.com');
            const authors = filteredUsers.map(u => {
                const userDocs = docs.filter(d => String(d.created_by) === String(u.id));
                const documents_count = userDocs.length;
                const completed_count = userDocs.filter(d => ['completed', 'published'].includes((d.status || '').toLowerCase())).length;
                const pending_count = documents_count - completed_count;

                return {
                    id: u.id,
                    name: u.name || u.email,
                    email: u.email,
                    role: u.role || 'contributor',
                    department: u.department || '',
                    status: u.status || 'active',
                    bio: u.bio || '',
                    documents_count,
                    pending_count,
                    completed_count,
                    created_at: u.created_at,
                    last_active: u.last_active || null
                };
            });

            return { success: true, data: authors };
        } catch (e) {
            console.error('AuthorsAPI.getAll unexpected error:', e);
            return await apiCall('/authors');
        }
    },

    create: async (authorData) => {
        if (API_CONFIG.PROTOTYPE_MODE) {
            await simulateDelay();
            const newAuthor = {
                ...authorData,
                id: 'author_' + Date.now(),
                documents_count: 0,
                pending_count: 0,
                completed_count: 0,
                created_at: new Date().toISOString(),
                last_active: null
            };
            MOCK_DATA.authors.push(newAuthor);
            return { success: true, data: newAuthor };
        }

        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) {
                return await apiCall('/authors', { method: 'POST', body: authorData });
            }

            const payload = {
                name: authorData.name,
                email: authorData.email,
                role: authorData.role,
                department: authorData.department || null,
                status: authorData.status || 'pending',
                bio: authorData.bio || null
            };

            const { data, error } = await supa.from('users').insert(payload).select('id, name, email, role, department, status, bio, created_at, last_active').single();
            if (error) {
                console.warn('Supabase create user failed, falling back to backend:', error.message || error);
                return await apiCall('/authors', { method: 'POST', body: authorData });
            }

            // Shape to UI contract
            const created = {
                id: data.id,
                name: data.name || data.email,
                email: data.email,
                role: data.role || 'contributor',
                department: data.department || '',
                status: data.status || 'pending',
                bio: data.bio || '',
                documents_count: 0,
                pending_count: 0,
                completed_count: 0,
                created_at: data.created_at,
                last_active: data.last_active || null
            };

            return { success: true, data: created };
        } catch (e) {
            console.error('AuthorsAPI.create error:', e);
            return await apiCall('/authors', { method: 'POST', body: authorData });
        }
    },

    update: async (id, authorData) => {
        if (API_CONFIG.PROTOTYPE_MODE) {
            await simulateDelay();
            const index = MOCK_DATA.authors.findIndex(a => a.id === id);
            if (index !== -1) {
                MOCK_DATA.authors[index] = { ...MOCK_DATA.authors[index], ...authorData };
                return { success: true, data: MOCK_DATA.authors[index] };
            }
            throw new Error('Author not found');
        }

        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) {
                return await apiCall(`/authors/${id}`, { method: 'PUT', body: authorData });
            }

            const payload = {
                name: authorData.name,
                email: authorData.email,
                role: authorData.role,
                department: authorData.department || null,
                status: authorData.status || null,
                bio: authorData.bio || null
            };

            const { data, error } = await supa.from('users').update(payload).eq('id', id).select('id, name, email, role, department, status, bio, created_at, last_active').single();
            if (error) {
                console.warn('Supabase update user failed, falling back to backend:', error.message || error);
                return await apiCall(`/authors/${id}`, { method: 'PUT', body: authorData });
            }

            const updated = {
                id: data.id,
                name: data.name || data.email,
                email: data.email,
                role: data.role || 'contributor',
                department: data.department || '',
                status: data.status || 'active',
                bio: data.bio || '',
                // counts will be unchanged here; frontend will refresh if needed
                documents_count: authorData.documents_count || 0,
                pending_count: authorData.pending_count || 0,
                completed_count: authorData.completed_count || 0,
                created_at: data.created_at,
                last_active: data.last_active || null
            };

            return { success: true, data: updated };
        } catch (e) {
            console.error('AuthorsAPI.update error:', e);
            return await apiCall(`/authors/${id}`, { method: 'PUT', body: authorData });
        }
    },

    delete: async (id) => {
        if (API_CONFIG.PROTOTYPE_MODE) {
            await simulateDelay();
            const index = MOCK_DATA.authors.findIndex(a => a.id === id);
            if (index !== -1) {
                MOCK_DATA.authors.splice(index, 1);
                return { success: true, data: { message: 'Author deleted' } };
            }
            throw new Error('Author not found');
        }

        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) {
                return await apiCall(`/authors/${id}`, { method: 'DELETE' });
            }

            const { error } = await supa.from('users').delete().eq('id', id);
            if (error) {
                console.warn('Supabase delete user failed, falling back to backend:', error.message || error);
                return await apiCall(`/authors/${id}`, { method: 'DELETE' });
            }

            return { success: true, data: { id } };
        } catch (e) {
            console.error('AuthorsAPI.delete error:', e);
            return await apiCall(`/authors/${id}`, { method: 'DELETE' });
        }
    }
};

/**
 * SUBMISSIONS API
 */
const SubmissionsAPI = {
    getAll: async () => {
        if (API_CONFIG.PROTOTYPE_MODE) {
            await simulateDelay();
            return { success: true, data: MOCK_DATA.submissions };
        }
        return await apiCall('/submissions');
    },

    getById: async (id) => {
        if (API_CONFIG.PROTOTYPE_MODE) {
            await simulateDelay();
            const submission = MOCK_DATA.submissions.find(s => s.id === id);
            if (submission) {
                return { success: true, data: submission };
            }
            throw new Error('Submission not found');
        }
        return await apiCall(`/submissions/${id}`);
    },

    updateStatus: async (id, status) => {
        if (API_CONFIG.PROTOTYPE_MODE) {
            await simulateDelay();
            const submission = MOCK_DATA.submissions.find(s => s.id === id);
            if (submission) {
                submission.status = status;
                return { success: true, data: submission };
            }
            throw new Error('Submission not found');
        }
        return await apiCall(`/submissions/${id}/status`, { method: 'PUT', body: { status } });
    }
};

/**
 * SETTINGS API
 */
const SettingsAPI = {
    get: async () => {
        if (API_CONFIG.PROTOTYPE_MODE) {
            await simulateDelay();
            return { success: true, data: MOCK_DATA.settings };
        }
        return await apiCall('/settings');
    },

    update: async (settings) => {
        if (API_CONFIG.PROTOTYPE_MODE) {
            await simulateDelay();
            MOCK_DATA.settings = { ...MOCK_DATA.settings, ...settings };
            return { success: true, data: MOCK_DATA.settings };
        }
        return await apiCall('/settings', { method: 'PUT', body: settings });
    }
};

/**
 * MAIN API OBJECT
 */
const API = {
    // Authentication
    login: AuthAPI.login,
    logout: AuthAPI.logout,

    // Dashboard
    getDashboardStats: DashboardAPI.getStats,
    getRecentDocuments: DashboardAPI.getRecentDocuments,

    // Templates
    getTemplates: TemplateAPI.getAll,
    createTemplate: TemplateAPI.create,
    getTemplate: TemplateAPI.getById,
    saveTemplate: TemplateAPI.save,
    deleteTemplate: TemplateAPI.delete,

    // Authors
    getAuthors: AuthorsAPI.getAll,
    createAuthor: AuthorsAPI.create,
    updateAuthor: AuthorsAPI.update,
    deleteAuthor: AuthorsAPI.delete,

    // Submissions
    getSubmissions: SubmissionsAPI.getAll,
    getSubmission: SubmissionsAPI.getById,
    updateSubmissionStatus: SubmissionsAPI.updateStatus,

    // Settings
    getSettings: SettingsAPI.get,
    updateSettings: SettingsAPI.update
};

// Export for global access
window.AuthAPI = AuthAPI;
window.DashboardAPI = DashboardAPI;
window.TemplateAPI = TemplateAPI;
window.AuthorsAPI = AuthorsAPI;
window.SubmissionsAPI = SubmissionsAPI;
window.SettingsAPI = SettingsAPI;
window.API = API;
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.clearAuthToken = clearAuthToken;
window.apiCall = apiCall;
