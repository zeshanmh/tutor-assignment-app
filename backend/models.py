"""Data models for the tutor assignment system"""
from dataclasses import dataclass
from typing import Optional, List
from datetime import datetime

@dataclass
class Student:
    """Student model"""
    first_name: str
    last_name: str
    primary_email: Optional[str] = None
    secondary_email: Optional[str] = None
    class_year: Optional[str] = None
    rt_assignment: Optional[str] = None
    nrt_assignment: Optional[str] = None
    status: str = 'Not Applying'  # 'Not Applying', 'Currently Applying', 'Applying Next Cycle'
    phone_number: Optional[str] = None  # Phone Number
    hometown: Optional[str] = None  # Home town and state or country
    concentration: Optional[str] = None  # Concentration
    secondary: Optional[str] = None  # Secondary
    extracurricular_activities: Optional[str] = None  # In what extracurricular activities do you take part?
    clinical_shadowing: Optional[str] = None  # Briefly describe any clinical shadowing you have done during college
    research_activities: Optional[str] = None  # Describe any research activities you have done or would like to do
    medical_interests: Optional[str] = None  # Describe any general interests in medicine that you might have
    program_interests: Optional[str] = None  # What programs are you interested in?
    row_index: Optional[int] = None  # Row number in Google Sheets (1-indexed)
    
    def to_dict(self):
        return {
            'first_name': self.first_name,
            'last_name': self.last_name,
            'primary_email': self.primary_email or '',
            'secondary_email': self.secondary_email or '',
            'class_year': self.class_year or '',
            'rt_assignment': self.rt_assignment or '',
            'nrt_assignment': self.nrt_assignment or '',
            'status': self.status or 'Not Applying',
            'phone_number': self.phone_number or '',
            'hometown': self.hometown or '',
            'concentration': self.concentration or '',
            'secondary': self.secondary or '',
            'extracurricular_activities': self.extracurricular_activities or '',
            'clinical_shadowing': self.clinical_shadowing or '',
            'research_activities': self.research_activities or '',
            'medical_interests': self.medical_interests or '',
            'program_interests': self.program_interests or '',
        }
    
    @classmethod
    def from_dict(cls, data: dict, row_index: int = None):
        return cls(
            first_name=data.get('First Name', ''),
            last_name=data.get('Last Name', ''),
            primary_email=data.get('Primary Email', '') or None,
            secondary_email=data.get('Secondary Email', '') or None,
            class_year=data.get('Class Year', '') or None,
            rt_assignment=data.get('RT Assignment', '') or None,
            nrt_assignment=data.get('NRT Assignment', '') or None,
            status=data.get('Status', 'Not Applying') or 'Not Applying',
            phone_number=data.get('Phone Number', '') or None,
            hometown=data.get('Hometown', '') or None,
            concentration=data.get('Concentration', '') or None,
            secondary=data.get('Secondary', '') or None,
            extracurricular_activities=data.get('Extracurricular Activities', '') or None,
            clinical_shadowing=data.get('Clinical Shadowing', '') or None,
            research_activities=data.get('Research Activities', '') or None,
            medical_interests=data.get('Medical Interests', '') or None,
            program_interests=data.get('Program Interests', '') or None,
            row_index=row_index
        )

