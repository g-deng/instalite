import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import CreatePostComponent from '../components/CreatePostComponent';
import Sidebar from '../components/Sidebar';

export default function Home() {

    const { username } = useParams();
    const rootURL = process.env.API_URL;
    // CUT HERE
    const [_, setPosts] = useState([]);
    // END CUT

    const fetchData = async () => {
        // CUT HERE
        try {
            const response = await axios.get(`${rootURL}/${username}/feed`, { withCredentials: true });
            setPosts(response.data.results);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
        // END CUT
    };
    useEffect(() => {
        fetchData();
    }, []);


    return (
        <div className='w-screen h-screen flex flex-row'>
            {/* Sidebar */}
            <Sidebar />
            {/* Main Feed Column */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-white flex items-center justify-center border-b shadow-sm flex-shrink-0">
                    <span className="text-2xl font-medium">{`New Post`}</span>
                </header>

                <div className="flex-1 overflow-y-auto mx-auto w-full max-w-[600px] flex flex-col items-center space-y-4 p-4">
                    <CreatePostComponent updatePosts={fetchData} />
                </div>
            </div>

        </div>
    )
}
