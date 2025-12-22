"""Main Flask application for tutor assignment system"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta
from config import Config
from database_manager import DatabaseManager
from sheets_sync import SheetsSync
from sync_cache import SyncCache
from auth import request_verification_code, verify_code, is_verified, clear_verification
from email_service import send_assignment_email, send_bulk_assignment_emails
from models import Student, NonResidentTutor, ResidentTutor
from functools import wraps
import os
import json

app = Flask(__name__, static_folder=None)  # We'll handle static files manually
app.config.from_object(Config)

# Configure CORS
frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
cors_origins = [frontend_url]
if app.config.get('DEBUG'):
    # In development, allow localhost
    cors_origins.extend(['http://localhost:3000', 'http://127.0.0.1:3000'])
CORS(app, origins=cors_origins, supports_credentials=True)

jwt = JWTManager(app)

# Initialize database manager
db_manager = None
sheets_sync = None

def init_database():
    """Initialize database connection"""
    global db_manager
    if not db_manager:
        db_manager = DatabaseManager(app.config['DATABASE_PATH'])

def init_sheets_sync():
    """Initialize Google Sheets sync (optional, only if credentials are provided)"""
    global sheets_sync
    credentials_path = app.config.get('GOOGLE_CREDENTIALS_PATH')
    credentials_json = app.config.get('GOOGLE_CREDENTIALS_JSON')
    sheets_id = app.config.get('GOOGLE_SHEETS_ID')
    
    # Support both file path and base64-encoded JSON
    if not sheets_sync and sheets_id and (credentials_path or credentials_json):
        try:
            # Ensure database is initialized first
            init_database()
            
            # If base64 JSON is provided, decode and write to temp file
            if credentials_json and not credentials_path:
                import base64
                import tempfile
                decoded_credentials = base64.b64decode(credentials_json).decode('utf-8')
                # Create temporary file for credentials
                temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
                temp_file.write(decoded_credentials)
                temp_file.close()
                credentials_path = temp_file.name
            
            cache = SyncCache(
                cache_file_path=os.path.join(os.path.dirname(__file__), 'sync_cache.json'),
                cache_expiry_seconds=app.config.get('SYNC_CACHE_EXPIRY', 300)
            )
            sheets_sync = SheetsSync(
                credentials_path,
                sheets_id,
                db_manager,
                cache
            )
        except Exception as e:
            print(f"Warning: Could not initialize Google Sheets sync: {e}")
            print("App will work without sync functionality")
            import traceback
            traceback.print_exc()

def admin_required(f):
    """Decorator to require admin authentication"""
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            current_email = get_jwt_identity()
            print(f"[AUTH] admin_required: Checking {current_email} for endpoint {request.endpoint}")
            if not is_verified(current_email):
                print(f"[AUTH] admin_required: Email {current_email} is not verified - returning 403")
                return jsonify({'error': 'Email not verified. Please log in again.'}), 403
            print(f"[AUTH] admin_required: Email {current_email} is verified, proceeding to {request.endpoint}")
            return f(*args, **kwargs)
        except Exception as e:
            print(f"[AUTH] admin_required: Error checking auth: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': 'Authentication error'}), 403
    return decorated_function

# Authentication routes
@app.route('/api/auth/request-code', methods=['POST'])
def request_code():
    """Request verification code"""
    print("=" * 50)
    print("REQUEST RECEIVED: /api/auth/request-code")
    data = request.get_json()
    print(f"Request data: {data}")
    email = data.get('email', '').lower().strip()
    print(f"Processing verification code request for email: {email}")
    
    result = request_verification_code(email)
    print(f"Result: {result}")
    print("=" * 50)
    
    if 'error' in result:
        return jsonify(result), 400
    return jsonify(result), 200

@app.route('/api/auth/verify-code', methods=['POST'])
def verify_login():
    """Verify code and return JWT token"""
    data = request.get_json()
    email = data.get('email', '').lower().strip()
    code = data.get('code', '')
    
    result = verify_code(email, code)
    if not result.get('verified'):
        return jsonify(result), 400
    
    # Create JWT token with explicit expiration matching config
    expires_delta = timedelta(seconds=app.config.get('JWT_ACCESS_TOKEN_EXPIRES', 86400))
    access_token = create_access_token(identity=email, expires_delta=expires_delta)
    print(f"[AUTH] Created JWT token for {email}, expires in {expires_delta.total_seconds()} seconds")
    return jsonify({
        'access_token': access_token,
        'email': email
    }), 200

@app.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout and clear verification"""
    email = get_jwt_identity()
    clear_verification(email)
    return jsonify({'message': 'Logged out successfully'}), 200

# Student routes
@app.route('/api/students', methods=['GET'])
@admin_required
def get_students():
    """Get all students"""
    init_database()
    students = db_manager.get_students()
    return jsonify([s.__dict__ for s in students]), 200

