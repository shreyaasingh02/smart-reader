import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export const Login = () => {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const navigate = useNavigate()

    const collectData = async() => {
      let result = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({email, password}),
        headers: {'Content-Type' : 'application/json'}
      })
      result = await result.json();
      console.log(result)
      if(result.token) {
        localStorage.setItem("token", result.token)
        localStorage.setItem("user", JSON.stringify(result.user));
        console.log("Token stored", localStorage.getItem("token"))
        navigate("/")
      }
    }
    const navigateTo = () => {
      navigate("/signup")
    }

  return (
    <div className='flex flex-col items-center pt-40 bg-[#151515] h-[100vh] text-white'>
        <h3 className='text-2xl text-[#D9B26F]'>Login</h3>
        <input className='inputBox' type='text' value={email} onChange={(e) => setEmail(e.target.value)} placeholder='Enter Email'  />
        <input className='inputBox' type='password' value={password} onChange={(e) => setPassword(e.target.value)} placeholder='Enter Password'  />
        <button className='loginBtn' onClick={collectData}>Login</button>
        <p className='text-[18px]'>Don't have an account?</p>
        <Link to="/signup" className='cursor-pointer underline' >Sign Up</Link>
    </div>
  )
}

export default Login
