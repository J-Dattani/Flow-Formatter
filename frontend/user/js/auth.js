document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value;
            
            if (email === 'admin@example.com') {
                window.location.href = '../admin/dashboard.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        });
    }
});
