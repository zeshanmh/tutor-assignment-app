"""Authentication and authorization logic"""
import random
import string
import smtplib
import json
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional, Dict
from flask import current_app

# In-memory storage for verification codes (use Redis in production)
verification_codes: Dict[str, Dict] = {}
# Persisted verification status (survives backend restarts)
PERSISTED_VERIFICATION_CACHE: Dict[str, Dict] = {}


def _get_store_path() -> str:
    """Path for persisted verification store"""
    base = os.path.dirname(__file__)
    default_path = os.path.join(base, 'verification_store.json')
    try:
        return current_app.config.get('VERIFICATION_STORE_PATH', default_path)
    except Exception:
        return default_path


def _load_verified_store(force_reload: bool = False) -> Dict[str, Dict]:
    """Load persisted verification data from disk"""
    global PERSISTED_VERIFICATION_CACHE
    if PERSISTED_VERIFICATION_CACHE and not force_reload:
        return PERSISTED_VERIFICATION_CACHE

    path = _get_store_path()
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                data = json.load(f) or {}
            # Normalize datetime strings back to datetime
            for email, record in data.items():
                if 'verified_at' in record and isinstance(record['verified_at'], str):
                    record['verified_at'] = datetime.fromisoformat(record['verified_at'])
            PERSISTED_VERIFICATION_CACHE = data
            print(f"[AUTH] Loaded verification store: {len(data)} verified emails")
            return data
        except Exception as e:
            print(f"[AUTH] Warning: failed to load verification store {path}: {e}")
    PERSISTED_VERIFICATION_CACHE = {}
    return PERSISTED_VERIFICATION_CACHE


def _save_verified_store(store: Dict[str, Dict]):
    """Persist verification data to disk"""
    global PERSISTED_VERIFICATION_CACHE
    path = _get_store_path()
    try:
        serializable = {}
        for email, record in store.items():
            serializable[email] = {**record}
            if isinstance(record.get('verified_at'), datetime):
                serializable[email]['verified_at'] = record['verified_at'].isoformat()
        with open(path, 'w') as f:
            json.dump(serializable, f)
        # Update cache after saving
        PERSISTED_VERIFICATION_CACHE = store
        print(f"[AUTH] Saved verification store: {len(store)} verified emails")
        return True
    except Exception as e:
        print(f"[AUTH] Warning: failed to save verification store {path}: {e}")
        return False


def _set_verified(email: str):
    """Store verified status persistently"""
    store = _load_verified_store()
    store[email] = {'verified_at': datetime.now()}
    _save_verified_store(store)


def _get_verified_record(email: str) -> Optional[Dict]:
    # Always reload from disk to ensure we have the latest data
    store = _load_verified_store(force_reload=True)
    return store.get(email)


def _remove_verified(email: str):
    store = _load_verified_store()
    if email in store:
        del store[email]
        _save_verified_store(store)

def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))

