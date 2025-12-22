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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
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
import { studentsAPI, rtsAPI } from '../../services/api';

// Student Details Panel Component (for RT assignments - RTs don't have extra fields)
function StudentDetailsPanel({ open, onClose, student }) {
  const renderField = (label, value) => {
    if (!value || value.trim() === '') return null;
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Typography variant="body2">
          {value}
        </Typography>
      </Box>
    );
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
          <Typography variant="h6">Student Details</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {student ? (
          <>
            <Typography variant="subtitle1" gutterBottom>
              {student.first_name} {student.last_name}
            </Typography>
            {student.class_year && (
              <Chip label={`Class ${student.class_year}`} size="small" sx={{ mb: 2 }} />
            )}
            {student.status && (
              <Chip 
                label={student.status} 
                size="small"
                color={student.status === 'Currently Applying' ? 'success' : 
                       student.status === 'Applying Next Cycle' ? 'info' : 'default'}
                sx={{ mb: 2, ml: 1 }}
              />
            )}
            <Divider sx={{ my: 2 }} />
            {renderField('Phone Number', student.phone_number)}
            {renderField('Hometown', student.hometown)}
            {renderField('Concentration', student.concentration)}
            {renderField('Secondary', student.secondary)}
            {renderField('Extracurricular Activities', student.extracurricular_activities)}
            {renderField('Clinical Shadowing', student.clinical_shadowing)}
            {renderField('Research Activities', student.research_activities)}
            {renderField('Medical Interests', student.medical_interests)}
            {renderField('Program Interests', student.program_interests)}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No student selected
          </Typography>
        )}
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

function UnassignedStudentsZone({ students, activeId, isOver, zoneRef, onStudentRightClick }) {
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
          />
        ))}
      </SortableContext>
    </Paper>
  );
}

function SortableStudent({ student, activeId, onRightClick }) {
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
      }}
    >
      <CardContent sx={{ py: 1, px: 2 }}>
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
        </Box>
      </CardContent>
    </Card>
  );
}

function RTDropZone({ rt, students, currentStudents, onExpandChange, expanded, isOver: externalIsOver, activeId, onStudentRightClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id: rt.email,
  });
  
  const showHoverEffect = externalIsOver || isOver;

  const totalStudents = students.length + currentStudents.length;

  return (
    <Paper
      sx={{
        p: 2,
        minHeight: 200,
        bgcolor: showHoverEffect ? 'action.hover' : 'background.default',
        border: showHoverEffect ? '2px solid' : '1px solid',
        borderColor: showHoverEffect ? 'primary.main' : 'divider',
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
        <Typography variant="h6" gutterBottom>
          {rt.name}
        </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {rt.email}
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`${totalStudents} total student(s)`}
            color="primary"
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
      </Box>
      
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
              />
            ))}
          </SortableContext>
        </Box>
      )}
      </Box>
    </Paper>
  );
}

