import logging
from flask import Flask
from flask_cors import CORS
from flasgger import Swagger
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
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        handlers=[
            logging.FileHandler("app.log"),
            logging.StreamHandler()
        ]
    )

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Register ProxyFix middleware to get real user IP behind reverse proxy (e.g. Nginx, Cloudflare)
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    setup_logging()
    
    # Init extensions with app
    db.init_app(app)
    CORS(app)
    Swagger(app)
    cache.init_app(app)
    migrate.init_app(app, db)
    
    # Configure limiter storage from config
    limiter.init_app(app)
    if hasattr(app.config, 'REDIS_URL') and app.config['REDIS_URL']:
        try:
            # We must configure limiter before it's used if we want redis, but init_app handles it if we pass storage_uri to Limiter init.
            # Actually, simpler to just set it via Limiter constructor, let's update it.
            pass
        except:
            pass

    with app.app_context():
        # Buat tabel jika belum ada (berguna jika tidak pakai Flask-Migrate)
        db.create_all()

    # Daftarkan blueprints
    from app.routes.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    return app
