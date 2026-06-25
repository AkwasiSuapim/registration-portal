import { useState } from 'react'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import RegisterStudent from './pages/RegisterStudent'
import AdminDashboard from './pages/AdminDashboard'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('home')

  const renderPage = () => {
    switch (currentPage) {
      case 'register': return <RegisterStudent onNavigate={setCurrentPage} />
      case 'admin':    return <AdminDashboard  onNavigate={setCurrentPage} />
      default:         return <Home            onNavigate={setCurrentPage} />
    }
  }

  return (
    <>
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="main-content">
        {renderPage()}
      </main>
    </>
  )
}

export default App
