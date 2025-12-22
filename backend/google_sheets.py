"""Google Sheets integration for data storage"""
import gspread
from google.oauth2.service_account import Credentials
from typing import List, Dict, Optional
from models import Student, NonResidentTutor, ResidentTutor
import os

class GoogleSheetsManager:
    """Manages Google Sheets operations"""
    
    SCOPES = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ]
    
    def __init__(self, credentials_path: str, sheet_id: str):
        """Initialize Google Sheets connection"""
        self.credentials_path = credentials_path
        self.sheet_id = sheet_id
        self.client = None
        self.spreadsheet = None
        self._connect()
    
    def _connect(self):
        """Establish connection to Google Sheets"""
        creds = Credentials.from_service_account_file(
            self.credentials_path,
            scopes=self.SCOPES
        )
        self.client = gspread.authorize(creds)
        self.spreadsheet = self.client.open_by_key(self.sheet_id)
    
    def get_students(self) -> List[Student]:
        """Get all students from the Students sheet"""
        try:
            sheet = self.spreadsheet.worksheet('Students')
            records = sheet.get_all_records()
            students = []
            for idx, record in enumerate(records, start=2):  # Start at 2 (skip header)
                # Require First Name, Last Name, and at least one email (Primary or Secondary)
                first_name = record.get('First Name', '').strip()
                last_name = record.get('Last Name', '').strip()
                primary_email = record.get('Primary Email', '').strip()
                secondary_email = record.get('Secondary Email', '').strip()
                
                if first_name and last_name and (primary_email or secondary_email):
                    student = Student.from_dict(record, row_index=idx)
                    students.append(student)
            return students
        except Exception as e:
            print(f"Error getting students: {e}")
            return []
    
    def get_nrts(self) -> List[NonResidentTutor]:
        """Get all Non-Resident Tutors"""
        try:
            sheet = self.spreadsheet.worksheet('Non-Resident Tutors')
            
            # Handle duplicate headers by reading manually
            try:
            records = sheet.get_all_records()
            except Exception as e:
                if "not unique" in str(e):
                    print(f"[GOOGLE_SHEETS] Warning: Duplicate headers detected, reading manually...")
                    # Read headers and data manually
                    headers = sheet.row_values(1)
                    all_values = sheet.get_all_values()
                    
                    # Make headers unique by appending index to duplicates
                    seen = {}
                    unique_headers = []
                    for header in headers:
                        header_clean = header.strip() if header else f"Column_{len(unique_headers)}"
                        if header_clean in seen:
                            seen[header_clean] += 1
                            unique_headers.append(f"{header_clean}_{seen[header_clean]}")
                        else:
                            seen[header_clean] = 0
                            unique_headers.append(header_clean)
                    
                    # Convert to records format
                    records = []
                    for row in all_values[1:]:  # Skip header row
                        if not any(cell.strip() for cell in row):  # Skip empty rows
                            continue
                        record = {}
                        for i, header in enumerate(unique_headers):
                            # Use original header name (before uniquification) for matching
                            original_header = headers[i] if i < len(headers) else header
                            record[original_header] = row[i] if i < len(row) else ''
                        records.append(record)
                else:
                    raise
            
            print(f"[GOOGLE_SHEETS] get_nrts: Found {len(records)} records from sheet")
            nrts = []
            for idx, record in enumerate(records, start=2):
                # Require Name and Email
                name = record.get('Name', '').strip()
                email = record.get('Email', '').strip()
                print(f"[GOOGLE_SHEETS] Row {idx}: name='{name}', email='{email}'")
                if name and email:
                    nrt = NonResidentTutor.from_dict(record, row_index=idx)
                    nrts.append(nrt)
                    print(f"[GOOGLE_SHEETS] Added NRT: {nrt.name} (row {nrt.row_index})")
                else:
                    print(f"[GOOGLE_SHEETS] Skipped row {idx}: missing name or email")
            print(f"[GOOGLE_SHEETS] Returning {len(nrts)} NRTs")
            return nrts
        except Exception as e:
            print(f"Error getting NRTs: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_rts(self) -> List[ResidentTutor]:
        """Get all Resident Tutors"""
        try:
            sheet = self.spreadsheet.worksheet('Resident Tutors')
            records = sheet.get_all_records()
            rts = []
            for idx, record in enumerate(records, start=2):
                # Require Name and Email
                name = record.get('Name', '').strip()
                email = record.get('Email', '').strip()
                if name and email:
                    rt = ResidentTutor.from_dict(record, row_index=idx)
                    rts.append(rt)
            return rts
        except Exception as e:
            print(f"Error getting RTs: {e}")
            return []
    
    def add_student(self, student: Student) -> bool:
        """Add a new student"""
        try:
            sheet = self.spreadsheet.worksheet('Students')
            row = [
                student.first_name,
                student.last_name,
                student.primary_email or '',
                student.secondary_email or '',
                student.class_year or '',
                student.nrt_assignment or '',
                student.rt_assignment or ''
            ]
            sheet.append_row(row)
            return True
        except Exception as e:
            print(f"Error adding student: {e}")
            return False
    
    def update_student(self, student: Student) -> bool:
        """Update an existing student"""
        try:
            if not student.row_index:
                return False
            sheet = self.spreadsheet.worksheet('Students')
            row = [
                student.first_name,
                student.last_name,
                student.primary_email or '',
                student.secondary_email or '',
                student.class_year or '',
                student.nrt_assignment or '',
                student.rt_assignment or ''
            ]
            sheet.update(f'A{student.row_index}:G{student.row_index}', [row])
            return True
        except Exception as e:
            print(f"Error updating student: {e}")
            return False
    
    def delete_student(self, row_index: int) -> bool:
        """Delete a student by row index"""
        try:
            sheet = self.spreadsheet.worksheet('Students')
            sheet.delete_rows(row_index)
            return True
        except Exception as e:
            print(f"Error deleting student: {e}")
            return False
    
    def restore_student(self, student: Student, row_index: int) -> bool:
        """Restore a deleted student"""
        try:
            sheet = self.spreadsheet.worksheet('Students')
            row = [
                student.first_name,
                student.last_name,
                student.primary_email or '',
                student.secondary_email or '',
                student.class_year or '',
                student.nrt_assignment or '',
                student.rt_assignment or ''
            ]
            sheet.insert_row(row, row_index)
            return True
        except Exception as e:
            print(f"Error restoring student: {e}")
            return False
    
    def add_nrt(self, nrt: NonResidentTutor) -> bool:
        """Add a new NRT"""
        try:
            sheet = self.spreadsheet.worksheet('Non-Resident Tutors')
            # Get headers to determine column order
            headers = sheet.row_values(1)
            row = [nrt.name, nrt.email, nrt.status, nrt.total_students]
            # Add class year counts in the order they appear in headers (after Total Students)
            for header in headers[4:]:  # Skip Name, Email, Status, Total Students
                header_clean = header.strip()
                # Match header to class year key (handle "<= 2019", "2020", etc.)
                matched_year = None
                for year_key in nrt.class_year_counts.keys():
                    if header_clean == year_key or header_clean.replace('Class ', '') == year_key:
                        matched_year = year_key
                        break
                row.append(nrt.class_year_counts.get(matched_year, 0) if matched_year else 0)
            sheet.append_row(row)
            return True
        except Exception as e:
            print(f"Error adding NRT: {e}")
            return False
    
    def update_nrt(self, nrt: NonResidentTutor) -> bool:
        """Update an existing NRT"""
        try:
            if not nrt.row_index:
                return False
            sheet = self.spreadsheet.worksheet('Non-Resident Tutors')
            headers = sheet.row_values(1)
            row = [nrt.name, nrt.email, nrt.status, nrt.total_students]
            # Add class year counts in the order they appear in headers (after Total Students)
            for header in headers[4:]:  # Skip Name, Email, Status, Total Students
                header_clean = header.strip()
                # Match header to class year key (handle "<= 2019", "2020", etc.)
                matched_year = None
                for year_key in nrt.class_year_counts.keys():
                    if header_clean == year_key or header_clean.replace('Class ', '') == year_key:
                        matched_year = year_key
                        break
                row.append(nrt.class_year_counts.get(matched_year, 0) if matched_year else 0)
            range_end = chr(64 + len(row))  # Convert to column letter
            sheet.update(f'A{nrt.row_index}:{range_end}{nrt.row_index}', [row])
            return True
        except Exception as e:
            print(f"Error updating NRT: {e}")
            return False
    
    def delete_nrt(self, row_index: int) -> bool:
        """Delete an NRT"""
        try:
            sheet = self.spreadsheet.worksheet('Non-Resident Tutors')
            sheet.delete_rows(row_index)
            return True
        except Exception as e:
            print(f"Error deleting NRT: {e}")
            return False
    
    def add_rt(self, rt: ResidentTutor) -> bool:
        """Add a new RT"""
        try:
            sheet = self.spreadsheet.worksheet('Resident Tutors')
            row = [rt.name, rt.email, rt.student_count]
            sheet.append_row(row)
            return True
        except Exception as e:
            print(f"Error adding RT: {e}")
            return False
    
    def update_rt(self, rt: ResidentTutor) -> bool:
        """Update an existing RT"""
        try:
            if not rt.row_index:
                return False
            sheet = self.spreadsheet.worksheet('Resident Tutors')
            row = [rt.name, rt.email, rt.student_count]
            sheet.update(f'A{rt.row_index}:C{rt.row_index}', [row])
            return True
        except Exception as e:
            print(f"Error updating RT: {e}")
            return False
    
    def delete_rt(self, row_index: int) -> bool:
        """Delete an RT"""
        try:
            sheet = self.spreadsheet.worksheet('Resident Tutors')
            sheet.delete_rows(row_index)
            return True
        except Exception as e:
            print(f"Error deleting RT: {e}")
            return False
    
    def bulk_update_students(self, students: List[Student]) -> bool:
        """Bulk update students (more efficient for multiple updates)"""
        try:
            sheet = self.spreadsheet.worksheet('Students')
            updates = []
            for student in students:
                if student.row_index:
                    row = [
                        student.first_name,
                        student.last_name,
                        student.primary_email or '',
                        student.secondary_email or '',
                        student.class_year or '',
                        student.nrt_assignment or '',
                        student.rt_assignment or ''
                    ]
                    updates.append({
                        'range': f'A{student.row_index}:G{student.row_index}',
                        'values': [row]
                    })
            
            if updates:
                sheet.batch_update(updates)
            return True
        except Exception as e:
            print(f"Error bulk updating students: {e}")
            return False

