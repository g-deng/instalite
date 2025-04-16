import { useState } from 'react';
import axios from 'axios'; // Import Axios
import config from '../../config.json';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate(); 

  // CUT HERE
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // END CUT

  const rootURL = config.serverRootURL;

  const handleLogin = async () => {
    // CUT HERE
    try {
      // Make a POST request to the login route
      const response = await axios.post(`${rootURL}/login`, {
        username,
        password
      }, { withCredentials: true });
      // Handle successful login
      console.log('Login successful:', response.data);
      console.log(response);
      navigate(`/${username}/home`);
    } catch (error) {
      // Handle login error
      console.error('Login failed:', error);
      alert('Login failed.');
    }
    // END CUT
  };

  const signup = () => {
    navigate("/signup");
  };

  return (
    <div className='w-screen h-screen flex items-center justify-center'>
      <form>
        <div className='rounded-md bg-slate-50 p-6 space-y-2 w-full'>
          <div className='font-bold flex w-full justify-center text-2xl mb-4'>
            Log In
          </div>
          <div className='flex space-x-4 items-center justify-between'>
            <label htmlFor="username" className='font-semibold'>Username</label>
            <input id="username" type="text" className='outline-none bg-white rounded-md border border-slate-100 p-2'
              value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className='flex space-x-4 items-center justify-between'>
            <label htmlFor="password" className='font-semibold'>Password</label>
            <input id="password" type="password" className='outline-none bg-white rounded-md border border-slate-100 p-2'
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className='w-full flex justify-center'>
            <button type="button" className='px-4 py-2 rounded-md bg-indigo-500 outline-none font-bold text-white'
              onClick={handleLogin}>Log in</button>
          </div>
          <div className='w-full flex justify-center'>
            <button type="button" className='px-4 py-2 rounded-md bg-indigo-500 outline-none text-white'
              onClick={signup}>Sign up</button>
          </div>
        </div>
      </form>
    </div>
  )
}
