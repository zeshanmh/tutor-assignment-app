import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Workflow from './components/Workflow';
import WorkflowPart1 from './components/WorkflowPart1';
import WorkflowPart4 from './components/WorkflowPart4';
import ReassignRTWorkflow from './components/ReassignRTWorkflow';
import ReassignNRTWorkflow from './components/ReassignNRTWorkflow';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1e1e1e', // Softer dark gray/black (similar to Cursor/Anysphere)
      contrastText: '#ffffff', // White text for contrast
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/workflow"
        element={
          <PrivateRoute>
            <Workflow />
          </PrivateRoute>
        }
      />
      <Route
        path="/workflow/part1"
        element={
          <PrivateRoute>
            <WorkflowPart1 />
          </PrivateRoute>
        }
      />
      <Route
        path="/workflow/part2"
        element={
          <PrivateRoute>
            <ReassignRTWorkflow />
          </PrivateRoute>
        }
      />
      <Route
        path="/workflow/part3"
        element={
          <PrivateRoute>
            <ReassignNRTWorkflow />
          </PrivateRoute>
        }
      />
      <Route
        path="/workflow/part4"
        element={
          <PrivateRoute>
            <WorkflowPart4 />
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