@dataclass
class NonResidentTutor:
    """Non-Resident Tutor model"""
    name: str
    email: str
    status: str = 'active'  # 'active', 'pending approval', 'active, but does not want additional students', or 'leaving, but keeping students'
    total_students: int = 0
    class_year_counts: dict = None  # e.g., {'2025': 2, '2026': 1}
    phone_number: Optional[str] = None
    harvard_affiliation: Optional[str] = None
    harvard_id_number: Optional[str] = None
    current_stage_training: Optional[str] = None  # Please describe your current stage in training or practice including specialty or research field if applicable.
    time_in_boston: Optional[str] = None  # How long do you expect to remain in Boston and available as a non-resident tutor?
    medical_interests: Optional[str] = None  # Please describe any particular interests you have in medicine/dentistry
    interests_outside_medicine: Optional[str] = None  # What are your interests outside of medicine?
    interested_in_shadowing: Optional[str] = None  # Would you be interested in having students shadow you?
    interested_in_research: Optional[str] = None  # Would you be interested in having students work in your laboratory or with you on research projects?
    interested_in_organizing_events: Optional[str] = None  # Would you be interested in helping organize medicine/health events at Winthrop such as a speaker/journal club, suturing workshop, etc.?
    specific_events: Optional[str] = None  # If yes, are there any particular events would you like to organize?
    row_index: Optional[int] = None
    
    def __post_init__(self):
        if self.class_year_counts is None:
            self.class_year_counts = {}
    
    def to_dict(self):
        return {
            'name': self.name,
            'email': self.email,
            'status': self.status,
            'total_students': self.total_students,
            'phone_number': self.phone_number or '',
            'harvard_affiliation': self.harvard_affiliation or '',
            'harvard_id_number': self.harvard_id_number or '',
            'current_stage_training': self.current_stage_training or '',
            'time_in_boston': self.time_in_boston or '',
            'medical_interests': self.medical_interests or '',
            'interests_outside_medicine': self.interests_outside_medicine or '',
            'interested_in_shadowing': self.interested_in_shadowing or '',
            'interested_in_research': self.interested_in_research or '',
            'interested_in_organizing_events': self.interested_in_organizing_events or '',
            'specific_events': self.specific_events or '',
            **{f'class_{year}': count for year, count in self.class_year_counts.items()}
        }
    
    @classmethod
    def from_dict(cls, data: dict, row_index: int = None):
        # Extract class year counts from columns like "Class 2025", "2025", "<= 2019", etc.
        class_year_counts = {}
        # Fields to skip when extracting class year counts
        skip_fields = [
            'Name', 'Email', 'Status', 'Total Students',
            'Phone Number', 'Harvard Affiliation', 'Harvard ID Number',
            'Current Stage Training', 'Time in Boston', 'Medical Interests',
            'Interests Outside Medicine', 'Interested in Shadowing',
            'Interested in Research', 'Interested in Organizing Events',
            'Specific Events'
        ]
        for key, value in data.items():
            # Skip standard columns and optional fields
            if key in skip_fields:
                continue
            # Handle class year columns: "<= 2019", "2020", "2021", etc., or "Class 2025"
            key_lower = key.lower().strip()
            if 'class' in key_lower or (key.strip().isdigit() and len(key.strip()) == 4) or key.strip().startswith('<='):
                year = key.replace('Class ', '').replace('class_', '').strip()
                try:
                    class_year_counts[year] = int(value) if value else 0
                except (ValueError, TypeError):
                    class_year_counts[year] = 0
        
        # Normalize status - default to 'active' if blank, and lowercase for consistency
        status = (data.get('Status', '') or 'active').strip().lower()
        if not status:
            status = 'active'
        
        return cls(
            name=data.get('Name', ''),
            email=data.get('Email', ''),
            status=status,
            total_students=int(data.get('Total Students', 0) or 0),
            class_year_counts=class_year_counts,
            phone_number=data.get('Phone Number', '') or None,
            harvard_affiliation=data.get('Harvard Affiliation', '') or None,
            harvard_id_number=data.get('Harvard ID Number', '') or None,
            current_stage_training=data.get('Current Stage Training', '') or None,
            time_in_boston=data.get('Time in Boston', '') or None,
            medical_interests=data.get('Medical Interests', '') or None,
            interests_outside_medicine=data.get('Interests Outside Medicine', '') or None,
            interested_in_shadowing=data.get('Interested in Shadowing', '') or None,
            interested_in_research=data.get('Interested in Research', '') or None,
            interested_in_organizing_events=data.get('Interested in Organizing Events', '') or None,
            specific_events=data.get('Specific Events', '') or None,
            row_index=row_index
        )

@dataclass
class ResidentTutor:
    """Resident Tutor model"""
    name: str
    email: str
    student_count: int = 0
    row_index: Optional[int] = None
    
    def to_dict(self):
        return {
            'name': self.name,
            'email': self.email,
            'student_count': self.student_count,
        }
    
    @classmethod
    def from_dict(cls, data: dict, row_index: int = None):
        return cls(
            name=data.get('Name', ''),
            email=data.get('Email', ''),
            student_count=int(data.get('Student Count', 0) or 0),
            row_index=row_index
        )

