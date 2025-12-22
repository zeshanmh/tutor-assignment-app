import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Box,
  Button,
  Tabs,
  Tab,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  Menu,
  MenuItem,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import LogoutIcon from '@mui/icons-material/Logout';
import SyncIcon from '@mui/icons-material/Sync';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import StudentsView from './StudentsView';
import NRTsView from './NRTsView';
import RTsView from './RTsView';
import { authAPI, statsAPI, syncAPI } from '../services/api';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function Dashboard() {
  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [workflowMenuAnchor, setWorkflowMenuAnchor] = useState(null);
  const [menuWidth, setMenuWidth] = useState(null);
  const workflowButtonRef = useRef(null);
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
    loadSyncStatus();
  }, []);

  const loadStats = async () => {
    try {
      const response = await statsAPI.get();
      setStats(response.data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await syncAPI.getStatus();
      setSyncStatus(response.data);
    } catch (err) {
      console.error('Error loading sync status:', err);
      // If sync is not configured, that's okay
      if (err.response?.status !== 400) {
        setSyncStatus({ configured: false });
      }
    }
  };

  const handleSyncToSheets = async (force = false) => {
    setSyncLoading(true);
    setSyncMessage(null);
    setSyncError(null);
    try {
      const response = await syncAPI.syncToSheets(force);
      setSyncMessage(response.data.message || 'Successfully synced to Google Sheets');
      if (response.data.cached) {
        setSyncMessage('Sync skipped - cache is still valid. Use "Force Sync" to sync anyway.');
      }
      await loadSyncStatus();
      await loadStats(); // Reload stats in case counts changed
    } catch (err) {
      setSyncError(err.response?.data?.error || err.message || 'Failed to sync to Google Sheets');
      console.error('Sync error:', err);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncFromSheets = async (force = false) => {
    setSyncLoading(true);
    setSyncMessage(null);
    setSyncError(null);
    try {
      const response = await syncAPI.syncFromSheets(force);
      setSyncMessage(response.data.message || 'Successfully synced from Google Sheets');
      if (response.data.cached) {
        setSyncMessage('Sync skipped - file has not changed since last sync. Use "Force Sync" to sync anyway.');
      }
      await loadSyncStatus();
      await loadStats(); // Reload stats in case counts changed
      // Trigger refresh of all views by updating refreshKey
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      setSyncError(err.response?.data?.error || err.message || 'Failed to sync from Google Sheets');
      console.error('Sync error:', err);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Winthrop Tutor Assignment System
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {userEmail}
          </Typography>
          <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" component="h1">
            Dashboard
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {syncStatus?.configured && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<SyncIcon />}
                onClick={() => setSyncDialogOpen(true)}
              >
                Sync with Google Sheets
              </Button>
            )}
            <Button
              ref={workflowButtonRef}
              variant="contained"
              color="primary"
              size="large"
              endIcon={<ArrowDropDownIcon />}
              onClick={(e) => {
                setWorkflowMenuAnchor(e.currentTarget);
                if (workflowButtonRef.current) {
                  setMenuWidth(workflowButtonRef.current.offsetWidth);
                }
              }}
            >
              Start Workflow
            </Button>
            <Menu
              anchorEl={workflowMenuAnchor}
              open={Boolean(workflowMenuAnchor)}
              onClose={() => setWorkflowMenuAnchor(null)}
              PaperProps={{
                style: {
                  width: menuWidth || 'auto',
                },
              }}
            >
              <MenuItem
                onClick={() => {
                  setWorkflowMenuAnchor(null);
                  navigate('/workflow/part1');
                }}
              >
                Part 1: Update Database
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setWorkflowMenuAnchor(null);
                  navigate('/workflow/part2');
                }}
              >
                Part 2: Assign RTs
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setWorkflowMenuAnchor(null);
                  navigate('/workflow/part3');
                }}
              >
                Part 3: Assign NRTs
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setWorkflowMenuAnchor(null);
                  navigate('/workflow/part4');
                }}
              >
                Part 4: Send Emails
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {stats && (
          <Box sx={{ mb: 4, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Statistics
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Typography variant="body2">
                <strong>Total Students:</strong> {stats.total_students}
              </Typography>
              <Typography variant="body2">
                <strong>Students not yet assigned RTs:</strong> {stats.unassigned_rt_students_count || 0}
              </Typography>
              <Typography variant="body2">
                <strong>Students not yet assigned NRTs:</strong> {stats.unassigned_nrt_students_count || 0}
              </Typography>
              <Typography variant="body2">
                <strong>Total RTs:</strong> {stats.total_rts}
              </Typography>
              <Typography variant="body2">
                <strong>Active NRTs:</strong> {stats.active_nrts}
              </Typography>
            </Box>
          </Box>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tab} onChange={(e, newValue) => setTab(newValue)}>
            <Tab label="Students" />
            <Tab label="Non-Resident Tutors" />
            <Tab label="Resident Tutors" />
          </Tabs>
        </Box>

        <TabPanel value={tab} index={0}>
          <StudentsView key={refreshKey} onUpdate={loadStats} />
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <NRTsView key={refreshKey} onUpdate={loadStats} />
        </TabPanel>
        <TabPanel value={tab} index={2}>
          <RTsView key={refreshKey} onUpdate={loadStats} />
        </TabPanel>
      </Container>

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SyncIcon />
            <Typography variant="h6">Sync with Google Sheets</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {syncError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSyncError(null)}>
              {syncError}
            </Alert>
          )}
          {syncMessage && (
            <Alert severity={syncMessage.includes('skipped') ? 'info' : 'success'} sx={{ mb: 2 }} onClose={() => setSyncMessage(null)}>
              {syncMessage}
            </Alert>
          )}
          
          <Typography variant="body2" sx={{ mb: 3 }}>
            Sync your database with the shared Google Sheets file. Changes made in Google Sheets can be imported, 
            and changes in the app can be exported to Google Sheets.
          </Typography>

          {syncStatus?.configured && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Last Sync Status:
              </Typography>
              {syncStatus.last_export_to_sheets && (
                <Chip 
                  label={`Exported: ${new Date(syncStatus.last_export_to_sheets).toLocaleString()}`}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              )}
              {syncStatus.last_import_from_sheets && (
                <Chip 
                  label={`Imported: ${new Date(syncStatus.last_import_from_sheets).toLocaleString()}`}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={syncLoading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
              onClick={() => handleSyncToSheets(false)}
              disabled={syncLoading}
              fullWidth
            >
              Export to Google Sheets
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={syncLoading ? <CircularProgress size={20} /> : <CloudDownloadIcon />}
              onClick={() => handleSyncFromSheets(false)}
              disabled={syncLoading}
              fullWidth
            >
              Import from Google Sheets
            </Button>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                variant="text"
                size="small"
                onClick={() => handleSyncToSheets(true)}
                disabled={syncLoading}
                sx={{ flex: 1 }}
              >
                Force Export
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => handleSyncFromSheets(true)}
                disabled={syncLoading}
                sx={{ flex: 1 }}
              >
                Force Import
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setSyncDialogOpen(false);
            setSyncMessage(null);
            setSyncError(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Dashboard;

