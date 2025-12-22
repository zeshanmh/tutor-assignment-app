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
import { nrtsAPI } from '../../services/api';

function WorkflowStep4({ onNext, onBack, onDataUpdate, initialData }) {
  const [nrts, setNrts] = useState(initialData || []);
  const [existingNrts, setExistingNrts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    // Load existing NRTs to check for duplicates
    const loadExistingNrts = async () => {
      try {
        const response = await nrtsAPI.getAll();
        setExistingNrts(response.data || []);
      } catch (err) {
        console.error('Error loading existing NRTs:', err);
      }
    };
    loadExistingNrts();
  }, []);

  const checkDuplicate = (nrt) => {
    const name = (nrt.name || '').trim().toLowerCase();
    const email = (nrt.email || '').trim().toLowerCase();

    for (const existing of existingNrts) {
      const existingName = (existing.name || '').trim().toLowerCase();
      const existingEmail = (existing.email || '').trim().toLowerCase();

      // Check for duplicate by name
      if (name && name === existingName) {
        return {
          isDuplicate: true,
          reason: 'name',
          existing: existing,
        };
      }

      // Check for duplicate by email
      if (email && email === existingEmail) {
        return {
          isDuplicate: true,
          reason: 'email',
          existing: existing,
        };
      }
    }

    return { isDuplicate: false };
  };

  const handleAdd = () => {
    if (formData.name && formData.email) {
      const duplicateCheck = checkDuplicate(formData);
      if (duplicateCheck.isDuplicate) {
        setDuplicateWarning({
          nrt: formData,
          reason: duplicateCheck.reason,
          existing: duplicateCheck.existing,
        });
        return;
      }

      setNrts([...nrts, { ...formData }]);
      setFormData({ name: '', email: '' });
      setOpenDialog(false);
    }
  };

  const handleRemove = (index) => {
    setNrts(nrts.filter((_, i) => i !== index));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter((line) => line.trim());
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const newNrts = [];
        const duplicates = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim());
          const nrt = {};
          headers.forEach((header, idx) => {
            nrt[header.replace(/ /g, '_')] = values[idx] || '';
          });
          if (nrt.name && nrt.email) {
            const nrtData = {
              name: nrt.name || '',
              email: nrt.email || '',
            };
            const duplicateCheck = checkDuplicate(nrtData);
            if (duplicateCheck.isDuplicate) {
              duplicates.push({
                nrt: nrtData,
                reason: duplicateCheck.reason,
                existing: duplicateCheck.existing,
              });
            } else {
              newNrts.push(nrtData);
            }
          }
        }

        if (duplicates.length > 0) {
          setDuplicateWarning({
            nrts: duplicates,
            newNrts: newNrts,
          });
        } else {
          setNrts([...nrts, ...newNrts]);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleNext = () => {
    // Check for duplicates in the current list before proceeding
    const duplicates = [];
    for (const nrt of nrts) {
      const duplicateCheck = checkDuplicate(nrt);
      if (duplicateCheck.isDuplicate) {
        duplicates.push({
          nrt: nrt,
          reason: duplicateCheck.reason,
          existing: duplicateCheck.existing,
        });
      }
    }

    if (duplicates.length > 0) {
      setDuplicateWarning({
        nrts: duplicates,
        isBulk: true,
      });
      return;
    }

    onDataUpdate({ newNRTs: nrts });
    onNext();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 5: Add New NRTs
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Add new Non-Resident Tutors one by one or upload a CSV file.
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add NRT
        </Button>
        <Button variant="outlined" startIcon={<FileUploadIcon />} component="label">
          Upload CSV
          <input type="file" accept=".csv" hidden onChange={handleFileUpload} />
        </Button>
      </Box>

      {nrts.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            New NRTs to Add ({nrts.length})
          </Typography>
          <List>
            {nrts.map((nrt, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <IconButton edge="end" onClick={() => handleRemove(index)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText primary={nrt.name} secondary={nrt.email} />
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
          Next: Review Changes
        </Button>
      </Box>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New NRT</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
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
          {duplicateWarning?.nrt && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body1" gutterBottom>
                An NRT with the same {duplicateWarning.reason} already exists:
              </Typography>
              <Typography variant="body2">
                <strong>Existing:</strong> {duplicateWarning.existing.name} ({duplicateWarning.existing.email})
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>New:</strong> {duplicateWarning.nrt.name} ({duplicateWarning.nrt.email})
              </Typography>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Do you still want to add this NRT?
              </Typography>
            </Alert>
          )}
          {duplicateWarning?.nrts && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body1" gutterBottom>
                Found {duplicateWarning.nrts.length} potential duplicate(s):
              </Typography>
              <List dense>
                {duplicateWarning.nrts.map((dup, idx) => (
                  <ListItem key={idx}>
                    <ListItemText
                      primary={dup.nrt.name}
                      secondary={`Matches existing by ${dup.reason}: ${dup.existing.name} (${dup.existing.email})`}
                    />
                  </ListItem>
                ))}
              </List>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Do you still want to proceed with adding {duplicateWarning.newNrts?.length || 0} new NRT(s) and {duplicateWarning.nrts.length} duplicate(s)?
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateWarning(null)}>Cancel</Button>
          <Button
            onClick={() => {
              if (duplicateWarning?.nrt) {
                // Single duplicate - add it anyway
                setNrts([...nrts, duplicateWarning.nrt]);
                setFormData({ name: '', email: '' });
                setOpenDialog(false);
              } else if (duplicateWarning?.nrts) {
                // Bulk duplicates - add all (both duplicates and new)
                const allNrts = [
                  ...(duplicateWarning.newNrts || []),
                  ...duplicateWarning.nrts.map(d => d.nrt),
                ];
                setNrts([...nrts, ...allNrts]);
                if (duplicateWarning.isBulk) {
                  // If this was triggered by handleNext, proceed
                  onDataUpdate({ newNRTs: [...nrts, ...allNrts] });
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

export default WorkflowStep4;