@app.route('/api/students', methods=['POST'])
@admin_required
def add_student():
    """Add a new student"""
    init_database()
    data = request.get_json()
    
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    primary_email = data.get('primary_email', '').strip()
    secondary_email = data.get('secondary_email', '').strip() if data.get('secondary_email') else ''
    
    # Validate required fields
    if not first_name or not last_name:
        return jsonify({'error': 'First Name and Last Name are required'}), 400
    if not primary_email and not secondary_email:
        return jsonify({'error': 'At least one email (Primary or Secondary) is required'}), 400
    
    student = Student(
        first_name=first_name,
        last_name=last_name,
        primary_email=primary_email if primary_email else None,
        secondary_email=secondary_email if secondary_email else None,
        class_year=data.get('class_year'),
        rt_assignment=data.get('rt_assignment'),
        nrt_assignment=data.get('nrt_assignment'),
        status=data.get('status', 'Not Applying') or 'Not Applying',
        phone_number=data.get('phone_number'),
        hometown=data.get('hometown'),
        concentration=data.get('concentration'),
        secondary=data.get('secondary'),
        extracurricular_activities=data.get('extracurricular_activities'),
        clinical_shadowing=data.get('clinical_shadowing'),
        research_activities=data.get('research_activities'),
        medical_interests=data.get('medical_interests'),
        program_interests=data.get('program_interests')
    )
    
    if db_manager.add_student(student):
        return jsonify({'message': 'Student added successfully'}), 201
    return jsonify({'error': 'Failed to add student'}), 500

@app.route('/api/students/<int:row_index>', methods=['PUT'])
@admin_required
def update_student(row_index):
    """Update a student"""
    init_database()
    data = request.get_json()
    
    # Get existing student to preserve assignments if not provided
    existing_student = db_manager.get_student(row_index)
    if not existing_student:
        return jsonify({'error': 'Student not found'}), 404
    
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    primary_email = data.get('primary_email', '').strip()
    secondary_email = data.get('secondary_email', '').strip() if data.get('secondary_email') else ''
    
    # Validate required fields
    if not first_name or not last_name:
        return jsonify({'error': 'First Name and Last Name are required'}), 400
    if not primary_email and not secondary_email:
        return jsonify({'error': 'At least one email (Primary or Secondary) is required'}), 400
    
    # Use provided assignments (can be None to clear), or preserve existing if not provided
    rt_assignment = data.get('rt_assignment') if 'rt_assignment' in data else existing_student.rt_assignment
    nrt_assignment = data.get('nrt_assignment') if 'nrt_assignment' in data else existing_student.nrt_assignment
    
    # Convert empty strings to None
    if rt_assignment == '':
        rt_assignment = None
    if nrt_assignment == '':
        nrt_assignment = None
    
    student = Student(
        first_name=first_name,
        last_name=last_name,
        primary_email=primary_email if primary_email else None,
        secondary_email=secondary_email if secondary_email else None,
        class_year=data.get('class_year', existing_student.class_year),
        rt_assignment=rt_assignment,
        nrt_assignment=nrt_assignment,
        status=data.get('status', existing_student.status) or 'Not Applying',
        phone_number=data.get('phone_number', existing_student.phone_number),
        hometown=data.get('hometown', existing_student.hometown),
        concentration=data.get('concentration', existing_student.concentration),
        secondary=data.get('secondary', existing_student.secondary),
        extracurricular_activities=data.get('extracurricular_activities', existing_student.extracurricular_activities),
        clinical_shadowing=data.get('clinical_shadowing', existing_student.clinical_shadowing),
        research_activities=data.get('research_activities', existing_student.research_activities),
        medical_interests=data.get('medical_interests', existing_student.medical_interests),
        program_interests=data.get('program_interests', existing_student.program_interests),
        row_index=row_index
    )
    
    if db_manager.update_student(student):
        return jsonify({'message': 'Student updated successfully'}), 200
    return jsonify({'error': 'Failed to update student'}), 500

@app.route('/api/students/<int:row_index>', methods=['DELETE'])
@admin_required
def delete_student(row_index):
    """Delete a student (returns student data for undo)"""
    init_database()
    students = db_manager.get_students()
    student_to_delete = next((s for s in students if s.row_index == row_index), None)
    
    if not student_to_delete:
        return jsonify({'error': 'Student not found'}), 404
    
    student_data = student_to_delete.__dict__
    
    if db_manager.delete_student(row_index):
        return jsonify({
            'message': 'Student deleted successfully',
            'deleted_student': student_data
        }), 200
    return jsonify({'error': 'Failed to delete student'}), 500

@app.route('/api/students/restore', methods=['POST'])
@admin_required
def restore_student():
    """Restore a deleted student"""
    init_database()
    data = request.get_json()
    student_data = data.get('student')
    row_index = data.get('row_index')
    
    student = Student(
        first_name=student_data['first_name'],
        last_name=student_data['last_name'],
        primary_email=student_data['primary_email'],
        secondary_email=student_data.get('secondary_email'),
        class_year=student_data.get('class_year'),
        rt_assignment=student_data.get('rt_assignment'),
        nrt_assignment=student_data.get('nrt_assignment'),
        row_index=None  # Will be set on restore
    )
    
    if db_manager.restore_student(student, row_index):
        return jsonify({'message': 'Student restored successfully'}), 200
    return jsonify({'error': 'Failed to restore student'}), 500

