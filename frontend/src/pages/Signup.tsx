import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../../config.json';
import { getSocket } from "../Socket";

export default function Signup() {
    const navigate = useNavigate();
    // State variables
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [linked_nconst, setLinkedNconst] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [birthday, setBirthday] = useState('');
    const [affiliation, setAffiliation] = useState('');
    const [hashtags, setHashtags] = useState('');
    const [popularHashtags, setPopularHashtags] = useState<{ tag: string }[]>([]);
    const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);

    const rootURL = config.serverRootURL;

    // Fetch popular hashtags on component mount
    useEffect(() => {
        const fetchPopularHashtags = async () => {
            try {
                const response = await axios.get(`${rootURL}/popularHashtags`);
                // truncate if more than 10
                setPopularHashtags(response.data.hashtags.slice(0, 10));
            } catch (error) {
                console.error('Error fetching popular hashtags:', error);
            }
        };

        fetchPopularHashtags();
    }, [rootURL]);

    // select hashtags
    const toggleHashtag = (tag) => {
        const isSelected = selectedHashtags.includes(tag);

        if (isSelected) {
            setSelectedHashtags(selectedHashtags.filter(t => t !== tag));
        } else {
            setSelectedHashtags([...selectedHashtags, tag]);
        }
    };

    // update hashtags string when selected hashtags change
    useEffect(() => {
        setHashtags(selectedHashtags.join(','));
    }, [selectedHashtags]);

    const handleSubmit = (event) => {
        event.preventDefault();

        // Make sure passwords match
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        // Send registration request to backend
        try {
            axios.post(`${rootURL}/register`, {
                username: username,
                password: password,
                linked_nconst: linked_nconst,
                first_name: firstName,
                last_name: lastName,
                email: email,
                birthday: birthday,
                affiliation: affiliation,
                hashtags: hashtags // Send the comma-separated hashtags
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
                navigate("/" + username + "/selectPhoto");
            }).catch((error) => {
                console.error('Registration error:', error.response.data.error);
                alert('Registration failed:' + error.response.data.error);
            });
        } catch (error: any) {
            console.error('Registration error:', error.response?.data?.error);
            alert('Registration failed:' + error.response?.data?.error);
        }
    };

    const login = () => {
        navigate("/");
    }

    return (
        <div className="bg-gradient-to-br from-yellow-300 via-pink-500 to-purple-600 w-screen h-screen flex items-center justify-center overflow-hidden">
            <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-8 max-w-sm w-full max-h-screen overflow-y-auto">
                <div className="relative mb-6">
                    <h1 className="text-center text-3xl font-sans font-bold text-gray-800">
                        Sign Up to Pennstagram
                    </h1>
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
                            required
                        />
                    </div>
                    <div className="flex space-x-2">
                        <input
                            id="firstName"
                            type="text"
                            placeholder="First Name"
                            className="w-1/2 p-3 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                        />
                        <input
                            id="lastName"
                            type="text"
                            placeholder="Last Name"
                            className="w-1/2 p-3 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <input
                            id="email"
                            type="email"
                            placeholder="Email"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <input
                            id="birthday"
                            type="date"
                            placeholder="Birthday"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                            value={birthday}
                            onChange={(e) => setBirthday(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <input
                            id="affiliation"
                            type="text"
                            placeholder="Affiliation (e.g., School, Company)"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                            value={affiliation}
                            onChange={(e) => setAffiliation(e.target.value)}
                            required
                        />
                    </div>
                    {/* Interest Hashtags Section */}
                    <div className="border p-3 rounded-md bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select your interests (Top 10 Popular Hashtags)
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {popularHashtags.map((item, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => toggleHashtag(item.tag)}
                                    className={`text-sm px-3 py-1 rounded-full ${selectedHashtags.includes(item.tag)
                                        ? 'bg-pink-500 text-white'
                                        : 'bg-gray-200 text-gray-800'
                                        }`}
                                >
                                    #{item.tag}
                                </button>
                            ))}
                        </div>
                        <input
                            id="hashtags"
                            type="text"
                            placeholder="Or add custom interests (comma-separated)"
                            className="w-full p-3 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                            value={hashtags}
                            onChange={(e) => setHashtags(e.target.value)}
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
                            required
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
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-blue-500 rounded-md font-semibold text-white hover:bg-blue-600 transition"
                    >
                        Sign Up
                    </button>
                    <button
                        type="button"
                        onClick={login}
                        className="w-full py-3 border border-gray-300 rounded-md font-semibold text-gray-700 hover:bg-gray-100 transition"
                    >
                        Back to Login
                    </button>
                </form>
            </div>
        </div>
    );
}
