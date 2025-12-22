"""Google Sheets sync operations with caching"""
import gspread
from google.oauth2.service_account import Credentials
from typing import List, Optional
from models import Student, NonResidentTutor, ResidentTutor
from database_manager import DatabaseManager
from sync_cache import SyncCache
from datetime import datetime

class SheetsSync:
    """Manages sync between SQLite database and Google Sheets"""
    
    SCOPES = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ]
    
    def __init__(self, credentials_path: str, sheet_id: str, database_manager: DatabaseManager, 
                 cache: SyncCache):
        """Initialize Google Sheets sync"""
        self.credentials_path = credentials_path
        self.sheet_id = sheet_id
        self.database_manager = database_manager
        self.cache = cache
        self.client = None
        self.spreadsheet = None
        self._connect()
    
    def _connect(self):
        """Establish connection to Google Sheets"""
        try:
            creds = Credentials.from_service_account_file(
                self.credentials_path,
                scopes=self.SCOPES
            )
            self.client = gspread.authorize(creds)
            self.spreadsheet = self.client.open_by_key(self.sheet_id)
        except Exception as e:
            print(f"Error connecting to Google Sheets: {e}")
            raise
    
    def _get_file_modification_time(self) -> Optional[str]:
        """Get the modification time of the Google Sheets file"""
        try:
            # Use gspread's built-in method to get file metadata
            # The spreadsheet object has metadata we can access
            # For now, return None if we can't get it - cache will still work based on time
            # In a production setup, you might want to use Drive API directly
            return None  # Simplified - can be enhanced with Drive API if needed
        except Exception as e:
            print(f"Error getting file modification time: {e}")
            return None
    
    def sync_to_sheets(self, force: bool = False) -> dict:
        """
        Export SQLite data to Google Sheets
        
        Args:
            force: If True, sync regardless of cache
        
        Returns:
            dict with success status and message
        """
        try:
            # Check cache
            if not force and not self.cache.should_sync('to_sheets'):
                return {
                    'success': True,
                    'message': 'Sync skipped - cache is still valid',
                    'cached': True
                }
            
            print("[SYNC] Starting sync to Google Sheets...")
            
            # Get data from database
            students = self.database_manager.get_students()
            nrts = self.database_manager.get_nrts()
            rts = self.database_manager.get_rts()
            
            # Calculate student counts for NRTs and RTs (like in the API endpoints)
            print(f"[SYNC] Calculating student counts for {len(nrts)} NRTs and {len(rts)} RTs...")
            
            # Calculate NRT student counts dynamically from student assignments (matching by name)
            for nrt in nrts:
                assigned_students = [s for s in students if s.nrt_assignment and s.nrt_assignment.strip().lower() == nrt.name.strip().lower()]
                nrt.total_students = len(assigned_students)
                
                # Calculate class year counts dynamically
                class_year_counts = {}
                for student in assigned_students:
                    if student.class_year:
                        class_year = student.class_year.strip()
                        class_year_counts[class_year] = class_year_counts.get(class_year, 0) + 1
                nrt.class_year_counts = class_year_counts
                print(f"[SYNC] NRT {nrt.name}: {nrt.total_students} students, class_year_counts: {class_year_counts}")
            
            # Calculate RT student counts dynamically from student assignments (matching by name)
            for rt in rts:
                assigned_students = [s for s in students if s.rt_assignment and s.rt_assignment.strip().lower() == rt.name.strip().lower()]
                rt.student_count = len(assigned_students)
                print(f"[SYNC] RT {rt.name}: {rt.student_count} students")
            
            # Sync Students
            students_sheet = self.spreadsheet.worksheet('Students')
            self._sync_students_to_sheets(students_sheet, students)
            
            # Sync NRTs
            nrts_sheet = self.spreadsheet.worksheet('Non-Resident Tutors')
            print(f"[SYNC] Syncing {len(nrts)} NRTs to Google Sheets...")
            self._sync_nrts_to_sheets(nrts_sheet, nrts)
            print(f"[SYNC] NRTs sync completed")
            
            # Sync RTs
            rts_sheet = self.spreadsheet.worksheet('Resident Tutors')
            self._sync_rts_to_sheets(rts_sheet, rts)
            
            # Update cache
            self.cache.record_sync('to_sheets')
            
            print("[SYNC] Successfully synced to Google Sheets")
            return {
                'success': True,
                'message': f'Synced {len(students)} students, {len(nrts)} NRTs, {len(rts)} RTs to Google Sheets',
                'cached': False
            }
        except Exception as e:
            print(f"Error syncing to Google Sheets: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'message': f'Error syncing to Google Sheets: {str(e)}',
                'cached': False
            }
    
    def sync_from_sheets(self, force: bool = False) -> dict:
        """
        Import Google Sheets data to SQLite
        
        Args:
            force: If True, sync regardless of cache
        
        Returns:
            dict with success status and message
        """
        try:
            # Get file modification time
            file_mod_time = self._get_file_modification_time()
            
            # Check cache
            if not force and not self.cache.should_sync('from_sheets', file_mod_time):
                return {
                    'success': True,
                    'message': 'Sync skipped - file has not changed since last sync',
                    'cached': True
                }
            
            print("[SYNC] Starting sync from Google Sheets...")
            
            # Import Students
            students_sheet = self.spreadsheet.worksheet('Students')
            students = self._sync_students_from_sheets(students_sheet)
            
            # Import NRTs
            nrts_sheet = self.spreadsheet.worksheet('Non-Resident Tutors')
            nrts = self._sync_nrts_from_sheets(nrts_sheet)
            
            # Import RTs
            rts_sheet = self.spreadsheet.worksheet('Resident Tutors')
            rts = self._sync_rts_from_sheets(rts_sheet)
            
            # Update cache
            self.cache.record_sync('from_sheets', file_mod_time)
            
            print(f"[SYNC] Successfully synced from Google Sheets: {len(students)} students, {len(nrts)} NRTs, {len(rts)} RTs")
            return {
                'success': True,
                'message': f'Synced {len(students)} students, {len(nrts)} NRTs, {len(rts)} RTs from Google Sheets',
                'cached': False
            }
        except Exception as e:
            print(f"Error syncing from Google Sheets: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'message': f'Error syncing from Google Sheets: {str(e)}',
                'cached': False
            }
    
    def _sync_students_to_sheets(self, sheet, students: List[Student]):
        """Sync students to Google Sheets"""
        # Clear existing data (keep header)
        if sheet.row_count > 1:
            sheet.delete_rows(2, sheet.row_count)
        
        # Write header - include all optional fields
        header = ['First Name', 'Last Name', 'Primary Email', 'Secondary Email', 
                  'Class Year', 'Status', 'NRT Assignment', 'RT Assignment',
                  'Phone Number', 'Hometown', 'Concentration', 'Secondary',
                  'Extracurricular Activities', 'Clinical Shadowing', 'Research Activities',
                  'Medical Interests', 'Program Interests']
        # Calculate column range (A to Q = 17 columns)
        sheet.update('A1:Q1', [header])
        
        # Write data
        if students:
            rows = []
            for student in students:
                rows.append([
                    student.first_name,
                    student.last_name,
                    student.primary_email or '',
                    student.secondary_email or '',
                    student.class_year or '',
                    student.status or 'Not Applying',
                    student.nrt_assignment or '',
                    student.rt_assignment or '',
                    student.phone_number or '',
                    student.hometown or '',
                    student.concentration or '',
                    student.secondary or '',
                    student.extracurricular_activities or '',
                    student.clinical_shadowing or '',
                    student.research_activities or '',
                    student.medical_interests or '',
                    student.program_interests or ''
                ])
            sheet.append_rows(rows)
    
    def _sync_students_from_sheets(self, sheet) -> List[Student]:
        """Sync students from Google Sheets to database"""
        records = sheet.get_all_records()
        students = []
        
        for idx, record in enumerate(records, start=2):
            first_name = record.get('First Name', '').strip()
            last_name = record.get('Last Name', '').strip()
            primary_email = record.get('Primary Email', '').strip()
            secondary_email = record.get('Secondary Email', '').strip()
            
            if first_name and last_name and (primary_email or secondary_email):
                student = Student.from_dict(record, row_index=None)
                students.append(student)
        
        # Clear database and insert all students
        # For simplicity, delete all and reinsert (could be optimized with diff)
        existing = self.database_manager.get_students()
        for existing_student in existing:
            self.database_manager.delete_student(existing_student.row_index)
        
        for student in students:
            self.database_manager.add_student(student)
        
        return students
    
    def _sync_nrts_to_sheets(self, sheet, nrts: List[NonResidentTutor]):
        """Sync NRTs to Google Sheets
        
        Column order:
        1. Name, Email, Status
        2. Optional fields (Phone Number, Harvard Affiliation, etc.)
        3. Total Students
        4. Class year columns (<= 2019, 2020, 2021, etc.)
        """
        try:
            # Define optional field headers (in order)
            optional_field_headers = [
                'Phone Number', 'Harvard Affiliation', 'Harvard ID Number',
                'Current Stage Training', 'Time in Boston', 'Medical Interests',
                'Interests Outside Medicine', 'Interested in Shadowing',
                'Interested in Research', 'Interested in Organizing Events',
                'Specific Events'
            ]
            
            # Get existing headers to detect class year columns
            existing_headers = sheet.row_values(1) if sheet.row_count > 0 else []
            print(f"[SYNC] Existing headers in sheet: {existing_headers}")
            
            # Extract class year columns from existing headers (preserve any custom years)
            class_year_headers = []
            base_headers = ['Name', 'Email', 'Status']
            known_optional = set(optional_field_headers)
            known_base = set(base_headers + ['Total Students'])
            
            for header in existing_headers:
                header_clean = header.strip() if header else ''
                if header_clean and header_clean not in known_base and header_clean not in known_optional:
                    # Check if it's a class year column
                    is_class_year = (
                        header_clean.startswith('<=') or
                        (header_clean.isdigit() and len(header_clean) == 4) or
                        'class' in header_clean.lower()
                    )
                    if is_class_year:
                        class_year_headers.append(header_clean)
            
            # If no class year headers found, use defaults
            if not class_year_headers:
                class_year_headers = ['<= 2019', '2020', '2021', '2022', '2023', 
                                     '2024', '2025', '2026', '2027', '2028', '2029']
            
            # Build final header order: Name, Email, Status, Optional Fields, Total Students, Class Years
            # Sort class year headers: "<= YYYY" first (by year), then regular years (ascending)
            def sort_class_year_key(x):
                x_clean = x.strip()
                if x_clean.startswith('<='):
                    try:
                        return (0, int(x_clean.replace('<=', '').strip()))
                    except ValueError:
                        return (0, 0)
                elif x_clean.isdigit():
                    return (1, int(x_clean))
                else:
                    return (2, x_clean)
            
            sorted_class_years = sorted(class_year_headers, key=sort_class_year_key)
            headers = base_headers + optional_field_headers + ['Total Students'] + sorted_class_years
            
            print(f"[SYNC] Final headers order: {headers}")
            
            # Clear existing data (keep header row if it exists, but we'll overwrite it)
            if sheet.row_count > 1:
                print(f"[SYNC] Clearing {sheet.row_count - 1} existing rows")
                sheet.delete_rows(2, sheet.row_count)
            
            # Always write headers to ensure correct order and all columns are present
            col_range = f'A1:{self._get_column_letter(len(headers))}1'
            sheet.update(col_range, [headers])
            print(f"[SYNC] Updated headers in sheet")
            
            # Write data
            if nrts:
                rows = []
                for nrt in nrts:
                    # Start with: Name, Email, Status
                    row = [nrt.name or '', nrt.email or '', nrt.status or 'active']
                    
                    # Add optional fields
                    row.extend([
                        nrt.phone_number or '',
                        nrt.harvard_affiliation or '',
                        nrt.harvard_id_number or '',
                        nrt.current_stage_training or '',
                        nrt.time_in_boston or '',
                        nrt.medical_interests or '',
                        nrt.interests_outside_medicine or '',
                        nrt.interested_in_shadowing or '',
                        nrt.interested_in_research or '',
                        nrt.interested_in_organizing_events or '',
                        nrt.specific_events or ''
                    ])
                    
                    # Add Total Students
                    row.append(nrt.total_students or 0)
                    
                    print(f"[SYNC] Processing NRT: {nrt.name}, class_year_counts: {nrt.class_year_counts}")
                    
                    # Add class year counts in header order
                    for header in class_year_headers:
                        header_clean = header.strip()
                        count = 0
                        
                        # Handle "<= 2019" special case
                        if header_clean.startswith('<='):
                            try:
                                threshold_year = int(header_clean.replace('<=', '').strip())
                                # Sum all students with class year <= threshold_year
                                for year_key, year_count in nrt.class_year_counts.items():
                                    try:
                                        year_value = int(year_key)
                                        if year_value <= threshold_year:
                                            count += year_count
                                    except ValueError:
                                        # If year_key is not a number, skip it
                                        pass
                            except ValueError:
                                # If header is not parseable, count stays 0
                                pass
                        else:
                            # Regular year matching (e.g., "2020", "2021", or "Class 2025")
                            matched_year = None
                            for year_key in nrt.class_year_counts.keys():
                                # Try exact match
                                if header_clean == year_key:
                                    matched_year = year_key
                                    break
                                # Try removing "Class " prefix
                                if header_clean.replace('Class ', '') == year_key:
                                    matched_year = year_key
                                    break
                                # Try numeric match (e.g., header "2020" matches year_key "2020")
                                try:
                                    if int(header_clean) == int(year_key):
                                        matched_year = year_key
                                        break
                                except ValueError:
                                    pass
                            
                            if matched_year:
                                count = nrt.class_year_counts.get(matched_year, 0)
                        
                        row.append(count)
                    
                    rows.append(row)
                    print(f"[SYNC] Row for {nrt.name}: {len(row)} columns")
                
                print(f"[SYNC] Writing {len(rows)} rows to Google Sheets")
                if rows:
                    sheet.append_rows(rows)
                    print(f"[SYNC] Successfully wrote {len(rows)} NRT rows")
                else:
                    print("[SYNC] Warning: No rows to write")
            else:
                print("[SYNC] Warning: No NRTs to sync")
        except Exception as e:
            print(f"[SYNC] Error in _sync_nrts_to_sheets: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def _get_column_letter(self, col_num: int) -> str:
        """Convert column number to letter (1 -> A, 27 -> AA, etc.)"""
        result = ""
        while col_num > 0:
            col_num -= 1
            result = chr(65 + (col_num % 26)) + result
            col_num //= 26
        return result
    
    def _sync_nrts_from_sheets(self, sheet) -> List[NonResidentTutor]:
        """Sync NRTs from Google Sheets to database"""
        records = sheet.get_all_records()
        nrts = []
        
        for idx, record in enumerate(records, start=2):
            name = record.get('Name', '').strip()
            email = record.get('Email', '').strip()
            if name and email:
                nrt = NonResidentTutor.from_dict(record, row_index=None)
                nrts.append(nrt)
        
        # Clear database and insert all NRTs
        existing = self.database_manager.get_nrts()
        for existing_nrt in existing:
            self.database_manager.delete_nrt(existing_nrt.row_index)
        
        for nrt in nrts:
            self.database_manager.add_nrt(nrt)
        
        return nrts
    
    def _sync_rts_to_sheets(self, sheet, rts: List[ResidentTutor]):
        """Sync RTs to Google Sheets"""
        # Clear existing data (keep header)
        if sheet.row_count > 1:
            sheet.delete_rows(2, sheet.row_count)
        
        # Write header
        header = ['Name', 'Email', 'Student Count']
        sheet.update('A1:C1', [header])
        
        # Write data
        if rts:
            rows = []
            for rt in rts:
                rows.append([rt.name, rt.email, rt.student_count])
            sheet.append_rows(rows)
    
    def _sync_rts_from_sheets(self, sheet) -> List[ResidentTutor]:
        """Sync RTs from Google Sheets to database"""
        records = sheet.get_all_records()
        rts = []
        
        for idx, record in enumerate(records, start=2):
            name = record.get('Name', '').strip()
            email = record.get('Email', '').strip()
            if name and email:
                rt = ResidentTutor.from_dict(record, row_index=None)
                rts.append(rt)
        
        # Clear database and insert all RTs
        existing = self.database_manager.get_rts()
        for existing_rt in existing:
            self.database_manager.delete_rt(existing_rt.row_index)
        
        for rt in rts:
            self.database_manager.add_rt(rt)
        
        return rts
    
    def get_sync_status(self) -> dict:
        """Get current sync status"""
        to_sheets_time = self.cache.get_last_sync_time('to_sheets')
        from_sheets_time = self.cache.get_last_sync_time('from_sheets')
        file_mod_time = self.cache.get_file_modification_time()
        
        return {
            'last_export_to_sheets': to_sheets_time.isoformat() if to_sheets_time else None,
            'last_import_from_sheets': from_sheets_time.isoformat() if from_sheets_time else None,
            'cached_file_modification_time': file_mod_time,
            'cache_expiry_seconds': self.cache.cache_expiry_seconds
        }