# NRT routes
@app.route('/api/nrts', methods=['GET'])
@admin_required
def get_nrts():
    """Get all Non-Resident Tutors"""
    init_database()
    nrts = db_manager.get_nrts()
    students = db_manager.get_students()
    
    print(f"[GET_NRTS] Found {len(nrts)} NRTs from database")
    print(f"[GET_NRTS] Found {len(students)} students")
    
    # Calculate student counts dynamically from student assignments (matching by name)
    for nrt in nrts:
        assigned_students = [s for s in students if s.nrt_assignment and s.nrt_assignment.strip().lower() == nrt.name.strip().lower()]
        nrt.total_students = len(assigned_students)
        print(f"[GET_NRTS] NRT {nrt.name} (row {nrt.row_index}): {nrt.total_students} students")
        
        # Calculate class year counts dynamically
        class_year_counts = {}
        for student in assigned_students:
            if student.class_year:
                class_year = student.class_year.strip()
                class_year_counts[class_year] = class_year_counts.get(class_year, 0) + 1
        nrt.class_year_counts = class_year_counts
    
    result = [n.__dict__ for n in nrts]
    print(f"[GET_NRTS] Returning {len(result)} NRTs")
    return jsonify(result), 200

@app.route('/api/nrts', methods=['POST'])
@admin_required
def add_nrt():
    """Add a new NRT"""
    init_database()
    data = request.get_json()
    
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    
    # Validate required fields
    if not name or not email:
        return jsonify({'error': 'Name and Email are required'}), 400
    
    nrt = NonResidentTutor(
        name=name,
        email=email,
        status=data.get('status', 'active'),
        total_students=0,
        class_year_counts={},
        phone_number=data.get('phone_number'),
        harvard_affiliation=data.get('harvard_affiliation'),
        harvard_id_number=data.get('harvard_id_number'),
        current_stage_training=data.get('current_stage_training'),
        time_in_boston=data.get('time_in_boston'),
        medical_interests=data.get('medical_interests'),
        interests_outside_medicine=data.get('interests_outside_medicine'),
        interested_in_shadowing=data.get('interested_in_shadowing'),
        interested_in_research=data.get('interested_in_research'),
        interested_in_organizing_events=data.get('interested_in_organizing_events'),
        specific_events=data.get('specific_events')
    )
    
    if db_manager.add_nrt(nrt):
        return jsonify({'message': 'NRT added successfully'}), 201
    return jsonify({'error': 'Failed to add NRT'}), 500

@app.route('/api/nrts/<int:row_index>', methods=['PUT'])
@admin_required
def update_nrt(row_index):
    """Update an NRT"""
    init_database()
    data = request.get_json()
    
    # Get existing NRT to preserve values not provided in update
    existing_nrt = next((n for n in db_manager.get_nrts() if n.row_index == row_index), None)
    if not existing_nrt:
        return jsonify({'error': 'NRT not found'}), 404
    
    name = data.get('name', existing_nrt.name).strip()
    email = data.get('email', existing_nrt.email).strip()
    
    # Validate required fields
    if not name or not email:
        return jsonify({'error': 'Name and Email are required'}), 400
    
    nrt = NonResidentTutor(
        name=name,
        email=email,
        status=data.get('status', existing_nrt.status),
        total_students=data.get('total_students', existing_nrt.total_students),
        class_year_counts=data.get('class_year_counts', existing_nrt.class_year_counts),
        phone_number=data.get('phone_number', existing_nrt.phone_number),
        harvard_affiliation=data.get('harvard_affiliation', existing_nrt.harvard_affiliation),
        harvard_id_number=data.get('harvard_id_number', existing_nrt.harvard_id_number),
        current_stage_training=data.get('current_stage_training', existing_nrt.current_stage_training),
        time_in_boston=data.get('time_in_boston', existing_nrt.time_in_boston),
        medical_interests=data.get('medical_interests', existing_nrt.medical_interests),
        interests_outside_medicine=data.get('interests_outside_medicine', existing_nrt.interests_outside_medicine),
        interested_in_shadowing=data.get('interested_in_shadowing', existing_nrt.interested_in_shadowing),
        interested_in_research=data.get('interested_in_research', existing_nrt.interested_in_research),
        interested_in_organizing_events=data.get('interested_in_organizing_events', existing_nrt.interested_in_organizing_events),
        specific_events=data.get('specific_events', existing_nrt.specific_events),
        row_index=row_index
    )
    
    if db_manager.update_nrt(nrt):
        return jsonify({'message': 'NRT updated successfully'}), 200
    return jsonify({'error': 'Failed to update NRT'}), 500

@app.route('/api/nrts/<int:row_index>', methods=['DELETE'])
@admin_required
def delete_nrt(row_index):
    """Delete an NRT and clear assignments for affected students"""
    init_database()
    # Check if NRT has students
    students = db_manager.get_students()
    nrts = db_manager.get_nrts()
    # Find students assigned to this NRT by matching name
    nrt_to_delete = next((n for n in nrts if n.row_index == row_index), None)
    if nrt_to_delete:
        affected_students = [s for s in students if s.nrt_assignment and s.nrt_assignment.strip().lower() == nrt_to_delete.name.strip().lower()]
        # Clear NRT assignment for affected students
        for student in affected_students:
            student.nrt_assignment = None
            db_manager.update_student(student)
    else:
        affected_students = []
    
    if db_manager.delete_nrt(row_index):
        return jsonify({
            'message': 'NRT deleted successfully',
            'affected_students': [s.__dict__ for s in affected_students]
        }), 200
    return jsonify({'error': 'Failed to delete NRT'}), 500

