import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  LinearProgress,
  List,
  ListItem,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { studentsAPI, nrtsAPI } from '../../services/api';

// Similarity Scoring Functions
function extractWords(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Common stop words to exclude
  const stopWords = new Set([
    'and', 'the', 'of', 'to', 'a', 'an', 'in', 'on', 'at', 'for', 'with', 'by',
    'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
    'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'interested', 'interest', 'interests', 'interested in', 'about', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under',
    'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
    'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    's', 't', 'can', 'will', 'just', 'don', 'should', 'now'
  ]);
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/) // Split by whitespace
    .filter(word => word.length > 2 && !stopWords.has(word)); // Filter out short words and stop words
}

function calculateSimilarity(student, nrt) {
  // Extract words from relevant fields
  const studentMedical = extractWords(student.medical_interests || '');
  const nrtMedical = extractWords(nrt.medical_interests || '');
  
  const studentResearch = extractWords(student.research_activities || '');
  const nrtResearch = extractWords(nrt.interested_in_research || '');
  
  const studentHobbies = extractWords(student.extracurricular_activities || '');
  const nrtHobbies = extractWords(nrt.interests_outside_medicine || '');
  
  // Calculate matches
  const medicalMatches = studentMedical.filter(word => nrtMedical.includes(word));
  const researchMatches = studentResearch.filter(word => nrtResearch.includes(word));
  const hobbyMatches = studentHobbies.filter(word => nrtHobbies.includes(word));
  
  // Calculate scores (0-100)
  const totalMedicalWords = new Set([...studentMedical, ...nrtMedical]).size;
  const totalResearchWords = new Set([...studentResearch, ...nrtResearch]).size;
  const totalHobbyWords = new Set([...studentHobbies, ...nrtHobbies]).size;
  
  const medicalScore = totalMedicalWords > 0 
    ? (medicalMatches.length / totalMedicalWords) * 100 
    : 0;
  const researchScore = totalResearchWords > 0 
    ? (researchMatches.length / totalResearchWords) * 100 
    : 0;
  const hobbyScore = totalHobbyWords > 0 
    ? (hobbyMatches.length / totalHobbyWords) * 100 
    : 0;
  
  // Weighted total score
  const totalScore = (medicalScore * 0.4) + (researchScore * 0.4) + (hobbyScore * 0.2);
  
  return {
    score: Math.round(totalScore),
    medicalScore: Math.round(medicalScore),
    researchScore: Math.round(researchScore),
    hobbyScore: Math.round(hobbyScore),
    matchingKeywords: {
      medical: medicalMatches,
      research: researchMatches,
      hobbies: hobbyMatches,
    },
  };
}

// Optimal Assignment Algorithm
function generateOptimalAssignments(students, nrts, currentAssignments) {
  // Filter available NRTs (active, have capacity, accepting new students)
  const availableNrts = nrts.filter(nrt => {
    const isActive = nrt.status === 'active';
    const isAccepting = nrt.status !== 'leaving, but keeping students' && 
                       nrt.status !== 'active, but does not want additional students' &&
                       nrt.status !== 'pending approval';
    
    if (!isActive || !isAccepting) return false;
    
    // Calculate current capacity
    const currentCount = (currentAssignments[nrt.email] || []).length;
    return currentCount < 3;
  });
  
  if (availableNrts.length === 0 || students.length === 0) {
    return [];
  }
  
  // Calculate similarity scores for all student-NRT pairs
  const scores = [];
  students.forEach(student => {
    availableNrts.forEach(nrt => {
      const similarity = calculateSimilarity(student, nrt);
      const currentCount = (currentAssignments[nrt.email] || []).length;
      const remainingCapacity = 3 - currentCount;
      
      scores.push({
        student,
        nrt,
        similarity,
        remainingCapacity,
      });
    });
  });
  
  // Sort by similarity score (descending)
  scores.sort((a, b) => b.similarity.score - a.similarity.score);
  
  // Greedy assignment with capacity constraints
  const assignments = [];
  const assignedStudents = new Set();
  const nrtCounts = {};
  
  availableNrts.forEach(nrt => {
    nrtCounts[nrt.email] = (currentAssignments[nrt.email] || []).length;
  });
  
  scores.forEach(({ student, nrt, similarity, remainingCapacity }) => {
    if (assignedStudents.has(student.row_index)) return;
    if (nrtCounts[nrt.email] >= 3) return;
    
    assignments.push({
      student,
      nrt,
      similarity,
    });
    
    assignedStudents.add(student.row_index);
    nrtCounts[nrt.email]++;
  });
  
  // Sort assignments by student priority (maintain original order)
  const studentOrder = new Map(students.map((s, idx) => [s.row_index, idx]));
  assignments.sort((a, b) => {
    const aIdx = studentOrder.get(a.student.row_index);
    const bIdx = studentOrder.get(b.student.row_index);
    return aIdx - bIdx;
  });
  
  return assignments;
}

