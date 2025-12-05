// --- Utility Function for Alerts (replaces window.alert) ---
function showMessage(message, isError = false) {
    const alertDiv = document.createElement('div');
    alertDiv.textContent = message;
    alertDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 1000;
        padding: 15px 25px; border-radius: 8px; font-weight: bold;
        color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        background-color: ${isError ? '#cc0000' : '#007bff'};
        opacity: 0; transition: opacity 0.5s ease-in-out;
    `;
    document.body.appendChild(alertDiv);

    // Fade in
    setTimeout(() => alertDiv.style.opacity = 1, 10);
    // Fade out and remove
    setTimeout(() => {
        alertDiv.style.opacity = 0;
        setTimeout(() => alertDiv.remove(), 500);
    }, 4000);
}

// --- HTML Utility Functions ---

function createChatMessage(text, sender) {
    const historyArea = document.getElementById('chat-history-area');
    if (!historyArea) return; // Prevent errors on non-chat pages

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', `${sender}-message`);
    
    // Create the message content wrapper to handle text and copy button/pre
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('message-content-wrapper');

    const avatar = document.createElement('span');
    avatar.classList.add('avatar');
    avatar.textContent = sender === 'user' ? '🧑' : '🤖';

    // Parse the text to handle code blocks (```...```)
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    parts.forEach(part => {
        if (part.startsWith('```') && part.endsWith('```')) {
            // It's a code block
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            
            // Remove the markdown fences (```) and trim whitespace
            code.textContent = part.substring(3, part.length - 3).trim();
            pre.appendChild(code);
            contentWrapper.appendChild(pre);
        } else if (part.trim().length > 0) {
            // It's regular text or leftover content
            const p = document.createElement('p');
            p.textContent = part;
            contentWrapper.appendChild(p);
        }
    });

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentWrapper);
    
    // Add a copy button only for bot messages that contain code or text
    if (sender === 'bot') {
        const copyButton = document.createElement('button');
        copyButton.classList.add('copy-button');
        copyButton.textContent = 'Copy';
        
        copyButton.addEventListener('click', () => {
            const textToCopy = text.replace(/```/g, '').trim(); // Remove fences for copy
            try {
                // Use the standard clipboard API if available
                navigator.clipboard.writeText(textToCopy);
                copyButton.textContent = 'Copied!';
                setTimeout(() => copyButton.textContent = 'Copy', 2000);
            } catch (err) {
                // Fallback for older browsers or restricted environments (like Canvas/iframe)
                const textarea = document.createElement('textarea');
                textarea.value = textToCopy;
                textarea.style.position = 'fixed'; 
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                    document.execCommand('copy');
                    copyButton.textContent = 'Copied!';
                    setTimeout(() => copyButton.textContent = 'Copy', 2000);
                } catch (e) {
                    showMessage("Failed to copy text. Please select and copy manually.", true);
                }
                document.body.removeChild(textarea);
            }
        });
        messageDiv.appendChild(copyButton);
    }


    historyArea.appendChild(messageDiv);
    // Scroll to the latest message
    historyArea.scrollTop = historyArea.scrollHeight;
}

function updateLoadingState(isLoading) {
    const sendButton = document.getElementById('send-button');
    const inputField = document.getElementById('chat-input');
    if (sendButton && inputField) {
        sendButton.disabled = isLoading;
        inputField.disabled = isLoading;
        sendButton.textContent = isLoading ? 'Thinking...' : 'Send';
        sendButton.classList.toggle('loading', isLoading);
    }
}

// --- Authentication Logic ---

async function handleApiCall(endpoint, method = 'POST', data = null) {
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(endpoint, options);
        const result = await response.json();

        if (response.ok) {
            showMessage(result.message || "Success!");
            return result;
        } else {
            showMessage(result.message || `Error: ${response.statusText}`, true);
            return null;
        }
    } catch (error) {
        console.error('API Call Failed:', error);
        showMessage("Network error. Please try again.", true);
        return null;
    }
}

// --- Initialization and Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    
    // ----------------------------------------------------
    // A. Logic for index.html (Login/Register/Forgot Password)
    // ----------------------------------------------------

    const path = window.location.pathname;

    if (path.endsWith('/') || path.endsWith('index.html')) {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const forgotForm = document.getElementById('forgot-form');
        
        // Form/View Switching Logic
        const forms = { 'login': loginForm, 'register': registerForm, 'forgot': forgotForm };
        
        document.querySelectorAll('.switch-link a, .forgot-link a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                Object.values(forms).forEach(f => f.classList.add('hidden'));
                Object.values(forms).forEach(f => f.classList.remove('active'));

                if (e.target.id.includes('register')) {
                    registerForm.classList.remove('hidden');
                    registerForm.classList.add('active');
                } else if (e.target.id.includes('login')) {
                    loginForm.classList.remove('hidden');
                    loginForm.classList.add('active');
                } else if (e.target.id.includes('forgot')) {
                    forgotForm.classList.remove('hidden');
                    forgotForm.classList.add('active');
                }
            });
        });

        // 1. Login Handler
        document.getElementById('login-form-submit')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target[0].value;
            const password = e.target[1].value;
            const result = await handleApiCall('/api/login', 'POST', { email, password });
            if (result && result.redirect) {
                window.location.href = result.redirect;
            }
        });

        // 2. Register Handler
        document.getElementById('register-form-submit')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const result = await handleApiCall('/api/register', 'POST', { email, password });
            if (result) {
                // Switch back to login on successful registration
                loginForm.classList.remove('hidden');
                loginForm.classList.add('active');
                registerForm.classList.add('hidden');
                registerForm.classList.remove('active');
            }
        });

        // 3. Forgot Password / Verification Handler
        const forgotFormSubmit = document.getElementById('forgot-password-form');
        const resetCodeInput = document.getElementById('reset-code-input');
        const forgotSubmitButton = document.getElementById('forgot-submit-button');
        const forgotEmailInput = document.getElementById('forgot-email');
        let codeSent = false;

        forgotFormSubmit?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = forgotEmailInput.value;
            
            if (!codeSent) {
                // Step 1: Request reset code
                const result = await handleApiCall('/api/forgot_password', 'POST', { email });
                if (result) {
                    codeSent = true;
                    // Switch UI to code input mode
                    forgotSubmitButton.textContent = 'Verify Code';
                    forgotEmailInput.disabled = true;
                    resetCodeInput.classList.remove('hidden');
                    document.getElementById('forgot-message').textContent = `A 6-digit code has been sent to ${email}.`;
                }
            } else {
                // Step 2: Verify code
                const code = resetCodeInput.value;
                if (code.length === 6) {
                    const result = await handleApiCall('/api/verify_code', 'POST', { email, code });
                    if (result && result.redirect) {
                        window.location.href = result.redirect; // Redirect to reset.html
                    }
                } else {
                    showMessage("Please enter the full 6-digit code.", true);
                }
            }
        });
    }

    // ----------------------------------------------------
    // B. Logic for reset.html
    // ----------------------------------------------------

    if (path.endsWith('/reset.html')) {
        document.getElementById('reset-password-form-final')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (newPassword !== confirmPassword) {
                showMessage("Passwords do not match.", true);
                return;
            }
            if (newPassword.length < 6) {
                showMessage("Password must be at least 6 characters.", true);
                return;
            }

            const result = await handleApiCall('/api/reset_password', 'POST', { password: newPassword });
            if (result) {
                // Redirect back to login after successful reset
                window.location.href = '/'; 
            }
        });
    }

    // ----------------------------------------------------
    // C. Logic for home.html (Chat Interface)
    // ----------------------------------------------------

    if (path.endsWith('/home.html')) {
        const welcomeContainer = document.getElementById('welcome-container');
        const chatInterface = document.getElementById('chat-interface');
        const continueButton = document.getElementById('continue-button');
        const logoutButton = document.getElementById('logout-button');
        const newChatButton = document.getElementById('new-chat-button');
        const userEmailDisplay = document.getElementById('user-email-display');
        const chatForm = document.getElementById('chat-form');

        // Initial Auth Check
        fetch('/api/check_auth')
            .then(res => res.json())
            .then(data => {
                if (!data.authenticated) {
                    window.location.href = '/'; // Not authenticated, redirect to login
                } else {
                    // Authenticated, update UI
                    userEmailDisplay.textContent = data.email || 'User';
                    logoutButton.classList.remove('hidden');
                }
            })
            .catch(() => window.location.href = '/');

        // Continue Button to switch to chat view
        continueButton?.addEventListener('click', () => {
            welcomeContainer.style.display = 'none';
            chatInterface.classList.remove('hidden-chat-section');
        });

        // Logout Handler
        logoutButton?.addEventListener('click', async () => {
            const result = await handleApiCall('/api/logout', 'POST');
            if (result) {
                window.location.href = '/'; 
            }
        });

        // New Chat Handler
        newChatButton?.addEventListener('click', async () => {
            // Confirmation is better here than just an alert
            if (window.confirm("Are you sure you want to start a new chat? Your current history will be cleared.")) {
                const result = await handleApiCall('/api/new_chat', 'POST');
                if (result) {
                    const historyArea = document.getElementById('chat-history-area');
                    historyArea.innerHTML = `
                        <div class="chat-message bot-message">
                            <span class="avatar">🤖</span>
                            <p>Hello! I am your AI assistant. How can I help you today?</p>
                        </div>
                    `;
                    showMessage("New chat started!");
                }
            }
        });
        
        // Chat Form Handler
        chatForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputField = document.getElementById('chat-input');
            const message = inputField.value.trim();

            if (!message) return;

            // 1. Display user message
            createChatMessage(message, 'user');
            inputField.value = ''; // Clear input
            updateLoadingState(true);

            // 2. Placeholder for bot response (optional but good UX)
            // Note: Since we use createChatMessage in the success block, we skip a placeholder here.

            // 3. Send message to API
            try {
                const result = await handleApiCall('/api/chat', 'POST', { message });
                if (result && result.response) {
                    createChatMessage(result.response, 'bot');
                } else {
                    createChatMessage("Server Error: Failed to get a valid response from the AI.", 'bot');
                }
            } catch (error) {
                createChatMessage("Network Error: Could not reach the server.", 'bot');
            } finally {
                updateLoadingState(false);
            }
        });

        // Theme Toggle Logic
        const modeToggle = document.getElementById('mode-toggle');
        const currentTheme = localStorage.getItem('theme') || 'dark';

        document.body.setAttribute('data-theme', currentTheme);
        modeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

        modeToggle.addEventListener('click', () => {
            const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            modeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        });

    }
});