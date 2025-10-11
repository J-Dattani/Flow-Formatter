// Contact Support Page JavaScript

class ContactDashboard {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupFileUpload();
        this.setMinDate();
        this.initializeAnimations();
    }

    bindEvents() {
        // Form submissions
        const generalForm = document.getElementById('generalSupportForm');
        const formattingForm = document.getElementById('formattingRequestForm');

        if (generalForm) {
            generalForm.addEventListener('submit', (e) => this.handleGeneralSupport(e));
        }

        if (formattingForm) {
            formattingForm.addEventListener('submit', (e) => this.handleFormattingRequest(e));
        }

        // Click events
        document.addEventListener('click', (e) => {
            // Logout button
            if (e.target.closest('.logout-btn')) {
                this.handleLogout();
            }

            // Notification button
            if (e.target.closest('.notification-btn')) {
                this.showNotifications();
            }
        });
    }

    setupFileUpload() {
        // General support file upload
        this.setupFileUploadArea('generalFileUpload', 'generalAttachments', 'generalUploadedFiles');
        
        // Book formatting file upload
        this.setupFileUploadArea('bookFileUpload', 'bookFiles', 'bookUploadedFiles');
    }

    setupFileUploadArea(areaId, inputId, containerId) {
        const uploadArea = document.getElementById(areaId);
        const fileInput = document.getElementById(inputId);
        const container = document.getElementById(containerId);

        if (!uploadArea || !fileInput || !container) return;

        // Click to browse
        uploadArea.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files, containerId, areaId === 'bookFileUpload');
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files, containerId, areaId === 'bookFileUpload');
        });
    }

    handleFiles(files, containerId, isBookUpload = false) {
        const container = document.getElementById(containerId);
        
        Array.from(files).forEach(file => {
            if (this.validateFile(file, isBookUpload)) {
                this.addUploadedFile(file, container);
            }
        });
    }

    validateFile(file, isBookUpload = false) {
        const allowedTypes = isBookUpload 
            ? ['application/pdf', 'application/msword', 
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
               'text/plain']
            : ['application/pdf', 'application/msword', 
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
               'text/plain', 'image/png', 'image/jpeg', 'image/jpg'];
        
        const maxSize = isBookUpload ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB for books, 10MB for general

        if (!allowedTypes.includes(file.type)) {
            const allowedFormats = isBookUpload 
                ? 'PDF, DOC, DOCX, TXT' 
                : 'PDF, DOC, DOCX, TXT, PNG, JPG';
            this.showToast('error', 'Invalid File Type', `Please upload ${allowedFormats} files only`);
            return false;
        }

        if (file.size > maxSize) {
            const maxSizeMB = isBookUpload ? '50MB' : '10MB';
            this.showToast('error', 'File Too Large', `Please upload files smaller than ${maxSizeMB}`);
            return false;
        }

        return true;
    }

    addUploadedFile(file, container) {
        const fileId = Date.now() + Math.random();
        
        const fileElement = document.createElement('div');
        fileElement.className = 'uploaded-file';
        fileElement.dataset.fileId = fileId;
        
        fileElement.innerHTML = `
            <div class="uploaded-file-info">
                <div class="uploaded-file-icon">
                    <i class="fas fa-file-${this.getFileIcon(file.type)}"></i>
                </div>
                <div class="uploaded-file-details">
                    <p class="uploaded-file-name">${file.name}</p>
                    <p class="uploaded-file-size">${this.formatFileSize(file.size)}</p>
                </div>
            </div>
            <button type="button" class="remove-file" onclick="contactDashboard.removeFile('${fileId}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(fileElement);
    }

    getFileIcon(type) {
        const icons = {
            'application/pdf': 'pdf',
            'application/msword': 'word',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
            'text/plain': 'alt',
            'image/png': 'image',
            'image/jpeg': 'image',
            'image/jpg': 'image'
        };
        return icons[type] || 'file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removeFile(fileId) {
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileElement) {
            fileElement.remove();
        }
    }

    setMinDate() {
        const deadlineInput = document.getElementById('deadline');
        if (deadlineInput) {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            deadlineInput.min = tomorrow.toISOString().split('T')[0];
        }
    }

    handleGeneralSupport(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const supportData = {
            category: formData.get('category'),
            priority: formData.get('priority'),
            subject: formData.get('subject'),
            message: formData.get('message')
        };

        // Validate form
        if (!this.validateGeneralSupportForm(supportData)) {
            return;
        }

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        submitBtn.disabled = true;

        // Simulate form submission
        setTimeout(() => {
            this.showToast('success', 'Message Sent', 'Your support request has been submitted. We\'ll get back to you within 24 hours.');
            e.target.reset();
            document.getElementById('generalUploadedFiles').innerHTML = '';
            
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }, 2000);
    }

    validateGeneralSupportForm(data) {
        if (!data.category) {
            this.showToast('error', 'Validation Error', 'Please select a category');
            return false;
        }
        
        if (!data.priority) {
            this.showToast('error', 'Validation Error', 'Please select a priority level');
            return false;
        }
        
        if (!data.subject.trim()) {
            this.showToast('error', 'Validation Error', 'Please enter a subject');
            return false;
        }
        
        if (!data.message.trim()) {
            this.showToast('error', 'Validation Error', 'Please enter a message');
            return false;
        }

        return true;
    }

    handleFormattingRequest(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const requestData = {
            bookTitle: formData.get('bookTitle'),
            bookType: formData.get('bookType'),
            pageCount: formData.get('pageCount'),
            specialRequirements: formData.get('specialRequirements'),
            budget: formData.get('budget'),
            deadline: formData.get('deadline')
        };

        // Get selected formatting options
        const formattingOptions = Array.from(document.querySelectorAll('input[name="formatting"]:checked'))
            .map(checkbox => checkbox.value);
        requestData.formatting = formattingOptions;

        // Validate form
        if (!this.validateFormattingRequest(requestData)) {
            return;
        }

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        // Simulate form submission
        setTimeout(() => {
            this.showToast('success', 'Quote Request Sent', 'Your formatting request has been submitted. We\'ll send you a detailed quote within 24 hours.');
            e.target.reset();
            document.getElementById('bookUploadedFiles').innerHTML = '';
            
            // Reset checkboxes
            document.querySelectorAll('input[name="formatting"]').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }, 2500);
    }

    validateFormattingRequest(data) {
        if (!data.bookTitle.trim()) {
            this.showToast('error', 'Validation Error', 'Please enter a book title');
            return false;
        }
        
        if (!data.bookType) {
            this.showToast('error', 'Validation Error', 'Please select a book type');
            return false;
        }
        
        if (data.formatting.length === 0) {
            this.showToast('error', 'Validation Error', 'Please select at least one formatting requirement');
            return false;
        }

        const uploadedFiles = document.querySelectorAll('#bookUploadedFiles .uploaded-file');
        if (uploadedFiles.length === 0) {
            this.showToast('error', 'Validation Error', 'Please upload your book files for review');
            return false;
        }

        return true;
    }

    startLiveChat() {
        this.showToast('info', 'Starting Live Chat', 'Connecting you with a support agent...');
        
        // Simulate chat initialization
        setTimeout(() => {
            this.showToast('success', 'Chat Connected', 'You are now connected with Sarah from our support team!');
        }, 2000);
    }

    scrollToEmailForm() {
        const emailForm = document.getElementById('generalSupportForm');
        if (emailForm) {
            emailForm.scrollIntoView({ behavior: 'smooth' });
            // Focus on the first input
            setTimeout(() => {
                const firstInput = emailForm.querySelector('select');
                if (firstInput) firstInput.focus();
            }, 500);
        }
    }

    toggleFAQ(element) {
        const faqItem = element.closest('.faq-item');
        const isActive = faqItem.classList.contains('active');
        
        // Close all FAQ items
        document.querySelectorAll('.faq-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Open the clicked item if it wasn't active
        if (!isActive) {
            faqItem.classList.add('active');
        }
    }

    showNotifications() {
        const notifications = [
            { type: 'info', title: 'Support Update', message: 'Your formatting request #12345 is being reviewed' },
            { type: 'success', title: 'Quote Ready', message: 'Your formatting quote for "My Book" is ready' },
            { type: 'warning', title: 'Response Needed', message: 'Please respond to support ticket #67890' }
        ];

        notifications.forEach((notif, index) => {
            setTimeout(() => {
                this.showToast(notif.type, notif.title, notif.message);
            }, index * 1000);
        });
    }

    handleLogout() {
        this.showToast('info', 'Logging out...', 'Redirecting to login page');
        setTimeout(() => {
            window.location.href = '../admin/index.html';
        }, 2000);
    }

    showToast(type, title, message) {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add close event
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        toastContainer.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto remove after 6 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 6000);
    }

    initializeAnimations() {
        // Animate support cards
        const supportCards = document.querySelectorAll('.support-card');
        supportCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 200);
        });

        // Animate form sections
        const formSections = document.querySelectorAll('.form-section');
        formSections.forEach((section, index) => {
            section.style.opacity = '0';
            section.style.transform = 'translateY(30px)';
            
            setTimeout(() => {
                section.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
                section.style.opacity = '1';
                section.style.transform = 'translateY(0)';
            }, 600 + index * 300);
        });

        // Animate FAQ section
        const faqSection = document.querySelector('.faq-section');
        if (faqSection) {
            faqSection.style.opacity = '0';
            faqSection.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                faqSection.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                faqSection.style.opacity = '1';
                faqSection.style.transform = 'translateY(0)';
            }, 1200);
        }

        // Animate contact info section
        const contactInfo = document.querySelector('.contact-info-section');
        if (contactInfo) {
            contactInfo.style.opacity = '0';
            contactInfo.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                contactInfo.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                contactInfo.style.opacity = '1';
                contactInfo.style.transform = 'translateY(0)';
            }, 1500);
        }
    }
}

// Initialize contact dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.contactDashboard = new ContactDashboard();
});

// Global functions for onclick handlers
function removeFile(fileId) {
    window.contactDashboard.removeFile(fileId);
}