function WorkflowStep5({ onNext, onBack, onDataUpdate, initialData }) {
  const [students, setStudents] = useState([]);
  const [rts, setRTs] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [currentAssignments, setCurrentAssignments] = useState({});
  const [expandedRTs, setExpandedRTs] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // Track Y position when dragging over unassigned
  const [mouseY, setMouseY] = useState(null); // Track global mouse Y position
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Use refs to access current state synchronously in event handlers
  const studentsRef = React.useRef(students);
  const assignmentsRef = React.useRef(assignments);
  const currentAssignmentsRef = React.useRef(currentAssignments);
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
  
  // Keep refs in sync with state
  React.useEffect(() => {
    studentsRef.current = students;
  }, [students]);
  
  React.useEffect(() => {
    assignmentsRef.current = assignments;
  }, [assignments]);
  
  React.useEffect(() => {
    currentAssignmentsRef.current = currentAssignments;
  }, [currentAssignments]);
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const studentsRes = await studentsAPI.getAll();
      const rtsRes = await rtsAPI.getAll();
      
      // Separate unassigned students
      setStudents(studentsRes.data.filter((s) => !s.rt_assignment));
      setRTs(rtsRes.data);

      // Initialize assignments (for new assignments)
      const initAssignments = {};
      const initCurrentAssignments = {};
      
      rtsRes.data.forEach((rt) => {
        initAssignments[rt.email] = [];
        // Find students currently assigned to this RT (matching by name)
        const current = studentsRes.data.filter(
          (s) => s.rt_assignment && s.rt_assignment.trim().toLowerCase() === rt.name.trim().toLowerCase()
        );
        initCurrentAssignments[rt.email] = current;
      });
      
      setAssignments(initAssignments);
      setCurrentAssignments(initCurrentAssignments);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

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
    if (over && (over.id === 'unassigned' || studentsRef.current.find(s => s.row_index === over.id))) {
      // Find student synchronously using refs
      let foundStudent = null;
      
      // Check assignments first
      for (const [email, assignedStudents] of Object.entries(assignmentsRef.current)) {
        foundStudent = assignedStudents.find((s) => s.row_index === active.id);
        if (foundStudent) {
          setAssignments((prevAssignments) => {
            const updated = { ...prevAssignments };
            updated[email] = assignedStudents.filter((s) => s.row_index !== active.id);
            return updated;
          });
          
          // Insert at position
          const currentStudents = studentsRef.current;
          const sortedCurrent = sortStudentsByStatusAndClassYear(currentStudents);
          const sortedIds = sortedCurrent.map(s => s.row_index);
          
          let insertIndex = sortedCurrent.length; // Default to end
          
          if (over.id !== 'unassigned' && sortedIds.includes(over.id)) {
            // Dropping over a specific student - insert before it
            insertIndex = sortedIds.indexOf(over.id);
          } else if (over.id === 'unassigned' && dropPosition !== null && unassignedZoneRef.current) {
            // Dropping on container - calculate position based on Y coordinate
            // Estimate card height (including margin) - adjust based on your actual card height
            const cardHeight = 80; // Approximate height of a student card with margin
            const headerHeight = 60; // Approximate height of header
            const padding = 16; // Padding from Paper
            
            // Calculate which position based on Y coordinate
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
      for (const [email, currentStudents] of Object.entries(currentAssignmentsRef.current)) {
        foundStudent = currentStudents.find((s) => s.row_index === active.id);
        if (foundStudent) {
          setCurrentAssignments((prevCurrentAssignments) => {
            const updated = { ...prevCurrentAssignments };
            updated[email] = currentStudents.filter((s) => s.row_index !== active.id);
            return updated;
          });
          
          // Insert at position
          const currentStudentsList = studentsRef.current;
          const sortedCurrent = sortStudentsByStatusAndClassYear(currentStudentsList);
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

    const rtEmail = over.id;
    const rt = rts.find((r) => r.email === rtEmail);
    if (!rt) return;

    // Find student synchronously using refs
    let foundStudent = null;
    
    // Check unassigned students first
    foundStudent = studentsRef.current.find((s) => s.row_index === active.id);
    if (foundStudent) {
      setStudents((prevStudents) => prevStudents.filter((s) => s.row_index !== active.id));
    } else {
      // Check assignments
      for (const [email, assignedStudents] of Object.entries(assignmentsRef.current)) {
        foundStudent = assignedStudents.find((s) => s.row_index === active.id);
        if (foundStudent) {
          setAssignments((prevAssignments) => {
            const updated = { ...prevAssignments };
            updated[email] = assignedStudents.filter((s) => s.row_index !== active.id);
            return updated;
          });
          break;
        }
      }
      
      // Check current assignments
      if (!foundStudent) {
        for (const [email, currentStudents] of Object.entries(currentAssignmentsRef.current)) {
          foundStudent = currentStudents.find((s) => s.row_index === active.id);
          if (foundStudent) {
            setCurrentAssignments((prevCurrentAssignments) => {
              const updated = { ...prevCurrentAssignments };
              updated[email] = currentStudents.filter((s) => s.row_index !== active.id);
              return updated;
            });
            break;
          }
        }
      }
    }

    if (!foundStudent) return;

    // Add to target RT using functional update to work with latest state
    setAssignments((prevAssignments) => {
      const updated = { ...prevAssignments };
      
      // Remove from any other assignments (in case moving from one RT to another)
      Object.keys(updated).forEach((email) => {
        if (email !== rtEmail) {
          updated[email] = updated[email].filter((s) => s.row_index !== active.id);
        }
      });
      
      // Add to new assignment (as a new assignment, not current)
      if (!updated[rtEmail]) {
        updated[rtEmail] = [];
      }
      if (!updated[rtEmail].find((s) => s.row_index === active.id)) {
        updated[rtEmail].push(foundStudent);
      }
      
      return updated;
    });
    
    setCurrentAssignments((prevCurrentAssignments) => {
      const updated = { ...prevCurrentAssignments };
      
      // Remove from any other current assignments (in case moving from one RT to another)
      Object.keys(updated).forEach((email) => {
        if (email !== rtEmail) {
          updated[email] = updated[email].filter((s) => s.row_index !== active.id);
        }
      });
      
      return updated;
    });
  };

  const handleNext = () => {
    const rtAssignments = {};
    
    // Only include NEW assignments made in this workflow step
    // Do NOT include existing assignments - they're already in the database
    Object.keys(assignments).forEach((rtEmail) => {
      assignments[rtEmail].forEach((student) => {
        rtAssignments[student.row_index] = rtEmail;
      });
    });
    
    onDataUpdate({ rtAssignments });
    onNext();
  };
  
  const handleExpandRT = (rtEmail) => (event, isExpanded) => {
    setExpandedRTs({ ...expandedRTs, [rtEmail]: isExpanded });
  };

  const handleStudentInfoClick = (student) => {
    setSelectedStudent(student);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
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
        Step 7: Assign Resident Tutors
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Drag and drop unassigned students to assign them to Resident Tutors. Try to distribute
        students evenly.
        <br />
        <strong>Tip:</strong> Right-click on a student card to view their details.
      </Typography>

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
            />
          </Box>
          <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
            <Grid container spacing={2}>
              {rts.map((rt) => (
                <Grid item xs={12} sm={6} key={rt.email}>
                  <RTDropZone 
                    rt={rt} 
                    students={assignments[rt.email] || []}
                    currentStudents={currentAssignments[rt.email] || []}
                    expanded={expandedRTs[rt.email] || false}
                    onExpandChange={handleExpandRT(rt.email)}
                    isOver={overId === rt.email}
                    activeId={activeId}
                    onStudentRightClick={handleStudentInfoClick}
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

      <StudentDetailsPanel
        open={detailsOpen}
        onClose={handleCloseDetails}
        student={selectedStudent}
      />
    </Box>
  );
}

export default WorkflowStep5;