// Comparison Panel Component
// Resizable Split Panel Component
function ResizableSplit({ left, right, defaultLeftWidth = '50%' }) {
  const [leftWidth, setLeftWidth] = React.useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = React.useState(false);
  const containerRef = React.useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
      
      // Constrain between 20% and 80%
      const constrainedWidth = Math.max(20, Math.min(80, newLeftWidth));
      setLeftWidth(`${constrainedWidth}%`);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        height: '100%',
        width: '100%',
        position: 'relative',
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Left Panel */}
      <Box
        sx={{
          width: leftWidth,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            flex: '1 1 auto',
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
          }}
        >
          {left}
        </Box>
      </Box>

      {/* Resize Handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          width: '4px',
          height: '100%',
          backgroundColor: 'divider',
          cursor: 'ew-resize',
          flexShrink: 0,
          position: 'relative',
          '&:hover': {
            backgroundColor: 'primary.main',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            left: '-2px',
            right: '-2px',
            top: 0,
            bottom: 0,
          },
        }}
      />

      {/* Right Panel */}
      <Box
        sx={{
          flex: '1 1 auto',
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            flex: '1 1 auto',
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
          }}
        >
          {right}
        </Box>
      </Box>
    </Box>
  );
}

function highlightKeywords(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return text;
  
  const words = keywords.map(k => k.toLowerCase());
  const regex = new RegExp(`\\b(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (words.includes(part.toLowerCase())) {
      return (
        <mark
          key={index}
          style={{
            backgroundColor: '#ffeb3b',
            padding: '2px 4px',
            borderRadius: '2px',
          }}
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

function ComparisonPanel({ open, onClose, student, nrt, similarity }) {
  const renderField = (label, value, matchingKeywords = []) => {
    if (!value || value.trim() === '') return null;
    const highlighted = highlightKeywords(value, matchingKeywords);
    
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Typography 
          variant="body2"
          component="div"
          sx={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {highlighted}
        </Typography>
      </Box>
    );
  };

  const studentPanel = (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom color="primary">
        Student
      </Typography>
      {student ? (
        <>
          <Typography variant="subtitle1" gutterBottom>
            {student.first_name} {student.last_name}
          </Typography>
          <Box sx={{ mb: 2 }}>
            {student.class_year && (
              <Chip label={`Class ${student.class_year}`} size="small" sx={{ mr: 1 }} />
            )}
            {student.status && (
              <Chip 
                label={student.status} 
                size="small"
                color={student.status === 'Currently Applying' ? 'success' : 
                       student.status === 'Applying Next Cycle' ? 'info' : 'default'}
              />
            )}
          </Box>
          <Divider sx={{ my: 2 }} />
          {renderField('Phone Number', student.phone_number)}
          {renderField('Hometown', student.hometown)}
          {renderField('Concentration', student.concentration)}
          {renderField('Secondary', student.secondary)}
          {renderField('Extracurricular Activities', student.extracurricular_activities, similarity?.matchingKeywords?.hobbies || [])}
          {renderField('Clinical Shadowing', student.clinical_shadowing)}
          {renderField('Research Activities', student.research_activities, similarity?.matchingKeywords?.research || [])}
          {renderField('Medical Interests', student.medical_interests, similarity?.matchingKeywords?.medical || [])}
          {renderField('Program Interests', student.program_interests)}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No student selected
        </Typography>
      )}
    </Box>
  );

  const nrtPanel = (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom color="primary">
        Non-Resident Tutor
      </Typography>
      {nrt ? (
        <>
          <Typography variant="subtitle1" gutterBottom>
            {nrt.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {nrt.email}
          </Typography>
          <Divider sx={{ my: 2 }} />
          {renderField('Phone Number', nrt.phone_number)}
          {renderField('Harvard Affiliation', nrt.harvard_affiliation)}
          {renderField('Harvard ID Number', nrt.harvard_id_number)}
          {renderField('Current Stage Training', nrt.current_stage_training)}
          {renderField('Time in Boston', nrt.time_in_boston)}
          {renderField('Medical Interests', nrt.medical_interests, similarity?.matchingKeywords?.medical || [])}
          {renderField('Interests Outside Medicine', nrt.interests_outside_medicine, similarity?.matchingKeywords?.hobbies || [])}
          {renderField('Interested in Shadowing', nrt.interested_in_shadowing)}
          {renderField('Interested in Research', nrt.interested_in_research, similarity?.matchingKeywords?.research || [])}
          {renderField('Interested in Organizing Events', nrt.interested_in_organizing_events)}
          {renderField('Specific Events', nrt.specific_events)}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No NRT selected
        </Typography>
      )}
    </Box>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { 
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">Compare Student and NRT</Typography>
            {similarity && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip 
                  label={`Similarity: ${similarity.score}%`}
                  color={similarity.score >= 70 ? 'success' : similarity.score >= 40 ? 'warning' : 'default'}
                  size="small"
                />
                <Typography variant="caption" color="text.secondary">
                  Medical: {similarity.medicalScore}% | Research: {similarity.researchScore}% | Hobbies: {similarity.hobbyScore}%
                </Typography>
              </Box>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent 
        dividers
        sx={{
          display: 'flex',
          flexDirection: 'column',
          p: 0,
          height: 'calc(90vh - 120px)', // Account for DialogTitle and DialogActions
          maxHeight: 'calc(90vh - 120px)',
          overflow: 'hidden',
          flex: '1 1 auto',
          minHeight: 0,
        }}
      >
        <Box sx={{ 
          flex: '1 1 auto',
          minHeight: 0,
          width: '100%',
          display: { xs: 'block', md: 'flex' },
          overflow: 'hidden',
        }}>
          {/* Mobile: Stack vertically */}
          <Box sx={{ 
            display: { xs: 'block', md: 'none' },
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>
            {studentPanel}
            <Divider />
            {nrtPanel}
          </Box>
          
          {/* Desktop: Side by side with resizable split */}
          <Box sx={{ 
            display: { xs: 'none', md: 'flex' }, 
            flex: '1 1 auto',
            minHeight: 0,
            width: '100%',
            overflow: 'hidden',
          }}>
            <ResizableSplit left={studentPanel} right={nrtPanel} defaultLeftWidth="50%" />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// Sort students by status and class year: Applying Next Cycle first, then Not Applying (oldest to youngest), then Currently Applying
function sortStudentsByStatusAndClassYear(students) {
  return [...students].sort((a, b) => {
    const aStatus = a.status || 'Not Applying';
    const bStatus = b.status || 'Not Applying';
    
    // Status priority: Applying Next Cycle (1) > Not Applying (2) > Currently Applying (3)
    const statusPriority = {
      'Applying Next Cycle': 1,
      'Not Applying': 2,
      'Currently Applying': 3,
    };
    
    const aPriority = statusPriority[aStatus] || 2;
    const bPriority = statusPriority[bStatus] || 2;
    
    // If different status priorities, sort by priority
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // If both are "Not Applying", sort by class year (oldest first, youngest last)
    if (aStatus === 'Not Applying' && bStatus === 'Not Applying') {
      const aYear = a.class_year ? parseInt(a.class_year) : 9999;
      const bYear = b.class_year ? parseInt(b.class_year) : 9999;
      return aYear - bYear; // Increasing order (oldest first)
    }
    
    // For same status (not "Not Applying"), maintain original order or sort alphabetically
    return 0;
  });
}

function UnassignedStudentsZone({ students, activeId, isOver, zoneRef, onStudentRightClick, selectedStudent }) {
  const sortedStudents = sortStudentsByStatusAndClassYear(students);
  const { setNodeRef } = useDroppable({
    id: 'unassigned',
  });

  // Combine refs
  const combinedRef = React.useCallback((node) => {
    setNodeRef(node);
    if (zoneRef) {
      zoneRef.current = node;
    }
  }, [setNodeRef, zoneRef]);

  return (
    <Paper
      ref={combinedRef}
      sx={{ 
        p: 2, 
        bgcolor: 'primary.light', 
        color: 'primary.contrastText',
        border: isOver ? '2px dashed' : '1px solid',
        borderColor: isOver ? 'primary.dark' : 'transparent',
        transition: 'all 0.2s',
      }}
    >
      <Typography variant="h6" gutterBottom>
        Unassigned Students ({students.length})
      </Typography>
      <SortableContext items={sortedStudents.map((s) => s.row_index)}>
        {sortedStudents.map((student) => (
          <SortableStudent 
            key={student.row_index} 
            student={student} 
            activeId={activeId}
            onRightClick={onStudentRightClick}
            isSelected={selectedStudent && selectedStudent.row_index === student.row_index}
          />
        ))}
      </SortableContext>
    </Paper>
  );
}

function SortableStudent({ student, activeId, onRightClick, isSelected }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: student.row_index,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRightClick) {
      onRightClick(student);
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onContextMenu={handleRightClick}
      sx={{ 
        mb: 1, 
        cursor: 'grab', 
        '&:active': { cursor: 'grabbing' },
        position: 'relative',
        zIndex: isDragging ? 100 : 2,
        border: isSelected ? '2px solid' : '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        bgcolor: isSelected ? 'action.selected' : 'background.paper',
      }}
    >
      <CardContent sx={{ py: 1, px: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2">
            {student.first_name} {student.last_name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {student.class_year && (
              <Chip label={`Class ${student.class_year}`} size="small" />
            )}
            {student.status && (
              <Chip 
                label={student.status} 
                size="small"
                color={student.status === 'Currently Applying' ? 'success' : 
                       student.status === 'Applying Next Cycle' ? 'info' : 'default'}
              />
            )}
            {isSelected && (
              <Chip 
                label="Selected" 
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function NRTDropZone({ nrt, students, currentStudents, onExpandChange, expanded, isOver: externalIsOver, activeId, onRightClick, onStudentRightClick, isSelected, selectedStudent }) {
  const totalStudents = students.length + currentStudents.length;
  const isFull = totalStudents >= 3;
  const isActive = nrt.status === 'active' && 
                   nrt.status !== 'leaving, but keeping students' &&
                   nrt.status !== 'active, but does not want additional students' &&
                   nrt.status !== 'pending approval';
  const { setNodeRef, isOver } = useDroppable({
    id: nrt.email,
  });
  
  const showHoverEffect = (externalIsOver || isOver) && !isFull && isActive;

  return (
    <Paper
      sx={{
        p: 2,
        minHeight: 200,
        bgcolor: isSelected
          ? 'action.selected'
          : showHoverEffect
          ? 'action.hover'
          : isFull
          ? 'error.light'
          : isActive
          ? 'success.light'
          : 'grey.300',
        opacity: isActive ? 1 : 0.6,
        border: isSelected ? '3px solid' : showHoverEffect ? '2px solid' : '1px solid',
        borderColor: isSelected ? 'primary.main' : showHoverEffect ? 'primary.main' : isFull ? 'error.main' : 'divider',
        transition: 'all 0.2s',
        position: 'relative',
      }}
    >
      {/* Invisible drop zone overlay - ensures entire card is always a valid drop zone */}
      <Box
        ref={setNodeRef}
        sx={{
          position: 'absolute',
          top: -5, // Extend slightly beyond card
          left: -5,
          right: -5,
          bottom: -5,
          zIndex: activeId ? 10 : 1, // Much higher z-index when dragging
          pointerEvents: activeId ? 'auto' : 'none', // Only capture events when dragging
          // Make it transparent but still capture events
          backgroundColor: 'transparent',
        }}
      />
      <Box sx={{ 
        position: 'relative', 
        zIndex: 2,
        pointerEvents: activeId ? 'none' : 'auto', // Disable pointer events on content when dragging
      }}>
        <Box 
          sx={{ mb: 1 }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onRightClick) {
              onRightClick(nrt);
            }
          }}
        >
          <Typography variant="h6">
            {nrt.name}
          </Typography>
        </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {nrt.email}
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`${totalStudents}/3 students`}
            color={isFull ? 'error' : 'default'}
            size="small"
          />
          {currentStudents.length > 0 && (
            <Chip
              label={`${currentStudents.length} current`}
              color="default"
              size="small"
              variant="outlined"
            />
          )}
          {students.length > 0 && (
            <Chip
              label={`${students.length} new`}
              color="success"
              size="small"
              variant="outlined"
            />
          )}
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
          {isSelected && (
            <Chip
              label="Selected"
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
      </Box>
      {isFull && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Maximum capacity reached
        </Alert>
      )}
      {!isActive && (
        <Alert severity="info" sx={{ mb: 1 }}>
          Not accepting new students
        </Alert>
      )}
      
      {currentStudents.length > 0 && (
        <Accordion 
          expanded={expanded} 
          onChange={onExpandChange} 
          sx={{ 
            mb: 2,
            pointerEvents: activeId ? 'none' : 'auto', // Disable pointer events on entire accordion when dragging
            '& .MuiAccordionDetails-root': {
              pointerEvents: activeId ? 'none' : 'auto',
            },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">
              View Current Students ({currentStudents.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <SortableContext items={sortStudentsByStatusAndClassYear(currentStudents).map((s) => s.row_index)}>
              {sortStudentsByStatusAndClassYear(currentStudents).map((student) => (
                <SortableStudent 
                  key={student.row_index} 
                  student={student} 
                  activeId={activeId}
                  onRightClick={onStudentRightClick}
                  isSelected={selectedStudent && selectedStudent.row_index === student.row_index}
                />
              ))}
            </SortableContext>
          </AccordionDetails>
        </Accordion>
      )}

      {students.length > 0 && (
        <Box sx={{ 
          pointerEvents: activeId ? 'none' : 'auto',
          position: 'relative',
          zIndex: 1, // Ensure it's below the overlay when dragging
        }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
            New Assignments:
          </Typography>
          <SortableContext items={sortStudentsByStatusAndClassYear(students).map((s) => s.row_index)}>
            {sortStudentsByStatusAndClassYear(students).map((student) => (
              <SortableStudent 
                key={student.row_index} 
                student={student} 
                activeId={activeId}
                onRightClick={onStudentRightClick}
                isSelected={selectedStudent && selectedStudent.row_index === student.row_index}
              />
            ))}
          </SortableContext>
        </Box>
      )}
      </Box>
    </Paper>
  );
}

// Tentative Assignments Panel Component
function TentativeAssignmentsPanel({ 
  open, 
  onClose, 
  tentativeAssignments, 
  onAccept, 
  onReject,
  onViewDetails 
}) {
  const getScoreColor = (score) => {
    if (score >= 70) return 'success';
    if (score >= 40) return 'warning';
    return 'default';
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Suggested Assignments ({tentativeAssignments.length})
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {tentativeAssignments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No assignments suggested. All students may already be assigned or no suitable matches found.
          </Typography>
        ) : (
          <List>
            {tentativeAssignments.map((assignment, index) => (
              <React.Fragment key={`${assignment.student.row_index}-${assignment.nrt.email}`}>
                <ListItem
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    py: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {assignment.student.first_name} {assignment.student.last_name}
                        {assignment.student.class_year && (
                          <Chip 
                            label={`Class ${assignment.student.class_year}`} 
                            size="small" 
                            sx={{ ml: 1 }} 
                          />
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        → {assignment.nrt.name}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${assignment.similarity.score}% match`}
                      color={getScoreColor(assignment.similarity.score)}
                      size="small"
                      sx={{ ml: 2 }}
                    />
                  </Box>
                  
                  <Box sx={{ mb: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={assignment.similarity.score} 
                      color={getScoreColor(assignment.similarity.score)}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onViewDetails(assignment)}
                    >
                      View Details
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => onAccept(assignment)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => onReject(assignment)}
                    >
                      Reject
                    </Button>
                  </Box>
                </ListItem>
                {index < tentativeAssignments.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function WorkflowStep6({ onNext, onBack, onDataUpdate, initialData }) {
  const [students, setStudents] = useState([]);
  const [nrts, setNrts] = useState([]);
  const [allNrts, setAllNrts] = useState([]); // Store all NRTs
  const [assignments, setAssignments] = useState({});
  const [currentAssignments, setCurrentAssignments] = useState({});
  const [expandedNrts, setExpandedNrts] = useState({});
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // Track Y position when dragging over unassigned
  const [mouseY, setMouseY] = useState(null); // Track global mouse Y position
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedNRT, setSelectedNRT] = useState(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [tentativeAssignments, setTentativeAssignments] = useState([]);
  const [tentativePanelOpen, setTentativePanelOpen] = useState(false);
  const [currentSimilarity, setCurrentSimilarity] = useState(null);
  const unassignedZoneRef = React.useRef(null);
  
  // Track mouse position during drag
  React.useEffect(() => {
    if (activeId) {
      const handleMouseMove = (e) => {
        setMouseY(e.clientY);
      };
      const handleTouchMove = (e) => {
        if (e.touches[0]) {
          setMouseY(e.touches[0].clientY);
        }
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchmove', handleTouchMove);
      };
    } else {
      setMouseY(null);
    }
  }, [activeId]);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filterNrts = React.useCallback((nrtsList, onlyActive, assignmentsData, currentAssignmentsData) => {
    if (onlyActive) {
      // Show all active NRTs (even if at capacity), but exclude grayed out ones
      // Must be: active status, not "leaving" or "does not want additional"
      // Note: We show active NRTs even if they have 3 students (so user can see all assignments)
      const active = nrtsList.filter(
        (nrt) => {
          return (
            nrt.status === 'active' && 
            nrt.status !== 'leaving, but keeping students' &&
            nrt.status !== 'active, but does not want additional students' &&
            nrt.status !== 'pending approval'
          );
        }
      );
      setNrts(active);
    } else {
      // Show all NRTs
      setNrts(nrtsList);
    }
  }, []);

  const loadData = React.useCallback(async () => {
    try {
      const studentsRes = await studentsAPI.getAll();
      const nrtsRes = await nrtsAPI.getAll();
      
      // Separate unassigned students
      setStudents(studentsRes.data.filter((s) => !s.nrt_assignment));
      
      // Store all NRTs
      setAllNrts(nrtsRes.data);
      
      // Initialize assignments first, then filter
      const initAssignments = {};
      const initCurrentAssignments = {};
      
      nrtsRes.data.forEach((nrt) => {
        initAssignments[nrt.email] = [];
        // Find students currently assigned to this NRT (matching by name)
        const current = studentsRes.data.filter(
          (s) => s.nrt_assignment && s.nrt_assignment.trim().toLowerCase() === nrt.name.trim().toLowerCase()
        );
        initCurrentAssignments[nrt.email] = current;
      });
      
      setAssignments(initAssignments);
      setCurrentAssignments(initCurrentAssignments);
      
      // Filter NRTs based on toggle (after assignments are set)
      // Use a small delay to ensure state is updated
      setTimeout(() => {
        filterNrts(nrtsRes.data, showOnlyActive, initAssignments, initCurrentAssignments);
      }, 0);

    } catch (err) {
      console.error('Error loading data:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount
  
  const handleToggleFilter = (event) => {
    const newValue = event.target.checked;
    setShowOnlyActive(newValue);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (allNrts.length > 0) {
      filterNrts(allNrts, showOnlyActive, assignments, currentAssignments);
    }
  }, [showOnlyActive, allNrts, filterNrts, assignments, currentAssignments]);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event) => {
    setOverId(event.over?.id || null);
    
    // Track drop position when over unassigned zone
    if (event.over?.id === 'unassigned' && unassignedZoneRef.current && mouseY !== null) {
      const rect = unassignedZoneRef.current.getBoundingClientRect();
      const relativeY = mouseY - rect.top;
      setDropPosition(relativeY);
    } else if (event.over?.id !== 'unassigned') {
      setDropPosition(null);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);
    
    // Handle dropping to unassigned (either on the container or on a specific student card)
    if (over && (over.id === 'unassigned' || students.find(s => s.row_index === over.id))) {
      // Find student in assignments or current assignments
      let foundStudent = null;
      
      // Check new assignments first
      for (const [email, assignedStudents] of Object.entries(assignments)) {
        foundStudent = assignedStudents.find((s) => s.row_index === active.id);
        if (foundStudent) {
          setAssignments((prevAssignments) => {
            const updated = { ...prevAssignments };
            updated[email] = assignedStudents.filter((s) => s.row_index !== active.id);
            return updated;
          });
          
          // Insert at position
          const sortedCurrent = sortStudentsByStatusAndClassYear(students);
          const sortedIds = sortedCurrent.map(s => s.row_index);
          
          let insertIndex = sortedCurrent.length; // Default to end
          
          if (over.id !== 'unassigned' && sortedIds.includes(over.id)) {
            // Dropping over a specific student - insert before it
            insertIndex = sortedIds.indexOf(over.id);
          } else if (over.id === 'unassigned' && dropPosition !== null && unassignedZoneRef.current) {
            // Dropping on container - calculate position based on Y coordinate
            const cardHeight = 80; // Approximate height of a student card with margin
            const headerHeight = 60; // Approximate height of header
            const padding = 16; // Padding from Paper
            
            const adjustedY = dropPosition - headerHeight - padding;
            if (adjustedY > 0) {
              insertIndex = Math.min(
                Math.floor(adjustedY / cardHeight),
                sortedCurrent.length
              );
            } else {
              insertIndex = 0;
            }
          }
          
          const newSorted = [...sortedCurrent];
          newSorted.splice(insertIndex, 0, foundStudent);
          setStudents(newSorted);
          return;
        }
      }
      
      // Check current assignments
      for (const [email, currentStudents] of Object.entries(currentAssignments)) {
        foundStudent = currentStudents.find((s) => s.row_index === active.id);
        if (foundStudent) {
          setCurrentAssignments((prevCurrentAssignments) => {
            const updated = { ...prevCurrentAssignments };
            updated[email] = currentStudents.filter((s) => s.row_index !== active.id);
            return updated;
          });
          
          // Insert at position
          const sortedCurrent = sortStudentsByStatusAndClassYear(students);
          const sortedIds = sortedCurrent.map(s => s.row_index);
          
          let insertIndex = sortedCurrent.length; // Default to end
          
          if (over.id !== 'unassigned' && sortedIds.includes(over.id)) {
            // Dropping over a specific student - insert before it
            insertIndex = sortedIds.indexOf(over.id);
          } else if (over.id === 'unassigned' && dropPosition !== null && unassignedZoneRef.current) {
            // Dropping on container - calculate position based on Y coordinate
            const cardHeight = 80; // Approximate height of a student card with margin
            const headerHeight = 60; // Approximate height of header
            const padding = 16; // Padding from Paper
            
            const adjustedY = dropPosition - headerHeight - padding;
            if (adjustedY > 0) {
              insertIndex = Math.min(
                Math.floor(adjustedY / cardHeight),
                sortedCurrent.length
              );
            } else {
              insertIndex = 0;
            }
          }
          
          const newSorted = [...sortedCurrent];
          newSorted.splice(insertIndex, 0, foundStudent);
          setStudents(newSorted);
          return;
        }
      }
      return;
    }
    
    if (!over) return;

    // Find student - check unassigned students first, then assignments, then current assignments
    let student = students.find((s) => s.row_index === active.id);
    let sourceType = 'unassigned';

    if (!student) {
      // Check new assignments
      for (const [email, assignedStudents] of Object.entries(assignments)) {
        student = assignedStudents.find((s) => s.row_index === active.id);
        if (student) {
          sourceType = email;
          break;
        }
      }
      
      // Check current assignments
      if (!student) {
        for (const [email, currentStudents] of Object.entries(currentAssignments)) {
          student = currentStudents.find((s) => s.row_index === active.id);
          if (student) {
            sourceType = `current_${email}`;
            break;
          }
        }
      }
    }

    if (!student) return;

    const nrtEmail = over.id;
    const nrt = nrts.find((n) => n.email === nrtEmail);

    if (!nrt) return;

    // Check if NRT can accept new students
    const totalCurrent = (currentAssignments[nrtEmail]?.length || 0);
    const totalNew = (assignments[nrtEmail]?.length || 0);
    const totalAfter = totalCurrent + totalNew + (sourceType === 'unassigned' || !assignments[nrtEmail]?.find(s => s.row_index === active.id) ? 1 : 0);
    
    if (nrt.status !== 'active' || 
        nrt.status === 'leaving, but keeping students' ||
        nrt.status === 'active, but does not want additional students' ||
        nrt.status === 'pending approval') {
      alert('This NRT is not accepting new students');
      return;
    }

    if (totalAfter > 3) {
      alert('This NRT already has 3 students (maximum capacity)');
      return;
    }

    // Remove from source
    if (sourceType === 'unassigned') {
      setStudents(students.filter((s) => s.row_index !== active.id));
    } else if (sourceType.startsWith('current_')) {
      const sourceEmail = sourceType.replace('current_', '');
      currentAssignments[sourceEmail] = currentAssignments[sourceEmail].filter(
        (s) => s.row_index !== active.id
      );
      setCurrentAssignments({ ...currentAssignments });
    } else {
      assignments[sourceType] = assignments[sourceType].filter(
        (s) => s.row_index !== active.id
      );
    }

    // Remove from any other assignments
    Object.keys(assignments).forEach((email) => {
      if (email !== nrtEmail) {
        assignments[email] = assignments[email].filter((s) => s.row_index !== active.id);
      }
    });
    
    Object.keys(currentAssignments).forEach((email) => {
      if (email !== nrtEmail) {
        currentAssignments[email] = currentAssignments[email].filter((s) => s.row_index !== active.id);
      }
    });

    // Add to new assignment
    if (!assignments[nrtEmail]) {
      assignments[nrtEmail] = [];
    }
    if (!assignments[nrtEmail].find((s) => s.row_index === active.id)) {
      assignments[nrtEmail].push(student);
    }

    setAssignments({ ...assignments });
    setCurrentAssignments({ ...currentAssignments });
  };

  const handleNext = () => {
    const nrtAssignments = {};
    
    // Only include NEW assignments made in this workflow step
    // Do NOT include existing assignments - they're already in the database
    Object.keys(assignments).forEach((nrtEmail) => {
      assignments[nrtEmail].forEach((student) => {
        nrtAssignments[student.row_index] = nrtEmail;
      });
    });
    
    onDataUpdate({ nrtAssignments });
    onNext();
  };
  
  const handleExpandNRT = (nrtEmail) => (event, isExpanded) => {
    setExpandedNrts({ ...expandedNrts, [nrtEmail]: isExpanded });
  };

  const handleStudentInfoClick = (student) => {
    // If right-clicking the same student, deselect it
    if (selectedStudent && selectedStudent.row_index === student.row_index) {
      setSelectedStudent(null);
      setComparisonOpen(false);
    } else {
      setSelectedStudent(student);
      // Only open comparison if NRT is also selected
      if (selectedNRT) {
        setComparisonOpen(true);
      }
    }
  };

  const handleNRTInfoClick = (nrt) => {
    // If clicking the same NRT, deselect it
    if (selectedNRT && selectedNRT.email === nrt.email) {
      setSelectedNRT(null);
      setComparisonOpen(false);
    } else {
      setSelectedNRT(nrt);
      // Only open comparison if student is also selected
      if (selectedStudent) {
        setComparisonOpen(true);
      }
    }
  };

  const handleCloseComparison = () => {
    setComparisonOpen(false);
    setCurrentSimilarity(null);
    // Optionally clear selections when closing
    // setSelectedStudent(null);
    // setSelectedNRT(null);
  };

  const handleSuggestAssignments = () => {
    const suggested = generateOptimalAssignments(students, allNrts, currentAssignments);
    setTentativeAssignments(suggested);
    setTentativePanelOpen(true);
  };

  const handleAcceptAssignment = (assignment) => {
    // Add to assignments
    setAssignments((prevAssignments) => {
      const updated = { ...prevAssignments };
      if (!updated[assignment.nrt.email]) {
        updated[assignment.nrt.email] = [];
      }
      updated[assignment.nrt.email] = [...updated[assignment.nrt.email], assignment.student];
      return updated;
    });

    // Remove from unassigned students
    setStudents((prevStudents) => 
      prevStudents.filter(s => s.row_index !== assignment.student.row_index)
    );

    // Remove from tentative assignments
    setTentativeAssignments((prev) => 
      prev.filter(a => 
        a.student.row_index !== assignment.student.row_index || 
        a.nrt.email !== assignment.nrt.email
      )
    );
  };

  const handleRejectAssignment = (assignment) => {
    // Remove from tentative assignments
    setTentativeAssignments((prev) => 
      prev.filter(a => 
        a.student.row_index !== assignment.student.row_index || 
        a.nrt.email !== assignment.nrt.email
      )
    );
    // Student stays in unassigned list (already there)
  };

  const handleViewTentativeDetails = (assignment) => {
    setSelectedStudent(assignment.student);
    setSelectedNRT(assignment.nrt);
    setCurrentSimilarity(assignment.similarity);
    setComparisonOpen(true);
  };

  // Custom collision detection: use midpoint of dragged card
  const midpointCollisionDetection = (args) => {
    const { collisionRect, droppableRects, droppableContainers } = args;
    
    if (!collisionRect) {
      return [];
    }

    // Get the midpoint of the dragged card
    const midpointX = collisionRect.left + collisionRect.width / 2;
    const midpointY = collisionRect.top + collisionRect.height / 2;

    const collisions = [];

    // Check each droppable to see if midpoint is within its bounds
    for (const droppable of droppableContainers) {
      const rect = droppableRects.get(droppable.id);
      if (!rect) continue;

      // Check if midpoint is within the droppable's bounds
      if (
        midpointX >= rect.left &&
        midpointX <= rect.left + rect.width &&
        midpointY >= rect.top &&
        midpointY <= rect.top + rect.height
      ) {
        // Calculate distance from midpoint to center of droppable for sorting
        const droppableCenterX = rect.left + rect.width / 2;
        const droppableCenterY = rect.top + rect.height / 2;
        const distance = Math.sqrt(
          Math.pow(midpointX - droppableCenterX, 2) +
          Math.pow(midpointY - droppableCenterY, 2)
        );

        collisions.push({
          id: droppable.id,
          data: { droppableContainer: droppable, value: distance },
        });
      }
    }

    // Sort by distance (closest first)
    return collisions.sort((a, b) => a.data.value - b.data.value);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 8: Assign Non-Resident Tutors
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Drag and drop unassigned students to active NRTs. Each NRT can have a maximum of 3 students.
        <br />
        <strong>Tip:</strong> Right-click on a student or NRT card to view details and compare them side-by-side.
      </Typography>
      
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSuggestAssignments}
          disabled={students.length === 0}
          sx={{ mb: { xs: 2, sm: 0 } }}
        >
          Suggest Assignments ({students.length} unassigned)
        </Button>
        <FormControlLabel
          control={
            <Switch
              checked={showOnlyActive}
              onChange={handleToggleFilter}
              color="primary"
            />
          }
          label="Show only active NRTs (green)"
        />
      </Box>

      <DndContext 
        sensors={sensors} 
        collisionDetection={midpointCollisionDetection} 
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', lg: 'row' } }}>
          <Box sx={{ flex: '0 0 300px', minWidth: 0 }}>
            <UnassignedStudentsZone 
              students={students} 
              activeId={activeId} 
              isOver={overId === 'unassigned'} 
              zoneRef={unassignedZoneRef}
              onStudentRightClick={handleStudentInfoClick}
              selectedStudent={selectedStudent}
            />
          </Box>
          <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
            <Grid container spacing={2}>
              {nrts.map((nrt) => (
                <Grid item xs={12} sm={6} key={nrt.email}>
                  <NRTDropZone 
                    nrt={nrt} 
                    students={assignments[nrt.email] || []}
                    currentStudents={currentAssignments[nrt.email] || []}
                    expanded={expandedNrts[nrt.email] || false}
                    onExpandChange={handleExpandNRT(nrt.email)}
                    isOver={overId === nrt.email}
                    activeId={activeId}
                    onRightClick={handleNRTInfoClick}
                    onStudentRightClick={handleStudentInfoClick}
                    isSelected={selectedNRT && selectedNRT.email === nrt.email}
                    selectedStudent={selectedStudent}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        </Box>
        <DragOverlay>
          {activeId ? (() => {
            // Find the student being dragged
            let draggedStudent = students.find((s) => s.row_index === activeId);
            if (!draggedStudent) {
              // Check in assignments
              for (const assignedStudents of Object.values(assignments)) {
                draggedStudent = assignedStudents.find((s) => s.row_index === activeId);
                if (draggedStudent) break;
              }
            }
            if (!draggedStudent) {
              // Check in current assignments
              for (const currentStudents of Object.values(currentAssignments)) {
                draggedStudent = currentStudents.find((s) => s.row_index === activeId);
                if (draggedStudent) break;
              }
            }
            if (!draggedStudent) return null;
            
            const isOverDropZone = overId && overId !== 'unassigned';
            return (
              <Card
                sx={{
                  transform: isOverDropZone ? 'scale(0.95)' : 'scale(1)',
                  transition: 'transform 0.2s',
                  opacity: 0.9,
                  boxShadow: 6,
                  width: isOverDropZone ? '90%' : '100%',
                }}
              >
                <CardContent sx={{ py: 1, px: 2 }}>
                  <Typography variant="body2">
                    {draggedStudent.first_name} {draggedStudent.last_name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {draggedStudent.class_year && (
                      <Chip label={`Class ${draggedStudent.class_year}`} size="small" />
                    )}
                    {draggedStudent.status && (
                      <Chip 
                        label={draggedStudent.status} 
                        size="small"
                        color={draggedStudent.status === 'Currently Applying' ? 'success' : 
                               draggedStudent.status === 'Applying Next Cycle' ? 'info' : 'default'}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })() : null}
        </DragOverlay>
      </DndContext>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button variant="contained" onClick={handleNext}>
          Next: Review & Confirm
        </Button>
      </Box>

      <ComparisonPanel
        open={comparisonOpen}
        onClose={handleCloseComparison}
        student={selectedStudent}
        nrt={selectedNRT}
        similarity={currentSimilarity}
      />
      
      <TentativeAssignmentsPanel
        open={tentativePanelOpen}
        onClose={() => setTentativePanelOpen(false)}
        tentativeAssignments={tentativeAssignments}
        onAccept={handleAcceptAssignment}
        onReject={handleRejectAssignment}
        onViewDetails={handleViewTentativeDetails}
      />
    </Box>
  );
}

export default WorkflowStep6;

