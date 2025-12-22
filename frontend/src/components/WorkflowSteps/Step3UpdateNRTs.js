import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { nrtsAPI } from '../../services/api';

function WorkflowStep3({ onNext, onBack, onDataUpdate, initialData }) {
  const [nrts, setNrts] = useState([]);
  const [nrtStatuses, setNrtStatuses] = useState({});

  useEffect(() => {
    loadNRTs();
  }, []);

  const loadNRTs = async () => {
    try {
      const response = await nrtsAPI.getAll();
      setNrts(response.data);
      const statuses = {};
      response.data.forEach((nrt) => {
        statuses[nrt.row_index] = nrt.status || 'active';
      });
      setNrtStatuses(statuses);
    } catch (err) {
      console.error('Error loading NRTs:', err);
    }
  };

  const handleStatusChange = (rowIndex, status) => {
    setNrtStatuses({ ...nrtStatuses, [rowIndex]: status });
  };


  const handleNext = () => {
    const updatedNRTs = nrts
      .filter((nrt) => {
        const currentStatus = nrtStatuses[nrt.row_index] || 'active';
        return currentStatus !== nrt.status && currentStatus !== 'DELETE';
      })
      .map((nrt) => ({
        row_index: nrt.row_index,
        status: nrtStatuses[nrt.row_index],
      }));
    onDataUpdate({ updatedNRTs });
    onNext();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 4: Update NRT Status
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Update the status of each NRT. Use the previous step to delete NRTs who are leaving and want their students reassigned.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {nrts.map((nrt) => (
          <Grid item xs={12} sm={6} md={4} key={nrt.row_index}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {nrt.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {nrt.email}
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={`${nrt.total_students}/3 students`}
                    color={nrt.total_students >= 3 ? 'error' : 'default'}
                    size="small"
                  />
                </Box>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={nrtStatuses[nrt.row_index] || 'active'}
                    label="Status"
                    onChange={(e) => handleStatusChange(nrt.row_index, e.target.value)}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="active, but does not want additional students">
                      Active, but does not want additional students
                    </MenuItem>
                    <MenuItem value="leaving, but keeping students">
                      Leaving, but keeping students
                    </MenuItem>
                  </Select>
                </FormControl>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button variant="contained" onClick={handleNext}>
          Next: Add NRTs
        </Button>
      </Box>
    </Box>
  );
}

export default WorkflowStep3;



