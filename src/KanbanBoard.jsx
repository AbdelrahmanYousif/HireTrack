import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from './supabaseClient'

// ─── Stage config ──────────────────────────────────────────────────────────────

const STAGES = [
  { id: 'applied',    label: 'Applied',    color: '#6c757d', bg: '#f8f9fa' },
  { id: 'screening',  label: 'Screening',  color: '#0d6efd', bg: '#e8f0fe' },
  { id: 'interview',  label: 'Interview',  color: '#fd7e14', bg: '#fff3e0' },
  { id: 'offer',      label: 'Offer',      color: '#6f42c1', bg: '#f3e8ff' },
  { id: 'hired',      label: 'Hired',      color: '#198754', bg: '#e8f5e9' },
  { id: 'rejected',   label: 'Rejected',   color: '#dc3545', bg: '#fde8ea' },
]

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]))

// ─── Candidate Card (draggable) ─────────────────────────────────────────────

function CandidateCard({ candidate, isDragging = false }) {
  const stage = STAGE_MAP[candidate.currentStage] || STAGE_MAP['applied']

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '12px 14px',
      marginBottom: '8px',
      boxShadow: isDragging
        ? '0 8px 24px rgba(0,0,0,0.15)'
        : '0 1px 3px rgba(0,0,0,0.06)',
      opacity: isDragging ? 0.95 : 1,
      cursor: isDragging ? 'grabbing' : 'grab',
      userSelect: 'none',
      transform: isDragging ? 'rotate(2deg)' : 'none',
      transition: 'box-shadow 0.15s, transform 0.15s',
    }}>
      <div style={{ fontWeight: '600', fontSize: '0.95em', marginBottom: '4px', color: '#1a1a1a' }}>
        {candidate.name}
      </div>
      <div style={{ fontSize: '0.8em', color: '#888', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {candidate.email}
      </div>
      {candidate.job_title && (
        <div style={{
          fontSize: '0.75em',
          color: '#555',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
          padding: '2px 7px',
          display: 'inline-block',
          marginBottom: '6px',
        }}>
          {candidate.job_title}
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
        {candidate.phone && (
          <span style={{ fontSize: '0.75em', color: '#777' }}>📞 {candidate.phone}</span>
        )}
        {candidate.linkedin_url && (
          <a
            href={candidate.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: '0.75em', color: '#0d6efd', textDecoration: 'none' }}
          >
            🔗 LinkedIn
          </a>
        )}
      </div>
      {candidate.notes && (
        <div style={{
          fontSize: '0.75em',
          color: '#888',
          marginTop: '6px',
          borderTop: '1px solid #f0f0f0',
          paddingTop: '6px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {candidate.notes}
        </div>
      )}
    </div>
  )
}

// ─── Sortable wrapper around CandidateCard ──────────────────────────────────

function SortableCard({ candidate }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: candidate.id, data: { candidate } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CandidateCard candidate={candidate} />
    </div>
  )
}

// ─── Column ─────────────────────────────────────────────────────────────────

function KanbanColumn({ stage, candidates, isOver }) {
  return (
    <div style={{
      flex: '0 0 220px',
      minWidth: '220px',
      backgroundColor: isOver ? '#f0f4ff' : '#f5f5f5',
      borderRadius: '10px',
      padding: '12px',
      border: isOver ? '2px dashed #007bff' : '2px solid transparent',
      transition: 'background-color 0.15s, border 0.15s',
    }}>
      {/* Column header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '10px',
        borderBottom: `3px solid ${stage.color}`,
      }}>
        <span style={{ fontWeight: '700', fontSize: '0.9em', color: stage.color }}>
          {stage.label}
        </span>
        <span style={{
          backgroundColor: stage.color,
          color: 'white',
          borderRadius: '12px',
          padding: '1px 8px',
          fontSize: '0.8em',
          fontWeight: '600',
        }}>
          {candidates.length}
        </span>
      </div>

      {/* Drop zone */}
      <SortableContext items={candidates.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div style={{ minHeight: '60px' }}>
          {candidates.map(candidate => (
            <SortableCard key={candidate.id} candidate={candidate} />
          ))}
        </div>
      </SortableContext>

      {candidates.length === 0 && (
        <div style={{
          textAlign: 'center',
          color: '#bbb',
          fontSize: '0.8em',
          padding: '20px 0',
          borderRadius: '6px',
          border: '2px dashed #e0e0e0',
        }}>
          Drop here
        </div>
      )}
    </div>
  )
}

// ─── Main KanbanBoard ────────────────────────────────────────────────────────

function KanbanBoard({ customerId, onBack }) {
  const [candidates, setCandidates] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCandidate, setActiveCandidate] = useState(null)
  const [overId, setOverId] = useState(null)

  // Filters
  const [selectedJobId, setSelectedJobId] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // require 5px drag to start
    })
  )

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)

    const [jobsResult, candidatesResult] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, title')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false }),

      supabase
        .from('candidates')
        .select(`
          id, name, email, phone, linkedin_url, notes, job_id,
          candidate_stages ( stage )
        `)
        .eq('customer_id', customerId),
    ])

    const jobsData = jobsResult.data || []
    const jobTitleMap = Object.fromEntries(jobsData.map(j => [j.id, j.title]))

    // Also fetch the latest stage for each candidate directly
    const candidateIds = (candidatesResult.data || []).map(c => c.id)
    let stageMap = {}

    if (candidateIds.length > 0) {
      const { data: stagesData } = await supabase
        .from('candidate_stages')
        .select('candidate_id, stage')
        .in('candidate_id', candidateIds)

      // Build a map of candidate_id -> stage
      ;(stagesData || []).forEach(s => {
        stageMap[s.candidate_id] = s.stage
      })
    }

    const enriched = (candidatesResult.data || []).map(c => ({
      ...c,
      currentStage: stageMap[c.id] || 'applied',
      job_title: jobTitleMap[c.job_id] || null,
    }))

    setJobs(jobsData)
    setCandidates(enriched)
    setLoading(false)
  }, [customerId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filteredCandidates = candidates.filter(c => {
    const matchesJob = selectedJobId === 'all' || c.job_id === selectedJobId
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.email.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesJob && matchesSearch
  })

  const getCandidatesForStage = (stageId) =>
    filteredCandidates.filter(c => c.currentStage === stageId)

  // ── Find which stage a candidate card or column belongs to ─────────────────

  const findStageOfItem = (id) => {
    // Is it a stage column id?
    if (STAGES.find(s => s.id === id)) return id
    // Is it a candidate id?
    const candidate = candidates.find(c => c.id === id)
    return candidate?.currentStage ?? null
  }

  // ── DnD handlers ────────────────────────────────────────────────────────────

  const handleDragStart = ({ active }) => {
    const candidate = candidates.find(c => c.id === active.id)
    setActiveCandidate(candidate || null)
  }

  const handleDragOver = ({ over }) => {
    setOverId(over?.id ?? null)
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveCandidate(null)
    setOverId(null)

    if (!over) return

    const activeStage = findStageOfItem(active.id)
    const overStage = findStageOfItem(over.id)

    if (!overStage || activeStage === overStage) return

    // Optimistically update UI
    setCandidates(prev =>
      prev.map(c => c.id === active.id ? { ...c, currentStage: overStage } : c)
    )

    // Persist to Supabase
    const { error } = await supabase
      .from('candidate_stages')
      .update({ stage: overStage })
      .eq('candidate_id', active.id)

    if (error) {
      console.error('Failed to update stage:', error)
      // Revert on failure
      setCandidates(prev =>
        prev.map(c => c.id === active.id ? { ...c, currentStage: activeStage } : c)
      )
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        Loading board...
      </div>
    )
  }

  const overStageId = overId ? findStageOfItem(overId) : null

  return (
    <div style={{ padding: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: '1.4em' }}>Hiring Pipeline</h2>

        {/* Job filter */}
        <select
          value={selectedJobId}
          onChange={e => setSelectedJobId(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '0.9em',
            backgroundColor: 'white',
            minWidth: '180px',
          }}
        >
          <option value="all">All Jobs</option>
          {jobs.map(job => (
            <option key={job.id} value={job.id}>{job.title}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Search candidates..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '0.9em',
            minWidth: '200px',
          }}
        />

        {/* Stats */}
        <span style={{ marginLeft: 'auto', color: '#888', fontSize: '0.9em' }}>
          {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? 's' : ''}
          {selectedJobId !== 'all' || searchQuery ? ' (filtered)' : ''}
        </span>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '16px',
          alignItems: 'flex-start',
        }}>
          {STAGES.map(stage => (
            // Each column needs to be a droppable target
            // We use SortableContext + a wrapper div with stage id as data
            <DroppableColumn
              key={stage.id}
              stage={stage}
              candidates={getCandidatesForStage(stage.id)}
              isOver={overStageId === stage.id && activeCandidate?.currentStage !== stage.id}
            />
          ))}
        </div>

        {/* Drag overlay — renders the floating card while dragging */}
        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeCandidate && (
            <CandidateCard candidate={activeCandidate} isDragging={true} />
          )}
        </DragOverlay>
      </DndContext>

      {filteredCandidates.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: '#aaa', marginTop: '60px', fontSize: '1.1em' }}>
          {candidates.length === 0
            ? 'No candidates yet. Add candidates from the dashboard.'
            : 'No candidates match your current filters.'}
        </div>
      )}
    </div>
  )
}

// ─── DroppableColumn wraps KanbanColumn and handles drop target via useDroppable ──

import { useDroppable } from '@dnd-kit/core'

function DroppableColumn({ stage, candidates, isOver }) {
  const { setNodeRef } = useDroppable({ id: stage.id })

  return (
    <div ref={setNodeRef}>
      <KanbanColumn stage={stage} candidates={candidates} isOver={isOver} />
    </div>
  )
}

export default KanbanBoard