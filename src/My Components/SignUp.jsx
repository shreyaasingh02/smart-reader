import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL;

export const SignUp = () => {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const navigate = useNavigate()

    const collectData = async() => {
        console.log("Data collected")
        let result = await fetch(`${API_URL}/api/auth/signup`, {
            method: "POST",
            body: JSON.stringify({name, email, password}),
            headers : {
                'Content-Type' : 'application/json'
            },
        })
        result = await result.json();
        console.log(result)
        if(result) {
            navigate("/")
        }
    }

  return (
    <div className='flex flex-col items-center pt-40 bg-[#151515] h-[100vh] text-white'>
        <h3 className='text-2xl text-[#D9B26F] ' >Register/Sign Up</h3>
        <input className='inputBox' type='text' value={name} onChange={(e) => setName(e.target.value)} placeholder='Enter your good name'  />
        <input className='inputBox' type='text' value={email} onChange={(e) => setEmail(e.target.value)} placeholder='Enter Email'  />
        <input className='inputBox' type='password' value={password} onChange={(e) => setPassword(e.target.value)} placeholder='Enter Password'  />
        <button className='loginBtn' onClick={collectData}>Register</button>
    </div>
  )
}

export default SignUp
