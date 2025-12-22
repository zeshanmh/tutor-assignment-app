import React, { useState } from 'react';
import {
  Box,
  Container,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Snackbar,
  Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import WorkflowStep8 from './WorkflowSteps/Step6AssignNRTs';
import WorkflowStep9 from './WorkflowSteps/Step7Confirmation';

const steps = [
  'Assign Non-Resident Tutors',
  'Review & Confirm',
];

function ReassignNRTWorkflow() {
  const [activeStep, setActiveStep] = useState(0);
  const [workflowData, setWorkflowData] = useState({
    nrtAssignments: {},
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleDataUpdate = (stepData) => {
    setWorkflowData((prev) => ({ ...prev, ...stepData }));
  };

  const handleFinish = () => {
    showSnackbar('Workflow Part 3 completed! All changes have been saved.', 'success');
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <WorkflowStep8
            onNext={handleNext}
            onBack={handleBack}
            onDataUpdate={handleDataUpdate}
            initialData={workflowData.nrtAssignments}
          />
        );
      case 1:
        return (
          <WorkflowStep9
            onBack={handleBack}
            onFinish={handleFinish}
            workflowData={workflowData}
            showStepNumber={false}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Workflow: Part 3
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box sx={{ mt: 4 }}>{renderStepContent()}</Box>
        </Paper>
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default ReassignNRTWorkflow;

