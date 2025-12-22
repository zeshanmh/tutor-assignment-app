import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Snackbar,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import TableChartIcon from '@mui/icons-material/TableChart';
import { nrtsAPI } from '../services/api';

function NRTsView({ onUpdate }) {
  const [nrts, setNrts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNRT, setEditingNRT] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    status: 'active',
    phone_number: '',
    harvard_affiliation: '',
    harvard_id_number: '',
    current_stage_training: '',
    time_in_boston: '',
    medical_interests: '',
    interests_outside_medicine: '',
    interested_in_shadowing: '',
    interested_in_research: '',
    interested_in_organizing_events: '',
    specific_events: '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [viewType, setViewType] = useState('card');
  const [sortOption, setSortOption] = useState('alphabetical');

  const loadNRTs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await nrtsAPI.getAll();
      console.log('Loaded NRTs:', response.data);
      setNrts(response.data || []);
    } catch (err) {
      console.error('Error loading NRTs:', err);
      showSnackbar(err.response?.data?.error || 'Error loading NRTs', 'error');
      setNrts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNRTs();
  }, [loadNRTs]);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (nrt = null) => {
    if (nrt) {
      setEditingNRT(nrt);
      setFormData({
        name: nrt.name || '',
        email: nrt.email || '',
        status: nrt.status || 'active',
        phone_number: nrt.phone_number || '',
        harvard_affiliation: nrt.harvard_affiliation || '',
        harvard_id_number: nrt.harvard_id_number || '',
        current_stage_training: nrt.current_stage_training || '',
        time_in_boston: nrt.time_in_boston || '',
        medical_interests: nrt.medical_interests || '',
        interests_outside_medicine: nrt.interests_outside_medicine || '',
        interested_in_shadowing: nrt.interested_in_shadowing || '',
        interested_in_research: nrt.interested_in_research || '',
        interested_in_organizing_events: nrt.interested_in_organizing_events || '',
        specific_events: nrt.specific_events || '',
      });
    } else {
      setEditingNRT(null);
      setFormData({
        name: '',
        email: '',
        status: 'active',
        phone_number: '',
        harvard_affiliation: '',
        harvard_id_number: '',
        current_stage_training: '',
        time_in_boston: '',
        medical_interests: '',
        interests_outside_medicine: '',
        interested_in_shadowing: '',
        interested_in_research: '',
        interested_in_organizing_events: '',
        specific_events: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingNRT(null);
  };

  const handleSave = async () => {
    try {
      if (editingNRT) {
        await nrtsAPI.update(editingNRT.row_index, formData);
        showSnackbar('NRT updated successfully');
      } else {
        await nrtsAPI.add(formData);
        showSnackbar('NRT added successfully');
      }
      handleCloseDialog();
      loadNRTs();
      if (onUpdate) onUpdate();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Error saving NRT', 'error');
    }
  };

  const handleDelete = async (nrt) => {
    const message = nrt.total_students > 0
      ? `Delete ${nrt.name}? This will unassign ${nrt.total_students} student(s).`
      : `Delete ${nrt.name}?`;
    
    if (!window.confirm(message)) return;

    try {
      const response = await nrtsAPI.delete(nrt.row_index);
      if (response.data.affected_students?.length > 0) {
        showSnackbar(
          `NRT deleted. ${response.data.affected_students.length} student(s) need reassignment.`,
          'warning'
        );
      } else {
        showSnackbar('NRT deleted successfully');
      }
      loadNRTs();
      if (onUpdate) onUpdate();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Error deleting NRT', 'error');
    }
  };

  const sortedNrts = useMemo(() => {
    const sorted = [...nrts];
    
    switch (sortOption) {
      case 'alphabetical':
        sorted.sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          return aName.localeCompare(bName);
        });
        break;
      
      case 'student_count':
        sorted.sort((a, b) => {
          const aCount = a.total_students || 0;
          const bCount = b.total_students || 0;
          if (aCount !== bCount) {
            return bCount - aCount; // Descending order
          }
          // If same count, sort alphabetically
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          return aName.localeCompare(bName);
        });
        break;
      
      default:
        break;
    }
    
    return sorted;
  }, [nrts, sortOption]);

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5">Non-Resident Tutors ({nrts.length})</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={viewType}
            exclusive
            onChange={(e, newView) => newView && setViewType(newView)}
            size="small"
          >
            <ToggleButton value="card" aria-label="card view">
              <ViewModuleIcon />
            </ToggleButton>
            <ToggleButton value="table" aria-label="table view">
              <TableChartIcon />
            </ToggleButton>
          </ToggleButtonGroup>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortOption}
              label="Sort By"
              onChange={(e) => setSortOption(e.target.value)}
            >
              <MenuItem value="alphabetical">Alphabetical</MenuItem>
              <MenuItem value="student_count">Student Count</MenuItem>
            </Select>
          </FormControl>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => handleOpenDialog()}
          >
            Add NRT
          </Button>
        </Box>
      </Box>

      {viewType === 'card' ? (
        <Grid container spacing={2}>
          {sortedNrts.map((nrt, index) => (
            <Grid item xs={12} sm={6} md={4} key={nrt.row_index || `nrt-${index}`}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6">{nrt.name}</Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleOpenDialog(nrt)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(nrt)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {nrt.email}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={nrt.status === 'active' ? 'Active' : 
                             nrt.status === 'pending approval' ? 'Pending Approval' :
                             nrt.status === 'active, but does not want additional students' ? 'Active (No New Students)' :
                             'Leaving'}
                      color={nrt.status === 'active' ? 'success' : 
                             nrt.status === 'pending approval' ? 'default' :
                             nrt.status === 'active, but does not want additional students' ? 'info' :
                             'warning'}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <Chip
                      label={`${nrt.total_students}/3 students`}
                      color={nrt.total_students >= 3 ? 'error' : 'default'}
                      size="small"
                    />
                  </Box>
                  {Object.keys(nrt.class_year_counts || {}).length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {Object.entries(nrt.class_year_counts).map(([year, count]) => (
                        <Chip
                          key={year}
                          label={`Class ${year}: ${count}`}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Total Students</TableCell>
                <TableCell>Class Year Counts</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedNrts.map((nrt, index) => (
                <TableRow key={nrt.row_index || `nrt-${index}`} hover>
                  <TableCell>{nrt.name}</TableCell>
                  <TableCell>{nrt.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={nrt.status === 'active' ? 'Active' : 
                             nrt.status === 'pending approval' ? 'Pending Approval' :
                             nrt.status === 'active, but does not want additional students' ? 'Active (No New Students)' :
                             'Leaving'}
                      color={nrt.status === 'active' ? 'success' : 
                             nrt.status === 'pending approval' ? 'default' :
                             nrt.status === 'active, but does not want additional students' ? 'info' :
                             'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${nrt.total_students}/3`}
                      color={nrt.total_students >= 3 ? 'error' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {Object.keys(nrt.class_year_counts || {}).length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {Object.entries(nrt.class_year_counts).map(([year, count]) => (
                          <Chip
                            key={year}
                            label={`${year}: ${count}`}
                            size="small"
                          />
                        ))}
                      </Box>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenDialog(nrt)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(nrt)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingNRT ? 'Edit NRT' : 'Add NRT'}</DialogTitle>
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
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="pending approval">Pending Approval</MenuItem>
                <MenuItem value="active, but does not want additional students">Active, but does not want additional students</MenuItem>
                <MenuItem value="leaving, but keeping students">Leaving, but keeping students</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Phone Number"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              fullWidth
            />
            <TextField
              label="Harvard Affiliation"
              value={formData.harvard_affiliation}
              onChange={(e) => setFormData({ ...formData, harvard_affiliation: e.target.value })}
              fullWidth
            />
            <TextField
              label="Harvard ID Number"
              value={formData.harvard_id_number}
              onChange={(e) => setFormData({ ...formData, harvard_id_number: e.target.value })}
              fullWidth
            />
            <TextField
              label="Please describe your current stage in training or practice including specialty or research field if applicable."
              value={formData.current_stage_training}
              onChange={(e) => setFormData({ ...formData, current_stage_training: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="How long do you expect to remain in Boston and available as a non-resident tutor?"
              value={formData.time_in_boston}
              onChange={(e) => setFormData({ ...formData, time_in_boston: e.target.value })}
              fullWidth
            />
            <TextField
              label="Please describe any particular interests you have in medicine/dentistry (eg global health, health policy, basic science research, etc.)"
              value={formData.medical_interests}
              onChange={(e) => setFormData({ ...formData, medical_interests: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="What are your interests outside of medicine?"
              value={formData.interests_outside_medicine}
              onChange={(e) => setFormData({ ...formData, interests_outside_medicine: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Would you be interested in having students shadow you?"
              value={formData.interested_in_shadowing}
              onChange={(e) => setFormData({ ...formData, interested_in_shadowing: e.target.value })}
              fullWidth
            />
            <TextField
              label="Would you be interested in having students work in your laboratory or with you on research projects?"
              value={formData.interested_in_research}
              onChange={(e) => setFormData({ ...formData, interested_in_research: e.target.value })}
              fullWidth
            />
            <TextField
              label="Would you be interested in helping organize medicine/health events at Winthrop such as a speaker/journal club, suturing workshop, etc.?"
              value={formData.interested_in_organizing_events}
              onChange={(e) => setFormData({ ...formData, interested_in_organizing_events: e.target.value })}
              fullWidth
            />
            <TextField
              label="If yes, are there any particular events would you like to organize?"
              value={formData.specific_events}
              onChange={(e) => setFormData({ ...formData, specific_events: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

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

export default NRTsView;

