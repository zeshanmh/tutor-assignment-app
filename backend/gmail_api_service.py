"""Gmail API service for sending emails via Gmail API instead of SMTP"""
import base64
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from flask import current_app
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google.auth.exceptions import RefreshError
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Gmail API scope for sending emails
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

_gmail_service = None


def get_gmail_service():
    """Get authenticated Gmail service instance"""
    global _gmail_service
    
    if _gmail_service is not None:
        return _gmail_service
    
    try:
        config = current_app.config
        
        # Get OAuth2 credentials from config
        client_id = config.get('GMAIL_CLIENT_ID')
        client_secret = config.get('GMAIL_CLIENT_SECRET')
        refresh_token = config.get('GMAIL_REFRESH_TOKEN')
        
        if not all([client_id, client_secret, refresh_token]):
            raise ValueError(
                "Gmail OAuth2 credentials not configured. "
                "Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN environment variables."
            )
        
        # Create credentials object
        creds = Credentials(
            token=None,  # We'll refresh it
            refresh_token=refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES
        )
        
        # Refresh the token if needed
        if creds.expired or not creds.valid:
            try:
                creds.refresh(Request())
            except RefreshError as e:
                # Clear cached service so it can be retried after token is regenerated
                _gmail_service = None
                error_msg = str(e)
                print(f"[GMAIL API] ERROR: Refresh token has expired or been revoked.")
                print(f"[GMAIL API] Error details: {error_msg}")
                print("[GMAIL API]")
                print("[GMAIL API] To fix this, you need to regenerate your refresh token:")
                print("[GMAIL API] 1. Run: python backend/setup_gmail_oauth.py")
                print("[GMAIL API] 2. Follow the instructions to get a new refresh token")
                print("[GMAIL API] 3. Update GMAIL_REFRESH_TOKEN in your .env file (local) or Railway variables (production)")
                raise RefreshError(
                    "Gmail refresh token has expired or been revoked. "
                    "Please regenerate it by running: python backend/setup_gmail_oauth.py"
                ) from e
        
        # Build Gmail service
        _gmail_service = build('gmail', 'v1', credentials=creds)
        print("[GMAIL API] Gmail service initialized successfully")
        
        return _gmail_service
    
    except RefreshError:
        # Re-raise refresh errors as-is (already handled above)
        raise
    except Exception as e:
        print(f"[GMAIL API] Error initializing Gmail service: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise


def send_email_via_gmail(to_email: str, subject: str, body: str, 
                         cc_emails: Optional[List[str]] = None,
                         from_email: Optional[str] = None) -> bool:
    """
    Send email using Gmail API
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        body: Email body (plain text)
        cc_emails: Optional list of CC email addresses
        from_email: Optional sender email (defaults to EMAIL_USER from config)
    
    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Get sender email from config if not provided
        if not from_email:
            from_email = current_app.config.get('EMAIL_USER')
            if not from_email:
                print("[GMAIL API] ERROR: EMAIL_USER not configured")
                return False
        
        # Create MIME message
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        msg['Subject'] = subject
        
        if cc_emails:
            msg['Cc'] = ', '.join(cc_emails)
        
        # Attach body
        msg.attach(MIMEText(body, 'plain'))
        
        # Convert message to RFC 2822 format and base64url encode
        raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
        
        # Get Gmail service
        service = get_gmail_service()
        
        # Build recipients list
        recipients = {'to': [to_email]}
        if cc_emails:
            recipients['cc'] = cc_emails
        
        # Send email via Gmail API
        message = service.users().messages().send(
            userId='me',
            body={'raw': raw_message}
        ).execute()
        
        print(f"[GMAIL API] Email sent successfully to {to_email} (Message ID: {message['id']})")
        return True
    
    except RefreshError as e:
        # Clear cached service so it can be retried after token is regenerated
        global _gmail_service
        _gmail_service = None
        print(f"[GMAIL API] ERROR: Refresh token has expired or been revoked.")
        print(f"[GMAIL API] Error details: {e}")
        print("[GMAIL API]")
        print("[GMAIL API] To fix this, regenerate your refresh token:")
        print("[GMAIL API] 1. Run: python backend/setup_gmail_oauth.py")
        print("[GMAIL API] 2. Update GMAIL_REFRESH_TOKEN in your environment variables")
        return False
    except HttpError as e:
        print(f"[GMAIL API] HTTP Error: {e.status_code} - {e.reason}")
        if e.status_code == 401:
            print("[GMAIL API] Authentication failed. Check your OAuth2 credentials and refresh token.")
            print("[GMAIL API] If the token expired, regenerate it with: python backend/setup_gmail_oauth.py")
        elif e.status_code == 403:
            print("[GMAIL API] Permission denied. Make sure the OAuth2 scope includes gmail.send")
        return False
    except Exception as e:
        print(f"[GMAIL API] Error sending email: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

