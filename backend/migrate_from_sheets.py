"""Migration script to move data from Google Sheets to SQLite"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from google_sheets import GoogleSheetsManager
from database_manager import DatabaseManager
from config import Config
from flask import Flask

def migrate():
    """Migrate data from Google Sheets to SQLite"""
    print("=" * 60)
    print("Migrating data from Google Sheets to SQLite")
    print("=" * 60)
    
    # Initialize Flask app for config
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Check if Google Sheets is configured
    if not app.config.get('GOOGLE_SHEETS_ID') or not app.config.get('GOOGLE_CREDENTIALS_PATH'):
        print("ERROR: Google Sheets not configured. Please set GOOGLE_SHEETS_ID and GOOGLE_CREDENTIALS_PATH in .env")
        return False
    
    # Check if database path is configured
    db_path = app.config.get('DATABASE_PATH', 'tutor_assignment.db')
    print(f"Database path: {db_path}")
    
    # Initialize managers
    print("\n1. Connecting to Google Sheets...")
    try:
        sheets_manager = GoogleSheetsManager(
            app.config['GOOGLE_CREDENTIALS_PATH'],
            app.config['GOOGLE_SHEETS_ID']
        )
        print("   ✓ Connected to Google Sheets")
    except Exception as e:
        print(f"   ✗ Error connecting to Google Sheets: {e}")
        return False
    
    print("\n2. Initializing SQLite database...")
    try:
        db_manager = DatabaseManager(db_path)
        print("   ✓ Database initialized")
    except Exception as e:
        print(f"   ✗ Error initializing database: {e}")
        return False
    
    # Migrate Students
    print("\n3. Migrating Students...")
    try:
        students = sheets_manager.get_students()
        print(f"   Found {len(students)} students in Google Sheets")
        
        # Clear existing students in database
        existing = db_manager.get_students()
        for student in existing:
            db_manager.delete_student(student.row_index)
        
        # Add all students
        for student in students:
            student.row_index = None  # Let database assign new ID
            db_manager.add_student(student)
        print(f"   ✓ Migrated {len(students)} students")
    except Exception as e:
        print(f"   ✗ Error migrating students: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Migrate NRTs
    print("\n4. Migrating Non-Resident Tutors...")
    try:
        nrts = sheets_manager.get_nrts()
        print(f"   Found {len(nrts)} NRTs in Google Sheets")
        
        # Clear existing NRTs in database
        existing = db_manager.get_nrts()
        for nrt in existing:
            db_manager.delete_nrt(nrt.row_index)
        
        # Add all NRTs
        for nrt in nrts:
            nrt.row_index = None  # Let database assign new ID
            db_manager.add_nrt(nrt)
        print(f"   ✓ Migrated {len(nrts)} NRTs")
    except Exception as e:
        print(f"   ✗ Error migrating NRTs: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Migrate RTs
    print("\n5. Migrating Resident Tutors...")
    try:
        rts = sheets_manager.get_rts()
        print(f"   Found {len(rts)} RTs in Google Sheets")
        
        # Clear existing RTs in database
        existing = db_manager.get_rts()
        for rt in existing:
            db_manager.delete_rt(rt.row_index)
        
        # Add all RTs
        for rt in rts:
            rt.row_index = None  # Let database assign new ID
            db_manager.add_rt(rt)
        print(f"   ✓ Migrated {len(rts)} RTs")
    except Exception as e:
        print(f"   ✗ Error migrating RTs: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Verify migration
    print("\n6. Verifying migration...")
    db_students = db_manager.get_students()
    db_nrts = db_manager.get_nrts()
    db_rts = db_manager.get_rts()
    
    print(f"   Database now contains:")
    print(f"   - {len(db_students)} students")
    print(f"   - {len(db_nrts)} NRTs")
    print(f"   - {len(db_rts)} RTs")
    
    if len(db_students) == len(students) and len(db_nrts) == len(nrts) and len(db_rts) == len(rts):
        print("\n" + "=" * 60)
        print("✓ Migration completed successfully!")
        print("=" * 60)
        print(f"\nDatabase file: {db_path}")
        print("\nYou can now:")
        print("1. Update your .env file to remove GOOGLE_SHEETS_ID (or keep it for sync)")
        print("2. Restart your backend server")
        print("3. The app will now use SQLite instead of Google Sheets API")
        return True
    else:
        print("\n⚠ Warning: Record counts don't match. Please verify the migration.")
        return False

if __name__ == '__main__':
    success = migrate()
    sys.exit(0 if success else 1)

