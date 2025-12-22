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
import UndoIcon from '@mui/icons-material/Undo';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import TableChartIcon from '@mui/icons-material/TableChart';
import { studentsAPI, rtsAPI, nrtsAPI } from '../services/api';

function StudentsView({ onUpdate }) {
  const [students, setStudents] = useState([]);
  const [rts, setRTs] = useState([]);
  const [nrts, setNRTs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    primary_email: '',
    secondary_email: '',
    class_year: '',
    status: 'Not Applying',
    rt_assignment: '',
    nrt_assignment: '',
    phone_number: '',
    hometown: '',
    concentration: '',
    secondary: '',
    extracurricular_activities: '',
    clinical_shadowing: '',
    research_activities: '',
    medical_interests: '',
    program_interests: '',
  });
  const [deletedStudent, setDeletedStudent] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [viewType, setViewType] = useState('card');
  const [sortOption, setSortOption] = useState('alphabetical');

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await studentsAPI.getAll();
      console.log('Loaded students:', response.data);
      setStudents(response.data || []);
    } catch (err) {
      console.error('Error loading students:', err);
      showSnackbar(err.response?.data?.error || 'Error loading students', 'error');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRTsAndNRTs = useCallback(async () => {
    try {
      const [rtsRes, nrtsRes] = await Promise.all([
        rtsAPI.getAll(),
        nrtsAPI.getAll()
      ]);
      setRTs(rtsRes.data || []);
      setNRTs(nrtsRes.data || []);
    } catch (err) {
      console.error('Error loading RTs/NRTs:', err);
    }
  }, []);

  useEffect(() => {
    loadStudents();
    loadRTsAndNRTs();
  }, [loadStudents, loadRTsAndNRTs]);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (student = null) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        first_name: student.first_name,
        last_name: student.last_name,
        primary_email: student.primary_email,
        secondary_email: student.secondary_email || '',
        class_year: student.class_year || '',
        status: student.status || 'Not Applying',
        rt_assignment: student.rt_assignment || '',
        nrt_assignment: student.nrt_assignment || '',
        phone_number: student.phone_number || '',
        hometown: student.hometown || '',
        concentration: student.concentration || '',
        secondary: student.secondary || '',
        extracurricular_activities: student.extracurricular_activities || '',
        clinical_shadowing: student.clinical_shadowing || '',
        research_activities: student.research_activities || '',
        medical_interests: student.medical_interests || '',
        program_interests: student.program_interests || '',
      });
    } else {
      setEditingStudent(null);
      setFormData({
        first_name: '',
        last_name: '',
        primary_email: '',
        secondary_email: '',
        class_year: '',
        status: 'Not Applying',
        rt_assignment: '',
        nrt_assignment: '',
        phone_number: '',
        hometown: '',
        concentration: '',
        secondary: '',
        extracurricular_activities: '',
        clinical_shadowing: '',
        research_activities: '',
        medical_interests: '',
        program_interests: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingStudent(null);
  };

  const handleSave = async () => {
    try {
      // Prepare data - convert empty strings to null for assignments
      const saveData = {
        ...formData,
        rt_assignment: formData.rt_assignment || null,
        nrt_assignment: formData.nrt_assignment || null,
      };
      
      if (editingStudent) {
        await studentsAPI.update(editingStudent.row_index, saveData);
        showSnackbar('Student updated successfully');
      } else {
        await studentsAPI.add(saveData);
        showSnackbar('Student added successfully');
      }
      handleCloseDialog();
      loadStudents();
      loadRTsAndNRTs(); // Reload RTs/NRTs to update student counts
      if (onUpdate) onUpdate();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Error saving student', 'error');
    }
  };

  const handleDelete = async (student) => {
    if (!window.confirm(`Delete ${student.first_name} ${student.last_name}?`)) return;

    try {
      const response = await studentsAPI.delete(student.row_index);
      setDeletedStudent({ student: response.data.deleted_student, row_index: student.row_index });
      showSnackbar('Student deleted. Click undo to restore.', 'info');
      loadStudents();
      if (onUpdate) onUpdate();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Error deleting student', 'error');
    }
  };

  const handleUndo = async () => {
    if (!deletedStudent) return;

    try {
      await studentsAPI.restore(deletedStudent.student, deletedStudent.row_index);
      showSnackbar('Student restored successfully');
      setDeletedStudent(null);
      loadStudents();
      if (onUpdate) onUpdate();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Error restoring student', 'error');
    }
  };

  const sortedStudents = useMemo(() => {
    const sorted = [...students];
    
    switch (sortOption) {
      case 'alphabetical':
        sorted.sort((a, b) => {
          const aLast = (a.last_name || '').toLowerCase();
          const bLast = (b.last_name || '').toLowerCase();
          if (aLast !== bLast) return aLast.localeCompare(bLast);
          const aFirst = (a.first_name || '').toLowerCase();
          const bFirst = (b.first_name || '').toLowerCase();
          return aFirst.localeCompare(bFirst);
        });
        break;
      
      case 'nrt_order':
        sorted.sort((a, b) => {
          const aNRT = (a.nrt_assignment || '').toLowerCase();
          const bNRT = (b.nrt_assignment || '').toLowerCase();
          if (aNRT !== bNRT) {
            if (!aNRT) return 1;
            if (!bNRT) return -1;
            return aNRT.localeCompare(bNRT);
          }
          // Within same NRT, sort alphabetically
          const aLast = (a.last_name || '').toLowerCase();
          const bLast = (b.last_name || '').toLowerCase();
          if (aLast !== bLast) return aLast.localeCompare(bLast);
          const aFirst = (a.first_name || '').toLowerCase();
          const bFirst = (b.first_name || '').toLowerCase();
          return aFirst.localeCompare(bFirst);
        });
        break;
      
      case 'rt_order':
        sorted.sort((a, b) => {
          const aRT = (a.rt_assignment || '').toLowerCase();
          const bRT = (b.rt_assignment || '').toLowerCase();
          if (aRT !== bRT) {
            if (!aRT) return 1;
            if (!bRT) return -1;
            return aRT.localeCompare(bRT);
          }
          // Within same RT, sort alphabetically
          const aLast = (a.last_name || '').toLowerCase();
          const bLast = (b.last_name || '').toLowerCase();
          if (aLast !== bLast) return aLast.localeCompare(bLast);
          const aFirst = (a.first_name || '').toLowerCase();
          const bFirst = (b.first_name || '').toLowerCase();
          return aFirst.localeCompare(bFirst);
        });
        break;
      
      case 'status':
        // Sort by status priority: Currently Applying > Applying Next Cycle > Not Applying
        const statusPriority = {
          'Currently Applying': 1,
          'Applying Next Cycle': 2,
          'Not Applying': 3,
        };
        sorted.sort((a, b) => {
          const aStatus = a.status || 'Not Applying';
          const bStatus = b.status || 'Not Applying';
          const aPriority = statusPriority[aStatus] || 3;
          const bPriority = statusPriority[bStatus] || 3;
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          // Within same status, sort alphabetically
          const aLast = (a.last_name || '').toLowerCase();
          const bLast = (b.last_name || '').toLowerCase();
          if (aLast !== bLast) return aLast.localeCompare(bLast);
          const aFirst = (a.first_name || '').toLowerCase();
          const bFirst = (b.first_name || '').toLowerCase();
          return aFirst.localeCompare(bFirst);
        });
        break;
      
      default:
        break;
    }
    
    return sorted;
  }, [students, sortOption]);

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5">Students ({students.length})</Typography>
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
              <MenuItem value="nrt_order">NRT Order</MenuItem>
              <MenuItem value="rt_order">RT Order</MenuItem>
              <MenuItem value="status">Status</MenuItem>
            </Select>
          </FormControl>
          {deletedStudent && (
            <Button
              startIcon={<UndoIcon />}
              onClick={handleUndo}
              variant="outlined"
            >
              Undo Delete
            </Button>
          )}
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => handleOpenDialog()}
          >
            Add Student
          </Button>
        </Box>
      </Box>

      {viewType === 'card' ? (
        <Grid container spacing={2}>
          {sortedStudents.map((student, index) => (
            <Grid item xs={12} sm={6} md={4} key={student.row_index || `student-${index}`}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6">
                      {student.first_name} {student.last_name}
                    </Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleOpenDialog(student)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(student)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {student.primary_email}
                  </Typography>
                  {student.class_year && (
                    <Chip label={`Class ${student.class_year}`} size="small" sx={{ mt: 1, mr: 1 }} />
                  )}
                  {student.status && (
                    <Chip 
                      label={student.status} 
                      size="small" 
                      sx={{ mt: 1, mr: 1 }}
                      color={student.status === 'Currently Applying' ? 'success' : 
                             student.status === 'Applying Next Cycle' ? 'info' : 'default'}
                    />
                  )}
                  {student.rt_assignment && (
                    <Chip label={`RT: ${student.rt_assignment}`} size="small" sx={{ mt: 1, mr: 1 }} />
                  )}
                  {student.nrt_assignment && (
                    <Chip label={`NRT: ${student.nrt_assignment}`} size="small" sx={{ mt: 1 }} />
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
                <TableCell>First Name</TableCell>
                <TableCell>Last Name</TableCell>
                <TableCell>Primary Email</TableCell>
                <TableCell>Secondary Email</TableCell>
                <TableCell>Class Year</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>NRT Assignment</TableCell>
                <TableCell>RT Assignment</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedStudents.map((student, index) => (
                <TableRow key={student.row_index || `student-${index}`} hover>
                  <TableCell>{student.first_name}</TableCell>
                  <TableCell>{student.last_name}</TableCell>
                  <TableCell>{student.primary_email || '-'}</TableCell>
                  <TableCell>{student.secondary_email || '-'}</TableCell>
                  <TableCell>{student.class_year || '-'}</TableCell>
                  <TableCell>
                    {student.status ? (
                      <Chip 
                        label={student.status} 
                        size="small"
                        color={student.status === 'Currently Applying' ? 'success' : 
                               student.status === 'Applying Next Cycle' ? 'info' : 'default'}
                      />
                    ) : '-'}
                  </TableCell>
                  <TableCell>{student.nrt_assignment || '-'}</TableCell>
                  <TableCell>{student.rt_assignment || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenDialog(student)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(student)}>
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
        <DialogTitle>{editingStudent ? 'Edit Student' : 'Add Student'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="First Name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Primary Email"
              type="email"
              value={formData.primary_email}
              onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Secondary Email"
              type="email"
              value={formData.secondary_email}
              onChange={(e) => setFormData({ ...formData, secondary_email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Class Year"
              value={formData.class_year}
              onChange={(e) => setFormData({ ...formData, class_year: e.target.value })}
              placeholder="e.g., 2025"
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <MenuItem value="Not Applying">Not Applying</MenuItem>
                <MenuItem value="Currently Applying">Currently Applying</MenuItem>
                <MenuItem value="Applying Next Cycle">Applying Next Cycle</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>RT Assignment</InputLabel>
              <Select
                value={formData.rt_assignment}
                label="RT Assignment"
                onChange={(e) => setFormData({ ...formData, rt_assignment: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {rts.map((rt) => (
                  <MenuItem key={rt.email} value={rt.name}>
                    {rt.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>NRT Assignment</InputLabel>
              <Select
                value={formData.nrt_assignment}
                label="NRT Assignment"
                onChange={(e) => setFormData({ ...formData, nrt_assignment: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {nrts
                  .filter((nrt) => {
                    // Always show the currently assigned NRT (if any)
                    if (editingStudent && editingStudent.nrt_assignment && 
                        nrt.name === editingStudent.nrt_assignment) {
                      return true;
                    }
                    // For others, only show active NRTs with capacity
                    const isActive = 
                      nrt.status === 'active' && 
                      nrt.status !== 'leaving, but keeping students' &&
                      nrt.status !== 'active, but does not want additional students' &&
                      nrt.status !== 'pending approval';
                    const hasCapacity = (nrt.total_students || 0) < 3;
                    return isActive && hasCapacity;
                  })
                  .map((nrt) => {
                    const isCurrentlyAssigned = editingStudent && 
                      editingStudent.nrt_assignment === nrt.name;
                    const isActive = 
                      nrt.status === 'active' && 
                      nrt.status !== 'leaving, but keeping students' &&
                      nrt.status !== 'active, but does not want additional students';
                    const hasCapacity = (nrt.total_students || 0) < 3;
                    const isAvailable = isActive && hasCapacity;
                    
                    return (
                      <MenuItem 
                        key={nrt.email} 
                        value={nrt.name}
                        disabled={!isCurrentlyAssigned && !isAvailable}
                      >
                        {nrt.name} ({(nrt.total_students || 0)}/3)
                        {isCurrentlyAssigned && !isAvailable && ' (Current - Not Available)'}
                      </MenuItem>
                    );
                  })}
              </Select>
            </FormControl>
            <TextField
              label="Phone Number"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              fullWidth
            />
            <TextField
              label="Home Town and State or Country"
              value={formData.hometown}
              onChange={(e) => setFormData({ ...formData, hometown: e.target.value })}
              placeholder="e.g., Boston, MA or London, UK"
              fullWidth
            />
            <TextField
              label="Concentration"
              value={formData.concentration}
              onChange={(e) => setFormData({ ...formData, concentration: e.target.value })}
              fullWidth
            />
            <TextField
              label="Secondary"
              value={formData.secondary}
              onChange={(e) => setFormData({ ...formData, secondary: e.target.value })}
              fullWidth
            />
            <TextField
              label="In what extracurricular activities do you take part?"
              value={formData.extracurricular_activities}
              onChange={(e) => setFormData({ ...formData, extracurricular_activities: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Briefly describe any clinical shadowing you have done during college"
              value={formData.clinical_shadowing}
              onChange={(e) => setFormData({ ...formData, clinical_shadowing: e.target.value })}
              multiline
              rows={4}
              fullWidth
            />
            <TextField
              label="Describe any research activities you have done or would like to do"
              value={formData.research_activities}
              onChange={(e) => setFormData({ ...formData, research_activities: e.target.value })}
              multiline
              rows={4}
              fullWidth
            />
            <TextField
              label="Describe any general interests in medicine that you might have"
              value={formData.medical_interests}
              onChange={(e) => setFormData({ ...formData, medical_interests: e.target.value })}
              multiline
              rows={4}
              fullWidth
            />
            <TextField
              label="What programs are you interested in?"
              value={formData.program_interests}
              onChange={(e) => setFormData({ ...formData, program_interests: e.target.value })}
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

export default StudentsView;

