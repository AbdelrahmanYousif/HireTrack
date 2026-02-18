import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import CustomerDashboard from './CustomerDashboard'

function AdminDashboard({ user, onLogout }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [managingCustomer, setManagingCustomer] = useState(null)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [role, setRole] = useState('customer')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching customers:', error)
      setLoading(false)
      return
    }

    // Fetch profiles separately to get emails
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email')

    const profileMap = Object.fromEntries((profilesData || []).map(p => [p.id, p]))

    const enriched = (data || []).map(c => ({
      ...c,
      email: profileMap[c.user_id]?.email || '—',
    }))

    setCustomers(enriched)
    setLoading(false)
  }

  const handleCreateAccount = async (e) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      const body = { email, password, role }
      if (role === 'customer') body.companyName = companyName

      const response = await fetch(
        'https://tdztiisjnippxepxwwzu.supabase.co/functions/v1/create-customer',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(body),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Server returned ${response.status}`)
      }

      setMessage(`${role === 'admin' ? 'Admin' : 'Customer'} account created successfully!`)
      setEmail('')
      setPassword('')
      setCompanyName('')
      setRole('customer')
      setShowCreateForm(false)
      fetchCustomers()

    } catch (error) {
      setMessage('Error: ' + error.message)
    }

    setLoading(false)
  }

  const handleDeleteCustomer = async (customer) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${customer.company_name}"?\n\nThis will permanently delete their account, all jobs, and all candidates. This cannot be undone.`
    )
    if (!confirmed) return

    try {
      // Delete all candidate_stages for this customer's candidates
      const { data: candidateData } = await supabase
        .from('candidates')
        .select('id')
        .eq('customer_id', customer.id)

      if (candidateData?.length > 0) {
        await supabase
          .from('candidate_stages')
          .delete()
          .in('candidate_id', candidateData.map(c => c.id))
      }

      // Delete candidates
      await supabase.from('candidates').delete().eq('customer_id', customer.id)

      // Delete jobs
      await supabase.from('jobs').delete().eq('customer_id', customer.id)

      // Delete customer record
      await supabase.from('customers').delete().eq('id', customer.id)

      // Delete from Auth via Edge Function
      const response = await fetch(
        'https://tdztiisjnippxepxwwzu.supabase.co/functions/v1/create-customer',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: 'delete', userId: customer.user_id }),
        }
      )

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      setMessage(`Customer "${customer.company_name}" deleted successfully.`)
      fetchCustomers()

    } catch (error) {
      setMessage('Error deleting customer: ' + error.message)
    }
  }

  const resetForm = () => {
    setShowCreateForm(false)
    setEmail('')
    setPassword('')
    setCompanyName('')
    setRole('customer')
    setMessage('')
  }

  // ── If managing a customer, render their dashboard ──────────────────────────
  if (managingCustomer) {
    return (
      <CustomerDashboard
        user={{ id: managingCustomer.user_id, email: managingCustomer.email }}
        onLogout={onLogout}
        adminMode={true}
        adminCompanyName={managingCustomer.company_name}
        onBackToAdmin={() => setManagingCustomer(null)}
      />
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>Admin Dashboard</h1>
        <div>
          <span style={{ marginRight: '20px' }}>Logged in as: {user.email}</span>
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

      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={() => showCreateForm ? resetForm() : setShowCreateForm(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showCreateForm ? 'Cancel' : '+ Create Account'}
        </button>
      </div>

      {showCreateForm && (
        <div style={{
          backgroundColor: '#f9f9f9',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '30px'
        }}>
          <h2>Create New Account</h2>
          <form onSubmit={handleCreateAccount}>

            {/* Role Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Account Type:</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  border: `2px solid ${role === 'customer' ? '#007bff' : '#ddd'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: role === 'customer' ? '#e8f0fe' : 'white',
                  fontWeight: role === 'customer' ? '600' : 'normal',
                  transition: 'all 0.15s',
                }}>
                  <input
                    type="radio"
                    name="role"
                    value="customer"
                    checked={role === 'customer'}
                    onChange={() => setRole('customer')}
                    style={{ display: 'none' }}
                  />
                  🏢 Customer
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  border: `2px solid ${role === 'admin' ? '#dc3545' : '#ddd'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: role === 'admin' ? '#fde8ea' : 'white',
                  fontWeight: role === 'admin' ? '600' : 'normal',
                  transition: 'all 0.15s',
                }}>
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={role === 'admin'}
                    onChange={() => setRole('admin')}
                    style={{ display: 'none' }}
                  />
                  🔑 Admin
                </label>
              </div>
              {role === 'admin' && (
                <p style={{ marginTop: '8px', fontSize: '0.85em', color: '#dc3545' }}>
                  ⚠️ Admin accounts have full access to all customers and data.
                </p>
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="6"
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>

            {role === 'customer' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Company Name:</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: role === 'admin' ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : `Create ${role === 'admin' ? 'Admin' : 'Customer'} Account`}
            </button>
          </form>
        </div>
      )}

      <div>
        <h2>All Customers</h2>
        {loading ? (
          <p>Loading...</p>
        ) : customers.length === 0 ? (
          <p>No customers yet. Create your first customer above!</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Company Name</th>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{customer.company_name}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{customer.email}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                    {new Date(customer.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setManagingCustomer(customer)}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#6f42c1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85em',
                        }}
                      >
                        🔧 Manage
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(customer)}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85em',
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard