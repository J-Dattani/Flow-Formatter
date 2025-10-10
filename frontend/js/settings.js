class SettingsManager {
    constructor() {
        this.settings = {};
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Logout functionality
        document.getElementById('logoutBtn2').addEventListener('click', () => {
            AuthSystem.logout();
        });
    }

    async loadSettings() {
        try {
            this.settings = await API.getSettings();
            this.populateSettingsForms();
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showToast('Error loading settings', 'error');
        }
    }

    populateSettingsForms() {
        // Populate form fields with current settings
        if (this.settings.general) {
            const general = this.settings.general;
            if (general.systemName) document.getElementById('systemName').value = general.systemName;
            if (general.systemLanguage) document.getElementById('systemLanguage').value = general.systemLanguage;
            if (general.timezone) document.getElementById('timezone').value = general.timezone;
            if (general.dateFormat) document.getElementById('dateFormat').value = general.dateFormat;
            if (general.autoSave !== undefined) document.getElementById('autoSave').checked = general.autoSave;
            if (general.emailNotifications !== undefined) document.getElementById('emailNotifications').checked = general.emailNotifications;
            if (general.publicTemplates !== undefined) document.getElementById('publicTemplates').checked = general.publicTemplates;
            if (general.analyticsTracking !== undefined) document.getElementById('analyticsTracking').checked = general.analyticsTracking;
        }

        if (this.settings.profile) {
            const profile = this.settings.profile;
            if (profile.firstName) document.getElementById('firstName').value = profile.firstName;
            if (profile.lastName) document.getElementById('lastName').value = profile.lastName;
            if (profile.email) document.getElementById('email').value = profile.email;
            if (profile.phone) document.getElementById('phone').value = profile.phone;
            if (profile.department) document.getElementById('department').value = profile.department;
            if (profile.bio) document.getElementById('bio').value = profile.bio;
        }

        if (this.settings.templates) {
            const templates = this.settings.templates;
            if (templates.defaultTemplate) document.getElementById('defaultTemplate').value = templates.defaultTemplate;
            if (templates.maxFileSize) document.getElementById('maxFileSize').value = templates.maxFileSize;
            if (templates.templateExpiry) document.getElementById('templateExpiry').value = templates.templateExpiry;
            if (templates.versionControl !== undefined) document.getElementById('versionControl').checked = templates.versionControl;
            if (templates.templateSharing !== undefined) document.getElementById('templateSharing').checked = templates.templateSharing;
            if (templates.autoBackup !== undefined) document.getElementById('autoBackup').checked = templates.autoBackup;
            if (templates.templateComments !== undefined) document.getElementById('templateComments').checked = templates.templateComments;
        }

        if (this.settings.notifications) {
            const notifications = this.settings.notifications;
            if (notifications.newSubmission !== undefined) document.getElementById('newSubmission').checked = notifications.newSubmission;
            if (notifications.statusChanges !== undefined) document.getElementById('statusChanges').checked = notifications.statusChanges;
            if (notifications.newUsers !== undefined) document.getElementById('newUsers').checked = notifications.newUsers;
            if (notifications.systemAlerts !== undefined) document.getElementById('systemAlerts').checked = notifications.systemAlerts;
            if (notifications.weeklyReports !== undefined) document.getElementById('weeklyReports').checked = notifications.weeklyReports;
            if (notifications.marketingEmails !== undefined) document.getElementById('marketingEmails').checked = notifications.marketingEmails;
            if (notifications.browserNotifications !== undefined) document.getElementById('browserNotifications').checked = notifications.browserNotifications;
            if (notifications.soundNotifications !== undefined) document.getElementById('soundNotifications').checked = notifications.soundNotifications;
            if (notifications.notificationFrequency) document.getElementById('notificationFrequency').value = notifications.notificationFrequency;
        }

        if (this.settings.security) {
            const security = this.settings.security;
            if (security.enable2FA !== undefined) document.getElementById('enable2FA').checked = security.enable2FA;
            if (security.sessionTimeout) document.getElementById('sessionTimeout').value = security.sessionTimeout;
            if (security.rememberDevice !== undefined) document.getElementById('rememberDevice').checked = security.rememberDevice;
            if (security.loginAlerts !== undefined) document.getElementById('loginAlerts').checked = security.loginAlerts;
            if (security.suspiciousActivity !== undefined) document.getElementById('suspiciousActivity').checked = security.suspiciousActivity;
        }

        if (this.settings.integrations) {
            const integrations = this.settings.integrations;
            if (integrations.googleDrive !== undefined) document.getElementById('googleDrive').checked = integrations.googleDrive;
            if (integrations.dropbox !== undefined) document.getElementById('dropbox').checked = integrations.dropbox;
            if (integrations.slack !== undefined) document.getElementById('slack').checked = integrations.slack;
            if (integrations.microsoft365 !== undefined) document.getElementById('microsoft365').checked = integrations.microsoft365;
        }

        if (this.settings.backup) {
            const backup = this.settings.backup;
            if (backup.autoBackups !== undefined) document.getElementById('autoBackups').checked = backup.autoBackups;
            if (backup.backupFrequency) document.getElementById('backupFrequency').value = backup.backupFrequency;
            if (backup.backupRetention) document.getElementById('backupRetention').value = backup.backupRetention;
        }
    }

    async saveAllSettings() {
        try {
            const updatedSettings = {
                general: this.collectGeneralSettings(),
                profile: this.collectProfileSettings(),
                templates: this.collectTemplateSettings(),
                notifications: this.collectNotificationSettings(),
                security: this.collectSecuritySettings(),
                integrations: this.collectIntegrationSettings(),
                backup: this.collectBackupSettings()
            };

            await API.updateSettings(updatedSettings);
            this.settings = updatedSettings;
            this.showToast('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showToast('Error saving settings', 'error');
        }
    }

    collectGeneralSettings() {
        return {
            systemName: document.getElementById('systemName').value,
            systemLanguage: document.getElementById('systemLanguage').value,
            timezone: document.getElementById('timezone').value,
            dateFormat: document.getElementById('dateFormat').value,
            autoSave: document.getElementById('autoSave').checked,
            emailNotifications: document.getElementById('emailNotifications').checked,
            publicTemplates: document.getElementById('publicTemplates').checked,
            analyticsTracking: document.getElementById('analyticsTracking').checked
        };
    }

    collectProfileSettings() {
        return {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            department: document.getElementById('department').value,
            bio: document.getElementById('bio').value
        };
    }

    collectTemplateSettings() {
        return {
            defaultTemplate: document.getElementById('defaultTemplate').value,
            maxFileSize: parseInt(document.getElementById('maxFileSize').value),
            templateExpiry: parseInt(document.getElementById('templateExpiry').value),
            versionControl: document.getElementById('versionControl').checked,
            templateSharing: document.getElementById('templateSharing').checked,
            autoBackup: document.getElementById('autoBackup').checked,
            templateComments: document.getElementById('templateComments').checked,
            allowedFormats: {
                pdf: document.getElementById('formatPDF').checked,
                docx: document.getElementById('formatDOCX').checked,
                html: document.getElementById('formatHTML').checked
            }
        };
    }

    collectNotificationSettings() {
        return {
            newSubmission: document.getElementById('newSubmission').checked,
            statusChanges: document.getElementById('statusChanges').checked,
            newUsers: document.getElementById('newUsers').checked,
            systemAlerts: document.getElementById('systemAlerts').checked,
            weeklyReports: document.getElementById('weeklyReports').checked,
            marketingEmails: document.getElementById('marketingEmails').checked,
            browserNotifications: document.getElementById('browserNotifications').checked,
            soundNotifications: document.getElementById('soundNotifications').checked,
            notificationFrequency: document.getElementById('notificationFrequency').value
        };
    }

    collectSecuritySettings() {
        const securitySettings = {
            enable2FA: document.getElementById('enable2FA').checked,
            sessionTimeout: parseInt(document.getElementById('sessionTimeout').value),
            rememberDevice: document.getElementById('rememberDevice').checked,
            loginAlerts: document.getElementById('loginAlerts').checked,
            suspiciousActivity: document.getElementById('suspiciousActivity').checked
        };

        // Only include password if it's being changed
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (currentPassword && newPassword && confirmPassword) {
            if (newPassword !== confirmPassword) {
                this.showToast('New passwords do not match', 'error');
                return null;
            }
            securitySettings.passwordChange = {
                currentPassword,
                newPassword
            };
        }

        return securitySettings;
    }

    collectIntegrationSettings() {
        return {
            googleDrive: document.getElementById('googleDrive').checked,
            dropbox: document.getElementById('dropbox').checked,
            slack: document.getElementById('slack').checked,
            microsoft365: document.getElementById('microsoft365').checked
        };
    }

    collectBackupSettings() {
        return {
            autoBackups: document.getElementById('autoBackups').checked,
            backupFrequency: document.getElementById('backupFrequency').value,
            backupRetention: parseInt(document.getElementById('backupRetention').value)
        };
    }

    showToast(message, type = 'info') {
        // Create toast if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }

        const toastHTML = `
            <div class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        const toastElement = toastContainer.lastElementChild;
        const toast = new bootstrap.Toast(toastElement);
        toast.show();

        // Remove toast element after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}

// Global functions
function showSettingsSection(sectionName, linkElement) {
    // Hide all sections
    document.querySelectorAll('.settings-section').forEach(section => {
        section.style.display = 'none';
    });

    // Remove active class from all links
    document.querySelectorAll('.list-group-item').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionName + '-settings').style.display = 'block';

    // Add active class to clicked link
    linkElement.classList.add('active');
}

function saveAllSettings() {
    settingsManager.saveAllSettings();
}

function createBackup() {
    settingsManager.showToast('Creating backup...', 'info');
    
    // Simulate backup creation
    setTimeout(() => {
        settingsManager.showToast('Backup created successfully!', 'success');
        
        // In a real app, this would trigger a download
        const backupData = {
            timestamp: new Date().toISOString(),
            settings: settingsManager.settings,
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 2000);
}

function exportData(format) {
    settingsManager.showToast(`Exporting data as ${format.toUpperCase()}...`, 'info');
    
    setTimeout(() => {
        settingsManager.showToast(`Data exported as ${format.toUpperCase()} successfully!`, 'success');
    }, 1500);
}

function importData() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    
    if (!file) {
        settingsManager.showToast('Please select a file to import', 'error');
        return;
    }
    
    settingsManager.showToast('Importing data...', 'info');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            // Process imported data here
            settingsManager.showToast('Data imported successfully!', 'success');
            fileInput.value = '';
        } catch (error) {
            settingsManager.showToast('Error importing data: Invalid file format', 'error');
        }
    };
    reader.readAsText(file);
}

function resetAllSettings() {
    if (confirm('Are you sure you want to reset all settings to default? This action cannot be undone.')) {
        settingsManager.showToast('Resetting all settings...', 'info');
        
        setTimeout(() => {
            // Reset all form fields to defaults
            location.reload();
        }, 1500);
    }
}

function deleteAllData() {
    const confirmation = prompt('Type "DELETE ALL DATA" to confirm this irreversible action:');
    
    if (confirmation === 'DELETE ALL DATA') {
        settingsManager.showToast('Deleting all data...', 'info');
        
        setTimeout(() => {
            settingsManager.showToast('All data has been deleted', 'success');
            // In a real app, this would clear all data and redirect to setup
        }, 2000);
    } else if (confirmation !== null) {
        settingsManager.showToast('Confirmation text did not match', 'error');
    }
}

// Initialize when page loads
let settingsManager;
document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
});