# RT routes
@app.route('/api/rts', methods=['GET'])
@admin_required
def get_rts():
    """Get all Resident Tutors"""
    init_database()
    rts = db_manager.get_rts()
    students = db_manager.get_students()
    
    # Calculate student counts dynamically from student assignments (matching by name)
    for rt in rts:
        count = len([s for s in students if s.rt_assignment and s.rt_assignment.strip().lower() == rt.name.strip().lower()])
        rt.student_count = count
    
    return jsonify([r.__dict__ for r in rts]), 200

@app.route('/api/rts', methods=['POST'])
@admin_required
def add_rt():
    """Add a new RT"""
    init_database()
    data = request.get_json()
    
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    
    # Validate required fields
    if not name or not email:
        return jsonify({'error': 'Name and Email are required'}), 400
    
    rt = ResidentTutor(
        name=name,
        email=email,
        student_count=0
    )
    
    if db_manager.add_rt(rt):
        return jsonify({'message': 'RT added successfully'}), 201
    return jsonify({'error': 'Failed to add RT'}), 500

@app.route('/api/rts/<int:row_index>', methods=['PUT'])
@admin_required
def update_rt(row_index):
    """Update an RT"""
    init_database()
    data = request.get_json()
    
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    
    # Validate required fields
    if not name or not email:
        return jsonify({'error': 'Name and Email are required'}), 400
    
    rt = ResidentTutor(
        name=name,
        email=email,
        student_count=data.get('student_count', 0),
        row_index=row_index
    )
    
    if db_manager.update_rt(rt):
        return jsonify({'message': 'RT updated successfully'}), 200
    return jsonify({'error': 'Failed to update RT'}), 500

@app.route('/api/rts/<int:row_index>', methods=['DELETE'])
@admin_required
def delete_rt(row_index):
    """Delete an RT"""
    init_database()
    if db_manager.delete_rt(row_index):
        return jsonify({'message': 'RT deleted successfully'}), 200
    return jsonify({'error': 'Failed to delete RT'}), 500

# Assignment routes
@app.route('/api/assignments/assign-rt', methods=['POST'])
@admin_required
def assign_rt():
    """Assign a Resident Tutor to a student"""
    init_database()
    data = request.get_json()
    student_row_index = data.get('student_row_index')
    rt_email = data.get('rt_email')
    
    # Get all students and RTs
    students = db_manager.get_students()
    rts = db_manager.get_rts()
    
    student = next((s for s in students if s.row_index == student_row_index), None)
    rt = next((r for r in rts if r.email == rt_email), None)
    
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    if not rt:
        return jsonify({'error': 'RT not found'}), 404
    
    # Update student's RT assignment (store name, not email)
    old_rt_name = student.rt_assignment
    student.rt_assignment = rt.name
    
    # Update RT counts
    if old_rt_name:
        old_rt = next((r for r in rts if r.name.strip().lower() == old_rt_name.strip().lower()), None)
        if old_rt:
            old_rt.student_count = max(0, old_rt.student_count - 1)
            db_manager.update_rt(old_rt)
    
    rt.student_count += 1
    db_manager.update_rt(rt)
    db_manager.update_student(student)
    
    return jsonify({
        'message': 'RT assigned successfully',
        'rt_student_count': rt.student_count
    }), 200

@app.route('/api/assignments/remove-rt', methods=['POST'])
@admin_required
def remove_rt():
    """Remove RT assignment from a student"""
    init_database()
    data = request.get_json()
    student_row_index = data.get('student_row_index')
    
    students = db_manager.get_students()
    rts = db_manager.get_rts()
    
    student = next((s for s in students if s.row_index == student_row_index), None)
    if not student or not student.rt_assignment:
        return jsonify({'error': 'Student has no RT assignment'}), 404
    
    # Match RT by name (since rt_assignment contains name, not email)
    rt = next((r for r in rts if r.name.strip().lower() == student.rt_assignment.strip().lower()), None)
    if rt:
        rt.student_count = max(0, rt.student_count - 1)
        db_manager.update_rt(rt)
    
    student.rt_assignment = None
    db_manager.update_student(student)
    
    return jsonify({'message': 'RT removed successfully'}), 200

