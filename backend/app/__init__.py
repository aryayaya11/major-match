import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, request, make_response
from flask_cors import CORS
from flask_caching import Cache
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import Config
from app.models import db

# Initialize extensions globally
cache = Cache()
migrate = Migrate()
limiter = Limiter(
    key_func=get_remote_address,
    strategy="fixed-window"
)


def setup_logging():
    """Configure logging with rotation to prevent unbounded log growth."""
    formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
    )

    # Rotating file handler: max 5MB per file, keep 3 backups
    file_handler = RotatingFileHandler(
        "app.log", maxBytes=5 * 1024 * 1024, backupCount=3
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    logging.basicConfig(
        level=logging.INFO,
        handlers=[file_handler, console_handler]
    )


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Register ProxyFix middleware to get real user IP behind reverse proxy
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    setup_logging()

    # Init core extensions
    db.init_app(app)

    # ── CORS — restrict to configured origins ──
    allowed_origins = app.config.get('ALLOWED_ORIGINS')
    CORS(app, origins=allowed_origins, supports_credentials=True)

    # ── Swagger — only enable in development ──
    if app.config.get('DEBUG', False):
        from flasgger import Swagger
        Swagger(app)

    cache.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)

    # ── Security Headers Middleware ──
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if not app.config.get('DEBUG', False):
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response

    with app.app_context():
        db.create_all()

    # Register blueprints
    from app.routes.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    # Simple root route for health check
    @app.route("/")
    def home():
        return {"status": "ok", "message": "Major & Match API is running"}

    return app
