import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import KanbanBoard from './KanbanBoard'

function CustomerDashboard({ user, onLogout }) {
  const [customer, setCustomer] = useState(null)
  const [jobs, setJobs] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showJobForm, setShowJobForm] = useState(false)
  const [showCandidateForm, setShowCandidateForm] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [view, setView] = useState('dashboard') // 'dashboard' | 'kanban'

  // Job form state
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [jobLocation, setJobLocation] = useState('')
  const [jobType, setJobType] = useState('Full-time')

  // Candidate form state
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [candidatePhone, setCandidatePhone] = useState('')
  const [candidateLinkedin, setCandidateLinkedin] = useState('')
  const [candidateNotes, setCandidateNotes] = useState('')

  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchCustomerData()
  }, [user])

  const fetchCustomerData = async () => {
    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .single()

    setCustomer(customerData)

    if (customerData) {
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', customerData.id)
        .order('created_at', { ascending: false })

      setJobs(jobsData || [])

      const { data: candidatesData } = await supabase
        .from('candidates')
        .select(`*, candidate_stages (stage)`)
        .eq('customer_id', customerData.id)

      setCandidates(candidatesData || [])
    }

    setLoading(false)
  }

  const handleCreateJob = async (e) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      const { error } = await supabase.from('jobs').insert({
        customer_id: customer.id,
        title: jobTitle,
        description: jobDescription,
        location: jobLocation,
        employment_type: jobType,
        status: 'active',
      })

      if (error) throw error

      setMessage('Job created successfully!')
      setJobTitle('')
      setJobDescription('')
      setJobLocation('')
      setJobType('Full-time')
      setShowJobForm(false)
      fetchCustomerData()
    } catch (error) {
      setMessage('Error: ' + error.message)
    }

    setLoading(false)
  }

  const handleAddCandidate = async (e) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      const { data: candidateData, error: candidateError } = await supabase
        .from('candidates')
        .insert({
          customer_id: customer.id,
          job_id: selectedJobId,
          name: candidateName,
          email: candidateEmail,
          phone: candidatePhone,
          linkedin_url: candidateLinkedin,
          notes: candidateNotes,
        })
        .select()
        .single()

      if (candidateError) throw candidateError

      const { error: stageError } = await supabase
        .from('candidate_stages')
        .insert({ candidate_id: candidateData.id, stage: 'applied' })

      if (stageError) throw stageError

      setMessage('Candidate added successfully!')
      setCandidateName('')
      setCandidateEmail('')
      setCandidatePhone('')
      setCandidateLinkedin('')
      setCandidateNotes('')
      setShowCandidateForm(false)
      setSelectedJobId(null)
      fetchCustomerData()
    } catch (error) {
      setMessage('Error: ' + error.message)
    }

    setLoading(false)
  }

  const getCandidatesForJob = (jobId) => candidates.filter(c => c.job_id === jobId)

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>

  // ── Kanban view ─────────────────────────────────────────────────────────────
  if (view === 'kanban') {
    return (
      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <span style={{ fontWeight: '600', color: '#444' }}>{customer?.company_name}</span>
          </div>
          <div>
            <span style={{ marginRight: '20px', color: '#666' }}>{user.email}</span>
            <button onClick={onLogout} style={{ padding: '8px 16px' }}>Logout</button>
          </div>
        </div>
        <KanbanBoard customerId={customer.id} onBack={() => setView('dashboard')} />
      </div>
    )
  }

  // ── Dashboard view ──────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1>Customer Dashboard</h1>
          <p style={{ color: '#666', marginTop: '5px' }}>{customer?.company_name}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Kanban toggle button */}
          <button
            onClick={() => setView('kanban')}
            style={{
              padding: '8px 18px',
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9em',
            }}
          >
            📋 Kanban Board
          </button>
          <span style={{ color: '#666' }}>Logged in as: {user.email}</span>
          <button onClick={onLogout} style={{ padding: '8px 16px' }}>Logout</button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          backgroundColor: message.includes('Error') ? '#fee' : '#efe',
          border: `1px solid ${message.includes('Error') ? '#fcc' : '#cfc'}`,
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}

      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Your Jobs</h2>
          <button
            onClick={() => setShowJobForm(!showJobForm)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showJobForm ? 'Cancel' : '+ Create Job'}
          </button>
        </div>

        {showJobForm && (
          <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
            <h3>Create New Job</h3>
            <form onSubmit={handleCreateJob}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Job Title:</label>
                <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} required
                  placeholder="e.g., Senior Backend Developer" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Description:</label>
                <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} required
                  placeholder="Job description and requirements..." rows="4"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Location:</label>
                <input type="text" value={jobLocation} onChange={e => setJobLocation(e.target.value)}
                  placeholder="e.g., Stockholm, Sweden or Remote" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Employment Type:</label>
                <select value={jobType} onChange={e => setJobType(e.target.value)}
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}>
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                  <option>Internship</option>
                </select>
              </div>
              <button type="submit" disabled={loading}
                style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Creating...' : 'Create Job'}
              </button>
            </form>
          </div>
        )}

        {showCandidateForm && (
          <div style={{ backgroundColor: '#f0f8ff', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '2px solid #007bff' }}>
            <h3>Add Candidate</h3>
            <form onSubmit={handleAddCandidate}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Name:</label>
                <input type="text" value={candidateName} onChange={e => setCandidateName(e.target.value)} required
                  placeholder="e.g., Anna Andersson" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
                <input type="email" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} required
                  placeholder="anna@example.com" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Phone:</label>
                <input type="tel" value={candidatePhone} onChange={e => setCandidatePhone(e.target.value)}
                  placeholder="+46 70 123 45 67" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>LinkedIn URL:</label>
                <input type="url" value={candidateLinkedin} onChange={e => setCandidateLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/anna-andersson" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Notes:</label>
                <textarea value={candidateNotes} onChange={e => setCandidateNotes(e.target.value)}
                  placeholder="Any additional notes..." rows="3"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={loading}
                  style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Adding...' : 'Add Candidate'}
                </button>
                <button type="button" onClick={() => { setShowCandidateForm(false); setSelectedJobId(null) }}
                  style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {jobs.length === 0 ? (
          <p>No jobs yet. Create your first job posting above!</p>
        ) : (
          <div style={{ display: 'grid', gap: '15px', marginTop: '20px' }}>
            {jobs.map((job) => {
              const jobCandidates = getCandidatesForJob(job.id)
              return (
                <div key={job.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#f9f9f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                    <div>
                      <h3 style={{ marginBottom: '10px' }}>{job.title}</h3>
                      <p style={{ color: '#666', marginBottom: '10px' }}>{job.description}</p>
                      <div style={{ display: 'flex', gap: '15px', fontSize: '0.9em', color: '#888' }}>
                        <span>📍 {job.location || 'Remote'}</span>
                        <span>💼 {job.employment_type || 'Full-time'}</span>
                        <span>👥 {jobCandidates.length} candidate(s)</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setView('kanban')}
                        style={{ padding: '7px 14px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85em' }}
                      >
                        📋 Kanban
                      </button>
                      <button
                        onClick={() => { setSelectedJobId(job.id); setShowCandidateForm(true); setShowJobForm(false) }}
                        style={{ padding: '7px 14px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        + Add Candidate
                      </button>
                    </div>
                  </div>

                  {jobCandidates.length > 0 && (
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
                      <h4 style={{ marginBottom: '10px', fontSize: '1em', color: '#555' }}>Candidates:</h4>
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {jobCandidates.map((candidate) => (
                          <div key={candidate.id} style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>{candidate.name}</strong>
                              <div style={{ fontSize: '0.9em', color: '#666', marginTop: '4px' }}>
                                {candidate.email}
                                {candidate.linkedin_url && (
                                  <span> • <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a></span>
                                )}
                              </div>
                            </div>
                            <span style={{ padding: '4px 12px', backgroundColor: '#e3f2fd', color: '#1976d2', borderRadius: '12px', fontSize: '0.85em', fontWeight: '600' }}>
                              {candidate.candidate_stages?.[0]?.stage || 'applied'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerDashboard