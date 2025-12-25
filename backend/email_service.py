"""Email service for sending assignment notifications"""
from typing import List, Optional, Dict, Any
from flask import current_app
from models import Student, ResidentTutor, NonResidentTutor
from gmail_api_service import send_email_via_gmail

def send_assignment_email(student: Student, rt_email: Optional[str], nrt_email: Optional[str], 
                         email_template: Optional[str] = None, rt_name: Optional[str] = None,
                         nrt_name: Optional[str] = None) -> bool:
    """Send assignment email to student with RT and NRT CC'd using Gmail API"""
    try:
        # Use primary_email if available, otherwise fall back to secondary_email
        student_email = student.primary_email or student.secondary_email
        if not student_email:
            print(f"Error: No email available for student {student.first_name} {student.last_name}")
            return False
        
        # Build CC list
        cc_emails = []
        if rt_email:
            cc_emails.append(rt_email)
        if nrt_email:
            cc_emails.append(nrt_email)
        
        # Get RT and NRT names (passed as parameters)
        rt_name = rt_name or rt_email or 'TBD'
        nrt_name = nrt_name or nrt_email or 'TBD'
        
        subject = 'Winthrop Pre-Health RT & NRT Assignment'
        
        # Use provided template or default
        if email_template:
            body = email_template.format(
                first_name=student.first_name,
                rt_name=rt_name,
                rt_email=rt_email or 'TBD',
                nrt_name=nrt_name,
                nrt_email=nrt_email or 'TBD'
            )
        else:
            body = f"""Dear {student.first_name.strip()},

Your non-resident pre-medical tutor this year is {nrt_name.strip()} (cc'd here). Please follow up to set up a meeting at a convenient time. Your non-resident tutor will be an important resource as you on your journey towards medical school and will write the first draft of your Dean's Letter when you apply. Our hope is that you will meet on average once per semester. It is your responsibility to reach out and schedule this meeting, so be proactive!

Your resident pre-medical tutor will be {rt_name.strip()} (also cc'd). If you have additional questions about the advising and application process, please don't hesitate to contact them.

If you are not planning to be pre-med anymore, please let us know as soon as possible so we can reassign your NRT.

Regards,
Winthrop House Pre-Health Committee
"""
        
        # Send email via Gmail API
        return send_email_via_gmail(
            to_email=student_email,
            subject=subject,
            body=body,
            cc_emails=cc_emails if cc_emails else None
        )
    except Exception as e:
        print(f"Error sending assignment email: {e}")
        import traceback
        traceback.print_exc()
        return False

def send_bulk_assignment_emails(students: List[Student], email_template: Optional[str] = None) -> Dict[str, Any]:
    """Send assignment emails to multiple students"""
    results = {
        'success': [],
        'failed': []
    }
    
    for student in students:
        rt_email = student.rt_assignment
        nrt_email = student.nrt_assignment
        
        # Get the email address that will be used (primary_email or secondary_email)
        student_email = student.primary_email or student.secondary_email
        
        if send_assignment_email(student, rt_email, nrt_email, email_template):
            results['success'].append(student_email)
        else:
            results['failed'].append(student_email)
    
    return results

def send_email_with_cc(to_email: str, subject: str, body: str, cc_emails: List[str] = None) -> bool:
    """Send email with CC support using Gmail API"""
    try:
        return send_email_via_gmail(
            to_email=to_email,
            subject=subject,
            body=body,
            cc_emails=cc_emails
        )
    except Exception as e:
        print(f"Error sending email: {e}")
        import traceback
        traceback.print_exc()
        return False

