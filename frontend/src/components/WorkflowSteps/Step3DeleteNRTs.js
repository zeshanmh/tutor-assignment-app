import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { nrtsAPI } from '../../services/api';

function WorkflowStep3({ onNext, onBack, onDataUpdate, initialData }) {
  const [nrts, setNrts] = useState([]);
  const [deletedNRTs, setDeletedNRTs] = useState(initialData || []);

  useEffect(() => {
    loadNRTs();
  }, []);

  const loadNRTs = async () => {
    try {
      const response = await nrtsAPI.getAll();
      setNrts(response.data);
    } catch (err) {
      console.error('Error loading NRTs:', err);
    }
  };

  const handleDelete = (nrt) => {
    const message = nrt.total_students > 0
      ? `Delete ${nrt.name}? This will unassign ${nrt.total_students} student(s) who will need to be reassigned.`
      : `Delete ${nrt.name}?`;
    
    if (window.confirm(message)) {
      if (!deletedNRTs.find(d => d.row_index === nrt.row_index)) {
        setDeletedNRTs([...deletedNRTs, nrt]);
      }
    }
  };

  const handleRestore = (nrt) => {
    setDeletedNRTs(deletedNRTs.filter(d => d.row_index !== nrt.row_index));
  };

  const handleNext = () => {
    onDataUpdate({ deletedNRTs: deletedNRTs });
    onNext();
  };

  const availableNrts = nrts.filter(nrt => !deletedNRTs.find(d => d.row_index === nrt.row_index));

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 3: Delete NRTs
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Delete NRTs who are leaving and want their students reassigned. Students assigned to deleted NRTs will have blank NRT assignments and need to be reassigned in a later step.
      </Typography>

      {deletedNRTs.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            {deletedNRTs.length} NRT(s) marked for deletion. This will unassign {deletedNRTs.reduce((sum, nrt) => sum + (nrt.total_students || 0), 0)} student(s).
          </Typography>
        </Alert>
      )}

      {deletedNRTs.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            NRTs to Delete ({deletedNRTs.length})
          </Typography>
          <Grid container spacing={2}>
            {deletedNRTs.map((nrt) => (
              <Grid item xs={12} sm={6} md={4} key={nrt.row_index}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <Box>
                        <Typography variant="h6">{nrt.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {nrt.email}
                        </Typography>
                        <Chip
                          label={`${nrt.total_students || 0} student(s) will be unassigned`}
                          color="warning"
                          size="small"
                          sx={{ mt: 1 }}
                        />
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleRestore(nrt)}
                        color="primary"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Typography variant="h6" gutterBottom>
        Available NRTs
      </Typography>
      {availableNrts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No NRTs available (all have been marked for deletion).
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {availableNrts.map((nrt) => (
            <Grid item xs={12} sm={6} md={4} key={nrt.row_index}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Box>
                      <Typography variant="h6">{nrt.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {nrt.email}
                      </Typography>
                      <Chip
                        label={`${nrt.total_students || 0} student(s)`}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(nrt)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button variant="contained" onClick={handleNext}>
          Next: Update NRT Status
        </Button>
      </Box>
    </Box>
  );
}

export default WorkflowStep3;

