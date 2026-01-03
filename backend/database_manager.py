"""Database manager for tutor assignment system (supports SQLite and PostgreSQL)"""
import sqlite3
import json
from typing import List, Optional
from models import Student, NonResidentTutor, ResidentTutor
import os

# Try to import PostgreSQL adapter
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, RealDictRow
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    RealDictRow = None

class DatabaseManager:
    """Manages database operations (SQLite or PostgreSQL)"""
    
    def __init__(self, database_path: str):
        """Initialize database connection
        
        Args:
            database_path: SQLite file path or PostgreSQL connection string
        """
        self.database_path = database_path
        self.is_postgresql = self._detect_database_type()
        self._init_database()
    
    def _detect_database_type(self) -> bool:
        """Detect if we're using PostgreSQL or SQLite"""
        if not self.database_path:
            return False
        # Check if it's a PostgreSQL connection string
        return (self.database_path.startswith('postgresql://') or 
                self.database_path.startswith('postgres://') or
                'postgresql' in self.database_path.lower())
    
    def _get_connection(self):
        """Get database connection"""
        if self.is_postgresql:
            if not PSYCOPG2_AVAILABLE:
                raise ImportError("psycopg2 is required for PostgreSQL. Install with: pip install psycopg2-binary")
            conn = psycopg2.connect(self.database_path)
            return conn
        else:
            conn = sqlite3.connect(self.database_path)
            conn.row_factory = sqlite3.Row
            return conn
    
    def _get_cursor(self, conn):
        """Get cursor with appropriate row factory"""
        if self.is_postgresql:
            return conn.cursor(cursor_factory=RealDictCursor)
        else:
            return conn.cursor()
    
    def _get_placeholder(self):
        """Get placeholder style for parameterized queries"""
        return '%s' if self.is_postgresql else '?'
    
    def _get_auto_increment(self):
        """Get auto increment syntax"""
        if self.is_postgresql:
            return 'SERIAL PRIMARY KEY'
        else:
            return 'INTEGER PRIMARY KEY AUTOINCREMENT'
    
    def _get_timestamp_default(self):
        """Get timestamp default syntax"""
        if self.is_postgresql:
            return 'DEFAULT CURRENT_TIMESTAMP'
        else:
            return 'DEFAULT CURRENT_TIMESTAMP'
    
    def _table_columns_exist(self, conn, table_name: str) -> List[str]:
        """Get list of existing columns in a table"""
        cursor = conn.cursor()
        if self.is_postgresql:
            cursor.execute('''
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = %s
            ''', (table_name,))
            return [row[0] for row in cursor.fetchall()]
        else:
            cursor.execute(f'PRAGMA table_info({table_name})')
            return [col[1] for col in cursor.fetchall()]
    
    def _init_database(self):
        """Initialize database schema"""
        conn = self._get_connection()
        cursor = self._get_cursor(conn)
        
        # Students table
        if self.is_postgresql:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS students (
                    id SERIAL PRIMARY KEY,
                    first_name VARCHAR(255) NOT NULL,
                    last_name VARCHAR(255) NOT NULL,
                    primary_email VARCHAR(255),
                    secondary_email VARCHAR(255),
                    class_year VARCHAR(50),
                    rt_assignment VARCHAR(255),
                    nrt_assignment VARCHAR(255),
                    status VARCHAR(50) DEFAULT 'Not Applying',
                    phone_number TEXT,
                    hometown TEXT,
                    concentration TEXT,
                    secondary TEXT,
                    extracurricular_activities TEXT,
                    clinical_shadowing TEXT,
                    research_activities TEXT,
                    medical_interests TEXT,
                    program_interests TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        else:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS students (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    primary_email TEXT,
                    secondary_email TEXT,
                    class_year TEXT,
                    rt_assignment TEXT,
                    nrt_assignment TEXT,
                    status TEXT DEFAULT 'Not Applying',
                    phone_number TEXT,
                    hometown TEXT,
                    concentration TEXT,
                    secondary TEXT,
                    extracurricular_activities TEXT,
                    clinical_shadowing TEXT,
                    research_activities TEXT,
                    medical_interests TEXT,
                    program_interests TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        
        # Add new columns if they don't exist (for existing databases)
        columns = self._table_columns_exist(conn, 'students')
        
        new_columns = [
            ('status', "TEXT DEFAULT 'Not Applying'" if not self.is_postgresql else "VARCHAR(50) DEFAULT 'Not Applying'"),
            ('phone_number', 'TEXT'),
            ('hometown', 'TEXT'),
            ('concentration', 'TEXT'),
            ('secondary', 'TEXT'),
            ('extracurricular_activities', 'TEXT'),
            ('clinical_shadowing', 'TEXT'),
            ('research_activities', 'TEXT'),
            ('medical_interests', 'TEXT'),
            ('program_interests', 'TEXT'),
        ]
        
        for col_name, col_def in new_columns:
            if col_name not in columns:
                try:
                    cursor.execute(f'ALTER TABLE students ADD COLUMN {col_name} {col_def}')
                except Exception as e:
                    print(f"Warning: Could not add column {col_name}: {e}")
        
        # Non-Resident Tutors table
        if self.is_postgresql:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS nrts (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    status VARCHAR(100) DEFAULT 'active',
                    total_students INTEGER DEFAULT 0,
                    class_year_counts TEXT DEFAULT '{}',
                    phone_number TEXT,
                    harvard_affiliation TEXT,
                    harvard_id_number TEXT,
                    current_stage_training TEXT,
                    time_in_boston TEXT,
                    medical_interests TEXT,
                    interests_outside_medicine TEXT,
                    interested_in_shadowing TEXT,
                    interested_in_research TEXT,
                    interested_in_organizing_events TEXT,
                    specific_events TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        else:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS nrts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    status TEXT DEFAULT 'active',
                    total_students INTEGER DEFAULT 0,
                    class_year_counts TEXT DEFAULT '{}',
                    phone_number TEXT,
                    harvard_affiliation TEXT,
                    harvard_id_number TEXT,
                    current_stage_training TEXT,
                    time_in_boston TEXT,
                    medical_interests TEXT,
                    interests_outside_medicine TEXT,
                    interested_in_shadowing TEXT,
                    interested_in_research TEXT,
                    interested_in_organizing_events TEXT,
                    specific_events TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        
        # Add new columns if they don't exist (for existing databases)
        columns = self._table_columns_exist(conn, 'nrts')
        
        new_nrt_columns = [
            ('phone_number', 'TEXT'),
            ('harvard_affiliation', 'TEXT'),
            ('harvard_id_number', 'TEXT'),
            ('current_stage_training', 'TEXT'),
            ('time_in_boston', 'TEXT'),
            ('medical_interests', 'TEXT'),
            ('interests_outside_medicine', 'TEXT'),
            ('interested_in_shadowing', 'TEXT'),
            ('interested_in_research', 'TEXT'),
            ('interested_in_organizing_events', 'TEXT'),
            ('specific_events', 'TEXT'),
        ]
        
        for col_name, col_def in new_nrt_columns:
            if col_name not in columns:
                try:
                    cursor.execute(f'ALTER TABLE nrts ADD COLUMN {col_name} {col_def}')
                except Exception as e:
                    print(f"Warning: Could not add column {col_name}: {e}")
        
        # Resident Tutors table
        if self.is_postgresql:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rts (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    student_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        else:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    student_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        
        # Email Templates table
        if self.is_postgresql:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS email_templates (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    subject TEXT NOT NULL,
                    body TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        else:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS email_templates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    subject TEXT NOT NULL,
                    body TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        
        # Email History table
        if self.is_postgresql:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS email_history (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL,
                    email_subject TEXT NOT NULL,
                    email_body TEXT NOT NULL,
                    recipients TEXT NOT NULL,
                    cc_recipients TEXT,
                    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    sent_by VARCHAR(255),
                    FOREIGN KEY (student_id) REFERENCES students(id)
                )
            ''')
        else:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS email_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    email_subject TEXT NOT NULL,
                    email_body TEXT NOT NULL,
                    recipients TEXT NOT NULL,
                    cc_recipients TEXT,
                    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    sent_by TEXT,
                    FOREIGN KEY (student_id) REFERENCES students(id)
                )
            ''')
        
        # Create indexes for better query performance
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_email_history_student_id 
            ON email_history(student_id)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_email_history_sent_at 
            ON email_history(sent_at)
        ''')
        
        conn.commit()
        conn.close()
    
    # Student operations
    def get_students(self) -> List[Student]:
        """Get all students"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            cursor.execute('SELECT * FROM students ORDER BY id')
            rows = cursor.fetchall()
            conn.close()
            
            students = []
            for row in rows:
                student = Student(
                    first_name=row['first_name'],
                    last_name=row['last_name'],
                    primary_email=row['primary_email'] or None,
                    secondary_email=row['secondary_email'] or None,
                    class_year=row['class_year'] or None,
                    rt_assignment=row['rt_assignment'] or None,
                    nrt_assignment=row['nrt_assignment'] or None,
                    status=(row['status'] if 'status' in row.keys() else None) or 'Not Applying',
                    phone_number=row['phone_number'] if 'phone_number' in row.keys() else None,
                    hometown=row['hometown'] if 'hometown' in row.keys() else None,
                    concentration=row['concentration'] if 'concentration' in row.keys() else None,
                    secondary=row['secondary'] if 'secondary' in row.keys() else None,
                    extracurricular_activities=row['extracurricular_activities'] if 'extracurricular_activities' in row.keys() else None,
                    clinical_shadowing=row['clinical_shadowing'] if 'clinical_shadowing' in row.keys() else None,
                    research_activities=row['research_activities'] if 'research_activities' in row.keys() else None,
                    medical_interests=row['medical_interests'] if 'medical_interests' in row.keys() else None,
                    program_interests=row['program_interests'] if 'program_interests' in row.keys() else None,
                    row_index=row['id']
                )
                students.append(student)
            return students
        except Exception as e:
            print(f"Error getting students: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_student(self, row_index: int) -> Optional[Student]:
        """Get a single student by row_index"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            cursor.execute(f'SELECT * FROM students WHERE id = {placeholder}', (row_index,))
            row = cursor.fetchone()
            conn.close()
            
            if not row:
                return None
            
            return Student(
                first_name=row['first_name'],
                last_name=row['last_name'],
                primary_email=row['primary_email'] or None,
                secondary_email=row['secondary_email'] or None,
                class_year=row['class_year'] or None,
                rt_assignment=row['rt_assignment'] or None,
                nrt_assignment=row['nrt_assignment'] or None,
                status=(row['status'] if 'status' in row.keys() else None) or 'Not Applying',
                phone_number=row.get('phone_number', '') or '',
                hometown=row.get('hometown', '') or '',
                concentration=row.get('concentration', '') or '',
                secondary=row.get('secondary', '') or '',
                extracurricular_activities=row.get('extracurricular_activities', '') or '',
                clinical_shadowing=row.get('clinical_shadowing', '') or '',
                research_activities=row.get('research_activities', '') or '',
                medical_interests=row.get('medical_interests', '') or '',
                program_interests=row.get('program_interests', '') or '',
                row_index=row['id']
            )
        except Exception as e:
            print(f"Error getting student: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def add_student(self, student: Student) -> bool:
        """Add a new student"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            placeholders = ', '.join([placeholder] * 17)
            cursor.execute(f'''
                INSERT INTO students (first_name, last_name, primary_email, secondary_email, 
                                   class_year, rt_assignment, nrt_assignment, status,
                                   phone_number, hometown, concentration, secondary,
                                   extracurricular_activities, clinical_shadowing, research_activities,
                                   medical_interests, program_interests)
                VALUES ({placeholders})
            ''', (
                student.first_name,
                student.last_name,
                student.primary_email,
                student.secondary_email,
                student.class_year,
                student.rt_assignment,
                student.nrt_assignment,
                student.status or 'Not Applying',
                student.phone_number,
                student.hometown,
                student.concentration,
                student.secondary,
                student.extracurricular_activities,
                student.clinical_shadowing,
                student.research_activities,
                student.medical_interests,
                student.program_interests
            ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error adding student: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def update_student(self, student: Student) -> bool:
        """Update an existing student"""
        try:
            if not student.row_index:
                return False
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            cursor.execute(f'''
                UPDATE students 
                SET first_name = {placeholder}, last_name = {placeholder}, primary_email = {placeholder}, secondary_email = {placeholder},
                    class_year = {placeholder}, rt_assignment = {placeholder}, nrt_assignment = {placeholder}, status = {placeholder},
                    phone_number = {placeholder}, hometown = {placeholder}, concentration = {placeholder}, secondary = {placeholder},
                    extracurricular_activities = {placeholder}, clinical_shadowing = {placeholder}, research_activities = {placeholder},
                    medical_interests = {placeholder}, program_interests = {placeholder},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {placeholder}
            ''', (
                student.first_name,
                student.last_name,
                student.primary_email,
                student.secondary_email,
                student.class_year,
                student.rt_assignment,
                student.nrt_assignment,
                student.status or 'Not Applying',
                student.phone_number,
                student.hometown,
                student.concentration,
                student.secondary,
                student.extracurricular_activities,
                student.clinical_shadowing,
                student.research_activities,
                student.medical_interests,
                student.program_interests,
                student.row_index
            ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error updating student: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def delete_student(self, row_index: int) -> bool:
        """Delete a student by id"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            cursor.execute(f'DELETE FROM students WHERE id = {placeholder}', (row_index,))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error deleting student: {e}")
            return False
    
    def restore_student(self, student: Student, row_index: int) -> bool:
        """Restore a deleted student at a specific position"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            placeholders = ', '.join([placeholder] * 17)
            # Insert with specific id (if we want to preserve row_index)
            # For simplicity, just add as new and let auto-increment handle it
            cursor.execute(f'''
                INSERT INTO students (first_name, last_name, primary_email, secondary_email, 
                                   class_year, rt_assignment, nrt_assignment, status,
                                   phone_number, hometown, concentration, secondary,
                                   extracurricular_activities, clinical_shadowing, research_activities,
                                   medical_interests, program_interests)
                VALUES ({placeholders})
            ''', (
                student.first_name,
                student.last_name,
                student.primary_email,
                student.secondary_email,
                student.class_year,
                student.rt_assignment,
                student.nrt_assignment,
                student.status or 'Not Applying',
                student.phone_number,
                student.hometown,
                student.concentration,
                student.secondary,
                student.extracurricular_activities,
                student.clinical_shadowing,
                student.research_activities,
                student.medical_interests,
                student.program_interests
            ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error restoring student: {e}")
            return False
    
    def bulk_update_students(self, students: List[Student]) -> bool:
        """Bulk update students"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            for student in students:
                if student.row_index:
                    cursor.execute(f'''
                        UPDATE students 
                        SET first_name = {placeholder}, last_name = {placeholder}, primary_email = {placeholder}, secondary_email = {placeholder},
                            class_year = {placeholder}, rt_assignment = {placeholder}, nrt_assignment = {placeholder}, status = {placeholder},
                            phone_number = {placeholder}, hometown = {placeholder}, concentration = {placeholder}, secondary = {placeholder},
                            extracurricular_activities = {placeholder}, clinical_shadowing = {placeholder}, research_activities = {placeholder},
                            medical_interests = {placeholder}, program_interests = {placeholder},
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = {placeholder}
                    ''', (
                        student.first_name,
                        student.last_name,
                        student.primary_email,
                        student.secondary_email,
                        student.class_year,
                        student.rt_assignment,
                        student.nrt_assignment,
                        student.status or 'Not Applying',
                        student.phone_number or '',
                        student.hometown or '',
                        student.concentration or '',
                        student.secondary or '',
                        student.extracurricular_activities or '',
                        student.clinical_shadowing or '',
                        student.research_activities or '',
                        student.medical_interests or '',
                        student.program_interests or '',
                        student.row_index
                    ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error bulk updating students: {e}")
            return False
    
    # NRT operations
    def get_nrts(self) -> List[NonResidentTutor]:
        """Get all Non-Resident Tutors"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            cursor.execute('SELECT * FROM nrts ORDER BY id')
            rows = cursor.fetchall()
            conn.close()
            
            nrts = []
            for row in rows:
                class_year_counts = json.loads(row['class_year_counts'] or '{}')
                nrt = NonResidentTutor(
                    name=row['name'],
                    email=row['email'],
                    status=row['status'] or 'active',
                    total_students=row['total_students'] or 0,
                    class_year_counts=class_year_counts,
                    phone_number=row['phone_number'] if 'phone_number' in row.keys() else None,
                    harvard_affiliation=row['harvard_affiliation'] if 'harvard_affiliation' in row.keys() else None,
                    harvard_id_number=row['harvard_id_number'] if 'harvard_id_number' in row.keys() else None,
                    current_stage_training=row['current_stage_training'] if 'current_stage_training' in row.keys() else None,
                    time_in_boston=row['time_in_boston'] if 'time_in_boston' in row.keys() else None,
                    medical_interests=row['medical_interests'] if 'medical_interests' in row.keys() else None,
                    interests_outside_medicine=row['interests_outside_medicine'] if 'interests_outside_medicine' in row.keys() else None,
                    interested_in_shadowing=row['interested_in_shadowing'] if 'interested_in_shadowing' in row.keys() else None,
                    interested_in_research=row['interested_in_research'] if 'interested_in_research' in row.keys() else None,
                    interested_in_organizing_events=row['interested_in_organizing_events'] if 'interested_in_organizing_events' in row.keys() else None,
                    specific_events=row['specific_events'] if 'specific_events' in row.keys() else None,
                    row_index=row['id']
                )
                nrts.append(nrt)
            return nrts
        except Exception as e:
            print(f"Error getting NRTs: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def add_nrt(self, nrt: NonResidentTutor) -> bool:
        """Add a new NRT"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            placeholders = ', '.join([placeholder] * 16)
            cursor.execute(f'''
                INSERT INTO nrts (name, email, status, total_students, class_year_counts,
                    phone_number, harvard_affiliation, harvard_id_number, current_stage_training,
                    time_in_boston, medical_interests, interests_outside_medicine,
                    interested_in_shadowing, interested_in_research, interested_in_organizing_events,
                    specific_events)
                VALUES ({placeholders})
            ''', (
                nrt.name,
                nrt.email,
                nrt.status,
                nrt.total_students,
                json.dumps(nrt.class_year_counts or {}),
                nrt.phone_number,
                nrt.harvard_affiliation,
                nrt.harvard_id_number,
                nrt.current_stage_training,
                nrt.time_in_boston,
                nrt.medical_interests,
                nrt.interests_outside_medicine,
                nrt.interested_in_shadowing,
                nrt.interested_in_research,
                nrt.interested_in_organizing_events,
                nrt.specific_events
            ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error adding NRT: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def update_nrt(self, nrt: NonResidentTutor) -> bool:
        """Update an existing NRT"""
        try:
            if not nrt.row_index:
                return False
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            cursor.execute(f'''
                UPDATE nrts 
                SET name = {placeholder}, email = {placeholder}, status = {placeholder}, total_students = {placeholder}, 
                    class_year_counts = {placeholder}, phone_number = {placeholder}, harvard_affiliation = {placeholder},
                    harvard_id_number = {placeholder}, current_stage_training = {placeholder}, time_in_boston = {placeholder},
                    medical_interests = {placeholder}, interests_outside_medicine = {placeholder},
                    interested_in_shadowing = {placeholder}, interested_in_research = {placeholder},
                    interested_in_organizing_events = {placeholder}, specific_events = {placeholder},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {placeholder}
            ''', (
                nrt.name,
                nrt.email,
                nrt.status,
                nrt.total_students,
                json.dumps(nrt.class_year_counts or {}),
                nrt.phone_number,
                nrt.harvard_affiliation,
                nrt.harvard_id_number,
                nrt.current_stage_training,
                nrt.time_in_boston,
                nrt.medical_interests,
                nrt.interests_outside_medicine,
                nrt.interested_in_shadowing,
                nrt.interested_in_research,
                nrt.interested_in_organizing_events,
                nrt.specific_events,
                nrt.row_index
            ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error updating NRT: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def delete_nrt(self, row_index: int) -> bool:
        """Delete an NRT"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            cursor.execute(f'DELETE FROM nrts WHERE id = {placeholder}', (row_index,))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error deleting NRT: {e}")
            return False
    
    # RT operations
    def get_rts(self) -> List[ResidentTutor]:
        """Get all Resident Tutors"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            cursor.execute('SELECT * FROM rts ORDER BY id')
            rows = cursor.fetchall()
            conn.close()
            
            rts = []
            for row in rows:
                rt = ResidentTutor(
                    name=row['name'],
                    email=row['email'],
                    student_count=row['student_count'] or 0,
                    row_index=row['id']
                )
                rts.append(rt)
            return rts
        except Exception as e:
            print(f"Error getting RTs: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def add_rt(self, rt: ResidentTutor) -> bool:
        """Add a new RT"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            placeholders = ', '.join([placeholder] * 3)
            cursor.execute(f'''
                INSERT INTO rts (name, email, student_count)
                VALUES ({placeholders})
            ''', (
                rt.name,
                rt.email,
                rt.student_count
            ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error adding RT: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def update_rt(self, rt: ResidentTutor) -> bool:
        """Update an existing RT"""
        try:
            if not rt.row_index:
                return False
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            cursor.execute(f'''
                UPDATE rts 
                SET name = {placeholder}, email = {placeholder}, student_count = {placeholder}, updated_at = CURRENT_TIMESTAMP
                WHERE id = {placeholder}
            ''', (
                rt.name,
                rt.email,
                rt.student_count,
                rt.row_index
            ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error updating RT: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def delete_rt(self, row_index: int) -> bool:
        """Delete an RT"""
        try:
            conn = self._get_connection()
            cursor = self._get_cursor(conn)
            placeholder = self._get_placeholder()
            cursor.execute(f'DELETE FROM rts WHERE id = {placeholder}', (row_index,))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error deleting RT: {e}")
            return False
    
    # Email Template operations
    def get_email_templates(self):
        """Get all email templates"""
        conn = self._get_connection()
        cursor = self._get_cursor(conn)
        cursor.execute('SELECT * FROM email_templates ORDER BY name')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_email_template(self, template_id: int):
        """Get a specific email template"""
        conn = self._get_connection()
        cursor = self._get_cursor(conn)
        placeholder = self._get_placeholder()
        cursor.execute(f'SELECT * FROM email_templates WHERE id = {placeholder}', (template_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def get_email_template_by_name(self, name: str):
        """Get email template by name"""
        conn = self._get_connection()
        cursor = self._get_cursor(conn)
        placeholder = self._get_placeholder()
        cursor.execute(f'SELECT * FROM email_templates WHERE name = {placeholder}', (name,))
        row = cursor.fetchone()
        conn.close()
        # RealDictCursor already returns a dict-like object, so convert appropriately
        if row:
            if self.is_postgresql:
                # RealDictRow is already dict-like
                return dict(row)
            else:
                # SQLite Row needs conversion
                return dict(row)
        return None
    
    def add_email_template(self, name: str, subject: str, body: str):
        """Add a new email template"""
        conn = self._get_connection()
        cursor = self._get_cursor(conn)
        placeholder = self._get_placeholder()
        placeholders = ', '.join([placeholder] * 3)
        
        if self.is_postgresql:
            # Use RETURNING clause for PostgreSQL to get the inserted ID
            cursor.execute(f'''
                INSERT INTO email_templates (name, subject, body, updated_at)
                VALUES ({placeholders}, CURRENT_TIMESTAMP)
                RETURNING id
            ''', (name, subject, body))
            result = cursor.fetchone()
            # RealDictCursor returns a dictionary, so access by key
            template_id = result['id'] if result else None
        else:
            # SQLite uses lastrowid
            cursor.execute(f'''
                INSERT INTO email_templates (name, subject, body, updated_at)
                VALUES ({placeholders}, CURRENT_TIMESTAMP)
            ''', (name, subject, body))
            template_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        return template_id
    
    def update_email_template(self, template_id: int, name: str, subject: str, body: str):
        """Update an email template"""
        conn = self._get_connection()
        cursor = self._get_cursor(conn)
        placeholder = self._get_placeholder()
        cursor.execute(f'''
            UPDATE email_templates 
            SET name = {placeholder}, subject = {placeholder}, body = {placeholder}, updated_at = CURRENT_TIMESTAMP
            WHERE id = {placeholder}
        ''', (name, subject, body, template_id))
        conn.commit()
        conn.close()
        return cursor.rowcount > 0
    
    def delete_email_template(self, template_id: int):
        """Delete an email template"""
        conn = self._get_connection()
        cursor = self._get_cursor(conn)
        placeholder = self._get_placeholder()
        cursor.execute(f'DELETE FROM email_templates WHERE id = {placeholder}', (template_id,))
        conn.commit()
        conn.close()
        return cursor.rowcount > 0
    
    # Email History operations
    def add_email_history(self, student_id: int, subject: str, body: str, 
                         recipients: List[str], cc_recipients: List[str] = None, 
                         sent_by: str = None):
        """Add an email to history"""
        conn = self._get_connection()
        cursor = self._get_cursor(conn)
        placeholder = self._get_placeholder()
        placeholders = ', '.join([placeholder] * 6)
        cursor.execute(f'''
            INSERT INTO email_history 
            (student_id, email_subject, email_body, recipients, cc_recipients, sent_by)
            VALUES ({placeholders})
        ''', (
            student_id,
            subject,
            body,
            json.dumps(recipients),
            json.dumps(cc_recipients) if cc_recipients else None,
            sent_by
        ))
        if self.is_postgresql:
            cursor.execute("SELECT lastval()")
            history_id = cursor.fetchone()[0]
        else:
            history_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return history_id
    
    def get_email_history(self, student_id: int):
        """Get email history for a student"""
        conn = self._get_connection()
        cursor = self._get_cursor(conn)
        placeholder = self._get_placeholder()
        cursor.execute(f'''
            SELECT * FROM email_history 
            WHERE student_id = {placeholder} 
            ORDER BY sent_at DESC
        ''', (student_id,))
        rows = cursor.fetchall()
        conn.close()
        
        history = []
        for row in rows:
            history.append({
                'id': row['id'],
                'student_id': row['student_id'],
                'email_subject': row['email_subject'],
                'email_body': row['email_body'],
                'recipients': json.loads(row['recipients']),
                'cc_recipients': json.loads(row['cc_recipients']) if row['cc_recipients'] else [],
                'sent_at': row['sent_at'],
                'sent_by': row['sent_by']
            })
        return history
    
    def get_latest_email_history(self, student_id: int):
        """Get the most recent email for a student"""
        history = self.get_email_history(student_id)
        return history[0] if history else None

