import { FiHome, FiPlusSquare, FiUsers, FiMessageCircle, FiSearch, FiUser, FiLogOut } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import axios from "axios";
import config from '../../config.json';
import { getSocket } from "../Socket";

const Sidebar = () => {
    const { username } = useParams();
    const rootURL = process.env.API_URL;
    const navigate = useNavigate();

    const feed = () => {
        navigate('/' + username + '/home');
    };

    const post = () => {
        navigate("/" + username + "/createPost");
    }
    const friends = () => {
        navigate("/" + username + "/friends");
    };

    const chat = () => {
        navigate("/" + username + "/chat");
    };

    const chatMode = () => {
        navigate("/" + username + "/chatMode");
    };

    const profile = () => {
        navigate(`/${username}/profile`);
    };

    const logout = async () => {
        await axios.post(`${rootURL}/logout`, { withCredentials: true });
        const sock = getSocket();
        sock.disconnect();
        navigate("/");
    }
    return (<aside className="w-24 bg-white p-4 flex flex-col items-center border-r">
        <div className="space-y-4 flex flex-col">
            <div className="mb-6">
                <span className="text-3xl font-black tracking-tight">Insta</span>
            </div>

            <button
                type="button"
                onClick={feed}
                className={`p-2 rounded-lg flex flex-col items-center ${'hover:bg-gray-100'
                    }`}
            >
                <FiHome size={24} />
                <span className="text-xs mt-1">Home</span>
            </button>


            <button
                type="button"
                onClick={post}
                className={`p-2 rounded-lg flex flex-col items-center ${'hover:bg-gray-100'
                    }`}
            >
                <FiPlusSquare size={24} />
                <span className="text-xs mt-1">Post</span>
            </button>


            <button
                type="button"
                onClick={friends}
                className={`p-2 rounded-lg flex flex-col items-center ${'hover:bg-gray-100'
                    }`}
            >
                <FiUsers size={24} />
                <span className="text-xs mt-1">Friends</span>
            </button>

            <button
                type="button"
                onClick={chatMode}
                className={`p-2 rounded-lg flex flex-col items-center ${'hover:bg-gray-100'
                    }`}
            >
                <FiMessageCircle size={24} />
                <span className="text-xs mt-1">Chat</span>
            </button>

            <button
                type="button"
                onClick={chat}
                className={`p-2 rounded-lg flex flex-col items-center ${'hover:bg-gray-100'
                    }`}
            >
                <FiSearch size={24} />
                <span className="text-xs mt-1">Search</span>
            </button>

            <button
                type="button"
                onClick={profile}
                className={`p-2 rounded-lg flex flex-col items-center ${'hover:bg-gray-100'
                    }`}
            >
                <FiUser size={24} />
                <span className="text-xs mt-1">Profile</span>
            </button>
        </div>

        <div className="mt-auto" />
        <button
            type="button"
            onClick={logout}
            className={`p-2 rounded-lg flex flex-col items-center ${'hover:bg-gray-100'
                }`}
        >
            <FiLogOut size={24} />
            <span className="text-xs mt-1">Logout</span>
        </button>
    </aside>);
}

export default Sidebar;