import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Grid,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { studentsAPI } from '../../services/api';

function WorkflowStep1({ onNext, onDataUpdate, initialData }) {
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState(new Set());

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const response = await studentsAPI.getAll();
      setStudents(response.data);
    } catch (err) {
      console.error('Error loading students:', err);
    }
  };

  const handleToggle = (rowIndex) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(rowIndex)) {
      newSelected.delete(rowIndex);
    } else {
      newSelected.add(rowIndex);
    }
    setSelectedStudents(newSelected);
  };

  const handleNext = () => {
    const deletedStudents = Array.from(selectedStudents).map((rowIndex) =>
      students.find((s) => s.row_index === rowIndex)
    );
    onDataUpdate({ deletedStudents });
    onNext();
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 1: Update/Delete Students
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Select students to remove (inactive or no longer pre-med). You can undo deletions later.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {students.map((student) => (
          <Grid item xs={12} sm={6} md={4} key={student.row_index}>
            <Card
              variant={selectedStudents.has(student.row_index) ? 'outlined' : 'elevation'}
              sx={{
                border: selectedStudents.has(student.row_index) ? '2px solid red' : 'none',
              }}
            >
              <CardContent>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedStudents.has(student.row_index)}
                      onChange={() => handleToggle(student.row_index)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="subtitle1">
                        {student.first_name} {student.last_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {student.primary_email}
                      </Typography>
                    </Box>
                  }
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined" disabled>
          Back
        </Button>
        <Button variant="contained" onClick={handleNext}>
          Next: Add Students ({selectedStudents.size} selected for deletion)
        </Button>
      </Box>
    </Box>
  );
}

export default WorkflowStep1;




