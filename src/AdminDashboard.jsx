import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function AdminDashboard({ user, onLogout }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [message, setMessage] = useState('')

  // Fetch all customers
  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        profiles:user_id (email, full_name)
      `)

    if (error) {
      console.error('Error fetching customers:', error)
    } else {
      setCustomers(data || [])
    }
    setLoading(false)
  }

  const handleCreateCustomer = async (e) => {
  e.preventDefault()
  setMessage('')
  setLoading(true)

  try {
    // Call function using fetch with ANON key
    const response = await fetch(
      'https://tdztiisjnippxepxwwzu.supabase.co/functions/v1/create-customer',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email,
          password,
          companyName,
        }),
      }
    )

    const data = await response.json()

    console.log('Response status:', response.status)
    console.log('Response data:', data)

    if (!response.ok) {
      throw new Error(data.error || `Server returned ${response.status}`)
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to create customer')
    }

    setMessage('Customer created successfully!')
    setEmail('')
    setPassword('')
    setCompanyName('')
    setShowCreateForm(false)
    fetchCustomers() // Refresh list

  } catch (error) {
    console.error('Full error:', error)
    setMessage('Error: ' + error.message)
  }

  setLoading(false)
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
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showCreateForm ? 'Cancel' : '+ Create Customer Account'}
        </button>
      </div>

      {showCreateForm && (
        <div style={{ 
          backgroundColor: '#f9f9f9', 
          padding: '20px', 
          borderRadius: '8px',
          marginBottom: '30px'
        }}>
          <h2>Create New Customer Account</h2>
          <form onSubmit={handleCreateCustomer}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '8px' }}
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
                style={{ width: '100%', padding: '8px' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Company Name:</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                style={{ width: '100%', padding: '8px' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : 'Create Customer'}
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
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{customer.company_name}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{customer.profiles?.email}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                    {new Date(customer.created_at).toLocaleDateString()}
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