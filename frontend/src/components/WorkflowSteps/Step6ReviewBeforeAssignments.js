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
  syncAPI,
} from '../../services/api';

function WorkflowStep6({ onNext, onBack, workflowData, onFinish }) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const hasChanges = 
    (workflowData.deletedStudents?.length > 0) ||
    (workflowData.newStudents?.length > 0) ||
    (workflowData.deletedNRTs?.length > 0) ||
    (workflowData.updatedNRTs?.length > 0) ||
    (workflowData.newNRTs?.length > 0);

  const handleApplyChanges = async () => {
    if (!hasChanges) {
      onNext();
      return;
    }

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

      // 3. Delete NRTs
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

      // 6. Export to Google Sheets if onFinish is provided (Part 1 workflow)
      if (onFinish) {
        try {
          console.log('[WORKFLOW] Exporting changes to Google Sheets...');
          await syncAPI.syncToSheets(false); // Use cache if available, but export the changes
          console.log('[WORKFLOW] Successfully exported to Google Sheets');
        } catch (syncErr) {
          console.error('[WORKFLOW] Error exporting to Google Sheets:', syncErr);
          // Don't fail the workflow if sync fails, just log it
        }
        onFinish();
      } else {
        // Changes applied, proceed to assignments (full workflow)
        onNext();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error applying changes');
      console.error('Error applying changes:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 6: Review Changes
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {onFinish 
          ? 'Review all updates, deletions, and additions before confirming and applying changes. This will update the database and Google Sheets.'
          : 'Review all updates, deletions, and additions before proceeding to assign RTs and NRTs. This will help you make informed assignment decisions.'}
      </Typography>

      {!hasChanges && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No changes to review. You can proceed directly to assignments.
        </Alert>
      )}

      {hasChanges && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Summary of Changes
          </Typography>
          <List>
            {workflowData.deletedStudents?.length > 0 && (
              <>
                <ListItem>
                  <ListItemText
                    primary="Students to Delete"
                    secondary={workflowData.deletedStudents.length}
                  />
                </ListItem>
                <Divider />
              </>
            )}
            {workflowData.newStudents?.length > 0 && (
              <>
                <ListItem>
                  <ListItemText
                    primary="New Students to Add"
                    secondary={workflowData.newStudents.length}
                  />
                </ListItem>
                <Divider />
              </>
            )}
            {workflowData.deletedNRTs?.length > 0 && (
              <>
                <ListItem>
                  <ListItemText
                    primary="NRTs to Delete"
                    secondary={`${workflowData.deletedNRTs.length} (${workflowData.deletedNRTs.reduce((sum, nrt) => sum + (nrt.total_students || 0), 0)} students will be unassigned)`}
                  />
                </ListItem>
                <Divider />
              </>
            )}
            {workflowData.updatedNRTs?.length > 0 && (
              <>
                <ListItem>
                  <ListItemText
                    primary="NRT Status Updates"
                    secondary={workflowData.updatedNRTs.length}
                  />
                </ListItem>
                <Divider />
              </>
            )}
            {workflowData.newNRTs?.length > 0 && (
              <>
                <ListItem>
                  <ListItemText
                    primary="New NRTs to Add"
                    secondary={workflowData.newNRTs.length}
                  />
                </ListItem>
              </>
            )}
          </List>
        </Paper>
      )}

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
          onClick={handleApplyChanges}
          disabled={processing}
          startIcon={processing ? <CircularProgress size={20} /> : null}
        >
          {processing ? 'Processing...' : onFinish ? 'CONFIRM & APPLY CHANGES' : 'Apply Changes & Continue'}
        </Button>
      </Box>
    </Box>
  );
}

export default WorkflowStep6;

