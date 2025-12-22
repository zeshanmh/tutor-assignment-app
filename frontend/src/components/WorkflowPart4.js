import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Snackbar, Alert, AppBar, Toolbar, Typography, IconButton, Container, Paper } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WorkflowStep8SendEmails from './WorkflowSteps/Step8SendEmails';

function WorkflowPart4() {
  const navigate = useNavigate();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleFinish = () => {
    showSnackbar('Workflow Part 4 completed! All emails have been sent.', 'success');
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
  };

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Workflow: Part 4
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <WorkflowStep8SendEmails onFinish={handleFinish} />
        </Paper>
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default WorkflowPart4;

