"""Migration script to move data from SQLite to PostgreSQL"""
import os
import sys
from config import Config
from database_manager import DatabaseManager
from models import Student, NonResidentTutor, ResidentTutor
import json

def migrate_data():
    """Migrate data from SQLite to PostgreSQL"""
    print("=" * 60)
    print("SQLite to PostgreSQL Migration Script")
    print("=" * 60)
    
    # Check if DATABASE_URL is set (PostgreSQL)
    if not os.environ.get('DATABASE_URL'):
        print("\nERROR: DATABASE_URL environment variable not set.")
        print("Please set DATABASE_URL to your PostgreSQL connection string.")
        print("Example: postgresql://user:password@host:port/database")
        sys.exit(1)
    
    # Get SQLite database path (local)
    sqlite_path = os.environ.get('SQLITE_DATABASE_PATH', 'tutor_assignment.db')
    if not os.path.exists(sqlite_path):
        print(f"\nERROR: SQLite database not found at: {sqlite_path}")
        print("Please set SQLITE_DATABASE_PATH environment variable if your SQLite file is elsewhere.")
        sys.exit(1)
    
    print(f"\n1. Connecting to SQLite database: {sqlite_path}")
    sqlite_db = DatabaseManager(sqlite_path)
    
    print(f"2. Connecting to PostgreSQL database...")
    postgres_db = DatabaseManager(os.environ.get('DATABASE_URL'))
    
    print("\n3. Reading data from SQLite...")
    
    # Get all data from SQLite
    students = sqlite_db.get_students()
    print(f"   Found {len(students)} students")
    
    nrts = sqlite_db.get_nrts()
    print(f"   Found {len(nrts)} NRTs")
    
    rts = sqlite_db.get_rts()
    print(f"   Found {len(rts)} RTs")
    
    email_templates = sqlite_db.get_email_templates()
    print(f"   Found {len(email_templates)} email templates")
    
    # Get email history for all students
    all_email_history = []
    for student in students:
        history = sqlite_db.get_email_history(student.row_index)
        all_email_history.extend(history)
    print(f"   Found {len(all_email_history)} email history records")
    
    print("\n4. Writing data to PostgreSQL...")
    
    # Write students (preserve row_index as id)
    student_id_map = {}  # Map old SQLite id to new PostgreSQL id
    for student in students:
        old_id = student.row_index
        student.row_index = None  # Clear to let PostgreSQL assign new ID
        if postgres_db.add_student(student):
            # Get the new ID (we'll need to query for it)
            # For now, we'll just add them and let PostgreSQL assign IDs
            pass
    
    # Re-fetch students to get new IDs
    new_students = postgres_db.get_students()
    if len(new_students) != len(students):
        print(f"   WARNING: Expected {len(students)} students, got {len(new_students)}")
    
    # Write NRTs
    nrt_count = 0
    for nrt in nrts:
        nrt.row_index = None
        if postgres_db.add_nrt(nrt):
            nrt_count += 1
    print(f"   Added {nrt_count} NRTs")
    
    # Write RTs
    rt_count = 0
    for rt in rts:
        rt.row_index = None
        if postgres_db.add_rt(rt):
            rt_count += 1
    print(f"   Added {rt_count} RTs")
    
    # Write email templates
    template_count = 0
    for template in email_templates:
        try:
            postgres_db.add_email_template(
                template['name'],
                template['subject'],
                template['body']
            )
            template_count += 1
        except Exception as e:
            print(f"   Warning: Could not add template {template.get('name', 'unknown')}: {e}")
    print(f"   Added {template_count} email templates")
    
    # Note: Email history migration is complex because student IDs may have changed
    # We'll skip it for now, or implement a more sophisticated mapping
    print(f"   Skipped {len(all_email_history)} email history records (student ID mapping needed)")
    
    print("\n" + "=" * 60)
    print("Migration completed!")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  Students: {len(students)}")
    print(f"  NRTs: {nrt_count}")
    print(f"  RTs: {rt_count}")
    print(f"  Email Templates: {template_count}")
    print(f"\nNote: Student IDs may have changed. Email history was not migrated.")
    print("You may need to manually update student assignments if IDs changed.")

if __name__ == '__main__':
    migrate_data()