@app.route('/api/assignments/assign-nrt', methods=['POST'])
@admin_required
def assign_nrt():
    """Assign a Non-Resident Tutor to a student"""
    init_database()
    data = request.get_json()
    student_row_index = data.get('student_row_index')
    nrt_email = data.get('nrt_email')
    
    students = db_manager.get_students()
    nrts = db_manager.get_nrts()
    
    student = next((s for s in students if s.row_index == student_row_index), None)
    nrt = next((n for n in nrts if n.email == nrt_email), None)
    
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    if not nrt:
        return jsonify({'error': 'NRT not found'}), 404
    
    # Calculate current student count dynamically (don't rely on stored total_students)
    # Count students currently assigned to this NRT (matching by name)
    currently_assigned_students = [s for s in students 
                                    if s.nrt_assignment and s.nrt_assignment.strip().lower() == nrt.name.strip().lower()]
    current_count = len(currently_assigned_students)
    
    # Check if student is already assigned to this NRT
    student_already_assigned = (student.nrt_assignment and 
                                student.nrt_assignment.strip().lower() == nrt.name.strip().lower())
    
    # If student is not already assigned, check capacity before assigning
    if not student_already_assigned:
        # Check hard constraint: max 3 students (using dynamically calculated count)
        if current_count >= 3:
            return jsonify({'error': 'NRT already has maximum number of students (3)'}), 400
    
    # Check status (normalize to lowercase and handle empty/None as 'active')
    # Only allow exactly 'active' status (not "pending approval", "active, but does not want additional students", or "leaving, but keeping students")
    nrt_status_raw = nrt.status or ''
    nrt_status = nrt_status_raw.strip().lower()
    print(f"[ASSIGN_NRT] NRT: {nrt.name}, Email: {nrt.email}, Raw status: '{nrt_status_raw}', Normalized: '{nrt_status}', Type: {type(nrt_status_raw)}")
    
    # Reject 'pending approval' status
    if nrt_status == 'pending approval':
        print(f"[ASSIGN_NRT] Rejecting NRT {nrt.name} - status is 'pending approval'")
        return jsonify({'error': 'NRT is pending approval and cannot be assigned students yet'}), 400
    
    # Allow 'active' (any case) or empty/None (which defaults to active)
    # Reject if status is set and is not exactly 'active' (case-insensitive)
    if nrt_status and nrt_status != 'active':
        print(f"[ASSIGN_NRT] Rejecting NRT {nrt.name} - status is '{nrt_status}' (not 'active')")
        return jsonify({'error': f'NRT is not active (status: {nrt_status_raw})'}), 400
    # If status is empty/None, treat as active (default behavior)
    print(f"[ASSIGN_NRT] Status check passed for NRT {nrt.name}")
    
    # Update student's NRT assignment (store name, not email)
    old_nrt_name = student.nrt_assignment
    student.nrt_assignment = nrt.name
    
    # Update NRT counts
    if old_nrt_name:
        old_nrt = next((n for n in nrts if n.name.strip().lower() == old_nrt_name.strip().lower()), None)
        if old_nrt:
            old_nrt.total_students = max(0, old_nrt.total_students - 1)
            if student.class_year in old_nrt.class_year_counts:
                old_nrt.class_year_counts[student.class_year] = max(
                    0, old_nrt.class_year_counts[student.class_year] - 1
                )
            db_manager.update_nrt(old_nrt)
    
    nrt.total_students += 1
    if student.class_year:
        if student.class_year not in nrt.class_year_counts:
            nrt.class_year_counts[student.class_year] = 0
        nrt.class_year_counts[student.class_year] += 1
    
    db_manager.update_nrt(nrt)
    db_manager.update_student(student)
    
    return jsonify({
        'message': 'NRT assigned successfully',
        'nrt_total_students': nrt.total_students,
        'nrt_class_year_counts': nrt.class_year_counts
    }), 200

@app.route('/api/assignments/remove-nrt', methods=['POST'])
@admin_required
def remove_nrt():
    """Remove NRT assignment from a student"""
    init_database()
    data = request.get_json()
    student_row_index = data.get('student_row_index')
    
    students = db_manager.get_students()
    nrts = db_manager.get_nrts()
    
    student = next((s for s in students if s.row_index == student_row_index), None)
    if not student or not student.nrt_assignment:
        return jsonify({'error': 'Student has no NRT assignment'}), 404
    
    # Match NRT by name (since nrt_assignment contains name, not email)
    nrt = next((n for n in nrts if n.name.strip().lower() == student.nrt_assignment.strip().lower()), None)
    if nrt:
        nrt.total_students = max(0, nrt.total_students - 1)
        if student.class_year and student.class_year in nrt.class_year_counts:
            nrt.class_year_counts[student.class_year] = max(
                0, nrt.class_year_counts[student.class_year] - 1
            )
        db_manager.update_nrt(nrt)
    
    student.nrt_assignment = None
    db_manager.update_student(student)
    
    return jsonify({'message': 'NRT removed successfully'}), 200

# Bulk operations
@app.route('/api/students/bulk', methods=['POST'])
@admin_required
def bulk_add_students():
    """Bulk add students from CSV data"""
    init_database()
    data = request.get_json()
    students_data = data.get('students', [])
    
    results = {'success': 0, 'failed': 0}
    for student_data in students_data:
        first_name = student_data.get('first_name', '').strip()
        last_name = student_data.get('last_name', '').strip()
        primary_email = student_data.get('primary_email', '').strip()
        secondary_email = student_data.get('secondary_email', '').strip() if student_data.get('secondary_email') else ''
        
        # Validate required fields
        if not first_name or not last_name or (not primary_email and not secondary_email):
            results['failed'] += 1
            continue
        
        student = Student(
            first_name=first_name,
            last_name=last_name,
            primary_email=primary_email if primary_email else None,
            secondary_email=secondary_email if secondary_email else None,
            class_year=student_data.get('class_year')
        )
        if db_manager.add_student(student):
            results['success'] += 1
        else:
            results['failed'] += 1
    
    return jsonify(results), 200

@app.route('/api/nrts/bulk', methods=['POST'])
@admin_required
def bulk_add_nrts():
    """Bulk add NRTs from CSV data"""
    init_database()
    data = request.get_json()
    nrts_data = data.get('nrts', [])
    
    results = {'success': 0, 'failed': 0}
    for nrt_data in nrts_data:
        name = nrt_data.get('name', '').strip()
        email = nrt_data.get('email', '').strip()
        
        # Validate required fields
        if not name or not email:
            results['failed'] += 1
            continue
        
        nrt = NonResidentTutor(
            name=name,
            email=email,
            status='active'
        )
        if db_manager.add_nrt(nrt):
            results['success'] += 1
        else:
            results['failed'] += 1
    
    return jsonify(results), 200

