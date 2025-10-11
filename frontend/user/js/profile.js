// Profile Page JavaScript

class ProfileManager {
    constructor() {
        this.currentTab = 'personal';
        this.isEditing = false;
        this.userData = null;
        this.isLoading = false;
        this.activityData = [];
        this.notificationPreferences = {};
        
        // Check if we're in static mode or API mode
        this.dataMode = (window.AppConfig && window.AppConfig.dataMode) 
            ? window.AppConfig.dataMode.mode 
            : 'static'; // Default to static if config not available
        
        this.init();
    }

    init() {
        console.log(`Profile initialized in ${this.dataMode} mode`);
        this.showLoadingState();
        this.bindEvents();
        this.loadInitialData();
        this.showTab('personal');
    }

    showLoadingState() {
        document.querySelectorAll('[data-field]').forEach(field => {
            const originalContent = field.innerHTML;
            field.dataset.originalContent = originalContent;
            field.innerHTML = '<div class="loading-skeleton"></div>';
        });
    }

    hideLoadingState() {
        document.querySelectorAll('[data-field]').forEach(field => {
            if (field.dataset.originalContent) {
                field.innerHTML = field.dataset.originalContent;
                delete field.dataset.originalContent;
            }
        });
    }

    bindEvents() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.showTab(tabId);
            });
        });

        // Edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.closest('.tab-content').id;
                this.toggleEditMode(section);
            });
        });

        // Form submissions
        document.getElementById('personalForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePersonalInfo();
        });

        // Toggle switches
        document.querySelectorAll('.toggle-switch input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.handleToggleChange(e.target);
            });
        });

        // Password change modal
        document.querySelector('.settings-card button[onclick="profileDashboard.changePassword()"]')?.addEventListener('click', () => {
            this.showPasswordModal();
        });

        // Modal close
        document.getElementById('passwordModal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
                this.hidePasswordModal();
            }
        });

        // Password form
        document.getElementById('passwordForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });

        // Activity filters
        document.querySelectorAll('.activity-filters select').forEach(select => {
            select.addEventListener('change', () => {
                this.filterActivityHistory();
            });
        });

        // Delete account button
        document.querySelector('.settings-card button[onclick="profileDashboard.deleteAccount()"]')?.addEventListener('click', () => {
            this.confirmDeleteAccount();
        });
    }

    switchTab(tabId, button) {
        // This is a legacy method to maintain compatibility with onclick handlers
        this.showTab(tabId);
    }

    showTab(tabId) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

        // Show active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabId}Tab`).classList.add('active');

        this.currentTab = tabId;

        // Load tab-specific data if needed
        if (tabId === 'activity') {
            this.loadActivityHistory();
        } else if (tabId === 'notifications') {
            this.loadNotificationPreferences();
        }
    }

    toggleEditMode(sectionId) {
        const section = document.getElementById(`${sectionId}Tab`);
        if (!section) return;

        const inputs = section.querySelectorAll('input, textarea, select');
        const editBtn = section.querySelector('.edit-btn');
        const formActions = section.querySelector('.form-actions');

        this.isEditing = !this.isEditing;

        if (this.isEditing) {
            // Enable editing
            formActions.style.display = 'flex';
            formActions.classList.add('show');
            
            editBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            inputs.forEach(input => {
                input.readOnly = false;
                input.disabled = false;
                input.parentElement.classList.add('editing');
            });
        } else {
            // Disable editing
            formActions.style.display = 'none';
            formActions.classList.remove('show');
            
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
            inputs.forEach(input => {
                input.readOnly = true;
                input.disabled = true;
                input.parentElement.classList.remove('editing');
            });
        }
    }

    cancelEdit(sectionId) {
        // This method is called from the onclick handler in HTML
        this.toggleEditMode(sectionId);
    }

    loadInitialData() {
        // Using Promise.all to load all data in parallel
        Promise.all([
            this.loadUserProfile(),
            this.loadUserStats(),
            this.loadSubscriptionInfo(),
            this.loadNotificationPreferences()
        ]).then(() => {
            // Once all data is loaded, hide loading state
            setTimeout(() => {
                this.hideLoadingState();
                this.updateUIWithUserData();
            }, 500);
        }).catch(error => {
            console.error("Error loading profile data:", error);
            this.showToast("Failed to load profile data. Please try again later.", "error");
            this.hideLoadingState();
        });
    }

    /**
     * Loads user profile data conditionally based on data mode
     * @returns {Promise} A promise that resolves when data is loaded
     */
    loadUserProfile() {
        return new Promise(async (resolve, reject) => {
            try {
                // Prefer Supabase session (frontend fallback) to identify the logged-in user
                const supa = window.__supabaseClient || window.supabaseClient;
                let sessionUser = null;
                try {
                    if (supa && supa.auth && typeof supa.auth.getSession === 'function') {
                        const { data } = await supa.auth.getSession();
                        sessionUser = data?.session?.user || null;
                    }
                } catch (_) {}

                // If backend provides a current-user endpoint, try it first
                try {
                    const token = (typeof getAuthToken === 'function') ? getAuthToken() : null;
                    const resp = await fetch('http://127.0.0.1:8000/api/users/me', {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    if (resp.ok) {
                        const j = await resp.json().catch(() => (null));
                        if (j && (j.success || j.id || j.email || j.data)) {
                            const raw = j.data || j; // normalize possible shapes
                            const mapped = this._shapeUserProfile(raw);
                            this.userData = mapped;
                            return resolve(mapped);
                        }
                    }
                } catch (_) { /* fall through */ }

                // Supabase direct fallback based on session email/id
                if (supa && (sessionUser?.id || sessionUser?.email)) {
                    try {
                        let query = supa.from('users').select('id,email,name,role,department,bio,created_at').limit(1);
                        if (sessionUser.id) query = query.eq('id', sessionUser.id);
                        else if (sessionUser.email) query = query.eq('email', sessionUser.email);
                        const { data, error } = await query.single();
                        if (!error && data) {
                            const mapped = this._shapeUserProfile(data);
                            this.userData = mapped;
                            return resolve(mapped);
                        }
                    } catch (e) {
                        console.warn('Supabase profile fetch failed:', e?.message || e);
                    }
                }

                // As a last resort, try to read a stored user in memory from login
                const fallbackUser = (window.currentUser || null);
                if (fallbackUser) {
                    const mapped = this._shapeUserProfile(fallbackUser);
                    this.userData = mapped;
                    return resolve(mapped);
                }

                // Final fallback: mock data so UI stays usable
                const delay = window.AppConfig?.dataMode?.demoDelay || 300;
                setTimeout(() => {
                    const mock = {
                        firstName: 'User',
                        lastName: 'Profile',
                        fullName: 'User Profile',
                        email: 'user@example.com',
                        title: 'Member',
                        phone: '',
                        website: '',
                        location: '',
                        timezone: 'UTC',
                        language: 'English',
                        bio: '',
                        joined: '',
                        avatar: null,
                        publishedCount: 0,
                        inProgressCount: 0,
                        followersCount: '0'
                    };
                    this.userData = mock;
                    resolve(mock);
                }, delay);
            } catch (err) {
                reject(err);
            }
        });
    }

    _shapeUserProfile(raw) {
        if (!raw) return {};
        const email = raw.email || '';
        const name = raw.name || raw.fullName || '';
        const firstName = raw.first_name || (name ? String(name).split(' ')[0] : '');
        const lastName = raw.last_name || (name && String(name).includes(' ') ? String(name).split(' ').slice(1).join(' ') : '');
        const fullName = (raw.fullName) || (name ? name : [firstName, lastName].filter(Boolean).join(' ')) || email;
        return {
            firstName,
            lastName,
            fullName,
            email,
            title: raw.title || raw.role || 'Member',
            phone: raw.phone || '',
            website: raw.website || '',
            location: raw.location || '',
            timezone: raw.timezone || 'UTC',
            language: raw.language || 'English',
            bio: raw.bio || '',
            joined: raw.created_at ? new Date(raw.created_at).toLocaleDateString() : '',
            avatar: raw.avatar || null,
            publishedCount: raw.publishedCount || 0,
            inProgressCount: raw.inProgressCount || 0,
            followersCount: raw.followersCount || '0'
        };
    }
    
    /**
     * Updates UI elements with the user data
     */
    updateUIWithUserData() {
        if (!this.userData) return;
        
        // Update elements with data-field attributes
        document.querySelectorAll('[data-field]').forEach(element => {
            const fieldName = element.dataset.field;
            if (this.userData.hasOwnProperty(fieldName)) {
                // Handle different element types
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
                    element.value = this.userData[fieldName];
                } else {
                    element.textContent = this.userData[fieldName];
                }
            }
        });
        
        // Update avatar if available
        const avatarElement = document.getElementById('userAvatarLarge');
        if (avatarElement && this.userData.avatar) {
            avatarElement.innerHTML = `<img src="${this.userData.avatar}" alt="${this.userData.fullName}" />`;
        }
    }

    loadUserStats() {
        return new Promise((resolve, reject) => {
            if (this.dataMode === 'api') {
                fetch('/api/users/stats')
                    .then(response => response.json())
                    .then(data => {
                        this.userStats = data;
                        resolve(data);
                    })
                    .catch(reject);
            } else {
                // Static mode
                setTimeout(() => {
                    // Mock stats data
                    this.userStats = {
                        projects: 24,
                        submissions: 156,
                        collaborations: 8
                    };
                    
                    // Update stats elements if needed
                    document.querySelectorAll('[data-stat]').forEach(element => {
                        const statName = element.dataset.stat;
                        if (this.userStats[statName]) {
                            element.textContent = this.userStats[statName];
                        }
                    });
                    
                    resolve(this.userStats);
                }, 300);
            }
        });
    }

    loadSubscriptionInfo() {
        return new Promise((resolve, reject) => {
            if (this.dataMode === 'api') {
                fetch('/api/users/subscription')
                    .then(response => response.json())
                    .then(data => {
                        this.subscriptionInfo = data;
                        this.updateSubscriptionDisplay(data);
                        resolve(data);
                    })
                    .catch(reject);
            } else {
                // Static mode
                setTimeout(() => {
                    // Mock subscription data
                    const subscriptionData = {
                        plan: 'Professional Plan',
                        status: 'Active',
                        nextBilling: 'March 15, 2025',
                        amount: '$29/month'
                    };
                    
                    this.subscriptionInfo = subscriptionData;
                    this.updateSubscriptionDisplay(subscriptionData);
                    resolve(subscriptionData);
                }, 400);
            }
        });
    }
    
    updateSubscriptionDisplay(subscription) {
        const planName = document.querySelector('.plan-details h5');
        const planStatus = document.querySelector('.plan-status');
        const planBilling = document.querySelector('.plan-details p');
        
        if (planName) planName.textContent = subscription.plan;
        if (planStatus) planStatus.textContent = subscription.status;
        if (planBilling) planBilling.textContent = `${subscription.amount} • Renews on ${subscription.nextBilling}`;
    }
    
    loadNotificationPreferences() {
        return new Promise((resolve, reject) => {
            if (this.dataMode === 'api') {
                fetch('/api/users/notifications/preferences')
                    .then(response => response.json())
                    .then(data => {
                        this.notificationPreferences = data;
                        this.updateNotificationToggles(data);
                        resolve(data);
                    })
                    .catch(reject);
            } else {
                // Static mode
                setTimeout(() => {
                    // Mock notification preferences
                    const preferences = {
                        emailBookUpdates: true,
                        emailCollabInvites: true,
                        emailComments: true,
                        emailWeeklySummary: true,
                        pushRealtime: true,
                        pushMentions: true,
                        pushDeadlines: true,
                        smsSecurity: true,
                        smsUrgent: false,
                        twoFactor: true,
                        loginAlerts: true
                    };
                    
                    this.notificationPreferences = preferences;
                    this.updateNotificationToggles(preferences);
                    resolve(preferences);
                }, 350);
            }
        });
    }
    
    updateNotificationToggles(preferences) {
        // Update toggle switches based on preferences
        document.querySelectorAll('[data-preference]').forEach(toggle => {
            const prefName = toggle.dataset.preference;
            if (preferences.hasOwnProperty(prefName)) {
                toggle.checked = preferences[prefName];
            }
        });
    }

    savePersonalInfo() {
        if (!this.isEditing) return;
        
        // Get form data
        const form = document.getElementById('personalForm');
        const formData = new FormData(form);
        const userData = {};
        
        formData.forEach((value, key) => {
            userData[key] = value;
        });
        
        // Show saving indicator
        this.showToast('Saving changes...', 'info');
        
        if (this.dataMode === 'api') {
            // Make API call to save data
            fetch('/api/users/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            })
            .then(response => response.json())
            .then(data => {
                // Update local data
                this.userData = {...this.userData, ...userData};
                this.toggleEditMode('personal');
                this.showToast('Profile updated successfully!', 'success');
                
                // Show save confirmation
                this.showSaveConfirmation(form);
            })
            .catch(error => {
                console.error('Error saving profile:', error);
                this.showToast('Failed to update profile. Please try again.', 'error');
            });
        } else {
            // Static mode - simulate API call
            setTimeout(() => {
                // Update local data
                this.userData = {...this.userData, ...userData};
                this.toggleEditMode('personal');
                this.showToast('Profile updated successfully!', 'success');
                
                // Show save confirmation
                this.showSaveConfirmation(form);
            }, 800);
        }
    }
    
    showSaveConfirmation(form) {
        const saveStatus = form.querySelector('.save-status');
        if (saveStatus) {
            saveStatus.innerHTML = '<i class="fas fa-check-circle"></i> Changes saved successfully';
            saveStatus.classList.add('show');
            
            setTimeout(() => {
                saveStatus.classList.remove('show');
            }, 3000);
        }
    }

    handleToggleChange(toggle) {
        const prefName = toggle.dataset.preference;
        const isChecked = toggle.checked;
        
        if (!prefName) return;
        
        // Show status indicator
        this.showToast(`Updating setting...`, 'info');
        
        if (this.dataMode === 'api') {
            // Make API call to update preference
            fetch('/api/users/preferences', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    [prefName]: isChecked
                })
            })
            .then(response => response.json())
            .then(data => {
                // Update local data
                this.notificationPreferences[prefName] = isChecked;
                this.showToast(`Setting updated!`, 'success');
            })
            .catch(error => {
                console.error('Error updating preference:', error);
                this.showToast('Failed to update setting. Please try again.', 'error');
                // Revert toggle state
                toggle.checked = !isChecked;
            });
        } else {
            // Static mode - simulate API call
            setTimeout(() => {
                // Update local data
                this.notificationPreferences[prefName] = isChecked;
                this.showToast(`Setting updated!`, 'success');
            }, 400);
        }
    }

    showPasswordModal() {
        const modal = document.getElementById('passwordModal');
        if (modal) {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
        }
    }

    hidePasswordModal() {
        const modal = document.getElementById('passwordModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            // Reset form
            document.getElementById('passwordForm')?.reset();
        }
    }

    changePassword() {
        const currentPassword = document.getElementById('currentPassword')?.value;
        const newPassword = document.getElementById('newPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;
        
        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showToast('Please fill in all password fields.', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showToast('New passwords do not match.', 'error');
            return;
        }
        
        // Check password strength
        if (newPassword.length < 8) {
            this.showToast('Password must be at least 8 characters long.', 'error');
            return;
        }
        
        // Show loading indicator
        this.showToast('Updating password...', 'info');
        
        if (this.dataMode === 'api') {
            // Make API call to change password
            fetch('/api/users/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            })
            .then(response => response.json())
            .then(data => {
                this.hidePasswordModal();
                this.showToast('Password updated successfully!', 'success');
            })
            .catch(error => {
                console.error('Error changing password:', error);
                this.showToast('Failed to update password. Please check your current password and try again.', 'error');
            });
        } else {
            // Static mode - simulate API call
            setTimeout(() => {
                this.hidePasswordModal();
                this.showToast('Password updated successfully!', 'success');
            }, 800);
        }
    }

    loadActivityHistory() {
        if (this.dataMode === 'api') {
            // Get filter values
            const activityType = document.getElementById('activityType')?.value || 'all';
            const dateRange = document.getElementById('dateRange')?.value || '30';
            
            // Make API call to get activity data
            fetch(`/api/users/activity?type=${activityType}&days=${dateRange}`)
                .then(response => response.json())
                .then(data => {
                    this.activityData = data;
                    this.renderActivityTimeline(data);
                })
                .catch(error => {
                    console.error('Error fetching activity history:', error);
                    this.showToast('Failed to load activity history.', 'error');
                });
        } else {
            // Static mode - use mock data
            setTimeout(() => {
                // Mock activity data
                this.activityData = [
                    {
                        id: 1,
                        type: 'login',
                        title: 'Logged in',
                        description: 'Successful login from Chrome on Windows',
                        time: '2 hours ago',
                        icon: 'fas fa-sign-in-alt'
                    },
                    {
                        id: 2,
                        type: 'submission',
                        title: 'Document submitted',
                        description: 'Submitted "Project Proposal Q1 2024.pdf" for review',
                        time: '5 hours ago',
                        icon: 'fas fa-file-upload'
                    },
                    {
                        id: 3,
                        type: 'collaboration',
                        title: 'Collaboration invite',
                        description: 'Accepted collaboration invite from Alex Davis',
                        time: '1 day ago',
                        icon: 'fas fa-users'
                    },
                    {
                        id: 4,
                        type: 'settings',
                        title: 'Settings updated',
                        description: 'Changed notification preferences',
                        time: '2 days ago',
                        icon: 'fas fa-cog'
                    },
                    {
                        id: 5,
                        type: 'login',
                        title: 'Logged in',
                        description: 'Successful login from iPhone device',
                        time: '3 days ago',
                        icon: 'fas fa-sign-in-alt'
                    }
                ];
                
                this.renderActivityTimeline(this.activityData);
            }, 600);
        }
    }
    
    renderActivityTimeline(activities) {
        const container = document.getElementById('activityTimeline');
        if (!container) return;
        
        if (activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>No activity to display</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        activities.forEach((activity, index) => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.dataset.activityType = activity.type;
            
            activityItem.innerHTML = `
                <div class="activity-icon">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <h4>${activity.title}</h4>
                    <p>${activity.description}</p>
                    <span class="activity-time">${activity.time}</span>
                </div>
            `;
            
            container.appendChild(activityItem);
        });
    }
    
    filterActivityHistory() {
        if (!this.activityData.length) return;
        
        const activityType = document.getElementById('activityType')?.value || 'all';
        const dateRange = document.getElementById('dateRange')?.value || '30';
        
        // In a real app, we'd make a new API call with these filters
        // For the static demo, we'll just filter the existing data
        if (this.dataMode === 'api') {
            this.loadActivityHistory(); // This would include the new filter params
        } else {
            // Filter the activity data client-side
            const filteredActivities = this.activityData.filter(activity => {
                return activityType === 'all' || activity.type === activityType;
                // In a real app, we would also filter by date range
            });
            
            this.renderActivityTimeline(filteredActivities);
        }
    }

    confirmDeleteAccount() {
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            this.showToast('Processing account deletion...', 'warning');
            
            if (this.dataMode === 'api') {
                fetch('/api/users/account', {
                    method: 'DELETE'
                })
                .then(response => {
                    if (response.ok) {
                        this.showToast('Account deleted successfully.', 'success');
                        setTimeout(() => {
                            window.location.href = '/login.html';
                        }, 2000);
                    } else {
                        throw new Error('Failed to delete account');
                    }
                })
                .catch(error => {
                    console.error('Error deleting account:', error);
                    this.showToast('Failed to delete account. Please try again.', 'error');
                });
            } else {
                // Static mode simulation
                setTimeout(() => {
                    this.showToast('Account deleted successfully.', 'success');
                    setTimeout(() => {
                        window.location.href = '/login.html';
                    }, 2000);
                }, 1500);
            }
        }
    }

    exportData() {
        this.showToast('Preparing data export...', 'info');
        
        if (this.dataMode === 'api') {
            fetch('/api/users/export-data')
                .then(response => response.blob())
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'user_data_export.zip';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    this.showToast('Data export downloaded!', 'success');
                })
                .catch(error => {
                    console.error('Error exporting data:', error);
                    this.showToast('Failed to export data. Please try again.', 'error');
                });
        } else {
            // Static mode simulation
            setTimeout(() => {
                this.showToast('Data export downloaded!', 'success');
            }, 1500);
        }
    }

    changeAvatar() {
        // Create a file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        // Trigger file selection
        fileInput.click();
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Check file size and type
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                this.showToast('Image is too large. Maximum size is 5MB.', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const avatarUrl = e.target.result;
                
                // Update UI
                const avatarElement = document.getElementById('userAvatarLarge');
                if (avatarElement) {
                    avatarElement.innerHTML = `<img src="${avatarUrl}" alt="${this.userData.fullName}" />`;
                }
                
                // In a real app, we'd upload the image to the server
                this.showToast('Profile picture updated!', 'success');
                
                if (this.dataMode === 'api') {
                    // Create form data for upload
                    const formData = new FormData();
                    formData.append('avatar', file);
                    
                    fetch('/api/users/avatar', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        this.userData.avatar = data.avatarUrl;
                    })
                    .catch(error => {
                        console.error('Error uploading avatar:', error);
                        this.showToast('Failed to upload image. Please try again.', 'error');
                    });
                }
            };
            
            reader.readAsDataURL(file);
            
            // Clean up
            document.body.removeChild(fileInput);
        });
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            // Create toast container if it doesn't exist
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }
        
        const container = document.getElementById('toastContainer');
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Icon based on type
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="toast-content">
                <p>${message}</p>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add to container
        container.appendChild(toast);
        
        // Show toast with animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        });
        
        // Auto-close after delay
        setTimeout(() => {
            if (container.contains(toast)) {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (container.contains(toast)) {
                        container.removeChild(toast);
                    }
                }, 300);
            }
        }, 5000);
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.profileDashboard = new ProfileManager();
});