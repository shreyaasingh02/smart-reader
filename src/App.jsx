import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import {Book} from './My Components/Book'
import {SignUp} from './My Components/SignUp'
import {Login} from './My Components/Login'
import {Highlight} from './My Components/Highlight'
import {Notes} from './My Components/Notes'
import {PrivateComponent} from './My Components/PrivateComponent'
import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<Login />}></Route>
        <Route path='/signup' element={<SignUp />}></Route>

        <Route element={<PrivateComponent /> }>
          <Route path='/' element={<Book />}></Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
