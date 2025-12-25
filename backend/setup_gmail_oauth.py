"""
One-time script to set up Gmail OAuth2 and get refresh token.

This script helps you:
1. Create OAuth2 credentials in Google Cloud Console
2. Get a refresh token for Gmail API access
3. Set up environment variables for Railway

Run this script locally (not on Railway):
    python setup_gmail_oauth.py
"""

import os
import json
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials

# Gmail API scope for sending emails
SCOPES = ['https://www.googleapis.com/auth/gmail.send']


def get_oauth_credentials():
    """
    Interactive OAuth2 flow to get refresh token.
    
    Returns:
        dict with client_id, client_secret, and refresh_token
    """
    print("=" * 60)
    print("Gmail OAuth2 Setup")
    print("=" * 60)
    print()
    print("This script will help you get a refresh token for Gmail API.")
    print()
    print("STEP 1: Create OAuth2 Credentials in Google Cloud Console")
    print("-" * 60)
    print("1. Go to: https://console.cloud.google.com/")
    print("2. Select your project (or create a new one)")
    print("3. Navigate to: APIs & Services > Credentials")
    print("4. Click 'Create Credentials' > 'OAuth client ID'")
    print("5. If prompted, configure OAuth consent screen:")
    print("   - User Type: External")
    print("   - App name: Tutor Assignment App (or any name)")
    print("   - User support email: your email")
    print("   - Developer contact: your email")
    print("   - Click 'Save and Continue' through scopes")
    print("   - IMPORTANT: Add your email as a test user (the one you'll use to send emails)")
    print("     * Click 'Add Users'")
    print("     * Enter your Gmail address (e.g., WinthropPreMed@gmail.com)")
    print("     * Click 'Add'")
    print("   - Click 'Save and Continue' to finish")
    print()
    print("   NOTE: If you see 'Access blocked' error later, make sure your email is added")
    print("   as a test user in: APIs & Services > OAuth consent screen > Test users")
    print("6. Back in Credentials, create OAuth client ID:")
    print("   - Application type: Desktop app")
    print("   - Name: Tutor Assignment App")
    print("   - Click 'Create'")
    print("7. Download the JSON file (click the download icon)")
    print("8. Save it as 'credentials.json' in the backend directory")
    print()
    
    input("Press Enter when you have downloaded credentials.json...")
    
    credentials_path = os.path.join(os.path.dirname(__file__), 'credentials.json')
    
    if not os.path.exists(credentials_path):
        print(f"\nERROR: {credentials_path} not found!")
        print("Please download the OAuth2 credentials JSON file and save it as 'credentials.json'")
        return None
    
    print(f"\nFound credentials.json at: {credentials_path}")
    print()
    print("STEP 2: Authorize the Application")
    print("-" * 60)
    print("A browser window will open. Please:")
    print("1. Sign in with your Gmail account (the one you want to send emails from)")
    print("2. Click 'Advanced' if you see a warning about unverified app")
    print("3. Click 'Go to Tutor Assignment App (unsafe)'")
    print("4. Click 'Allow' to grant Gmail send permissions")
    print()
    
    input("Press Enter to start the OAuth flow...")
    
    # Run OAuth flow
    flow = InstalledAppFlow.from_client_secrets_file(
        credentials_path,
        SCOPES
    )
    
    creds = flow.run_local_server(port=0)
    
    # Extract credentials
    result = {
        'client_id': creds.client_id,
        'client_secret': creds.client_secret,
        'refresh_token': creds.refresh_token
    }
    
    print()
    print("=" * 60)
    print("SUCCESS! OAuth2 credentials obtained.")
    print("=" * 60)
    print()
    print("STEP 3: Set Environment Variables in Railway")
    print("-" * 60)
    print("Add these environment variables in Railway:")
    print()
    print(f"GMAIL_CLIENT_ID={result['client_id']}")
    print(f"GMAIL_CLIENT_SECRET={result['client_secret']}")
    print(f"GMAIL_REFRESH_TOKEN={result['refresh_token']}")
    print()
    print("Also make sure EMAIL_USER is set to your Gmail address:")
    print("EMAIL_USER=your-email@gmail.com")
    print()
    print("=" * 60)
    print("IMPORTANT: Keep these credentials secure!")
    print("Do not commit them to git or share them publicly.")
    print("=" * 60)
    print()
    
    # Optionally save to a file (not committed to git)
    save_file = input("Save credentials to .env.local? (y/n): ").strip().lower()
    if save_file == 'y':
        env_file = os.path.join(os.path.dirname(__file__), '.env.local')
        with open(env_file, 'a') as f:
            f.write(f"\n# Gmail OAuth2 Credentials (from setup_gmail_oauth.py)\n")
            f.write(f"GMAIL_CLIENT_ID={result['client_id']}\n")
            f.write(f"GMAIL_CLIENT_SECRET={result['client_secret']}\n")
            f.write(f"GMAIL_REFRESH_TOKEN={result['refresh_token']}\n")
        print(f"\nCredentials saved to {env_file} (not committed to git)")
        print("You can source this file locally: source .env.local")
    
    return result


if __name__ == '__main__':
    try:
        result = get_oauth_credentials()
        if result:
            print("\nSetup complete! You can now use Gmail API for sending emails.")
        else:
            print("\nSetup failed. Please try again.")
    except KeyboardInterrupt:
        print("\n\nSetup cancelled by user.")
    except Exception as e:
        print(f"\n\nERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

