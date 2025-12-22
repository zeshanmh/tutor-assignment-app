import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Paper,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { studentsAPI } from '../../services/api';

function WorkflowStep2({ onNext, onBack, onDataUpdate, initialData }) {
  const [students, setStudents] = useState(initialData || []);
  const [existingStudents, setExistingStudents] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    primary_email: '',
    secondary_email: '',
    class_year: '',
  });

  useEffect(() => {
    // Load existing students to check for duplicates
    const loadExistingStudents = async () => {
      try {
        const response = await studentsAPI.getAll();
        setExistingStudents(response.data || []);
      } catch (err) {
        console.error('Error loading existing students:', err);
      }
    };
    loadExistingStudents();
  }, []);

  const checkDuplicate = (student) => {
    const firstName = (student.first_name || '').trim().toLowerCase();
    const lastName = (student.last_name || '').trim().toLowerCase();
    const primaryEmail = (student.primary_email || '').trim().toLowerCase();
    const secondaryEmail = (student.secondary_email || '').trim().toLowerCase();

    for (const existing of existingStudents) {
      const existingFirstName = (existing.first_name || '').trim().toLowerCase();
      const existingLastName = (existing.last_name || '').trim().toLowerCase();
      const existingPrimaryEmail = (existing.primary_email || '').trim().toLowerCase();
      const existingSecondaryEmail = (existing.secondary_email || '').trim().toLowerCase();

      // Check for duplicate by name
      if (firstName === existingFirstName && lastName === existingLastName) {
        return {
          isDuplicate: true,
          reason: 'name',
          existing: existing,
        };
      }

      // Check for duplicate by primary email
      if (primaryEmail && primaryEmail === existingPrimaryEmail) {
        return {
          isDuplicate: true,
          reason: 'primary email',
          existing: existing,
        };
      }

      // Check for duplicate by secondary email
      if (secondaryEmail && secondaryEmail === existingSecondaryEmail) {
        return {
          isDuplicate: true,
          reason: 'secondary email',
          existing: existing,
        };
      }
    }

    return { isDuplicate: false };
  };

  const handleAdd = () => {
    if (formData.first_name && formData.last_name && formData.primary_email) {
      const duplicateCheck = checkDuplicate(formData);
      if (duplicateCheck.isDuplicate) {
        setDuplicateWarning({
          student: formData,
          reason: duplicateCheck.reason,
          existing: duplicateCheck.existing,
        });
        return;
      }

      setStudents([...students, { ...formData }]);
      setFormData({
        first_name: '',
        last_name: '',
        primary_email: '',
        secondary_email: '',
        class_year: '',
      });
      setOpenDialog(false);
    }
  };

  const handleRemove = (index) => {
    setStudents(students.filter((_, i) => i !== index));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter((line) => line.trim());
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const newStudents = [];
        const duplicates = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim());
          const student = {};
          headers.forEach((header, idx) => {
            const key = header.replace(/ /g, '_');
            student[key] = values[idx] || '';
          });
          if (student.first_name && student.last_name && student.primary_email) {
            const studentData = {
              first_name: student.first_name || '',
              last_name: student.last_name || '',
              primary_email: student.primary_email || '',
              secondary_email: student.secondary_email || '',
              class_year: student.class_year || '',
            };
            const duplicateCheck = checkDuplicate(studentData);
            if (duplicateCheck.isDuplicate) {
              duplicates.push({
                student: studentData,
                reason: duplicateCheck.reason,
                existing: duplicateCheck.existing,
              });
            } else {
              newStudents.push(studentData);
            }
          }
        }

        if (duplicates.length > 0) {
          setDuplicateWarning({
            students: duplicates,
            newStudents: newStudents,
          });
        } else {
          setStudents([...students, ...newStudents]);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleNext = () => {
    // Check for duplicates in the current list before proceeding
    const duplicates = [];
    for (const student of students) {
      const duplicateCheck = checkDuplicate(student);
      if (duplicateCheck.isDuplicate) {
        duplicates.push({
          student: student,
          reason: duplicateCheck.reason,
          existing: duplicateCheck.existing,
        });
      }
    }

    if (duplicates.length > 0) {
      setDuplicateWarning({
        students: duplicates,
        isBulk: true,
      });
      return;
    }

    onDataUpdate({ newStudents: students });
    onNext();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 2: Add New Students
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Add new students one by one or upload a CSV file.
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add Student
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileUploadIcon />}
          component="label"
        >
          Upload CSV
          <input
            type="file"
            accept=".csv"
            hidden
            onChange={handleFileUpload}
          />
        </Button>
      </Box>

      {students.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            New Students to Add ({students.length})
          </Typography>
          <List>
            {students.map((student, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <IconButton edge="end" onClick={() => handleRemove(index)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={`${student.first_name} ${student.last_name}`}
                  secondary={`${student.primary_email} - Class ${student.class_year || 'N/A'}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button variant="contained" onClick={handleNext}>
          Next: Delete NRTs
        </Button>
      </Box>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Student</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="First Name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Primary Email"
              type="email"
              value={formData.primary_email}
              onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Secondary Email"
              type="email"
              value={formData.secondary_email}
              onChange={(e) => setFormData({ ...formData, secondary_email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Class Year"
              value={formData.class_year}
              onChange={(e) => setFormData({ ...formData, class_year: e.target.value })}
              placeholder="e.g., 2025"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <Dialog 
        open={!!duplicateWarning} 
        onClose={() => setDuplicateWarning(null)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Potential Duplicate Detected</DialogTitle>
        <DialogContent>
          {duplicateWarning?.student && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body1" gutterBottom>
                A student with the same {duplicateWarning.reason} already exists:
              </Typography>
              <Typography variant="body2">
                <strong>Existing:</strong> {duplicateWarning.existing.first_name} {duplicateWarning.existing.last_name} ({duplicateWarning.existing.primary_email})
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>New:</strong> {duplicateWarning.student.first_name} {duplicateWarning.student.last_name} ({duplicateWarning.student.primary_email})
              </Typography>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Do you still want to add this student?
              </Typography>
            </Alert>
          )}
          {duplicateWarning?.students && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body1" gutterBottom>
                Found {duplicateWarning.students.length} potential duplicate(s):
              </Typography>
              <List dense>
                {duplicateWarning.students.map((dup, idx) => (
                  <ListItem key={idx}>
                    <ListItemText
                      primary={`${dup.student.first_name} ${dup.student.last_name}`}
                      secondary={`Matches existing by ${dup.reason}: ${dup.existing.first_name} ${dup.existing.last_name} (${dup.existing.primary_email})`}
                    />
                  </ListItem>
                ))}
              </List>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Do you still want to proceed with adding {duplicateWarning.newStudents?.length || 0} new student(s) and {duplicateWarning.students.length} duplicate(s)?
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateWarning(null)}>Cancel</Button>
          <Button
            onClick={() => {
              if (duplicateWarning?.student) {
                // Single duplicate - add it anyway
                setStudents([...students, duplicateWarning.student]);
                setFormData({
                  first_name: '',
                  last_name: '',
                  primary_email: '',
                  secondary_email: '',
                  class_year: '',
                });
                setOpenDialog(false);
              } else if (duplicateWarning?.students) {
                // Bulk duplicates - add all (both duplicates and new)
                const allStudents = [
                  ...(duplicateWarning.newStudents || []),
                  ...duplicateWarning.students.map(d => d.student),
                ];
                setStudents([...students, ...allStudents]);
                if (duplicateWarning.isBulk) {
                  // If this was triggered by handleNext, proceed
                  onDataUpdate({ newStudents: [...students, ...allStudents] });
                  onNext();
                }
              }
              setDuplicateWarning(null);
            }}
            variant="contained"
            color="warning"
          >
            Proceed Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WorkflowStep2;



