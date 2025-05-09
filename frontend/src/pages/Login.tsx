import { useState } from 'react';
import axios from 'axios'; // Import Axios
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../Socket';

export default function Login() {
    const navigate = useNavigate();

    // CUT HERE
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    // END CUT

    const rootURL = process.env.API_URL;

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

            let jsonStr = response.data.message
                // quote the keys:  username: → "username":
                .replace(/(\w+):/g, '"$1":')
                // convert single quotes to double quotes
                .replace(/'/g, '"');

            const obj = JSON.parse(jsonStr);

            const sock = getSocket();
            if (sock.connected) {
                console.log("sock already connected");
                sock.emit('user_connect', obj.user_id);
            } else {
                console.log("making new sock connection");
                sock.on('connect', () => {
                    sock.emit('user_connect', obj.user_id);
                });
            }
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
        <div className="bg-gradient-to-br from-yellow-300 via-pink-500 to-purple-600 w-screen h-screen flex items-center justify-center">
            <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-8 max-w-sm w-full">
                <div className="flex justify-center mb-8">
                    <h1 className="text-5xl font-sans font-bold text-gray-800">Pennstagram</h1>
                </div>
                <form className="space-y-6">
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
                            id="password"
                            type="password"
                            placeholder="Password"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        className="w-full py-3 bg-blue-500 rounded-md font-semibold text-white hover:bg-blue-600 transition"
                        onClick={handleLogin}
                    >
                        Log In
                    </button>
                    <button
                        type="button"
                        className="w-full py-3 border border-gray-300 rounded-md font-semibold text-gray-700 hover:bg-gray-100 transition"
                        onClick={signup}
                    >
                        Sign Up
                    </button>
                </form>
            </div>
        </div>
    );
}
