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
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import TableChartIcon from '@mui/icons-material/TableChart';
import { rtsAPI } from '../services/api';

function RTsView({ onUpdate }) {
  const [rts, setRTs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRT, setEditingRT] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [viewType, setViewType] = useState('card');
  const [sortOption, setSortOption] = useState('alphabetical');

  const loadRTs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await rtsAPI.getAll();
      console.log('Loaded RTs:', response.data);
      setRTs(response.data || []);
    } catch (err) {
      console.error('Error loading RTs:', err);
      showSnackbar(err.response?.data?.error || 'Error loading RTs', 'error');
      setRTs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRTs();
  }, [loadRTs]);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (rt = null) => {
    if (rt) {
      setEditingRT(rt);
      setFormData({
        name: rt.name,
        email: rt.email,
      });
    } else {
      setEditingRT(null);
      setFormData({
        name: '',
        email: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRT(null);
  };

  const handleSave = async () => {
    try {
      if (editingRT) {
        await rtsAPI.update(editingRT.row_index, formData);
        showSnackbar('RT updated successfully');
      } else {
        await rtsAPI.add(formData);
        showSnackbar('RT added successfully');
      }
      handleCloseDialog();
      loadRTs();
      if (onUpdate) onUpdate();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Error saving RT', 'error');
    }
  };

  const handleDelete = async (rt) => {
    if (!window.confirm(`Delete ${rt.name}?`)) return;

    try {
      await rtsAPI.delete(rt.row_index);
      showSnackbar('RT deleted successfully');
      loadRTs();
      if (onUpdate) onUpdate();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Error deleting RT', 'error');
    }
  };

  const sortedRTs = useMemo(() => {
    const sorted = [...rts];
    
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
          const aCount = a.student_count || 0;
          const bCount = b.student_count || 0;
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
  }, [rts, sortOption]);

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5">Resident Tutors ({rts.length})</Typography>
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
            Add RT
          </Button>
        </Box>
      </Box>

      {viewType === 'card' ? (
        <Grid container spacing={2}>
          {sortedRTs.map((rt) => (
            <Grid item xs={12} sm={6} md={4} key={rt.row_index}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6">{rt.name}</Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleOpenDialog(rt)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(rt)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {rt.email}
                  </Typography>
                  <Chip
                    label={`${rt.student_count} student(s)`}
                    size="small"
                    sx={{ mt: 1 }}
                    color="primary"
                  />
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
                <TableCell>Student Count</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRTs.map((rt) => (
                <TableRow key={rt.row_index} hover>
                  <TableCell>{rt.name}</TableCell>
                  <TableCell>{rt.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${rt.student_count} student(s)`}
                      size="small"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenDialog(rt)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(rt)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRT ? 'Edit RT' : 'Add RT'}</DialogTitle>
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

export default RTsView;

