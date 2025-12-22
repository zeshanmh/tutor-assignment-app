"""Email service for sending assignment notifications"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any
from flask import current_app
from models import Student, ResidentTutor, NonResidentTutor

def send_assignment_email(student: Student, rt_email: Optional[str], nrt_email: Optional[str], 
                         email_template: Optional[str] = None, rt_name: Optional[str] = None,
                         nrt_name: Optional[str] = None) -> bool:
    """Send assignment email to student with RT and NRT CC'd"""
    try:
        config = current_app.config
        
        # Use primary_email if available, otherwise fall back to secondary_email
        student_email = student.primary_email or student.secondary_email
        if not student_email:
            print(f"Error: No email available for student {student.first_name} {student.last_name}")
            return False
        
        msg = MIMEMultipart()
        msg['From'] = config['EMAIL_USER']
        msg['To'] = student_email
        msg['Subject'] = 'Winthrop Pre-Health RT & NRT Assignment'
        
        # Build CC list
        cc_emails = []
        if rt_email:
            cc_emails.append(rt_email)
        if nrt_email:
            cc_emails.append(nrt_email)
        
        if cc_emails:
            msg['Cc'] = ', '.join(cc_emails)
        
        # Get RT and NRT names (passed as parameters)
        rt_name = rt_name or rt_email or 'TBD'
        nrt_name = nrt_name or nrt_email or 'TBD'
        
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
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Send to student and CC tutors
        recipients = [student_email] + cc_emails
        
        server = smtplib.SMTP(config['EMAIL_HOST'], config['EMAIL_PORT'])
        server.starttls()
        server.login(config['EMAIL_USER'], config['EMAIL_PASSWORD'])
        server.send_message(msg, to_addrs=recipients)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending assignment email: {e}")
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
    """Send email with CC support"""
    try:
        from flask import current_app
        config = current_app.config
        
        msg = MIMEMultipart()
        msg['From'] = config['EMAIL_USER']
        msg['To'] = to_email
        msg['Subject'] = subject
        
        if cc_emails:
            msg['Cc'] = ', '.join(cc_emails)
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Send to recipient and CC recipients
        recipients = [to_email]
        if cc_emails:
            recipients.extend(cc_emails)
        
        server = smtplib.SMTP(config['EMAIL_HOST'], config['EMAIL_PORT'])
        server.starttls()
        server.login(config['EMAIL_USER'], config['EMAIL_PASSWORD'])
        server.send_message(msg, to_addrs=recipients)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        import traceback
        traceback.print_exc()
        return False

