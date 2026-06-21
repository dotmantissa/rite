import { Routes, Route } from 'react-router-dom'
import { Nav }        from './components/Nav'
import { ChainGuard } from './components/ChainGuard'
import { Landing }    from './pages/Landing'
import { Swap }       from './pages/Swap'
import { Stake }      from './pages/Stake'
import { Lend }       from './pages/Lend'

export default function App() {
  return (
    <div className="min-h-screen bg-rite-bg text-white font-sans">
      <Nav />
      <ChainGuard>
        <main>
          <Routes>
            <Route path="/"      element={<Landing />} />
            <Route path="/swap"  element={<Swap />}    />
            <Route path="/stake" element={<Stake />}   />
            <Route path="/lend"  element={<Lend />}    />
          </Routes>
        </main>
      </ChainGuard>
    </div>
  )
}
