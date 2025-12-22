import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  studentsAPI,
  nrtsAPI,
  assignmentsAPI,
  syncAPI,
} from '../../services/api';

function WorkflowStep7({ onBack, onFinish, workflowData, showStepNumber = true }) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const processWorkflow = async () => {
    setProcessing(true);
    setError(null);

    try {
      // 1. Delete students
      for (const student of workflowData.deletedStudents || []) {
        await studentsAPI.delete(student.row_index);
      }

      // 2. Add new students
      if (workflowData.newStudents?.length > 0) {
        await studentsAPI.bulkAdd(workflowData.newStudents);
      }

      // 3. Delete NRTs (from Step 3)
      for (const nrt of workflowData.deletedNRTs || []) {
        await nrtsAPI.delete(nrt.row_index);
      }

      // 4. Update NRT statuses
      for (const update of workflowData.updatedNRTs || []) {
        const nrts = await nrtsAPI.getAll();
        const nrt = nrts.data.find((n) => n.row_index === update.row_index);
        if (nrt) {
          if (update.status === 'DELETE') {
            await nrtsAPI.delete(update.row_index);
          } else {
            await nrtsAPI.update(update.row_index, { ...nrt, status: update.status });
          }
        }
      }

      // 5. Add new NRTs
      if (workflowData.newNRTs?.length > 0) {
        await nrtsAPI.bulkAdd(workflowData.newNRTs);
      }

      // 6. Assign RTs (skip assignments for deleted students)
      const deletedStudentRowIndices = new Set(
        (workflowData.deletedStudents || []).map((s) => s.row_index)
      );
      
      for (const [studentRowIndex, rtEmail] of Object.entries(workflowData.rtAssignments || {})) {
        const rowIndex = parseInt(studentRowIndex);
        // Skip if this student was deleted
        if (deletedStudentRowIndices.has(rowIndex)) {
          console.log(`[WORKFLOW] Skipping RT assignment for deleted student (row_index: ${rowIndex})`);
          continue;
        }
        try {
          await assignmentsAPI.assignRT(rowIndex, rtEmail);
        } catch (err) {
          // If student not found, it might have been deleted or doesn't exist
          if (err.response?.status === 404 && err.response?.data?.error?.includes('not found')) {
            console.warn(`[WORKFLOW] Student with row_index ${rowIndex} not found for RT assignment, skipping`);
            continue;
          }
          throw err; // Re-throw other errors
        }
      }

      // 7. Assign NRTs (skip assignments for deleted students)
      for (const [studentRowIndex, nrtEmail] of Object.entries(workflowData.nrtAssignments || {})) {
        const rowIndex = parseInt(studentRowIndex);
        // Skip if this student was deleted
        if (deletedStudentRowIndices.has(rowIndex)) {
          console.log(`[WORKFLOW] Skipping NRT assignment for deleted student (row_index: ${rowIndex})`);
          continue;
        }
        try {
          await assignmentsAPI.assignNRT(rowIndex, nrtEmail);
        } catch (err) {
          // If student not found, it might have been deleted or doesn't exist
          if (err.response?.status === 404 && err.response?.data?.error?.includes('not found')) {
            console.warn(`[WORKFLOW] Student with row_index ${rowIndex} not found for NRT assignment, skipping`);
            continue;
          }
          throw err; // Re-throw other errors
        }
      }

      // 8. Export to Google Sheets if any changes were made
      const hasChanges = 
        (workflowData.deletedStudents?.length > 0) ||
        (workflowData.newStudents?.length > 0) ||
        (workflowData.deletedNRTs?.length > 0) ||
        (workflowData.updatedNRTs?.length > 0) ||
        (workflowData.newNRTs?.length > 0) ||
        (Object.keys(workflowData.rtAssignments || {}).length > 0) ||
        (Object.keys(workflowData.nrtAssignments || {}).length > 0);

      if (hasChanges) {
        try {
          console.log('[WORKFLOW] Exporting changes to Google Sheets...');
          await syncAPI.syncToSheets(false); // Use cache if available, but export the changes
          console.log('[WORKFLOW] Successfully exported to Google Sheets');
        } catch (syncErr) {
          console.error('[WORKFLOW] Error exporting to Google Sheets:', syncErr);
          // Don't fail the workflow if sync fails, just log it
          // The user can manually sync later if needed
        }
      }

      onFinish();
    } catch (err) {
      setError(err.response?.data?.error || 'Error processing workflow');
      console.error('Workflow error:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        {showStepNumber ? 'Step 9: Final Review & Confirm' : 'Final Review & Confirm'}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Review all changes before applying them. This will update the Google Sheet.
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Summary of Changes
        </Typography>
        <List>
          <ListItem>
            <ListItemText
              primary="Students to Delete"
              secondary={workflowData.deletedStudents?.length || 0}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="New Students to Add"
              secondary={workflowData.newStudents?.length || 0}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="NRTs to Delete"
              secondary={workflowData.deletedNRTs?.length || 0}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="NRT Status Updates"
              secondary={workflowData.updatedNRTs?.length || 0}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="New NRTs to Add"
              secondary={workflowData.newNRTs?.length || 0}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="RT Assignments"
              secondary={Object.keys(workflowData.rtAssignments || {}).length}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="NRT Assignments"
              secondary={Object.keys(workflowData.nrtAssignments || {}).length}
            />
          </ListItem>
        </List>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onBack} disabled={processing}>
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={processWorkflow}
          disabled={processing}
          startIcon={processing ? <CircularProgress size={20} /> : null}
        >
          {processing ? 'Processing...' : 'Confirm & Apply Changes'}
        </Button>
      </Box>
    </Box>
  );
}

export default WorkflowStep7;