# Email routes
@app.route('/api/email/send', methods=['POST'])
@admin_required
def send_email():
    """Send assignment email to a student"""
    init_database()
    data = request.get_json()
    student_row_index = data.get('student_row_index')
    email_template = data.get('email_template')
    
    students = db_manager.get_students()
    rts = db_manager.get_rts()
    nrts = db_manager.get_nrts()
    
    student = next((s for s in students if s.row_index == student_row_index), None)
    
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    # Get RT and NRT names from assignments, then look up their emails
    rt_name = student.rt_assignment
    nrt_name = student.nrt_assignment
    rt_email = None
    nrt_email = None
    
    if rt_name:
        rt = next((r for r in rts if r.name.strip().lower() == rt_name.strip().lower()), None)
        if rt:
            rt_email = rt.email
    
    if nrt_name:
        nrt = next((n for n in nrts if n.name.strip().lower() == nrt_name.strip().lower()), None)
        if nrt:
            nrt_email = nrt.email
    
    if send_assignment_email(student, rt_email, nrt_email, email_template, rt_name, nrt_name):
        return jsonify({'message': 'Email sent successfully'}), 200
    return jsonify({'error': 'Failed to send email'}), 500

@app.route('/api/email/send-bulk', methods=['POST'])
@admin_required
def send_bulk_emails():
    """Send assignment emails to multiple students"""
    init_database()
    data = request.get_json()
    student_row_indices = data.get('student_row_indices', [])
    email_template = data.get('email_template')
    
    students = db_manager.get_students()
    selected_students = [s for s in students if s.row_index in student_row_indices]
    
    results = send_bulk_assignment_emails(selected_students, email_template)
    return jsonify(results), 200

# Statistics/helper routes
@app.route('/api/stats', methods=['GET'])
@admin_required
def get_stats():
    """Get statistics about assignments"""
    init_database()
    students = db_manager.get_students()
    rts = db_manager.get_rts()
    nrts = db_manager.get_nrts()
    
    # Calculate RT student counts dynamically from student assignments (matching by name)
    rt_counts = {}
    for rt in rts:
        count = len([s for s in students if s.rt_assignment and s.rt_assignment.strip().lower() == rt.name.strip().lower()])
        rt_counts[rt.email] = count
    
    # Calculate NRT student counts dynamically from student assignments (matching by name)
    nrt_counts = {}
    nrt_class_year_counts = {}
    for nrt in nrts:
        assigned_students = [s for s in students if s.nrt_assignment and s.nrt_assignment.strip().lower() == nrt.name.strip().lower()]
        count = len(assigned_students)
        nrt_counts[nrt.email] = count
        
        # Calculate class year counts for NRTs
        class_year_counts = {}
        for student in assigned_students:
            if student.class_year:
                class_year = student.class_year.strip()
                class_year_counts[class_year] = class_year_counts.get(class_year, 0) + 1
        nrt_class_year_counts[nrt.email] = class_year_counts
    
    # Calculate unassigned students for RTs and NRTs separately
    unassigned_rt_students = [s for s in students if not s.rt_assignment]
    unassigned_nrt_students = [s for s in students if not s.nrt_assignment]
    
    # Check for active NRTs (status is 'active' or blank, not 'pending approval', and has less than 3 students)
    active_nrts = []
    for nrt in nrts:
        status = (nrt.status or '').strip().lower()
        student_count = nrt_counts.get(nrt.email, 0)
        if (status == 'active' or status == '') and status != 'pending approval' and student_count < 3:
            active_nrts.append(nrt)
    
    stats = {
        'total_students': len(students),
        'total_rts': len(rts),
        'total_nrts': len(nrts),
        'unassigned_rt_students_count': len(unassigned_rt_students),
        'unassigned_nrt_students_count': len(unassigned_nrt_students),
        'active_nrts': len(active_nrts),
        'rt_assignments': rt_counts,
        'nrt_assignments': nrt_counts,
        'nrt_class_year_counts': nrt_class_year_counts
    }
    
    return jsonify(stats), 200

# Sync routes
@app.route('/api/sync/to-sheets', methods=['POST'])
@admin_required
def sync_to_sheets():
    """Sync database to Google Sheets"""
    init_database()
    init_sheets_sync()
    
    if not sheets_sync:
        return jsonify({'error': 'Google Sheets sync not configured. Please set GOOGLE_SHEETS_ID and GOOGLE_CREDENTIALS_PATH in .env'}), 400
    
    data = request.get_json() or {}
    force = data.get('force', False)
    
    result = sheets_sync.sync_to_sheets(force=force)
    
    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify(result), 500

@app.route('/api/sync/from-sheets', methods=['POST'])
@admin_required
def sync_from_sheets():
    """Sync Google Sheets to database"""
    init_database()
    init_sheets_sync()
    
    if not sheets_sync:
        return jsonify({'error': 'Google Sheets sync not configured. Please set GOOGLE_SHEETS_ID and GOOGLE_CREDENTIALS_PATH in .env'}), 400
    
    data = request.get_json() or {}
    force = data.get('force', False)
    
    result = sheets_sync.sync_from_sheets(force=force)
    
    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify(result), 500

