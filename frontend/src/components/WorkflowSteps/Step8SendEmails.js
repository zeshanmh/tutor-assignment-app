import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  IconButton,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { studentsAPI, rtsAPI, nrtsAPI, emailTemplatesAPI, emailAPI } from '../../services/api';
import api from '../../services/api';

function Step8SendEmails({ onFinish }) {
  const [students, setStudents] = useState([]);
  const [rts, setRts] = useState([]);
  const [nrts, setNrts] = useState([]);
  const [templateWithNRT, setTemplateWithNRT] = useState({ name: 'With NRT', subject: '', body: '' });
  const [templateWithoutNRT, setTemplateWithoutNRT] = useState({ name: 'Without NRT', subject: '', body: '' });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [emailPreviews, setEmailPreviews] = useState({});
  const [expandedPreviews, setExpandedPreviews] = useState(new Set());
  const [emailHistory, setEmailHistory] = useState({});
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState(null);
  const [additionalCc, setAdditionalCc] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [studentsRes, rtsRes, nrtsRes, templatesRes] = await Promise.all([
        studentsAPI.getAll(),
        rtsAPI.getAll(),
        nrtsAPI.getAll(),
        emailTemplatesAPI.getAll(),
      ]);

      setStudents(studentsRes.data);
      setRts(rtsRes.data);
      setNrts(nrtsRes.data);

      // Load or create default templates
      if (templatesRes.data.length === 0) {
        // Create default templates
        const defaultWithNRT = {
          name: 'With NRT',
          subject: 'Winthrop Pre-Health RT & NRT Assignment',
          body: `Dear {StudentFirstName},

Your non-resident pre-medical tutor this year is {NRT} ({NRTEmail}, cc'd here). Please follow up to set up a meeting at a convenient time. Your non-resident tutor will be an important resource as you on your journey towards medical school and will write the first draft of your Dean's Letter when you apply. Our hope is that you will meet on average once per semester. It is your responsibility to reach out and schedule this meeting, so be proactive!

Your resident pre-medical tutor will be {RT} ({RTEmail}, also cc'd). If you have additional questions about the advising and application process, please don't hesitate to contact them.

If you are not planning to be pre-med anymore, please let us know as soon as possible so we can reassign your NRT.

Regards,
Winthrop House Pre-Health Committee`,
        };

        const defaultWithoutNRT = {
          name: 'Without NRT',
          subject: 'Winthrop Pre-Health RT Assignment',
          body: `Dear {StudentFirstName},

Your resident pre-medical tutor will be {RT} ({RTEmail}, cc'd here). If you have additional questions about the advising and application process, please don't hesitate to contact them.

We are still working on assigning you a non-resident tutor. We will notify you once that assignment is complete.

Regards,
Winthrop House Pre-Health Committee`,
        };

        await Promise.all([
          emailTemplatesAPI.create(defaultWithNRT),
          emailTemplatesAPI.create(defaultWithoutNRT),
        ]);

        setTemplateWithNRT({ ...defaultWithNRT, id: 1 });
        setTemplateWithoutNRT({ ...defaultWithoutNRT, id: 2 });
      } else {
        const withNRT = templatesRes.data.find(t => t.name === 'With NRT');
        const withoutNRT = templatesRes.data.find(t => t.name === 'Without NRT');

        if (withNRT) {
          setTemplateWithNRT(withNRT);
        }
        if (withoutNRT) {
          setTemplateWithoutNRT(withoutNRT);
        }
      }

      // Load email history for all students
      const historyPromises = studentsRes.data.map(async (student) => {
        try {
          const historyRes = await emailAPI.getHistory(student.row_index);
          return { studentId: student.row_index, history: historyRes.data };
        } catch (err) {
          return { studentId: student.row_index, history: [] };
        }
      });

      const histories = await Promise.all(historyPromises);
      const historyMap = {};
      histories.forEach(({ studentId, history }) => {
        historyMap[studentId] = history;
      });
      setEmailHistory(historyMap);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (template) => {
    try {
      if (template.id) {
        await emailTemplatesAPI.update(template.id, template);
      } else {
        const result = await emailTemplatesAPI.create(template);
        template.id = result.data.id;
      }

      if (template.name === 'With NRT') {
        setTemplateWithNRT(template);
      } else {
        setTemplateWithoutNRT(template);
      }

      setEditingTemplate(null);
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Failed to save template');
    }
  };

  const handlePreviewEmail = async (student) => {
    if (emailPreviews[student.row_index]) {
      // Toggle preview
      const newExpanded = new Set(expandedPreviews);
      if (newExpanded.has(student.row_index)) {
        newExpanded.delete(student.row_index);
      } else {
        newExpanded.add(student.row_index);
      }
      setExpandedPreviews(newExpanded);
      return;
    }

    try {
      const templateName = student.nrt_assignment ? 'With NRT' : 'Without NRT';
      const previewRes = await emailAPI.preview(student.row_index, templateName, additionalCc);
      setEmailPreviews({
        ...emailPreviews,
        [student.row_index]: previewRes.data,
      });
      setExpandedPreviews(new Set([...expandedPreviews, student.row_index]));
    } catch (err) {
      console.error('Error previewing email:', err);
      alert('Failed to preview email');
    }
  };

  const handleViewHistory = async (student) => {
    setSelectedHistoryStudent(student);
    setHistoryModalOpen(true);
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map(s => s.row_index)));
    }
  };

  const handleSelectStudent = (studentId) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSendSelected = async () => {
    if (selectedStudents.size === 0) {
      alert('Please select at least one student');
      return;
    }

    if (!window.confirm(`Send emails to ${selectedStudents.size} student(s)?`)) {
      return;
    }

    setSending(true);
    const results = { success: [], failed: [] };

    for (const studentId of selectedStudents) {
      try {
        const student = students.find(s => s.row_index === studentId);
        if (!student) continue;

        const templateName = student.nrt_assignment ? 'With NRT' : 'Without NRT';
        await emailAPI.sendTemplate(studentId, templateName, additionalCc);

        results.success.push(student);
        
        // Refresh email history for this student
        const historyRes = await emailAPI.getHistory(studentId);
        setEmailHistory({
          ...emailHistory,
          [studentId]: historyRes.data,
        });
      } catch (err) {
        console.error(`Error sending email to student ${studentId}:`, err);
        results.failed.push(students.find(s => s.row_index === studentId));
      }
    }

    setSending(false);
    setSelectedStudents(new Set());

    if (results.failed.length === 0) {
      alert(`Successfully sent ${results.success.length} email(s)!`);
    } else {
      alert(`Sent ${results.success.length} email(s), failed ${results.failed.length}`);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      window.alert('Please enter a valid email address');
      return;
    }

    setSendingTest(true);
    try {
      const response = await api.post('/email/test', { email: testEmail });
      if (response.data.success) {
        window.alert(`Test email sent successfully to ${testEmail}! Check your inbox.`);
        setTestEmail('');
      } else {
        window.alert(`Failed to send test email: ${response.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error sending test email:', err);
      window.alert(`Error: ${err.response?.data?.error || 'Failed to send test email'}`);
    } finally {
      setSendingTest(false);
    }
  };

  const getStudentRT = (student) => {
    if (!student.rt_assignment) return null;
    return rts.find(r => r.name.trim().toLowerCase() === student.rt_assignment.trim().toLowerCase());
  };

  const getStudentNRT = (student) => {
    if (!student.nrt_assignment) return null;
    return nrts.find(n => n.name.trim().toLowerCase() === student.nrt_assignment.trim().toLowerCase());
  };

  const getLatestEmail = (studentId) => {
    const history = emailHistory[studentId] || [];
    return history.length > 0 ? history[0] : null;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Part 4: Send Emails
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage email templates and send personalized emails to students with RTs and NRTs CC'd.
      </Typography>

      {/* Template Editor */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Email Templates
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Use placeholders: {'{Student}'}, {'{StudentFirstName}'}, {'{StudentLastName}'}, {'{RT}'}, {'{NRT}'}, {'{RTEmail}'}, {'{NRTEmail}'}, {'{ClassYear}'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button
            variant={editingTemplate?.name === 'With NRT' ? 'contained' : 'outlined'}
            onClick={() => setEditingTemplate(templateWithNRT)}
          >
            Edit "With NRT" Template
          </Button>
          <Button
            variant={editingTemplate?.name === 'Without NRT' ? 'contained' : 'outlined'}
            onClick={() => setEditingTemplate(templateWithoutNRT)}
          >
            Edit "Without NRT" Template
          </Button>
        </Box>

        {editingTemplate && (
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Subject"
              fullWidth
              value={editingTemplate.subject}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Body"
              fullWidth
              multiline
              rows={10}
              value={editingTemplate.body}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={() => handleSaveTemplate(editingTemplate)}
              >
                Save Template
              </Button>
              <Button
                variant="outlined"
                onClick={() => setEditingTemplate(null)}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Additional CC Field */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          label="Additional CC Emails (comma-separated)"
          fullWidth
          value={additionalCc}
          onChange={(e) => setAdditionalCc(e.target.value)}
          placeholder="email1@example.com, email2@example.com"
          helperText="These emails will be CC'd on all selected emails"
        />
      </Paper>

      {/* Student List with Email Previews */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Students ({students.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleSelectAll}
            >
              {selectedStudents.size === students.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSendSelected}
              disabled={selectedStudents.size === 0 || sending}
            >
              {sending ? <CircularProgress size={20} /> : `Send Selected (${selectedStudents.size})`}
            </Button>
          </Box>
        </Box>

        <List>
          {students.map((student) => {
            const rt = getStudentRT(student);
            const nrt = getStudentNRT(student);
            const latestEmail = getLatestEmail(student.row_index);
            const preview = emailPreviews[student.row_index];
            const isExpanded = expandedPreviews.has(student.row_index);
            const isSelected = selectedStudents.has(student.row_index);

            return (
              <React.Fragment key={student.row_index}>
                <ListItem>
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handleSelectStudent(student.row_index)}
                  />
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {student.first_name} {student.last_name}
                        </Typography>
                        {student.class_year && (
                          <Chip label={`Class ${student.class_year}`} size="small" />
                        )}
                        {rt && (
                          <Chip label={`RT: ${rt.name}`} size="small" color="primary" />
                        )}
                        {nrt ? (
                          <Chip label={`NRT: ${nrt.name}`} size="small" color="success" />
                        ) : (
                          <Chip label="No NRT" size="small" color="warning" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        {latestEmail && (
                          <Typography variant="caption" color="text.secondary">
                            Last email: {new Date(latestEmail.sent_at).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {latestEmail && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleViewHistory(student)}
                        >
                          View Last Email
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handlePreviewEmail(student)}
                      >
                        {isExpanded ? 'Hide Preview' : 'Preview Email'}
                      </Button>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>

                {isExpanded && preview && (
                  <ListItem>
                    <Box sx={{ width: '100%', pl: 4 }}>
                      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          <strong>To:</strong> {preview.to}
                        </Typography>
                        {preview.cc && preview.cc.length > 0 && (
                          <Typography variant="subtitle2" gutterBottom>
                            <strong>CC:</strong> {preview.cc.join(', ')}
                          </Typography>
                        )}
                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                          <strong>Subject:</strong> {preview.subject}
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {preview.body}
                        </Typography>
                      </Paper>
                    </Box>
                  </ListItem>
                )}

                <Divider />
              </React.Fragment>
            );
          })}
        </List>
      </Paper>

      {/* Email History Modal */}
      <Dialog
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Email History - {selectedHistoryStudent?.first_name} {selectedHistoryStudent?.last_name}
            </Typography>
            <IconButton onClick={() => setHistoryModalOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedHistoryStudent && (
            <Box>
              {emailHistory[selectedHistoryStudent.row_index]?.length > 0 ? (
                emailHistory[selectedHistoryStudent.row_index].map((email, index) => (
                  <Box key={email.id} sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Sent: {new Date(email.sent_at).toLocaleString()}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>
                      <strong>To:</strong> {email.recipients.join(', ')}
                    </Typography>
                    {email.cc_recipients && email.cc_recipients.length > 0 && (
                      <Typography variant="subtitle2">
                        <strong>CC:</strong> {email.cc_recipients.join(', ')}
                      </Typography>
                    )}
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>
                      <strong>Subject:</strong> {email.email_subject}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {email.email_body}
                    </Typography>
                    {index < emailHistory[selectedHistoryStudent.row_index].length - 1 && (
                      <Divider sx={{ my: 2 }} />
                    )}
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No email history for this student.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Test Email Section */}
      <Paper sx={{ p: 2, mt: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" gutterBottom>
          Test Email Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Send a test email to verify your email settings are working correctly.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Test Email Address"
            size="small"
            value={testEmail || ''}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="your-email@example.com"
            sx={{ flex: 1, maxWidth: 300 }}
          />
          <Button
            variant="outlined"
            onClick={handleTestEmail}
            disabled={!testEmail || sendingTest}
          >
            {sendingTest ? <CircularProgress size={20} /> : 'Send Test Email'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default Step8SendEmails;

