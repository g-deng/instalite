import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; 
import config from '../../config.json';
import {getSocket} from "../Socket";

export default function Signup() {
    const navigate = useNavigate(); 
    // CUT HERE
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [linked_nconst, setLinkedNconst] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    // END CUT

    const rootURL = config.serverRootURL;

    const handleSubmit = (event) => {
        // CUT HERE
        event.preventDefault();

        // Make sure passwords match
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        // Send registration request to backend
        try {
            // const response = await 
            axios.post(`${rootURL}/register`, {
                    username: username, 
                    password: password,
                    linked_id: linked_nconst
                }, { withCredentials: true }).then((response) => {
                    console.log(response);
                    alert('Welcome ' + username + '!');
                    let jsonStr = response.data.message
                    // quote the keys:  username: → "username":
                    .replace(/(\w+):/g, '"$1":')
                    // convert single quotes to double quotes
                    .replace(/'/g, '"');
            
                    const obj = JSON.parse(jsonStr);
            
                    const sock = getSocket();
                    console.log(response.data);
                    sock.emit('user_connect', obj.user_id);
                    navigate("/" + username + "/home");
                }).catch((error) => {
                    console.error('Registration error:', error.response.data.error);
                    alert('Registration failed:' + error.response.data.error);
                });

            // Handle successful registration
            // Redirect to another page or perform other actions as needed
        } catch (error: any) {
            // Handle errors
            console.error('Registration error:', error.response.data.error);
            alert('Registration failed:' + error.response.data.error);
        }
        // END CUT
    };

    return (
        <div className="bg-gradient-to-br from-yellow-300 via-pink-500 to-purple-600 w-screen h-screen flex items-center justify-center">
          <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-8 max-w-sm w-full">
            <div className="flex justify-center mb-6">
              <h1 className="text-3xl font-sans font-bold text-gray-800">Sign Up to Pennstagram</h1>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <input
                  id="username"
                  type="text"
                  placeholder="Username"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <input
                  id="linked_nconst"
                  type="text"
                  placeholder="Linked nconst"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                  value={linked_nconst}
                  onChange={(e) => setLinkedNconst(e.target.value)}
                />
              </div>
              <div>
                <input
                  id="password"
                  type="password"
                  placeholder="Password"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm Password"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-blue-500 rounded-md font-semibold text-white hover:bg-blue-600 transition"
              >
                Sign Up
              </button>
            </form>
          </div>
        </div>
      );
}