def send_verification_email(email: str, code: str) -> bool:
    """Send verification code via email"""
    try:
        config = current_app.config
        
        msg = MIMEMultipart()
        msg['From'] = config['EMAIL_USER']
        msg['To'] = email
        msg['Subject'] = 'Winthrop Tutor Assignment - Verification Code'
        
        body = f"""
        Your verification code is: {code}
        
        This code will expire in 10 minutes.
        
        If you did not request this code, please ignore this email.
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        print(f"Attempting to send verification email to {email} via {config['EMAIL_HOST']}:{config['EMAIL_PORT']}")
        server = smtplib.SMTP(config['EMAIL_HOST'], config['EMAIL_PORT'])
        server.starttls()
        print(f"Attempting to login with user: {config['EMAIL_USER']}")
        server.login(config['EMAIL_USER'], config['EMAIL_PASSWORD'])
        print(f"Sending email to {email}")
        server.send_message(msg)
        server.quit()
        print(f"Verification email sent successfully to {email}")
        
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"SMTP Authentication Error: {e}")
        print("This usually means EMAIL_PASSWORD is incorrect. For Gmail, you need an App Password, not your regular password.")
        return False
    except smtplib.SMTPException as e:
        print(f"SMTP Error: {e}")
        return False
    except Exception as e:
        print(f"Error sending verification email: {type(e).__name__}: {e}")
        return False

def is_admin_email(email: str) -> bool:
    """Check if email is in admin list"""
    admin_emails = current_app.config.get('ADMIN_EMAILS', [])
    return email.lower().strip() in [e.lower().strip() for e in admin_emails if e]

def request_verification_code(email: str) -> Dict[str, str]:
    """Request a verification code for an email"""
    email = email.lower().strip()
    print(f"[AUTH] Processing verification code request for: {email}")
    
    # Check admin email list
    admin_emails = current_app.config.get('ADMIN_EMAILS', [])
    print(f"[AUTH] Admin emails configured: {admin_emails}")
    print(f"[AUTH] Checking if {email} is in admin list...")
    
    if not is_admin_email(email):
        print(f"[AUTH] ERROR: {email} is not in admin list")
        return {'error': 'Email not authorized. Please contact an administrator to add your email to the admin list.'}
    
    print(f"[AUTH] Email {email} is authorized")
    
    # Check if email configuration is set up
    config = current_app.config
    email_user = config.get('EMAIL_USER', '')
    email_password = config.get('EMAIL_PASSWORD', '')
    
    print(f"[AUTH] EMAIL_USER: {'SET' if email_user else 'NOT SET'}")
    print(f"[AUTH] EMAIL_PASSWORD: {'SET' if email_password else 'NOT SET'}")
    
    if not email_user or not email_password:
        print("[AUTH] ERROR: EMAIL_USER or EMAIL_PASSWORD not configured in .env file")
        return {'error': 'Email service not configured. Please check EMAIL_USER and EMAIL_PASSWORD in .env file.'}
    
    code = generate_verification_code()
    expires_at = datetime.now() + timedelta(seconds=current_app.config.get('VERIFICATION_CODE_EXPIRES', 600))
    
    verification_codes[email] = {
        'code': code,
        'expires_at': expires_at,
        'verified': False
    }
    
    try:
        if send_verification_email(email, code):
            return {'message': 'Verification code sent'}
        else:
            return {'error': 'Failed to send verification code. Check backend console for details.'}
    except Exception as e:
        print(f"ERROR in request_verification_code: {e}")
        return {'error': f'Failed to send verification code: {str(e)}'}

def verify_code(email: str, code: str) -> Dict[str, any]:
    """Verify the code and return success status"""
    email = email.lower().strip()
    
    if email not in verification_codes:
        return {'verified': False, 'error': 'No verification code requested'}
    
    stored = verification_codes[email]
    
    if datetime.now() > stored['expires_at']:
        del verification_codes[email]
        return {'verified': False, 'error': 'Verification code expired'}
    
    if stored['code'] != code:
        return {'verified': False, 'error': 'Invalid verification code'}
    
    stored['verified'] = True
    stored['verified_at'] = datetime.now()  # Record when verification happened
    _set_verified(email)  # Persist verification across restarts
    return {'verified': True, 'message': 'Code verified successfully'}

def is_verified(email: str) -> bool:
    """Check if email is verified
    
    Once verified, the status persists for the JWT token lifetime (24 hours).
    The expires_at only applies to the verification code itself, not the verified status.
    """
    email = email.lower().strip()
    print(f"[AUTH] is_verified: Checking verification for '{email}'")
    
    stored = verification_codes.get(email, {})
    persisted = _get_verified_record(email)
    
    print(f"[AUTH] is_verified: In-memory record: {bool(stored)}, Persisted record: {persisted}")

    # Prefer persisted verification (survives restarts)
    if persisted:
        verified_at = persisted.get('verified_at', datetime.now())
        if isinstance(verified_at, str):
            try:
                verified_at = datetime.fromisoformat(verified_at)
            except Exception:
                verified_at = datetime.now()
        
        jwt_expires = current_app.config.get('JWT_ACCESS_TOKEN_EXPIRES', 86400)
        expires_at = verified_at + timedelta(seconds=jwt_expires)
        now = datetime.now()
        
        print(f"[AUTH] is_verified: Verified at: {verified_at}, Expires at: {expires_at}, Now: {now}")
        
        if now > expires_at:
            print(f"[AUTH] is_verified: Persisted verification expired for {email}")
            _remove_verified(email)
            return False
        else:
            print(f"[AUTH] is_verified: {email} is verified (persisted)")
            return True

    if not stored:
        print(f"[AUTH] is_verified: No verification record for {email}")
        return False
    
    # Check if verification code expired (only matters if not yet verified)
    if not stored.get('verified', False):
        if datetime.now() > stored.get('expires_at', datetime.now()):
            print(f"[AUTH] is_verified: Verification code expired for {email}")
            del verification_codes[email]
            return False
        print(f"[AUTH] is_verified: {email} has verification code but not yet verified")
        return False
    
    # Once verified, the status persists (JWT token handles expiration)
    verified_at = stored.get('verified_at', datetime.now())
    if datetime.now() > verified_at + timedelta(seconds=current_app.config.get('JWT_ACCESS_TOKEN_EXPIRES', 86400)):
        print(f"[AUTH] is_verified: Verification expired (24h) for {email}")
        del verification_codes[email]
        _remove_verified(email)
        return False
    
    print(f"[AUTH] is_verified: {email} is verified (in-memory)")
    return True

def clear_verification(email: str):
    """Clear verification code for an email"""
    email = email.lower().strip()
    if email in verification_codes:
        del verification_codes[email]
    _remove_verified(email)

