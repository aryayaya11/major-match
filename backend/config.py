import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    # Hardening SECRET_KEY for production environment
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        if os.environ.get('FLASK_ENV') == 'production':
            raise ValueError("SECRET_KEY must be set in production environment!")
        SECRET_KEY = 'default-secret-key-fallback'
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
    DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 't')

    # Redis URL untuk Caching dan Limiting (akan dipakai jika tersedia)
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    
    # Rate limiting configuration (uses Redis if available in production, else memory)
    RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL', 'memory://')
    RATELIMIT_DEFAULT_LIMITS = ["500 per day", "100 per hour"]
    
    # Konfigurasi Flask-Caching
    CACHE_TYPE = 'RedisCache' if os.environ.get('REDIS_URL') else 'SimpleCache'
    CACHE_REDIS_URL = REDIS_URL
    CACHE_DEFAULT_TIMEOUT = 300
