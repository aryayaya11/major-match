import os
import secrets
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    # ── Security ──
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY environment variable MUST be set!")

    # Admin API key for protected endpoints (stats, export)
    ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY')
    if not ADMIN_API_KEY:
        raise ValueError("ADMIN_API_KEY environment variable MUST be set for protected endpoints!")

    # ── Database ──
    db_uri = os.environ.get('DATABASE_URL') or os.environ.get('SQLALCHEMY_DATABASE_URI')
    if db_uri:
        if db_uri.startswith('postgres://'):
            db_uri = db_uri.replace('postgres://', 'postgresql+pg8000://', 1)
        elif db_uri.startswith('postgresql://'):
            db_uri = db_uri.replace('postgresql://', 'postgresql+pg8000://', 1)
    else:
        db_uri = 'sqlite:///majorMatch.db'
    SQLALCHEMY_DATABASE_URI = db_uri
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ── Application ──
    DEBUG = os.environ.get('FLASK_ENV') == 'development'

    # ── CORS ──
    ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS')
    if ALLOWED_ORIGINS:
        ALLOWED_ORIGINS = ALLOWED_ORIGINS.split(',')
    else:
        raise ValueError("ALLOWED_ORIGINS environment variable MUST be set!")

    # ── Redis / Caching ──
    REDIS_URL = os.environ.get('REDIS_URL', '')
    RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL', 'memory://')
    RATELIMIT_DEFAULT_LIMITS = ["500 per day", "100 per hour"]

    CACHE_TYPE = 'RedisCache' if os.environ.get('REDIS_URL') else 'SimpleCache'
    CACHE_REDIS_URL = REDIS_URL
    CACHE_DEFAULT_TIMEOUT = 300