@app.route('/api/sync/status', methods=['GET'])
@admin_required
def get_sync_status():
    """Get sync status and cache information"""
    init_sheets_sync()
    
    if not sheets_sync:
        return jsonify({
            'configured': False,
            'message': 'Google Sheets sync not configured'
        }), 200
    
    status = sheets_sync.get_sync_status()
    status['configured'] = True
    return jsonify(status), 200

# Email Template routes
@app.route('/api/email-templates', methods=['GET'])
@admin_required
def get_email_templates():
    """Get all email templates"""
    init_database()
    templates = db_manager.get_email_templates()
    return jsonify(templates), 200

@app.route('/api/email-templates', methods=['POST'])
@admin_required
def create_email_template():
    """Create a new email template"""
    init_database()
    data = request.get_json()
    
    name = data.get('name', '').strip()
    subject = data.get('subject', '').strip()
    body = data.get('body', '').strip()
    
    if not name or not subject or not body:
        return jsonify({'error': 'Name, subject, and body are required'}), 400
    
    try:
        template_id = db_manager.add_email_template(name, subject, body)
        return jsonify({'id': template_id, 'message': 'Template created successfully'}), 201
    except Exception as e:
        return jsonify({'error': f'Failed to create template: {str(e)}'}), 500

@app.route('/api/email-templates/<int:template_id>', methods=['PUT'])
@admin_required
def update_email_template(template_id):
    """Update an email template"""
    init_database()
    data = request.get_json()
    
    name = data.get('name', '').strip()
    subject = data.get('subject', '').strip()
    body = data.get('body', '').strip()
    
    if not name or not subject or not body:
        return jsonify({'error': 'Name, subject, and body are required'}), 400
    
    try:
        success = db_manager.update_email_template(template_id, name, subject, body)
        if success:
            return jsonify({'message': 'Template updated successfully'}), 200
        else:
            return jsonify({'error': 'Template not found'}), 404
    except Exception as e:
        return jsonify({'error': f'Failed to update template: {str(e)}'}), 500

@app.route('/api/email-templates/<int:template_id>', methods=['DELETE'])
@admin_required
def delete_email_template(template_id):
    """Delete an email template"""
    init_database()
    try:
        success = db_manager.delete_email_template(template_id)
        if success:
            return jsonify({'message': 'Template deleted successfully'}), 200
        else:
            return jsonify({'error': 'Template not found'}), 404
    except Exception as e:
        return jsonify({'error': f'Failed to delete template: {str(e)}'}), 500

# Email History routes
@app.route('/api/students/<int:student_id>/email-history', methods=['GET'])
@admin_required
def get_student_email_history(student_id):
    """Get email history for a student"""
    init_database()
    history = db_manager.get_email_history(student_id)
    return jsonify(history), 200

# Email Preview and Sending routes
@app.route('/api/email/preview', methods=['POST'])
@admin_required
def preview_email():
    """Preview a rendered email for a student"""
    init_database()
    data = request.get_json()
    
    student_id = data.get('student_id')
    template_name = data.get('template_name')  # 'With NRT' or 'Without NRT'
    additional_cc = data.get('additional_cc', '')  # Comma-separated emails
    
    if not student_id or not template_name:
        return jsonify({'error': 'student_id and template_name are required'}), 400
    
    # Get student
    students = db_manager.get_students()
    student = next((s for s in students if s.row_index == student_id), None)
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    # Get template
    template = db_manager.get_email_template_by_name(template_name)
    if not template:
        return jsonify({'error': f'Template "{template_name}" not found'}), 404
    
    # Get RT and NRT if assigned
    rt = None
    nrt = None
    if student.rt_assignment:
        rts = db_manager.get_rts()
        rt = next((r for r in rts if r.name.strip().lower() == student.rt_assignment.strip().lower()), None)
    
    if student.nrt_assignment:
        nrts = db_manager.get_nrts()
        nrt = next((n for n in nrts if n.name.strip().lower() == student.nrt_assignment.strip().lower()), None)
    
    # Render template
    rendered_subject = render_email_template(template['subject'], student, rt, nrt)
    rendered_body = render_email_template(template['body'], student, rt, nrt)
    
    # Determine recipients
    student_email = student.primary_email or student.secondary_email
    if not student_email:
        return jsonify({'error': 'Student has no email address'}), 400
    
    cc_emails = []
    if rt and rt.email:
        cc_emails.append(rt.email)
    if nrt and nrt.email:
        cc_emails.append(nrt.email)
    
    # Add additional CC emails
    if additional_cc:
        additional_emails = [e.strip() for e in additional_cc.split(',') if e.strip()]
        cc_emails.extend(additional_emails)
    
    return jsonify({
        'subject': rendered_subject,
        'body': rendered_body,
        'to': student_email,
        'cc': cc_emails
    }), 200

