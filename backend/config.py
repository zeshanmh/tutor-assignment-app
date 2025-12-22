"""Configuration settings for the tutor assignment application"""
import os
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

class Config:
    """Base configuration"""
    # Environment detection
    ENV = os.environ.get('FLASK_ENV', 'development')
    DEBUG = ENV == 'development'
    
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # Database Configuration
    # Railway provides DATABASE_URL, fallback to DATABASE_PATH for local SQLite
    DATABASE_URL = os.environ.get('DATABASE_URL')
    if DATABASE_URL:
        # Use PostgreSQL connection string from Railway
        DATABASE_PATH = DATABASE_URL
    else:
        # Fallback to SQLite for local development
        DATABASE_PATH = os.environ.get('DATABASE_PATH', os.path.join(basedir, 'tutor_assignment.db'))
    
    # Google Sheets Sync Configuration (optional, for sync only)
    GOOGLE_SHEETS_ID = os.environ.get('GOOGLE_SHEETS_ID', '')
    GOOGLE_CREDENTIALS_PATH = os.environ.get('GOOGLE_CREDENTIALS_PATH', '')
    # Support base64-encoded credentials as alternative to file path
    GOOGLE_CREDENTIALS_JSON = os.environ.get('GOOGLE_CREDENTIALS_JSON', '')
    SYNC_CACHE_EXPIRY = int(os.environ.get('SYNC_CACHE_EXPIRY', 300))  # 5 minutes default
    
    # Admin emails (comma-separated)
    ADMIN_EMAILS = os.environ.get('ADMIN_EMAILS', '').split(',')
    
    # Email Configuration
    EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
    EMAIL_USER = os.environ.get('EMAIL_USER', '')
    EMAIL_PASSWORD = os.environ.get('EMAIL_PASSWORD', '')
    
    # JWT Configuration
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours
    
    # Verification code expiration (in seconds)
    VERIFICATION_CODE_EXPIRES = 600  # 10 minutes

