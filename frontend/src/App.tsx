import { useState, useEffect } from 'react'

interface Ticket { id: number; title: string; description: string; status: string; category?: string; priority?: string; }
interface Article { id: number; title: string; content: string; }
interface Analytics { total: number; open: number; resolved: number; by_category: Record<string, number>; }

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [analytics, setAnalytics] = useState<Analytics>({ total: 0, open: 0, resolved: 0, by_category: {} })
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [loadingId, setLoadingId] = useState<number | null>(null)

  const fetchDashboardData = (authToken: string) => {
    fetch('http://127.0.0.1:8000/tickets/', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => {
      if (res.status === 401) handleLogout()
      return res.json()
    })
    .then(data => Array.isArray(data) ? setTickets(data) : setTickets([]))

    fetch('http://127.0.0.1:8000/articles/')
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setArticles(data) : setArticles([]))

    fetch('http://127.0.0.1:8000/analytics/summary', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => data && setAnalytics(data))
  }

  useEffect(() => {
    if (token) {
      fetchDashboardData(token)
      const ws = new WebSocket('ws://127.0.0.1:8000/ws')
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'new_ticket') {
          setTickets(prev => [data.ticket, ...prev])
          fetchDashboardData(token)
        }
      }
      return () => ws.close()
    }
  }, [token])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)

    try {
      const response = await fetch('http://127.0.0.1:8000/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      })
      if (!response.ok) throw new Error("Invalid credentials")
      const data = await response.json()
      setToken(data.access_token)
      localStorage.setItem('token', data.access_token)
    } catch {
      setLoginError("Login failed. Check your email and password.")
    }
  }

  const handleLogout = () => {
    setToken(null)
    localStorage.removeItem('token')
    setTickets([])
  }

  const generateDraft = async (ticketId: number) => {
    setLoadingId(ticketId)
    try {
      const response = await fetch(`http://127.0.0.1:8000/tickets/${ticketId}/draft`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setDrafts(prev => ({ ...prev, [ticketId]: data.draft }))
    } catch (err) {
      console.error("Draft generation failed", err)
    }
    setLoadingId(null)
  }

  const resolveTicket = async (ticketId: number) => {
    try {
      const draftText = drafts[ticketId] || "Resolved by agent."
      await fetch(`http://127.0.0.1:8000/tickets/${ticketId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reply_text: draftText })
      })

      setTickets(prev => prev.filter(t => t.id !== ticketId))
      setDrafts(prev => {
        const next = { ...prev }
        delete next[ticketId]
        return next
      })
      if (token) fetchDashboardData(token)
    } catch (err) {
      console.error("Failed to resolve ticket", err)
    }
  }

  // Injecting modern CSS for animations and sleek pseudo-classes
  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body { margin: 0; background-color: #F8FAFC; font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
    * { box-sizing: border-box; }
    
    .fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
    .slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
    
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
    
    .glass-card { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.3); box-shadow: 0 20px 40px rgba(15, 23, 42, 0.05); }
    .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .hover-lift:hover { transform: translateY(-3px); box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06); }
    
    .input-glow:focus { outline: none; border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
    
    .btn-gradient { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; transition: opacity 0.2s ease, transform 0.1s ease; }
    .btn-gradient:hover { opacity: 0.95; transform: scale(1.01); }
    .btn-gradient:active { transform: scale(0.98); }
    
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
  `

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'radial-gradient(circle at top left, #EEF2FF, #F8FAFC, #E0E7FF)' }}>
        <style>{globalStyles}</style>
        <div className="fade-in glass-card" style={{ padding: '40px', borderRadius: '24px', width: '380px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', borderRadius: '8px' }}></div>
            <h2 style={{ margin: 0, color: '#0F172A', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>ResolveIQ</h2>
          </div>
          
          <form onSubmit={handleLogin}>
            {loginError && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontWeight: 500 }}>{loginError}</div>}
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Work Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input-glow"
                style={{ width: '100%', padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', background: '#F8FAFC', transition: 'all 0.2s' }} />
            </div>
            
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="input-glow"
                style={{ width: '100%', padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', background: '#F8FAFC', transition: 'all 0.2s' }} />
            </div>
            
            <button type="submit" className="btn-gradient" style={{ width: '100%', padding: '14px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}>
              Secure Sign In
            </button>
          </form>
        </div>
      </div>
    )
  }

  const getPriorityColor = (priority?: string) => {
    switch(priority?.toLowerCase()) {
      case 'high': return { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' };
      case 'medium': return { bg: '#FEF9C3', text: '#854D0E', border: '#FDE047' };
      default: return { bg: '#E0E7FF', text: '#3730A3', border: '#A5B4FC' };
    }
  }

  return (
    <div className="fade-in" style={{ minHeight: '100vh', background: '#F8FAFC', padding: '0 32px 40px 32px' }}>
      <style>{globalStyles}</style>

      {/* Modern Top Nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(248, 250, 252, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E2E8F0', paddingTop: '20px', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', borderRadius: '6px' }}></div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.5px' }}>ResolveIQ Workspace</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F1F5F9', padding: '6px 12px', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)' }}></span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Connected</span>
          </div>
          <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#FFF', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s' }}
            onMouseOver={e => e.currentTarget.style.color = '#0F172A'} onMouseOut={e => e.currentTarget.style.color = '#64748B'}>
            Log out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Analytics KPI Ribbon */}
        <div className="slide-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
          <div className="hover-lift" style={{ background: '#FFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Volume</span>
            <div style={{ fontSize: '36px', fontWeight: 700, color: '#0F172A', letterSpacing: '-1px' }}>{analytics.total}</div>
          </div>
          
          <div className="hover-lift" style={{ background: '#FFF', padding: '24px', borderRadius: '16px', border: '1px solid #FCA5A5', borderLeft: '4px solid #EF4444', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.05)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Queue</span>
            <div style={{ fontSize: '36px', fontWeight: 700, color: '#EF4444', letterSpacing: '-1px' }}>{analytics.open}</div>
          </div>
          
          <div className="hover-lift" style={{ background: '#FFF', padding: '24px', borderRadius: '16px', border: '1px solid #86EFAC', borderLeft: '4px solid #10B981', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.05)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resolved Issues</span>
            <div style={{ fontSize: '36px', fontWeight: 700, color: '#10B981', letterSpacing: '-1px' }}>{analytics.resolved}</div>
          </div>
          
          <div className="hover-lift" style={{ background: '#FFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Categories</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              {Object.keys(analytics.by_category).length === 0 && <span style={{ color: '#94A3B8', fontSize: '14px' }}>No data</span>}
              {Object.entries(analytics.by_category).map(([cat, cnt]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '4px 10px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155', textTransform: 'capitalize' }}>{cat}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{cnt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Workspace */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '32px' }}>
          
          {/* Ticket Feed */}
          <div className="slide-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Triage Queue</h2>
              <span style={{ background: '#E2E8F0', color: '#475569', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{tickets.length} Pending</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {tickets.length === 0 ? (
                <div style={{ background: '#FFF', border: '1px dashed #CBD5E1', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', background: '#F1F5F9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>☕</div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '16px' }}>Inbox Zero</h3>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>All customer issues have been resolved.</p>
                </div>
              ) : (
                tickets.map(ticket => {
                  const pColor = getPriorityColor(ticket.priority);
                  return (
                    <div key={ticket.id} className="hover-lift" style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '17px', color: '#0F172A', fontWeight: 600 }}>{ticket.title}</h3>
                        {ticket.priority && (
                          <span style={{ fontSize: '11px', textTransform: 'uppercase', background: pColor.bg, color: pColor.text, border: `1px solid ${pColor.border}`, padding: '4px 10px', borderRadius: '20px', fontWeight: 700, letterSpacing: '0.5px' }}>
                            {ticket.priority}
                          </span>
                        )}
                      </div>
                      
                      <p style={{ color: '#475569', fontSize: '14px', margin: '0 0 20px 0', lineHeight: 1.6 }}>{ticket.description}</p>

                      {drafts[ticket.id] ? (
                        <div className="fade-in" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <span style={{ fontSize: '14px' }}>✨</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#4F46E5' }}>AI Suggested Reply</span>
                          </div>
                          
                          {/* EDITABLE TEXT AREA */}
                          <textarea
                            value={drafts[ticket.id]}
                            onChange={(e) => setDrafts(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                            className="input-glow"
                            style={{ 
                              width: '100%', 
                              minHeight: '120px', 
                              padding: '16px', 
                              borderRadius: '8px', 
                              border: '1px solid #CBD5E1', 
                              fontSize: '14px', 
                              fontFamily: 'inherit', 
                              lineHeight: 1.6,
                              resize: 'vertical', 
                              backgroundColor: '#FFF',
                              color: '#334155',
                              transition: 'all 0.2s',
                              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                            }}
                          />
                          
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button onClick={() => resolveTicket(ticket.id)} style={{ padding: '10px 20px', background: '#10B981', color: '#FFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)', transition: 'transform 0.1s' }}
                              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                              Send & Resolve Ticket
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => generateDraft(ticket.id)} disabled={loadingId === ticket.id} className={loadingId === ticket.id ? '' : 'btn-gradient'}
                          style={{ padding: '10px 20px', background: loadingId === ticket.id ? '#E2E8F0' : undefined, color: loadingId === ticket.id ? '#94A3B8' : '#FFF', border: 'none', borderRadius: '8px', cursor: loadingId === ticket.id ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {loadingId === ticket.id ? (
                            <>
                              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> Parsing context...
                            </>
                          ) : (
                            <>✨ Auto-Draft Reply</>
                          )}
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Knowledge Base */}
          <div className="slide-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <div style={{ position: 'sticky', top: '100px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Knowledge Context</h2>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {articles.map(article => (
                  <div key={article.id} className="hover-lift" style={{ background: '#FFF', border: '1px solid #E2E8F0', padding: '20px', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '16px' }}>📄</span>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>{article.title}</h4>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748B', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {article.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}

export default App