@app.route('/api/email/send-template', methods=['POST'])
@admin_required
def send_student_email():
    """Send an email to a student"""
    init_database()
    data = request.get_json()
    
    student_id = data.get('student_id')
    template_name = data.get('template_name')
    additional_cc = data.get('additional_cc', '')
    
    if not student_id or not template_name:
        return jsonify({'error': 'student_id and template_name are required'}), 400
    
    # Get student
    students = db_manager.get_students()
    student = next((s for s in students if s.row_index == student_id), None)
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    
    # Get template
    template = db_manager.get_email_template_by_name(template_name)
    if not template:
        return jsonify({'error': f'Template "{template_name}" not found'}), 404
    
    # Get RT and NRT if assigned
    rt = None
    nrt = None
    if student.rt_assignment:
        rts = db_manager.get_rts()
        rt = next((r for r in rts if r.name.strip().lower() == student.rt_assignment.strip().lower()), None)
    
    if student.nrt_assignment:
        nrts = db_manager.get_nrts()
        nrt = next((n for n in nrts if n.name.strip().lower() == student.nrt_assignment.strip().lower()), None)
    
    # Render template
    rendered_subject = render_email_template(template['subject'], student, rt, nrt)
    rendered_body = render_email_template(template['body'], student, rt, nrt)
    
    # Determine recipients
    student_email = student.primary_email or student.secondary_email
    if not student_email:
        return jsonify({'error': 'Student has no email address'}), 400
    
    cc_emails = []
    if rt and rt.email:
        cc_emails.append(rt.email)
    if nrt and nrt.email:
        cc_emails.append(nrt.email)
    
    # Add additional CC emails
    if additional_cc:
        additional_emails = [e.strip() for e in additional_cc.split(',') if e.strip()]
        cc_emails.extend(additional_emails)
    
    # Send email
    try:
        from email_service import send_email_with_cc
        send_email_with_cc(
            to_email=student_email,
            subject=rendered_subject,
            body=rendered_body,
            cc_emails=cc_emails
        )
        
        # Save to history
        db_manager.add_email_history(
            student_id=student.row_index,
            subject=rendered_subject,
            body=rendered_body,
            recipients=[student_email],
            cc_recipients=cc_emails,
            sent_by=get_jwt_identity()
        )
        
        return jsonify({'message': 'Email sent successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500

def render_email_template(template: str, student: Student, rt: ResidentTutor = None, nrt: NonResidentTutor = None) -> str:
    """Render email template with placeholders replaced"""
    rendered = template
    
    # Student placeholders
    rendered = rendered.replace('{Student}', f"{student.first_name} {student.last_name}")
    rendered = rendered.replace('{StudentFirstName}', student.first_name)
    rendered = rendered.replace('{StudentLastName}', student.last_name)
    rendered = rendered.replace('{ClassYear}', student.class_year or '')
    
    # RT placeholders
    if rt:
        rendered = rendered.replace('{RT}', rt.name)
        rendered = rendered.replace('{RTEmail}', rt.email)
    else:
        rendered = rendered.replace('{RT}', '')
        rendered = rendered.replace('{RTEmail}', '')
    
    # NRT placeholders
    if nrt:
        rendered = rendered.replace('{NRT}', nrt.name)
        rendered = rendered.replace('{NRTEmail}', nrt.email)
    else:
        rendered = rendered.replace('{NRT}', '')
        rendered = rendered.replace('{NRTEmail}', '')
    
    return rendered

# Test email endpoint
@app.route('/api/email/test', methods=['POST'])
@admin_required
def test_email():
    """Send a test email to verify email configuration"""
    init_database()
    data = request.get_json()
    test_email_address = data.get('email', '')
    
    if not test_email_address:
        return jsonify({'error': 'Email address is required'}), 400
    
    try:
        from email_service import send_email_with_cc
        test_subject = 'Test Email - Tutor Assignment System'
        test_body = """This is a test email from the Tutor Assignment System.

If you received this email, your email configuration is working correctly!

Email settings:
- Host: {host}
- Port: {port}
- From: {from_email}

You can now use the email sending functionality in the workflow.
        """.format(
            host=app.config.get('EMAIL_HOST', 'N/A'),
            port=app.config.get('EMAIL_PORT', 'N/A'),
            from_email=app.config.get('EMAIL_USER', 'N/A')
        )
        
        success = send_email_with_cc(
            to_email=test_email_address,
            subject=test_subject,
            body=test_body,
            cc_emails=[]
        )
        
        if success:
            return jsonify({
                'message': f'Test email sent successfully to {test_email_address}',
                'success': True
            }), 200
        else:
            return jsonify({
                'error': 'Failed to send test email. Check server logs for details.',
                'success': False
            }), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f'Error sending test email: {str(e)}',
            'success': False
        }), 500

# Serve React static files in production
if not app.config.get('DEBUG'):
    frontend_build_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build')
    if os.path.exists(frontend_build_path):
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_frontend(path):
            """Serve React app for all non-API routes"""
            # Don't interfere with API routes
            if path.startswith('api/'):
                return jsonify({'error': 'Not found'}), 404
            
            # Serve static files if they exist
            if path and os.path.exists(os.path.join(frontend_build_path, path)):
                return send_from_directory(frontend_build_path, path)
            
            # Serve index.html for React Router (SPA routing)
            return send_from_directory(frontend_build_path, 'index.html')

# Error handlers for production
@app.errorhandler(404)
def not_found(error):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    # For non-API routes, let React handle it (if serving frontend)
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    if app.config.get('DEBUG'):
        import traceback
        return jsonify({
            'error': str(error),
            'traceback': traceback.format_exc()
        }), 500
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Only run Flask dev server in development
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=app.config.get('DEBUG', False), host='0.0.0.0', port=port)

