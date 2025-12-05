from flask import Flask, request, jsonify, redirect, url_for, session, render_template
import random
import time
import os
import requests
from werkzeug.security import generate_password_hash, check_password_hash

# --- Flask Initialization ---
app = Flask(__name__, static_folder='static')
app.secret_key = 'your_super_secret_key_for_session' # In a real app, use a strong key from environment

# --- Gemini API Configuration ---
# NOTE: The provided key is used as a fallback. In a production environment, 
# always use environment variables.
FALLBACK_API_KEY = "AIzaSyBTQF_1OzD_q7UWoCalysN3E04oeiOlaqc"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", FALLBACK_API_KEY)
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key={GEMINI_API_KEY}"

# --- Database Simulation (In-Memory Dictionary) ---
USERS = {}
# Stores {email: {'code': '12345', 'expiry': 123456789}}
RESET_TOKENS = {} 
# Stores chat history: {session_id: chat_history_array}
CHATS = {}

# --- Utility Functions ---
def generate_reset_code():
    return str(random.randint(100000, 999999))

def simulate_send_email(email, subject, body):
    print(f"\n--- SIMULATED EMAIL SENT to {email} ---")
    print(f"Subject: {subject}")
    print(f"Body: {body}")
    print("-----------------------------------------\n")

def get_user_chat_session():
    """Gets the unique chat history ID for the current user's session."""
    if 'chat_id' not in session:
        session['chat_id'] = str(random.randint(1000000000, 9999999999))
        CHATS[session['chat_id']] = []
    return session['chat_id']

# --- Routing ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/home.html')
def home():
    # Authentication check for the home page (optional but good practice)
    if not session.get('logged_in'):
        return redirect(url_for('index'))
    return render_template('home.html') 

@app.route('/reset.html')
def reset_page():
    # Only render this page if the user is authorized from the verification step
    if session.get('reset_email'):
        return render_template('reset.html')
    return redirect(url_for('index'))

# --- API Endpoints (Authentication) ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    if not email or not password: return jsonify({"message": "Missing email or password"}), 400
    if email in USERS: return jsonify({"message": "User already exists"}), 409
    hashed_password = generate_password_hash(password)
    USERS[email] = {'password_hash': hashed_password}
    print(f"User Registered: {email}. Current users: {list(USERS.keys())}")
    return jsonify({"message": "Registration successful! You can now log in."}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    if email not in USERS: return jsonify({"message": "Invalid email or password"}), 401
    user_data = USERS[email]
    if check_password_hash(user_data['password_hash'], password):
        session['logged_in'] = True
        session['email'] = email
        # Clear existing chat history when a new user logs in
        session.pop('chat_id', None)
        return jsonify({"message": "Login successful", "redirect": "/home.html"}), 200
    else: return jsonify({"message": "Invalid email or password"}), 401

@app.route('/api/forgot_password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email')
    
    if email in USERS:
        code = generate_reset_code()
        expiry_time = time.time() + 300 # 5 minutes
        RESET_TOKENS[email] = {'code': code, 'expiry': expiry_time}
        simulate_send_email(email, "Password Reset Code", f"Your reset code is: {code}. It is valid for 5 minutes.")

    return jsonify({"message": "If the email is registered, a reset code has been sent."}), 200

@app.route('/api/verify_code', methods=['POST'])
def verify_code():
    data = request.json
    email = data.get('email')
    code = data.get('code')

    token_data = RESET_TOKENS.get(email)

    if not token_data:
        return jsonify({"message": "Invalid email or reset process expired."}), 400
    
    if token_data['expiry'] < time.time():
        del RESET_TOKENS[email] 
        return jsonify({"message": "Reset code has expired. Please try again."}), 400

    if token_data['code'] == code:
        session['reset_email'] = email
        del RESET_TOKENS[email] # Token consumed on successful verification
        return jsonify({"message": "Code verified successfully.", "redirect": "/reset.html"}), 200
    else:
        return jsonify({"message": "Invalid reset code."}), 400

@app.route('/api/reset_password', methods=['POST'])
def reset_password():
    data = request.json
    new_password = data.get('password')
    
    email = session.pop('reset_email', None) 
    
    if not email:
        return jsonify({"message": "Reset authorization failed. Please restart the process."}), 401
    
    if not new_password:
        return jsonify({"message": "New password cannot be empty."}), 400

    hashed_password = generate_password_hash(new_password)
    USERS[email]['password_hash'] = hashed_password
    
    print(f"Password successfully reset for: {email}")

    return jsonify({"message": "Password updated successfully! You can now log in."}), 200

@app.route('/api/check_auth', methods=['GET'])
def check_auth():
    if session.get('logged_in'):
        return jsonify({"authenticated": True, "email": session.get('email')}), 200
    return jsonify({"authenticated": False}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    # Clear all session data related to auth and chat
    session.pop('logged_in', None)
    session.pop('email', None)
    chat_id = session.pop('chat_id', None)
    if chat_id in CHATS:
        del CHATS[chat_id]
    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/api/new_chat', methods=['POST'])
def new_chat():
    session.pop('chat_id', None)
    # The next chat call will automatically generate a new ID and history
    return jsonify({"message": "New chat started"}), 200

# --- API Endpoints (Chat) ---

@app.route('/api/chat', methods=['POST'])
def chat():
    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key not configured on the server."}), 500
    
    user_message = request.json.get('message')
    if not user_message:
        return jsonify({"error": "Missing message content"}), 400

    chat_id = get_user_chat_session()
    
    # Append the new user message to the history
    CHATS[chat_id].append({"role": "user", "parts": [{"text": user_message}]})
    
    # Prepare the payload for the Gemini API call
    payload = {
        "contents": CHATS[chat_id]
    }

    try:
        # Make the API call to Gemini
        response = requests.post(GEMINI_API_URL, json=payload)
        response.raise_for_status() # Raise an exception for bad status codes
        
        gemini_response = response.json()
        
        # Extract the generated text
        candidate = gemini_response.get('candidates', [{}])[0]
        bot_text = candidate.get('content', {}).get('parts', [{}])[0].get('text', 'An error occurred or the response was blocked.')
        
        # Append the model's response to the history
        CHATS[chat_id].append({"role": "model", "parts": [{"text": bot_text}]})

        return jsonify({"response": bot_text}), 200

    except requests.exceptions.RequestException as e:
        print(f"API Request Error: {e}")
        return jsonify({"error": f"Failed to communicate with the AI model: {e}"}), 500
    except Exception as e:
        print(f"General Error: {e}")
        return jsonify({"error": "An unexpected error occurred while processing the response."}), 500


if __name__ == '__main__':
    # Tell Flask to listen on ALL network interfaces (0.0.0.0)
    app.run(debug=True, host='0.0.0.0')