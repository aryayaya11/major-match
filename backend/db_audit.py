from app import create_app
from app.models import db
from sqlalchemy import inspect
import json

app = create_app()
with app.app_context():
    engine = db.engine
    inspector = inspect(engine)
    
    tables = inspector.get_table_names()
    
    report = {}
    for table_name in tables:
        columns = []
        for col in inspector.get_columns(table_name):
            # Safe parsing of column type
            try:
                type_str = str(col['type'])
            except:
                type_str = 'UNKNOWN'
                
            columns.append({
                'name': col['name'],
                'type': type_str,
                'nullable': col.get('nullable', True),
            })
            
        fks = inspector.get_foreign_keys(table_name)
        pks = inspector.get_pk_constraint(table_name)
        
        # row count
        try:
            with engine.connect() as conn:
                res = conn.execute(db.text(f"SELECT COUNT(*) FROM {table_name}"))
                count = res.scalar()
        except Exception as e:
            count = f"Error: {str(e)}"
            
        report[table_name] = {
            'columns': columns,
            'foreign_keys': fks,
            'primary_keys': pks.get('constrained_columns', []) if pks else [],
            'row_count': count
        }
        
    with open('db_audit_result.json', 'w') as f:
        json.dump(report, f, indent=4)
    
    print("Audit generated in db_audit_result.json")
