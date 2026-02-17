import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import AdminDashboard from './AdminDashboard'
import CustomerDashboard from './CustomerDashboard'

function App() {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check if user is logged in on mount
  useEffect(() => {
    checkUser()

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchUserRole(session.user.id)
      } else {
        setUser(null)
        setUserRole(null)
      }
    })

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      setUser(session.user)
      await fetchUserRole(session.user.id)
    }
    
    setLoading(false)
  }

  const fetchUserRole = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching role:', error)
    } else {
      setUserRole(data?.role)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>
  }

  // Not logged in - show login
  if (!user) {
    return <Login />
  }

  // Logged in as admin - show admin dashboard
  if (userRole === 'admin') {
    return <AdminDashboard user={user} onLogout={handleLogout} />
  }

  // Logged in as customer - show customer dashboard
  if (userRole === 'customer') {
    return <CustomerDashboard user={user} onLogout={handleLogout} />
  }

  return <div>Unknown user role</div>
}

export default App