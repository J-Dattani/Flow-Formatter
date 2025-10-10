/**
 * API Handler - Smart Document Merger Prototype
 * Works with mock data for demonstration purposes
 */

const API_CONFIG = {
    PROTOTYPE_MODE: false, // Real Supabase auth is now enforced
    BASE_URL: 'http://localhost:5000/api',
    ENDPOINTS: {
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
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
    const read = () => {
        try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
    };
    const write = (arr) => { localStorage.setItem(KEY, JSON.stringify(arr)); };
    const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
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

/**
 * Mock data for prototype
 */
const MOCK_DATA = {
    users: [
        { id: 1, email: 'admin@example.com', password: 'admin123', name: 'Admin User', role: 'admin' },
        { id: 2, email: 'demo@example.com', password: 'demo123', name: 'Demo User', role: 'admin' }
    ],
    dashboardStats: {
        templates: 24,
        authors: 156,
        pendingSubmissions: 12,
        generatedDocuments: 89
    },
    authors: [
        {
            id: 'author_1',
            name: 'John Smith',
            email: 'john.smith@example.com',
            role: 'content_writer',
            department: 'Marketing',
            status: 'active',
            bio: 'Experienced content writer with 5+ years in digital marketing and technical writing.',
            documents_count: 23,
            pending_count: 3,
            completed_count: 20,
            created_at: '2024-01-15T10:30:00Z',
            last_active: '2024-10-07T14:20:00Z'
        },
        {
            id: 'author_2',
            name: 'Alice Davis',
            email: 'alice.davis@example.com',
            role: 'editor',
            department: 'Editorial',
            status: 'active',
            bio: 'Senior editor specializing in technical documentation and research papers.',
            documents_count: 45,
            pending_count: 2,
            completed_count: 43,
            created_at: '2024-02-20T09:15:00Z',
            last_active: '2024-10-08T11:45:00Z'
        },
        {
            id: 'author_3',
            name: 'Michael Johnson',
            email: 'michael.johnson@example.com',
            role: 'reviewer',
            department: 'Quality Assurance',
            status: 'pending',
            bio: 'Quality assurance specialist with expertise in document review and compliance.',
            documents_count: 12,
            pending_count: 1,
            completed_count: 11,
            created_at: '2024-03-10T16:45:00Z',
            last_active: '2024-10-06T09:30:00Z'
        },
        {
            id: 'author_4',
            name: 'Sarah Wilson',
            email: 'sarah.wilson@example.com',
            role: 'contributor',
            department: 'Research',
            status: 'active',
            bio: 'Research contributor focusing on data analysis and report generation.',
            documents_count: 34,
            pending_count: 5,
            completed_count: 29,
            created_at: '2024-01-25T13:20:00Z',
            last_active: '2024-10-08T16:10:00Z'
        }
    ],
    submissions: [
        {
            id: 'sub_1',
            title: 'Annual Marketing Report 2024',
            description: 'Comprehensive analysis of marketing performance and strategies for 2024',
            author_name: 'John Smith',
            author_email: 'john.smith@example.com',
            template_id: 'template_1',
            template_name: 'Business Report',
            status: 'approved',
            created_at: '2024-10-01T10:30:00Z',
            word_count: 2450,
            page_count: 8,
            version: '1.2',
            download_count: 15,
            content: [
                { type: 'title', content: 'Annual Marketing Report 2024' },
                { type: 'paragraph', content: 'This report provides a comprehensive analysis of our marketing performance throughout 2024, including key metrics, campaign results, and strategic recommendations for the upcoming year.' },
                { type: 'subtitle', content: 'Executive Summary' },
                { type: 'paragraph', content: 'Our marketing efforts in 2024 showed significant improvement with a 35% increase in lead generation and 28% growth in conversion rates.' }
            ]
        },
        {
            id: 'sub_2',
            title: 'Product Development Proposal',
            description: 'Proposal for new product development initiative with market analysis',
            author_name: 'Alice Davis',
            author_email: 'alice.davis@example.com',
            template_id: 'template_2',
            template_name: 'Project Proposal',
            status: 'pending',
            created_at: '2024-10-03T14:45:00Z',
            word_count: 1890,
            page_count: 6,
            version: '1.0',
            download_count: 3,
            content: [
                { type: 'title', content: 'Product Development Proposal' },
                { type: 'paragraph', content: 'This proposal outlines the development plan for our new product line, including market research, technical requirements, and timeline.' }
            ]
        },
        {
            id: 'sub_3',
            title: 'Research Findings Summary',
            description: 'Summary of Q3 research findings and recommendations',
            author_name: 'Sarah Wilson',
            author_email: 'sarah.wilson@example.com',
            template_id: 'template_3',
            template_name: 'Research Report',
            status: 'rejected',
            created_at: '2024-09-28T11:20:00Z',
            word_count: 3200,
            page_count: 12,
            version: '2.1',
            download_count: 8,
            content: [
                { type: 'title', content: 'Q3 Research Findings Summary' },
                { type: 'paragraph', content: 'Our Q3 research focused on customer behavior analysis and market trend identification.' }
            ]
        }
    ],
    settings: {
        general: {
            systemName: 'Smart Document Merger',
            systemLanguage: 'en',
            timezone: 'UTC',
            dateFormat: 'MM/DD/YYYY',
            autoSave: true,
            emailNotifications: true,
            publicTemplates: false,
            analyticsTracking: true
        },
        profile: {
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            phone: '+1 (555) 123-4567',
            department: 'Administration',
            bio: 'System administrator responsible for managing the Smart Document Merger platform.'
        },
        templates: {
            defaultTemplate: 'basic',
            maxFileSize: 10,
            templateExpiry: 365,
            versionControl: true,
            templateSharing: true,
            autoBackup: true,
            templateComments: false,
            allowedFormats: {
                pdf: true,
                docx: true,
                html: false
            }
        },
        notifications: {
            newSubmission: true,
            statusChanges: true,
            newUsers: false,
            systemAlerts: true,
            weeklyReports: false,
            marketingEmails: false,
            browserNotifications: true,
            soundNotifications: false,
            notificationFrequency: 'instant'
        },
        security: {
            enable2FA: false,
            sessionTimeout: 30,
            rememberDevice: false,
            loginAlerts: true,
            suspiciousActivity: true
        },
        integrations: {
            googleDrive: false,
            dropbox: false,
            slack: true,
            microsoft365: false
        },
        backup: {
            autoBackups: true,
            backupFrequency: 'weekly',
            backupRetention: 30
        }
    },
    recentSubmissions: [
        {
            id: 1,
            authorName: 'John Smith',
            templateName: 'Annual Report 2024',
            status: 'completed',
            submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 2,
            authorName: 'Alice Davis',
            templateName: 'Research Paper',
            status: 'pending',
            submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 3,
            authorName: 'Mike Johnson',
            templateName: 'Project Proposal',
            status: 'reviewing',
            submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        }
    ]
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
    // [ADDED]: Step Auth - Real Supabase authentication.
    login: async (email, password) => {
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) throw new Error('Supabase client not initialized');

            // First try to sign in with Supabase Auth
            const { data, error } = await supa.auth.signInWithPassword({ email, password });
            if (!error && data && data.session && data.user) {
                const session = data.session;
                const user = data.user;
                // Enrich with profile from public.users table
                const profileRes = await UsersAPI.getOrCreateProfile({ id: user.id, email: user.email });
                const profile = profileRes?.data || {};
                return {
                    success: true,
                    data: {
                        token: session.access_token,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: profile.name || user.email,
                            role: profile.role || 'admin',
                            department: profile.department || undefined
                        }
                    }
                };
            }

            // If Supabase sign-in failed, offer helpful fallbacks
            let errMsg = error?.message || 'Login failed';
            if (error?.status === 400 || /Invalid login credentials/i.test(errMsg)) {
                errMsg = 'Invalid email or password. If this is a new account, ensure Email provider is enabled and the user is confirmed.';
            }
            if (/Email not confirmed/i.test(errMsg)) {
                errMsg = 'Email not confirmed. Please click the confirmation link sent to your email, then try again.';
            }

            // 1) Prototype fallback: use mock users when prototype mode is enabled
            if (API_CONFIG.PROTOTYPE_MODE) {
                const mock = handleMockLogin({ email, password });
                if (mock.success) {
                    return mock;
                }
            }

            // 2) Attempt to sign up (if email/password auth enabled)
            // Note: if email confirmation is required, session will be null and the user must confirm via email
            try {
                const signUpRes = await supa.auth.signUp({ email, password });
                const sUser = signUpRes?.data?.user;
                const sSession = signUpRes?.data?.session;
                if (sUser && sSession) {
                    const profileRes = await UsersAPI.getOrCreateProfile({ id: sUser.id, email: sUser.email });
                    const profile = profileRes?.data || {};
                    return {
                        success: true,
                        data: {
                            token: sSession.access_token,
                            user: {
                                id: sUser.id,
                                email: sUser.email,
                                name: profile.name || sUser.email,
                                role: profile.role || 'admin',
                                department: profile.department || undefined
                            }
                        }
                    };
                } else if (sUser && !sSession) {
                    return { success: false, error: 'Sign-up succeeded. Please check your email and confirm your account, then sign in.' };
                }
            } catch (signUpErr) {
                // Surface sign-up error details to help debugging 400s
                const m = signUpErr?.message || 'Sign-up failed';
                return { success: false, error: m };
            }

            return { success: false, error: errMsg };
        } catch (e) {
            console.error('Supabase login error:', e);
            return { success: false, error: e.message || 'Login failed' };
        }
    },

    logout: async () => {
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) throw new Error('Supabase client not initialized');
            await supa.auth.signOut();
        } catch (e) {
            console.warn('Supabase logout warning:', e.message);
        }
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
const TemplateAPI = {
    // [ADDED]: Step Templates - Real Supabase-backed CRUD
    getAll: async () => {
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            if (!supa) throw new Error('Supabase client not initialized');
            // If not authenticated, use local fallback (prototype UX)
            const sess = await supa.auth.getSession();
            const isAuthed = !!sess?.data?.session?.user?.id;
            if (!isAuthed) {
                return LocalTemplateStore.getAll();
            }
            const { data, error } = await supa
                .from('templates')
                .select('id, name, category, updated_at, metadata')
                .order('updated_at', { ascending: false });
            if (error) throw error;
            // If no data, still return empty list
            return { success: true, data: data || [] };
        } catch (e) {
            console.error('Template getAll error:', e);
            return { success: false, error: e.message };
        }
    },
    
    create: async (templateData) => {
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            const session = await supa.auth.getSession();
            const userId = session?.data?.session?.user?.id || null;
            if (!userId) {
                // Not logged in: use local fallback to preserve UX
                return LocalTemplateStore.create(templateData);
            }

            // Embed editor content into metadata to avoid requiring specific DB columns
            const metaBase = templateData.metadata || {};
            const editorMeta = metaBase.editor || {};
            if (templateData.content) {
                editorMeta.content = templateData.content;
            }
            metaBase.editor = editorMeta;
            if (!metaBase.status) metaBase.status = 'draft';
            // Some databases have NOT NULL constraints on legacy columns
            const extras = {
                structure: (templateData.structure !== undefined) ? templateData.structure : {},
                chapters: (templateData.chapters !== undefined) ? templateData.chapters : [],
                variables: (templateData.variables !== undefined) ? templateData.variables : []
            };
            const payload = {
                name: templateData.name || 'Untitled Template',
                description: templateData.description || '',
                category: templateData.category || 'general',
                metadata: metaBase,
                created_by: userId,
                version: 1,
                ...extras
            };
            // First attempt with extras (covers NOT NULL structure)
            let insertRes = await supa.from('templates').insert(payload).select('id, version, name, category, updated_at, metadata').single();
            // Handle FK constraint mismatch: table may reference public.users(id) instead of auth.users(id)
            if (insertRes.error && /foreign key constraint/i.test(insertRes.error.message || '')) {
                try {
                    const user = (await supa.auth.getUser()).data.user;
                    const profRes = await UsersAPI.getOrCreateProfile({ id: user?.id, email: user?.email });
                    const profile = profRes?.data;
                    if (profile?.id && profile.id !== payload.created_by) {
                        const retryPayload = { ...payload, created_by: profile.id };
                        insertRes = await supa.from('templates').insert(retryPayload).select('id, version, name, category, updated_at, metadata').single();
                    }
                } catch (_) { /* ignore */ }
            }
            if (insertRes.error && /column .* does not exist/i.test(insertRes.error.message || '')) {
                // Retry without extras if the table doesn't have those columns
                const { structure, chapters, variables, ...withoutExtras } = payload;
                insertRes = await supa.from('templates').insert(withoutExtras).select('id, version, name, category, updated_at, metadata').single();
            } else if (insertRes.error && /invalid input syntax/i.test(insertRes.error.message || '')) {
                // Retry with string '{}' for structure if type is text
                const retryPayload = { ...payload, structure: '{}' };
                insertRes = await supa.from('templates').insert(retryPayload).select('id, version, name, category, updated_at, metadata').single();
            }
            if (insertRes.error) throw insertRes.error;
            return { success: true, data: insertRes.data };
        } catch (e) {
            // If authenticated, surface the error (likely RLS/columns)
            try {
                const supa = window.__supabaseClient || window.supabaseClient;
                const session = await supa.auth.getSession();
                const userId = session?.data?.session?.user?.id || null;
                if (userId) {
                    return { success: false, error: e.message };
                }
            } catch (_) { /* ignore */ }
            // If not authenticated, fallback locally
            return LocalTemplateStore.create(templateData);
        }
    },

    getById: async (id) => {
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            const { data, error } = await supa
                .from('templates')
                .select('id, name, description, category, metadata, version, created_by, updated_at')
                .eq('id', id)
                .single();
            if (error) throw error;
            return { success: true, data };
        } catch (e) {
            const fb = LocalTemplateStore.getById(id);
            if (!fb.success) {
                console.error('Template getById error:', e);
            }
            return fb;
        }
    },

    save: async (templateData) => {
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            const session = await supa.auth.getSession();
            const userId = session?.data?.session?.user?.id || null;
            if (!userId) {
                // Not logged in: fallback to local storage
                return LocalTemplateStore.save(templateData);
            }

            if (!templateData.id) {
                return TemplateAPI.create(templateData);
            }

            const nextVersion = (templateData.version || 1) + 1;
            const metaBase = templateData.metadata || {};
            const editorMeta = metaBase.editor || {};
            if (templateData.content) {
                editorMeta.content = templateData.content;
            }
            metaBase.editor = editorMeta;
            const extras = {
                structure: (templateData.structure !== undefined) ? templateData.structure : {},
                chapters: (templateData.chapters !== undefined) ? templateData.chapters : [],
                variables: (templateData.variables !== undefined) ? templateData.variables : []
            };
            const payload = {
                name: templateData.name,
                description: templateData.description,
                category: templateData.category || 'general',
                metadata: metaBase,
                version: nextVersion,
                created_by: templateData.created_by || userId,
                ...extras
            };
            let updateRes = await supa
                .from('templates')
                .update(payload)
                .eq('id', templateData.id)
                .select('id, version, name, category, updated_at, metadata')
                .single();
            if (updateRes.error && /foreign key constraint/i.test(updateRes.error.message || '')) {
                try {
                    const user = (await supa.auth.getUser()).data.user;
                    const profRes = await UsersAPI.getOrCreateProfile({ id: templateData.created_by || user?.id, email: user?.email });
                    const profile = profRes?.data;
                    if (profile?.id && profile.id !== payload.created_by) {
                        const retryPayload = { ...payload, created_by: profile.id };
                        updateRes = await supa
                            .from('templates')
                            .update(retryPayload)
                            .eq('id', templateData.id)
                            .select('id, version, name, category, updated_at, metadata')
                            .single();
                    }
                } catch (_) { /* ignore */ }
            }
            if (updateRes.error && /column .* does not exist/i.test(updateRes.error.message || '')) {
                // Retry without extras if columns don't exist
                const { structure, chapters, variables, ...withoutExtras } = payload;
                updateRes = await supa
                    .from('templates')
                    .update(withoutExtras)
                    .eq('id', templateData.id)
                    .select('id, version, name, category, updated_at, metadata')
                    .single();
            } else if (updateRes.error && /invalid input syntax/i.test(updateRes.error.message || '')) {
                // Retry with string '{}' for structure if type is text
                const retryPayload = { ...payload, structure: '{}' };
                updateRes = await supa
                    .from('templates')
                    .update(retryPayload)
                    .eq('id', templateData.id)
                    .select('id, version, name, category, updated_at, metadata')
                    .single();
            }
            if (updateRes.error) throw updateRes.error;
            return { success: true, data: updateRes.data };
        } catch (e) {
            // If authenticated, surface the error so UI shows it
            try {
                const supa = window.__supabaseClient || window.supabaseClient;
                const session = await supa.auth.getSession();
                const userId = session?.data?.session?.user?.id || null;
                if (userId) {
                    return { success: false, error: e.message };
                }
            } catch (_) { /* ignore */ }
            // If not authenticated, fallback locally
            return LocalTemplateStore.save(templateData);
        }
    },

    delete: async (id) => {
        try {
            const supa = window.__supabaseClient || window.supabaseClient;
            const { error } = await supa.from('templates').delete().eq('id', id);
            if (error) throw error;
            return { success: true, data: { id } };
        } catch (e) {
            console.warn('Template delete falling back to local store:', e.message);
            return LocalTemplateStore.delete(id);
        }
    }
};

/**
 * AUTHORS API
 */
const AuthorsAPI = {
    getAll: async () => {
        if (API_CONFIG.PROTOTYPE_MODE) {
            await simulateDelay();
            return { success: true, data: MOCK_DATA.authors };
        }
        return await apiCall('/authors');
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
        return await apiCall('/authors', { method: 'POST', body: authorData });
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
        return await apiCall(`/authors/${id}`, { method: 'PUT', body: authorData });
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
        return await apiCall(`/authors/${id}`, { method: 'DELETE' });
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
