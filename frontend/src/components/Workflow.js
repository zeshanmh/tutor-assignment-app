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
import WorkflowStep1 from './WorkflowSteps/Step1UpdateStudents';
import WorkflowStep2 from './WorkflowSteps/Step2AddStudents';
import WorkflowStep3 from './WorkflowSteps/Step3DeleteNRTs';
import WorkflowStep4 from './WorkflowSteps/Step3UpdateNRTs';
import WorkflowStep5 from './WorkflowSteps/Step4AddNRTs';
import WorkflowStep6 from './WorkflowSteps/Step6ReviewBeforeAssignments';
import WorkflowStep7 from './WorkflowSteps/Step5AssignRTs';
import WorkflowStep8 from './WorkflowSteps/Step6AssignNRTs';
import WorkflowStep9 from './WorkflowSteps/Step7Confirmation';

const steps = [
  'Update/Delete Students',
  'Add New Students',
  'Delete NRTs',
  'Update NRT Status',
  'Add New NRTs',
  'Review Changes',
  'Assign Resident Tutors',
  'Assign Non-Resident Tutors',
  'Final Review & Confirm',
];

function Workflow() {
  const [activeStep, setActiveStep] = useState(0);
  const [workflowData, setWorkflowData] = useState({
    deletedStudents: [],
    newStudents: [],
    deletedNRTs: [],
    updatedNRTs: [],
    newNRTs: [],
    rtAssignments: {},
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
    showSnackbar('Workflow completed! All changes have been saved.', 'success');
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <WorkflowStep1
            onNext={handleNext}
            onDataUpdate={handleDataUpdate}
            initialData={workflowData.deletedStudents}
          />
        );
      case 1:
        return (
          <WorkflowStep2
            onNext={handleNext}
            onBack={handleBack}
            onDataUpdate={handleDataUpdate}
            initialData={workflowData.newStudents}
          />
        );
      case 2:
        return (
          <WorkflowStep3
            onNext={handleNext}
            onBack={handleBack}
            onDataUpdate={handleDataUpdate}
            initialData={workflowData.deletedNRTs}
          />
        );
      case 3:
        return (
          <WorkflowStep4
            onNext={handleNext}
            onBack={handleBack}
            onDataUpdate={handleDataUpdate}
            initialData={workflowData.updatedNRTs}
          />
        );
      case 4:
        return (
          <WorkflowStep5
            onNext={handleNext}
            onBack={handleBack}
            onDataUpdate={handleDataUpdate}
            initialData={workflowData.newNRTs}
          />
        );
      case 5:
        return (
          <WorkflowStep6
            onNext={handleNext}
            onBack={handleBack}
            workflowData={workflowData}
          />
        );
      case 6:
        return (
          <WorkflowStep7
            onNext={handleNext}
            onBack={handleBack}
            onDataUpdate={handleDataUpdate}
            initialData={workflowData.rtAssignments}
          />
        );
      case 7:
        return (
          <WorkflowStep8
            onNext={handleNext}
            onBack={handleBack}
            onDataUpdate={handleDataUpdate}
            initialData={workflowData.nrtAssignments}
          />
        );
      case 8:
        return (
          <WorkflowStep9
            onBack={handleBack}
            onFinish={handleFinish}
            workflowData={workflowData}
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
            Assignment Workflow
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

export default Workflow;



